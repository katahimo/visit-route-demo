// 相性の記号（PRD D113・D177）
import { describe, expect, it } from 'vitest';
import {
  COMPAT_LEGEND,
  COMPAT_MEANING,
  compatLevelClass,
  compatLevelOf,
  cycleCompat,
  nextCompatLevel,
} from './compatLevel';

describe('nextCompatLevel', () => {
  it('◎→○→空→△→×→◎ と回る', () => {
    expect([2, 1, 0, -1, -2].map((l) => nextCompatLevel(l as 2 | 1 | 0 | -1 | -2))).toEqual([1, 0, -1, -2, 2]);
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

describe('cycleCompat', () => {
  it('次の相性にする（ほかの行・人はそのまま、元は変えない）', () => {
    const compat = { c1: { s1: 2 as const, s2: -1 as const }, c2: { s1: 1 as const } };
    const next = cycleCompat(compat, 'c1', 's1');
    expect(next).toEqual({ c1: { s1: 1, s2: -1 }, c2: { s1: 1 } });
    expect(compat.c1.s1).toBe(2);
  });

  it('未入力に戻ったら消し、行が無ければ作る', () => {
    expect(cycleCompat({ c1: { s1: 1 } }, 'c1', 's1')).toEqual({ c1: {} });
    expect(cycleCompat({}, 'c1', 's1')).toEqual({ c1: { s1: -1 } });
  });
});
