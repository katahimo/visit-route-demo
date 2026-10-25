// 条件の重みの画面のプリセットの節（D20・D24・D235。ADR-0008・ADR-0035）の状態と処理：点数の基準を替える・直す・消す・初期値に戻す。
// データの組み立ては lib/presets
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import type { Preset, RuleType } from '../contracts/rules';
import { patchPreset, removePreset, resetPresets, setScorePreset, trialPresetOf } from '../lib/presets';
import { scorePresetOf } from '../seed';
import { useDemoData } from '../store';

export function usePresetSection({ draftCount, onReset }: { draftCount: number; onReset: () => void }) {
  const { data, update } = useDemoData();
  const confirmDialog = useConfirm();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  /** 条件の重みが当てはまるプリセット（基準を先に見る。版2ではいつも基準） */
  const current = trialPresetOf(data);
  /** 点数の基準のプリセット（ADR-0010） */
  const ruler = scorePresetOf(data.presets, data.scorePresetId);
  // 予定の画面の「プリセットを編集する」（#/rules#presets）から来たら、この節を見せる
  useEffect(() => {
    if (location.hash === '#presets') ref.current?.scrollIntoView({ block: 'start' });
  }, [location.hash]);
  const set = (id: string, patch: Partial<Omit<Preset, 'id'>>) => update((d) => patchPreset(d, id, patch));
  /** 確定していない重みの変更を捨てることの断り（基準を替える・基準のプリセットを消すとき） */
  const dropNote = draftCount > 0 ? `\n確定していない重みの変更（${draftCount}件）は捨てます。` : '';
  /** 点数の基準を替える。重みの下書きがあれば、捨てることを確かめてから（黙って捨てない。PRD D286） */
  const choose = async (p: Preset) => {
    if (ruler?.id === p.id) return;
    if (draftCount > 0) {
      const ok = await confirmDialog({
        title: `点数の基準を「${p.name}」に替えますか？`,
        body: `確定していない重みの変更（${draftCount}件）は捨てます。`,
        confirmLabel: '捨てて替える',
        cancelLabel: '編集を続ける',
        tone: 'danger',
      });
      if (!ok) return;
    }
    update((d) => setScorePreset(d, p.id), '点数の基準のプリセット');
  };
  const setWeight = (p: Preset, t: RuleType, w: Partial<{ weight: number; hard: boolean }>) =>
    set(p.id, { weights: { ...p.weights, [t]: { ...p.weights[t], ...w } } });
  const remove = async (p: Preset) => {
    if (data.presets.length <= 1) return;
    const next = data.presets.find((x) => x.id !== p.id);
    const moved =
      ruler?.id === p.id && next ? `\n点数の基準は「${next.name}」に移り、点数が変わります。${dropNote}` : '';
    const ok = await confirmDialog({
      title: `プリセット「${p.name}」を消しますか？`,
      body: `今の担当はそのままです。${moved}`,
      confirmLabel: '消す',
      tone: 'danger',
    });
    if (!ok) return;
    update((d) => removePreset(d, p.id), 'プリセットを消す');
  };
  const reset = async () => {
    const ok = await confirmDialog({
      title: 'プリセットを初期の3つに戻しますか？',
      body: `初期の3つ（バランス・移動を短く・人の組み合わせ重視）に戻します。足したプリセットは消え、点数の基準は「バランス」になります。${dropNote}`,
      confirmLabel: '初期の3つに戻す',
      tone: 'danger',
    });
    if (!ok) return;
    update(resetPresets, 'プリセットを初めに戻す');
    // 初期の3つに戻したら、表の重みの下書きも捨てる（戻した重みと比べる下書きは意味が変わるので）
    onReset();
  };
  return { ref, current, ruler, set, choose, setWeight, remove, reset };
}
