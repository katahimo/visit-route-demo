// 月の画面の区画（見出しの欄・本体（カレンダー／日ごとの一覧）・右の欄・スマホの下から出る欄）を、画面のフック
// （useMonthNav・useMonthFocus・useMonthDays など）の戻り値から組み立てる。部品は monthParts・monthGrid・monthAside

import { CalendarRange } from 'lucide-react';
import { AttentionBand } from '../components/attentionBand';
import { DetailsFold } from '../components/DetailsFold';
import { FieldError } from '../components/FieldError';
import type { MenuItem } from '../components/MenuButton';
import { NextMonthCheck } from '../components/nextMonthCheck';
import { type BandModel, ProgressBand } from '../components/progressBand';
import { ScheduleNav } from '../components/ScheduleNav';
import { RangeProposalBand, ScheduleToolbar, SelectionBar } from '../components/scheduleParts';
import { PageHeader } from '../components/ui';
import { useConfirmStep, useExceptionsOnly } from '../components/useFeature';
import { useIntro } from '../components/useIntro';
import { KeyMoveBand } from '../components/visitKeys';
import type { DemoData } from '../contracts/data';
import { monthHeading } from '../lib/detailsHeading';
import { foldedParts, MONTH_ASIDE_PICK_TEXT, monthCellView } from '../lib/exceptionView';
import { type BandOp, bandHref } from '../lib/progressBand';
import { addMonths, ymOf } from '../lib/ym';
import {
  DayVisits,
  MonthAttention,
  MonthClientSum,
  MonthDaySheet,
  MonthStaffSum,
  MonthUnconfirmed,
} from './monthAside';
import { MonthGrid, MonthList } from './monthGrid';
import {
  MonthBatchProgress,
  MonthCellHint,
  MonthHelp,
  MonthLegend,
  MonthOffBar,
  MonthPickers,
  monthLayoutItems,
} from './monthParts';
import type { MonthAside } from './useMonthAside';
import type { MonthBatchState } from './useMonthBatch';
import { focusCellEl, type MonthDayList } from './useMonthDayList';
import type { MonthDays } from './useMonthDays';
import type { MonthFocusState } from './useMonthFocus';
import type { MonthFocusDays } from './useMonthFocusDays';
import type { MonthListRows } from './useMonthListRows';
import type { MonthPanels } from './useMonthMenu';
import type { MonthNav } from './useMonthNav';
import type { MonthOff } from './useMonthOff';
import type { MonthVisitRows } from './useMonthVisitRows';

/** 画面の上：見出し・上のナビの行・要対応の帯・操作の行・範囲の提案の帯（進み具合の帯は「詳しく」の中） */
export function MonthTopBars({
  nav,
  absence,
  moreItems,
  staffTerm,
}: {
  nav: Pick<MonthNav, 'ym' | 'today' | 'layout' | 'monthOptions' | 'goMonth' | 'pickLayout'>;
  /** 〈スタッフ〉の呼び方（マスの読み方の ⓘ） */
  staffTerm: string;
  /** 「欠勤」の入口（欠勤・キャンセルを切っていれば null） */
  absence: { date: string } | null;
  moreItems: MenuItem[];
}) {
  const { ym, today } = nav;
  const lead = useIntro('month', '一月の担当を見て、担当なしや要対応を手で直し、確定します');
  // マスの読み方：切は見出しの ⓘ（入はマスの吹き出し。PRD D410）
  const hint = monthCellView(useExceptionsOnly()).guide === 'hint';
  return (
    <>
      <PageHeader
        icon={CalendarRange}
        title="月の予定"
        lead={lead}
        actions={hint ? <MonthCellHint staffTerm={staffTerm} /> : undefined}
      />
      {/* 上のナビの行（日・週・月で同じ。PRD D347。ADR-0060）。月送り・今日・［月｜週｜日］。主ボタンは進み具合の帯（D154） */}
      <ScheduleNav
        current="month"
        today={{ onClick: () => nav.goMonth(ymOf(today)), disabled: ym === ymOf(today) }}
        prev={{ label: '前の月', onClick: () => nav.goMonth(addMonths(ym, -1)) }}
        next={{ label: '次の月', onClick: () => nav.goMonth(addMonths(ym, 1)) }}
        picker={{
          label: '月を選ぶ',
          value: ym,
          options: nav.monthOptions,
          onChange: nav.goMonth,
          testId: 'month-title',
        }}
      />
      {/* 要対応の帯（入切とも。PRD D400・D403・D404） */}
      <AttentionBand />
      {/* 来月の確認（切で月の20日以降。PRD D413） */}
      <NextMonthCheck />
      {/* 進み具合の帯（PRD D151〜D154・D316）は「詳しく」の中（MonthDetails。主ボタンは操作の行の「定期の予定を入れる」。PRD D384・D393）。担当なしの次の一手は担当を組むの画面へ（ADR-0063）。
        畳んだ中を開かずに行ける「担当を組む」は操作の行（入） */}
      {/* 操作の行（日・週・月で同じ作り。PRD D327・D402）。カレンダーと日ごとの一覧の切り替え（PRD D189。600px 以下ははじめ一覧。URL の ?layout=）・
        月送り・今月のほかのときどき使う操作は「その他 ▾」（PRD D327） */}
      <ScheduleToolbar
        zoom="month"
        absence={absence}
        assignHref={bandHref(ym, 'batch')}
        moreItems={[...monthLayoutItems(nav.layout, nav.pickLayout), ...moreItems]}
      />
      {/* 担当を組むの画面で組んだ範囲の提案（日・週・月で同じ帯。PRD D328） */}
      <RangeProposalBand />
    </>
  );
}

