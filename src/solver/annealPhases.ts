// 焼きなましの段（初期解・初期温度・受理判定・最後の仕上げ・結果の組み立て）。計算の順は元の createSolver のまま
import type { Problem, SolveResult } from '../contracts/problem';
import { DROP_POINTS } from '../contracts/rules';
import { balancePoints, overCap, totalPoints } from '../matching/cost';
import { naiveSeqs } from '../matching/naive';
import { EPS, routeCost, scheduleRoute } from '../matching/timing';
import { insert, randomMove, relocate, swap } from './annealMoves';
import { type AnnealState, addUnassigned, copyRoutes, INF, loadRoutes, recomputeTotal } from './annealState';

/** 仕上げの繰り返しの上限 */
const POLISH_PASSES = 10;

/** 初期解：候補の少ない訪問から、開始が早い順に、最良の担当・位置へ。素朴な案・初期解の候補の方が良ければそれ */
export function buildInitial(st: AnnealState, initial: Record<string, string[]> | undefined): void {
  greedyInitial(st);
  st.current = recomputeTotal(st);
  const { problem, S, V } = st;
  // 素朴な案の方が良ければ、そこから始める（AI の提案の費用 ≤ 素朴な案。決定的）
  if (V > 0 && S > 0) {
    const greedy = copyRoutes(st);
    const greedyTotal = st.current;
    loadRoutes(st, naiveSeqs(problem));
    if (!(st.current < greedyTotal - EPS)) loadRoutes(st, greedy);
    // 初期解の候補（案B の案A。ADR-0011）：今の初期解より費用が高くなければ、そこから始める（結果の費用 ≤ 候補）
    const given = initial ? initialSeqs(problem, initial) : null;
    if (given) {
      const chosen = copyRoutes(st);
      const chosenTotal = st.current;
      loadRoutes(st, given);
      if (st.current > chosenTotal + EPS) loadRoutes(st, chosen);
    }
  }
}

/** 貪欲な初期解（合計点は数え直さない） */
function greedyInitial(st: AnnealState): void {
  const { problem, allowedStaff, V } = st;
  const order = Array.from({ length: V }, (_, v) => v).sort(
    (x, y) =>
      allowedStaff[x]!.length - allowedStaff[y]!.length ||
      problem.visits[x]!.earliest - problem.visits[y]!.earliest ||
      x - y,
  );
  for (const v of order) addUnassigned(st, v);
  for (const v of order) {
    let bb = -1;
    let bd = INF;
    for (const b of allowedStaff[v]!) {
      const m = insert(st, v, b, false);
      if (m && m.d < bd - EPS) {
        bd = m.d;
        bb = b;
      }
    }
    // apply は作業領域を使うので、最良の担当で作り直してから採る
    if (bb >= 0) insert(st, v, bb, false)!.apply();
  }
}

/**
 * 初期解の候補（staffId → 訪問ID）を staff 添字ごとの列にする。問題に無い人・訪問・2回目に出た訪問は除く。
 * 可でない組・strict で回れない列・件数の上限を超える列があれば null（候補にしない）
 */
function initialSeqs(problem: Problem, given: Record<string, string[]>): number[][] | null {
  const vIndex = new Map(problem.visits.map((v, i) => [v.id, i]));
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let s = 0; s < problem.staff.length; s++) {
    const id = problem.staff[s]!.id;
    const list = Object.hasOwn(given, id) ? (given[id] ?? []) : [];
    const seq: number[] = [];
    for (const vid of list) {
      const v = vIndex.get(vid);
      if (v === undefined || seen.has(v)) continue;
      if (!problem.allowed[v]![s]) return null;
      seen.add(v);
      seq.push(v);
    }
    if (overCap(problem.balance, s, seq.length)) return null;
    if (seq.length > 0 && routeCost(problem, s, seq) === INF) return null;
    out.push(seq);
  }
  return out;
}

