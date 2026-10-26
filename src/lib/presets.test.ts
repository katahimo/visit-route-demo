import { describe, expect, it } from 'vitest';
import { MAX_PRESETS } from '../contracts/rules';
import { naivePlan, normalize, score, toHundred } from '../evaluate';
import { compile } from '../matching';
import { applyPreset, createDemoData, INITIAL_PRESETS, presetOf, scorePresetOf, scoreRulesOf } from '../seed';
import {
  addPresetError,
  addRule,
  draftPresetName,
  isInitialPreset,
  removePreset,
  renamePreset,
  saveDraftAsPreset,
  setScorePreset,
  withBasisRules,
} from './presets';

const base = () => createDemoData('2026-10-12');
const waitOf = (rules: { type: string; weight: number }[]) => rules.find((r) => r.type === 'wait')!.weight;

describe('新しい考え方として保存（ADR-0065。PRD D286）', () => {
  it('基準の保存済みの重みに下書きを重ねたプリセットを最後に足し、点数の基準にする。元のプリセットは変えない', () => {
    const d0 = base();
    const d = saveDraftAsPreset(d0, { wait: { weight: 1 } }, '  バランス（改） ');
    expect(d.presets).toHaveLength(4);
    expect(d.presets.slice(0, 3)).toEqual(d0.presets);
    const p = d.presets[3]!;
    expect(p.name).toBe('バランス（改）');
    expect(p.note).toBe('');
    expect(p.weights).toEqual({ ...d0.presets[0]!.weights, wait: { weight: 1, hard: false } });
    // 元のプリセットと中身を共有しない
    expect(p.weights.balance).not.toBe(d0.presets[0]!.weights.balance);
    expect(d.scorePresetId).toBe(p.id);
    // 条件（data.rules）も新しい基準にそろう
    expect(waitOf(d.rules)).toBe(1);
    expect(waitOf(scoreRulesOf(d))).toBe(1);
    expect(presetOf(d.rules, d.presets)?.id).not.toBe('balance');
  });

  it('基準でないプリセットが基準なら、その重みに重ねる', () => {
    const d0 = setScorePreset(base(), 'travel');
    const d = saveDraftAsPreset(d0, { compatibility: { weight: 4 } }, '移動を短く（改）');
    expect(d.presets.at(-1)!.weights).toEqual({
      ...INITIAL_PRESETS[1]!.weights,
      compatibility: { weight: 4, hard: false },
    });
  });

  it(`足せないとき（名前が空・長すぎる・重なる・${MAX_PRESETS}つある）はそのまま返す`, () => {
    const d0 = base();
    expect(saveDraftAsPreset(d0, { wait: { weight: 1 } }, ' ')).toBe(d0);
    expect(saveDraftAsPreset(d0, { wait: { weight: 1 } }, 'あ'.repeat(21))).toBe(d0);
    expect(saveDraftAsPreset(d0, { wait: { weight: 1 } }, 'バランス')).toBe(d0);
    let d = d0;
    for (let i = 0; i < MAX_PRESETS - 3; i++) d = saveDraftAsPreset(d, { wait: { weight: i } }, `案${i}`);
    expect(d.presets).toHaveLength(MAX_PRESETS);
    expect(saveDraftAsPreset(d, { wait: { weight: 1 } }, 'もう1つ')).toBe(d);
  });

  it('足せない理由の文', () => {
    const d = base();
    expect(addPresetError(d, ' ')).toBe('名前を入れてください');
    expect(addPresetError(d, 'あ'.repeat(21))).toBe('名前は20文字までです');
    expect(addPresetError(d, ' バランス ')).toBe('同じ名前のプリセットがあります');
    expect(addPresetError(d, '新しい')).toBeNull();
    const full = {
      ...d,
      presets: [...d.presets, ...d.presets.map((p) => ({ ...p, id: `${p.id}2`, name: `${p.name}2` }))],
    };
    expect(addPresetError(full, '新しい')).toContain(`${MAX_PRESETS}つまで`);
  });

  it('既定の名前は「〈元の名前〉（改）」、重なれば「（改2）」…', () => {
    expect(draftPresetName('バランス', [{ name: 'バランス' }])).toBe('バランス（改）');
    expect(draftPresetName('バランス', [{ name: 'バランス（改）' }])).toBe('バランス（改2）');
    expect(draftPresetName('バランス', [{ name: 'バランス（改）' }, { name: 'バランス（改2）' }])).toBe(
      'バランス（改3）',
    );
  });
});

