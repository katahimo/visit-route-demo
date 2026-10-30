import { useRef, useState } from 'react';
import { useDayModel } from '../components/useDayModel';
import { monthFeatures, monthPrintHref } from '../lib/monthView';
import {
  legendBarOf,
  MonthAsideCard,
  MonthBodyCard,
  MonthDetails,
  MonthHeadCard,
  MonthSheet,
  MonthTopBars,
} from './monthSections';
import { useMonthAside } from './useMonthAside';
import { useMonthBatch } from './useMonthBatch';
import { useMonthDayList } from './useMonthDayList';
import { useMonthDays } from './useMonthDays';
import { useMonthFocus } from './useMonthFocus';
import { useMonthFocusDays } from './useMonthFocusDays';
import { useMonthListRows } from './useMonthListRows';
import { monthMore, useMonthPanels } from './useMonthMenu';
import { useMonthNav } from './useMonthNav';
import { useMonthOff } from './useMonthOff';
import { useMonthVisitRows } from './useMonthVisitRows';
import './month.css';
import './settings.css';

/**
 * 月間カレンダーと範囲の AI で組む（担当を組む）の進み具合（ADR-0012・ADR-0063。PRD D39〜D43・D53〜D55。design.md §4 pages「月単位の予定」「月間・週間の改定」）。
 * 日のマスは点数を出さず、状態を背景・枠と印で（凡例あり。読み上げには状態の文字）、種類の積み上げバー・休み欠勤の印・
 * 始まる▶終わる■の印・混み具合バー（vacancy の dayLoad）。「表示」で〈スタッフ〉か〈利用者さん〉を1人選ぶと、日のマスと
 * 右の欄がその人のものになる（?staff= ?client=）。選ばないときの右の欄は要対応。押すとその日の予定の画面へ。
 * 担当を AI で組むのは「担当を組む」の画面（#/arrange。ADR-0063）。この画面は組んでいる間の進み具合と止めるだけを出し
 * （計算は画面の外の lib/monthBatch。ADR-0042）、出た提案は範囲の提案の帯で反映する。
 * 計算は lib/monthView・lib/monthCell、状態と処理は同じディレクトリの useMonth*.ts、見た目は monthSections・monthParts・
 * monthGrid・monthCell・monthAside
 */
export default function MonthPage() {
  const nav = useMonthNav();
  const { date, today, ym } = nav;
  /** 予定のモード（PRD D348）：確認では札を動かさない */
  const { data, update, compileInput } = useDayModel(date);
  const terms = data.org.terms;
  /** 機能の入・切（印刷・希望休のまとめ入力・勤務の見込み・欠勤。ADR-0028） */
  const on = monthFeatures(data.org.features);
  const panels = useMonthPanels();
  const batch = useMonthBatch(ym);
  /** 混み具合で数える人（null＝すべての人。種類の ID） */
  const [loadType, setLoadType] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const fs = useMonthFocus(data, nav.params, nav.patchParams, panels.keepPickers);
  const { focus } = fs;
  const month = useMonthDays(data, compileInput, ym, today);
  const fd = useMonthFocusDays({ data, compileInput, month, focus, loadType, ym, today });
  const off = useMonthOff({
    dataRef,
    data,
    update,
    focus,
    requestedOn: on.requested,
    suddenOn: on.sudden,
    today,
    staffById: fs.staffById,
    staffDays: fd.staffDays,
  });
  const aside = useMonthAside({
    ym,
    params: nav.params,
    navigate: nav.navigate,
    patchParams: nav.patchParams,
    showAll: fs.showAll,
    problemOf: (d) => month.perDay.get(d)?.problem,
    bulk: month.bulk,
  });
  const list = useMonthDayList({
    data,
    today,
    ym,
    days: month.days,
    visitsByDate: month.visitsByDate,
    focus,
    narrowList: nav.narrowList,
    offMode: off.offMode,
    goMonth: nav.goMonth,
    openDay: nav.openDay,
  });
  const rows = useMonthVisitRows({ data, dataRef, today, days: month.days, ...fs, list });
  const listRows = useMonthListRows({
    ...month,
    ...fd,
    layout: nav.layout,
    ym,
    date,
    today,
    hasTarget: aside.hasTarget,
    focus: focus.kind,
    staffById: fs.staffById,
    offStaffId: off.offStaffId,
    data,
  });

  // 「その他 ▾」（PRD D278）：表示の選択（〈スタッフ〉・〈利用者さん〉・混み具合）を選んでいる間・休みの入力中は、たたまずに出す
  const more = monthMore({
    panels,
    forced: focus.kind !== 'all' || fs.clientMode || loadType !== null || off.offMode,
    terms,
    printHref: on.print ? monthPrintHref(ym, focus) : null,
    workloadHref: on.workload ? `/workload?ym=${ym}` : null,
    navigate: nav.navigate,
  });

  return (
    <div className="stack">
      <MonthTopBars
        nav={nav}
        band={month.band}
        onBandOp={aside.onBandOp}
        absence={on.sudden ? { date } : null}
        moreItems={more.items}
      />

      <MonthDetails
        ym={ym}
        band={month.band}
        onBandOp={aside.onBandOp}
        summary={month.summary}
        legendBar={legendBarOf(focus.kind)}
      />

      <MonthHeadCard
        data={data}
        nav={nav}
        fs={fs}
        fd={fd}
        off={off}
        panels={panels}
        batch={batch}
        summary={month.summary}
        load={{ value: loadType, onChange: setLoadType }}
        requestedOn={on.requested}
        pickersShown={more.pickersShown}
        noVisitsWhy={month.progress.visits === 0 ? '繰り返しが無いか、この月の今日以降の訪問がありません' : null}
      />

      <div className="month-body">
        <MonthBodyCard
          data={data}
          nav={nav}
          fs={fs}
          fd={fd}
          month={month}
          off={off}
          list={list}
          rows={rows}
          listRows={listRows}
          current={batch.current}
        />
        <MonthAsideCard
          data={data}
          nav={nav}
          fs={fs}
          fd={fd}
          month={month}
          aside={aside}
          list={list}
          rows={rows}
          running={batch.running}
        />
      </div>

      {/* スマホの下から出る欄（PRD D343）：その日の訪問をリストの行で。見る・取り消す・担当替えまで（ADR-0051 の決定5） */}
      {nav.narrowList && <MonthSheet days={month.days} openDay={nav.openDay} list={list} rows={rows} />}
    </div>
  );
}
