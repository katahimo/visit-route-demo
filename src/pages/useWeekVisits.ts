import { useEffect, useMemo, useRef, useState } from 'react';
import { focusUndo } from '../components/undo';
import { useInsertNotice } from '../components/useInsertNotice';
import { useOpenVisit } from '../components/VisitPanel';
import { focusVisitItem, useVisitKeys, visitItemOf } from '../components/visitKeys';
import { useVisitDrag, useVisitItem, useVisitLooks, useVisitSelection } from '../components/visitParts';
import { hhmmToMinutes, minutesToHhmm } from '../domain/time';
import { staffWhyOf } from '../lib/visitDrop';
import { allowedStaffOf } from '../lib/week';
import { findVisit } from '../patterns';
import type { WeekModel } from './useWeekModel';
import type { WeekNav } from './useWeekNav';

/**
 * 週の予定の訪問の動かし方：訪問の詳細の欄（PRD D301）・ドラッグ（PRD D341。lib/visitDrop）・キーボード（時間軸 PRD D333・
 * 表 PRD D342）・複数選択（PRD D330・D340）と、動かしたあとの「空き時間に入れる」の知らせ。
 * データを書くのは欄・キー・知らせ（components の共通の部品）で、この画面は開き方と動かした先へのフォーカスだけ
 */
