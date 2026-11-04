// OSRM から道路の所要の表を取る（PRD D436。ADR-0101）：fetch の偽物で確かめる
import { describe, expect, it } from 'vitest';
import { ROAD_NEAR_K, ROAD_POINTS_MAX } from '../contracts/documents';
import { client, makeData, staff } from '../matching/fixtures.testkit';
import {
  fetchRoadTable,
  type RoadFetchFn,
  roadBlocks,
  roadEstimateSeconds,
  roadMissingCount,
  roadPointsOf,
  roadRequestCount,
  roadTableUrl,
} from './roadTable';
import {
  lineExampleText,
  numberInputError,
  roadExampleText,
  roadPlanText,
  roadProgressText,
  roadStatusText,
  TRAVEL_RULES,
} from './roadTravelView';

const P = [
  { lat: 38.2683, lng: 140.8694 },
  { lat: 38.2593, lng: 140.893 },
  { lat: 38.3245, lng: 140.8805 },
];
const noSleep = async () => {};

/** 一直線に並べた地点（i 番目は緯度 38 + i/1000） */
const line = (n: number) => Array.from({ length: n }, (_, i) => ({ lat: 38 + i / 1000, lng: 140 }));

/** 座標から決まる偽物：所要＝緯度の差 × 100000 秒（並べた地点なら |i−j|×100）、道のり＝所要×10 */
function fakeOsrm(calls: string[]): RoadFetchFn {
  return async (url) => {
    calls.push(url);
    const u = new URL(url);
    const coords = u.pathname
      .split('/')
      .pop()!
      .split(';')
      .map((c) => Number(c.split(',')[1]));
    expect(coords.length).toBeLessThanOrEqual(100);
    const src = u.searchParams.get('sources')!.split(';').map(Number);
    const dst = u.searchParams.get('destinations')!.split(';').map(Number);
    const v = (a: number, b: number) => Math.round(Math.abs(coords[a]! - coords[b]!) * 100000);
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        durations: src.map((a) => dst.map((b) => v(a, b))),
        distances: src.map((a) => dst.map((b) => v(a, b) * 10 + 3)),
      }),
    };
  };
}

describe('roadPointsOf・roadMissingCount', () => {
  it('位置のある自宅と〈利用者さん〉（移動時間を決めた人を除く）。同じ位置は1つ', () => {
    const d = makeData({
      staff: [staff('s1', P[0]!.lat, P[0]!.lng), staff('s2', P[0]!.lat, P[0]!.lng)],
      clients: [
        client('a', P[1]!.lat, P[1]!.lng),
        client('b', P[2]!.lat, P[2]!.lng, {
          place: { address: '', ...P[2]!, postalCode: '', travelMinutes: 60 },
        }),
        client('c', 0, 0, { place: { address: '', lat: null, lng: null, postalCode: '' } }),
      ],
    });
    const pts = roadPointsOf(d);
    expect(pts).toEqual([P[0], P[1]]);
    expect(roadMissingCount(undefined, pts)).toBe(2);
    expect(roadMissingCount({ at: 0, points: [P[0]!], near: [[]], seconds: [[]], meters: [[]] }, pts)).toBe(1);
  });
});

