import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDay } from '../components/day';
import { FieldError } from '../components/FieldError';
import { useDayModel } from '../components/useDayModel';
import { useRouteSelection } from '../components/useRouteSelection';
import { useValueStore } from '../components/valueStore';
import { own } from '../lib/common';
import {
  type CompareChoice,
  choiceStale,
  compareStaffIds,
  infeasibleReasons,
  ruleDiffRows,
  visitLabelOf,
} from '../lib/compareChoices';
import { ownerMap } from '../lib/dayModel';
import { isDate } from '../lib/isDate';
import { monthBatch } from '../lib/monthBatch';
import './plan.css';
import { ChoicesCard, CompareHeader, NotInProblemCard, RuleDiffCard, TotalsCard, UnassignedCard } from './compareParts';
import { CompareMapCard, type CompareStaffProps, StaffCompareCard } from './compareStaff';
import { useApplyChoice, useCompareChoices } from './useCompareChoices';
import { useCompareProposal } from './useCompareProposal';
import { useCompareScores } from './useCompareScores';

/**
 * 提案を比べる（D19・D22・ADR-0005。版2は ADR-0053）：その日の「今の担当」と、この画面で作った提案（プリセットごと。保存しない）
 * から、任意の2つを A・B に選んで比べる。条件の差・合計と条件ごと・担当ごとの順番・地図（A 点線、B 実線）。
 * 提案は「反映する」で訪問の担当・開始に書く（ピンの訪問はそのまま）。採点は A・B とも点数の基準の物差し（ADR-0010）
 */
export default function ComparePage() {
  const { date, setDate } = useDay();
  const m = useDayModel(date);
  const { data, update, staff, staffById, clientById, colorOfStaff, visits, visitById, problem } = m;
  const { scoreProblem, scoreScale: scale, scoreRulerName, scoreRules } = m;
  const terms = data.org.terms;
  const navigate = useNavigate();
  /** 担当を組むの画面の「案を比べる」から来たときの日（?date=）。選んでいる日付をその日にする */
  const dateParam = useSearchParams()[0].get('date');
  // biome-ignore lint/correctness/useExhaustiveDependencies: ?date= が変わったときだけ
  useEffect(() => {
    if (dateParam && isDate(dateParam) && dateParam !== date) setDate(dateParam);
  }, [dateParam]);
  /** 日の予定の「比較の画面で見る」（A＝欠勤前、B＝今の担当。ADR-0011） */
  const asked = (useLocation().state ?? null) as { a?: string; b?: string } | null;
  /**
   * 担当を組むで出した提案のうちこの日の分。比べる案に足す（ADR-0065。
   * 保存しない。担当を組むで反映する・捨てると消える）。この画面で消したものは隠す
   */
  const batch = useValueStore(monthBatch.proposal);
  const reassign = own(data.reassigns, date) ?? null;
  /** 地図で見る担当・強調する区間・選んだ訪問（予定の画面と共通。集まりのキーは 'a'・'b'） */
  const rs = useRouteSelection(date, (set, id) => (set === 'a' ? ownerA : ownerB).get(id));
  // 比べる案が変わると選んだ訪問・区間の持ち主も変わるので外す
  const cs = useCompareChoices({
    data,
    date,
    problem,
    allVisits: m.allVisits,
    reassign,
    batch,
    asked,
    onChange: () => rs.reset(),
  });
  const { choices, A, B } = cs;
  // ---- 採点（点数の基準の物差し。ADR-0010）----
  const { aRoutes, bRoutes, scores, reasons, aScore, bScore, aExplain, bExplain, abDiff } = useCompareScores({
    problem,
    scoreProblem,
    scale,
    scoreRules,
    choices,
    A,
    B,
  });
  /** 提案を作ったあとに訪問が変わったか（変わったら当てられない） */
  const stale = (c: CompareChoice) => choiceStale(c, m.allVisits, data);

  const staffName = (id: string) => staffById.get(id)?.name ?? '（不明）';
  const visitLabel = visitLabelOf(visitById, clientById);

  // ---- 提案の操作（保存しない。決定2）----
  const applyChoice = useApplyChoice({ data, update, date, problem, stale, onApplied: cs.dropApplied });

  // ---- 提案を作る（PRD D159）：プリセット（考え方）を選び、ピンの訪問はそのままで AI で組む ----
  const proposal = useCompareProposal(data, date, m.allVisits, problem, cs.addMade);

  // ---- 条件の差・担当ごとの比較 ----
  const ruleRows = useMemo(() => (A && B ? ruleDiffRows(A, B) : []), [A, B]);
  const staffIds = useMemo(() => compareStaffIds(aRoutes, bRoutes, staff), [aRoutes, bRoutes, staff]);
  const ownerA = useMemo(() => ownerMap(aRoutes), [aRoutes]);
  const ownerB = useMemo(() => ownerMap(bRoutes), [bRoutes]);

  const infeasibleOf = useMemo(() => infeasibleReasons(problem), [problem]);
  const notInProblem = problem ? visits.filter((v) => !problem.visits.some((p) => p.id === v.id)) : [];

  const staffView: CompareStaffProps | null =
    A && B
      ? {
          problem,
          A,
          B,
          a: { routes: aRoutes, explain: aExplain, score: aScore?.value ?? null, owner: ownerA },
          b: { routes: bRoutes, explain: bExplain, score: bScore?.value ?? null, owner: ownerB },
          staffIds,
          staffById,
          visitById,
          clientById,
          colorOfStaff,
          staffName,
          staffTerm: terms.staff,
          rs,
        }
      : null;

  return (
    <div className="stack" style={{ minWidth: 0 }}>
      <CompareHeader date={date} />
      <FieldError>{m.problemError && `問題を作れませんでした：${m.problemError}`}</FieldError>

      <ChoicesCard
        date={date}
        rulerName={scoreRulerName}
        onOpenDay={(d) => {
          setDate(d);
          navigate('/plan');
        }}
        table={{
          choices,
          aId: A?.id,
          bId: B?.id,
          scores,
          reasons,
          scale,
          isStale: stale,
          onPick: cs.pick,
          onApply: applyChoice,
          onRemove: cs.remove,
        }}
        make={problem && problem.visits.length > 0 ? { presets: data.presets, proposal } : null}
      />

      {A && B && staffView && (
        <>
          <RuleDiffCard A={A} B={B} rows={ruleRows} rulerName={scoreRulerName} />
          <TotalsCard A={A} B={B} aScore={aScore} bScore={bScore} abDiff={abDiff} scale={scale} rules={data.rules} />
          <StaffCompareCard {...staffView} />
          {(A.unassigned.length > 0 || B.unassigned.length > 0) && (
            <UnassignedCard
              A={A}
              B={B}
              aExplain={aExplain}
              bExplain={bExplain}
              infeasible={infeasibleOf}
              visitLabel={visitLabel}
              staffTerm={terms.staff}
            />
          )}
          <CompareMapCard {...staffView} />
        </>
      )}

      {notInProblem.length > 0 && (
        <NotInProblemCard visits={notInProblem} visitLabel={visitLabel} clientTerm={terms.client} />
      )}
    </div>
  );
}
