// 続く訪問（条件 sameClient。ADR-0116。PRD D453）：組の作り方・点・solver と evaluate の一致
import { describe, expect, it } from 'vitest';
import type { Problem } from '../contracts/problem';
import { achievements, score } from '../evaluate';
import { solve } from '../solver';
import { chainOf, chainRoutePoints, chainScore } from './chain';
import { compile } from './compile';
import { dropPointsOf } from './cost';
import { client, DATE, makeData, randomData, rule, staff, visit } from './fixtures.testkit';
import { routeCost } from './timing';

const pv = (id: string, clientId: string, earliest: number, duration = 60) => ({
  id,
  clientId,
  point: 0,
  earliest,
  latest: earliest,
  duration,
});

describe('chainOf（続く訪問の組）', () => {
  it('同じ〈利用者さん〉で、終わりから次の開始まで 0〜30分の訪問を組にする。重なる・遠い・別の〈利用者さん〉は組にしない', () => {
    const visits = [
      pv('a1', 'a', 540), // 9:00〜10:00
      pv('a2', 'a', 600), // 10:00〜（間0分）
      pv('a3', 'a', 690), // 11:30〜（a2 の終わり 11:00 から30分）
      pv('a4', 'a', 780), // 13:00〜（a3 の終わり 12:30 から30分）
      pv('b1', 'b', 600),
      pv('a5', 'a', 900), // 15:00〜（a4 の終わり 14:00 から60分：組にしない）
      pv('a6', 'a', 900), // a5 と重なる（2人で入る）
    ];
    const c = chainOf(visits, [rule('sc', 'sameClient', 2)])!;
    expect(c.next).toEqual([1, 2, 3, -1, -1, -1, -1]);
    expect(c.degree).toEqual([1, 2, 2, 1, 0, 0, 0]);
    expect(c.perPair).toBe(20);
  });
  it('間が31分なら組にしない。続く先が2つなら早いほう（同じなら先の添字）', () => {
    expect(chainOf([pv('a1', 'a', 540), pv('a2', 'a', 631)], [rule('sc', 'sameClient', 2)])).toBeNull();
    const c = chainOf([pv('a1', 'a', 540), pv('a3', 'a', 620), pv('a2', 'a', 610)], [rule('sc', 'sameClient', 1)])!;
    expect(c.next[0]).toBe(2);
  });
  it('同じ時刻の印の無い2件 A・B のあとに C があっても、C へ続く組は1つだけ（最良の案で点が残らない）', () => {
    const visits = [pv('A', 'a', 540), pv('B', 'a', 540), pv('C', 'a', 600)];
    const c = chainOf(visits, [rule('sc', 'sameClient', 2)])!;
    expect(c.next).toEqual([2, -1, -1]);
    const problem = { chain: c } as unknown as Problem;
    expect(chainScore(problem, [[0, 2], [1]])).toEqual({ points: 0, pairs: 1, kept: 1 });
    // 2人が続けて入る（A・B のあとに C・D）なら A→C・B→D
    const two = chainOf([...visits, pv('D', 'a', 600)], [rule('sc', 'sameClient', 2)])!;
    expect(two.next).toEqual([2, 3, -1, -1]);
  });
  it('重み0・条件が無ければ null（今までと同じ問題）', () => {
    const visits = [pv('a1', 'a', 540), pv('a2', 'a', 600)];
    expect(chainOf(visits, [rule('sc', 'sameClient', 0)])).toBeNull();
    expect(chainOf(visits, [])).toBeNull();
  });
});

describe('続く訪問の点', () => {
  const chain = { next: [1, 2, -1, -1], degree: [1, 2, 1, 0], perPair: 20, ruleId: 'sc' };
  it('列で続けて回る組は0、続けて回らない組は perPair（半分ずつ両方の訪問に持たせる）', () => {
    expect(chainRoutePoints(chain, [0, 1, 2])).toBe(0);
    expect(chainRoutePoints(chain, [0, 3, 1, 2])).toBe(20);
    expect(chainRoutePoints(chain, [0])).toBe(10);
    expect(chainRoutePoints(chain, [1])).toBe(20);
    expect(chainRoutePoints(chain, [3])).toBe(0);
  });
  it('列ごとの点＋担当なしの点 ＝ chainScore（続けて回らない組 × perPair）', () => {
    const problem = { chain } as unknown as Problem;
    const seqs = [
      [0, 3],
      [1, 2],
    ];
    const routes = seqs.reduce((a, s) => a + chainRoutePoints(chain, s), 0);
    expect(routes).toBe(chainScore(problem, seqs).points);
    expect(chainScore(problem, seqs)).toEqual({ points: 20, pairs: 2, kept: 1 });
    // 2 を落とすと、2 の組（1→2）の半分は落とした点に入る
    const partial = [[0, 1], [3]];
    const sum = partial.reduce((a, s) => a + chainRoutePoints(chain, s), 0) + 10;
    expect(sum).toBe(chainScore(problem, partial).points);
  });
});