describe('プリセットの節（ADR-0008・ADR-0065）', () => {
  it('名前・一言だけ変えられる（空の名前は変えない。重み・条件はそのまま）', () => {
    const d0 = base();
    const d = renamePreset(d0, 'balance', { name: ' ふだん ', note: 'メモ' });
    expect(d.presets[0]).toMatchObject({ name: 'ふだん', note: 'メモ' });
    expect(d.presets[0]!.weights).toEqual(d0.presets[0]!.weights);
    expect(d.rules).toBe(d0.rules);
    expect(renamePreset(d0, 'balance', { name: '  ' })).toBe(d0);
    expect(renamePreset(d0, 'balance', { note: 'x' }).presets[0]!.name).toBe('バランス');
  });

  it('初期の3つは消せない。足したものは消せる', () => {
    expect(INITIAL_PRESETS.every((p) => isInitialPreset(p.id))).toBe(true);
    const d0 = base();
    for (const p of INITIAL_PRESETS) expect(removePreset(d0, p.id)).toBe(d0);
    const d = saveDraftAsPreset(d0, { wait: { weight: 1 } }, '足した');
    const added = d.presets.at(-1)!;
    expect(isInitialPreset(added.id)).toBe(false);
    expect(removePreset(d, added.id).presets.map((p) => p.id)).toEqual(['balance', 'travel', 'people']);
  });

  it('最後の1つは消せない', () => {
    const d = { ...base(), presets: [{ ...INITIAL_PRESETS[0]!, id: 'only' }], scorePresetId: 'only' };
    expect(removePreset(d, 'only')).toBe(d);
  });

  it('既定の名前は上限に収める', () => {
    const long = 'あ'.repeat(20);
    expect(draftPresetName(long, [])).toBe(`${'あ'.repeat(17)}（改）`);
    expect(draftPresetName(long, [{ name: `${'あ'.repeat(17)}（改）` }])).toBe(`${'あ'.repeat(16)}（改2）`);
  });

  it('基準を消したとき、バランスが先頭でなくてもバランスへ移る', () => {
    const d0 = base();
    const d = { ...d0, presets: [...d0.presets.slice(1), d0.presets[0]!] };
    const a = saveDraftAsPreset(d, { wait: { weight: 1 } }, 'A');
    expect(removePreset(a, a.scorePresetId!).scorePresetId).toBe('balance');
  });

  it('基準のプリセットを消すと、基準は残りの先頭（バランス）に移り、条件の重みもそろう。ほかを消しても変わらない', () => {
    const d0 = base();
    const a = saveDraftAsPreset(d0, { wait: { weight: 1 } }, 'A');
    const b = saveDraftAsPreset(a, { wait: { weight: 2 } }, 'B');
    const aId = a.presets.at(-1)!.id;
    const bId = b.presets.at(-1)!.id;
    expect(b.scorePresetId).toBe(bId);
    expect(removePreset(b, aId).scorePresetId).toBe(bId);
    const removed = removePreset(b, bId);
    expect(removed.scorePresetId).toBe('balance');
    expect(removed.rules).toEqual(applyPreset(d0.rules, INITIAL_PRESETS[0]!));
  });
});

describe('点数の基準（ADR-0010）', () => {
  it('基準を選べる（無い id は変えない）', () => {
    const d = base();
    expect(setScorePreset(d, 'people').scorePresetId).toBe('people');
    expect(setScorePreset(d, 'nothing')).toBe(d);
  });

  it('点数の物差しは、プリセットのカードで条件の重みを変えても変わらない。基準を替えると変わる', () => {
    const d = base();
    const date = d.baseDate;
    const ruler = (x: typeof d) => {
      const p = compile({ ...x, rules: scoreRulesOf(x) }, date);
      const routes = naivePlan(p);
      return {
        scale: normalize(p),
        total: score(p, routes).total,
        hundred: toHundred(score(p, routes).total, normalize(p)),
      };
    };
    const before = ruler(d);
    for (const pr of INITIAL_PRESETS) {
      // プリセットのカード＝その日の条件をプリセットの重みにする
      expect(ruler({ ...d, rules: applyPreset(d.rules, pr) })).toEqual(before);
    }
    // 基準を「人の組み合わせ重視」にすると物差しが変わる
    expect(ruler({ ...d, scorePresetId: 'people' }).scale).not.toEqual(before.scale);
    // 基準と同じ重みの条件なら、いまの条件そのもの
    expect(scoreRulesOf(d)).toEqual(d.rules);
    expect(scorePresetOf(d.presets, 'nothing')?.id).toBe('balance');
    expect(scoreRulesOf({ rules: d.rules, presets: [] })).toBe(d.rules);
  });
});

describe('条件を足す（ADR-0035）', () => {
  const fallback = { weight: 3, hard: false };
  it('足す条件の重み・必須は点数の基準のプリセットのその型。必須にできない型は必須にしない・プリセットが無ければ fallback', () => {
    const d0 = base();
    const a = addRule(d0, { id: 'rx', type: 'wait', label: '待ち2' }, fallback);
    expect(a.rules.at(-1)).toMatchObject({ id: 'rx', weight: 3, hard: false });
    const travel = setScorePreset(d0, 'travel');
    expect(addRule(travel, { id: 'ry', type: 'continuity', label: '継続2' }, fallback).rules.at(-1)!.weight).toBe(0.5);
    expect(
      addRule({ ...d0, presets: [] }, { id: 'rw', type: 'wait', label: 'w' }, { weight: 2, hard: true }).rules.at(-1),
    ).toMatchObject({ weight: 2, hard: false });
  });

  it('基準を替えると条件の重みも新しい基準にそろう。そろっていれば同じものを返す', () => {
    const d0 = base();
    expect(setScorePreset(d0, 'travel').rules).toEqual(applyPreset(d0.rules, INITIAL_PRESETS[1]!));
    expect(withBasisRules(d0)).toBe(d0);
  });
});
