// 月のカレンダーで選ぶ・キー・その日の回の一覧（PRD D333・D340・D343。ADR-0056）：マスを押す・キーで動く・
// その日の回の一覧（右の欄の先頭）とスマホの下から出る欄・訪問をまとめて選ぶ。一覧の行の押し方・ドラッグは useMonthVisitRows
import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOpenVisit } from '../components/VisitPanel';
import { focusVisitItem } from '../components/visitKeys';
import { useVisitSelection } from '../components/visitParts';
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { isOnLeave } from '../domain/leaves';
import { addDays } from '../domain/time';
import { focusDayVisits, type MonthFocus, selectedCountByDate } from '../lib/monthView';
import { cellKeyOf } from '../lib/visitKeys';
import { canSelectVisit } from '../lib/visitSelect';
import { ymOf } from '../lib/ym';
import { visitsOn } from '../patterns';

/** マスのボタンへフォーカス（月を送ったときは描き終わるまで待つ） */
function focusCell(d: string) {
  let n = 0;
  const tick = () => {
    const el = document.querySelector<HTMLElement>(`[data-testid="month-day"][data-date="${d}"]`);
    if (el) el.focus();
    else if (++n < 30) requestAnimationFrame(tick);
  };
  tick();
}

/** その日のマス（カレンダー）か行（日ごとの一覧） */
export const focusCellEl = (d: string) =>
  document.querySelector<HTMLElement>(
    `[data-testid="month-day"][data-date="${d}"], [data-testid="month-list-day"][data-date="${d}"]`,
  );

/** スマホ（600px 以下）の下から出る欄（PRD D343）：出している日と選ぶ形（長押しか「選ぶ」。PRD D334・D340） */
function useMonthSheet(narrowList: boolean, ym: string) {
  /** スマホ（600px 以下）の下から出る欄に出している日（PRD D343。null は閉じている） */
  const [sheetDay, setSheetDay] = useState<string | null>(null);
  /** 下から出る欄の選ぶ形（長押しか「選ぶ」。PRD D334・D340） */
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    if (!sheetDay) setSelecting(false);
  }, [sheetDay]);
  // 広い画面へ戻したら下から出る欄は閉じる（狭い画面へ戻しても勝手に開き直さない）
  useEffect(() => {
    if (!narrowList) setSheetDay(null);
  }, [narrowList]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 月を送ったら、下から出る欄も閉じる
  useEffect(() => {
    setSheetDay(null);
  }, [ym]);
  return { sheetDay, setSheetDay, selecting, setSelecting };
}

