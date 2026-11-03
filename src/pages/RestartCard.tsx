import { RotateCcw, Undo2 } from 'lucide-react';
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
 * データの画面の「最初からやり直す」（PRD D3・D381。ADR-0073・ADR-0092）：データを作り直す2つの操作を1枚にまとめる。
 * - デモの初期状態に戻す：今の始め方（デモの種類）と機能の入り切りのまま、データだけ戻す（呼ぶ側の onReset）
 * - 始め方を選び直す：確認のあと最初の2問へ戻る（答えるまでは今のデータのまま）。答えるとデータが作り直される
 *   （元に戻す Ctrl+Z の対象外。確認の文で先に書き出す案内を出す。1世代の控えは残す）
 */
export function RestartCard({ onReset }: { onReset: () => void }) {
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
      <SectionTitle icon={RotateCcw}>最初からやり直す</SectionTitle>
      <p className="restart-warn" data-testid="restart-first-run-warn">
        {RESTART_WARN}
      </p>
      <div className="restart-row">
        <p className="sub">
          デモの架空の事業所のデータに戻します。始め方（デモの種類）と管理者設定の機能の入り切りは、そのままです。
        </p>
        <button type="button" className="btn" onClick={onReset} data-testid="reset-demo-button">
          <WithIcon icon={RotateCcw}>デモの初期状態に戻す</WithIcon>
        </button>
      </div>
      <div className="restart-row">
        <p className="sub">{RESTART_HINT}</p>
        <button type="button" className="btn" onClick={() => void onClick()} data-testid="restart-first-run-button">
          <WithIcon icon={Undo2}>{RESTART_TITLE}</WithIcon>
        </button>
      </div>
    </section>
  );
}
