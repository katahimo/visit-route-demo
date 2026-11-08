import { Undo2 } from 'lucide-react';
import { SectionTitle, WithIcon } from '../components/ui';
import { useRestartFirstRun } from '../components/useRestartFirstRun';
import { RESTART_HINT, RESTART_TITLE, RESTART_WARN } from '../lib/firstRun';

/**
 * データの画面のいちばん下の「最初の設定をやり直す」（PRD D381。ADR-0092）：確認のあと最初の2問へ戻る（答えるまでは今のデータのまま）。
 * 答えるとデータが作り直される（元に戻す Ctrl+Z の対象外。確認の文で先に書き出す案内を出す。1世代の控えは残す）。
 * デモのデータに戻すのも、ここで「デモで試す」を選び直す（「デモの初期状態に戻す」は置かない）
 */
export function RestartCard() {
  const onClick = useRestartFirstRun();
  return (
    <section className="card stack" data-testid="restart-first-run">
      <SectionTitle icon={Undo2}>{RESTART_TITLE}</SectionTitle>
      <p className="restart-warn" data-testid="restart-first-run-warn">
        {RESTART_WARN}
      </p>
      <div className="restart-row">
        <p className="sub">{RESTART_HINT}</p>
        <button type="button" className="btn" onClick={() => void onClick()} data-testid="restart-first-run-button">
          <WithIcon icon={Undo2}>{RESTART_TITLE}</WithIcon>
        </button>
      </div>
    </section>
  );
}
