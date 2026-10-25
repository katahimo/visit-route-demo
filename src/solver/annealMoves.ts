// 焼きなましの近傍（移す・入れ替える・列の中で動かす・未割当を入れる・外す）。
// それぞれ差分を返し、apply で採る。乱数を引く回数と順番は元の createSolver のまま
import { routeCost } from '../matching/timing';
import {
  type AnnealState,
  addUnassigned,
  balDelta,
  bestInsert,
  INF,
  isAllowed,
  putAt,
  removeUnassigned,
  roomFor,
  setRoute,
  without,
} from './annealState';

/** 近傍の手：差分 d と、採るときの apply（作れなければ null） */
export type Move = { d: number; apply: () => void } | null;

/** v を担当 b の最良位置へ移す（b が同じなら列の中で最良位置へ） */
export function relocate(st: AnnealState, v: number, b: number): Move {
  const { routes, cost, bufA } = st;
  const a = st.routeOf[v]!;
  const ra = routes[a]!;
  const idx = ra.indexOf(v);
  const lenA = without(ra, ra.length, idx, bufA);
  if (a === b) {
    const c = bestInsert(st, a, v, bufA, lenA);
    if (c === INF) return null;
    const pos = st.lastPos;
    return { d: c - cost[a]!, apply: () => putAt(st, a, bufA, lenA, v, pos, c) };
  }
  if (!roomFor(st, b)) return null;
  const cA = lenA === 0 ? 0 : routeCost(st.problem, a, bufA, lenA);
  if (cA === INF) return null;
  const rb = routes[b]!;
  const cB = bestInsert(st, b, v, rb, rb.length);
  if (cB === INF) return null;
  const pos = st.lastPos;
  const d = cA - cost[a]! + cB - cost[b]! + balDelta(st, a, -1, b, 1);
  return {
    d,
    apply: () => {
      setRoute(st, a, bufA, lenA, cA);
      putAt(st, b, rb, rb.length, v, pos, cB);
    },
  };
}

/** 2訪問の担当を入れ替える（それぞれ相手の列の最良位置へ） */
export function swap(st: AnnealState, v1: number, v2: number): Move {
  const { routes, cost, bufA, bufC } = st;
  const a = st.routeOf[v1]!;
  const b = st.routeOf[v2]!;
  if (a === b || a < 0 || b < 0 || !isAllowed(st, v1, b) || !isAllowed(st, v2, a)) return null;
  const ra = routes[a]!;
  const rb = routes[b]!;
  const lenA = without(ra, ra.length, ra.indexOf(v1), bufA);
  const lenB = without(rb, rb.length, rb.indexOf(v2), bufC);
  const cA = bestInsert(st, a, v2, bufA, lenA);
  if (cA === INF) return null;
  const posA = st.lastPos;
  const cB = bestInsert(st, b, v1, bufC, lenB);
  if (cB === INF) return null;
  const posB = st.lastPos;
  return {
    d: cA - cost[a]! + cB - cost[b]!,
    apply: () => {
      putAt(st, a, bufA, lenA, v2, posA, cA);
      putAt(st, b, bufC, lenB, v1, posB, cB);
    },
  };
}

/** 同じ列の中で i 番目を j 番目へ */
export function shift(st: AnnealState, s: number, i: number, j: number): Move {
  const { bufA, bufB } = st;
  const r = st.routes[s]!;
  const len = r.length;
  const lenA = without(r, len, i, bufA);
  const v = r[i]!;
  for (let k = 0; k < j; k++) bufB[k] = bufA[k]!;
  bufB[j] = v;
  for (let k = j; k < lenA; k++) bufB[k + 1] = bufA[k]!;
  const c = routeCost(st.problem, s, bufB, len);
  if (c === INF) return null;
  return { d: c - st.cost[s]!, apply: () => setRoute(st, s, bufB, len, c) };
}

/**
 * 未割当の v を b の最良位置に入れる（allowEject なら、入らないとき・件数の上限のとき b の1件と入れ替える。
 * 入れ替えは件数が変わらないので上限を超えない）
 */
