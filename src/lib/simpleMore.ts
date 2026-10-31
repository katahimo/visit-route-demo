// 予定の「その他 ▾」に足す項目の出し分け（PRD D383・D390）。React を持ち込まない純粋関数
import type { Features } from '../contracts/features';
import { exceptionsOnly } from './exceptionView';
import { isHrefOn } from './features';

/** 足す項目の種類：担当なしの訪問を組む（ホームの［組む］の代わり。切のとき）・空き状況（メニューから外した。入切とも） */
export type SimpleMoreKind = 'auto-arrange' | 'vacancy';

/**
 * 足す項目（並びのまま）：切なら、担当なしの訪問（今日〜翌月末の組める分）が1件以上あれば「担当なしの訪問を組む」
 * （入は「担当を組む」の画面で組むので出さない）。空き状況は入切とも、切っていなければ出す
 */
export function simpleMoreKinds(features: Features, unassigned: number): SimpleMoreKind[] {
  return [
    ...(exceptionsOnly(features) && unassigned > 0 ? (['auto-arrange'] as const) : []),
    ...(isHrefOn(features, '/vacancy') ? (['vacancy'] as const) : []),
  ];
}
