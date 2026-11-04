// 地点どうしの移動（分）と距離（m）の行列と、移動・遠方（出張）の理由のキーと文（ADR-0093・ADR-0096。PRD D429）
import { TRAVEL_MODES, type TravelMode } from '../contracts/codes';
import { type LatLng, LINE_TRAVEL_DEFAULT, type LineTravel, type Staff } from '../contracts/documents';
import { estimateLeg } from '../domain/geo';
import { type RoadModel, roadMinutes } from './roads';

/**
 * 位置（緯度・経度）が未登録の訪問先・自宅への移動の見込み（分）。位置が無くても担当を組めるように、
 * どこからでもこの分数とみる（ADR-0093。台帳 CSV を読んだだけで地図に置く前でも組める）
 */
export const UNPLACED_TRAVEL_MIN = 30;

/**
 * 移動が間に合わない理由の ruleId（ADR-0096）：その担当がその訪問だけを回っても、勤務の開始に家を出て移動すると
 * 時間の約束に間に合わない（evaluate の explain が担当なしの訪問の理由に出す。可否にはしない）
 */
export const TRAVEL_TOO_FAR_RULE_ID = 'travelTooFar';
/** 移動が間に合わない理由の文の頭（文は travelTooFarLabel） */
export const TRAVEL_TOO_FAR_WORD = '移動が間に合わない';
/** 移動が間に合わない理由の文（片道の分は四捨五入） */
export const travelTooFarLabel = (minutes: number): string =>
  `${TRAVEL_TOO_FAR_WORD}（片道 約${Math.round(minutes)}分）`;

/** 遠方（出張）の訪問の日にほかの訪問を並べたときの理由の ruleId（ADR-0096） */
export const FAR_TRIP_RULE_ID = 'farTrip';
/** 遠方（出張）の訪問の日にほかの訪問を並べたときの理由の文 */
export const FAR_TRIP_LABEL = '遠方（出張）の日はほかの訪問を入れません';

/** 事業所の多数決の移動手段（同数なら TRAVEL_MODES の順） */
function majorityMode(staff: Staff[]): TravelMode {
  let best: TravelMode = 'DRIVE';
  let bestCount = 0;
  for (const m of TRAVEL_MODES) {
    const c = staff.filter((s) => s.travelMode === m).length;
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return best;
}

type Matrices = { travel: number[][]; meters: number[][] };

/**
 * 2地点の移動（分）と距離（m）。fixed は手で決めた移動時間（片道・分。ADR-0096）で、どちらかにあれば距離の計算ではなくそれを使う
 * （両方にあれば長いほう。距離は 0 m＝交通費に入れない）。位置が未登録の側があれば UNPLACED_TRAVEL_MIN 分・0 m（ADR-0093）。
 * 車の区間で道路の所要の表に組があれば、補正した道路の所要と道のり（ADR-0101）。無ければ直線距離からの見積もり
 */
function legOf(
  a: { at: LatLng | null; fixed: number | null },
  b: { at: LatLng | null; fixed: number | null },
  mode: TravelMode,
  road: RoadModel | null,
  line: LineTravel,
): { minutes: number; meters: number } {
  if (a.fixed !== null || b.fixed !== null) return { minutes: Math.max(a.fixed ?? 0, b.fixed ?? 0), meters: 0 };
  if (!a.at || !b.at) return { minutes: UNPLACED_TRAVEL_MIN, meters: 0 };
  const onRoad = road && mode === 'DRIVE' ? road.lookup(a.at, b.at) : null;
  if (onRoad) return { minutes: roadMinutes(onRoad.seconds, road!), meters: Math.round(onRoad.meters) };
  const leg = estimateLeg(a.at, b.at, mode, line);
  return { minutes: leg.seconds / 60, meters: leg.meters };
}

/**
 * 地点どうしの移動（分）と距離（m）の行列（先に自宅、続いて訪問先）。keys は地点の鍵で、同じ鍵なら位置が未登録でも 0 分。
 * fixed は地点ごとの手で決めた移動時間（片道・分。自宅・決めていない訪問先は null）。
 * road は道路の所要の表（ADR-0101。取っていなければ null）：車の区間だけ使う。line は直線距離からの見積もりの係数
 */
export function travelMatrices(
  places: (LatLng | null)[],
  fixed: (number | null)[],
  keys: string[],
  staffDocs: Staff[],
  road: RoadModel | null = null,
  line: LineTravel = LINE_TRAVEL_DEFAULT,
): Matrices {
  const S = staffDocs.length;
  const P = places.length;
  const common = majorityMode(staffDocs);
  // 自宅が絡む区間はそのスタッフの手段（出る側を優先）、訪問先どうしは多数決の手段
  const modeOf = (i: number, j: number): TravelMode =>
    i < S ? staffDocs[i]!.travelMode : j < S ? staffDocs[j]!.travelMode : common;
  const travel: number[][] = [];
  const meters: number[][] = [];
  for (let i = 0; i < P; i++) {
    const tr = new Array<number>(P).fill(0);
    const me = new Array<number>(P).fill(0);
    const a = { at: places[i] ?? null, fixed: fixed[i] ?? null };
    for (let j = 0; j < P; j++) {
      if (i === j || keys[i] === keys[j]) continue;
      const leg = legOf(a, { at: places[j] ?? null, fixed: fixed[j] ?? null }, modeOf(i, j), road, line);
      tr[j] = leg.minutes;
      me[j] = leg.meters;
    }
    travel.push(tr);
    meters.push(me);
  }
  return { travel, meters };
}
