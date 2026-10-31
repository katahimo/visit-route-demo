import { useEffect, useMemo, useState } from 'react';
import type { Visit } from '../contracts/documents';
import { hhmmToMinutes, jstDate, minutesToHhmm } from '../domain/time';
import { type CalTextCtx, dropStartAt, highlightCount } from '../lib/personCalendar';
import { type CalItem, type CalView, calDates, clientCalItems, itemsByDate, staffCalItems } from '../lib/personPage';
import { canSelectVisit } from '../lib/visitSelect';
import { canMoveVisit } from '../lib/week';
import { useDemoData } from '../store';
import { focusUndo } from './undo';
import { useInsertNotice } from './useInsertNotice';
import { COMPACT_QUERY, useMedia } from './useMedia';
import { usePcalGhost } from './usePcalGhost';
import { useOpenVisit } from './VisitPanel';
import { focusVisitItem, useVisitKeys, visitItemOf } from './visitKeys';
import { useVisitDrag, useVisitItem, useVisitLooks, useVisitSelection } from './visitParts';

/** 予定のカレンダー（PersonCalendar）に渡すもの */
export type PersonCalendarProps = {
  kind: 'client' | 'staff';
  personId: string;
  view: CalView;
  /** 見せる期間の基準の日（週はその日を含む週、月はその日の月） */
  anchor: string;
  /** 見せ方・期間を変えた（URL に書く） */
  onChange: (next: { view: CalView; anchor: string }) => void;
  /** 強調する繰り返し（定期パターンの ID） */
  highlight?: string | null;
};

/**
 * 予定のカレンダーの状態と処理：期間の回・開く・足す・ドラッグで動かす・選ぶ・キーで動かす・空き時間に入れるの知らせ。
 * 部品は戻り値だけを使う（見た目は components/personCalendarParts）
 */
