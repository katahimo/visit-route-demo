// 日の予定の区画（PRD D63・D84・D300・D334）：上のナビの行・本体（差の欄・一覧／日ごとのリスト／時間軸・順番・地図）・
// 浮かぶ地図と振り直しの近道・計算に入れなかった訪問・右の欄。どれも usePlanPage の戻り値から描く
import { CalendarDays, Map as MapIcon, TriangleAlert } from 'lucide-react';
import { DetailsFold } from '../components/DetailsFold';
import { DayLines } from '../components/dayLines';
import { DayList } from '../components/dayList';
import { MapDock } from '../components/MapDock';
import { RouteMap } from '../components/RouteMap';
import { StaffLegend } from '../components/routeView';
import { ScheduleNav } from '../components/ScheduleNav';
import { Empty, Hint, SectionTitle } from '../components/ui';
import { useExceptionsOnly } from '../components/useFeature';
import { jstDate } from '../domain/time';
import { own } from '../lib/common';
import { dateText } from '../lib/dateText';
import { dayHeading } from '../lib/detailsHeading';
import { foldedParts } from '../lib/exceptionView';
import { typeOf } from '../lib/patternText';
import { showContactedButton } from '../lib/settledView';
import { ReassignBar } from './absenceParts';
import { CancelVisitPanel } from './cancelVisitPanel';
import { ContactPanel } from './contactPanel';
import { DayMailPanel } from './mailPanels';
import { CareBand } from './planBands';
import { visitNode } from './planCards';
import { PlanBoard } from './planColumns';
import { PlanDetailPanel } from './planDetail';
import { PlanConfirmActions, PlanOneLine } from './planHeader';
import { AnnealBox, ContactButton, ReassignDock } from './reassignParts';
import { SuddenPanel } from './SuddenPanel';
import type { PlanCtx } from './usePlanPage';
import { planIssueRows } from './usePlanShown';
import { EMPTY_CONTACTS } from './useSuddenFlow';
import { VisitList } from './visitList';

/** 上のナビの行（日・週・月で同じ。PRD D347。ADR-0060）。日送り・今日・［月｜週｜日］・状態の印（メールで送る・確定は操作の行。planToolbar） */
export function PlanNavRow({ p }: { p: PlanCtx }) {
  const { date, setDate, dates, d, confirm } = p;
  /** 上のナビの行の日付（PRD D347）：データの日付から選ぶ。今日はデータに無くても選べる（setDate は選んだ日を足す） */
  const todayDate = jstDate(Date.now());
  const dayOptions = [...new Set([...dates, date])].sort().map((x) => ({ value: x, text: dateText(x) }));
  const dateIndex = dates.indexOf(date);
  const prevDate = dateIndex > 0 ? dates[dateIndex - 1] : undefined;
  const nextDate = dateIndex >= 0 ? dates[dateIndex + 1] : undefined;
  return (
    <ScheduleNav
      current="day"
      today={{ onClick: () => setDate(todayDate), disabled: date === todayDate }}
      prev={{ label: '前の日', onClick: () => prevDate && setDate(prevDate), disabled: !prevDate }}
      next={{ label: '次の日', onClick: () => nextDate && setDate(nextDate), disabled: !nextDate }}
      picker={{ label: '日付', value: date, options: dayOptions, onChange: setDate }}
      actions={
        (d.hasPlan || d.toldState === 'changed') && (
          <PlanConfirmActions
            toldState={d.toldState}
            toldCount={d.toldCount}
            date={date}
            confirmStep={p.f.confirmStep}
            onPickDate={setDate}
            onOpenTold={() => confirm.setToldOpen(true)}
          />
        )
      }
    />
  );
}

/** 「今の担当」の1行（訪問・入らない・守れない条件・移動・点数・理由・詳しく。PRD D63・D345）。訪問のある日だけ */
function PlanOneLineBlock({ p }: { p: PlanCtx }) {
  const { date, d, f, nav, v } = p;
  const { hasPlan, cs } = d;
  const issueRows = planIssueRows(d);
  if (!hasPlan || !cs) return null;
  return (
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
  );
}

