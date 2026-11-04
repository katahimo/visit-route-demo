// 予定の画面の時間軸（PRD D58。design.md §4 pages「予定の画面の時間軸」）の位置の計算。
// 分 → px、列の背景（稼働時間帯の外・欠勤）、移動・待ちの区間、ドラッグ中の影の可否。データは書き換えない
import type { ClientPlace } from '../contracts/documents';
import type { Problem, StopTiming } from '../contracts/problem';
import { bestInsertion, scheduleRoute } from '../matching';
import { hasLocation, own } from './common';
import { DAY_END, DAY_START, type Span } from './spans';

/** 1分の高さ（px） */
export const TL_PX_PER_MIN = 1.1;

/**
 * 時間軸の縦の範囲：07:00〜20:00 を基本に、spans（稼働時間帯・帯・移動）がはみ出せば1時間単位で広げる。
 * 0〜24時の外へは広げない。数でない値は無視する
 */
export function timeRange(spans: Span[], base: Span = { start: DAY_START, end: DAY_END }): Span {
  let start = base.start;
  let end = base.end;
  for (const s of spans) {
    if (Number.isFinite(s.start) && s.start < start) start = s.start;
    if (Number.isFinite(s.end) && s.end > end) end = s.end;
  }
  return { start: Math.max(0, Math.floor(start / 60) * 60), end: Math.min(24 * 60, Math.ceil(end / 60) * 60) };
}

/** 1時間ごとの目盛り（範囲の始まりと終わりを含む） */
export function hourMarks(range: Span): number[] {
  const out: number[] = [];
  for (let m = Math.ceil(range.start / 60) * 60; m <= range.end; m += 60) out.push(m);
  return out;
}

/** 時刻 → 範囲の上端からの px（範囲の外は端に寄せる） */
export function toY(minutes: number, range: Span, px = TL_PX_PER_MIN): number {
  const m = Math.min(Math.max(minutes, range.start), range.end);
  return (m - range.start) * px;
}

/** 区間の上端と高さ（px）。範囲の外は切る。高さは minPx 以上 */
export function boxOf(span: Span, range: Span, px = TL_PX_PER_MIN, minPx = 0): { top: number; height: number } {
  const top = toY(span.start, range, px);
  return { top, height: Math.max(minPx, toY(span.end, range, px) - top) };
}

/** a から b を除いた区間（a・b は開始の順でなくてよい。結果は開始の順・長さ0なし） */
export function subtractSpans(a: Span[], b: Span[]): Span[] {
  let cur = a.filter((x) => x.start < x.end).map((x) => ({ ...x }));
  for (const y of b) {
    if (!(y.start < y.end)) continue;
    const next: Span[] = [];
    for (const x of cur) {
      if (y.end <= x.start || x.end <= y.start) {
        next.push(x);
        continue;
      }
      if (x.start < y.start) next.push({ start: x.start, end: y.start });
      if (y.end < x.end) next.push({ start: y.end, end: x.end });
    }
    cur = next;
  }
  return cur.filter((x) => x.start < x.end).sort((x, y) => x.start - y.start);
}

/** 列の背景の区間：off＝稼働時間帯の外・途中の休み（灰）、absent＝欠勤で差し引いた時間（斜線と「欠勤」） */
export type BackgroundSpan = Span & { kind: 'off' | 'absent' };

/**
 * 列の背景。baseSlots は欠勤を差し引く前の稼働時間帯、slots は差し引いたもの（useDayModel の slotsOf）。
 * 範囲のうち baseSlots の外が off、baseSlots のうち slots の外が absent（欠勤の from・to が null でも差で出る）
 */
export function backgroundOf(range: Span, baseSlots: Span[], slots: Span[]): BackgroundSpan[] {
  const off = subtractSpans([range], baseSlots).map((x) => ({ ...x, kind: 'off' as const }));
  const absent = subtractSpans(
    baseSlots.map((x) => ({ start: Math.max(x.start, range.start), end: Math.min(x.end, range.end) })),
    slots,
  ).map((x) => ({ ...x, kind: 'absent' as const }));
  return [...off, ...absent].sort((x, y) => x.start - y.start);
}

