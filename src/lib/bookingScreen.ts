// 予約の CSV の読み込み（ADR-0075。PRD D398）の文と判定の純粋関数。確認の本文・知らせの文を組み立てる。データの書き換えは画面が store で行う
import type { BookingImportResult } from '../contracts/data';
import type { Features } from '../contracts/features';
import { keepNote, keptSuffix, otherFormSkippedText } from './dataScreen';
import { isOn } from './features';

type KeepState = { kept: boolean; why: string | null };

/** 確認に出す名前・行の数（多ければ「ほか N件」） */
const SHOWN = 5;

/** 並びを SHOWN 件まで「・」でつなぐ */
const listText = (xs: readonly string[]): string =>
  `${xs.slice(0, SHOWN).join('・')}${xs.length > SHOWN ? ` ほか ${xs.length - SHOWN}件` : ''}`;

/** 予約の読み込みで、足す・直す訪問があるか */
export const bookingHasChanges = (r: Pick<BookingImportResult, 'added' | 'updated'>): boolean =>
  r.added + r.updated > 0;

/** 件数の行（「追加 3件・更新 1件・変更なし 5件」） */
export const bookingSummary = (r: Pick<BookingImportResult, 'added' | 'updated' | 'unchanged'>): string =>
  `追加 ${r.added}件・更新 ${r.updated}件・変更なし ${r.unchanged}件`;

/** 入れなかった予約・読めなかった行の文（無ければ空の並び） */
export function bookingProblems(r: Pick<BookingImportResult, 'unmatched' | 'badRows'>, clientTerm: string): string[] {
  return [
    ...(r.unmatched.length > 0
      ? [`入れなかった予約（${clientTerm}に名前が無い・同じ名前が2人以上）：${listText(r.unmatched)}`]
      : []),
    ...(r.badRows.length > 0 ? [`読めなかった行：${listText(r.badRows)}`] : []),
  ];
}

/** 予約の読み込みの確認の本文 */
export function bookingConfirmBody(x: {
  fileName: string;
  r: BookingImportResult;
  clientTerm: string;
  keep: KeepState;
}): string {
  const { r } = x;
  const enc = r.source.format === 'csv' ? `（文字コード ${r.source.encoding}）` : '';
  return [
    `「${x.fileName}」の予約を訪問として読み込みます。CSV${enc}・${r.otherForm.label}の形として読みました。`,
    bookingSummary(r),
    ...(r.cancelledSkipped > 0 ? [`取り消し済みの予約 ${r.cancelledSkipped}件は入れません。`] : []),
    ...bookingProblems(r, x.clientTerm),
    otherFormSkippedText(r.otherForm),
    '担当は決めません（担当なし）。同じ予約番号の訪問は日付・時刻・所要・メモをファイルに合わせ、担当・ピン・アプリでの取り消しは残します。ファイルに無い訪問はそのままです。',
    keepNote(x.keep),
  ].join('\n');
}

/** 担当の組み方の案内（エキスパート機能が入なら「担当を組む」、切なら予定の「その他 ▾」の「担当なしの訪問を組む」。ADR-0072） */
const arrangeHint = (features: Features): string =>
  isOn(features, 'expert') ? '「担当を組む」' : '予定の「その他 ▾」の「担当なしの訪問を組む」';

/** 読み込んだあとの知らせ */
export const bookingDoneText = (
  r: Pick<BookingImportResult, 'added' | 'updated'>,
  features: Features,
  keep: KeepState,
): string =>
  `予約を読み込みました（追加 ${r.added}件・更新 ${r.updated}件）。担当は${arrangeHint(features)}で組めます${keptSuffix(keep)}`;