/** 初期温度：ランダムな近傍の改悪幅の中央値（乱数で近傍を 300 回作る） */
export function initialTemperature(st: AnnealState): number {
  const samples: number[] = [];
  for (let k = 0; k < 300 && st.V > 0; k++) {
    const m = randomMove(st);
    if (m && m.d > EPS && m.d < DROP_POINTS / 2) samples.push(m.d);
  }
  samples.sort((x, y) => x - y);
  return Math.max(samples[samples.length >> 1] ?? 1, 0.5);
}

/** 指数冷却の率（total 回で T0 から T0×1e-3 へ） */
export function coolingRate(T0: number, total: number): number {
  const Tend = T0 * 1e-3;
  return total > 0 ? (Tend / T0) ** (1 / total) : 1;
}

/** 受理判定（改悪は exp(-d/T) で採る。改善・同点のときは乱数を引かない） */
export function accepts(st: AnnealState, d: number, T: number): boolean {
  return d <= 0 || st.rand() < Math.exp(-d / T);
}

/** 最良解（bestRoutes）に戻して貪欲に仕上げる（よくなる手だけを採る）。終わったあと st.current は数え直した合計点 */
export function polish(st: AnnealState, bestRoutes: number[][]): void {
  loadRoutes(st, bestRoutes);
  for (let pass = 0, improved = true; improved && pass < POLISH_PASSES; pass++) {
    improved = polishMoves(st);
    if (polishSwaps(st)) improved = true;
  }
  st.current = recomputeTotal(st);
}

/** 仕上げの1回目の半分：未割当は入る先へ、入っている訪問はよくなる先へ移す。採ったら true */
function polishMoves(st: AnnealState): boolean {
  let improved = false;
  for (let v = 0; v < st.V; v++) {
    const cand = st.allowedStaff[v]!;
    if (st.routeOf[v]! < 0) {
      for (const b of cand) {
        const m = insert(st, v, b, false);
        if (m && m.d < -EPS) {
          m.apply();
          st.current += m.d;
          improved = true;
          break;
        }
      }
      continue;
    }
    for (const b of cand) {
      const m = relocate(st, v, b);
      if (m && m.d < -EPS) {
        m.apply();
        st.current += m.d;
        improved = true;
      }
    }
  }
  return improved;
}

/** 仕上げの後ろの半分：担当の違う2訪問の入れ替えでよくなるものを採る。採ったら true */
function polishSwaps(st: AnnealState): boolean {
  const { routeOf, V } = st;
  let improved = false;
  for (let v1 = 0; v1 < V; v1++) {
    if (routeOf[v1]! < 0) continue;
    for (let v2 = v1 + 1; v2 < V; v2++) {
      if (routeOf[v2]! < 0 || routeOf[v1] === routeOf[v2]) continue;
      const m = swap(st, v1, v2);
      if (m && m.d < -EPS) {
        m.apply();
        st.current += m.d;
        improved = true;
      }
    }
  }
  return improved;
}

/** 最良解の列から結果を作る。evaluate.score と同じ式・同じ順で点を出し直す */
export function resultOf(
  problem: Problem,
  bestRoutes: number[][],
  seed: number,
  iterations: number,
  stopped: boolean,
): SolveResult {
  const S = problem.staff.length;
  const V = problem.visits.length;
  let travel = 0;
  let wait = 0;
  let assign = 0;
  const bc = new Int32Array(S);
  const out: Record<string, string[]> = {};
  const placed = new Uint8Array(V);
  for (let s = 0; s < S; s++) {
    const r = bestRoutes[s]!;
    const t = scheduleRoute(problem, s, r, 'lenient')!;
    travel += t.travelMinutes;
    wait += t.waitMinutes;
    for (const v of r) {
      assign += problem.assignCost[v]![s]!;
      placed[v] = 1;
    }
    bc[s] = r.length;
    out[problem.staff[s]!.id] = r.map((v) => problem.visits[v]!.id);
  }
  const un: string[] = [];
  for (let v = 0; v < V; v++) if (!placed[v]) un.push(problem.visits[v]!.id);
  const score = totalPoints(problem, {
    travel,
    wait,
    assign,
    balance: balancePoints(problem, bc),
    dropped: un.length,
  });
  return { routes: out, unassigned: un, score, seed, iterations, stopped };
}
