import { CalendarClock, Mail } from 'lucide-react';
import { useState } from 'react';
import { AttentionBand } from '../components/attentionBand';
import { EmptyNext } from '../components/EmptyNext';
import type { MenuItem } from '../components/MenuButton';
import { NextMonthCheck } from '../components/nextMonthCheck';
import { ScheduleNav } from '../components/ScheduleNav';
import { RangeProposalBand, ScheduleToolbar, SelectionBar } from '../components/scheduleParts';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { useIntro } from '../components/useIntro';
import { KeyMoveBand } from '../components/visitKeys';
import { addDays } from '../domain/time';
import { periodEmptyGuide } from '../lib/emptyGuide';
import { bandHref } from '../lib/progressBand';
import { timelineBandFilter, timelineNoneText, visitDaysOf } from '../lib/weekScreen';
import { ymOf } from '../lib/ym';
import { WeekMailPanel } from './mailPanels';
import { useWeekClients } from './useWeekClients';
import { useWeekModel } from './useWeekModel';
import { useWeekNav } from './useWeekNav';
import { useWeekPrep } from './useWeekPrep';
import { useWeekTodayScroll } from './useWeekTodayScroll';
import { useWeekVisits } from './useWeekVisits';
import { WeekDetails, WeekHead, WeekNavActions, WeekNotice } from './weekParts';
import { ClientWeekCard, StaffWeekCard, type WeekTableCtx } from './weekTables';
import { WeekTimeline } from './weekTimeline';
import './week.css';

/**
 * 週間（ADR-0012の段階2。PRD D49〜D51・D56・D57。design.md §4 pages「週間（段階2）」「月間・週間の改定（2026-10-17）」）。
 * 時間軸（月〜日 × 07:00〜20:00。訪問の帯を種類の色で。ドラッグ・キーボードで日時を動かす）と〈スタッフ〉×曜日・〈利用者さん〉×曜日の表。
 * 表示は1つの切り替え（時間軸：〈スタッフ〉／時間軸：〈利用者さん〉／〈スタッフ〉×曜日／〈利用者さん〉×曜日。PRD D188。lib/weekView）。〈スタッフ〉はチップで複数選ぶ（?staff=s1,s2。無ければ全員）。
 * 時間軸の〈利用者さん〉は、この週に訪問がある人をチップ PickChips で並べて選ぶ（PRD D136〜D139。?by=client・?client=c1,c2。
 * 8人まで。?client= が無ければ先頭8人＝初期値で、初期値のあいだは URL に書かない）。この週に訪問の無い人は「ほかの人を探す」の
 * 検索欄 ClientPicker で選ぶ。〈利用者さん〉×曜日の表は選択と分け、この週に訪問がある人を全員出して
 * 絞り込みの欄 ClientFilter で減らす（PRD D108〜D112。?cf=）。表から時間軸へ移ったとき、?client= が無く表で絞り込んでいれば
 * その先頭8人を引き継ぐ（決まりは lib/timelineClients）。
 * データを書くのは「動かす」「空き時間に入れる」だけ（update の中で lib/weekOps の純粋関数を呼ぶ）
 */

