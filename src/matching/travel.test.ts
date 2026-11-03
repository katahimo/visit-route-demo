// 移動時間（片道・分）を手で決めた〈利用者さん〉と遠方（出張）の訪問（PRD D429。ADR-0096）：問題の移動の行列・列の可否・理由
import { describe, expect, it } from 'vitest';
import { explain, score } from '../evaluate';
import { solve } from '../solver';
import { client, makeData, staff, visit } from './fixtures.testkit';
import {
  compile,
  FAR_TRIP_LABEL,
  FAR_TRIP_RULE_ID,
  routeCost,
  scheduleRoute,
  soloBroken,
  TRAVEL_TOO_FAR_RULE_ID,
} from './index';
import { travelTooFarLabel, UNPLACED_TRAVEL_MIN } from './travel';

const DATE = '2026-10-12';
/** 仙台・東京・仙台の近く */
const SENDAI = { lat: 38.26, lng: 140.87 };
const TOKYO = { lat: 35.68, lng: 139.76 };
const NEAR = { lat: 38.27, lng: 140.88 };

const tokyo = (over: { travelMinutes?: number; farTrip?: boolean } = {}) =>
  client('far', TOKYO.lat, TOKYO.lng, { place: { address: '', ...TOKYO, postalCode: '', ...over } });

describe('移動時間（片道・分。ADR-0096）', () => {
  it('入っていれば、どこから来ても・どこへ行ってもその分数（距離は 0 m）。無ければ距離から見積もる', () => {
    const d = makeData({
      staff: [staff('s1', SENDAI.lat, SENDAI.lng)],
      clients: [tokyo({ travelMinutes: 150 }), client('near', NEAR.lat, NEAR.lng)],
      visits: [visit('v1', 'far', '13:00', '13:00'), visit('v2', 'near', '09:00', '09:00')],
    });
    const p = compile(d, DATE);
    const far = p.visits.find((v) => v.id === 'v1')!.point;
    const near = p.visits.find((v) => v.id === 'v2')!.point;
    expect(p.travel[0]![far]).toBe(150);
    expect(p.travel[far]![0]).toBe(150);
    expect(p.travel[near]![far]).toBe(150);
    expect(p.travel[far]![near]).toBe(150);
    expect(p.meters[0]![far]).toBe(0);
    expect(p.meters[far]![near]).toBe(0);
    // 決めていない訪問先どうしは今までどおり距離から
    expect(p.meters[0]![near]).toBeGreaterThan(0);
  });

  it('位置が未登録でも移動時間があれば「位置が未登録」の点を足さず、その分数とみる', () => {
    const d = makeData({
      staff: [staff('s1', SENDAI.lat, SENDAI.lng)],
      clients: [client('a', 0, 0, { place: { address: '', lat: null, lng: null, postalCode: '', travelMinutes: 90 } })],
      visits: [visit('v1', 'a', '12:00', '12:00')],
    });
    const p = compile(d, DATE);
    expect(p.travel[0]![1]).toBe(90);
    expect(p.travel[0]![1]).not.toBe(UNPLACED_TRAVEL_MIN);
    expect(p.reasons[0]![0]!.some((r) => r.ruleId === 'noPlace')).toBe(false);
  });

  it('2つの〈利用者さん〉の両方に入っていれば、長いほう', () => {
    const d = makeData({
      staff: [staff('s1', SENDAI.lat, SENDAI.lng)],
      clients: [
        tokyo({ travelMinutes: 150 }),
        client('b', NEAR.lat, NEAR.lng, { place: { address: '', ...NEAR, postalCode: '', travelMinutes: 40 } }),
      ],
      visits: [visit('v1', 'far', '13:00', '13:00'), visit('v2', 'b', '09:00', '09:00')],
    });
    const p = compile(d, DATE);
    expect(p.travel[1]![2]).toBe(150);
    expect(p.travel[2]![1]).toBe(150);
  });

  it('遠方の印が無ければ、家を出るのは勤務の開始から（勤務 8:00・片道150分・10:00 ちょうどは間に合わない）', () => {
    const d = makeData({
      staff: [staff('s1', SENDAI.lat, SENDAI.lng)],
      clients: [tokyo({ travelMinutes: 150 })],
      visits: [visit('v1', 'far', '10:00', '10:00', { windowKind: 'fixed' })],
    });
    const p = compile(d, DATE);
    expect(p.visits[0]!.solo).toBeUndefined();
    expect(scheduleRoute(p, 0, [0], 'strict')).toBeNull();
    // 担当なしの理由：移動が間に合わない（片道 約150分）
    const e = explain(p, { s1: [] })[0]!;
    expect(e.reasons[0]).toMatchObject({ ruleId: TRAVEL_TOO_FAR_RULE_ID, label: `s1：${travelTooFarLabel(150)}` });
  });

  it('距離から見積もって十数時間の移動も、担当なしの理由に「移動が間に合わない（片道 約N分）」と出る', () => {
    const d = makeData({
      staff: [staff('s1', SENDAI.lat, SENDAI.lng)],
      clients: [tokyo()],
      visits: [visit('v1', 'far', '10:00', '11:00')],
    });
    const p = compile(d, DATE);
    expect(p.allowed[0]![0]).toBe(true);
    expect(p.infeasible).toEqual([]);
    const r = solve(p, { seed: 1, iterations: 2000 });
    expect(r.unassigned).toEqual(['v1']);
    const e = explain(p, r.routes)[0]!;
    expect(e.reasons[0]!.ruleId).toBe(TRAVEL_TOO_FAR_RULE_ID);
    expect(e.reasons[0]!.label).toMatch(/^s1：移動が間に合わない（片道 約\d+分）$/);
  });
});

