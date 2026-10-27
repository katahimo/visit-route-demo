// 案A「空き時間に入れるだけ」の貪欲な振り直し（ADR-0011）：振り直す訪問の選び出し（targetsOf・leftOf）と reassign。
// どれも純粋関数で決定的。DemoData は読まない・書かない
import type { Problem } from '../contracts/problem';
import type {
  LeftOf,
  Reassign,
  ReassignPlan,
  ReassignResult,
  ReassignTarget,
  Routes,
  TargetsOf,
} from '../contracts/reassign';
import { EPS, overCap, routeCost, scheduleRoute } from '../matching';
import { bestFit, colOf, type Fit, INF, indexOf, insertAt, knownOf, TIME_RULES } from './shared';

type Pick = { v: number; s: number; fit: Fit; count: number; regret: number };

/** 入れる順：入れられる人の少ない訪問 → regret の大きい訪問 → earliest の早い訪問 → 問題の順。a が先なら負 */
function comparePick(problem: Problem, a: Pick, b: Pick): number {
  if (a.count !== b.count) return a.count - b.count;
  if (!(a.regret === INF && b.regret === INF)) {
    if (a.regret === INF) return -1;
    if (b.regret === INF) return 1;
    if (Math.abs(a.regret - b.regret) > EPS) return b.regret - a.regret;
  }
  const e = problem.visits[a.v]!.earliest - problem.visits[b.v]!.earliest;
  if (e !== 0) return e;
  return a.v - b.v;
}

/** 分の区間 [start, end) が、どれか1つの時間帯の中に収まるか */
function within(slots: { start: number; end: number }[], start: number, end: number): boolean {
  return slots.some((x) => x.start <= start + EPS && end <= x.end + EPS);
}

/** 元の案の、その人の列の lenient の開始時刻（訪問ID → 開始）。問題にいない人なら空 */
function baseStarts(base: ReassignPlan, staffId: string): Map<string, number> {
  const { vIndex, sIndex } = indexOf(base.problem);
  const s = sIndex.get(staffId);
  const out = new Map<string, number>();
  if (s === undefined) return out;
  const t = scheduleRoute(base.problem, s, knownOf(colOf(base.routes, staffId), vIndex), 'lenient');
  for (const stop of t?.stops ?? []) out.set(stop.visitId, stop.start);
  return out;
}

/**
 * 振り直す訪問（design.md §4 reassign）：欠勤のある人の元の案の訪問のうち、
 * (a) 欠勤の時間と重なる訪問（元の案の時刻（base.problem での lenient）が欠勤を差し引く前の稼働時間帯に収まり、
 *     差し引いたあとには収まらない）と、欠勤のせいでその人に可にならない訪問（absence）、
 *     欠勤と関係なくその人に可にならない訪問（notAllowed。base.problem でも可にならない）、
 * (b) 残りを列の順に足していき、足すと strict で回れなくなる訪問（unreachable）。
 * 時間に幅のある訪問も、元の案の時刻が欠勤と重なれば振り直す（欠勤の人のまま後ろへずらさない）
 */
export const targetsOf: TargetsOf = (problem, base, absentStaffIds) => {
  const { vIndex, sIndex } = indexOf(problem);
  const before = indexOf(base.problem);
  const out: ReassignTarget[] = [];
  const done = new Set<string>();
  for (const staffId of absentStaffIds) {
    const s = sIndex.get(staffId);
    if (s === undefined || done.has(staffId)) continue;
    done.add(staffId);
    const bs = before.sIndex.get(staffId);
    const baseSlots = bs === undefined ? [] : base.problem.staff[bs]!.slots;
    const slots = problem.staff[s]!.slots;
    const starts = baseStarts(base, staffId);
    const chain: number[] = [];
    for (const v of knownOf(colOf(base.routes, staffId), vIndex)) {
      const pv = problem.visits[v]!;
      const visitId = pv.id;
      const bv = before.vIndex.get(visitId);
      const allowedBefore = bs !== undefined && bv !== undefined && base.problem.allowed[bv]![bs]!;
      const at = starts.get(visitId);
      const overlaps =
        at !== undefined && within(baseSlots, at, at + pv.duration) && !within(slots, at, at + pv.duration);
      if (!problem.allowed[v]![s]) {
        const slot = problem.reasons[v]![s]!.some((r) => r.points === INF && TIME_RULES.has(r.ruleId));
        out.push({ visitId, fromStaffId: staffId, reason: slot && allowedBefore ? 'absence' : 'notAllowed' });
        continue;
      }
      if (overlaps) {
        out.push({ visitId, fromStaffId: staffId, reason: 'absence' });
        continue;
      }
      const seq = [...chain, v];
      if (routeCost(problem, s, seq) === INF) {
        out.push({ visitId, fromStaffId: staffId, reason: 'unreachable' });
        continue;
      }
      chain.push(v);
    }
  }
  return out;
};

