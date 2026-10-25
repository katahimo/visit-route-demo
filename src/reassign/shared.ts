// 振り直しの各段（greedy・candidates・diff・anneal・contacts）が共に使う小さい下請け。
// どれも純粋関数で決定的。DemoData は読まない・書かない
import type { Problem } from '../contracts/problem';
import type { Routes } from '../contracts/reassign';
import { balanceOff, EPS, routeCost, scheduleRoute } from '../matching';

export const INF = Number.POSITIVE_INFINITY;

/** ずらしても変わらない可否の原因（時刻に関わる原因だけはずらすと変わりうる） */
export const TIME_RULES = new Set(['slot', 'time']);

/** 自分のキーだけを読む（スタッフID が constructor などでも組み込みを拾わない） */
export function colOf(routes: Routes, staffId: string): string[] {
  return Object.hasOwn(routes, staffId) ? (routes[staffId] ?? []) : [];
}

export function indexOf(problem: Problem) {
  const vIndex = new Map(problem.visits.map((v, i) => [v.id, i]));
  const sIndex = new Map(problem.staff.map((s, i) => [s.id, i]));
  return { vIndex, sIndex };
}

/** 列の中の、問題にある訪問の添字 */
export function knownOf(col: string[], vIndex: Map<string, number>): number[] {
  const out: number[] = [];
  for (const id of col) {
    const x = vIndex.get(id);
    if (x !== undefined) out.push(x);
  }
  return out;
}

/** 件数 count → count+1 にしたときの負担の均等の点の増分 */
function balanceDelta(problem: Problem, s: number, count: number): number {
  const b = problem.balance;
  if (!b) return 0;
  const a = balanceOff(b, s, count);
  const c = balanceOff(b, s, count + 1);
  return (c * c - a * a) * b.perVisit;
}

export type Fit = { pos: number; addedCost: number; addedTravel: number };

/**
 * 担当 s の列 known に訪問 v を、すでにある訪問の開始時刻を変えずに strict で入れられる位置のうち、
 * 増える費用（移動＋待ち×係数＋割当費用＋負担の均等）が最も少ない位置（同じなら前の位置）。
 * 無ければ null。可否・件数の上限は見ない（呼ぶ側で見る）
 */
export function bestFit(problem: Problem, s: number, known: number[], v: number): Fit | null {
  const old = scheduleRoute(problem, s, known, 'strict');
  if (!old) return null;
  const oldCost = known.length === 0 ? 0 : routeCost(problem, s, known);
  const bal = balanceDelta(problem, s, known.length);
  let best: Fit | null = null;
  for (let p = 0; p <= known.length; p++) {
    const seq = [...known.slice(0, p), v, ...known.slice(p)];
    const t = scheduleRoute(problem, s, seq, 'strict');
    if (!t) continue;
    let same = true;
    for (let k = 0; k < known.length && same; k++) {
      const before = old.stops[k]!.start;
      const after = t.stops[k < p ? k : k + 1]!.start;
      if (Math.abs(before - after) > EPS) same = false;
    }
    if (!same) continue;
    const added = routeCost(problem, s, seq) - oldCost + bal;
    if (!Number.isFinite(added)) continue;
    if (best === null || added < best.addedCost - EPS) {
      best = { pos: p, addedCost: added, addedTravel: t.travelMinutes - old.travelMinutes };
    }
  }
  return best;
}

/** 列 col の、問題にある訪問の pos 番目の直前（最後なら列の最後）に visitId を入れた列 */
export function insertAt(col: string[], vIndex: Map<string, number>, pos: number, visitId: string): string[] {
  let seen = 0;
  for (let k = 0; k < col.length; k++) {
    if (!vIndex.has(col[k]!)) continue;
    if (seen === pos) return [...col.slice(0, k), visitId, ...col.slice(k)];
    seen++;
  }
  return [...col, visitId];
}

/** routes を写し、visitId をどの列からも抜く */
export function without(routes: Routes, visitId: string): Routes {
  const out: Routes = {};
  for (const [k, ids] of Object.entries(routes)) out[k] = ids.filter((id) => id !== visitId);
  return out;
}
