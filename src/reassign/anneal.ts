// 案B「少し動かしてよい」（PRD D34。ADR-0011）：焼きなましの準備・費用・結果のまとめと確かめ。
// どれも純粋関数で決定的（関数本体は index.ts から移しただけ）。DemoData は読まない・書かない
import type { Problem } from '../contracts/problem';
import type {
  AnnealCost,
  AnnealSettled,
  FinishAnneal,
  PrepareAnneal,
  ReassignResult,
  Routes,
  SettleAnneal,
} from '../contracts/reassign';
import {
  STAY_MINUTE_POINTS_PER_WEIGHT,
  STAY_MOVE_POINTS_PER_WEIGHT,
  STAY_WEIGHT_MAX,
  STAY_WEIGHT_MIN,
} from '../contracts/reassign';
import { balancePoints, dropPointsOf, EPS, overCap, routeCost } from '../matching';
import { timesOf } from './diff';
import { colOf, INF, indexOf, knownOf } from './shared';

/** 「変更を減らす」の重み → 担当が変わった訪問1件の点・開始のずれ1分の点（重みは 0〜5 に収める） */
export function stayPointsOf(weight: number): { movePoints: number; minutePoints: number } {
  const w = Number.isFinite(weight) ? Math.min(STAY_WEIGHT_MAX, Math.max(STAY_WEIGHT_MIN, weight)) : 0;
  return { movePoints: w * STAY_MOVE_POINTS_PER_WEIGHT, minutePoints: w * STAY_MINUTE_POINTS_PER_WEIGHT };
}

/**
 * 案B の準備：stay（元の案の担当・開始と減点）を入れた問題・初期解（案A）を作る。
 * - stay.staff：元の案の担当。振り直す訪問・元の案で入っていない訪問は null（担当は問わない）
 * - stay.start：元の案の開始（base.problem での lenient）。元の案に無い訪問は null
 * - 元の案で入っていない訪問（振り直す訪問でもない）は、案A と同じく入れない（どの担当も可にしない）
 * - 案A の列が使えない人（可でない組がある・strict で回れない・件数の上限を超える。held）は、列ごと案A のまま動かさない：
 *   その列の訪問はどの担当も可にせず、その人にはどの訪問も可にしない（初期解は空の列）。解いたあとに finishAnneal が戻す。
 *   ほかの人の列だけで案B を作る（1列のせいで案B が作れなくならない）
 */
export const prepareAnneal: PrepareAnneal = (problem, base, planA, targets, options) => {
  const { vIndex, sIndex } = indexOf(problem);
  const V = problem.visits.length;
  const targetIds = new Set(targets.map((t) => t.visitId));
  // 元の案の担当・開始
  const baseAt = timesOf(base.problem, base.routes).at;
  const inBase = new Set<string>();
  for (const [k, ids] of Object.entries(base.routes)) if (sIndex.has(k)) for (const id of ids) inBase.add(id);
  const stayStaff: (number | null)[] = new Array(V).fill(null);
  const stayStart: (number | null)[] = new Array(V).fill(null);
  problem.visits.forEach((pv, v) => {
    const at = baseAt.get(pv.id);
    if (!at) return;
    stayStart[v] = at.start;
    if (!targetIds.has(pv.id)) stayStaff[v] = sIndex.get(at.staffId) ?? null;
  });
  const allowed = problem.allowed.map((row) => row.slice());
  const none = () => new Array<boolean>(problem.staff.length).fill(false);
  // 元の案で入っていない訪問は入れない（振り直す訪問は元の案にあるので外れない）
  problem.visits.forEach((pv, v) => {
    if (!inBase.has(pv.id) && !targetIds.has(pv.id)) allowed[v] = none();
  });
  const initial: Routes = {};
  const held: string[] = [];
  problem.staff.forEach((st, s) => {
    const known = knownOf(colOf(planA, st.id), vIndex);
    const broken =
      known.some((v) => !problem.allowed[v]![s]) ||
      overCap(problem.balance, s, known.length) ||
      (known.length > 0 && routeCost(problem, s, known) === INF);
    if (!broken) {
      initial[st.id] = known.map((v) => problem.visits[v]!.id);
      return;
    }
    held.push(st.id);
    initial[st.id] = [];
    for (const v of known) allowed[v] = none();
    for (const row of allowed) row[s] = false;
  });
  // 落とさない訪問：案A（初期解）に入っていて、振り直す訪問でない訪問
  const keep: boolean[] = new Array(V).fill(false);
  for (const ids of Object.values(initial))
    for (const id of ids) {
      const v = vIndex.get(id);
      if (v !== undefined && !targetIds.has(id)) keep[v] = true;
    }
  const prepared: Problem = {
    ...problem,
    allowed,
    stay: { staff: stayStaff, start: stayStart, keep, ...stayPointsOf(options.weight) },
  };
  return { problem: prepared, initial, source: problem, planA, held, targets: [...targetIds] };
};