/**
 * 欠勤の人に残る、振り直すべき訪問（今の担当に targetsOf を当てたもの）。振り直したあとは、ふつうは無い。
 * 手直しで欠勤の人へ戻した・振り直したあとに欠勤や条件を変えた、などで残る（理由は targetsOf の absence・unreachable）。
 * 欠勤と関係ない元からの違反（notAllowed）は欠勤のせいではないので含めない（必須の違反の赤い枠で出る）
 */
export const leftOf: LeftOf = (problem, plan, absentStaffIds) =>
  targetsOf(problem, plan, absentStaffIds).flatMap((t) =>
    t.reason === 'notAllowed' ? [] : [{ visitId: t.visitId, staffId: t.fromStaffId, reason: t.reason }],
  );

/**
 * 案A「空き時間に入れるだけ」：他の人の担当・順番・開始時刻を変えずに、振り直す訪問を1件ずつ入れる。
 * 入れる順は、入れられる人の少ない訪問から（同じなら regret の大きい訪問、それも同じなら earliest の早い順・問題の順）。
 * 位置は増える費用が最も少ない位置（同じなら staff の順で先の人・前の位置）
 */
export const reassign: Reassign = (problem, baseRoutes, targets) => {
  const { vIndex, sIndex } = indexOf(problem);
  const routes: Routes = {};
  for (const [k, ids] of Object.entries(baseRoutes)) routes[k] = [...ids];
  // 元の案のその人の列にある振り直す訪問だけを抜く（問題に無い・元の案に無いものは無視）
  const pending: number[] = [];
  for (const t of targets) {
    const v = vIndex.get(t.visitId);
    if (v === undefined || !sIndex.has(t.fromStaffId) || pending.includes(v)) continue;
    const col = colOf(routes, t.fromStaffId);
    if (!col.includes(t.visitId)) continue;
    routes[t.fromStaffId] = col.filter((id) => id !== t.visitId);
    pending.push(v);
  }

  const placed: ReassignResult['placed'] = [];
  const unplaced: string[] = [];
  const S = problem.staff.length;
  while (pending.length > 0) {
    const knowns = problem.staff.map((st) => knownOf(colOf(routes, st.id), vIndex));
    let pick: Pick | null = null;
    const stuck: number[] = [];
    for (const v of pending) {
      let count = 0;
      let first: { s: number; fit: Fit } | null = null;
      let second = INF;
      for (let s = 0; s < S; s++) {
        if (!problem.allowed[v]![s]) continue;
        const known = knowns[s]!;
        if (overCap(problem.balance, s, known.length + 1)) continue;
        const fit = bestFit(problem, s, known, v);
        if (!fit) continue;
        count++;
        if (first === null || fit.addedCost < first.fit.addedCost - EPS) {
          if (first) second = Math.min(second, first.fit.addedCost);
          first = { s, fit };
        } else {
          second = Math.min(second, fit.addedCost);
        }
      }
      if (!first) {
        stuck.push(v);
        continue;
      }
      const regret = second === INF ? INF : second - first.fit.addedCost;
      const cand: Pick = { v, s: first.s, fit: first.fit, count, regret };
      if (pick === null || comparePick(problem, cand, pick) < 0) pick = cand;
    }
    // 入れられる人がいない訪問は、ほかを入れても入るようにはならない（入れるほど狭くなる）
    for (const v of stuck) {
      pending.splice(pending.indexOf(v), 1);
      unplaced.push(problem.visits[v]!.id);
    }
    if (!pick) break;
    const staffId = problem.staff[pick.s]!.id;
    const visitId = problem.visits[pick.v]!.id;
    routes[staffId] = insertAt(colOf(routes, staffId), vIndex, pick.fit.pos, visitId);
    pending.splice(pending.indexOf(pick.v), 1);
    placed.push({ visitId, staffId, addedCost: pick.fit.addedCost, addedTravel: pick.fit.addedTravel });
  }
  // 入らなかった訪問は問題の順に
  unplaced.sort((a, b) => (vIndex.get(a) ?? 0) - (vIndex.get(b) ?? 0));

  const pins: Record<string, string> = {};
  const inRoute = new Set<string>();
  for (const st of problem.staff) {
    for (const id of colOf(routes, st.id)) {
      if (!vIndex.has(id)) continue;
      pins[id] = st.id;
      inRoute.add(id);
    }
  }
  const unassigned = problem.visits.map((v) => v.id).filter((id) => !inRoute.has(id));
  return { routes, placed, unplaced, unassigned, pins };
};
