// 条件の重みの画面のプリセットの管理（D20・D235。ADR-0008・ADR-0035・ADR-0100）の状態と処理：点数の基準を替える・名前と一言を直す・消す。
// プリセットの重み・必須は変えない。データの組み立ては lib/presets
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import type { Preset } from '../contracts/rules';
import { isInitialPreset, removePreset, renamePreset, setScorePreset } from '../lib/presets';
import { scorePresetOf } from '../seed';
import { useDemoData } from '../store';

export function usePresetSection({ draftCount }: { draftCount: number }) {
  const { data, update } = useDemoData();
  const confirmDialog = useConfirm();
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  /** 点数の基準のプリセット（ADR-0010） */
  const ruler = scorePresetOf(data.presets, data.scorePresetId);
  // #/rules#presets から来たら、畳んだ管理を開いてこの節を見せる
  useEffect(() => {
    if (location.hash !== '#presets') return;
    const fold = ref.current?.closest('details');
    if (fold) fold.open = true;
    ref.current?.scrollIntoView({ block: 'start' });
  }, [location.hash]);
  /** 名前・一言を直す（すぐ保存。重みは変わらないので点に影響しない） */
  const rename = (id: string, patch: Partial<Pick<Preset, 'name' | 'note'>>) =>
    update((d) => renamePreset(d, id, patch));
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
  /** 消す（初期の3つと最後の1つは消せない。基準を消すと基準は残りの先頭へ） */
  const remove = async (p: Preset) => {
    if (data.presets.length <= 1 || isInitialPreset(p.id)) return;
    const next = data.presets.find((x) => x.id !== p.id);
    const dropNote = draftCount > 0 ? `\n確定していない重みの変更（${draftCount}件）は捨てます。` : '';
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
  return { ref, ruler, rename, choose, remove };
}
