// 合計点の式（solver・evaluate で同じ式・同じ順で足す）
import type { Problem } from '../contracts/problem';
import { DROP_POINTS, KEEP_DROP_POINTS } from '../contracts/rules';
import { chainDropPoints } from './chain';

/** 1人の件数が目安の帯 [lo, hi] から外れた件数 */
export function balanceOff(b: NonNullable<Problem['balance']>, staff: number, count: number): number {
  const lo = b.lo[staff]!;
  const hi = b.hi[staff]!;
  return count < lo ? lo - count : count > hi ? count - hi : 0;
}

/** 件数 count が、必須の負担の均等の件数の上限（balance.cap）を超えるか。上限が無ければ false（reassign・vacancy・naive・solver で同じ） */
export function overCap(b: Problem['balance'], staff: number, count: number): boolean {
  const cap = b?.cap ?? null;
  return cap !== null && count > cap[staff]!;
}

/** スタッフごとの件数から均等の点＝Σ perVisit × 外れた件数²（solver・evaluate で同じ） */
export function balancePoints(problem: Problem, counts: ArrayLike<number>): number {
  const b = problem.balance;
  if (!b) return 0;
  let sq = 0;
  for (let i = 0; i < problem.staff.length; i++) {
    const e = balanceOff(b, i, counts[i] ?? 0);
    sq += e * e;
  }
  return sq * b.perVisit;
}

/** 合計点（solver・evaluate で同じ式・同じ順で足す） */
export function totalPoints(
  problem: Problem,
  parts: { travel: number; wait: number; assign: number; balance: number; chain: number; dropped: number },
): number {
  return (
    parts.travel +
    parts.wait * problem.waitPerMinute +
    parts.assign +
    parts.balance +
    parts.chain +
    parts.dropped * DROP_POINTS
  );
}

/**
 * 訪問 v を落としたときの solver の費用：Problem.stay.keep の訪問（案B の、案A に入っている訪問）は KEEP_DROP_POINTS、
 * ほかは DROP_POINTS（ADR-0011）。採点（totalPoints・evaluate）は常に DROP_POINTS。
 * 続く訪問（problem.chain。ADR-0116）があれば、その訪問の組ごとの半分（chainDropPoints）も足す（採点では parts.chain に入る）
 */
export function dropPointsOf(problem: Problem, v: number): number {
  const base = problem.stay?.keep?.[v] ? KEEP_DROP_POINTS : DROP_POINTS;
  return problem.chain ? base + chainDropPoints(problem.chain, v) : base;
}
