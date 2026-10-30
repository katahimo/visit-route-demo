import { CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DayLines } from '../components/dayLines';
import { OpenToldContext } from '../components/openTold';
import { SelectionBar } from '../components/scheduleParts';
import { PageHeader } from '../components/ui';
import { KeyMoveBand } from '../components/visitKeys';
import { toldHref } from '../lib/links';
import './plan.css';
import './schedule.css';
import { PlanBands } from './planBands';
import { PlanHelp, PlanOneLine } from './planHeader';
import { NotInProblemCard, PlanDocks, PlanMain, PlanNavRow, PlanPanels } from './planLayout';
import { PlanToolbar } from './planToolbar';
import { usePlanPage } from './usePlanPage';
import { planIssueRows } from './usePlanShown';

/**
 * 日の予定（D4・D13・D18。版2：ADR-0053）：その日の訪問と担当を1画面で扱う。担当・開始・ピンは訪問が持ち、列はその日の訪問の
 * 担当と開始の並び（lib/dayPlan の routesOf）。担当を替える（ドラッグ・「担当を変える ▾」）と最も費用の少ない位置に入れてピンにし、
 * 訪問に書く（writeRoutes）。日の予定では AI で組まない（手で直す。AI は「担当を組む」の画面。ADR-0063）。そこで組んだ範囲の提案は帯で見て反映できる。
 * 「確定」は〈スタッフ〉に伝えた内容を残す（DaySnapshot）。そのあとに変えた訪問は「未連絡の変更」になり、連絡の一覧に出る。
 * 要対応は訪問ごとの検査（担当なし・担当が休み・条件に合わない・時間に間に合わない）。点数（100点満点）は点数の基準の物差し（ADR-0010）。
 * 状態と処理は usePlanPage、区画は planLayout・planHeader・planBands・planToolbar・planColumns・planCards
 */
export default function PlanPage() {
  const p = usePlanPage();
  const { date, d, v, f, nav, flow, confirm } = p;
  const { hasPlan, cs, terms } = d;
  const issueRows = planIssueRows(d);
  const navigate = useNavigate();
  /** 「変更あり」の印（expert 切）：この日ならその場で連絡の一覧、ほかの日ならその日の日の予定へ */
  const openTold = (day: string) => (day === date ? confirm.setToldOpen(true) : navigate(toldHref(day)));
  return (
    <OpenToldContext.Provider value={openTold}>
      <div className="plan-page stack">
        <PageHeader
          icon={CalendarDays}
          title="日の予定"
          lead={
            f.confirmStep
              ? 'その日の担当を見て直し、〈スタッフ〉に伝えたら確定します'
              : 'その日の担当を見て直します。決まったあとに変えた訪問は「変更あり」に出ます'
          }
        />
        <PlanNavRow p={p} />
        {/* 進み具合の帯は月の予定だけ（PRD D332）。日は見出しの状態の印と「今の担当」の1行 */}
        {d.m.clients.length === 0 && (
          <div className="card">
            <p className="sub">先に{terms.client}を登録してください。</p>
          </div>
        )}

        {hasPlan && cs && (
          <PlanOneLine
            cs={cs}
            visitCount={d.visits.length}
            droppedRows={issueRows.dropped}
            hardRows={issueRows.hard}
            hundredNow={d.hundredNow}
            scoreRulerName={d.scoreRulerName}
            reasonNow={d.reasonNow}
            rulesOn={f.rulesOn}
            compatOn={f.compatOn}
            date={date}
            lookNone={nav.lookNone}
            lookAt={nav.lookAt}
            goToNone={nav.goToNone}
            onOpen={(id) => nav.openVisit(id)}
            onDetail={() => v.setPanel('detail')}
          />
        )}
        <PlanToolbar p={p} />
        {/* 使い方は操作の行のすぐ下に開く */}
        {v.helpOpen && (
          <PlanHelp
            helpRef={v.helpRef}
            staffTerm={terms.staff}
            confirmStep={f.confirmStep}
            onClose={() => v.setHelpOpen(false)}
          />
        )}
        {/* 担当ごとの1日（PRD D84）。訪問のある日だけ。狭い幅では畳む */}
        {hasPlan && cs && !v.compact && (
          <DayLines
            lines={p.staffLines.lines}
            range={p.staffLines.range}
            nameOf={d.staffName}
            onPick={nav.goToStaff}
            staffTerm={terms.staff}
            collapsed={v.narrowOrPrint}
            detailName={(sid) => d.staffById.get(sid)?.name ?? ''}
          />
        )}

        {/* あるときだけの帯（PRD D63）。ドラッグ中には増減しない（移したあとに変わる） */}
        <PlanBands
          errors={{ problem: d.problemError, run: flow.error, score: (hasPlan && d.curScore?.error) || null }}
          care={{ count: hasPlan ? d.careCount : 0, parts: d.careParts, unassigned: d.unassigned.length }}
          toldCount={d.toldState === 'changed' ? d.toldCount : null}
          reassign={hasPlan && flow.info ? { unplaced: flow.diff?.unplaced.length ?? 0, left: flow.left.length } : null}
          leave={{ count: d.m.leaveVisits.length, names: d.leaveNames }}
          over={
            f.workloadOn ? { list: d.overSpan, limitHours: d.data.org.spanLimitHours, staffById: d.staffById } : null
          }
          terms={terms}
          date={date}
          staffName={d.staffName}
          on={{
            goNone: nav.goToNone,
            openTold: () => confirm.setToldOpen(true),
            goBar: flow.goToBar,
            showList: () => v.setView('list'),
          }}
        />
        {/* キーで動かした先の読み上げと、繰り返しの回の範囲を選び直す小さな帯（PRD D333） */}
        <KeyMoveBand onMoved={nav.onKeyMoved} />

        <PlanMain p={p} />
        <PlanDocks p={p} />
        <NotInProblemCard p={p} />
        <PlanPanels p={p} />
        {/* 複数選択の帯（PRD D330。画面の下に貼り付く） */}
        {/* 選んだ訪問をまとめて動かす帯は、確認のモードでは出さない（札を動かさない。PRD D348） */}
        <SelectionBar ids={v.multi.ids} onClear={v.multi.clear} dates={[date]} />
      </div>
    </OpenToldContext.Provider>
  );
}