export function useWeekVisits(model: WeekModel, nav: WeekNav) {
  const { data, visitById, dayOf, activeStaff, table, staffName } = model;
  const { dates, today, start, narrow, goWeek } = nav;
  /** 訪問の詳細の欄（PRD D301。帯を押す・落とすと開く。週の移動の欄はこの欄にした） */
  const openVisitPanel = useOpenVisit();
  /** 表のマスで必ず見せる札（キーで動かした・欄で開いた訪問。「+N」に隠さない） */
  const [keepId, setKeepId] = useState<string | null>(null);
  /** 複数選択（Shift・Ctrl＋クリック。週を送ったら外す。PRD D330） */
  const multi = useVisitSelection(start);
  /** スマホ（600px 以下）の選ぶ形（長押しか「選ぶ」。押すと選ぶ・外す。週を送ったら抜ける。PRD D340） */
  const [selecting, setSelecting] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 週を送ったら選ぶ形を抜ける
  useEffect(() => {
    setSelecting(false);
  }, [start]);
  /** 確定の確認のあいだ・欄を保存したあとに変わったデータを読む */
  const dataRef = useRef(data);
  dataRef.current = data;
  /** 動かしたあとの「空き時間に入れる」の知らせ（動かした回に担当が無いとき。〈利用者さん〉の画面のカレンダーと同じ） */
  const notice = useInsertNotice({
    failText: '空き時間に入りません。「担当を組む」の画面の「AI で組む」か、手で担当を選んでください',
    staffName,
  });
  /** キーで動かしたあと：動かした先のマスで札を隠さず（表の「+N」の一覧の行からでも）、週の外ならその週へ送り、札へフォーカス */
  const onMoved = (r: { visitId: string; date: string }) => {
    setKeepId(r.visitId);
    if (!dates.includes(r.date)) goWeek(r.date);
    focusVisitItem(r.visitId);
  };
  /**
   * 週の時間軸の帯のキーボード（PRD D333）：↑↓ 15分・←→ 1日（週の外へ出たらその週へ）・Shift+←→ 隣の担当（利用中の〈スタッフ〉の順）・
   * Enter で欄（ボタンの既定）・Delete で取り消し（確認）。どれも全体の「元に戻す」の1手
   */
  const visitKeys = useVisitKeys({
    staffOrder: () => activeStaff.map((s) => s.id),
    onMoved,
    onCancelled: focusUndo,
  });

  // ---- 動かす（訪問の詳細の欄。PRD D301）----
  /**
   * 訪問の詳細の欄を開く。d・s が今の日時と違えば（ドラッグで落とした先）、その日時を入れた形で開き、保存のときに範囲
   * （この回だけ／これ以降／すべて）を選ぶ。保存で日時が変わり、担当を選ばず担当が無ければ「空き時間に入れる」の知らせ
   */
  const openMove = (visitId: string, d?: string, s?: number, staffId?: string | null) => {
    const v = visitById.get(visitId);
    if (!v) return;
    notice.clear();
    setKeepId(visitId);
    const changed = d !== undefined && s !== undefined && (d !== v.date || s !== hhmmToMinutes(v.earliestStart));
    const width = hhmmToMinutes(v.latestStart) - hhmmToMinutes(v.earliestStart);
    openVisitPanel({
      visitId,
      ...(staffId ? { staff: staffId } : {}),
      ...(changed
        ? { draft: { date: d, earliestStart: minutesToHhmm(s), latestStart: minutesToHhmm(s + width) } }
        : {}),
      onSaved: (r) => {
        if (r.moved && !r.staffSet && !findVisit(dataRef.current, r.visitId)?.staffId) {
          notice.show(r);
        }
      },
      returnFocus: (vid) => (vid ? visitItemOf(vid) : null),
    });
  };
  /**
   * ドラッグ（PRD D341。どの画面も同じ判定 lib/visitDrop）：時間軸は別の日・時刻、〈利用者さん〉×曜日の表は同じ行の別の日（時刻はそのまま）、
   * 〈スタッフ〉×曜日の表は別の人・日（時刻はそのまま）。落とすと落とした日時・担当を入れた訪問の詳細の欄（範囲は欄で選ぶ）
   */
  const drag = useVisitDrag({
    today,
    fit: true,
    staffWhy: (visitId, d, sid) => staffWhyOf(dataRef.current, visitId, d, sid),
    onDrop: (visitId, v) => openMove(visitId, v.date, v.start, v.staffId),
  });
  const dragId = drag.dragId;
  // ---- ドラッグ中の予告（D57） ----
  /** つかんでいる訪問を担当できる人（その訪問の日の問題の可否） */
  const allowedNow = useMemo(() => {
    if (!dragId) return null;
    const v = visitById.get(dragId);
    return new Set(v ? allowedStaffOf(dayOf.get(v.date)?.problem ?? null, dragId) : []);
  }, [dragId, visitById, dayOf]);
  /** 訪問の見た目（日・月・人の予定表と同じ判定。lib/visitLook） */
  const lookOf = useVisitLooks(dates);
  /** 帯・マスの訪問の押し方（Shift／Ctrl＋クリック・Enter で選ぶ、押すと欄、キーで動かす。PRD D340） */
  const itemProps = useVisitItem({
    selection: multi,
    onOpen: (id) => openMove(id),
    keys: narrow ? null : visitKeys,
    selecting,
    longPress: narrow ? { onSelecting: setSelecting } : null,
  });
  /**
   * 表（〈スタッフ〉×曜日・〈利用者さん〉×曜日）の札のキー（PRD D342）：←→ で曜日・↑↓ で隣の担当の行（時刻はそのまま）・Enter で欄・
   * Delete で取り消し。隣の担当は表の行の順（〈スタッフ〉×曜日）・利用中の〈スタッフ〉の順（〈利用者さん〉×曜日）
   */
  const tableKeys = useVisitKeys({
    layout: 'table',
    staffOrder: () => (table ? table.rows.map((r) => r.staffId) : activeStaff.map((s) => s.id)),
    onMoved,
    onCancelled: focusUndo,
  });
  const tableItemProps = useVisitItem({
    selection: multi,
    onOpen: (id) => openMove(id),
    keys: narrow ? null : tableKeys,
    selecting,
    longPress: narrow ? { onSelecting: setSelecting } : null,
  });
  return {
    keepId,
    multi,
    selecting,
    setSelecting,
    notice,
    onMoved,
    drag,
    allowedNow,
    lookOf,
    itemProps,
    tableItemProps,
  };
}

export type WeekVisits = ReturnType<typeof useWeekVisits>;
