// 移動時間の見積もり方（直線距離・車道の道のり）の文と係数の入力の確かめ（PRD D436。ADR-0101）。純粋関数
import {
  type LatLng,
  LINE_DETOUR_MAX,
  LINE_DETOUR_MIN,
  LINE_DRIVE_KMH_MAX,
  LINE_DRIVE_KMH_MIN,
  type LineTravel,
  ROAD_PARK_MINUTES_MAX,
  ROAD_POINTS_MAX,
  ROAD_TRAFFIC_FACTOR_MAX,
  ROAD_TRAFFIC_FACTOR_MIN,
  type RoadTable,
  type RoadTravel,
} from '../contracts/documents';
import { roadMinutes } from '../matching';
import {
  ROAD_REQUEST_GAP_MS,
  ROAD_RESPONSE_MS,
  roadEstimateSeconds,
  roadMissingCount,
  roadRequestCount,
} from './roadTable';

/** 係数の欄の決まり：範囲・小数の桁（0 なら整数）・単位の言葉 */
export type NumberRule = { min: number; max: number; decimals: 0 | 1; unit: string };

/** 係数の欄の決まり（ADR-0101） */
export const TRAVEL_RULES = {
  park: { min: 0, max: ROAD_PARK_MINUTES_MAX, decimals: 0, unit: '分' },
  traffic: { min: ROAD_TRAFFIC_FACTOR_MIN, max: ROAD_TRAFFIC_FACTOR_MAX, decimals: 1, unit: '倍' },
  detour: { min: LINE_DETOUR_MIN, max: LINE_DETOUR_MAX, decimals: 1, unit: '倍' },
  driveKmh: { min: LINE_DRIVE_KMH_MIN, max: LINE_DRIVE_KMH_MAX, decimals: 0, unit: 'km/h' },
} as const satisfies Record<string, NumberRule>;

/** 入力の文字 → 数（全角も受ける）。決まりに合わなければ null */
export function numberInput(text: string, rule: NumberRule): number | null {
  const t = text.normalize('NFKC').trim();
  const re = rule.decimals === 0 ? /^\d+$/ : /^\d+(\.\d)?$/;
  if (!re.test(t)) return null;
  const n = Number(t);
  return n >= rule.min && n <= rule.max ? n : null;
}

/** 係数の欄の誤りの文（正しければ null） */
export function numberInputError(text: string, rule: NumberRule): string | null {
  if (numberInput(text, rule) !== null) return null;
  const kind = rule.decimals === 0 ? 'の整数' : 'の数（小数1桁まで）';
  return `${rule.min}〜${rule.max}${kind}（${rule.unit}）で入れてください`;
}

/** 直線距離の例の文（「直線 2km の区間 → 2 × 1.3 ÷ 25 × 60 = 6分」） */
export function lineExampleText(line: LineTravel, km = 2): string {
  const total = Math.round(((km * line.detourFactor) / line.driveKmh) * 60);
  return `直線 ${km}km の区間 → ${km} × ${line.detourFactor} ÷ ${line.driveKmh} × 60 = ${total}分`;
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

/** 秒の目安の文（1分未満は「約N秒」、それ以上は分に切り上げて「約N分」） */
function aboutText(seconds: number): string {
  return seconds < 60 ? `約${Math.max(1, seconds)}秒` : `約${Math.ceil(seconds / 60)}分`;
}

/** 取る前の目安の文（「28地点・問い合わせ 1回・約1秒」）。地点が無ければ取れない旨 */
export function roadPlanText(count: number): string {
  if (count === 0) return '緯度・経度の登録された自宅・訪問先がありません';
  if (count > ROAD_POINTS_MAX) return `地点が${count}あり、上限の${ROAD_POINTS_MAX}を超えるため取れません`;
  return `${count}地点・問い合わせ ${roadRequestCount(count)}回・${aboutText(roadEstimateSeconds(count))}`;
}

/** 取っている途中の文（「取っています（3/9）・残り約12秒」） */
export function roadProgressText(done: number, total: number): string {
  const left = Math.ceil(((total - done) * (ROAD_RESPONSE_MS + ROAD_REQUEST_GAP_MS)) / 1000);
  return done >= total
    ? `取っています（${done}/${total}）`
    : `取っています（${done}/${total}）・残り${aboutText(left)}`;
}