describe('roadBlocks・roadTableUrl', () => {
  it('区画に分ける', () => {
    expect(roadBlocks(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(roadBlocks(0, 2)).toEqual([]);
  });
  it('座標は 経度,緯度。sources・destinations を付ける', () => {
    expect(roadTableUrl([P[0]!, P[1]!], [0], [0, 1])).toBe(
      'https://router.project-osrm.org/table/v1/driving/140.86940,38.26830;140.89300,38.25930?sources=0&destinations=0;1&annotations=duration,distance',
    );
  });
});

describe('fetchRoadTable', () => {
  it('100地点までは1回で全組。自分自身は残さず、所要の近い順。秒は整数・道のりは 10 m 単位', async () => {
    const calls: string[] = [];
    const r = await fetchRoadTable(line(3), { fetch: fakeOsrm(calls), sleep: noSleep, now: 123 });
    expect(calls).toHaveLength(1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.at).toBe(123);
    expect(r.table.near).toEqual([
      [1, 2],
      [0, 2],
      [1, 0],
    ]);
    expect(r.table.seconds[2]).toEqual([100, 200]);
    expect(r.table.meters[2]).toEqual([1000, 2000]);
  });

  it('100地点を超えれば 50地点ずつの区画で順に送り、地点ごとに近い ROAD_NEAR_K 件を残す', async () => {
    const calls: string[] = [];
    const progress: string[] = [];
    const slept: number[] = [];
    const r = await fetchRoadTable(line(120), {
      fetch: fakeOsrm(calls),
      sleep: async (ms) => {
        slept.push(ms);
      },
      onProgress: (d, t) => progress.push(`${d}/${t}`),
    });
    expect(calls).toHaveLength(9);
    expect(roadRequestCount(120)).toBe(9);
    expect(slept).toHaveLength(8);
    expect(progress.at(-1)).toBe('9/9');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.near.every((ns) => ns.length === ROAD_NEAR_K)).toBe(true);
    // 0 番の近い順は 1, 2, …, 50（区画をまたぐ 50 を含む）
    expect(r.table.near[0]).toEqual(Array.from({ length: ROAD_NEAR_K }, (_, k) => k + 1));
    expect(r.table.seconds[0]![49]).toBe(5000);
    // 区画の境（59 番）：近い順に 58, 60, 57, 61, …（同じ所要は番号の小さい順）
    expect(r.table.near[59]!.slice(0, 4)).toEqual([58, 60, 57, 61]);
  });

  it('道が見つからない（null）組は残さない', async () => {
    const f: RoadFetchFn = async () => ({
      ok: true,
      json: async () => ({
        code: 'Ok',
        durations: [
          [0, null],
          [5, 0],
        ],
        distances: [
          [0, null],
          [50, 0],
        ],
      }),
    });
    const r = await fetchRoadTable([P[0]!, P[1]!], { fetch: f, sleep: noSleep });
    expect(r.ok && r.table.near).toEqual([[], [0]]);
  });

  it('回数と目安の時間', () => {
    expect(roadRequestCount(0)).toBe(0);
    expect(roadRequestCount(100)).toBe(1);
    expect(roadRequestCount(101)).toBe(9);
    expect(roadRequestCount(500)).toBe(100);
    expect(roadEstimateSeconds(0)).toBe(0);
    expect(roadEstimateSeconds(100)).toBe(1);
    expect(roadEstimateSeconds(500)).toBe(209);
  });

  it('送らない：地点が無い・上限を超える', async () => {
    const calls: string[] = [];
    expect(await fetchRoadTable([], { fetch: fakeOsrm(calls) })).toEqual({ ok: false, reason: 'empty' });
    const many = line(ROAD_POINTS_MAX + 1);
    expect(await fetchRoadTable(many, { fetch: fakeOsrm(calls) })).toEqual({ ok: false, reason: 'tooMany' });
    expect(calls).toHaveLength(0);
  });

  it('失敗：つながらない・応答の形が違う・code が Ok でない', async () => {
    const throws: RoadFetchFn = async () => {
      throw new Error('x');
    };
    expect(await fetchRoadTable(P, { fetch: throws, sleep: noSleep })).toEqual({ ok: false, reason: 'network' });
    const bad: RoadFetchFn = async () => ({ ok: true, json: async () => ({ code: 'Ok', durations: [[0]] }) });
    expect(await fetchRoadTable(P, { fetch: bad, sleep: noSleep })).toEqual({ ok: false, reason: 'badResponse' });
    const ng: RoadFetchFn = async () => ({ ok: true, json: async () => ({ code: 'TooBig' }) });
    expect(await fetchRoadTable(P, { fetch: ng, sleep: noSleep })).toEqual({ ok: false, reason: 'badResponse' });
    const http: RoadFetchFn = async () => ({ ok: false, json: async () => ({}) });
    expect(await fetchRoadTable(P, { fetch: http, sleep: noSleep })).toEqual({ ok: false, reason: 'badResponse' });
  });

  it('止めた', async () => {
    const c = new AbortController();
    c.abort();
    expect(await fetchRoadTable(P, { fetch: fakeOsrm([]), signal: c.signal })).toEqual({
      ok: false,
      reason: 'aborted',
    });
  });
});

describe('roadTravelView', () => {
  it('入力の確かめ', () => {
    const { park, traffic, detour, driveKmh } = TRAVEL_RULES;
    expect(numberInputError('5', park)).toBeNull();
    expect(numberInputError('０', park)).toBeNull();
    expect(numberInputError('', park)).toBe('0〜60の整数（分）で入れてください');
    expect(numberInputError('2.5', park)).not.toBeNull();
    expect(numberInputError('61', park)).not.toBeNull();
    expect(numberInputError('1.5', traffic)).toBeNull();
    expect(numberInputError('3', traffic)).toBeNull();
    expect(numberInputError('0.9', traffic)).not.toBeNull();
    expect(numberInputError('1.25', traffic)).toBe('1〜3の数（小数1桁まで）（倍）で入れてください');
    expect(numberInputError('3.1', traffic)).not.toBeNull();
    expect(numberInputError('1.3', detour)).toBeNull();
    expect(numberInputError('25', driveKmh)).toBeNull();
    expect(numberInputError('4', driveKmh)).not.toBeNull();
    expect(numberInputError('25.5', driveKmh)).not.toBeNull();
  });
  it('例と状態の文', () => {
    expect(roadExampleText({ parkMinutes: 5, trafficFactor: 1.5 })).toBe('道路で10分の区間 → 5 + 10 × 1.5 = 20分');
    expect(lineExampleText({ detourFactor: 1.3, driveKmh: 25 })).toBe('直線 2km の区間 → 2 × 1.3 ÷ 25 × 60 = 6分');
    expect(roadStatusText(undefined, P, String)).toBe('取っていません。車の移動は直線距離から見積もっています');
    const t = { at: 9, points: [P[0]!], near: [[]], seconds: [[]], meters: [[]] };
    expect(roadStatusText(t, [P[0]!], String)).toBe('1地点を取りました（9）');
    expect(roadStatusText(t, P, String)).toContain('表に無い地点が2あります');
  });
});

describe('roadTravelView：目安と進みの文', () => {
  it('目安', () => {
    expect(roadPlanText(0)).toBe('緯度・経度の登録された自宅・訪問先がありません');
    expect(roadPlanText(28)).toBe('28地点・問い合わせ 1回・約1秒');
    expect(roadPlanText(500)).toBe('500地点・問い合わせ 100回・約4分');
    expect(roadPlanText(501)).toContain('上限の500を超える');
  });
  it('進み', () => {
    expect(roadProgressText(3, 9)).toBe('取っています（3/9）・残り約13秒');
    expect(roadProgressText(9, 9)).toBe('取っています（9/9）');
    expect(roadProgressText(0, 2)).toBe('取っています（0/2）・残り約5秒');
    expect(roadProgressText(0, 40)).toBe('取っています（0/40）・残り約2分');
  });
});
