// 担当を組む画面の「AI で組む」を始める処理と、始められなかった理由の表示
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { confirmDropProposal } from '../components/scheduleParts';
import { useToast } from '../components/Toast';
import type { Preset, Rule } from '../contracts/rules';
import type { BatchMode } from '../lib/month';
import { type BatchSource, type BatchVariant, monthBatch } from '../lib/monthBatch';
import { applyPreset } from '../seed';

/** 組む範囲と日の決まり（画面で選んだもの） */
export type ArrangeStartPlan = {
  rules: Rule[];
  scope: BatchSource;
  ym: string;
  at: string;
  today: string;
  rangeLabel: string;
  mode: BatchMode;
  /** 作り方に合う日 */
  targets: readonly string[];
  /** 組む日（考え方ごとの案は伝えていない日） */
  runTargets: readonly string[];
  variants: BatchVariant[] | null;
  /** 選んだ考え方（無ければ点数の基準のまま） */
  preset: Preset | null;
};

export function useArrangeStart(plan: ArrangeStartPlan) {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [error, setError] = useState<string | null>(null);

  /** 選んだ範囲を AI で組む（ピンの訪問はそのまま。終わったら提案の帯。反映するまで訪問は変わらない） */
  const start = async () => {
    const { rules: dataRules, scope, ym, at, today, rangeLabel, mode, targets, runTargets, variants, preset } = plan;
    if (monthBatch.running()) return;
    setError(null);
    if (runTargets.length === 0) {
      setError('組む日がありません（今日より前の日・確定した日は組みません）');
      return;
    }
    if (!(await confirmDropProposal(confirmDialog)) || monthBatch.running()) return;
    if (variants) {
      const ok = monthBatch.start({
        ym,
        label: rangeLabel,
        mode: 'all',
        days: runTargets.map((date) => ({ date, mode: 'all' as const })),
        today,
        source: scope,
        rangeStart: at,
        variants,
      });
      if (!ok) toast('ほかの担当を組んでいます。終わってから押してください');
      return;
    }
    const rules: Rule[] | undefined = preset ? applyPreset(dataRules, preset) : undefined;
    const ok = monthBatch.start({
      ym,
      label: preset ? `${rangeLabel}（${preset.name}）` : rangeLabel,
      mode,
      days: targets.map((date) => ({ date, mode })),
      today,
      source: scope,
      rangeStart: scope === 'month' ? null : at,
      ...(rules ? { rules } : {}),
    });
    if (!ok) toast('ほかの担当を組んでいます。終わってから押してください');
  };
  return { error, setError, start };
}
