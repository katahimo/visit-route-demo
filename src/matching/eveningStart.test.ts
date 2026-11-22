// 帰りの前は自宅に近い人（条件 homeNear。PRD D455・D478。ADR-0116・ADR-0121）と、開始時刻をずらさない（機能 shiftStart を切る。PRD D456）
import { describe, expect, it } from 'vitest';
import type { Rule } from '../contracts/rules';
import { HOME_NEAR_MET_MINUTES, HOME_NEAR_PER_MINUTE } from '../contracts/rules';
import { INQUIRY_VISIT_ID } from '../contracts/vacancy';
import { achievements, score } from '../evaluate';
import { candidatesFor } from '../reassign';
import { solve } from '../solver';
import { compile } from './compile';
import { client, DATE, makeData, rule, staff, visit } from './fixtures.testkit';

/**
 * 自宅が近い s1 と遠い s2（勤務はどちらも 8:00〜19:00）。c1 の 17:30〜18:30 の訪問（勤務の終わりの60分前＝18:00 より後に終わる）と
 * 10:00 の訪問。over で条件・〈スタッフ〉を変える
 */
function homeDay(weight: number, over: { rule?: Partial<Rule>; s2End?: string; absences?: unknown[] } = {}) {
  return makeData({
    staff: [
      staff('s1', 38.26, 140.87, { shiftStart: '08:00', shiftEnd: '19:00' }),
      staff('s2', 38.3, 140.95, { shiftStart: '08:00', shiftEnd: over.s2End ?? '19:00' }),
    ],
    clients: [client('c1', 38.265, 140.875)],
    visits: [
      visit('late', 'c1', '17:30', '17:30', { windowKind: 'fixed' }),
      visit('am', 'c1', '10:00', '10:00', { windowKind: 'fixed' }),
    ],
    rules: [{ ...rule('hn', 'homeNear', weight), ...over.rule }],
    ...(over.absences && { absences: over.absences as never }),
  });
}

const idx = (p: ReturnType<typeof compile>, id: string) => p.visits.findIndex((v) => v.id === id);
const homeMin = (p: ReturnType<typeof compile>, j: number, s: number) =>
  p.travel[p.visits[j]!.point]![p.staff[s]!.point]!;

describe('帰りの前は自宅に近い人（homeNear）', () => {
  it('訪問の終わりが勤務の終わりの60分前（既定）より後の訪問だけ、訪問から自宅までの移動1分＝重み×0.2点を割当費用に足す', () => {
    const p = compile(homeDay(3), DATE);
    const late = idx(p, 'late');
    const am = idx(p, 'am');
    for (let s = 0; s < 2; s++) {
      const minutes = homeMin(p, late, s);
      expect(p.assignCost[late]![s]).toBeCloseTo(3 * HOME_NEAR_PER_MINUTE * minutes, 9);
      expect(p.reasons[late]![s]!.find((r) => r.ruleId === 'hn')?.label).toBe(
        `帰りの前：自宅まで${Math.round(minutes)}分`,
      );
      expect(p.assignCost[am]![s]).toBe(0);
      expect(p.reasons[am]![s]!.some((r) => r.ruleId === 'hn')).toBe(false);
    }
    // 自宅が遠い s2 のほうが重い
    expect(p.assignCost[late]![1]!).toBeGreaterThan(p.assignCost[late]![0]!);
  });
  it('N は条件の行の beforeEndMin（30分前なら 18:30 に終わる訪問は対象外。境目はちょうどを含まない）', () => {
    const p = compile(homeDay(3, { rule: { beforeEndMin: 30 } }), DATE);
    expect(p.assignCost[idx(p, 'late')]!.every((c) => c === 0)).toBe(true);
    const wide = compile(homeDay(3, { rule: { beforeEndMin: 600 } }), DATE);
    // 600分前（9:00）からなら朝の訪問も対象
    expect(wide.reasons[idx(wide, 'am')]![0]!.some((r) => r.ruleId === 'hn')).toBe(true);
  });
  it('勤務の終わりは人ごと（22:00 まで働く s2 には 18:30 に終わる訪問は帰りの前でない）', () => {
    const p = compile(homeDay(3, { s2End: '22:00' }), DATE);
    const late = idx(p, 'late');
    expect(p.reasons[late]![0]!.some((r) => r.ruleId === 'hn')).toBe(true);
    expect(p.reasons[late]![1]!.some((r) => r.ruleId === 'hn')).toBe(false);
  });
  it('勤務の終わりは欠勤を引いた稼働の終わり（19:00〜の欠勤なら 22:00 までの勤務でも 18:00 からが対象）', () => {
    const absences = [{ id: 'a1', staffId: 's2', date: DATE, from: '19:00', to: null, note: '' }];
    const p = compile(homeDay(3, { s2End: '22:00', absences }), DATE);
    expect(p.reasons[idx(p, 'late')]![1]!.some((r) => r.ruleId === 'hn')).toBe(true);
  });
  it('その日に勤務の無い人（終日の欠勤）は対象外（勤務の終わりが分からない）', () => {
    const absences = [{ id: 'a1', staffId: 's2', date: DATE, from: null, to: null, note: '' }];
    const p = compile(homeDay(3, { absences }), DATE);
    expect(p.reasons[idx(p, 'late')]![1]!.some((r) => r.ruleId === 'hn')).toBe(false);
  });
  it('達成：自宅までの移動が15分以内なら達成に数える（点は正でも、いつも0件にならない）', () => {
    const p = compile(homeDay(3), DATE);
    const late = idx(p, 'late');
    const am = idx(p, 'am');
    expect(homeMin(p, late, 0)).toBeGreaterThan(0);
    expect(homeMin(p, late, 0)).toBeLessThanOrEqual(HOME_NEAR_MET_MINUTES);
    expect(homeMin(p, late, 1)).toBeGreaterThan(HOME_NEAR_MET_MINUTES);
    const near = achievements(p, { s1: [p.visits[late]!.id, p.visits[am]!.id], s2: [] }).find((a) => a.ruleId === 'hn');
    expect(near).toMatchObject({ total: 1, met: 1 });
    const far = achievements(p, { s1: [p.visits[am]!.id], s2: [p.visits[late]!.id] }).find((a) => a.ruleId === 'hn');
    expect(far).toMatchObject({ total: 1, met: 0 });
  });
  it('重み0なら効かない（今までと同じ問題）', () => {
    const p = compile(homeDay(0), DATE);
    expect(p.assignCost.flat().every((c) => c === 0)).toBe(true);
  });
  it('割当費用なので solver と evaluate の合計点は一致し、同じ種なら同じ結果', () => {
    const p = compile(homeDay(5), DATE);
    const r = solve(p, { seed: 1, iterations: 2000 });
    expect(score(p, r.routes).total).toBeCloseTo(r.score, 6);
    expect(solve(p, { seed: 1, iterations: 2000 }).routes).toEqual(r.routes);
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
