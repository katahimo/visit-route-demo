// 機能の入り切り（ADR-0028）を画面から読むフック。store の org.features を読むだけ（書くのは画面の update(fn)）
import type { FeatureId, Features } from '../contracts/features';
import { exceptionsOnly } from '../lib/exceptionView';
import { isOn } from '../lib/features';
import { showConfirmStep } from '../lib/settledView';
import { useDemoData } from '../store';

/** 今の入り切り（無い ID は入） */
export function useFeatures(): Features {
  return useDemoData().data.org.features;
}

/** その機能が使えるか（依存も見る。lib/features の isOn） */
export function useFeature(id: FeatureId): boolean {
  return isOn(useFeatures(), id);
}

/** 確定（伝えた）の段階を出すか（エキスパート機能が入のとき。切なら自動で決まる。lib/settledView。ADR-0073） */
export function useConfirmStep(): boolean {
  return showConfirmStep(useFeatures());
}

/** 例外だけ見せるか（エキスパート機能が切のとき。lib/exceptionView。PRD D384。ADR-0073） */
export function useExceptionsOnly(): boolean {
  return exceptionsOnly(useFeatures());
}
