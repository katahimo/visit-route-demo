// 考え方ごとの案の帯の「この日だけ反映」「この案を標準にする」の処理（確認のあと反映し、結果をトーストで知らせる）
import type { DemoData } from '../contracts/data';
import { adoptBody, STALE_TEXT } from '../lib/choiceBandView';
import { newId } from '../lib/common';
import { mdText } from '../lib/dateText';
import { type BatchProposal, monthBatch } from '../lib/monthBatch';
import { dayStandardPreview, registerDayStandard } from '../lib/standard';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';

export function useChoiceActions(proposal: BatchProposal, data: DemoData, today: string) {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const choices = proposal.choices ?? [];
  const applyOnly = (i: number) => {
    const c = choices[i];
    const r = monthBatch.apply({ id: proposal.id, choice: i });
    if (!r || !c) return;
    toast(r.applied.length === 0 ? STALE_TEXT : `「${c.name}」の案を${proposal.label}に反映しました`);
  };
  const adopt = async (i: number) => {
    const c = choices[i];
    const d = c?.days[0];
    if (!c || !d) return;
    const pv = dayStandardPreview(data, d, today);
    const { weekdayLabel: wd, body } = adoptBody(c, pv, d.date);
    const yes = await confirmDialog({
      title: `「${c.name}」の案を組み方の標準にしますか？`,
      body,
      confirmLabel: 'この案を標準にする',
    });
    if (!yes) return;
    const r = monthBatch.apply({
      id: proposal.id,
      choice: i,
      andThen: (x) => registerDayStandard(x, d, c.presetId, today, { newId: () => newId('pattern'), at: Date.now() }),
      label: `組み方の標準にする（${c.name}）`,
    });
    if (!r) return;
    toast(
      r.applied.length === 0
        ? STALE_TEXT
        : `「${c.name}」を組み方の標準にしました。${mdText(pv.since)}から毎週${wd}曜はこの案のとおりに並びます`,
    );
  };
  return { applyOnly, adopt };
}
