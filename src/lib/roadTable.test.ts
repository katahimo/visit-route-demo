// OSRM から道路の所要の表を取る（PRD D436。ADR-0101）：fetch の偽物で確かめる
import { describe, expect, it } from 'vitest';
import { ROAD_POINTS_MAX } from '../contracts/documents';
import { client, makeData, staff } from '../matching/fixtures.testkit';
import {
  fetchRoadTable,
  type RoadFetchFn,
  roadBlocks,
  roadMissingCount,
  roadPointsOf,
  roadTableUrl,
} from './roadTable';
import { factorInputError, parkInputError, roadExampleText, roadStatusText } from './roadTravelView';

const P = [
  { lat: 38.2683, lng: 140.8694 },
  { lat: 38.2593, lng: 140.893 },
  { lat: 38.3245, lng: 140.8805 },
];
const noSleep = async () => {};

/** URL の sources・destinations から、所要＝出発番号×100＋到着番号（道のりはその10倍）を返す偽物 */
function fakeOsrm(calls: string[]): RoadFetchFn {
  return async (url) => {
    calls.push(url);
    const q = new URL(url).searchParams;
    const coords = new URL(url).pathname.split('/').pop()!.split(';');
    const src = q.get('sources')!.split(';').map(Number);
    const dst = q.get('destinations')!.split(';').map(Number);
    expect(Math.max(...src, ...dst)).toBeLessThan(coords.length);
    const v = (a: number, b: number) => a * 100 + b;
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        durations: src.map((a) => dst.map((b) => v(a, b))),
        distances: src.map((a) => dst.map((b) => v(a, b) * 10)),
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
    expect(roadMissingCount({ at: 0, points: [P[0]!], seconds: [[0]], meters: [[0]] }, pts)).toBe(1);
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
  it('1回で取り、同じ地点は 0、秒は整数・道のりは 10 m 単位', async () => {
    const calls: string[] = [];
    const r = await fetchRoadTable(P, { fetch: fakeOsrm(calls), sleep: noSleep, now: 123 });
    expect(calls).toHaveLength(1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.at).toBe(123);
    expect(r.table.seconds[0]).toEqual([0, 1, 2]);
    expect(r.table.seconds[2]).toEqual([200, 201, 0]);
    expect(r.table.meters[1]).toEqual([1000, 0, 1020]);
  });

  it('地点が多ければ区画に分けて順に送り、合わせた表は送った番号に関わらず地点の並び', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ lat: 38 + i / 1000, lng: 140 }));
    const calls: string[] = [];
    const progress: string[] = [];
    const slept: number[] = [];
    const r = await fetchRoadTable(many, {
      fetch: fakeOsrm(calls),
      sleep: async (ms) => {
        slept.push(ms);
      },
      onProgress: (d, t) => progress.push(`${d}/${t}`),
    });
    expect(calls).toHaveLength(4);
    expect(slept).toHaveLength(3);
    expect(progress).toEqual(['1/4', '2/4', '3/4', '4/4']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.seconds).toHaveLength(60);
    expect(r.table.seconds.every((row) => row.length === 60 && row.every((x) => x !== null))).toBe(true);
    // 区画（50〜59）→ 区画（0〜49）：送った座標は 50〜59 が 0〜9、0〜49 が 10〜59
    expect(r.table.seconds[55]![3]).toBe(5 * 100 + 13);
  });

  it('道が見つからない（null）は null のまま', async () => {
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
    expect(r.ok && r.table.seconds[0]![1]).toBeNull();
  });

  it('送らない：地点が無い・上限を超える', async () => {
    const calls: string[] = [];
    expect(await fetchRoadTable([], { fetch: fakeOsrm(calls) })).toEqual({ ok: false, reason: 'empty' });
    const many = Array.from({ length: ROAD_POINTS_MAX + 1 }, (_, i) => ({ lat: i / 1000, lng: 0 }));
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
    expect(parkInputError('5')).toBeNull();
    expect(parkInputError('０')).toBeNull();
    expect(parkInputError('')).not.toBeNull();
    expect(parkInputError('2.5')).not.toBeNull();
    expect(parkInputError('61')).not.toBeNull();
    expect(factorInputError('1.5')).toBeNull();
    expect(factorInputError('3')).toBeNull();
    expect(factorInputError('0.9')).not.toBeNull();
    expect(factorInputError('1.25')).not.toBeNull();
    expect(factorInputError('3.1')).not.toBeNull();
  });
  it('例と状態の文', () => {
    expect(roadExampleText({ parkMinutes: 5, trafficFactor: 1.5 })).toBe('道路で10分の区間 → 5 + 10 × 1.5 = 20分');
    expect(roadStatusText(undefined, P, String)).toBe('取っていません。車の移動は直線距離から見積もっています');
    const t = { at: 9, points: [P[0]!], seconds: [[0]], meters: [[0]] };
    expect(roadStatusText(t, [P[0]!], String)).toBe('1地点を取りました（9）');
    expect(roadStatusText(t, P, String)).toContain('表に無い地点が2あります');
  });
});
