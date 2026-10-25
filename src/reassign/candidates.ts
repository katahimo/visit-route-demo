// 入らない訪問を受けられる人の候補（candidatesFor・fitsOf）と、候補の人に入れる操作（placeVisit）。
// どれも純粋関数で決定的。DemoData は読まない・書かない
import type { Problem, Reason } from '../contracts/problem';
import type { CandidatesFor, FitOf, FitsOf, PlaceVisit, ReassignCandidate, Routes } from '../contracts/reassign';
import { bestInsertion, EPS, overCap, routeCost, scheduleRoute } from '../matching';
import { bestFit, colOf, INF, indexOf, insertAt, knownOf, TIME_RULES, without } from './shared';

/** 「ずらせば入る」を探す刻みと幅（分） */
const SHIFT_STEP = 5;
const SHIFT_MAX = 120;

/** 訪問の時間の約束を d 分ずらした問題（ずらせば入るかを見る用。ほかは同じものを指す） */
function shifted(problem: Problem, v: number, d: number): Problem {
  const visits = problem.visits.slice();
  const pv = visits[v]!;
  visits[v] = { ...pv, earliest: pv.earliest + d, latest: pv.latest + d };
  return { ...problem, visits };
}

/** 「この人に入れる」の結果と、その人の既存の訪問への影響 */
type Placement = {
  routes: Routes;
  delayedCount: number;
  maxDelayMinutes: number;
};

/**
 * 候補の人に入れる（placeVisit と候補の影響の見込み）。
 * 1. 他の訪問の開始を変えない strict の最良の位置（候補の「入る」と同じ。bestFit）
 * 2. 無ければ、strict で回れる位置のうち費用（routeCost）の最も少ない位置、それも無ければ開始（earliest）の順の位置（lenient）
 * 訪問の時刻（時間の約束）は変えない。影響は lenient の時刻で、既存の訪問の開始の遅れを数える
 */
function placement(problem: Problem, routes: Routes, visitId: string, staffId: string): Placement {
  const { vIndex, sIndex } = indexOf(problem);
  const v = vIndex.get(visitId);
  const s = sIndex.get(staffId);
  const rest = without(routes, visitId);
  const none = { delayedCount: 0, maxDelayMinutes: 0 };
  if (v === undefined || s === undefined) return { routes: bestInsertion(problem, rest, visitId, staffId), ...none };
  const col = colOf(rest, staffId);
  const known = knownOf(col, vIndex);
  const fit = bestFit(problem, s, known, v);
  if (fit) {
    rest[staffId] = insertAt(col, vIndex, fit.pos, visitId);
    return { routes: rest, ...none };
  }
  const old = scheduleRoute(problem, s, known, 'lenient');
  const tried: { p: number; t: NonNullable<ReturnType<typeof scheduleRoute>>; cost: number }[] = [];
  for (let p = 0; p <= known.length; p++) {
    const seq = [...known.slice(0, p), v, ...known.slice(p)];
    const t = scheduleRoute(problem, s, seq, 'lenient');
    if (!t) continue;
    tried.push({ p, t, cost: routeCost(problem, s, seq) });
  }
  const pool = tried;
  let best: (typeof pool)[number] | undefined = pool[0];
  for (const x of pool) if (x.cost < (best?.cost ?? INF) - EPS) best = x;
  if (best && best.cost === INF) {
    // strict ではどこにも入らない：開始の順の位置（同じ時刻ならあと）に最も近い位置
    const e = problem.visits[v]!.earliest;
    let order = known.findIndex((x) => problem.visits[x]!.earliest > e);
    if (order < 0) order = known.length;
    best = pool.find((x) => x.p >= order) ?? pool.at(-1);
  }
  if (!best) return { routes: bestInsertion(problem, rest, visitId, staffId), ...none };
  const chosen = best;
  rest[staffId] = insertAt(col, vIndex, chosen.p, visitId);
  let delayedCount = 0;
  let maxDelay = 0;
  known.forEach((_, k) => {
    const a = old?.stops[k]?.start;
    const b = chosen.t.stops[k < chosen.p ? k : k + 1]?.start;
    if (a === undefined || b === undefined) return;
    const d = Math.round(b - a);
    if (d >= 1) {
      delayedCount++;
      maxDelay = Math.max(maxDelay, d);
    }
  });
  return { routes: rest, delayedCount, maxDelayMinutes: maxDelay };
}

/**
 * 入らない訪問を受けられる人の候補（問題のすべての人）。並び：入る人が先で増える費用の小さい順、
 * 次に「ずらせば入る」分の絶対値の小さい順（同じなら遅らせる方）、最後に入らない人。同じなら staff の順。
 * 「この人に入れる」の影響（遅れる既存の訪問）と、列に元から必須の違反があるかも返す
 */