/**
 * 「詳しく」（入切とも。畳んでおく。開け閉めは端末に覚える。PRD D384・D393）：進み具合の帯・月全体の件数・凡例。
 * 入は見出しの1行に「担当 a/b日・確定 c/d日」を出す
 */
export function MonthDetails({
  ym,
  band,
  onBandOp,
  summary,
  legendBar,
}: {
  ym: string;
  band: BandModel;
  onBandOp: (op: BandOp) => void;
  summary: MonthDays['summary'];
  legendBar: 'load' | 'staff' | null;
}) {
  const only = useExceptionsOnly();
  const confirmStep = useConfirmStep();
  const parts = foldedParts('month', only, { progress: true, summary: true, legend: true });
  if (parts.length === 0) return null;
  return (
    <DetailsFold
      testId="month-details"
      screen="month"
      heading={only ? undefined : monthHeading(band.progress, confirmStep)}
    >
      {parts.includes('progress') && <ProgressBand ym={ym} model={band} onOp={onBandOp} />}
      {parts.includes('summary') && <MonthSummaryLine summary={summary} />}
      {parts.includes('legend') && <MonthLegend bar={legendBar} />}
    </DetailsFold>
  );
}

/** 月全体の件数の行（担当なし・当日キャンセル） */
function MonthSummaryLine({ summary }: { summary: MonthDays['summary'] }) {
  return (
    <span className="month-summary sub" data-testid="month-summary">
      月全体：担当なし {summary.unassigned}件{summary.sameDay > 0 ? `・当日キャンセル ${summary.sameDay}件` : ''}
    </span>
  );
}

/** 凡例の棒の種類（全体は混み具合、〈スタッフ〉はその人の時間帯） */
export const legendBarOf = (kind: MonthFocusState['focus']['kind']): 'load' | 'staff' | null =>
  kind === 'all' ? 'load' : kind === 'staff' ? 'staff' : null;

