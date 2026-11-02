// 予約の CSV の読み込み（ADR-0075・ADR-0090。PRD D408・D423。データの画面の「予約の CSV」と、予定の「予定を入れる」の引き出しから）：ほかのソフトの予約の CSV を読んで、
// 件数（追加・更新・変更なし・入れなかった行）を見せて確かめてから、store の update で訪問（単発・担当なし）として入れる。
// 入れる手は usePendingImport（名簿の読み込みと同じ）
import { useState } from 'react';
import { bookingConfirmBody, bookingDoneText, bookingHasChanges, bookingProblems } from '../lib/bookingScreen';
import { formError, isStaleBuild } from '../lib/common';
import { EXCEL_STALE_TEXT } from '../lib/dataScreen';
import { canKeepPrevious } from '../store';
import { useConfirm } from './ConfirmDialog';
import { IMPORT_CHANGED_TEXT, usePendingImport } from './usePendingImport';

/** onDone：入れたあとに呼ぶ（引き出しを閉じるなど） */
export function useBookingImport(onDone?: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, toast, changedSince, commit } = usePendingImport(setError);
  const confirmDialog = useConfirm();

  const loadBookings = async (file: File) => {
    const base = data;
    const { importBookings } = await import('../excel');
    const r = importBookings(await file.arrayBuffer(), base);
    if ('code' in r) {
      setError(`読み込めませんでした（いまのデータはそのままです）\n${r.message}`);
      return;
    }
    const clientTerm = base.org.terms.client;
    if (!bookingHasChanges(r)) {
      const problems = bookingProblems(r, clientTerm);
      if (problems.length > 0)
        setError([`入れる訪問はありませんでした（変更なし ${r.unchanged}件）`, ...problems].join('\n'));
      else toast(`変更はありませんでした（変更なし ${r.unchanged}件）`);
      return;
    }
    if (changedSince(base)) return setError(IMPORT_CHANGED_TEXT);
    const ok = await confirmDialog({
      title: '訪問を読み込みますか？',
      body: bookingConfirmBody({ fileName: file.name, r, clientTerm, keep: canKeepPrevious() }),
      confirmLabel: '読み込む',
    });
    if (!ok) return;
    if (changedSince(base)) return setError(IMPORT_CHANGED_TEXT);
    commit({
      base,
      next: r.data,
      label: '訪問の読み込み',
      done: (keep) => bookingDoneText(r, base.org.features, keep),
      onDone,
    });
  };

  /** 読んで検査し、通ったら件数を見せて確かめる（取り消しならデータは変えない） */
  const load = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      await loadBookings(file);
    } catch (e) {
      setError(
        isStaleBuild(e) ? EXCEL_STALE_TEXT : `読み込めませんでした：${formError(e)}（いまのデータはそのままです）`,
      );
    } finally {
      setBusy(false);
    }
  };
  return { load, error, busy };
}