/**
 * 案B の結果をまとめる：solver の列に、問題にいない人の列・問題に無い訪問・案A の列が使えない人（held）の列は案A のまま残す。
 * pins は担当のいるすべての訪問（案A と同じ）
 */
export const finishAnneal: FinishAnneal = (prep, solved) => {
  const problem = prep.source;
  const { vIndex, sIndex } = indexOf(problem);
  const held = new Set(prep.held);
  const routes: Routes = {};
  for (const [k, ids] of Object.entries(prep.planA)) {
    if (!sIndex.has(k) || held.has(k)) routes[k] = [...ids];
    // 問題に無い訪問は列の最後にそのまま残す
    else routes[k] = [...colOf(solved, k).filter((id) => vIndex.has(id)), ...ids.filter((id) => !vIndex.has(id))];
  }
  for (const st of problem.staff) {
    if (!Object.hasOwn(routes, st.id)) routes[st.id] = colOf(solved, st.id).filter((id) => vIndex.has(id));
  }
  const owner = new Map<string, string>();
  for (const [k, ids] of Object.entries(routes)) for (const id of ids) owner.set(id, k);
  const placed: ReassignResult['placed'] = [];
  const unplaced: string[] = [];
  for (const id of prep.targets) {
    const s = owner.get(id);
    if (s) placed.push({ visitId: id, staffId: s, addedCost: 0, addedTravel: 0 });
    else unplaced.push(id);
  }
  const unassigned = problem.visits.map((v) => v.id).filter((id) => !owner.has(id));
  const pins: Record<string, string> = {};
  for (const [id, s] of owner) if (vIndex.has(id)) pins[id] = s;
  return { routes, placed, unplaced, unassigned, pins };
};

/**
 * 焼きなましが最小にする値：列ごとの routeCost（stay の減点を含む）＋負担の均等＋入らない訪問の点
 * （1件 DROP_POINTS。stay.keep の訪問は KEEP_DROP_POINTS。matching.dropPointsOf）
 */
export const annealCost: AnnealCost = (problem, routes) => {
  const { vIndex } = indexOf(problem);
  const counts = new Array<number>(problem.staff.length).fill(0);
  const placed = new Set<number>();
  let total = 0;
  problem.staff.forEach((st, s) => {
    const known = knownOf(colOf(routes, st.id), vIndex);
    counts[s] = known.length;
    for (const v of known) placed.add(v);
    if (known.length > 0) total += routeCost(problem, s, known);
  });
  let dropped = 0;
  for (let v = 0; v < problem.visits.length; v++) if (!placed.has(v)) dropped += dropPointsOf(problem, v);
  return total + balancePoints(problem, counts) + dropped;
};

/**
 * 案B の結果を確かめて、出す案を決める（保険。ADR-0011）。次のどちらかなら案B として出さず、案A
 * （finishAnneal(prep, prep.initial)）を返して理由を付ける：
 * - keepDropped：案A に入っていた訪問（stay.keep）が1件でも案B に入っていない
 * - notBetter：案A の費用（annealCost(prep.problem, prep.initial)）が有限でない（計算中にデータが変わり案A が strict で
 *   回れない等で、solver が初期解の候補を捨てた）か、案B の費用が案A より高い
 */
export const settleAnneal: SettleAnneal = (prep, solved) => {
  const p = prep.problem;
  const keep = p.stay?.keep ?? [];
  const inSolved = new Set<string>();
  for (const st of p.staff) for (const id of colOf(solved, st.id)) inSolved.add(id);
  const dropped = p.visits.filter((v, i) => keep[i] && !inSolved.has(v.id)).map((v) => v.id);
  const fallback = (reason: 'keepDropped' | 'notBetter', visitIds: string[]): AnnealSettled => ({
    ok: false,
    reason,
    visitIds,
    result: finishAnneal(prep, prep.initial),
  });
  if (dropped.length > 0) return fallback('keepDropped', dropped);
  const costA = annealCost(p, prep.initial);
  // 足し算の順の違いの誤差だけは許す
  if (!Number.isFinite(costA) || !(annealCost(p, solved) <= costA + EPS * Math.max(1, Math.abs(costA))))
    return fallback('notBetter', []);
  return { ok: true, reason: null, visitIds: [], result: finishAnneal(prep, solved) };
};
