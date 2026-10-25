#!/usr/bin/env python3
"""TypeScript / JavaScript のコードが設計の決まり（Clean / SOLID）を守っているかを検査する。

見るもの（設定ファイルで閾値と層の決まりを書く）：
  - file-lines     … 1ファイルの行数（SRP：変わる理由が多いファイル）
  - func-lines     … トップレベルの関数・コンポーネントの行数（SRP：長い関数）
  - layer          … 層の決まりに反する import（依存の向き・DIP）
  - cycle          … ファイル単位の循環 import
  - unused-export  … どこからも import されない export（死んだコード）
  - test-only-export … テストからだけ使う export（本番では死んだコード。テストのための定数などは基準に入れておく）

今ある違反は baseline（基準）に記録し、**新しく増えた違反だけ**を失敗にする（ラチェット）。
直して違反が減ったら --update-baseline で基準を縮める。

使い方：
  python3 check_code.py <プロジェクトのパス> [--config code-rules.json] [--update-baseline] [--all]

設定（<プロジェクト>/code-rules.json）の例：
  {
    "src": "src",
    "exclude": ["**/*.test.ts", "**/*.test.tsx"],
    "maxFileLines": 600,
    "maxFunctionLines": 150,
    "layers": {
      "src/lib/**": { "forbid": ["react", "src/store/**", "src/components/**", "src/pages/**"] }
    },
    "unusedExports": true,
    "baseline": "code-rules.baseline.json"
  }

Biome を使うプロジェクトでは --sync-biome で biome.json に同じ決まりを書き出す（エディタで書いている最中に見える）：
  - 層の決まり → overrides の noRestrictedImports（基準にある層の違反のファイルは除く）
  - 関数の行数 → noExcessiveLinesPerFunction（警告。テストは除く）
  biome.json の overrides は生成物として丸ごと置き換える。ずれていれば通常の検査で biome-sync の違反になる。

標準ライブラリだけで動く。字句の解析は簡易（文字列・コメント・テンプレートを除いてから括弧を数える）。
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import sys
from pathlib import Path

EXTS = ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs')

DEFAULTS = {
    'src': 'src',
    'exclude': ['**/*.test.*', '**/*.spec.*', '**/*.d.ts'],
    'maxFileLines': 600,
    'maxFunctionLines': 150,
    'layers': {},
    'unusedExports': True,
    'baseline': 'code-rules.baseline.json',
}


def match(path: str, pattern: str) -> bool:
    # "src/lib/**" は src/lib 以下のすべて。fnmatch の * は / もまたぐので ** と * を同じに扱う
    return fnmatch.fnmatch(path, pattern) or fnmatch.fnmatch(path, pattern.replace('/**', ''))


def strip_code(text: str) -> str:
    """文字列・コメント・テンプレートの中身を空白にする（改行は残して行番号を保つ）。"""
    out = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ''
        if c == '/' and nxt == '/':
            j = text.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i))
            i = j
        elif c == '/' and nxt == '*':
            j = text.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(re.sub(r'[^\n]', ' ', text[i:j]))
            i = j
        elif c in ('"', "'", '`'):
            j = i + 1
            while j < n and text[j] != c:
                if text[j] == '\\':
                    j += 1
                elif c != '`' and text[j] == '\n':
                    break
                j += 1
            j = min(j + 1, n)
            out.append(c + re.sub(r'[^\n]', ' ', text[i + 1 : j - 1]) + (c if j <= n else ''))
            i = j
        else:
            out.append(c)
            i += 1
    return ''.join(out)


IMPORT_RE = re.compile(
    r'^\s*(import|export)\s+(type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?[\'"]([^\'"]+)[\'"]', re.M
)
DYN_IMPORT_RE = re.compile(r'import\(\s*[\'"]([^\'"]+)[\'"]\s*\)')
NAMED_IMPORT_RE = re.compile(r'^\s*import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:\*\s+as\s+\w+\s+)?from\s+[\'"]([^\'"]+)[\'"]', re.M)
REEXPORT_RE = re.compile(r'^\s*export\s+(?:type\s+)?(\*|\{([^}]*)\})\s+from\s+[\'"]([^\'"]+)[\'"]', re.M)
EXPORT_DECL_RE = re.compile(
    r'^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+(\w+)', re.M
)
EXPORT_LIST_RE = re.compile(r'^export\s+(?:type\s+)?\{([^}]*)\}\s*;?\s*$', re.M)
TOP_FUNC_RE = re.compile(r'^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\*?\s+(\w+)', re.M)
TOP_CONST_RE = re.compile(r'^(?:export\s+)?(?:const|let)\s+(\w+)\b[^=\n]*=(?!=)', re.M)


def match_close(code: str, i: int, open_c: str, close_c: str) -> int:
    """code[i] の括弧に対応する閉じ括弧の位置。"""
    depth = 0
    while i < len(code):
        if code[i] == open_c:
            depth += 1
        elif code[i] == close_c:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(code) - 1


def body_start(code: str, m: re.Match, is_const: bool) -> int:
    """トップレベルの関数の本体の { の位置。関数でない・式だけのアロー関数なら -1。"""
    i = m.end()
    if not is_const:
        p = code.find('(', i)
        if p < 0:
            return -1
        b = code.find('{', match_close(code, p, '(', ')'))
        return b
    depth = 0
    while i < len(code) - 1:
        c = code[i]
        if c in '([':
            depth += 1
        elif c in ')]':
            depth -= 1
        elif depth == 0 and c == ';':
            return -1
        elif depth == 0 and c == '\n' and i + 1 < len(code) and code[i + 1] not in ' \t\n)}]':
            return -1  # 次のトップレベルの文に入った
        elif depth == 0 and c == '{' and code[i - 1] != '$':
            # 型の { } は飛ばす（=> より前）
            i = match_close(code, i, '{', '}')
        elif depth == 0 and code.startswith('=>', i):
            j = i + 2
            while j < len(code) and code[j] in ' \t\n':
                j += 1
            return j if j < len(code) and code[j] == '{' else -1
        i += 1
    return -1


class Project:
    def __init__(self, root: Path, cfg: dict):
        self.root = root
        self.cfg = cfg
        src = root / cfg['src']
        self.files: dict[str, Path] = {}
        for p in sorted(src.rglob('*')):
            if p.suffix not in EXTS or not p.is_file() or 'node_modules' in p.parts:
                continue
            rel = p.relative_to(root).as_posix()
            if any(match(rel, pat) for pat in cfg['exclude']):
                continue
            self.files[rel] = p
        # import の解決には除外したファイル（テスト）からの参照も数える
        self.all_files = {p.relative_to(root).as_posix() for p in src.rglob('*') if p.suffix in EXTS}
        self.text = {rel: p.read_text(encoding='utf-8') for rel, p in self.files.items()}
        self.code = {rel: strip_code(t) for rel, t in self.text.items()}

    def resolve(self, frm: str, spec: str) -> str | None:
        if not spec.startswith('.'):
            return None
        base = (Path(frm).parent / spec).as_posix()
        parts = []
        for seg in base.split('/'):
            if seg == '..':
                if parts:
                    parts.pop()
            elif seg not in ('', '.'):
                parts.append(seg)
        base = '/'.join(parts)
        stem = re.sub(r'\.(js|jsx|mjs|cjs)$', '', base)
        for cand in (base, *(stem + e for e in EXTS), *(f'{base}/index{e}' for e in EXTS)):
            if cand in self.all_files:
                return cand
        return None

    def imports(self, rel: str, runtime_only: bool):
        """(指定子, 解決したパス, type だけか) を返す。"""
        text = self.text[rel]
        for m in IMPORT_RE.finditer(text):
            is_type = bool(m.group(2))
            if runtime_only and is_type:
                continue
            yield m.group(3), self.resolve(rel, m.group(3))
        for m in DYN_IMPORT_RE.finditer(text):
            yield m.group(1), self.resolve(rel, m.group(1))


def check_sizes(pj: Project):
    for rel, text in pj.text.items():
        n = text.count('\n') + 1
        if n > pj.cfg['maxFileLines']:
            yield ('file-lines', rel, f'{n} 行（上限 {pj.cfg["maxFileLines"]}）', n)
        code = pj.code[rel]
        heads = [(m, False) for m in TOP_FUNC_RE.finditer(code)] + [(m, True) for m in TOP_CONST_RE.finditer(code)]
        for m, is_const in heads:
            name = m.group(1)
            start = body_start(code, m, is_const)
            if start < 0:
                continue
            i = match_close(code, start, '{', '}')
            lines = code.count('\n', m.start(), i) + 1
            if lines > pj.cfg['maxFunctionLines']:
                line_no = code.count('\n', 0, m.start()) + 1
                yield ('func-lines', f'{rel}:{name}', f'{lines} 行（上限 {pj.cfg["maxFunctionLines"]}。{line_no} 行目）', lines)


def check_layers(pj: Project):
    for rel in pj.files:
        rules = [r for pat, r in pj.cfg['layers'].items() if match(rel, pat)]
        if not rules:
            continue
        for spec, target in pj.imports(rel, runtime_only=False):
            for r in rules:
                for bad in r.get('forbid', []):
                    hit = (target and match(target, bad)) or (not spec.startswith('.') and (spec == bad or spec.startswith(bad + '/')))
                    if hit and not any(target and match(target, ok) for ok in r.get('allow', [])):
                        yield ('layer', f'{rel} -> {target or spec}', f'{bad} を import してはいけない', 0)


def check_cycles(pj: Project):
    graph = {rel: sorted({t for _, t in pj.imports(rel, runtime_only=True) if t in pj.files}) for rel in pj.files}
    index, low, stack, on, comps, counter = {}, {}, [], set(), [], [0]
    sys.setrecursionlimit(10000)

    def visit(v):
        index[v] = low[v] = counter[0]
        counter[0] += 1
        stack.append(v)
        on.add(v)
        for w in graph[v]:
            if w not in index:
                visit(w)
                low[v] = min(low[v], low[w])
            elif w in on:
                low[v] = min(low[v], index[w])
        if low[v] == index[v]:
            comp = []
            while True:
                w = stack.pop()
                on.discard(w)
                comp.append(w)
                if w == v:
                    break
            if len(comp) > 1:
                comps.append(sorted(comp))

    for v in graph:
        if v not in index:
            visit(v)
    for comp in comps:
        yield ('cycle', ' ⇄ '.join(comp), f'{len(comp)} ファイルの循環 import', 0)


def check_unused(pj: Project):
    if not pj.cfg['unusedExports']:
        return
    used: dict[str, set[str]] = {}
    star: set[str] = set()
    for rel in pj.all_files:
        p = pj.root / rel
        text = pj.text.get(rel) or p.read_text(encoding='utf-8')
        is_test = rel not in pj.files
        for m in NAMED_IMPORT_RE.finditer(text):
            target = pj.resolve(rel, m.group(3))
            if not target:
                continue
            names = used.setdefault(target, set())
            if m.group(1):
                names.add('default')
            for part in (m.group(2) or '').split(','):
                name = part.strip().removeprefix('type ').split(' as ')[0].strip()
                if name:
                    names.add(name if not is_test else name)
            if '* as' in m.group(0):
                star.add(target)
        for m in REEXPORT_RE.finditer(text):
            target = pj.resolve(rel, m.group(3))
            if not target:
                continue
            if m.group(1) == '*':
                star.add(target)
            for part in (m.group(2) or '').split(','):
                name = part.strip().removeprefix('type ').split(' as ')[0].strip()
                if name:
                    used.setdefault(target, set()).add(name)
        for m in DYN_IMPORT_RE.finditer(text):
            target = pj.resolve(rel, m.group(1))
            if target:
                star.add(target)
    # テストからだけ使われる export も「本番で未使用」として数える
    prod_used: dict[str, set[str]] = {}
    for rel in pj.files:
        for m in NAMED_IMPORT_RE.finditer(pj.text[rel]):
            target = pj.resolve(rel, m.group(3))
            if not target:
                continue
            for part in (m.group(2) or '').split(','):
                name = part.strip().removeprefix('type ').split(' as ')[0].strip()
                if name:
                    prod_used.setdefault(target, set()).add(name)
            if m.group(1):
                prod_used.setdefault(target, set()).add('default')
        for m in REEXPORT_RE.finditer(pj.text[rel]):
            target = pj.resolve(rel, m.group(3))
            for part in (m.group(2) or '').split(','):
                name = part.strip().removeprefix('type ').split(' as ')[0].strip()
                if target and name:
                    prod_used.setdefault(target, set()).add(name)
    for rel in pj.files:
        if rel in star or re.search(r'(^|/)(main|index)\.[tj]sx?$', rel):
            continue
        code = pj.code[rel]
        names = {('default' if re.match(r'export\s+default\b', code[mm.start():]) else mm.group(1)) for mm in EXPORT_DECL_RE.finditer(code)}
        for m in EXPORT_LIST_RE.finditer(code):
            names |= {p.strip().split(' as ')[-1].strip() for p in m.group(1).split(',') if p.strip()}
        own = pj.code[rel]
        for name in sorted(names):
            if name in prod_used.get(rel, set()):
                continue
            # 同じファイルの中で使っていれば export を外すだけでよい（数えない）
            if len(re.findall(rf'\b{re.escape(name)}\b', own)) > 1:
                continue
            if name in used.get(rel, set()):
                if pj.cfg.get('testOnlyExports', True):
                    yield ('test-only-export', f'{rel}:{name}', '本番のコードからは使わず、テストからだけ使う', 0)
            else:
                yield ('unused-export', f'{rel}:{name}', 'どこからも使わない', 0)


def biome_module(pattern: str) -> list[str]:
    """code-rules の禁止先（src/store/** など）を Biome の import の指定子の型に直す。"""
    segs = [x for x in pattern.split('/') if x and '*' not in x]
    name = segs[-1]
    return [f'**/{name}', f'**/{name}/**']


def biome_overrides(cfg: dict, baseline: dict) -> list:
    exceptions: dict[str, set[str]] = {}
    for key in baseline:
        if key.startswith('layer '):
            frm = key.split(' ', 1)[1].split(' -> ')[0]
            for pat in cfg['layers']:
                if match(frm, pat):
                    exceptions.setdefault(pat, set()).add(frm)
    out = [
        {
            'includes': ['**/*.test.*', '**/*.spec.*', 'e2e/**', 'scripts/**'],
            'linter': {'rules': {'complexity': {'noExcessiveLinesPerFunction': 'off'}}},
        }
    ]
    for pat, rule in cfg['layers'].items():
        paths = {m: f'{pat} は {m} に依存しない（code-rules.json）' for m in rule.get('forbid', []) if not m.startswith(('src/', '.'))}
        groups = [g for m in rule.get('forbid', []) if m.startswith('src/') for g in biome_module(m)]
        options: dict = {}
        if paths:
            options['paths'] = paths
        if groups:
            options['patterns'] = [{'group': groups, 'message': f'{pat} の層の決まりに反する import（code-rules.json）'}]
        includes = [pat, *(f'!{x}' for x in cfg['exclude']), *(f'!{f}' for f in sorted(exceptions.get(pat, ())))]
        out.append({'includes': includes, 'linter': {'rules': {'style': {'noRestrictedImports': {'level': 'error', 'options': options}}}}})
    return out


def biome_config(root: Path, cfg: dict, baseline: dict) -> tuple[Path, dict, dict] | None:
    path = root / 'biome.json'
    if not path.exists():
        return None
    cur = json.loads(path.read_text(encoding='utf-8'))
    new = json.loads(json.dumps(cur))
    rules = new.setdefault('linter', {}).setdefault('rules', {})
    rules.setdefault('complexity', {})['noExcessiveLinesPerFunction'] = {
        'level': 'warn',
        'options': {'maxLines': cfg['maxFunctionLines'], 'skipBlankLines': True},
    }
    new['overrides'] = biome_overrides(cfg, baseline)
    return path, cur, new


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('project', nargs='?', default='.')
    ap.add_argument('--config', default='code-rules.json')
    ap.add_argument('--update-baseline', action='store_true', help='今の違反を基準として書き出す')
    ap.add_argument('--all', action='store_true', help='基準にある違反も表示する')
    ap.add_argument('--sync-biome', action='store_true', help='biome.json に層の決まりと関数の行数を書き出す')
    args = ap.parse_args()

    root = Path(args.project).resolve()
    cfg_path = root / args.config
    cfg = dict(DEFAULTS)
    if cfg_path.exists():
        cfg.update(json.loads(cfg_path.read_text(encoding='utf-8')))
    pj = Project(root, cfg)

    found = [*check_sizes(pj), *check_layers(pj), *check_cycles(pj), *check_unused(pj)]
    keyed = {f'{kind} {key}': (kind, key, msg, size) for kind, key, msg, size in found}

    base_path = root / cfg['baseline']
    if args.update_baseline:
        # 大きさの違反は「今の大きさ」を記録し、それより大きくなったら新しい違反にする
        data = {k: v[3] for k, v in sorted(keyed.items())}
        base_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'基準を書き出した：{base_path.relative_to(root)}（{len(data)} 件）')
        if not args.sync_biome:
            return 0

    baseline: dict[str, int] = json.loads(base_path.read_text(encoding='utf-8')) if base_path.exists() else {}
    biome = biome_config(root, cfg, baseline)
    if args.sync_biome:
        if not biome:
            print('biome.json が無い')
            return 1
        path, _, new = biome
        path.write_text(json.dumps(new, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        # Biome の書式にそろえる（入っていれば。そろえないと biome check が書式の違いで落ちる）
        biome_bin = root / 'node_modules' / '.bin' / 'biome'
        if biome_bin.exists():
            import subprocess

            subprocess.run([str(biome_bin), 'format', '--write', str(path)], cwd=root, capture_output=True)
        print(f'biome.json に書き出した（層の決まり {len(cfg["layers"])} 件）')
        return 0
    if biome and biome[1] != biome[2]:
        keyed['biome-sync biome.json'] = ('biome-sync', 'biome.json', 'code-rules.json・基準と合っていない（--sync-biome で書き直す）', 0)
    new, grown, known = [], [], []
    for k, (kind, key, msg, size) in sorted(keyed.items()):
        if k not in baseline:
            new.append((kind, key, msg))
        elif size and size > baseline[k]:
            grown.append((kind, key, f'{msg}。基準 {baseline[k]} から増えた'))
        else:
            known.append((kind, key, msg))
    fixed = [k for k in baseline if k not in keyed]

    print(f'# コードの検査：{len(pj.files)} ファイル')
    print(f'新しい違反 {len(new)} / 大きくなった {len(grown)} / 基準にある違反 {len(known)} / 直った {len(fixed)}')
    for title, rows in (('新しい違反', new), ('基準より大きくなった', grown), *((('基準にある違反', known),) if args.all else ())):
        if rows:
            print(f'\n## {title}')
            for kind, key, msg in rows:
                print(f'- [{kind}] {key}：{msg}')
    if fixed:
        print('\n## 直った（--update-baseline で基準から外す）')
        for k in fixed:
            print(f'- {k}')
    return 1 if new or grown else 0


if __name__ == '__main__':
    sys.exit(main())
