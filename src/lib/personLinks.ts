// 名前から詳細を開く場所を足す（PRD D205〜D209。ADR-0022）ための純粋関数：
// 日の画面の休みの帯の〈利用者さん〉（稼働の見込みへのリンクは lib/links の workloadHref）
import type { ClientLeave } from '../contracts/documents';
import { leaveOn } from '../domain/leaves';

/** 休みのため無しの訪問の〈利用者さん〉1人ぶん（name は空ならデータにいない人。note は休みの理由） */
export type LeavePerson = { clientId: string; name: string; note: string };

/**
 * 休みのため無しの訪問から〈利用者さん〉を重ねずに並べる（最初に出た順）。名前はデータに無ければ空、理由は
 * その日の休みのメモ（無ければ空）。日の画面の「〈利用者さん〉の休みのため無し」の帯で使う（PRD D208）
 */
export function leavePeople(
  visits: readonly { clientId: string }[],
  leaves: readonly ClientLeave[],
  date: string,
  nameOf: (clientId: string) => string | undefined,
): LeavePerson[] {
  const seen = new Map<string, LeavePerson>();
  for (const v of visits) {
    if (seen.has(v.clientId)) continue;
    seen.set(v.clientId, {
      clientId: v.clientId,
      name: nameOf(v.clientId) ?? '',
      note: leaveOn(leaves, v.clientId, date)?.note ?? '',
    });
  }
  return [...seen.values()];
}
