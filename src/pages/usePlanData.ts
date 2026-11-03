// 日の予定（PRD D4・D316・D18。版2：ADR-0053）の計算：その日の訪問・担当の並び・採点・要対応・伝えた内容との差・列。
// どれも useDayModel の上の useMemo（計算は lib・evaluate・matching の純粋関数）。データは書かない
import { useMemo } from 'react';
import { useDayModel } from '../components/useDayModel';
import { leaveOn } from '../domain/leaves';
import { timeOrder } from '../domain/scheduleModel';
import { jstDate } from '../domain/time';
import { achievements, ruleLowerBounds, score, toHundred } from '../evaluate';
import { attempt, own } from '../lib/common';
import {
  changeCount,
  ownerOf,
  pinsOf,
  routesOf,
  toldChanges,
  toldStateOf,
  type VisitIssue,
  visitIssues,
} from '../lib/dayPlan';
import { exceptionsOnly } from '../lib/exceptionView';
import { issueBreakdown } from '../lib/month';
import { leavePeople } from '../lib/personLinks';
import { hardLabelsOf, planColumns, toldMarksOf } from '../lib/planView';
import { reasonOfRoutes } from '../lib/scoreReason';
import { showConfirmStep } from '../lib/settledView';
import { dayLooks } from '../lib/visitLook';
import { workStats } from '../lib/workload';
import { explainMap } from './planParts';

/** その日の訪問・名前を引くもの・担当の並び・採点 */
function usePlanCore(date: string) {
  const m = useDayModel(date);
  const { problem, scoreProblem, staffById, clientById, visitById } = m;
  /** 計算に入れる訪問があるか（無い日は担当の列を出さない） */
  const hasVisits = m.visits.length > 0 && (!problem || problem.visits.length > 0);
  /** 今の担当の並び（版2：訪問の担当と開始の並び） */
  const routes = useMemo(() => (problem ? routesOf(problem, m.allVisits) : {}), [problem, m.allVisits]);
  /** ピン（訪問ID → 担当） */
  const pins = useMemo(() => pinsOf(m.allVisits), [m.allVisits]);
  /** 今の担当の並びがあるか（計算に入れる訪問がある日） */
  const hasPlan = hasVisits && !!problem;
  // 採点はどれも点数の基準の物差し（ADR-0010）
  const curScore = useMemo(
    () => (scoreProblem && hasPlan ? attempt(() => score(scoreProblem, routes)) : null),
    [scoreProblem, hasPlan, routes],
  );
  const explained = useMemo(() => explainMap(hasPlan ? problem : null, routes), [problem, hasPlan, routes]);
  /** 今の担当の条件ごとの達成の件数（D25。点数の基準の物差し。ADR-0010） */
  const curAch = useMemo(
    () => (scoreProblem && hasPlan ? (attempt(() => achievements(scoreProblem, routes)).value ?? []) : []),
    [scoreProblem, hasPlan, routes],
  );
  /** 訪問ごとの検査（要対応。lib/dayPlan の visitIssues） */
  const issues = useMemo(
    () => (problem && hasPlan ? visitIssues(problem, routes, m.allVisits) : new Map<string, VisitIssue[]>()),
    [problem, hasPlan, routes, m.allVisits],
  );
  const owner = useMemo(() => ownerOf(routes), [routes]);
  const staffName = (id: string) => staffById.get(id)?.name ?? '（不明）';
  const clientOf = (visitId: string) => {
    const v = visitById.get(visitId);
    return v ? clientById.get(v.clientId) : undefined;
  };
  const visitLabel = (id: string) =>
    `${visitById.get(id)?.earliestStart ?? ''} ${clientOf(id)?.displayName ?? '（不明）'}`;
  /** 訪問を担当へ移せるか（必須の条件。問題に無い訪問・問題が無いときは移せる） */
  const allowedFor = (visitId: string, staffId: string): boolean => {
    if (!problem) return true;
    const vi = problem.visits.findIndex((v) => v.id === visitId);
    const si = problem.staff.findIndex((s) => s.id === staffId);
    if (vi < 0) return true;
    return si >= 0 && problem.allowed[vi]?.[si] === true;
  };
  return {
    ...m,
    m,
    terms: m.data.org.terms,
    hasVisits,
    hasPlan,
    routes,
    pins,
    curScore,
    cs: curScore?.value ?? null,
    explained,
    curAch,
    issues,
    owner,
    staffName,
    clientOf,
    visitLabel,
    allowedFor,
  };
}

type PlanCore = ReturnType<typeof usePlanCore>;

