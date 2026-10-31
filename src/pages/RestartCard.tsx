import { RotateCcw } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';
import { SectionTitle, WithIcon } from '../components/ui';
import { keepNote } from '../lib/dataScreen';
import {
  RESTART_CONFIRM_LABEL,
  RESTART_CONFIRM_TITLE,
  RESTART_HINT,
  RESTART_TITLE,
  RESTART_WARN,
  restartConfirmBody,
} from '../lib/firstRun';
import { canKeepPrevious, useDemoData } from '../store';

/**
 * 設定の「最初の設定をやり直す」（PRD D381。ADR-0073）：確認のあと最初の2問へ戻る（答えるまでは今のデータのまま）。
 * 答えるとデータが作り直される（元に戻す Ctrl+Z の対象外。確認の文で先に書き出す案内を出す。1世代の控えは残す）
 */
export function RestartCard() {
  const { askFirstRun } = useDemoData();
  const confirmDialog = useConfirm();
  const onClick = async () => {
    const ok = await confirmDialog({
      title: RESTART_CONFIRM_TITLE,
      body: restartConfirmBody(keepNote(canKeepPrevious(), 'データの画面')),
      confirmLabel: RESTART_CONFIRM_LABEL,
      tone: 'danger',
    });
    if (ok) askFirstRun();
  };
  return (
    <section className="card stack" data-testid="restart-first-run">
      <SectionTitle icon={RotateCcw}>{RESTART_TITLE}</SectionTitle>
      <p className="sub">{RESTART_HINT}</p>
      <p className="restart-warn" data-testid="restart-first-run-warn">
        {RESTART_WARN}
      </p>
      <button
        type="button"
        className="btn"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => void onClick()}
        data-testid="restart-first-run-button"
      >
        <WithIcon icon={RotateCcw}>{RESTART_TITLE}</WithIcon>
      </button>
    </section>
  );
}