/** 担当ごとの1日（PRD D84）。訪問のある日だけ。狭い幅では畳む */
function PlanDayLines({ p }: { p: PlanCtx }) {
  const { d, v, nav } = p;
  if (!d.hasPlan || !d.cs || v.compact) return null;
  return (
    <DayLines
      lines={p.staffLines.lines}
      range={p.staffLines.range}
      nameOf={d.staffName}
      onPick={nav.goToStaff}
      staffTerm={d.terms.staff}
      collapsed={v.narrowOrPrint}
      detailName={(sid) => d.staffById.get(sid)?.name ?? ''}
    />
  );
}

/**
 * 「詳しく」（入切とも。畳んでおく。開け閉めは端末に覚える。PRD D384・D393）：今の担当の1行（点数・理由・移動）・担当ごとの1日。
 * 入はさらに要対応の訪問の帯を入れ、見出しの1行に「点数・移動・入らない・守れない条件」を出す
 */
export function PlanDetails({ p }: { p: PlanCtx }) {
  const only = useExceptionsOnly();
  const { d, nav } = p;
  const has = d.hasPlan && !!d.cs;
  const parts = foldedParts('day', only, {
    oneLine: has,
    dayLines: has && !p.v.compact,
    care: has && d.careCount > 0,
  });
  if (parts.length === 0) return null;
  const heading =
    only || !d.cs
      ? undefined
      : dayHeading({
          hundred: d.hundredNow,
          travelMinutes: d.cs.travelMinutes,
          dropped: d.cs.dropped,
          hard: d.cs.hardViolations.length,
        });
  return (
    <DetailsFold testId="day-details" screen="day" heading={heading}>
      {parts.includes('care') && (
        <CareBand count={d.careCount} parts={d.careParts} unassigned={d.unassigned.length} onGoNone={nav.goToNone} />
      )}
      {parts.includes('oneLine') && <PlanOneLineBlock p={p} />}
      {parts.includes('dayLines') && <PlanDayLines p={p} />}
    </DetailsFold>
  );
}

/** 訪問の一覧（表示の「一覧」。休みのため無しの訪問も薄く出す。ADR-0013） */
function PlanVisitList({ p }: { p: PlanCtx }) {
  const { d } = p;
  const { problem, owner, staffName, staffById, pins, unassigned, hardOf, data } = d;
  // 切（例外だけ見せる。PRD D384）：ピン・条件に合わない（必須の違反）の札は出さない
  const only = useExceptionsOnly();
  return (
    <VisitList
      visits={d.sortedVisits}
      visitById={d.visitById}
      clientById={d.clientById}
      ownerName={(id) => {
        const o = owner.get(id);
        return o ? { id: o, name: staffName(o), known: staffById.has(o) } : null;
      }}
      notes={(id) => ({
        outside: !!problem && !problem.visits.some((v) => v.id === id),
        dropped: unassigned.includes(id),
        pinned: !only && !!own(pins, id),
        hard: only ? undefined : hardOf.get(id),
      })}
      clientLabel={d.terms.client}
      typeOfVisit={(v) => typeOf(data.visitTypes, v.typeId)}
      leaveVisits={d.leaveSorted}
      leaveNoteOf={d.leaveNoteOf}
      onEdit={(id) => p.nav.openVisit(id)}
      onCancel={p.cancel.open}
    />
  );
}

/** スマホの日ごとのリスト（PRD D334） */
function PlanDayList({ p }: { p: PlanCtx }) {
  const { date, dates, setDate, v } = p;
  const dateIndex = dates.indexOf(date);
  const prevDate = dateIndex > 0 ? dates[dateIndex - 1] : undefined;
  const nextDate = dateIndex >= 0 ? dates[dateIndex + 1] : undefined;
  return (
    <DayList
      dateLabel={dateText(date)}
      rows={p.dayRows}
      onOpen={(id) => p.nav.openVisit(id)}
      selecting={v.selecting}
      onSelecting={(on) => {
        v.setSelecting(on);
        if (!on) v.multi.clear();
      }}
      isSelected={v.multi.has}
      onToggle={v.multi.toggle}
      onPrev={prevDate ? () => setDate(prevDate) : null}
      onNext={nextDate ? () => setDate(nextDate) : null}
    />
  );
}

