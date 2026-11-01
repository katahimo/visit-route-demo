import type { Problem } from '../contracts/problem';
import { type BulkConfirm, bulkConfirmDialog, confirmDays, confirmReady } from '../lib/confirmDay';
import { monthBatch } from '../lib/monthBatch';
import { useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';

/**
 * 問題の無い日をまとめて確定（PRD D223・D328）：月の予定と週の予定で同じ確認の型・同じ書き方。
 * 独自の確認（日付と残す日）のあと、1回の update で日ごとに日の画面の「この割当で確定」と同じ書き方（lib/confirmDay）。
 * 担当を組んでいる間（monthBatch）は確定しない。problemOf は日の状態を数えたときの問題、afterDone は確定のあとのフォーカスの移し先
 */
export function useBulkConfirm(problemOf: (date: string) => Problem | null | undefined, afterDone: () => void) {
  const { data, update } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  return async (bulk: BulkConfirm) => {
    const targets = bulk.targets;
    if (monthBatch.running() || targets.length === 0) return;
    const ok = await confirmDialog({
      ...bulkConfirmDialog(bulk, data.org.terms.staff),
      confirmLabel: `${targets.length}日を確定する`,
    });
    if (!ok || monthBatch.running()) return;
    const ready = confirmReady(targets, problemOf);
    if (ready.length === 0) return;
    const at = Date.now();
    update((d) => confirmDays(d, ready, at), `${ready.length}日をまとめて確定`);
    toast(`${ready.length}日を確定しました`);
    requestAnimationFrame(afterDone);
  };
}
