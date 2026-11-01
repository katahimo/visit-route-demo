// 「欠勤・キャンセル」の欄（PRD D167〜D172・D414。ADR-0025・ADR-0011・ADR-0082）：日の画面の入口・列の見出しの「この人の欠勤を登録」・
// 日の予定の「欠勤・キャンセルを登録」などから開く右の欄。2段：1 何が起きたか（種類・人（訪問）・時間を選ぶと見込みとおすすめ。
// ［この案で決める］で登録と振り直しを1手で書く）→ 2 連絡・確定（PRD D244〜D246。ADR-0038）。振り直しの計算は足さない（見込みは
// lib/planReassign の absencePreviewOf、振り直し・案B・確定・振り直す前に戻すは日の画面の今の操作を呼ぶ。連絡の一覧は日の画面が
// lib/contacts の contactRows で作って渡す）。段の状態と処理は useSuddenSteps、段ごとの中身は suddenSteps.tsx・suddenContactStep.tsx
import { UserRoundX } from 'lucide-react';
import { SidePanel } from '../components/ui';
import { contactStep } from './suddenContactStep';
import { whatStep } from './suddenSteps';
import { type SuddenPanelProps, useSuddenSteps } from './useSuddenSteps';

export function SuddenPanel(p: SuddenPanelProps) {
  const s = useSuddenSteps(p);
  const { step, done, close } = s;
  const { fallbackFocus, returnFocus } = p;
  const { body, footer } = step === 2 && done ? contactStep({ p, s }, done) : whatStep({ p, s });
  return (
    <SidePanel
      narrow
      icon={UserRoundX}
      title="欠勤・キャンセル"
      onClose={close}
      focusKey={String(step)}
      fallbackFocus={fallbackFocus}
      returnFocus={returnFocus}
      footer={footer}
      // 1段目は form にして、欠勤のメモの Enter で主ボタンと同じ（［この案で決める］、担当のある訪問が無い日は［欠勤だけ登録］。PRD D251）。
      // 種類を選んでも form のまま（form と div を切り替えると中身が作り直され、押したボタンのフォーカスが消える）
      onSubmit={step === 1 ? s.submit : undefined}
    >
      <div className="stack sudden-panel" style={{ gap: 12 }} data-testid="sudden-panel" data-step={step}>
        {body}
      </div>
    </SidePanel>
  );
}
