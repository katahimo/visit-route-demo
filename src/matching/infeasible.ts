// どの担当も可にならない訪問と、多い原因（compile の一部。compile.ts の長さを抑えるために分けた）
import type { Terms } from '../contracts/documents';
import type { Problem, Reason } from '../contracts/problem';

const INF = Number.POSITIVE_INFINITY;
/** infeasible に載せる原因の数 */
const INFEASIBLE_REASONS = 3;

/** どの担当も可にならない訪問と、多い原因（INFEASIBLE_REASONS 件まで） */
export function infeasibleOf(
  allowed: boolean[][],
  reasons: Reason[][][],
  S: number,
  terms: Pick<Terms, 'staff'>,
): Problem['infeasible'] {
  const infeasible: Problem['infeasible'] = [];
  for (let j = 0; j < allowed.length; j++) {
    if (allowed[j]!.some(Boolean)) continue;
    const count = new Map<string, { r: Reason; n: number }>();
    for (let i = 0; i < S; i++) {
      for (const r of reasons[j]![i]!) {
        if (r.points !== INF) continue;
        const key = `${r.ruleId}\u0000${r.label}`;
        const e = count.get(key);
        if (e) e.n++;
        else count.set(key, { r, n: 1 });
      }
    }
    const list = [...count.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, INFEASIBLE_REASONS)
      .map(({ r, n }) => ({ ruleId: r.ruleId, label: `${r.label}（${n}人）`, points: INF }));
    if (S === 0) list.push({ ruleId: 'slot', label: `この日に働ける${terms.staff}がいない`, points: INF });
    infeasible.push({ visit: j, reasons: list });
  }
  return infeasible;
}
