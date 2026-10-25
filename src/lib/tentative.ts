// 〈利用者さん〉の画面の「仮押さえを取り消す」（D47。ADR-0012）の純粋関数。取り消す処理（相性からも除く repair を通す）は store/tentative
import type { DemoData } from '../contracts/data';

/** その〈利用者さん〉の訪問を伝えた日（確定した日。日付の順・重複なし） */
export function confirmedDatesOf(d: Pick<DemoData, 'snapshots'>, clientId: string): string[] {
  return Object.values(d.snapshots)
    .filter((s) => s.visits.some((v) => v.clientId === clientId))
    .map((s) => s.date)
    .sort();
}
