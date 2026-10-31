// 訪問の一覧（欄を開く入口。PRD D304・D309）：〈利用者さん〉と〈スタッフ〉の期間の訪問。
// どれも純粋関数で、DemoData を書き換えない
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { visitsIn } from '../patterns';

// ---- 一覧（欄を開く入口） ----

/** 〈利用者さん〉の、その期間の訪問（取り消しも。日付・開始の順）。〈利用者さん〉の画面の予定（PRD D304） */
export function clientVisitsIn(
  d: Pick<DemoData, 'visits' | 'patterns' | 'clients'>,
  clientId: string,
  from: string,
  to: string,
): Visit[] {
  return visitsIn(d, { from, to }).filter((v) => v.clientId === clientId);
}

/**
 * 〈スタッフ〉が担当している、その期間の訪問（訪問の担当がその人。取り消しを除く。日付・開始の順）。
 * 〈スタッフ〉の画面の予定のカレンダー（PRD D309）
 */
export function staffVisitsIn(
  d: Pick<DemoData, 'visits' | 'patterns' | 'clients'>,
  staffId: string,
  from: string,
  to: string,
): Visit[] {
  return visitsIn(d, { from, to }).filter((v) => v.staffId === staffId && !v.cancelled);
}
