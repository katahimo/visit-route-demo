// 相性の記号（PRD D113・D177）
import { describe, expect, it } from 'vitest';
import type { Compat } from '../contracts/rules';
import {
  COMPAT_CHOICES,
  COMPAT_LEGEND,
  COMPAT_MEANING,
  COMPAT_WORD,
  clearUsualWhereNg,
  compatLevelClass,
  compatLevelOf,
  countUsualWhereNg,
  setCompatLevel,
} from './compatLevel';

describe('COMPAT_CHOICES', () => {
  it('選ぶ欄は ◎→○→未入力→△→× の5段（どれにも意味の文がある）', () => {
    expect(COMPAT_CHOICES).toEqual([2, 1, 0, -1, -2]);
    expect(COMPAT_CHOICES.every((l) => COMPAT_MEANING[l].endsWith(COMPAT_WORD[l]))).toBe(true);
    expect(COMPAT_MEANING[-2]).toBe('× 担当にしない');
  });
});

describe('compatLevelOf', () => {
  it('行が無い・その人が無ければ 0', () => {
    expect(compatLevelOf(undefined, 's1')).toBe(0);
    expect(compatLevelOf({ s2: 2 }, 's1')).toBe(0);
    expect(compatLevelOf({ s1: -2 }, 's1')).toBe(-2);
  });

  it('継いだ名前（toString など）は相性にしない', () => {
    expect(compatLevelOf({}, 'toString')).toBe(0);
  });
});

describe('compatLevelClass', () => {
  it('負の相性は m を付ける（凡例の色と同じ）', () => {
    expect(compatLevelClass(2)).toBe('lv2');
    expect(compatLevelClass(0)).toBe('lv0');
    expect(compatLevelClass(-1)).toBe('lvm1');
    expect(COMPAT_LEGEND.map((l) => l.cls)).toEqual([compatLevelClass(2), compatLevelClass(1), 'lvm1', 'lvm2']);
  });

  it('意味の文は記号ごとにある', () => {
    expect(COMPAT_MEANING[0]).toBe('未入力（ふつう）');
  });
});

describe('setCompatLevel', () => {
  it('選んだ相性にする（ほかの行・人はそのまま、元は変えない）', () => {
    const compat = { c1: { s1: 2 as const, s2: -1 as const }, c2: { s1: 1 as const } };
    const next = setCompatLevel(compat, 'c1', 's1', -2);
    expect(next).toEqual({ c1: { s1: -2, s2: -1 }, c2: { s1: 1 } });
    expect(compat.c1.s1).toBe(2);
  });

  it('未入力なら消し、行が無ければ作る', () => {
    expect(setCompatLevel({ c1: { s1: 1 } }, 'c1', 's1', 0)).toEqual({ c1: {} });
    expect(setCompatLevel({}, 'c1', 's1', 1)).toEqual({ c1: { s1: 1 } });
  });
});

describe('clearUsualWhereNg', () => {
  const compat: Compat = { c1: { s1: -2, s2: 1 }, c2: { s1: -1 } };
  const pats = [
    { id: 'p1', clientId: 'c1', usualStaffId: 's1', to: null },
    { id: 'p2', clientId: 'c1', usualStaffId: 's2', to: null },
    { id: 'p3', clientId: 'c1', usualStaffId: 's1', to: '2026-01-01' },
    { id: 'p4', clientId: 'c2', usualStaffId: 's1', to: null },
    { id: 'p5', clientId: 'c1', usualStaffId: null, to: null },
  ];

  it('× の人がいつもの担当の、続いている繰り返しだけ担当なしにする', () => {
    const out = clearUsualWhereNg(pats, compat, '2026-11-20');
    expect(out.map((p) => p.usualStaffId)).toEqual([null, 's2', 's1', 's1', null]);
    expect(countUsualWhereNg(pats, compat, '2026-11-20')).toBe(1);
  });

  it('終わっていない（to が today 以降）は外し、元の配列は変えない', () => {
    const out = clearUsualWhereNg([{ ...pats[2], to: '2026-11-20' }], compat, '2026-11-20');
    expect(out[0].usualStaffId).toBeNull();
    expect(pats[2].usualStaffId).toBe('s1');
  });

  it('scope の〈利用者さん〉・〈スタッフ〉に絞る', () => {
    expect(clearUsualWhereNg(pats, compat, '2026-11-20', { clientId: 'c2' })).toBe(pats);
    expect(clearUsualWhereNg(pats, compat, '2026-11-20', { staffId: 's2' })).toBe(pats);
    expect(countUsualWhereNg(pats, compat, '2026-11-20', { clientId: 'c1', staffId: 's1' })).toBe(1);
  });

  it('外すものが無ければ同じ配列を返す', () => {
    expect(clearUsualWhereNg(pats, {}, '2026-11-20')).toBe(pats);
  });
});