export function insert(st: AnnealState, v: number, b: number, allowEject: boolean): Move {
  const { cost, dropCost } = st;
  const rb = st.routes[b]!;
  const len = rb.length;
  const room = roomFor(st, b);
  const c = room ? bestInsert(st, b, v, rb, len) : INF;
  if (c !== INF) {
    const pos = st.lastPos;
    return {
      d: c - cost[b]! - dropCost[v]! + balDelta(st, b, 1, -1, 0),
      apply: () => {
        removeUnassigned(st, v);
        putAt(st, b, rb, len, v, pos, c);
      },
    };
  }
  if (!allowEject || len === 0) return null;
  return ejectInsert(st, v, b, rb, len);
}

/** 入らなければ、b の列から乱数で選んだ1件を外して入れてみる（外した方は未割当へ） */
function ejectInsert(st: AnnealState, v: number, b: number, rb: number[], len: number): Move {
  const { cost, dropCost, bufA } = st;
  const bestK = (st.rand() * len) | 0;
  const lenA0 = without(rb, len, bestK, bufA);
  const best = bestInsert(st, b, v, bufA, lenA0);
  const bestPos = st.lastPos;
  if (best === INF) return null;
  const w = rb[bestK]!;
  return {
    // 入れ替えは件数が変わらない（均等の点は同じ）。未割当の数も同じだが、落とした点は v と w で違いうる（keep）
    d: best - cost[b]! - dropCost[v]! + dropCost[w]!,
    apply: () => {
      const lenA = without(rb, len, bestK, bufA);
      removeUnassigned(st, v);
      putAt(st, b, bufA, lenA, v, bestPos, best);
      addUnassigned(st, w);
    },
  };
}

/** 入っている v を外す */
export function drop(st: AnnealState, v: number): Move {
  const { bufA } = st;
  const a = st.routeOf[v]!;
  const ra = st.routes[a]!;
  const lenA = without(ra, ra.length, ra.indexOf(v), bufA);
  const cA = lenA === 0 ? 0 : routeCost(st.problem, a, bufA, lenA);
  if (cA === INF) return null;
  return {
    d: cA - st.cost[a]! + st.dropCost[v]! + balDelta(st, a, -1, -1, 0),
    apply: () => {
      setRoute(st, a, bufA, lenA, cA);
      addUnassigned(st, v);
    },
  };
}

function pick<T>(st: AnnealState, xs: readonly T[]): T {
  return xs[(st.rand() * xs.length) | 0]!;
}

/** 入っている訪問を1つ（無ければ -1） */
function pickAssigned(st: AnnealState): number {
  const V = st.V;
  if (st.unassigned.length === V) return -1;
  for (;;) {
    const v = (st.rand() * V) | 0;
    if (st.routeOf[v]! >= 0) return v;
  }
}

/** 乱数で近傍を1つ作る（作れなければ null） */
export function randomMove(st: AnnealState): Move {
  const r = st.rand();
  if (st.unassigned.length > 0 && r < 0.15) {
    const v = pick(st, st.unassigned);
    const cand = st.allowedStaff[v]!;
    if (cand.length === 0) return null;
    return insert(st, v, pick(st, cand), true);
  }
  const v = pickAssigned(st);
  if (v < 0) return null;
  const a = st.routeOf[v]!;
  if (r < 0.5) {
    const cand = st.allowedStaff[v]!;
    const b = pick(st, cand);
    return relocate(st, v, b);
  }
  if (r < 0.75) {
    const b = pick(st, st.allowedStaff[v]!);
    if (b === a || st.routes[b]!.length === 0) return null;
    return swap(st, v, pick(st, st.routes[b]!));
  }
  if (r < 0.995) {
    const route = st.routes[a]!;
    if (route.length < 2) return null;
    const i = route.indexOf(v);
    let j = (st.rand() * (route.length - 1)) | 0;
    if (j >= i) j++;
    return shift(st, a, i, j);
  }
  return drop(st, v);
}
