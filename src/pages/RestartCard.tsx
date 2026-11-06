import { RotateCcw, Undo2 } from 'lucide-react';
import { SectionTitle, WithIcon } from '../components/ui';
import { useRestartFirstRun } from '../components/useRestartFirstRun';
import { RESTART_HINT, RESTART_TITLE, RESTART_WARN } from '../lib/firstRun';

/**
 * データの画面の「最初からやり直す」（PRD D3・D381。ADR-0073・ADR-0092）：データを作り直す2つの操作を1枚にまとめる。
 * - デモの初期状態に戻す：今の始め方（デモの種類）と機能の入り切りのまま、データだけ戻す（呼ぶ側の onReset）
 * - 最初の設定をやり直す：確認のあと最初の2問へ戻る（答えるまでは今のデータのまま）。答えるとデータが作り直される
 *   （元に戻す Ctrl+Z の対象外。確認の文で先に書き出す案内を出す。1世代の控えは残す）
 */
export function RestartCard({ onReset }: { onReset: () => void }) {
  const onClick = useRestartFirstRun();
  return (
    <section className="card stack" data-testid="restart-first-run">
      <SectionTitle icon={RotateCcw}>最初からやり直す</SectionTitle>
      <p className="restart-warn" data-testid="restart-first-run-warn">
        {RESTART_WARN}
      </p>
      <div className="restart-row">
        <p className="sub">デモのデータに戻します。機能の入り切りはそのままです。</p>
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
