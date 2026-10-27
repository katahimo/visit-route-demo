import { describe, expect, it } from 'vitest';
import { MAX_PRESETS } from '../contracts/rules';
import { naivePlan, normalize, score, toHundred } from '../evaluate';
import { compile } from '../matching';
import { applyPreset, createDemoData, INITIAL_PRESETS, presetOf, scorePresetOf, scoreRulesOf } from '../seed';
import {
  addPresetError,
  addPresetFromBasis,
  addRule,
  patchPreset,
  removePreset,
  resetPresets,
  setBasisWeight,
  setScorePreset,
  withBasisRules,
} from './presets';

const base = () => createDemoData('2026-10-12');

describe('プリセットの編集（ADR-0008）', () => {
  it('基準の重みを写して保存すると、その条件がそのプリセットに一致する', () => {
    const d0 = setBasisWeight(base(), 'wait', { weight: 0.5 });
    const d = addPresetFromBasis(d0, '  待ち軽め ');
    expect(d.presets).toHaveLength(4);
    const p = d.presets[3]!;
    expect(p.name).toBe('待ち軽め');
    expect(p.weights.wait).toEqual({ weight: 0.5, hard: false });
    expect(p.weights).toEqual(d0.presets[0]!.weights);
    expect(presetOf(d.rules, [p])?.id).toBe(p.id);
    // 基準のプリセットが無ければ（ありえない）条件の重みから。その型の条件が無ければ重み0
    const none = addPresetFromBasis({ ...d0, presets: [], rules: [] }, '空');
    expect(none.presets[0]!.weights.compatibility).toEqual({ weight: 0, hard: false });
  });

  it(`足せるのは ${MAX_PRESETS}つまで。名前が空・長すぎるのも足さない`, () => {
    let d = base();
    for (let i = 0; i < 5; i++) d = addPresetFromBasis(d, `案${i}`);
    expect(d.presets).toHaveLength(MAX_PRESETS);
    expect(addPresetError(d, 'もう1つ')).toContain('6つまで');
    expect(addPresetFromBasis(d, 'もう1つ')).toBe(d);
    expect(addPresetError(base(), ' ')).not.toBeNull();
    expect(addPresetError(base(), 'あ'.repeat(21))).not.toBeNull();
  });

  it('消せる。最後の1つは消せない', () => {
    let d = base();
    d = removePreset(d, 'travel');
    expect(d.presets.map((p) => p.id)).toEqual(['balance', 'people']);
    d = removePreset(removePreset(d, 'balance'), 'people');
    expect(d.presets.map((p) => p.id)).toEqual(['people']);
  });

  it('名前・重みを変え、初期値に戻すと初期の3つ', () => {
    const d0 = base();
    const d = patchPreset(addPresetFromBasis(d0, 'x'), 'balance', { name: '変えた' });
    expect(d.presets[0]!.name).toBe('変えた');
    const r = resetPresets(d);
    expect(r.presets).toEqual(INITIAL_PRESETS);
  });
});