/** 見出しの欄：表示の選択の段・説明・「休みを入れる」の帯・範囲の AI で組む（担当を組む）の進み具合・止まった理由（月全体の件数・凡例は「詳しく」の中） */
export function MonthHeadCard({
  data,
  nav,
  fs,
  fd,
  off,
  panels,
  batch,
  load,
  requestedOn,
  pickersShown,
  noVisitsWhy,
}: {
  data: DemoData;
  nav: Pick<MonthNav, 'patchParams' | 'openDay'>;
  fs: MonthFocusState;
  fd: Pick<MonthFocusDays, 'clientIds' | 'clientsOfStaff' | 'offDates'>;
  off: MonthOff;
  panels: MonthPanels;
  batch: MonthBatchState;
  load: { value: string | null; onChange: (typeId: string | null) => void };
  requestedOn: boolean;
  pickersShown: boolean;
  noVisitsWhy: string | null;
}) {
  const terms = data.org.terms;
  const { focus } = fs;
  const only = useExceptionsOnly();
  // 件数の行・凡例は「詳しく」の中（MonthDetails）なので、ほかに出すものが無ければ欄ごと出さない
  if (!pickersShown && !noVisitsWhy && !panels.helpOpen && off.offStaffId === null && !batch.batch && !batch.error)
    return null;
  return (
    <div className="card stack month-head">
      {pickersShown && (
        <MonthPickers
          selectRef={panels.focusSelectRef}
          terms={terms}
          focus={focus}
          focusValue={fs.focusValue}
          onPickFocus={fs.pickFocus}
          people={{
            staff: fs.activeStaff,
            clients: fs.activeClients,
            monthClientIds: fd.clientIds,
            clientIdsOf: fd.clientsOfStaff,
          }}
          onPickClient={(id) => nav.patchParams({ staff: null, client: id })}
          off={
            requestedOn && focus.kind === 'staff'
              ? { on: off.offMode, disabled: batch.running, onToggle: off.toggleOffMode }
              : null
          }
          load={{
            value: load.value,
            types: data.visitTypes,
            onChange: (v) => {
              panels.keepPickers();
              load.onChange(v);
            },
          }}
        />
      )}
      {noVisitsWhy && <p className="sub">{noVisitsWhy}</p>}
      {panels.helpOpen && (
        <MonthHelp
          helpRef={panels.helpRef}
          staffTerm={terms.staff}
          only={only}
          onClose={() => panels.setHelpOpen(false)}
        />
      )}
      {off.offStaffId !== null && (
        <MonthOffBar name={fs.focusName} offDays={fd.offDates.length} note={off.offNote} onOpenDay={nav.openDay} />
      )}
      {batch.batch && <MonthBatchProgress batch={batch.batch} current={batch.current} onStop={batch.stop} />}
      <FieldError>{batch.error}</FieldError>
    </div>
  );
}

/** 本体：カレンダー（7列の表）か日ごとの一覧（PRD D189） */
export function MonthBodyCard({
  data,
  nav,
  fs,
  fd,
  month,
  off,
  list,
  rows,
  listRows,
  current,
}: {
  data: DemoData;
  nav: Pick<MonthNav, 'ym' | 'date' | 'today' | 'layout'>;
  fs: Pick<MonthFocusState, 'focus' | 'typeById' | 'staffById'>;
  fd: MonthFocusDays;
  month: MonthDays;
  off: Pick<MonthOff, 'toggleOff' | 'offStateOf'>;
  list: MonthDayList;
  rows: Pick<MonthVisitRows, 'gridDrop' | 'dropDate' | 'drag'>;
  listRows: MonthListRows;
  current: string | undefined;
}) {
  const { ym, date, today, layout } = nav;
  return (
    <div className={`card month-card${layout === 'list' ? ' is-list' : ''}`}>
      {layout === 'list' ? (
        <MonthList
          ym={ym}
          today={today}
          date={date}
          rows={listRows.rows}
          listRef={listRows.listRef}
          onToday={() => listRows.showListDay(today, true)}
          isListed={(d) => list.listDay === d || list.sheetDay === d}
          current={current}
          onPick={list.pickDay}
          onToggleOff={off.toggleOff}
        />
      ) : (
        <MonthGrid
          ym={ym}
          date={date}
          current={current}
          month={month}
          focusDays={fd}
          cell={{
            today,
            focus: fs.focus.kind,
            typeById: fs.typeById,
            staffById: fs.staffById,
            clientTerm: data.org.terms.client,
            staffTerm: data.org.terms.staff,
            onOpen: list.pickDay,
            onToggleOff: off.toggleOff,
            onKey: list.onCellKey,
            onMulti: list.onCellMulti,
          }}
          offStateOf={off.offStateOf}
          selectedByDate={list.selectedByDate}
          listDay={list.listDay}
          drop={{ gridProps: rows.gridDrop, date: rows.dropDate, hover: rows.drag.hover }}
        />
      )}
    </div>
  );
}

/**
 * 右の欄：その日の回の一覧（開いているとき）と、選ばないときは確定していない日／要対応、選んだ〈スタッフ〉／〈利用者さん〉の
 * 月のまとめ。下に選んだ訪問の帯とキーで動かした先の読み上げ（PRD D330・D333。日・週と同じ）。
 * エキスパート機能が切なら要対応の一覧は出さず、日を押す前は1行の案内だけ（件数の正は上の要対応の帯。PRD D404・D410）
 */