export function usePersonCalendar({ kind, personId, view, anchor, onChange, highlight = null }: PersonCalendarProps) {
  const { data } = useDemoData();
  const openVisit = useOpenVisit();
  const narrow = useMedia(COMPACT_QUERY);
  const today = jstDate(Date.now());
  const isClient = kind === 'client';
  /** 足す・動かすのは〈利用者さん〉の広い画面だけ（ADR-0051 の決定5） */
  const editable = isClient && !narrow;
  const dates = useMemo(() => calDates(view, anchor), [view, anchor]);
  const from = dates[0]!;
  const to = dates.at(-1)!;
  const items = useMemo(
    () => (isClient ? clientCalItems(data, personId, from, to) : staffCalItems(data, personId, from, to)),
    [data, isClient, personId, from, to],
  );
  const byDate = useMemo(() => itemsByDate(items), [items]);
  const staffById = useMemo(() => new Map(data.staff.map((s) => [s.id, s])), [data.staff]);
  const clientById = useMemo(() => new Map(data.clients.map((c) => [c.id, c])), [data.clients]);
  const text: CalTextCtx = { isClient, staffById, clientById, visitTypes: data.visitTypes };
  /**
   * ドラッグで日時を動かし、担当を選ばずに保存した回の知らせ（週の予定と同じ「空き時間に入れる」）
   */
  const notice = useInsertNotice({
    failText: '空き時間に入りません。日の予定で手で入れるか、AI で組んでください',
    staffName: (id) => staffById.get(id)?.name ?? '',
  });

  // ---- 開く ----
  const focusBack = (visitId: string | null) => (visitId ? visitItemOf(visitId) : null);
  const visitById = useMemo(() => new Map(items.map((it) => [it.visit.id, it.visit])), [items]);
  const open = (v: Visit) => openVisit({ visitId: v.id, returnFocus: focusBack });
  const openById = (id: string) => {
    const v = visitById.get(id);
    if (v) open(v);
  };
  /** 新しい訪問の欄（この〈利用者さん〉を入れて） */
  const openNew = (date: string, start: number, duration: number) =>
    openVisit({
      newVisit: { date, clientId: personId, start: minutesToHhmm(start) },
      draft: { durationMinutes: duration },
      returnFocus: focusBack,
    });
  /** 道具の行の「訪問を足す」（キーボードでも足せる）：期間の中の今日以降の最初の日の 09:00 */
  const addDate = dates.find((d) => d >= today) ?? null;

  // ---- 回を動かす（HTML のドラッグ。どの画面も同じ判定 lib/visitDrop。PRD D341） ----
  const movable = (it: CalItem) =>
    editable && canMoveVisit(it.visit.date, today) && !it.visit.cancelled && it.state !== 'leave';
  /** 落とした日時で欄を開く（範囲は欄で選ぶ） */
  const moveTo = (visitId: string, date: string, start: number) => {
    const v = visitById.get(visitId);
    if (!v) return;
    const width = hhmmToMinutes(v.latestStart) - hhmmToMinutes(v.earliestStart);
    notice.clear();
    openVisit({
      visitId,
      draft: { date, earliestStart: minutesToHhmm(start), latestStart: minutesToHhmm(start + width) },
      returnFocus: focusBack,
      onSaved: (r) => {
        if (r.moved && !r.staffSet) notice.show(r);
      },
    });
  };
  const drag = useVisitDrag({ today, fit: true, onDrop: (visitId, v) => moveTo(visitId, v.date, v.start) });
  /** 時間軸の列の落とし先（落とした位置の15分刻みの開始） */
  const colTarget = (date: string) =>
    drag.target(`w|${date}`, (e) => ({
      date,
      start: dropStartAt(e.clientY - e.currentTarget.getBoundingClientRect().top - drag.offset()),
    }));
  // ---- 空き枠から足す（押す・縦にドラッグ） ----
  const ghost = usePcalGhost({ editable, today, onPick: openNew });

  // ---- 選ぶ・キーで動かす（日・週・月と同じ。PRD D340） ----
  /** 選んだ回（期間・見せ方・人が変わったら外す） */
  const multi = useVisitSelection(`${kind}|${personId}|${view}|${anchor}`);
  /** スマホの選ぶ形（長押しか「選ぶ」） */
  const [selecting, setSelecting] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 期間・見せ方を変えたら選ぶ形を抜ける
  useEffect(() => {
    setSelecting(false);
  }, [view, anchor, personId]);
  const activeStaffIds = useMemo(() => data.staff.filter((s) => s.active).map((s) => s.id), [data.staff]);
  /** キーで動かした先が期間の外ならその期間へ */
  const onKeyMoved = (r: { visitId: string; date: string }) => {
    if (!dates.includes(r.date)) onChange({ view, anchor: r.date });
    focusVisitItem(r.visitId);
  };
  /**
   * キー：↑↓ 15分・←→ 1日（期間の外へ出たらその期間へ）・Shift+←→ 隣の担当・Enter 欄・Delete 取り消し。
   * 日時を動かすのは〈利用者さん〉の広い画面だけ（〈スタッフ〉の画面は担当替え・取り消しだけ）
   */
  const visitKeys = useVisitKeys({
    staffOrder: () => activeStaffIds,
    move: editable,
    onOpen: openById,
    onMoved: onKeyMoved,
    onCancelled: focusUndo,
  });
  const itemProps = useVisitItem({
    selection: multi,
    onOpen: openById,
    keys: narrow ? null : visitKeys,
    selecting,
    longPress: narrow ? { onSelecting: setSelecting } : null,
  });
  /** 回の見た目（日・週・月と同じ判定。lib/visitLook） */
  const lookOf = useVisitLooks(dates);
  const selectable = (it: CalItem) => canSelectVisit(it.visit, it.state === 'leave', today);

  /** 回の札・行に要るもの（components/personCalendarParts の PcalItemButton・PcalItemRow） */
  const item = { text, highlight, narrow, selecting, multi, drag, itemProps, lookOf, movable, selectable };
  return {
    terms: data.org.terms,
    isClient,
    editable,
    narrow,
    today,
    dates,
    items,
    byDate,
    hlCount: highlightCount(items, highlight),
    visitById,
    addDate,
    openNew,
    notice,
    drag,
    colTarget,
    ghost,
    multi,
    selecting,
    setSelecting,
    onKeyMoved,
    item,
  };
}
export type PersonCalendarFlow = ReturnType<typeof usePersonCalendar>;
export type PcalItemKit = PersonCalendarFlow['item'];
