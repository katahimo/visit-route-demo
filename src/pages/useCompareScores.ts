// 提案を比べるの採点（点数の基準の物差し。ADR-0010）：案ごとの点・点を下げている理由（lib/scoreReason の reasonOfRoutes）と、
// A・B の訪問ごとの説明・A→B の差
import { useMemo } from 'react';
import type { Problem, ScoreScale } from '../contracts/problem';
import type { Rule } from '../contracts/rules';
import { achievements, diff, ruleLowerBounds, score } from '../evaluate';
import { attempt } from '../lib/common';
import type { CompareChoice } from '../lib/compareChoices';
import { reasonOfRoutes, type ScoreReason } from '../lib/scoreReason';
import type { ScoreResult } from './compareParts';
import { explainMap } from './planParts';

export function useCompareScores({
  problem,
  scoreProblem,
  scale,
  scoreRules,
  choices,
  A,
  B,
}: {
  problem: Problem | null;
  scoreProblem: Problem | null;
  scale: ScoreScale | null;
  scoreRules: readonly Rule[];
  choices: readonly CompareChoice[];
  A: CompareChoice | undefined;
  B: CompareChoice | undefined;
}) {
  const aRoutes = useMemo(() => A?.routes ?? {}, [A]);
  const bRoutes = useMemo(() => B?.routes ?? {}, [B]);
  const scores = useMemo(
    () =>
      new Map<string, ScoreResult | null>(
        choices.map((c) => [c.id, scoreProblem ? attempt(() => score(scoreProblem, c.routes)) : null]),
      ),
    [choices, scoreProblem],
  );
  /** 案ごとの点を下げているいちばん大きい理由（PRD D173。日の画面の今の担当の帯と同じ決まり） */
  const reasons = useMemo(() => {
    const out = new Map<string, ScoreReason | null>();
    if (!scoreProblem || !scale) return out;
    const ruleLower = attempt(() => ruleLowerBounds(scoreProblem)).value ?? {};
    for (const c of choices) {
      const sc = scores.get(c.id)?.value;
      if (!sc) continue;
      const ach = attempt(() => achievements(scoreProblem, c.routes)).value ?? [];
      out.set(
        c.id,
        reasonOfRoutes({ problem: scoreProblem, scale }, sc, { achievements: ach, rules: scoreRules, ruleLower }),
      );
    }
    return out;
  }, [choices, scores, scoreProblem, scale, scoreRules]);
  const aExplain = useMemo(() => explainMap(A ? problem : null, aRoutes), [problem, A, aRoutes]);
  const bExplain = useMemo(() => explainMap(B ? problem : null, bRoutes), [problem, B, bRoutes]);
  const abDiff = useMemo(
    () => (scoreProblem && A && B ? attempt(() => diff(scoreProblem, aRoutes, bRoutes)) : null),
    [scoreProblem, A, B, aRoutes, bRoutes],
  );
  return {
    aRoutes,
    bRoutes,
    scores,
    reasons,
    aScore: A ? (scores.get(A.id) ?? null) : null,
    bScore: B ? (scores.get(B.id) ?? null) : null,
    aExplain,
    bExplain,
    abDiff,
  };
}
