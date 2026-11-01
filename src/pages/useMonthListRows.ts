// 月の画面の日ごとの一覧（PRD D189）：一覧のときだけ行を作り、月・見せ方が変わったら最初に見せる日（今日か選んでいる日）へ巻く
import { useEffect, useMemo, useRef } from 'react';
import type { DemoData } from '../contracts/data';
import type { Staff } from '../contracts/documents';
import { exceptionsOnly, monthCellView } from '../lib/exceptionView';
import type { ClientDay, DayStatus, StaffDay } from '../lib/month';
import { type MonthLayout, monthListFocusDate } from '../lib/monthList';
import { type MonthFocus, type MonthListEntry, monthListEntries } from '../lib/monthView';
import { scrollBehavior } from '../lib/motion';
import { offDayState } from '../lib/requestedOff';
import { showConfirmStep } from '../lib/settledView';

export function useMonthListRows(x: {
  layout: MonthLayout;
  ym: string;
  date: string;
  today: string;
  /** URL の ?do= があるか（行き先があれば巻かない） */
  hasTarget: boolean;
  days: readonly string[];
  statuses: ReadonlyMap<string, DayStatus>;
  focus: MonthFocus['kind'];
  staffDays: ReadonlyMap<string, StaffDay>;
  clientDays: ReadonlyMap<string, ClientDay>;
  staffById: ReadonlyMap<string, Staff>;
  /** 「休みを入れる」で選んでいる〈スタッフ〉（休みを入れるモードでなければ null） */
  offStaffId: string | null;
  attentionByDate: ReadonlyMap<string, number>;
  data: DemoData;
}) {
  const {
    layout,
    ym,
    days,
    statuses,
    staffDays,
    clientDays,
    focus,
    staffById,
    offStaffId,
    data,
    today,
    attentionByDate,
  } = x;
  /** 日ごとの一覧の行（PRD D189。一覧のときだけ作る）。表示の選択と「休みを入れる」の補足は行の下に出す */
  const rows = useMemo(
    (): MonthListEntry[] =>
      layout !== 'list'
        ? []
        : monthListEntries({
            days,
            statuses,
            today,
            focus,
            staffDays,
            clientDays,
            staffName: (id) => staffById.get(id)?.name ?? '',
            offStateOf: (d) => (offStaffId ? offDayState(data, offStaffId, d, today) : undefined),
            attentionByDate,
            confirmStep: showConfirmStep(data.org.features),
            reasons: monthCellView(exceptionsOnly(data.org.features)).reasons,
          }),
    [layout, days, statuses, staffDays, clientDays, focus, staffById, offStaffId, data, today, attentionByDate],
  );
  /** 日ごとの一覧（最初に見せる日へ巻く。PRD D189） */
  const listRef = useRef<HTMLUListElement>(null);
  /** その日の行を見える所へ（上の帯は scroll-margin で避ける）。focus なら行へフォーカス */
  const showListDay = (d: string, focusRow: boolean) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-date="${d}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: focusRow ? scrollBehavior() : 'auto' });
    if (focusRow) el.focus({ preventScroll: true });
  };
  /** 最初に巻いた月と見せ方（同じ月・見せ方では巻き直さない） */
  const listShown = useRef('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: 月・見せ方が変わったとき（と行ができたとき）だけ
  useEffect(() => {
    if (layout !== 'list' || rows.length === 0) return;
    const key = `${ym}:${layout}`;
    if (listShown.current === key) return;
    listShown.current = key;
    // 今月で行き先（?do=）が無いときだけ、今日（選んでいる日が今月ならその日）の行へ
    const target = monthListFocusDate(ym, x.date, today, x.hasTarget);
    if (target) requestAnimationFrame(() => showListDay(target, false));
  }, [layout, ym, rows.length]);

  return { rows, listRef, showListDay };
}

export type MonthListRows = ReturnType<typeof useMonthListRows>;