/**
 * 帯のあいだの区間：fromHome（最初の訪問へ自宅から）・drive（前の訪問の終わりから移動）・wait（着いてから始めるまで）・
 * toHome（最後の訪問の終わりから自宅まで）。visitId は区間のキー（来る区間は行き先の訪問、toHome は最後の訪問）
 */
export type LegSpan = Span & {
  kind: 'fromHome' | 'drive' | 'wait' | 'toHome';
  visitId: string;
  minutes: number;
  /** 片方の位置（緯度・経度）が未登録で、分数が見込み（ADR-0093。markLegs が付ける） */
  estimated?: boolean;
  /** 着く時刻が訪問の「いつまでに始める」を過ぎている（markLegs が付ける） */
  late?: boolean;
  /** 距離（m。道路の所要の表があれば道のり。ADR-0101。withLegMeters が付ける。0 なら出さない） */
  meters?: number;
};

/** 着く時刻の比べで許す誤差（分。matching/timing.ts の EPS と同じ考え） */
const LATE_EPS = 1e-6;

/**
 * 担当の1列の時刻（lenient の scheduleRoute）から移動・待ちの区間。homeMinutes は最後の訪問から自宅まで（無ければ null）。
 * 移動は次の訪問の始まりに接して置き、待ちはその前（前の訪問の終わり〜出る時刻）に置く（担当ごとの1日の横棒 spanParts と同じ）
 */
export function legsOf(stops: StopTiming[], homeMinutes: number | null): LegSpan[] {
  const out: LegSpan[] = [];
  stops.forEach((t, k) => {
    const prevEnd = k > 0 ? stops[k - 1]!.end : Number.NEGATIVE_INFINITY;
    const leave = Math.max(prevEnd, t.start - t.travelIn);
    if (k > 0 && leave - prevEnd > LATE_EPS) {
      out.push({ kind: 'wait', visitId: t.visitId, start: prevEnd, end: leave, minutes: leave - prevEnd });
    }
    if (t.travelIn > 0) {
      out.push({
        kind: k === 0 ? 'fromHome' : 'drive',
        visitId: t.visitId,
        start: leave,
        end: t.start,
        minutes: t.travelIn,
      });
    }
  });
  const last = stops.at(-1);
  if (last && homeMinutes !== null) {
    out.push({
      kind: 'toHome',
      visitId: last.visitId,
      start: last.end,
      end: last.end + homeMinutes,
      minutes: homeMinutes,
    });
  }
  return out;
}

/**
 * 訪問先の移動の決まり方：fixed＝移動時間（片道・分）を手で決めた（位置に関わらずその分数。ADR-0096）、
 * placed＝位置から見積もる、none＝位置が未登録（UNPLACED_TRAVEL_MIN 分の見込み。ADR-0093）。〈利用者さん〉が分からなければ none
 */
export function visitTravelKind(place: ClientPlace | undefined): 'fixed' | 'placed' | 'none' {
  if (!place) return 'none';
  if (place.travelMinutes !== undefined) return 'fixed';
  return hasLocation(place) ? 'placed' : 'none';
}

/**
 * 移動の区間に「見込み」「間に合わない」の印を付ける（分数は組みの結果のまま。新しく計算し直さない）。
 * order は担当の訪問IDの並び、visitPlace は訪問先の〈利用者さん〉の場所、homePlaced は自宅の位置があるか、
 * latestOf は訪問の「いつまでに始める」（分。無ければ undefined）。待ちの区間はそのまま返す。
 * 見込みは、両端のどちらにも移動時間が無く、どちらかの位置が未登録の区間（移動時間があればその分数で決まる。matching の legOf と同じ）
 */
