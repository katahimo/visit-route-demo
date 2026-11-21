// 続く訪問（同じ〈利用者さん〉の同じ日の続く訪問を同じ人に。条件 sameClient。ADR-0116）の組と点。
// solver（routeCost・dropPointsOf）と evaluate（score）で同じ式を使う
import type { Problem, ProblemChain, ProblemVisit } from '../contracts/problem';
import { POINTS_PER_WEIGHT, type Rule, SAME_CLIENT_GAP_MAX } from '../contracts/rules';

/**
 * 続く訪問の組（ADR-0116）。訪問 v ごとに、同じ〈利用者さん〉の訪問のうち、v の終わり（earliest＋duration）から
 * 0〜SAME_CLIENT_GAP_MAX 分あとに始まる（earliest）いちばん早いもの（同じなら先の添字）を next[v] にする。
 * 重なる訪問（2人で入るなど）は組にしない。同行の組の訪問（companion。ADR-0120）も組にしない（2人のどちらが続けても同じなので、
 * 片方だけ数えると点が残る）。条件の重みの和が0・組が1つも無ければ null（今までと同じ問題）
 */
export function chainOf(visits: readonly ProblemVisit[], rules: readonly Rule[]): ProblemChain | null {
  const weight = rules.filter((r) => r.type === 'sameClient').reduce((a, r) => a + r.weight, 0);
  if (!(weight > 0)) return null;
  const V = visits.length;
  const next = new Array<number>(V).fill(-1);
  const degree = new Array<number>(V).fill(0);
  let pairs = 0;
  for (let v = 0; v < V; v++) {
    const a = visits[v]!;
    if (a.companion) continue;
    const end = a.earliest + a.duration;
    let best = -1;
    for (let u = 0; u < V; u++) {
      const b = visits[u]!;
      if (u === v || b.clientId !== a.clientId || b.companion) continue;
      const gap = b.earliest - end;
      if (gap < 0 || gap > SAME_CLIENT_GAP_MAX) continue;
      if (best < 0 || b.earliest < visits[best]!.earliest) best = u;
    }
    if (best < 0) continue;
    next[v] = best;
    degree[v]!++;
    degree[best]!++;
    pairs++;
  }
  return pairs > 0 ? { next, degree, perPair: weight * POINTS_PER_WEIGHT } : null;
}

/**
 * 1人の列（先頭から length）の続く訪問の点：列の訪問ごとに 組の数×perPair/2、列で v のすぐあとに next[v] がある組
 * （続けて回る）ごとに perPair を引く（その組の半分2つが消える）。担当なしの訪問の半分は chainDropPoints
 */
export function chainRoutePoints(chain: ProblemChain, visits: ArrayLike<number>, length = visits.length): number {
  let degree = 0;
  let kept = 0;
  for (let k = 0; k < length; k++) {
    const v = visits[k]!;
    degree += chain.degree[v]!;
    if (k > 0 && chain.next[visits[k - 1]!] === v) kept++;
  }
  return (degree * chain.perPair) / 2 - kept * chain.perPair;
}

/** 担当なしの訪問 v の続く訪問の点（組ごとに半分） */
export function chainDropPoints(chain: ProblemChain, v: number): number {
  return (chain.degree[v]! * chain.perPair) / 2;
}

/**
 * 案（staff 添字ごとの訪問の列）の続く訪問の点と組の数：同じ人が続けて回らない組の数 × perPair。
 * 列ごとの chainRoutePoints と担当なしの chainDropPoints の和と同じ値（evaluate.score・solver の結果）
 */
export function chainScore(
  problem: Problem,
  seqs: readonly (readonly number[])[],
): { points: number; pairs: number; kept: number } {
  const chain = problem.chain;
  if (!chain) return { points: 0, pairs: 0, kept: 0 };
  let pairs = 0;
  for (const n of chain.next) if (n >= 0) pairs++;
  let kept = 0;
  for (const seq of seqs) for (let k = 1; k < seq.length; k++) if (chain.next[seq[k - 1]!] === seq[k]) kept++;
  return { points: (pairs - kept) * chain.perPair, pairs, kept };
}
