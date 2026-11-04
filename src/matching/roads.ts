// 道路の所要の表（DemoData.roads）を引く・補正する（PRD D436。ADR-0101）。純粋関数
import type { LatLng, RoadTable, RoadTravel } from '../contracts/documents';

/** 道路の1区間：所要（秒）と道のり（m） */
export type RoadLeg = { seconds: number; meters: number };

/** 車の区間の移動の見方：表を引く関数と補正 */
export type RoadModel = { lookup: (a: LatLng, b: LatLng) => RoadLeg | null } & RoadTravel;

/** 地点の鍵（緯度・経度を小数5桁。約1m。表を作る側と引く側で同じものを使う） */
export function roadPointKey(p: LatLng): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

/** 補正した移動（分）：駐車・玄関までの分 ＋ 混雑係数 × 道路の所要（分） */
export function roadMinutes(seconds: number, travel: RoadTravel): number {
  return travel.parkMinutes + travel.trafficFactor * (seconds / 60);
}

/** 表から引く関数（表が無ければ null。表に無い地点・道が見つからない組は null＝直線距離からの見積もりに戻す） */
export function roadModelOf(table: RoadTable | undefined, travel: RoadTravel): RoadModel | null {
  if (!table || table.points.length === 0) return null;
  const index = new Map<string, number>();
  table.points.forEach((p, i) => {
    index.set(roadPointKey(p), i);
  });
  const lookup = (a: LatLng, b: LatLng): RoadLeg | null => {
    const i = index.get(roadPointKey(a));
    const j = index.get(roadPointKey(b));
    if (i === undefined || j === undefined) return null;
    const seconds = table.seconds[i]?.[j];
    const meters = table.meters[i]?.[j];
    if (seconds === null || seconds === undefined || meters === null || meters === undefined) return null;
    return { seconds, meters };
  };
  return { lookup, parkMinutes: travel.parkMinutes, trafficFactor: travel.trafficFactor };
}
