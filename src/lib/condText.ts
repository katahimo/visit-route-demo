// 条件の表示文（〈利用者さん〉・〈スタッフ〉の条件の一覧・詳細の吹き出しで同じ文にする。純粋関数）
import type { Condition, Item } from '../contracts/rules';
import { conditionText } from '../matching';
import { attempt } from './common';

/** 条件の表示文（matching.conditionText。あり/なしは「項目：あり」の形に） */
export function condText(cond: Condition, item: Item | undefined): string {
  if (item?.kind === 'flag' && typeof cond.value === 'boolean' && (cond.op === 'is' || cond.op === 'not')) {
    const yes = cond.op === 'is' ? cond.value : !cond.value;
    return `${item.name}：${yes ? 'あり' : 'なし'}${cond.op === 'not' ? '（未確認も可）' : ''}`;
  }
  const r = attempt(() => conditionText(cond, item));
  if (r.value !== null) return r.value;
  if (!item) return '（項目がありません：無効）';
  return item.name;
}
