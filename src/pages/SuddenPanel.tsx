// 「欠勤・キャンセル」の欄（PRD D167〜D172。ADR-0025・ADR-0011・ADR-0015）：日の画面の入口・列の見出しの「急な欠勤」・
// 日の予定の「欠勤・キャンセルを登録」などから開く、段階のある右の欄。1 何が起きたか → 2 人（時間帯）・訪問を選ぶ → 3 影響の確認と振り直し → 4 選んで確定
// → 5 連絡（PRD D243〜D246。ADR-0038）。振り直しの計算は足さない（見込みは previewOf、振り直し・案B・確定・元に戻すは日の画面の
// 今の操作を呼ぶ。連絡の一覧は日の画面が lib/contacts の contactRows で作って渡す）。
// 段階の状態と処理は useSuddenSteps、段ごとの中身は suddenSteps.tsx
import { Check, UserRoundX } from 'lucide-react';
import { SidePanel } from '../components/ui';
import { type SuddenStep, suddenSteps } from '../lib/sudden';
import { contactStep } from './suddenContactStep';
import { absenceImpactStep, cancelImpactStep, doneStep, kindStep, staffStep, visitStep } from './suddenSteps';
import { type StepView, type SuddenPanelProps, useSuddenSteps } from './useSuddenSteps';

/** いまの段の中身と下の帯（段と種類と入力から選ぶ） */
function stepView(ctx: Parameters<typeof kindStep>[0]): StepView {
  const { step, kind, absence, visitId, done } = ctx.s;
  if (step === 1) return kindStep(ctx);
  if (step === 2 && kind === 'staff') return staffStep(ctx);
  if (step === 2 && kind === 'client') return visitStep(ctx);
  if (step === 3 && kind === 'staff' && absence) return absenceImpactStep(ctx, absence);
  if (step === 3 && kind === 'client' && visitId) return cancelImpactStep(ctx, visitId);
  if (step === 4 && done) return doneStep(ctx, done);
  if (step === 5 && done) return contactStep(ctx, done);
  return { body: null, footer: null };
}

export function SuddenPanel(p: SuddenPanelProps) {
  const s = useSuddenSteps(p);
  const { step, kind, staffId, error, go, close } = s;
  const { fallbackFocus, returnFocus } = p;
  const { body, footer } = stepView({ p, s });
  const names = suddenSteps(kind);
  return (
    <SidePanel
      narrow
      icon={UserRoundX}
      title="欠勤・キャンセル"
      onClose={close}
      focusKey={`${step}-${kind ?? ''}`}
      fallbackFocus={fallbackFocus}
      returnFocus={returnFocus}
      footer={footer}
      // 2段目（欠勤の入力）は form にして、メモの Enter・「次へ」で進む（PRD D251）
      onSubmit={
        step === 2 && kind === 'staff'
          ? () => {
              if (staffId && !error) go(3);
            }
          : undefined
      }
    >
      <div className="stack sudden-panel" style={{ gap: 12 }} data-testid="sudden-panel" data-step={step}>
        <ol className="sudden-steps" aria-label="段階">
          {names.map((n, i) => {
            const no = (i + 1) as SuddenStep;
            return (
              <li
                key={n}
                className={no === step ? 'is-current' : no < step ? 'is-done' : ''}
                aria-current={no === step ? 'step' : undefined}
              >
                <span className="sudden-step-no" aria-hidden="true">
                  {no < step ? <Check size={12} /> : no}
                </span>
                <span className="sudden-step-name">{n}</span>
              </li>
            );
          })}
        </ol>
        {body}
      </div>
    </SidePanel>
  );
}
