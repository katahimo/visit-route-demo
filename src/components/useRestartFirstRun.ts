import { keepNote } from '../lib/dataScreen';
import { RESTART_CONFIRM_LABEL, RESTART_CONFIRM_TITLE, restartConfirmBody } from '../lib/firstRun';
import { canKeepPrevious, useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';

/**
 * 始め方を選び直す（PRD D381。ADR-0092）：確認のあと最初の2問へ戻る（答えるまでは今のデータのまま）。
 * データの画面の「最初からやり直す」と、登録の案内の画面から使う
 */
export function useRestartFirstRun(): () => Promise<void> {
  const { askFirstRun } = useDemoData();
  const confirmDialog = useConfirm();
  return async () => {
    const ok = await confirmDialog({
      title: RESTART_CONFIRM_TITLE,
      body: restartConfirmBody(keepNote(canKeepPrevious(), 'データの画面')),
      confirmLabel: RESTART_CONFIRM_LABEL,
      tone: 'danger',
    });
    if (ok) askFirstRun();
  };
}
