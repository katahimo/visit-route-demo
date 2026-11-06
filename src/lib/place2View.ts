// 期間つきの訪問先（住所2。PRD D439。ADR-0105）を〈利用者さん〉の画面に出す文
import type { ClientPlace2 } from '../contracts/documents';
import { dateText } from './dateText';
import { formatPostalCode } from './postalCode';

/** 住所2 の住所（郵便番号があれば前に〒） */
export const place2AddressText = (p: Pick<ClientPlace2, 'address' | 'postalCode'>): string =>
  p.postalCode ? `〒${formatPostalCode(p.postalCode)} ${p.address}` : p.address;

/** 年の付いた日付（「2026/8/1（土）」） */
const ymdText = (date: string): string => `${date.slice(0, 4)}/${dateText(date)}`;

/** 住所2 の期間（「2026/8/1（土）〜2026/8/30（日）」。空の端は「から」「まで」。両方空は「いつも（期間なし）」） */
export function place2TermText(p: Pick<ClientPlace2, 'from' | 'to'>): string {
  if (p.from === '' && p.to === '') return 'いつも（期間なし）';
  if (p.to === '') return `${ymdText(p.from)}から`;
  if (p.from === '') return `${ymdText(p.to)}まで`;
  return `${ymdText(p.from)}〜${ymdText(p.to)}`;
}

/** 住所2 の説明（画面の補足） */
export const PLACE2_NOTE =
  '住所2 の期間の訪問は、住所2 へ行きます（移動の見積もり・地図・道順・メールも住所2）。住所2 は予約システムの顧客の CSV・Excel から読み込みます';
