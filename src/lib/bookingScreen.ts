// 予約の CSV の読み込み（ADR-0075。PRD D408）の文と判定の純粋関数。確認の本文・知らせの文を組み立てる。データの書き換えは画面が store で行う
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

/** 入れなかった行・読めなかった行の文（無ければ空の並び） */
export function bookingProblems(r: Pick<BookingImportResult, 'unmatched' | 'badRows'>, clientTerm: string): string[] {
  return [
    ...(r.unmatched.length > 0
      ? [`入れなかった行（${clientTerm}に名前が無い・同じ名前が2人以上）：${listText(r.unmatched)}`]
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
  return [
    `「${x.fileName}」を訪問として読み込みます（${r.otherForm.label}の CSV）。`,
    bookingSummary(r),
    ...(r.cancelledSkipped > 0 ? [`取り消し済みで、まだ入れていない ${r.cancelledSkipped}件は入れません。`] : []),
    ...bookingProblems(r, x.clientTerm),
    otherFormSkippedText(r.otherForm),
    '担当は空のままです。すでに入っている予約は、日時・所要時間・メモをファイルに合わせます（担当は残ります）。ファイルに無い訪問はそのままです。',
    keepNote(x.keep),
  ].join('\n');
}

/** 担当の組み方の案内（エキスパート機能が入なら「担当を組む」、切なら予定の上の要対応の帯の「要対応を組む」。ADR-0072・ADR-0077・ADR-0089） */
const arrangeHint = (features: Features): string =>
  isOn(features, 'expert') ? '「担当を組む」' : '予定の上の要対応の帯の「要対応を組む」';

/** 読み込んだあとの知らせ */
export const bookingDoneText = (
  r: Pick<BookingImportResult, 'added' | 'updated'>,
  features: Features,
  keep: KeepState,
): string =>
  `訪問を読み込みました（追加 ${r.added}件・更新 ${r.updated}件）。担当は${arrangeHint(features)}で組めます${keptSuffix(keep)}`;
