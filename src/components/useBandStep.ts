// 要対応の帯の［見に行く ›］で順番に見に行く（PRD D403。ADR-0089）：見た位置（最後に見た訪問と押した回数）をモジュールの入れ物に
// 画面の間だけ覚え（予定の月・週・日を移っても続く。保存しない）、押したときの帯の並びから次・前の1件を選ぶ（lib/attentionBand の bandStep）
import { type AttentionBand, type BandGo, type BandSeen, bandPlace, bandStep, visitTo } from '../lib/attentionBand';
import { createValueStore } from '../lib/valueStore';
import { useValueStore } from './valueStore';

/** 見た位置（アプリで1つ。読み直すと最初から） */
const seenStore = createValueStore<BandSeen | null>(null);

/** 帯の「n/N」（2件目から。無ければ null）と、次・前の行き先を選んで見た位置を進める（訪問の種類が無ければ帯の go） */
export function useBandStep(band: AttentionBand | null): {
  place: { n: number; total: number } | null;
  step: (dir: 1 | -1) => BandGo | null;
} {
  const seen = useValueStore(seenStore);
  const list = band?.visits ?? [];
  return {
    place: bandPlace(list, seen),
    step: (dir) => {
      if (!band) return null;
      const r = bandStep(list, seenStore.get()?.visit ?? null, dir);
      if (!r) return band.go;
      seenStore.set((s) => ({ visit: r.visit, presses: (s?.presses ?? 0) + 1 }));
      return visitTo(r.visit);
    },
  };
}
