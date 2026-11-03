// 焼きなましの状態（列・費用・未割当・件数・作業領域）と、それを直す小さな操作。
// createSolver が共有する状態を1つのオブジェクトにまとめたもの
import type { Problem } from '../contracts/problem';
import { balanceOff, balancePoints, dropPointsOf, overCap } from '../matching/cost';
import { routeCost } from '../matching/timing';

export const INF = Number.POSITIVE_INFINITY;

/** 焼きなましの状態。hot path で形が変わらないよう、作るときに全部の欄を入れる */
export interface AnnealState {
  readonly problem: Problem;
  /** seed 付きの乱数。引く回数と順番が結果を決める */
  readonly rand: () => number;
  readonly S: number;
  readonly V: number;
  /** 訪問ごとの可の担当 */
  readonly allowedStaff: number[][];
  /** 訪問ごとの落とした点（案B の keep の訪問は KEEP_DROP_POINTS。ほかは DROP_POINTS） */
  readonly dropCost: Float64Array;
  readonly bal: Problem['balance'];
  // --- 状態 ---
  readonly routes: number[][];
  readonly cost: Float64Array;
  readonly routeOf: Int32Array;
  readonly unassigned: number[];
  readonly unPos: Int32Array;
  readonly counts: Int32Array;
  /** 今の合計点 */
  current: number;
  /** bestInsert が選んだ位置 */
  lastPos: number;
  // --- 差分評価用の作業領域 ---
  readonly bufA: Int32Array;
  readonly bufB: Int32Array;
  readonly bufC: Int32Array;
  readonly bufD: Int32Array;
}

export function createAnnealState(problem: Problem, rand: () => number): AnnealState {
  const S = problem.staff.length;
  const V = problem.visits.length;
  const allowedStaff: number[][] = problem.visits.map((_, v) => {
    const out: number[] = [];
    for (let s = 0; s < S; s++) if (problem.allowed[v]![s]) out.push(s);
    return out;
  });
  return {
    problem,
    rand,
    S,
    V,
    allowedStaff,
    dropCost: Float64Array.from({ length: V }, (_, v) => dropPointsOf(problem, v)),
    bal: problem.balance,
    routes: problem.staff.map(() => []),
    cost: new Float64Array(S),
    routeOf: new Int32Array(V).fill(-1),
    unassigned: [],
    unPos: new Int32Array(V).fill(-1),
    counts: new Int32Array(S),
    current: 0,
    lastPos: -1,
    bufA: new Int32Array(V + 1),
    bufB: new Int32Array(V + 1),
    bufC: new Int32Array(V + 1),
    bufD: new Int32Array(V + 1),
  };
}

/** 訪問 v を担当 s に回してよいか */
export function isAllowed(st: AnnealState, v: number, s: number): boolean {
  return st.problem.allowed[v]![s] === true;
}

/** s の件数を1つ増やしても上限（必須の均等）を超えないか */
export function roomFor(st: AnnealState, s: number): boolean {
  return !overCap(st.bal, s, st.counts[s]! + 1);
}

/** 件数 c のときの均等の外れの2乗 */
function balSq(bal: NonNullable<Problem['balance']>, s: number, c: number): number {
  const e = balanceOff(bal, s, c);
  return e * e;
}

/** 件数を a: da, b: db だけ変えたときの均等の点の差（外れた件数の2乗） */
export function balDelta(st: AnnealState, a: number, da: number, b: number, db: number): number {
  const bal = st.bal;
  if (!bal) return 0;
  const counts = st.counts;
  let d = 0;
  if (a >= 0) d += balSq(bal, a, counts[a]! + da) - balSq(bal, a, counts[a]!);
  if (b >= 0 && b !== a) d += balSq(bal, b, counts[b]! + db) - balSq(bal, b, counts[b]!);
  else if (b >= 0 && b === a) d += balSq(bal, a, counts[a]! + da + db) - balSq(bal, a, counts[a]! + da);
  return d * bal.perVisit;
}

/** route の idx 番目を除いた列を out に写す。長さを返す */
export function without(route: ArrayLike<number>, len: number, idx: number, out: Int32Array): number {
  let k = 0;
  for (let i = 0; i < len; i++) if (i !== idx) out[k++] = route[i]!;
  return k;
}

/** base（長さ len）に v を入れる最良の位置の費用。位置は st.lastPos */
export function bestInsert(st: AnnealState, s: number, v: number, base: ArrayLike<number>, len: number): number {
  const problem = st.problem;
  const bufD = st.bufD;
  let best = INF;
  let pos = -1;
  st.lastPos = -1;
  for (let p = 0; p <= len; p++) {
    for (let i = 0; i < p; i++) bufD[i] = base[i]!;
    bufD[p] = v;
    for (let i = p; i < len; i++) bufD[i + 1] = base[i]!;
    const c = routeCost(problem, s, bufD, len + 1);
    if (c < best) {
      best = c;
      pos = p;
    }
  }
  st.lastPos = pos;
  return best;
}

export function addUnassigned(st: AnnealState, v: number): void {
  st.unPos[v] = st.unassigned.length;
  st.unassigned.push(v);
  st.routeOf[v] = -1;
}

export function removeUnassigned(st: AnnealState, v: number): void {
  const unassigned = st.unassigned;
  const i = st.unPos[v]!;
  const last = unassigned.pop()!;
  if (last !== v) {
    unassigned[i] = last;
    st.unPos[last] = i;
  }
  st.unPos[v] = -1;
}

export function setRoute(st: AnnealState, s: number, seq: ArrayLike<number>, len: number, c: number): void {
  const r: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    r[i] = seq[i]!;
    st.routeOf[seq[i]!] = s;
  }
  st.routes[s] = r;
  st.cost[s] = c;
  st.counts[s] = len;
}

/** v を s の pos に入れた列を作って置く */
export function putAt(
  st: AnnealState,
  s: number,
  base: ArrayLike<number>,
  len: number,
  v: number,
  pos: number,
  c: number,
): void {
  const bufD = st.bufD;
  for (let i = 0; i < pos; i++) bufD[i] = base[i]!;
  bufD[pos] = v;
  for (let i = pos; i < len; i++) bufD[i + 1] = base[i]!;
  setRoute(st, s, bufD, len + 1, c);
}

/** 合計点を状態から数え直す */
export function recomputeTotal(st: AnnealState): number {
  let t = 0;
  for (let s = 0; s < st.S; s++) t += st.cost[s]!;
  let dropped = 0;
  for (const v of st.unassigned) dropped += st.dropCost[v]!;
  return t + balancePoints(st.problem, st.counts) + dropped;
}

/** 列（staff 添字ごとの訪問添字）を今の状態にする */
export function loadRoutes(st: AnnealState, rs: number[][]): void {
  for (const v of st.unassigned.slice()) removeUnassigned(st, v);
  st.routeOf.fill(-1);
  for (let s = 0; s < st.S; s++) {
    const r = rs[s]!;
    setRoute(st, s, r, r.length, routeCost(st.problem, s, r));
  }
  for (let v = 0; v < st.V; v++) if (st.routeOf[v]! < 0) addUnassigned(st, v);
  st.current = recomputeTotal(st);
}

/** 今の列の写し */
export function copyRoutes(st: AnnealState): number[][] {
  return st.routes.map((r) => r.slice());
}
