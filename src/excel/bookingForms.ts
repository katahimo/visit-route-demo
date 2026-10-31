// ほかのソフトの予約の形の一覧（ADR-0075。PRD D398）：予約の CSV を読むとき、1行目の列名で形を見分け、
// どの形でも同じ「予約の1件」（Booking）の並びに写す。訪問にする・〈利用者さん〉と突き合わせるのは importBookings が共通で行う。
// 新しいソフト（別の会社）の予約の CSV を読むときは、形ごとのファイル（reserveBookings のように列名と写し方を書く）を作り、
// ここの BOOKING_FORMS に1行足す
import type { BookingTable } from './booking';
import { reserveToBookings } from './reserveBookings';

/** ほかのソフトの予約の形 */
export interface BookingForm {
  /** 形の ID（訪問の ID の頭に使う。英小文字・数字・ハイフン。重ねない） */
  id: string;
  /** 確認の文に出す形の名前 */
  label: string;
  /** CSV の表（1行目が列名）→ 予約の並び。この形でなければ null */
  toBookings: (table: readonly (readonly string[])[]) => BookingTable | null;
}

/** 形の一覧（上から順に見分ける） */
export const BOOKING_FORMS: readonly BookingForm[] = [
  { id: 'reserve', label: '予約システムの予約', toBookings: reserveToBookings },
];

/** CSV の表を予約の形として読む（どの形でもなければ null） */
export function readBookingForm(
  table: readonly (readonly string[])[],
  forms: readonly BookingForm[] = BOOKING_FORMS,
): { form: BookingForm; table: BookingTable } | null {
  for (const form of forms) {
    const t = form.toBookings(table);
    if (t) return { form, table: t };
  }
  return null;
}