export default function WeekPage() {
  const nav = useWeekNav();
  const { today, anchor, dates, start, tab, by, narrow, goWeek, openDay } = nav;
  /** 予定のモード（PRD D355）：組むではメールを出さず、確認では札を動かさない */
  const model = useWeekModel(nav.date, dates, tab);
  const { data, compileInput, terms, days, visitById, table } = model;
  /** 欠勤・キャンセルの入口（ADR-0028 の sudden） */
  const suddenOn = useFeature('sudden');
  /** 週の予定をメールで送る欄（PRD D93。ADR-0017） */
  const [mailOpen, setMailOpen] = useState(false);
  /** メールで送るは「その他 ▾」へ、1行の状態・凡例は「詳しく」へ（入切とも。PRD D402・D393） */
  const moreItems: MenuItem[] = [
    {
      key: 'mail',
      label: '予定をメールで送る',
      icon: Mail,
      onSelect: () => setMailOpen(true),
      testId: 'week-mail',
    },
  ];
  const lead = useIntro('week', `この週の担当を見て、日時をドラッグでずらし、${terms.staff}に伝えたら確定します`);
  const { timelineRef, tableScrollRef, clientScrollRef } = useWeekTodayScroll(nav);
  // ---- この週の準備（PRD D328・D314。ADR-0046・ADR-0053）：担当なしを組む → 確定 → 済み の主ボタン1つ ----
  const prepFlow = useWeekPrep({ data, compileInput, dates, today });
  const { prep, next } = prepFlow;
  const people = useWeekClients(model, nav);
  const visits = useWeekVisits(model, nav);
  const tableCtx: WeekTableCtx = { model, visits, today, narrow };

  /** 時間軸に出す帯：選んだ〈スタッフ〉（全員なら未割当も）・選んだ〈利用者さん〉の帯だけ */
  const showBand = timelineBandFilter({
    by,
    staffSel: nav.staffSel,
    clientIds: people.timelineClients,
    clientOf: (visitId) => visitById.get(visitId)?.clientId,
  });
  /** 空の画面の文とボタン（PRD D176。案のある日が1日でもあれば null） */
  const emptyGuide = periodEmptyGuide({ period: 'この週', dates, today, visitDays: visitDaysOf(days) });
  const noneText = timelineNoneText(
    {
      by,
      staffSel: nav.staffSel,
      picked: people.pickedClients.length,
      shown: people.timelineClients.length,
      weekChips: people.weekChipIds.length,
    },
    terms,
  );

  return (
    <div className="stack week-page">
      <PageHeader icon={CalendarClock} title="週の予定" lead={lead} />
      {/* 上のナビの行（日・週・月で同じ。PRD D347。ADR-0060）。週送り・今日・［月｜週｜日］・確定 */}
      <ScheduleNav
        current="week"
        today={{ onClick: () => goWeek(today), disabled: dates.includes(today) }}
        prev={{ label: '前の週', onClick: () => goWeek(addDays(anchor, -7)) }}
        next={{ label: '次の週', onClick: () => goWeek(addDays(anchor, 7)) }}
        picker={{
          label: '週を選ぶ',
          value: start,
          options: nav.weekOptions,
          onChange: (d) => goWeek(d),
          testId: 'week-title',
        }}
        actions={next.kind === 'none' ? undefined : <WeekNavActions flow={prepFlow} />}
      />
      {/* 要対応の帯（入切とも。PRD D400・D403・D404）。1行の状態（PRD D332）は「詳しく」の中 */}
      <AttentionBand />
      {/* 来月の確認（切で月の20日以降。PRD D413） */}
      <NextMonthCheck />
      {/* 操作の行（日・週・月で同じ作り。PRD D327・D402）。メールで送るは「その他 ▾」。要対応を組むのは要対応の帯、空き状況はメニュー（PRD D403・D400） */}
      <ScheduleToolbar
        zoom="week"
        absence={suddenOn ? { date: anchor } : null}
        assignHref={bandHref(ymOf(anchor), 'batch')}
        moreItems={moreItems}
      />
      {/* 「詳しく」は操作の行のすぐ下（日・月と同じ位置。PRD D384・D393） */}
      <WeekDetails prep={prep} model={model} by={by} tab={tab} />
      {/* 担当を組むの画面で組んだ範囲の提案（日・週・月で同じ帯。PRD D328） */}
      <RangeProposalBand />

      <WeekHead model={model} nav={nav} people={people} allowedNow={visits.allowedNow} />

      <WeekNotice flow={visits.notice} onOpenDay={openDay} />

      {/* 空の画面（PRD D176）：この週に訪問が1日も無いとき、なぜ空かと次の一手（主ボタンは進み具合の帯に任せる） */}
      {emptyGuide && (
        <div className="card week-empty-card">
          <EmptyNext
            guide={emptyGuide}
            icon={CalendarClock}
            onOpenDay={openDay}
            primary={false}
            compact
            testId="week-empty"
          />
        </div>
      )}

      {tab === 'timeline' ? (
        <WeekTimeline
          model={model}
          visits={visits}
          today={today}
          by={by}
          show={showBand}
          noneText={noneText}
          boxRef={timelineRef}
          onOpenDay={openDay}
        />
      ) : tab === 'table' ? (
        table && <StaffWeekCard ctx={tableCtx} table={table} dates={dates} scrollRef={tableScrollRef} />
      ) : (
        people.clientRows && (
          <ClientWeekCard ctx={tableCtx} rows={people.clientRows} dates={dates} scrollRef={clientScrollRef} />
        )
      )}

      {mailOpen && <WeekMailPanel data={data} dates={dates} onClose={() => setMailOpen(false)} />}
      {/* 複数選択の帯（PRD D330。画面の下に貼り付く） */}
      {/* 選んだ訪問をまとめて動かす帯は、確認のモードでは出さない（札を動かさない。PRD D355） */}
      <SelectionBar ids={visits.multi.ids} onClear={visits.multi.clear} dates={dates} />
      {/* キーで動かした先の読み上げと、繰り返しの回の範囲を選び直す小さな帯（PRD D333） */}
      <KeyMoveBand onMoved={visits.onMoved} />
    </div>
  );
}
