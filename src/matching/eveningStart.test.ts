// 夕方は自宅に近い人（条件 homeNear。PRD D455）と、開始時刻をずらさない（機能 shiftStart を切る。PRD D456）。ADR-0116
import { describe, expect, it } from 'vitest';
import { HOME_NEAR_PER_MINUTE } from '../contracts/rules';
import { INQUIRY_VISIT_ID } from '../contracts/vacancy';
import { score } from '../evaluate';
import { candidatesFor } from '../reassign';
import { solve } from '../solver';
import { compile } from './compile';
import { client, DATE, makeData, rule, staff, visit } from './fixtures.testkit';

/** 自宅が近い s1 と遠い s2。c1 の 17:30 の訪問（夕方）と 10:00 の訪問 */
function evening(weight: number) {
  return makeData({
    staff: [
      staff('s1', 38.26, 140.87, { shiftStart: '08:00', shiftEnd: '20:00' }),
      staff('s2', 38.3, 140.95, { shiftStart: '08:00', shiftEnd: '20:00' }),
    ],
    clients: [client('c1', 38.265, 140.875)],
    visits: [
      visit('late', 'c1', '17:30', '17:30', { windowKind: 'fixed' }),
      visit('am', 'c1', '10:00', '10:00', { windowKind: 'fixed' }),
    ],
    rules: [rule('hn', 'homeNear', weight)],
  });
}

describe('夕方は自宅に近い人（homeNear）', () => {
  it('開始（早）が17:00以降の訪問だけ、訪問から自宅までの移動1分＝重み×0.2点を割当費用に足す', () => {
    const p = compile(evening(3), DATE);
    const late = p.visits.findIndex((v) => v.id === 'late');
    const am = p.visits.findIndex((v) => v.id === 'am');
    for (let s = 0; s < 2; s++) {
      const home = p.staff[s]!.point;
      const minutes = p.travel[p.visits[late]!.point]![home]!;
      expect(p.assignCost[late]![s]).toBeCloseTo(3 * HOME_NEAR_PER_MINUTE * minutes, 9);
      expect(p.reasons[late]![s]!.find((r) => r.ruleId === 'hn')?.label).toBe(`夕方：自宅まで${Math.round(minutes)}分`);
      expect(p.assignCost[am]![s]).toBe(0);
      expect(p.reasons[am]![s]!.some((r) => r.ruleId === 'hn')).toBe(false);
    }
    // 自宅が遠い s2 のほうが重い
    expect(p.assignCost[late]![1]!).toBeGreaterThan(p.assignCost[late]![0]!);
  });
  it('重み0なら効かない（今までと同じ問題）', () => {
    const p = compile(evening(0), DATE);
    expect(p.assignCost.flat().every((c) => c === 0)).toBe(true);
  });
  it('割当費用なので solver と evaluate の合計点は一致する', () => {
    const p = compile(evening(5), DATE);
    const r = solve(p, { seed: 1, iterations: 2000 });
    expect(score(p, r.routes).total).toBeCloseTo(r.score, 6);
  });
});

/** 9:00 に終わる訪問のあと、移動 約20分の先の 9:00〜9:30 の幅のある訪問 */
function windowDay(features: Record<string, boolean>) {
  return makeData({
    org: { ...makeData().org, features },
    staff: [staff('s1', 38.26, 140.87, { shiftStart: '08:00', shiftEnd: '18:00' })],
    clients: [client('c1', 38.26, 140.87), client('c2', 38.32, 140.87)],
    visits: [
      visit('first', 'c1', '08:00', '08:00', { windowKind: 'fixed' }),
      visit('w', 'c2', '09:00', '09:30', { windowKind: 'window' }),
    ],
  });
}

describe('開始時刻をずらさない（機能 shiftStart を切る）', () => {
  it('入（既定）では時間に幅のある訪問を幅の中で遅らせて入れる', () => {
    const p = compile(windowDay({}), DATE);
    expect(p.fixedStart).toBeUndefined();
    expect(p.visits.find((v) => v.id === 'w')!.latest).toBe(9 * 60 + 30);
    const r = solve(p, { seed: 1, iterations: 2000 });
    expect(r.unassigned).toEqual([]);
  });
  it('切ると latest＝earliest（開始（早）だけ）にし、間に合わない訪問は担当なしに残す', () => {
    const p = compile(windowDay({ shiftStart: false }), DATE);
    expect(p.fixedStart).toBe(true);
    expect(p.visits.find((v) => v.id === 'w')!.latest).toBe(9 * 60);
    const r = solve(p, { seed: 1, iterations: 2000 });
    expect(r.unassigned).toEqual(['w']);
  });
  it('切ると欠勤の振り直しの候補に「N分遅らせれば入る」を出さない（入では出す）', () => {
    const routes = { s1: ['first'] };
    const on = compile(windowDay({}), DATE);
    const onFixed = { ...on, visits: on.visits.map((v) => (v.id === 'w' ? { ...v, latest: v.earliest } : v)) };
    expect(candidatesFor(onFixed, routes, 'w')[0]!.shiftMinutes).toBeGreaterThan(0);
    const off = compile(windowDay({ shiftStart: false }), DATE);
    const c = candidatesFor(off, routes, 'w')[0]!;
    expect(c.fits).toBe(false);
    expect(c.shiftMinutes).toBeNull();
  });
  it('空き状況の仮の訪問（時刻を探す）は切っても幅のまま', () => {
    const d = windowDay({ shiftStart: false });
    d.visits.push(visit(INQUIRY_VISIT_ID, 'c1', '13:00', '15:00'));
    const p = compile(d, DATE);
    expect(p.visits.find((v) => v.id === INQUIRY_VISIT_ID)!.latest).toBe(15 * 60);
  });
});