/** 地図のカード（本体の下に全幅。PRD D300） */
function PlanMapCard({ p }: { p: PlanCtx }) {
  const { d, sel, v } = p;
  const { focusStaff } = sel;
  return (
    <aside ref={v.mapCardRef} className="card stack plan-map" aria-label="地図" data-testid="plan-map">
      <SectionTitle
        icon={MapIcon}
        aside={
          focusStaff && (
            <button type="button" className="btn btn-small" onClick={sel.clear}>
              全員のルートを見る
            </button>
          )
        }
      >
        地図{focusStaff ? `：${d.staffName(focusStaff)}` : ''}
      </SectionTitle>
      <RouteMap points={p.map.points} lines={p.map.lines} height={v.wideMap ? 600 : 420} />
      <StaffLegend
        staffIds={d.columns.filter((sid) => (own(d.routes, sid)?.length ?? 0) > 0)}
        staffName={d.staffName}
        focusStaff={focusStaff}
        onFocus={sel.focusOn}
        extra={<span className="nowrap legend-item">「家」＝自宅</span>}
      />
    </aside>
  );
}

/** 本体：訪問が無い日の案内か、差の欄と一覧／日ごとのリスト／時間軸・順番と地図 */
export function PlanMain({ p }: { p: PlanCtx }) {
  const { d, v, flow } = p;
  const only = useExceptionsOnly();
  const { shownView, compact } = v;
  if (shownView !== 'day' && d.visits.length === 0 && d.m.leaveVisits.length > 0) return <PlanVisitList p={p} />;
  if (shownView !== 'day' && d.visits.length === 0)
    return (
      <div className="card">
        <Empty icon={CalendarDays}>
          この日の訪問はまだありません。
          {compact ? 'パソコン・タブレットで足せます。' : '操作の行の「訪問を追加」で足せます。'}繰り返しは
          {d.terms.client}の画面で足せます。
        </Empty>
      </div>
    );
  return (
    <div className="plan-main">
      <div className="plan-body stack">
        {d.hasPlan && flow.info && (
          <ReassignBar
            id={flow.barId}
            info={flow.info}
            diff={flow.diff}
            left={flow.left}
            visitLabel={d.visitLabel}
            visitNode={(id) => visitNode(p, id)}
            staffName={d.staffName}
            onReassignAgain={flow.reassignAgain}
            cancelled={flow.cancelled}
            running={p.running}
            onRevert={flow.revertToBase}
            extraActions={<ContactButton count={p.shown.contactsTotal} onOpen={() => flow.setContactsOpen(true)} />}
          >
            <AnnealBox {...p.shown.annealBox} />
          </ReassignBar>
        )}
        {shownView === 'list' ? (
          <PlanVisitList p={p} />
        ) : shownView === 'day' ? (
          <PlanDayList p={p} />
        ) : !d.hasVisits ? null : (
          <PlanBoard p={p} />
        )}
      </div>
      {/* 切（PRD D385）は地図をふだん閉じ、「地図」のボタン（MapDock）で開く */}
      {d.hasPlan && !only && <PlanMapCard p={p} />}
    </div>
  );
}

