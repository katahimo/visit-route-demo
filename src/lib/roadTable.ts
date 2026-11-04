/**
 * 道路の所要の表を OSRM（OpenStreetMap の道路・車）から取る（PRD D436。ADR-0101）。OSRM を呼ぶ**ただ1か所**。
 * 呼ぶのは管理者設定の「道路の移動時間」のカードと登録の案内の③で、利用者がボタンを押したときだけ。送るのは地点の緯度・経度だけ（名前・住所は送らない）。
 * solver・matching・evaluate・seed・patterns・vacancy・reassign・excel・store からは呼ばない。
 *
 * - Table API（1回で地点 × 地点の所要と道のり）。1回に送る地点は ROAD_REQUEST_POINTS まで（公開サーバーの上限。101 で TooBig）。
 *   超えたら 50 地点ずつの区画（出発 × 到着）に分けて順に送る。全組を取り、地点ごとに近い順に ROAD_NEAR_K 件だけ残す
 * - 公開サーバーの決まり（1秒に1回まで）に合わせ、2回目からは ROAD_REQUEST_GAP_MS あけて送る
 * 応答の形が違っていても落とさず badResponse で返す。テストは fetch の偽物で行う。
 */

import type { DemoData } from '../contracts/data';
import { type LatLng, ROAD_NEAR_K, ROAD_POINTS_MAX, type RoadTable } from '../contracts/documents';
import { roadPointKey } from '../matching';

const OSRM_TABLE_URL = 'https://router.project-osrm.org/table/v1/driving/';
/** 1回の問い合わせに送る地点の上限（出発の区画 ＋ 到着の区画） */
export const ROAD_REQUEST_POINTS = 100;
/** 問い合わせの間（ミリ秒。公開サーバーは1秒に1回まで） */
export const ROAD_REQUEST_GAP_MS = 1100;
/** 1回の問い合わせの時間切れ（ミリ秒） */
export const ROAD_TIMEOUT_MS = 20000;

export type RoadFail = 'tooMany' | 'empty' | 'timeout' | 'network' | 'badResponse' | 'aborted';
export type RoadResult = { ok: true; table: RoadTable } | { ok: false; reason: RoadFail };
export type RoadFetchFn = (
  url: string,
  init: { signal: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
export type RoadOptions = {
  fetch?: RoadFetchFn;
  /** 問い合わせの間の待ち（テストでは待たない偽物） */
  sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** 何回目まで済んだか（画面の「取得中 2/4」） */
  onProgress?: (done: number, total: number) => void;
  /** 取った時刻（ms。既定は Date.now()） */
  now?: number;
};

/** 失敗の文（画面に出す） */
export const ROAD_FAIL_TEXT: Record<RoadFail, string> = {
  tooMany: `地点が${ROAD_POINTS_MAX}を超えるため取れません`,
  empty: '位置の登録された自宅・訪問先がありません',
  timeout: '道路の地図のサーバーが時間内に応えませんでした。時間をおいて押し直してください',
  network: '道路の地図のサーバーにつながりませんでした。通信を確かめて押し直してください',
  badResponse: '道路の地図のサーバーの応答を読めませんでした。時間をおいて押し直してください',
  aborted: '取るのを止めました',
};

/**
 * 表に入れる地点：位置のある〈スタッフ〉の自宅と、位置があり移動時間を手で決めていない〈利用者さん〉の場所（ADR-0096 の手で決めた人は表を使わない）。
 * 位置（小数5桁）が同じものは1つ。並びは自宅 → 〈利用者さん〉の順
 */
export function roadPointsOf(data: Pick<DemoData, 'staff' | 'clients'>): LatLng[] {
  const out = new Map<string, LatLng>();
  const add = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) return;
    const p = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
    const k = roadPointKey(p);
    if (!out.has(k)) out.set(k, p);
  };
  for (const s of data.staff) add(s.home.lat, s.home.lng);
  for (const c of data.clients) if (c.place.travelMinutes === undefined) add(c.place.lat, c.place.lng);
  return [...out.values()];
}

/** 表に無い地点の数（位置を足した・動かした地点。押し直すと入る） */
export function roadMissingCount(table: RoadTable | undefined, points: readonly LatLng[]): number {
  const have = new Set((table?.points ?? []).map(roadPointKey));
  return points.filter((p) => !have.has(roadPointKey(p))).length;
}

/** 地点を size ずつの区画に分ける（出発の区画 × 到着の区画で問い合わせる） */
export function roadBlocks(count: number, size: number): number[][] {
  const blocks: number[][] = [];
  for (let i = 0; i < count; i += size) blocks.push(Array.from({ length: Math.min(size, count - i) }, (_, k) => i + k));
  return blocks;
}

/** 1回の問い合わせの URL（座標は 経度,緯度 の順。sources・destinations は送った座標の並びの番号） */
export function roadTableUrl(
  points: readonly LatLng[],
  sources: readonly number[],
  destinations: readonly number[],
): string {
  const coords = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  return `${OSRM_TABLE_URL}${coords}?sources=${sources.join(';')}&destinations=${destinations.join(';')}&annotations=duration,distance`;
}

/** 応答の行列（durations・distances）を読む。形が違えば null */
function readMatrix(v: unknown, rows: number, cols: number): (number | null)[][] | null {
  if (!Array.isArray(v) || v.length !== rows) return null;
  const out: (number | null)[][] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== cols) return null;
    out.push(row.map((x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null)));
  }
  return out;
}

class RoadError extends Error {
  constructor(readonly reason: RoadFail) {
    super(reason);
  }
}

