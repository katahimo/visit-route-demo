#!/usr/bin/env python3
"""PRD（docs/prd.md と テーマ別の docs/prd/*.md）を検査する。--fix で索引と表の並びを直す。

PRD の形（SKILL.md「設計書を育てる」）:
  - docs/prd.md：概要・共通の決まり・「### 索引」（テーマ｜ファイル｜D番号）・「### 廃止した D番号」（廃止｜置き換え先）
  - docs/prd/<テーマ>.md：先頭の「# PRD §3 要件：<テーマ>」と、要件の表（| ID | 要件 | 優先度 |）。各表は D番号の昇順

検査内容:
  - テーマ別ファイルの表に廃止の行（「（廃止。→Dn）」）が残っていないか（廃止した D番号の表へ移す）
  - D番号の重複（ファイルをまたぐ・廃止した番号の使い回し）
  - 廃止の置き換え先が今ある D番号か
  - 索引がテーマ別ファイルと一致するか（ファイル・D番号の載せ漏れ）
  - 表が D番号の昇順か
  - 大きさ（prd.md・テーマ別ファイル）
  - prd.md に要件の表が残っていないか（テーマ別ファイルへ移す）

使い方:
  python3 check_prd.py docs/prd.md [--fix] [--json]
終了コード: エラーがあれば 1、なければ 0（--fix で直したものはエラーに数えない）
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

MAX_PRD_BYTES = 40_000
MAX_THEME_BYTES = 40_000
INDEX_HEAD = "### 索引"
RETIRED_HEAD = "### 廃止した D番号"
THEME_TITLE = re.compile(r"^# PRD §3 要件：(.+)$")
ROW = re.compile(r"^\| (D(\d+)) \|")
RETIRED_ROW = re.compile(r"^\| (D\d+) \| （廃止。→(.+?)） \|")
D_REF = re.compile(r"D(\d+)(?:〜D(\d+))?")


def compress(ns: list[int]) -> str:
    """[1,2,3,5] → 'D1〜D3 D5'。2つ続きは並べて書く。"""
    out, ns = [], sorted(set(ns))
    i = 0
    while i < len(ns):
        j = i
        while j + 1 < len(ns) and ns[j + 1] == ns[j] + 1:
            j += 1
        a, b = ns[i], ns[j]
        out.append(f"D{a}" if a == b else f"D{a} D{b}" if b == a + 1 else f"D{a}〜D{b}")
        i = j + 1
    return " ".join(out)


def expand(text: str) -> set[int]:
    res: set[int] = set()
    for a, b in D_REF.findall(text):
        res.update(range(int(a), int(b or a) + 1))
    return res


def section(lines: list[str], head: str) -> tuple[int, int] | None:
    """見出し head の本文の範囲（見出しの次の行〜次の見出しの前）。"""
    if head not in lines:
        return None
    s = lines.index(head) + 1
    e = next((k for k in range(s, len(lines)) if lines[k].startswith("#")), len(lines))
    return s, e


def sort_tables(lines: list[str]) -> tuple[list[str], bool]:
    """続いた要件の行（| Dn |）を D番号の昇順に並べる。"""
    out, changed, i = [], False, 0
    while i < len(lines):
        if ROW.match(lines[i]):
            j = i
            while j < len(lines) and ROW.match(lines[j]):
                j += 1
            block = lines[i:j]
            srt = sorted(block, key=lambda l: int(ROW.match(l).group(2)))
            changed |= srt != block
            out += srt
            i = j
        else:
            out.append(lines[i])
            i += 1
    return out, changed


def check(prd: Path, fix: bool) -> dict:
    issues: list[dict] = []

    def add(level: str, where: str, msg: str, how: str = "") -> None:
        issues.append({"level": level, "where": where, "message": msg, "fix": how})

    lines = prd.read_text(encoding="utf-8").split("\n")
    theme_dir = prd.parent / prd.stem
    fixed: list[str] = []

    if len(prd.read_bytes()) > MAX_PRD_BYTES:
        add("WARN", prd.name, f"{len(prd.read_bytes()) // 1000}KB あります（目安 {MAX_PRD_BYTES // 1000}KB）",
            "要件の表をテーマ別の docs/prd/<テーマ>.md へ移し、prd.md は概要・索引・廃止した D番号だけにする")

    themes = sorted(theme_dir.glob("*.md")) if theme_dir.is_dir() else []
    if not themes:
        add("INFO", prd.name, "テーマ別の要件のファイル（docs/prd/）がありません", "大きくなったら分ける（SKILL.md「設計書を育てる」）")
        return {"summary": summarize(prd, issues, fixed), "issues": issues}

    # prd.md に要件の表が残っていないか
    rsec = section(lines, RETIRED_HEAD)
    in_retired = set(range(*rsec)) if rsec else set()
    left = [m.group(1) for k, l in enumerate(lines) if (m := ROW.match(l)) and k not in in_retired]
    if left:
        add("ERROR", prd.name, f"要件の行が prd.md にあります（{' '.join(left[:5])}{' ほか' if len(left) > 5 else ''}）", "テーマ別の docs/prd/<テーマ>.md へ移す")

    # テーマ別ファイル
    live: dict[int, str] = {}
    by_file: dict[str, tuple[str, list[int]]] = {}
    for f in themes:
        rel = f"{theme_dir.name}/{f.name}"
        tl = f.read_text(encoding="utf-8").split("\n")
        m = THEME_TITLE.match(tl[0]) if tl else None
        if not m:
            add("ERROR", rel, "1行目が「# PRD §3 要件：<テーマ>」ではありません", "索引のテーマ名はこの見出しから作る")
        title = m.group(1) if m else f.stem
        if len(f.read_bytes()) > MAX_THEME_BYTES:
            add("WARN", rel, f"{len(f.read_bytes()) // 1000}KB あります（目安 {MAX_THEME_BYTES // 1000}KB）", "テーマを2つに分け、索引を --fix で作り直す")
        for l in tl:
            if RETIRED_ROW.match(l):
                add("ERROR", rel, f"廃止の行が表に残っています（{RETIRED_ROW.match(l).group(1)}）", f"行を消し、prd.md の「{RETIRED_HEAD[4:]}」に「| Dn | 置き換え先 |」を足す")
        sorted_tl, changed = sort_tables(tl)
        if changed:
            if fix:
                f.write_text("\n".join(sorted_tl), encoding="utf-8")
                fixed.append(f"{rel}：表を D番号の昇順に並べた")
            else:
                add("ERROR", rel, "表が D番号の昇順ではありません", "check_prd.py --fix で並べ直す")
        ds = []
        for l in tl:
            m2 = ROW.match(l)
            if not m2 or RETIRED_ROW.match(l):
                continue
            n = int(m2.group(2))
            if n in live:
                add("ERROR", rel, f"D{n} が {live[n]} にもあります", "D番号は1つの行だけに使う")
            live[n] = rel
            ds.append(n)
        by_file[rel] = (title, ds)

    # 廃止した D番号
    retired: dict[int, str] = {}
    if not rsec:
        add("ERROR", prd.name, f"「{RETIRED_HEAD}」の節がありません", "表 | 廃止 | 置き換え先 | を置く（無ければ空の表）")
    else:
        for l in lines[rsec[0]:rsec[1]]:
            m3 = re.match(r"^\| (D(\d+)) \| (.+?) \|$", l)
            if not m3:
                continue
            n = int(m3.group(2))
            if n in retired:
                add("ERROR", prd.name, f"廃止した {m3.group(1)} が2回あります")
            retired[n] = m3.group(3)
            if n in live:
                add("ERROR", prd.name, f"廃止した {m3.group(1)} が {live[n]} で使われています", "廃止した番号は使い回さない。新しい番号を振る")
        # 置き換え先は今ある番号か、さらに廃止した番号（つないだ先で読む）
        for n, to in retired.items():
            bad = [t for t in expand(to) if t not in live and t not in retired]
            if bad:
                add("ERROR", prd.name, f"D{n} の置き換え先 {' '.join(f'D{t}' for t in bad)} がありません", "今ある D番号を書く")

    # 索引
    isec = section(lines, INDEX_HEAD)
    if not isec:
        add("ERROR", prd.name, f"「{INDEX_HEAD}」の節がありません", "check_prd.py --fix で作る（見出しだけ先に置く）")
    else:
        body = lines[isec[0]:isec[1]]
        cur: dict[str, str] = {}
        order: list[str] = []
        for l in body:
            m4 = re.match(r"^\| .+? \| \[(.+?)\]\((.+?)\) \| (.*) \|$", l)
            if m4:
                cur[m4.group(2)] = m4.group(3)
                order.append(m4.group(2))
        want = {rel: compress(ds) for rel, (_, ds) in by_file.items()}
        problems = [f"{rel} が索引にありません" for rel in want if rel not in cur]
        problems += [f"{rel} はファイルがありません" for rel in cur if rel not in want]
        problems += [f"{rel} の D番号が表と違います" for rel in want if rel in cur and cur[rel] != want[rel]]
        if problems:
            if fix:
                rels = [r for r in order if r in want] + [r for r in want if r not in order]
                table = ["| テーマ | ファイル | D番号 |", "|---|---|---|"]
                table += [f"| {by_file[r][0]} | [{r}]({r}) | {want[r]} |" for r in rels]
                # 表の前の文は残し、表だけ差し替える
                keep = [l for l in body if not l.startswith("|")]
                while keep and not keep[-1].strip():
                    keep.pop()
                new_body = (keep + [""] if any(k.strip() for k in keep) else [""]) + table + [""]
                lines = lines[:isec[0]] + new_body + lines[isec[1]:]
                prd.write_text("\n".join(lines), encoding="utf-8")
                fixed.append(f"{prd.name}：索引を作り直した（{' / '.join(problems)}）")
            else:
                for p in problems:
                    add("ERROR", f"{prd.name} の索引", p, "check_prd.py --fix で作り直す")

    nxt = max([*live, *retired], default=0) + 1
    add("INFO", "D番号", f"要件 {len(live)} 件・廃止 {len(retired)} 件。次に振る番号は D{nxt}")
    return {"summary": summarize(prd, issues, fixed), "issues": issues, "fixed": fixed}


def summarize(prd: Path, issues: list[dict], fixed: list[str]) -> dict:
    c = lambda lv: sum(1 for i in issues if i["level"] == lv)  # noqa: E731
    return {"file": str(prd), "errors": c("ERROR"), "warnings": c("WARN"), "infos": c("INFO"), "fixed": len(fixed)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("prd", help="docs/prd.md")
    ap.add_argument("--fix", action="store_true", help="索引を作り直し、表を D番号の昇順に並べる")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    p = Path(args.prd)
    if not p.is_file():
        print(f"エラー: ファイルがありません: {p}")
        return 1
    res = check(p, args.fix)
    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        s = res["summary"]
        print(f"# PRD チェック: {s['file']}")
        print(f"エラー {s['errors']} / 警告 {s['warnings']} / 情報 {s['infos']} ｜ 直した {s['fixed']}")
        for f in res.get("fixed", []):
            print(f"- [FIXED] {f}")
        order = {"ERROR": 0, "WARN": 1, "INFO": 2}
        for i in sorted(res["issues"], key=lambda x: order[x["level"]]):
            print(f"- [{i['level']}] {i['where']}: {i['message']}" + (f"\n    → {i['fix']}" if i["fix"] else ""))
    return 1 if res["summary"]["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
