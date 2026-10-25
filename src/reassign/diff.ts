// 元の案と振り直した案の差（reassignDiff）と、その下請けの列ごとの時刻（timesOf）。
// どれも純粋関数で決定的。DemoData は読まない・書かない
import type { Problem } from '../contracts/problem';
import type { ReassignDiff, ReassignDiffFn, Routes } from '../contracts/reassign';
import { scheduleRoute } from '../matching';
import { colOf, indexOf, knownOf } from './shared';

/** 列ごとの lenient の時刻（訪問ID → { 担当, 開始 }）と移動の合計 */
export function timesOf(problem: Problem, routes: Routes) {
  const { vIndex } = indexOf(problem);
  const at = new Map<string, { staffId: string; start: number }>();
  let travel = 0;
  problem.staff.forEach((st, s) => {
    const known = knownOf(colOf(routes, st.id), vIndex);
    const t = scheduleRoute(problem, s, known, 'lenient');
    if (!t) return;
    travel += t.travelMinutes;
    for (const stop of t.stops) at.set(stop.visitId, { staffId: st.id, start: stop.start });
  });
  return { at, travel };
}

/** 元の案と振り直した案の差（時刻は lenient。before と after で問題が違ってよい） */
export const reassignDiff: ReassignDiffFn = (before, after) => {
  const a = timesOf(before.problem, before.routes);
  const b = timesOf(after.problem, after.routes);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const v of [...after.problem.visits, ...before.problem.visits]) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    ids.push(v.id);
  }
  const moved: ReassignDiff['moved'] = [];
  const shiftedList: ReassignDiff['shifted'] = [];
  const unplaced: string[] = [];
  const changed = new Set<string>();
  for (const id of ids) {
    const x = a.at.get(id);
    const y = b.at.get(id);
    const from = x?.staffId ?? null;
    const to = y?.staffId ?? null;
    if (from !== to) {
      moved.push({ visitId: id, from, to });
      if (from) changed.add(from);
      if (to) changed.add(to);
      if (from && !to) unplaced.push(id);
      continue;
    }
    if (x && y) {
      const minutes = Math.round(y.start - x.start);
      if (minutes !== 0) {
        shiftedList.push({ visitId: id, minutes });
        changed.add(y.staffId);
      }
    }
  }
  const order = [...after.problem.staff, ...before.problem.staff].map((s) => s.id);
  const changedStaff = [...new Set(order)].filter((id) => changed.has(id));
  return { moved, shifted: shiftedList, unplaced, changedStaff, travelDelta: b.travel - a.travel };
};