export function markLegs(
  legs: LegSpan[],
  a: {
    order: string[];
    visitPlace: (visitId: string) => ClientPlace | undefined;
    homePlaced: boolean;
    latestOf: (visitId: string) => number | undefined;
  },
): LegSpan[] {
  const kindOf = (id: string) => visitTravelKind(a.visitPlace(id));
  return legs.map((leg) => {
    if (leg.kind === 'wait') return leg;
    const k = a.order.indexOf(leg.visitId);
    const prev = leg.kind === 'drive' && k > 0 ? a.order[k - 1] : undefined;
    const here = kindOf(leg.visitId);
    const ends = leg.kind === 'drive' ? (prev !== undefined ? [kindOf(prev), here] : []) : [here];
    const homeKnown = leg.kind === 'drive' || a.homePlaced;
    const estimated = ends.length > 0 && !ends.includes('fixed') && (ends.includes('none') || !homeKnown);
    const latest = leg.kind === 'toHome' ? undefined : a.latestOf(leg.visitId);
    const late = latest !== undefined && leg.end > latest + LATE_EPS;
    return { ...leg, estimated, late };
  });
}

/**
 * 移動の区間に距離（m）を付ける（問題の距離の行列から。自宅の地点は担当の point）。order は担当の訪問IDの並び。
 * 問題・担当・訪問が無ければそのまま
 */
export function withLegMeters(legs: LegSpan[], problem: Problem | null, staffId: string, order: string[]): LegSpan[] {
  if (!problem) return legs;
  const home = problem.staff.find((s) => s.id === staffId)?.point;
  const pointOf = new Map(problem.visits.map((v) => [v.id, v.point]));
  if (home === undefined) return legs;
  const last = order.length > 0 ? pointOf.get(order[order.length - 1]!) : undefined;
  return legs.map((leg) => {
    if (leg.kind === 'wait') return leg;
    const here = pointOf.get(leg.visitId);
    const k = order.indexOf(leg.visitId);
    const prev = k > 0 ? pointOf.get(order[k - 1]!) : undefined;
    const [from, to] = leg.kind === 'fromHome' ? [home, here] : leg.kind === 'drive' ? [prev, here] : [last, home];
    if (from === undefined || to === undefined) return leg;
    return { ...leg, meters: problem.meters[from]?.[to] ?? 0 };
  });
}

/** 距離の文（「3.2km」。1km 未満は「800m」。10 m 単位を四捨五入） */
function distanceText(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(Math.round(meters / 100) / 10).toFixed(1)}km`;
}

/**
 * 区間の言葉：「移動 15分・3.2km」「自宅まで 30分（見込み）」。距離は 0 なら出さない。間に合わない区間は「・着く時刻が間に合わない」を添える
 */
export function legWords(leg: LegSpan, minutes: number): string {
  const word = leg.kind === 'drive' ? '移動 ' : leg.kind === 'fromHome' ? '自宅から ' : '自宅まで ';
  const note = leg.estimated ? '（見込み）' : '';
  const dist = leg.meters ? `・${distanceText(leg.meters)}` : '';
  return `${word}${minutes}分${dist}${note}${leg.late ? '・着く時刻が間に合わない' : ''}`;
}

/**
 * ドラッグ中の影：訪問をその人へ移したら（今の予定の画面と同じ bestInsertion の位置）、strict で回れるか。
 * 位置は訪問の earliest 〜 latest＋所要（始めてよい幅に作業の長さを足した所）。
 * allowed は可否（必須の条件・相性×など。外れる人は ok も false）。訪問・担当が問題に無ければ null
 */
export function shadowOf(
  problem: Problem,
  routes: Record<string, string[]>,
  visitId: string,
  staffId: string,
): (Span & { ok: boolean; allowed: boolean }) | null {
  const v = problem.visits.findIndex((x) => x.id === visitId);
  const s = problem.staff.findIndex((x) => x.id === staffId);
  if (v < 0 || s < 0) return null;
  const pv = problem.visits[v]!;
  const span = { start: pv.earliest, end: Math.max(pv.latest, pv.earliest) + pv.duration };
  const allowed = problem.allowed[v]?.[s] === true;
  if (!allowed) return { ...span, ok: false, allowed };
  const col = own(bestInsertion(problem, routes, visitId, staffId), staffId) ?? [];
  const index = new Map(problem.visits.map((x, i) => [x.id, i]));
  const seq = col.map((id) => index.get(id)).filter((x): x is number => x !== undefined);
  return { ...span, ok: scheduleRoute(problem, s, seq, 'strict') !== null, allowed };
}
