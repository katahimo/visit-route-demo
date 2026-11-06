import { keepNote } from '../lib/dataScreen';
import { RESTART_CONFIRM_LABEL, RESTART_CONFIRM_TITLE, restartConfirmBody } from '../lib/firstRun';
import { canKeepPrevious, useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';

/**
 * 最初の設定をやり直す（PRD D381。ADR-0092）：確認（いまのデータは消え「元に戻す」でも戻せないこと・先に控えを書き出す案内・
 * 直前の状態に戻せるか）のあと、最初の2問へ戻る。答えるまでは今のデータのまま、答えるとデータを作り直す（1世代の控えは残す）。
 * データの画面の「最初からやり直す」の［最初の設定をやり直す］と、登録の案内の［最初の設定をやり直す］から使う
 */
export function useRestartFirstRun(): () => Promise<void> {
  const { askFirstRun } = useDemoData();
  const confirmDialog = useConfirm();
  return async () => {
    const ok = await confirmDialog({
      title: RESTART_CONFIRM_TITLE,
      body: restartConfirmBody(keepNote(canKeepPrevious())),
      confirmLabel: RESTART_CONFIRM_LABEL,
      tone: 'danger',
    });
    if (ok) askFirstRun();
  };
}
