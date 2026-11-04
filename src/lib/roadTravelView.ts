// 管理者設定の「道路の移動時間（車）」の文と入力の確かめ（PRD D433。ADR-0099）。純粋関数
import {
  type LatLng,
  ROAD_PARK_MINUTES_MAX,
  ROAD_TRAFFIC_FACTOR_MAX,
  ROAD_TRAFFIC_FACTOR_MIN,
  type RoadTable,
  type RoadTravel,
} from '../contracts/documents';
import { roadMinutes } from '../matching';
import { roadMissingCount } from './roadTable';

/** 駐車・玄関までの分の入力の誤り（0〜上限の整数。正しければ null） */
export function parkInputError(text: string): string | null {
  const n = Number(text.normalize('NFKC').trim());
  if (text.trim() === '' || !Number.isInteger(n) || n < 0 || n > ROAD_PARK_MINUTES_MAX)
    return `0〜${ROAD_PARK_MINUTES_MAX}の整数（分）で入れてください`;
  return null;
}

/** 混雑係数の入力の誤り（範囲内の小数1桁まで。正しければ null） */
export function factorInputError(text: string): string | null {
  const t = text.normalize('NFKC').trim();
  const n = Number(t);
  if (t === '' || !/^\d+(\.\d)?$/.test(t) || n < ROAD_TRAFFIC_FACTOR_MIN || n > ROAD_TRAFFIC_FACTOR_MAX)
    return `${ROAD_TRAFFIC_FACTOR_MIN}〜${ROAD_TRAFFIC_FACTOR_MAX}の数（小数1桁まで）で入れてください`;
  return null;
}

/** 補正の例の文（「道路で10分の区間 → 5 + 10 × 1.5 = 20分」） */
export function roadExampleText(travel: RoadTravel, roadMin = 10): string {
  const total = Math.round(roadMinutes(roadMin * 60, travel));
  return `道路で${roadMin}分の区間 → ${travel.parkMinutes} + ${roadMin} × ${travel.trafficFactor} = ${total}分`;
}

/** 表の状態の文（取っていない・取った地点数と時刻・表に無い地点） */
export function roadStatusText(
  table: RoadTable | undefined,
  points: readonly LatLng[],
  at: (ms: number) => string,
): string {
  if (!table) return '取っていません。車の移動は直線距離から見積もっています';
  const missing = roadMissingCount(table, points);
  const head = `${table.points.length}地点を取りました（${at(table.at)}）`;
  return missing > 0
    ? `${head}。表に無い地点が${missing}あります（直線距離から見積もります。取り直すと入ります）`
    : head;
}
