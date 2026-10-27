// 担当を組む画面の「AI で組む」を始める処理と、始められなかった理由の表示
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { confirmDropProposal } from '../components/scheduleParts';
import { useToast } from '../components/Toast';
import { markArrangeStart } from '../components/useArrangeBasis';
import type { BatchMode } from '../lib/month';
import { type BatchSource, monthBatch } from '../lib/monthBatch';
import { useDemoData } from '../store';

/** 組む範囲と日の決まり（画面で選んだもの）。条件はいつもデータの条件（点数の基準。ADR-0065） */
export type ArrangeStartPlan = {
  scope: BatchSource;
  ym: string;
  at: string;
  today: string;
  rangeLabel: string;
  mode: BatchMode;
  /** 組む日（作り方に合う日） */
  targets: readonly string[];
};

export function useArrangeStart(plan: ArrangeStartPlan) {
  const toast = useToast();
  const { data } = useDemoData();
  const confirmDialog = useConfirm();
  const [error, setError] = useState<string | null>(null);

  /**
   * 選んだ範囲を AI で組む（ピンの訪問はそのまま。終わったら提案の帯。反映するまで訪問は変わらない）。
   * days を渡すとその作り方・日で組む（基本情報が変わったときの［組み直す］は伝えていない日をすべて。ADR-0067）
   */
  const start = async (days?: { mode: BatchMode; targets: readonly string[] }) => {
    const { scope, ym, at, today, rangeLabel } = plan;
    const { mode, targets } = days ?? plan;
    if (monthBatch.running()) return;
    setError(null);
    if (targets.length === 0) {
      setError('組む日がありません（今日より前の日・確定した日は組みません）');
      return;
    }
    if (!(await confirmDropProposal(confirmDialog)) || monthBatch.running()) return;
    const ok = monthBatch.start({
      ym,
      label: rangeLabel,
      mode,
      days: targets.map((date) => ({ date, mode })),
      today,
      source: scope,
      rangeStart: scope === 'month' ? null : at,
    });
    if (!ok) toast('ほかの担当を組んでいます。終わってから押してください');
    // 提案の前提（基本情報）を控える。反映でこの鍵を覚える（ADR-0067）
    else markArrangeStart(data);
  };
  return { error, setError, start };
}