describe('点数の基準（ADR-0010）', () => {
  it('基準のプリセットを消すと、基準は残りの先頭に移る。ほかを消しても変わらない', () => {
    const d = { ...base(), scorePresetId: 'travel' };
    expect(removePreset(d, 'people').scorePresetId).toBe('travel');
    expect(removePreset(d, 'travel').scorePresetId).toBe('balance');
    expect(removePreset({ ...d, scorePresetId: 'balance' }, 'balance').scorePresetId).toBe('travel');
  });

  it('基準を選べる（無い id は変えない）。初期値に戻すと「バランス」', () => {
    const d = base();
    expect(setScorePreset(d, 'people').scorePresetId).toBe('people');
    expect(setScorePreset(d, 'nothing')).toBe(d);
    expect(resetPresets({ ...d, scorePresetId: 'people' }).scorePresetId).toBe('balance');
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

describe('条件の重みの画面＝点数の基準の重みを直す画面（ADR-0035。PRD D233〜D235）', () => {
  const waitOf = (rules: { type: string; weight: number }[]) => rules.find((r) => r.type === 'wait')!.weight;

  it('型の重みを直すと、基準のプリセットと条件（data.rules）の両方が変わる。基準でないプリセットは変えない', () => {
    const d0 = base();
    const d = setBasisWeight(d0, 'wait', { weight: 1 });
    expect(d.presets.find((p) => p.id === 'balance')!.weights.wait).toEqual({ weight: 1, hard: false });
    expect(d.presets.find((p) => p.id === 'travel')).toEqual(d0.presets.find((p) => p.id === 'travel'));
    expect(waitOf(d.rules)).toBe(1);
    // 同じ型の条件はどれも同じ重み。名前・ID・並びはそのまま
    expect(d.rules.map((r) => [r.id, r.label])).toEqual(d0.rules.map((r) => [r.id, r.label]));
    // 必須も同じく基準のプリセットへ
    const h = setBasisWeight(d0, 'clientPreference', { hard: true });
    expect(h.presets[0]!.weights.clientPreference.hard).toBe(true);
    expect(h.rules.find((r) => r.type === 'clientPreference')!.hard).toBe(true);
  });

  it('直した重みが、AI で組むときの重み（scoreRulesOf）に効く', () => {
    const d = setBasisWeight(base(), 'wait', { weight: 1 });
    expect(waitOf(scoreRulesOf(d))).toBe(1);
  });

  it('基準を直すと、基準とずれた条件の重みも基準にそろう。基準でないプリセット・名前だけなら条件は変えない', () => {
    const d0 = base();
    const off = { ...d0, rules: d0.rules.map((r) => (r.type === 'wait' ? { ...r, weight: 4.5 } : r)) };
    expect(presetOf(off.rules, off.presets)).toBeNull();
    const d = setBasisWeight(off, 'balance', { weight: 1 });
    expect(waitOf(d.rules)).toBe(3);
    expect(presetOf(d.rules, d.presets)?.id).toBe('balance');
    expect(patchPreset(off, 'travel', { weights: { ...off.presets[1]!.weights } }).rules).toBe(off.rules);
    expect(patchPreset(off, 'balance', { name: '標準2' }).rules).toBe(off.rules);
  });

  it('基準を替える・基準を消す・初期値に戻すと、条件の重みも新しい基準にそろう', () => {
    const d0 = base();
    const switched = setScorePreset(d0, 'travel');
    expect(switched.rules).toEqual(applyPreset(d0.rules, INITIAL_PRESETS[1]!));
    const removed = removePreset(switched, 'travel');
    expect(removed.scorePresetId).toBe('balance');
    expect(removed.rules).toEqual(applyPreset(d0.rules, INITIAL_PRESETS[0]!));
    // 基準でないプリセットを消しても条件は変えない
    const off = { ...d0, rules: d0.rules.map((r) => (r.type === 'wait' ? { ...r, weight: 4.5 } : r)) };
    expect(removePreset(off, 'people').rules).toBe(off.rules);
    expect(resetPresets(off).rules).toEqual(d0.rules);
    // そろっていれば同じものを返す
    expect(withBasisRules(d0)).toBe(d0);
  });

  it('「基準の重みを写して保存」は深く写す（写したあとに基準を直しても写しは変わらない）', () => {
    const d = addPresetFromBasis(base(), '写し');
    const copy = d.presets.at(-1)!;
    expect(copy.weights).toEqual(d.presets[0]!.weights);
    expect(copy.weights.wait).not.toBe(d.presets[0]!.weights.wait);
    const edited = setBasisWeight(d, 'wait', { weight: 0.5 });
    expect(edited.presets.at(-1)!.weights.wait.weight).toBe(3);
  });
});

describe('条件を足す（ADR-0035）', () => {
  const fallback = { weight: 3, hard: false };
  it('足す条件の重み・必須は、点数の基準のプリセットのその型。押した時点のデータで決める', () => {
    const d0 = base();
    const a = addRule(d0, { id: 'rx', type: 'wait', label: '待ち2' }, fallback);
    expect(a.rules.at(-1)).toMatchObject({ id: 'rx', weight: 3, hard: false });
    expect(presetOf(a.rules, a.presets)?.id).toBe('balance');
    // 基準＝移動を短く：そのプリセットの重みで足し、基準のまま
    const travel = setScorePreset(d0, 'travel');
    const b = addRule(travel, { id: 'ry', type: 'continuity', label: '継続2' }, fallback);
    expect(b.rules.at(-1)!.weight).toBe(0.5);
    expect(presetOf(b.rules, b.presets)?.id).toBe('travel');
    // 必須にできない型は必須にしない・プリセットが無ければ fallback
    expect(
      addRule({ ...d0, presets: [] }, { id: 'rw', type: 'wait', label: 'w' }, { weight: 2, hard: true }).rules.at(-1),
    ).toMatchObject({ weight: 2, hard: false });
  });
});