/** 1回の問い合わせ（出発の区画 × 到着の区画）。所要（秒）・道のり（m）の行列を返す */
async function requestBlock(
  points: readonly LatLng[],
  from: readonly number[],
  to: readonly number[],
  opts: RoadOptions,
): Promise<{ seconds: (number | null)[][]; meters: (number | null)[][] }> {
  // 送る座標：出発の区画と、出発に無い到着の区画（同じ区画なら1回だけ）
  const sent = [...new Set([...from, ...to])];
  const pos = new Map(sent.map((p, i) => [p, i]));
  const url = roadTableUrl(
    sent.map((i) => points[i]!),
    from.map((i) => pos.get(i)!),
    to.map((i) => pos.get(i)!),
  );
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? ROAD_TIMEOUT_MS);
  try {
    const f = opts.fetch ?? (globalThis.fetch as unknown as RoadFetchFn);
    let res: Awaited<ReturnType<RoadFetchFn>>;
    try {
      res = await f(url, { signal: ctrl.signal });
    } catch {
      throw new RoadError(opts.signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'network');
    }
    if (!res.ok) throw new RoadError('badResponse');
    const body = (await res.json().catch(() => null)) as {
      code?: unknown;
      durations?: unknown;
      distances?: unknown;
    } | null;
    if (!body || body.code !== 'Ok') throw new RoadError('badResponse');
    const seconds = readMatrix(body.durations, from.length, to.length);
    const meters = readMatrix(body.distances, from.length, to.length);
    if (!seconds || !meters) throw new RoadError('badResponse');
    return { seconds, meters };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/** 区画の大きさ：100地点までは1区画（1回で全組）、超えたら出発 ＋ 到着が上限に収まる半分ずつ */
function blockSize(count: number): number {
  return count <= ROAD_REQUEST_POINTS ? ROAD_REQUEST_POINTS : ROAD_REQUEST_POINTS / 2;
}

/** 問い合わせの回数（区画の数の2乗） */
export function roadRequestCount(count: number): number {
  if (count === 0) return 0;
  const b = Math.ceil(count / blockSize(count));
  return b * b;
}

/** 1回の問い合わせの応答の目安（ミリ秒。100地点で約1.1秒だった） */
export const ROAD_RESPONSE_MS = 1000;

/** 取り終えるまでの目安（秒）：回数 ×（応答 ＋ 間）− 最後の間 */
export function roadEstimateSeconds(count: number): number {
  const n = roadRequestCount(count);
  return n === 0 ? 0 : Math.ceil((n * (ROAD_RESPONSE_MS + ROAD_REQUEST_GAP_MS) - ROAD_REQUEST_GAP_MS) / 1000);
}

/**
 * 1つの出発の地点の行（全部の行き先の所要・道のり）から、所要の近い順に ROAD_NEAR_K 件を残す（自分自身と道の無い組は除く）。
 * 秒は整数、道のりは 10 m 単位に丸める
 */
export function nearestOf(
  from: number,
  seconds: readonly (number | null)[],
  meters: readonly (number | null)[],
): { near: number[]; seconds: number[]; meters: number[] } {
  const ok: number[] = [];
  seconds.forEach((s, j) => {
    if (j !== from && s !== null && meters[j] !== null) ok.push(j);
  });
  ok.sort((a, b) => seconds[a]! - seconds[b]! || a - b);
  const near = ok.slice(0, ROAD_NEAR_K);
  return {
    near,
    seconds: near.map((j) => Math.round(seconds[j]!)),
    meters: near.map((j) => Math.round(meters[j]! / 10) * 10),
  };
}

/**
 * 地点 × 地点の所要と道のりを取り、地点ごとに近い順に ROAD_NEAR_K 件を残す。地点が無い・上限を超えるときは送らない。
 * 出発の区画ごとに全部の到着の区画を取り終えたら、その区画の行を絞る（全組を一度に持たない）。
 * 1回でも失敗したら表を返さない（途中までの表は保存しない）
 */
export async function fetchRoadTable(points: readonly LatLng[], opts: RoadOptions = {}): Promise<RoadResult> {
  if (points.length === 0) return { ok: false, reason: 'empty' };
  if (points.length > ROAD_POINTS_MAX) return { ok: false, reason: 'tooMany' };
  const n = points.length;
  const blocks = roadBlocks(n, blockSize(n));
  const total = blocks.length * blocks.length;
  const table: RoadTable = { at: opts.now ?? Date.now(), points: [...points], near: [], seconds: [], meters: [] };
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let done = 0;
  try {
    for (const from of blocks) {
      const rowS = from.map(() => new Array<number | null>(n).fill(null));
      const rowM = from.map(() => new Array<number | null>(n).fill(null));
      for (const to of blocks) {
        if (opts.signal?.aborted) return { ok: false, reason: 'aborted' };
        if (done > 0) await sleep(ROAD_REQUEST_GAP_MS);
        const got = await requestBlock(points, from, to, opts);
        from.forEach((_, a) => {
          to.forEach((j, b) => {
            rowS[a]![j] = got.seconds[a]![b]!;
            rowM[a]![j] = got.meters[a]![b]!;
          });
        });
        done++;
        opts.onProgress?.(done, total);
      }
      from.forEach((i, a) => {
        const kept = nearestOf(i, rowS[a]!, rowM[a]!);
        table.near[i] = kept.near;
        table.seconds[i] = kept.seconds;
        table.meters[i] = kept.meters;
      });
    }
  } catch (e) {
    if (e instanceof RoadError) return { ok: false, reason: e.reason };
    throw e;
  }
  return { ok: true, table };
}
