// 予定の「その他 ▾」に足す項目の出し分け（エキスパート機能が切のとき。PRD D383）。React を持ち込まない純粋関数
import type { Features } from '../contracts/features';
import { isHrefOn } from './features';
import { isSimpleMenu } from './nav';

/** 足す項目の種類：担当なしの訪問を組む（ホームの［組む］の代わり）・空き状況（メニューから外した） */
export type SimpleMoreKind = 'auto-arrange' | 'vacancy';

/**
 * 足す項目（並びのまま）：エキスパート機能が入なら無し。切なら、担当なしの訪問（今日〜翌月末の組める分）が1件以上あれば「担当なしの訪問を組む」、
 * 空き状況を切っていなければ「空き状況」
 */
export function simpleMoreKinds(features: Features, unassigned: number): SimpleMoreKind[] {
  if (!isSimpleMenu(features)) return [];
  return [
    ...(unassigned > 0 ? (['auto-arrange'] as const) : []),
    ...(isHrefOn(features, '/vacancy') ? (['vacancy'] as const) : []),
  ];
}
