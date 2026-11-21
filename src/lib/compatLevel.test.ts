// 相性の記号（PRD D113・D177）
import { describe, expect, it } from 'vitest';
import type { Compat } from '../contracts/rules';
import { visitsIn } from '../patterns';
import { createDemoData } from '../seed';
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
  const T = '2026-11-21';
  const compat: Compat = { c1: { s1: -2, s2: 1 }, c2: { s1: -1 } };
  const base = createDemoData(T);
  const pat = (id: string, clientId: string, usualStaffId: string | null, from: string, to: string | null) => ({
    ...base.patterns[0],
    id,
    clientId,
    usualStaffId,
    from,
    to,
  });
  const pats = [
    pat('p1', 'c1', 's1', T, null),
    pat('p2', 'c1', 's2', T, null),
    pat('p3', 'c1', 's1', '2025-01-01', '2026-01-01'),
    pat('p4', 'c2', 's1', T, null),
    pat('p5', 'c1', null, T, null),
  ];
  const data = { patterns: pats, visits: [], clients: base.clients };
  let n = 0;
  const nid = () => `new${++n}`;

  it('× の人がいつもの担当の、today 以降に始まる続いている繰り返しはその場で担当なしにする', () => {
    const out = clearUsualWhereNg(data, compat, T, {}, nid);
    expect(out.patterns.map((p) => p.usualStaffId)).toEqual([null, 's2', 's1', 's1', null]);
    expect(countUsualWhereNg(pats, compat, T)).toBe(1);
    expect(pats[0].usualStaffId).toBe('s1');
  });

  it('始まりが today より前なら today で分け、過去の回の担当は残す（デモの 10/01 開始・担当 s3 の繰り返し）', () => {
    const d = createDemoData(T);
    const target = d.patterns.find((p) => p.clientId === 'c13' && p.usualStaffId === 's3');
    expect(target?.from).toBe('2026-10-01');
    if (!target) return;
    const ng: Compat = { ...d.compat, c13: { ...d.compat.c13, s3: -2 } };
    const before = visitsIn(d, { from: '2026-10-01', to: '2026-10-31' }).filter((v) => v.clientId === 'c13');
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((v) => v.staffId === 's3')).toBe(true);
    expect(countUsualWhereNg(d.patterns, ng, T, { clientId: 'c13', staffId: 's3' })).toBe(1);
    const out = clearUsualWhereNg(d, ng, T, { clientId: 'c13', staffId: 's3' }, () => 'pt-new');
    const after = { ...d, ...out };
    // 過去の回は s3 のまま
    const past = visitsIn(after, { from: '2026-10-01', to: '2026-10-31' }).filter((v) => v.clientId === 'c13');
    expect(past.map((v) => v.staffId)).toEqual(before.map((v) => v.staffId));
    // 元の繰り返しは昨日で終わり、today からは担当なしの新しい繰り返し
    expect(out.patterns.find((p) => p.id === target.id)?.to).toBe('2026-11-20');
    expect(out.patterns.find((p) => p.id === 'pt-new')).toMatchObject({ from: T, usualStaffId: null, clientId: 'c13' });
  });

  it('scope の〈利用者さん〉・〈スタッフ〉に絞る', () => {
    expect(clearUsualWhereNg(data, compat, T, { clientId: 'c2' }, nid).patterns).toBe(pats);
    expect(clearUsualWhereNg(data, compat, T, { staffId: 's2' }, nid).patterns).toBe(pats);
    expect(countUsualWhereNg(pats, compat, T, { clientId: 'c1', staffId: 's1' })).toBe(1);
  });

  it('外すものが無ければ同じデータを返す', () => {
    const out = clearUsualWhereNg(data, {}, T, {}, nid);
    expect(out.patterns).toBe(pats);
    expect(out.visits).toBe(data.visits);
  });
});
