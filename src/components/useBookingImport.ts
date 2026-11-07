// 予約の CSV の読み込み（ADR-0075・ADR-0090。PRD D408・D423。データの画面の「予約の CSV」と、単発の「予約を追加」の引き出しから）：ほかのソフトの予約の CSV を読んで、
// 件数（追加・更新・変更なし・入れなかった行）を見せて確かめてから、store の update で訪問（単発・担当なし）として入れる。
// 入れる手は usePendingImport（名簿の読み込みと同じ）
import { useState } from 'react';
import type { BookingImportResult, DemoData } from '../contracts/data';
import { jstDate } from '../domain/time';
import { bookingsOutsideHours, outsideHoursNote } from '../lib/bookingFit';
import {
  bookingConfirmBody,
  bookingDoneText,
  bookingHasChanges,
  bookingProblems,
  pastUnassignedCount,
  pastUnassignedNote,
} from '../lib/bookingScreen';
import { formError, isStaleBuild } from '../lib/common';
import { EXCEL_RELOADING_TEXT, EXCEL_STALE_TEXT } from '../lib/dataScreen';
import { canKeepPrevious } from '../store';
import { useConfirm } from './ConfirmDialog';
import { IMPORT_CHANGED_TEXT, usePendingImport } from './usePendingImport';
import { reloadOnStale, useResumeAfterReload } from './useReloadResume';

/**
 * onDone：入れたあとに呼ぶ（引き出しを閉じるなど）。target は読み直しの控えの欄の名前（欄ごとに分ける。
 * 予定の引き出しとデータの画面で同じ控えを取り合わない）
 */
export function useBookingImport(onDone?: () => void, target = 'bookings') {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, toast, rebase, commit } = usePendingImport(setError);
  const confirmDialog = useConfirm();

  const loadBookings = async (file: File) => {
    const { importBookings } = await import('../excel');
    const buf = await file.arrayBuffer();
    const read = (d: DemoData) => importBookings(buf, d);
    const first = read(data);
    if ('code' in first) {
      setError(`読み込めませんでした（いまのデータはそのままです）\n${first.message}`);
      return;
    }
    // 読んでいるあいだに別のところ（住所からの位置の検索など）でデータが変わっていたら、今のデータで読み直す
    const before = await rebase(data, first, read);
    if (!before) return setError(IMPORT_CHANGED_TEXT);
    const { base, r } = before;
    const clientTerm = base.org.terms.client;
    if (!bookingHasChanges(r)) {
      const problems = bookingProblems(r, clientTerm);
      if (problems.length > 0)
        setError([`入れる訪問はありませんでした（変更なし ${r.unchanged}件）`, ...problems].join('\n'));
      else toast(`変更はありませんでした（変更なし ${r.unchanged}件）`);
      return;
    }
    /** 確認に出す注意（勤務に入らない予約・今日より前の担当なし）。読み直したあとも同じかを見る */
    const notesOf = (b: DemoData, x: BookingImportResult) => ({
      outsideNote: outsideHoursNote(bookingsOutsideHours(b, x.data), b.org.terms.staff),
      pastNote: pastUnassignedNote(pastUnassignedCount(b, x.data, jstDate(Date.now()))),
    });
    const notes = notesOf(base, r);
    const ok = await confirmDialog({
      title: '訪問を読み込みますか？',
      body: bookingConfirmBody({ fileName: file.name, r, clientTerm, keep: canKeepPrevious(), ...notes }),
      confirmLabel: '読み込む',
    });
    if (!ok) return;
    // 確かめているあいだに変わっていたら、今のデータで読み直す（確かめた内容と同じときだけ入れる）
    const after = await rebase(base, r, read);
    // 確かめた注意（勤務時間の外・今日より前）が変わったら入れない（確かめていない内容を入れない）
    if (!after || JSON.stringify(notesOf(after.base, after.r)) !== JSON.stringify(notes))
      return setError(IMPORT_CHANGED_TEXT);
    commit({
      base: after.base,
      next: after.r.data,
      label: '訪問の読み込み',
      done: (keep) => bookingDoneText(after.r, keep),
      onDone,
    });
  };

  /** 読んで検査し、通ったら件数を見せて確かめる（取り消しならデータは変えない）。resumed は読み直したあとの続き */
  const load = async (file: File, resumed = false) => {
    setError(null);
    setBusy(true);
    try {
      await loadBookings(file);
    } catch (e) {
      if (await reloadOnStale(e, { target, file, resumed })) {
        toast(EXCEL_RELOADING_TEXT);
        return;
      }
      setError(
        isStaleBuild(e) ? EXCEL_STALE_TEXT : `読み込めませんでした：${formError(e)}（いまのデータはそのままです）`,
      );
    } finally {
      setBusy(false);
    }
  };
  useResumeAfterReload(target, (file) => void load(file, true));
  return { load, error, busy };
}