describe('遠方（出張。ADR-0096）', () => {
  const data = (nStaff: number) =>
    makeData({
      staff: Array.from({ length: nStaff }, (_, i) => staff(`s${i + 1}`, SENDAI.lat, SENDAI.lng)),
      clients: [tokyo({ travelMinutes: 150, farTrip: true }), client('near', NEAR.lat, NEAR.lng)],
      visits: [visit('v1', 'far', '10:00', '10:00', { windowKind: 'fixed' }), visit('v2', 'near', '15:00', '16:00')],
    });

  it('家を出る時刻を勤務の開始に縛らない（勤務 8:00・片道150分でも 10:00 に始められる）', () => {
    const p = compile(data(1), DATE);
    expect(p.visits[0]!.solo).toBe(true);
    const t = scheduleRoute(p, 0, [0], 'strict')!;
    expect(t.stops[0]!.start).toBe(600);
    expect(t.stops[0]!.travelIn).toBe(150);
  });

  it('ほかの〈利用者さん〉の訪問と同じ列は strict で不可（routeCost は Infinity）。同じ〈利用者さん〉の2回はよい', () => {
    const p = compile(data(1), DATE);
    expect(soloBroken(p, [0, 1])).toBe(true);
    expect(routeCost(p, 0, [0, 1])).toBe(Number.POSITIVE_INFINITY);
    expect(routeCost(p, 0, [1, 0])).toBe(Number.POSITIVE_INFINITY);
    expect(scheduleRoute(p, 0, [0, 1], 'strict')).toBeNull();
    expect(scheduleRoute(p, 0, [0, 1], 'lenient')).not.toBeNull();
    const two = makeData({
      ...data(1),
      visits: [
        visit('v1', 'far', '10:00', '10:00', { windowKind: 'fixed' }),
        visit('v3', 'far', '14:00', '14:00', { windowKind: 'fixed' }),
      ],
    });
    const q = compile(two, DATE);
    expect(soloBroken(q, [0, 1])).toBe(false);
    expect(scheduleRoute(q, 0, [0, 1], 'strict')).not.toBeNull();
  });

  it('AI の提案は遠方の日にほかの訪問をつながない（1人なら片方だけ、2人なら1件ずつ）', () => {
    const one = solve(compile(data(1), DATE), { seed: 1, iterations: 3000 });
    expect(one.routes.s1!.length).toBe(1);
    expect(one.unassigned.length).toBe(1);
    const two = solve(compile(data(2), DATE), { seed: 1, iterations: 3000 });
    expect(two.unassigned).toEqual([]);
    expect(Object.values(two.routes).map((r) => r.length)).toEqual([1, 1]);
  });

  it('手で同じ列に入れると、遠方の訪問を必須の違反にする。入らない訪問の理由は「遠方（出張）の日はほかの訪問を入れません」', () => {
    const p = compile(data(1), DATE);
    const sc = score(p, { s1: ['v1', 'v2'] });
    expect(sc.hardViolations).toContainEqual({
      visitId: 'v1',
      staffId: 's1',
      kind: 'notAllowed',
      label: FAR_TRIP_LABEL,
    });
    const e = explain(p, { s1: ['v1'] }).find((x) => x.visitId === 'v2')!;
    expect(e.reasons[0]).toMatchObject({ ruleId: FAR_TRIP_RULE_ID, label: `s1：${FAR_TRIP_LABEL}` });
  });
});