export const candidatesFor: CandidatesFor = (problem, routes, visitId) => {
  const { vIndex } = indexOf(problem);
  const v = vIndex.get(visitId);
  if (v === undefined) return [];
  const rest = without(routes, visitId);
  const list = problem.staff.map((st, s) => {
    const known = knownOf(colOf(rest, st.id), vIndex);
    const reasons = problem.reasons[v]![s]!;
    const violations: Reason[] = reasons.filter((r) => r.points === INF || r.points > 0);
    const over = overCap(problem.balance, s, known.length + 1);
    const routeBroken = known.length > 0 && scheduleRoute(problem, s, known, 'strict') === null;
    const fit = problem.allowed[v]![s]! && !over && !routeBroken ? bestFit(problem, s, known, v) : null;
    let shiftMinutes: number | null = null;
    // ずらせば入るか：時刻に関わらない必須の原因が無く、件数の上限を超えず、列に元から違反の無い人だけ
    const timeOnly = reasons.every((r) => r.points !== INF || TIME_RULES.has(r.ruleId));
    if (!fit && !over && !routeBroken && timeOnly) {
      for (let a = SHIFT_STEP; a <= SHIFT_MAX && shiftMinutes === null; a += SHIFT_STEP) {
        for (const d of [a, -a]) {
          if (bestFit(shifted(problem, v, d), s, known, v)) {
            shiftMinutes = d;
            break;
          }
        }
      }
    }
    const effect = fit ? { delayedCount: 0, maxDelayMinutes: 0 } : placement(problem, rest, visitId, st.id);
    const c: ReassignCandidate & { order: number } = {
      staffId: st.id,
      fits: fit !== null,
      addedTravel: fit ? fit.addedTravel : null,
      addedCost: fit ? fit.addedCost : null,
      shiftMinutes,
      overCap: over,
      violations,
      routeBroken,
      delayedCount: effect.delayedCount,
      maxDelayMinutes: effect.maxDelayMinutes,
      order: s,
    };
    return c;
  });
  const rank = (c: (typeof list)[number]) => (c.fits ? 0 : c.shiftMinutes !== null ? 1 : 2);
  list.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      const d = (a.addedCost ?? 0) - (b.addedCost ?? 0);
      if (Math.abs(d) > EPS) return d;
    }
    if (ra === 1) {
      const d = Math.abs(a.shiftMinutes ?? 0) - Math.abs(b.shiftMinutes ?? 0);
      if (d !== 0) return d;
      const later = (b.shiftMinutes ?? 0) - (a.shiftMinutes ?? 0);
      if (later !== 0) return later;
    }
    return a.order - b.order;
  });
  return list.map(({ order: _order, ...c }) => c);
};

/**
 * 他の人の担当・順番・開始時刻を変えずに入れられる人（空き状況。ADR-0012）：candidatesFor の fits が true の人
 * （可・件数の上限を超えない・いまの列が strict で回れる・他の訪問の開始を変えずに strict で入る）だけを、
 * 同じ並び（増える費用の小さい順、同じなら staff の順）で返す。「ずらせば入る」の探索・影響の見込みはしない
 */
export const fitsOf: FitsOf = (problem, routes, visitId) => {
  const { vIndex } = indexOf(problem);
  const v = vIndex.get(visitId);
  if (v === undefined) return [];
  const rest = without(routes, visitId);
  const list: (FitOf & { order: number })[] = [];
  problem.staff.forEach((st, s) => {
    if (!problem.allowed[v]![s]) return;
    const known = knownOf(colOf(rest, st.id), vIndex);
    if (overCap(problem.balance, s, known.length + 1)) return;
    // いまの列が strict で回れない人は bestFit が null（candidatesFor の routeBroken と同じ）
    const fit = bestFit(problem, s, known, v);
    if (fit) list.push({ staffId: st.id, addedCost: fit.addedCost, addedTravel: fit.addedTravel, order: s });
  });
  list.sort((a, b) => {
    const d = a.addedCost - b.addedCost;
    if (Math.abs(d) > EPS) return d;
    return a.order - b.order;
  });
  return list.map(({ order: _order, ...f }) => f);
};

/**
 * 候補の人に入れる：候補の「入る」と同じ位置（他の訪問の開始を変えない strict の最良）。
 * 無ければ strict の最良、無ければ開始の順に lenient（placement）。
 * 訪問の時刻は変えない。あとの訪問の開始が遅れることがある（画面は候補の delayedCount で確認を出す）
 */
export const placeVisit: PlaceVisit = (problem, routes, visitId, staffId) =>
  placement(problem, routes, visitId, staffId).routes;