export function useMonthDayList(x: {
  data: DemoData;
  today: string;
  ym: string;
  days: readonly string[];
  visitsByDate: ReadonlyMap<string, readonly Visit[]>;
  focus: MonthFocus;
  narrowList: boolean;
  /** 「休みを入れる」の間（Enter・Shift／Ctrl＋Enter は今どおり） */
  offMode: boolean;
  goMonth: (ym: string) => void;
  openDay: (date: string) => void;
}) {
  const { data, today, ym, visitsByDate, focus, narrowList } = x;
  /** 選んだ訪問（Shift／Ctrl＋クリック・Shift／Ctrl＋Enter でマスの日の訪問をまとめて、一覧の行は1件ずつ。月を送ったら外す） */
  const multi = useVisitSelection(ym);
  /** その日の回の一覧（マスで Enter。右の欄の先頭。null は閉じている） */
  const [listDay, setListDay] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 月を送ったら、その月でない日の一覧は閉じる
  useEffect(() => {
    if (listDay && ymOf(listDay) !== ym) setListDay(null);
  }, [ym]);
  const sheet = useMonthSheet(narrowList, ym);
  const openVisit = useOpenVisit();
  /** その日の回（表示の選択が〈スタッフ〉・〈利用者さん〉ならその人の回だけ。開始の順） */
  const dayItems = useCallback(
    (d: string): readonly Visit[] => focusDayVisits(visitsByDate.get(d) ?? visitsOn(data, d), focus),
    [visitsByDate, data, focus],
  );
  /** その日の選べる回（今日より前・取り消し・休みは選ばない） */
  const selectableOf = useCallback(
    (d: string) =>
      dayItems(d)
        .filter((v) => canSelectVisit(v, isOnLeave(data.clientLeaves, v), today))
        .map((v) => v.id),
    [dayItems, data.clientLeaves, today],
  );
  /** その日の回の一覧を開く（〈利用者さん〉を選んでいてその日の回が1つなら、その回の欄。スマホは下から出る欄。PRD D340・D343） */
  const openList = (d: string) => {
    if (narrowList) {
      sheet.setSheetDay(d);
      return;
    }
    const items = dayItems(d);
    if (focus.kind === 'client' && items.length === 1) {
      openVisit({ visitId: items[0]!.id, returnFocus: () => focusCellEl(d) });
      return;
    }
    setListDay(d);
    requestAnimationFrame(() =>
      (
        document.querySelector<HTMLElement>('[data-testid="month-day-visits"] [data-visit-item]') ??
        document.querySelector<HTMLElement>('[data-testid="month-day-visits"] h2')
      )?.focus(),
    );
  };
  /**
   * マス・日ごとの一覧の行を押す（PRD D343）：1回目はその日の訪問を右の欄（スマホは下から出る欄）に出し、右の欄に出している日を
   * もう一度押すと日の予定。フォーカスはマスのまま（Enter はその日の一覧へフォーカスを移す）
   */
  const pickRef = useRef<(d: string) => void>(() => {});
  pickRef.current = (d) => {
    if (narrowList) sheet.setSheetDay(d);
    else if (listDay === d) x.openDay(d);
    else setListDay(d);
  };
  const pickDay = useCallback((d: string) => pickRef.current(d), []);
  /** マスのキー（←→ 日・↑↓ 週・Enter でその日の回の一覧・Shift／Ctrl＋Enter でその日をまとめて選ぶ）。休みを入れる間は Enter は今どおり */
  const cellKeyRef = useRef<(e: ReactKeyboardEvent, d: string) => void>(() => {});
  cellKeyRef.current = (e, d) => {
    const k = cellKeyOf(e);
    if (!k) return;
    if (k.kind === 'go') {
      e.preventDefault();
      const t = addDays(d, k.days);
      if (ymOf(t) !== ym) x.goMonth(ymOf(t));
      focusCell(t);
      return;
    }
    if (x.offMode) return;
    e.preventDefault();
    if (k.kind === 'open') openList(d);
    else multi.toggleMany(selectableOf(d));
  };
  const onCellKey = useCallback((e: ReactKeyboardEvent, d: string) => cellKeyRef.current(e, d), []);
  // マス（DayCell は memo）へ渡す関数は ref を通して変えない（データが変わるたびに全部のマスを描き直さない）
  const cellMultiRef = useRef<(d: string) => void>(() => {});
  cellMultiRef.current = (d) => multi.toggleMany(selectableOf(d));
  const onCellMulti = useCallback((d: string) => cellMultiRef.current(d), []);
  /** マスごとの選んだ件数 */
  const selectedByDate = useMemo(
    () => selectedCountByDate(x.days, visitsByDate, multi.ids),
    [x.days, visitsByDate, multi.ids],
  );
  /** キーで動かしたあと：その日の一覧を開き（別の月なら送る）、動かした行へフォーカス */
  const onKeyMoved = (r: { visitId: string; date: string }) => {
    setListDay(r.date);
    if (ymOf(r.date) !== ym) x.goMonth(ymOf(r.date));
    focusVisitItem(r.visitId);
  };
  /** その日の回の一覧を閉じてマスへ戻る */
  const closeList = () => {
    const d = listDay;
    setListDay(null);
    if (d) focusCellEl(d)?.focus();
  };

  return {
    multi,
    listDay,
    ...sheet,
    openVisit,
    dayItems,
    pickDay,
    onCellKey,
    onCellMulti,
    selectedByDate,
    onKeyMoved,
    closeList,
  };
}

export type MonthDayList = ReturnType<typeof useMonthDayList>;
