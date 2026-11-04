// 道路の所要の表を移動の行列に使う（PRD D433。ADR-0099）
import { describe, expect, it } from 'vitest';
import type { RoadTable } from '../contracts/documents';
import { estimateLeg } from '../domain/geo';
import { client, DATE, makeData, staff, visit } from './fixtures.testkit';
import { compile } from './index';
import { roadMinutes, roadModelOf, roadPointKey } from './roads';

const HOME = { lat: 38.2683, lng: 140.8694 };
const A = { lat: 38.2593, lng: 140.893 };
const B = { lat: 38.3245, lng: 140.8805 };

/** HOME・A・B の表（B への・からの道は見つからない） */
const table: RoadTable = {
  at: 0,
  points: [HOME, A, B],
  seconds: [
    [0, 360, null],
    [400, 0, null],
    [null, null, 0],
  ],
  meters: [
    [0, 3150, null],
    [3200, 0, null],
    [null, null, 0],
  ],
};
const TRAVEL = { parkMinutes: 5, trafficFactor: 1.5 };

describe('roadModelOf・roadMinutes', () => {
  it('補正：駐車・玄関までの分 ＋ 混雑係数 × 道路の所要（分）', () => {
    expect(roadMinutes(600, TRAVEL)).toBe(20);
    expect(roadMinutes(0, { parkMinutes: 0, trafficFactor: 1 })).toBe(0);
  });

  it('表が無い・空なら null', () => {
    expect(roadModelOf(undefined, TRAVEL)).toBeNull();
    expect(roadModelOf({ ...table, points: [], seconds: [], meters: [] }, TRAVEL)).toBeNull();
  });

  it('向きのある組を引く。表に無い地点・道が見つからない組は null。小数5桁で同じ地点とみる', () => {
    const m = roadModelOf(table, TRAVEL)!;
    expect(m.lookup(HOME, A)).toEqual({ seconds: 360, meters: 3150 });
    expect(m.lookup(A, HOME)).toEqual({ seconds: 400, meters: 3200 });
    expect(m.lookup(HOME, B)).toBeNull();
    expect(m.lookup(HOME, { lat: 1, lng: 1 })).toBeNull();
    expect(m.lookup({ lat: 38.268301, lng: 140.869401 }, A)).toEqual({ seconds: 360, meters: 3150 });
    expect(roadPointKey({ lat: 38.268301, lng: 140.869401 })).toBe('38.26830,140.86940');
  });
});

describe('compile の移動の行列と道路の所要の表', () => {
  const data = (mode: 'DRIVE' | 'WALK' = 'DRIVE') =>
    makeData({
      staff: [staff('s1', HOME.lat, HOME.lng, { travelMode: mode })],
      clients: [client('a', A.lat, A.lng), client('b', B.lat, B.lng)],
      visits: [visit('v1', 'a', '09:00', '09:00'), visit('v2', 'b', '13:00', '13:00')],
      roads: table,
    });

  it('車の区間は補正した道路の所要と道のり（自宅 → A：5 + 1.5 × 6 = 14分・3150 m）', () => {
    const p = compile(data(), DATE);
    expect(p.travel[0]![1]).toBe(14);
    expect(p.meters[0]![1]).toBe(3150);
    expect(p.travel[1]![0]).toBe(5 + 1.5 * (400 / 60));
  });

  it('補正の値は事業所の設定から', () => {
    const d = data();
    d.org = { ...d.org, roadTravel: { parkMinutes: 0, trafficFactor: 1 } };
    expect(compile(d, DATE).travel[0]![1]).toBe(6);
  });

  it('道が見つからない組は直線距離からの見積もり', () => {
    const p = compile(data(), DATE);
    expect(p.travel[0]![2]).toBe(estimateLeg(HOME, B, 'DRIVE').seconds / 60);
  });

  it('車でない区間は表を使わない（直線距離からの見積もり）', () => {
    const p = compile(data('WALK'), DATE);
    expect(p.travel[0]![1]).toBe(estimateLeg(HOME, A, 'WALK').seconds / 60);
  });

  it('表が無ければ今までどおり', () => {
    const d = data();
    delete d.roads;
    expect(compile(d, DATE).travel[0]![1]).toBe(estimateLeg(HOME, A, 'DRIVE').seconds / 60);
  });
});
