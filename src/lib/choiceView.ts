// 考え方ごとの案を「今日の予定」と同じ時間軸で見せるための純粋関数（PRD D357。ADR-0064）。
// 担当ごとの時刻（lenient の scheduleRoute）・自宅までの移動・担当なしの訪問と、点数の基準の物差しでの点（100点満点）
import type { Problem, ScoreScale, StopTiming } from '../contracts/problem';
import { score, toHundred } from '../evaluate';
import { scheduleRoute } from '../matching/timing';
import { attempt, own } from './common';

type Routes = Record<string, string[]>;

/** 時間軸の1列（担当）：その日の働ける時間（分）・訪問の時刻・最後の訪問から自宅まで（分。無ければ null） */
export type ChoiceColumn = {
  staffId: string;
  slots: { start: number; end: number }[];
  stops: StopTiming[];
  homeMinutes: number | null;
};

/**
 * 案の時間軸の列：問題の担当の順に、staffIds の人（無ければ訪問のある人）。訪問の並びは routes のとおり（lenient で時刻を付ける）
 */
export function choiceColumns(problem: Problem, routes: Routes, staffIds?: ReadonlySet<string>): ChoiceColumn[] {
  const vIndex = new Map(problem.visits.map((v, i) => [v.id, i]));
  const out: ChoiceColumn[] = [];
  problem.staff.forEach((st, si) => {
    const ids = (own(routes, st.id) ?? []).filter((id) => vIndex.has(id));
    if (staffIds ? !staffIds.has(st.id) : ids.length === 0) return;
    const t =
      ids.length > 0
        ? scheduleRoute(
            problem,
            si,
            ids.map((id) => vIndex.get(id)!),
            'lenient',
          )
        : null;
    const stops = t?.stops ?? [];
    const last = ids.at(-1);
    const pv = last !== undefined ? problem.visits[vIndex.get(last)!] : undefined;
    const back = pv ? problem.travel[pv.point]?.[st.point] : undefined;
    out.push({
      staffId: st.id,
      slots: st.slots,
      stops,
      homeMinutes: back !== undefined && Number.isFinite(back) ? back : null,
    });
  });
  return out;
}

/** 訪問のある担当（routes の中で、問題の訪問を1件以上持つ人） */
export function busyStaff(problem: Problem, routes: Routes): Set<string> {
  const inProblem = new Set(problem.visits.map((v) => v.id));
  const out = new Set<string>();
  for (const st of problem.staff) if ((own(routes, st.id) ?? []).some((id) => inProblem.has(id))) out.add(st.id);
  return out;
}

/** 点数の基準の物差しでの点（100点満点）。採点できなければ null */
export function choicePoints(scoreProblem: Problem | null, scale: ScoreScale | null, routes: Routes): number | null {
  if (!scoreProblem || !scale) return null;
  const s = attempt(() => score(scoreProblem, routes)).value;
  return s ? toHundred(s.total, scale) : null;
}
