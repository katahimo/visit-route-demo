// 考え方ごとの案を「今日の予定」と同じ時間軸で見せるための純粋関数（PRD D357。ADR-0064）。
// 時刻は予定の画面と同じ lenient の計算（lib/dayPlan の stopsOf）、自宅までは lib/routeView の homeTravel
import type { Staff } from '../contracts/documents';
import type { Problem, StopTiming } from '../contracts/problem';
import { stopsOf } from './dayPlan';
import { homeTravel } from './routeView';

type Routes = Record<string, string[]>;

/** 時間軸の1列（担当）：その日の働ける時間（分）・訪問の時刻・最後の訪問から自宅まで（分。無ければ null） */
export type ChoiceColumn = {
  staffId: string;
  slots: { start: number; end: number }[];
  stops: StopTiming[];
  homeMinutes: number | null;
};

/** 訪問のある担当（routes の中で、問題の訪問を1件以上持つ人） */
export function busyStaff(problem: Problem, routes: Routes): Set<string> {
  const out = new Set<string>();
  for (const [staffId, stops] of stopsOf(problem, routes)) if (stops.length > 0) out.add(staffId);
  return out;
}

/** 案の時間軸の列：問題の担当の順に、staffIds の人。訪問の並びと時刻は予定の画面と同じ */
export function choiceColumns(
  problem: Problem,
  routes: Routes,
  staffIds: ReadonlySet<string>,
  staffById: ReadonlyMap<string, Staff>,
): ChoiceColumn[] {
  const stops = stopsOf(problem, routes);
  return problem.staff
    .filter((st) => staffIds.has(st.id))
    .map((st) => ({
      staffId: st.id,
      slots: st.slots,
      stops: stops.get(st.id) ?? [],
      homeMinutes: homeTravel(problem, staffById.get(st.id), routes),
    }));
}
