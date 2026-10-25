// 月の画面のその日の回の一覧の行（PRD D333・D340・D341。ADR-0051・ADR-0056）：行の中身・押し方・キー・ドラッグ。
// 右の欄の行はキーで動かし、マスへドラッグできる。スマホの下から出る欄の行は押すと詳細・長押しか「選ぶ」で選ぶ
import type { RefObject } from 'react';
import { useVisitKeys, visitItemOf } from '../components/visitKeys';
import { useVisitDrag, useVisitItem, useVisitLooks, type VisitRowData } from '../components/visitParts';
import type { DemoData } from '../contracts/data';
import type { Staff, Visit, VisitType } from '../contracts/documents';
import { isOnLeave } from '../domain/leaves';
import { hhmmToMinutes, minutesToHhmm } from '../domain/time';
import { colorOf } from '../lib/colors';
import { visitRowState, visitRowTime } from '../lib/monthView';
import { canSelectVisit } from '../lib/visitSelect';
import { findVisit } from '../patterns';
import { focusCellEl, type MonthDayList } from './useMonthDayList';

export function useMonthVisitRows(x: {
  data: DemoData;
  /** 直前のデータ（落としたときの訪問を引く） */
  dataRef: RefObject<DemoData>;
  today: string;
  days: readonly string[];
  activeStaff: readonly Staff[];
  staffById: ReadonlyMap<string, Staff>;
  typeById: ReadonlyMap<string, VisitType>;
  list: Pick<
    MonthDayList,
    'multi' | 'sheetDay' | 'setSheetDay' | 'selecting' | 'setSelecting' | 'openVisit' | 'onKeyMoved'
  >;
}) {
  const { data, today, list } = x;
  const { multi, openVisit } = list;
  const lookOf = useVisitLooks(x.days);
  const openPanel = (visitId: string) =>
    openVisit({
      visitId,
      returnFocus: (vid) => (vid ? visitItemOf(vid) : null),
    });
  /** 一覧の行のキー（↑↓ 15分・←→ 1日・Shift+←→ 隣の担当・Enter 欄・Delete 取り消し。PRD D333） */
  const visitKeys = useVisitKeys({
    staffOrder: () => x.activeStaff.map((s) => s.id),
    onOpen: openPanel,
    onMoved: list.onKeyMoved,
    onCancelled: () =>
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="undo-btn"]')?.focus()),
  });
  const itemProps = useVisitItem({ selection: multi, onOpen: openPanel, keys: visitKeys });
  /** 下から出る欄の行（押すと欄を閉じて訪問の詳細の欄・長押しか「選ぶ」で選ぶ。キー・ドラッグは無い。ADR-0051 の決定5） */
  const sheetItemProps = useVisitItem({
    selection: multi,
    onOpen: (id) => {
      const d = list.sheetDay;
      list.setSheetDay(null);
      openVisit({ visitId: id, returnFocus: () => (d ? focusCellEl(d) : null) });
    },
    selecting: list.selecting,
    longPress: { onSelecting: list.setSelecting },
  });
  /** その日の回の一覧の行（右の欄・下から出る欄で同じ） */
  const rowOf = (v: Visit): VisitRowData => {
    const s = v.staffId ? x.staffById.get(v.staffId) : undefined;
    const t = x.typeById.get(v.typeId ?? '');
    return {
      visitId: v.id,
      time: visitRowTime(v),
      title: data.clients.find((c) => c.id === v.clientId)?.displayName ?? '（不明）',
      staff: v.cancelled ? null : (s ?? null),
      staffName: v.cancelled || !v.staffId ? '' : (s?.name ?? '（不明）'),
      state: visitRowState(v, isOnLeave(data.clientLeaves, v)),
      look: lookOf(v.id),
      color: t ? colorOf(t.color) : null,
    };
  };
  /** 一覧の行をマスへドラッグ（その日へ。時刻はそのまま。落とすと落とした日を入れた訪問の詳細の欄。PRD D341） */
  const drag = useVisitDrag({
    today,
    fit: true,
    onDrop: (visitId, v) => {
      const found = findVisit(x.dataRef.current, visitId);
      const width = found ? hhmmToMinutes(found.latestStart) - hhmmToMinutes(found.earliestStart) : 0;
      openVisit({
        visitId,
        draft: { date: v.date, earliestStart: minutesToHhmm(v.start), latestStart: minutesToHhmm(v.start + width) },
        returnFocus: (vid) => (vid ? visitItemOf(vid) : null),
      });
    },
  });
  const gridDrop = drag.target('month', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-testid="month-day"]');
    return el?.dataset.date ? { date: el.dataset.date, start: null } : null;
  });
  const dropDate = drag.hover?.key === 'month' ? drag.hover.target.date : null;
  /** 右の欄の一覧の行の props（選べて動かせる回はドラッグもできる） */
  const listItemProps = (v: Visit) => {
    const movable = canSelectVisit(v, isOnLeave(data.clientLeaves, v), today);
    return {
      ...itemProps(v.id, { selectable: movable, movable, selected: multi.has(v.id) }),
      ...drag.source(v.id, movable),
    };
  };
  /** 下から出る欄の行の props（動かさない） */
  const sheetRowProps = (v: Visit) => {
    const ok = canSelectVisit(v, isOnLeave(data.clientLeaves, v), today);
    return sheetItemProps(v.id, { selectable: ok, movable: false, selected: multi.has(v.id) });
  };

  return { rowOf, listItemProps, sheetRowProps, drag, gridDrop, dropDate };
}

export type MonthVisitRows = ReturnType<typeof useMonthVisitRows>;
