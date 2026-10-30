// データの画面の「古い訪問を片づける」（PRD D227。ADR-0032・ADR-0053）：選んだ月より前の日の保存した訪問・伝えた内容だけ消す。
// 容量が足りないときの案内から欄へ移れるよう、欄の要素も持つ
import { useMemo, useRef, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { jstDate } from '../domain/time';
import { tidyConfirmBody, tidyHasAny } from '../lib/dataScreen';
import { tidyMonthLabel, tidyMonthOptions, tidyOld, tidyPreview } from '../lib/tidy';
import { useDemoData } from '../store';

export function useDataTidy() {
  const { data, update } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const choice = useMemo(() => tidyMonthOptions(jstDate(Date.now())), []);
  const [ym, setYm] = useState(choice.initial);
  const preview = useMemo(() => tidyPreview(data, ym), [data, ym]);
  const cardRef = useRef<HTMLElement>(null);
  const run = async () => {
    if (!tidyHasAny(preview)) return;
    const ok = await confirmDialog({
      title: `${tidyMonthLabel(ym)}の訪問の記録を消しますか？`,
      body: tidyConfirmBody(preview),
      confirmLabel: '消す',
      tone: 'danger',
    });
    if (!ok) return;
    const target = ym;
    // 戻せない操作：全体の「元に戻す」の履歴に積まず、履歴を捨てる（前の手へ戻すと消した記録が戻り、容量が足りなくなるため。PRD D329）
    update((d) => tidyOld(d, target), '古い記録を消す', { history: false, tell: false });
    toast(`${tidyMonthLabel(target)}の訪問の記録を消しました`);
  };
  /** 容量が足りないときの案内から、片づけの欄へ移る */
  const goToCard = () => {
    cardRef.current?.scrollIntoView({ block: 'center' });
    cardRef.current?.focus();
  };
  return { options: choice.options, ym, setYm, preview, cardRef, run, goToCard };
}

export type DataTidy = ReturnType<typeof useDataTidy>;