export function MonthAsideCard({
  data,
  nav,
  fs,
  fd,
  month,
  aside,
  list,
  rows,
  running,
}: {
  data: DemoData;
  nav: Pick<MonthNav, 'ym' | 'narrowList' | 'openDay' | 'openTarget'>;
  fs: MonthFocusState;
  fd: Pick<MonthFocusDays, 'staffSum'>;
  month: MonthDays;
  aside: MonthAside;
  list: MonthDayList;
  rows: Pick<MonthVisitRows, 'rowOf' | 'listItemProps'>;
  running: boolean;
}) {
  const { focus } = fs;
  const { listDay, multi } = list;
  const monthNo = Number(nav.ym.slice(5, 7));
  const view = monthCellView(useExceptionsOnly());
  const dayShown = listDay !== null && !nav.narrowList;
  return (
    <>
      <aside
        ref={aside.asideRef}
        tabIndex={-1}
        className="card stack month-aside"
        data-testid="month-aside"
        aria-label="右の欄"
      >
        {focus.kind === 'all' && !view.attentionList && !dayShown && (
          <p className="sub" data-testid="month-aside-pick">
            {MONTH_ASIDE_PICK_TEXT}
          </p>
        )}
        {listDay && dayShown && (
          <DayVisits
            date={listDay}
            visits={list.dayItems(listDay)}
            rowOf={rows.rowOf}
            itemProps={rows.listItemProps}
            isSelected={multi.has}
            selected={multi.ids.length}
            onClearSelection={multi.clear}
            onOpenDay={() => nav.openDay(listDay)}
            onClose={list.closeList}
          />
        )}
        {focus.kind === 'all' && aside.asideView === 'unconfirmed' && (
          <MonthUnconfirmed
            unconfirmed={month.progress.unconfirmed}
            statuses={month.statuses}
            bulk={month.bulk}
            running={running}
            onConfirm={aside.confirmBulk}
            onOpenDay={nav.openDay}
            onShowAttention={() => aside.setAsideView('attention')}
          />
        )}
        {focus.kind === 'all' && view.attentionList && aside.asideView === 'attention' && (
          <MonthAttention
            attention={month.attention}
            features={data.org.features}
            spanLimitHours={data.org.spanLimitHours}
            onOpen={nav.openTarget}
          />
        )}
        {focus.kind === 'staff' && fd.staffSum && (
          <MonthStaffSum
            id={focus.id}
            staff={fs.staffById.get(focus.id)}
            name={fs.focusName}
            monthNo={monthNo}
            sum={fd.staffSum}
            typeById={fs.typeById}
          />
        )}
        {focus.kind === 'client' && fs.focusClient && (
          <MonthClientSum
            client={fs.focusClient}
            dotClient={fs.activeClients.find((c) => c.id === focus.id)}
            name={fs.focusName}
            monthNo={monthNo}
            ym={nav.ym}
            clientTerm={data.org.terms.client}
          />
        )}
      </aside>
      {/* 選んだ訪問の帯と、キーで動かした先の読み上げ・繰り返しの回の範囲の帯（PRD D330・D333。日・週と同じ） */}
      {!(nav.narrowList && list.sheetDay) && (
        <SelectionBar ids={multi.ids} onClear={multi.clear} dates={month.days} moveDay />
      )}
      <KeyMoveBand onMoved={list.onKeyMoved} />
    </>
  );
}

/** スマホの下から出る欄（PRD D343。600px 以下で日を押したとき） */
export function MonthSheet({
  days,
  openDay,
  list,
  rows,
}: {
  days: readonly string[];
  openDay: (date: string) => void;
  list: MonthDayList;
  rows: Pick<MonthVisitRows, 'rowOf' | 'sheetRowProps'>;
}) {
  const d = list.sheetDay;
  if (!d) return null;
  return (
    <MonthDaySheet
      date={d}
      visits={list.dayItems(d)}
      days={days}
      rowOf={rows.rowOf}
      rowProps={rows.sheetRowProps}
      selection={list.multi}
      selecting={list.selecting}
      onSelecting={list.setSelecting}
      onClose={() => list.setSheetDay(null)}
      returnFocus={() => focusCellEl(d)}
      onOpenDay={() => openDay(d)}
    />
  );
}