/** 伝えた内容との差（未連絡の変更）と訪問の見た目 */
function usePlanTold(date: string, c: PlanCore) {
  const { data, problem, hasPlan, routes, staffById, clientById, issues, m } = c;
  /** 伝えた内容と今の違い（未連絡の変更。伝えていない日は null） */
  const told = useMemo(
    () =>
      attempt(() => toldChanges(data, date, problem && hasPlan ? problem : null, problem && hasPlan ? routes : {}))
        .value ?? null,
    [data, date, problem, hasPlan, routes],
  );
  /** 訪問ごとの未連絡の変更の文（「担当 A→B」「時刻 9:00→9:30」） */
  const toldMarks = useMemo(() => toldMarksOf(told, (id) => staffById.get(id)?.name ?? '（不明）'), [told, staffById]);
  /** 訪問の見た目（要対応・未連絡の変更・ピンなど。週・月・人の予定表と同じ判定。lib/visitLook） */
  const looks = useMemo(
    () =>
      dayLooks({ issues, told, problem: hasPlan ? problem : null }, m.allVisits, {
        staffName: (sid) => staffById.get(sid)?.name ?? '（不明）',
        leaveOf: (v) => m.leaveVisits.some((x) => x.id === v.id),
        tentativeOf: (cid) => !!clientById.get(cid)?.tentative,
        past: date < jstDate(Date.now()),
        confirmStep: showConfirmStep(data.org.features),
        exceptionsOnly: exceptionsOnly(data.org.features),
      }),
    [date, issues, told, hasPlan, problem, m.allVisits, m.leaveVisits, clientById, staffById, data.org.features],
  );
  return {
    told,
    /** 伝えた状態：none＝まだ伝えていない・told＝伝えた・changed＝伝えたあとに変わった */
    toldState: toldStateOf(data, date, told),
    toldCount: changeCount(told),
    toldMarks,
    looks,
  };
}

/** 列・担当なし・要対応・拘束・休み・点数の理由 */
function usePlanLists(date: string, c: PlanCore) {
  const { data, problem, hasPlan, routes, owner, issues, staff, slotsOf, m, cs, scoreProblem, scoreScale } = c;
  // ---- 列：その日に働く人（と、訪問の担当になっている人）----
  const columns = useMemo(
    () =>
      planColumns(
        problem,
        routes,
        staff.map((s) => s.id),
        slotsOf,
      ),
    [problem, routes, staff, slotsOf],
  );
  /** 担当なしの訪問（問題の訪問のうち列に無いもの。問題の順） */
  const unassigned = useMemo(() => {
    if (!problem || !hasPlan) return [];
    return problem.visits.map((v) => v.id).filter((id) => !owner.has(id));
  }, [problem, hasPlan, owner]);
  /** 要対応の文（担当なし・担当が休みなど）の訪問ごとの一覧（カード・帯の赤い印） */
  const hardOf = useMemo(() => hardLabelsOf(issues), [issues]);
  const careParts = useMemo(() => issueBreakdown(issues), [issues]);
  /** 拘束が上限を超える人（稼働の見込み。PRD D72。ADR-0015）。今の担当の並びで見る */
  const overSpan = useMemo(() => {
    if (!problem || !hasPlan) return [];
    return workStats(problem, routes, data.org).filter((x) => x.over);
  }, [problem, hasPlan, routes, data.org]);
  /** 〈利用者さん〉の休み（ADR-0013）のため無しの訪問の〈利用者さん〉（名前から詳細を開く。理由を添える。PRD D208） */
  const leaveNames = useMemo(
    () => leavePeople(m.leaveVisits, data.clientLeaves, date, (id) => c.clientById.get(id)?.displayName),
    [m.leaveVisits, data.clientLeaves, date, c.clientById],
  );
  const sortedVisits = useMemo(() => timeOrder([...c.visitById.keys()], c.visitById), [c.visitById]);
  /** 物差しの下限の条件ごとの内訳（点数の理由で条件ごとの超過を比べる） */
  const scoreLower = useMemo(
    () => (scoreProblem ? (attempt(() => ruleLowerBounds(scoreProblem)).value ?? {}) : {}),
    [scoreProblem],
  );
  return {
    columns,
    unassigned,
    hardOf,
    /** 要対応の件数と内訳 */
    careCount: issues.size,
    careParts,
    overSpan,
    leaveNames,
    sortedVisits,
    /** 計算に入れなかった訪問（〈利用者さん〉が休止中など。位置が未登録の訪問は入れる。ADR-0093） */
    notInProblem: problem ? c.visits.filter((v) => !problem.visits.some((p) => p.id === v.id)) : [],
    /** 〈利用者さん〉の休みのため無しの訪問（開始の順。一覧の後ろに薄く出す）と、休みの理由 */
    leaveSorted: [...m.leaveVisits].sort((a, b) => a.earliestStart.localeCompare(b.earliestStart)),
    leaveNoteOf: (v: { clientId: string; date: string }) => leaveOn(data.clientLeaves, v.clientId, v.date)?.note ?? '',
    hundredNow: cs && scoreScale ? toHundred(cs.total, scoreScale) : null,
    /** 点を下げているいちばん大きい理由（PRD D173。減点の内訳と条件ごとの達成から） */
    reasonNow:
      cs && scoreScale && scoreProblem
        ? reasonOfRoutes({ problem: scoreProblem, scale: scoreScale }, cs, {
            achievements: c.curAch,
            rules: c.scoreRules,
            ruleLower: scoreLower,
          })
        : null,
    /** 列の今の並び（担当 → 訪問ID） */
    routeOf: (sid: string) => own(routes, sid) ?? [],
  };
}

/** 日の予定の計算（訪問・担当の並び・採点・要対応・伝えた内容との差・列） */
export function usePlanData(date: string) {
  const c = usePlanCore(date);
  return { ...c, ...usePlanTold(date, c), ...usePlanLists(date, c) };
}

export type PlanData = ReturnType<typeof usePlanData>;