/** 同じ〈利用者さん〉の 9:00〜10:00 と 10:00〜11:00（サービスの内容で分けた2つの訪問）。負担の均等（重み1）は1人1件を好む */
function splitDay(weight: number) {
  return makeData({
    staff: [staff('s1', 38.26, 140.87), staff('s2', 38.261, 140.871)],
    clients: [client('c1', 38.27, 140.88)],
    visits: [
      visit('v1', 'c1', '09:00', '09:00', { windowKind: 'fixed' }),
      visit('v2', 'c1', '10:00', '10:00', { windowKind: 'fixed' }),
    ],
    rules: [rule('bal', 'balance', 1), rule('sc', 'sameClient', weight)],
  });
}

describe('solver と evaluate（続く訪問）', () => {
  it('重み0では負担の均等で2人に分かれ、重み2なら同じ人が続けて回る', () => {
    const off = compile(splitDay(0), DATE);
    expect(off.chain).toBeUndefined();
    const a = solve(off, { seed: 1, iterations: 3000 });
    expect(Object.values(a.routes).filter((r) => r.length > 0)).toHaveLength(2);

    const on = compile(splitDay(2), DATE);
    expect(on.chain?.next).toEqual([1, -1]);
    const b = solve(on, { seed: 1, iterations: 3000 });
    expect(Object.values(b.routes).filter((r) => r.length > 0)).toEqual([['v1', 'v2']]);
    expect(score(on, b.routes).total).toBeCloseTo(b.score, 6);
    expect(score(on, b.routes).chainPoints).toBe(0);
    // 分けた案は 1組×20点が採点に入り、perRule にも出る
    const split = score(on, { s1: ['v1'], s2: ['v2'] });
    expect(split.chainPoints).toBe(20);
    expect(split.perRule.sc).toEqual({ hits: 0, misses: 1, points: 20 });
  });

  it('続く訪問の条件の ID が衝突で sameClient2 でも、perRule・達成はその ID に入り、ID が sameClient のほかの条件を上書きしない', () => {
    const d = splitDay(2);
    d.rules = [
      rule('sameClient', 'staffPreference', 1),
      rule('bal', 'balance', 1),
      rule('sameClient2', 'sameClient', 2),
    ];
    d.compat = {};
    const p = compile(d, DATE);
    expect(p.chain?.ruleId).toBe('sameClient2');
    const split = score(p, { s1: ['v1'], s2: ['v2'] });
    expect(split.perRule.sameClient2).toEqual({ hits: 0, misses: 1, points: 20 });
    expect(split.perRule.sameClient?.points ?? 0).not.toBe(20);
    const ach = achievements(p, { s1: ['v1'], s2: ['v2'] });
    expect(ach.find((a) => a.ruleId === 'sameClient2')).toMatchObject({ total: 1, met: 0 });
  });

  it('同じ〈利用者さん〉の続く訪問が多い乱数のデータで、solver の score は evaluate の total と一致する', () => {
    for (const seed of [3, 4]) {
      const d = randomData(5, 20, seed, [rule('sc', 'sameClient', 3), rule('bal', 'balance', 1), rule('w', 'wait', 2)]);
      // 4件ずつ同じ〈利用者さん〉にし、続く時刻にする（9:00〜・10:00〜）
      d.visits = d.visits.map((v, i) => ({
        ...v,
        clientId: d.clients[Math.floor(i / 2)]!.id,
        earliestStart: i % 2 === 0 ? '09:00' : '10:00',
        latestStart: i % 2 === 0 ? '09:30' : '10:30',
        durationMinutes: 60,
      }));
      const p = compile(d, DATE);
      expect(p.chain).toBeTruthy();
      const r = solve(p, { seed: 7, iterations: 20000 });
      expect(score(p, r.routes).total).toBeCloseTo(r.score, 6);
      // 列ごとの routeCost と落とした点の和も同じ（solver が最小にする値）
      const staffIdx = new Map(p.staff.map((s, i) => [s.id, i]));
      const vIdx = new Map(p.visits.map((v, i) => [v.id, i]));
      let internal = 0;
      for (const [sid, ids] of Object.entries(r.routes)) {
        const seq = ids.map((id) => vIdx.get(id)!);
        if (seq.length > 0) internal += routeCost(p, staffIdx.get(sid)!, seq);
      }
      for (const id of r.unassigned) internal += dropPointsOf(p, vIdx.get(id)!);
      const sc = score(p, r.routes);
      expect(internal + sc.balancePoints).toBeCloseTo(r.score, 6);
    }
  });
});