/** 浮かぶ地図（地図のカードが画面の外のとき）と、差の欄が画面の外のときの振り直しの近道 */
export function PlanDocks({ p }: { p: PlanCtx }) {
  const { d, sel, flow, shown } = p;
  const only = useExceptionsOnly();
  if (!d.hasPlan) return null;
  const { focusStaff } = sel;
  return (
    <>
      <MapDock
        target={only ? null : p.v.mapCardRef}
        points={p.map.points}
        lines={p.map.lines}
        title={`地図${focusStaff ? `：${d.staffName(focusStaff)}` : ''}`}
        focusKey={sel.focusKey}
        onClearFocus={only && focusStaff ? sel.clear : undefined}
      />
      {flow.info && (
        <ReassignDock
          targetId={flow.barId}
          unplaced={flow.diff?.unplaced.length ?? 0}
          left={flow.left.length}
          method={flow.info.method}
          annealRecommended={shown.annealRecommended && !flow.anneal.disabled}
          annealRunning={flow.planRun.running === 'anneal'}
          contactCount={shown.contactsTotal}
          onGo={flow.goToBar}
          onAnneal={() => {
            flow.anneal.start();
            flow.goToBar();
          }}
          onContacts={() => flow.setContactsOpen(true)}
        />
      )}
    </>
  );
}

/** 計算に入れなかった訪問（〈利用者さん〉が休止中・位置が未登録など） */
export function NotInProblemCard({ p }: { p: PlanCtx }) {
  const { d } = p;
  if (d.notInProblem.length === 0) return null;
  return (
    <div className="card stack">
      <SectionTitle
        icon={TriangleAlert}
        aside={
          <Hint>
            {d.terms.client}が休止中・位置が未登録などの訪問です（{d.terms.client}の画面で直せます）。
          </Hint>
        }
      >
        計算に入れなかった訪問
      </SectionTitle>
      {d.notInProblem.map((v) => (
        <span key={v.id}>{d.visitLabel(v.id)}</span>
      ))}
    </div>
  );
}

/** 右の欄：訪問を取り消す・詳しく・予定をメールで送る・連絡の一覧（振り直し・未連絡の変更）・欠勤・キャンセル */
export function PlanPanels({ p }: { p: PlanCtx }) {
  const { date, d, v, f, cancel, confirm, flow, contact, sudden } = p;
  const { data, terms } = d;
  const contactProps = { words: contact.words, terms, staffMail: contact.staffMail, onCopied: contact.onCopied };
  return (
    <>
      {cancel.cancelFor && (
        <CancelVisitPanel
          visit={cancel.cancelFor}
          clientName={d.clientById.get(cancel.cancelFor.clientId)?.displayName ?? ''}
          clientWord={terms.client}
          suddenOn={f.suddenOn}
          sameDay={cancel.sameDay}
          setSameDay={cancel.setSameDay}
          onCancel={cancel.ok}
          onClose={cancel.close}
        />
      )}
      {v.panel === 'detail' && (
        <PlanDetailPanel
          cs={d.hasPlan ? d.cs : null}
          scoreProblem={d.scoreProblem}
          scoreScale={d.scoreScale}
          scoreRulerName={d.scoreRulerName}
          curAch={d.curAch}
          rules={data.rules}
          terms={terms}
          routes={d.routes}
          staffName={d.staffName}
          onClose={() => v.setPanel(null)}
        />
      )}
      {v.panel === 'mail' && f.mailOn && (
        <DayMailPanel
          data={data}
          date={date}
          onClose={() => v.setPanel(null)}
          confirm={{
            state: d.toldState,
            onConfirm: (by, note) => {
              if (by !== 'manual') return confirm.confirmByMail(by, note);
              void confirm.adopt();
              return true;
            },
          }}
        />
      )}
      {flow.contactsOpen && (flow.contacts || p.shown.leftContacts.length > 0) && (
        <ContactPanel
          list={flow.contacts ?? EMPTY_CONTACTS}
          left={p.shown.leftContacts}
          {...contactProps}
          onClose={() => flow.setContactsOpen(false)}
        />
      )}
      {/* 未連絡の変更の連絡の一覧（伝えた内容 → 今。ADR-0053） */}
      {confirm.toldOpen && d.told && (
        <ContactPanel
          list={d.told}
          left={[]}
          {...contactProps}
          onContacted={showContactedButton(d.toldState, f.confirmStep) ? confirm.contacted : undefined}
          onClose={() => confirm.setToldOpen(false)}
        />
      )}
      {sudden.panel && <SuddenPanel key={date} {...sudden.panel} />}
    </>
  );
}
