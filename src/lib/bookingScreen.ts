// 予約の CSV の読み込み（ADR-0075。PRD D408）の文と判定の純粋関数。確認の本文・知らせの文を組み立てる。データの書き換えは画面が store で行う
import type { BookingImportResult } from '../contracts/data';
import { keepNote, keptSuffix, otherFormSkippedText } from './dataScreen';

type KeepState = { kept: boolean; why: string | null };

/** 確認に出す名前・行の数（多ければ「ほか N件」） */
const SHOWN = 5;

/** 並びを SHOWN 件まで「・」でつなぐ */
const listText = (xs: readonly string[]): string =>
  `${xs.slice(0, SHOWN).join('・')}${xs.length > SHOWN ? ` ほか ${xs.length - SHOWN}件` : ''}`;

/** 予約の読み込みで、足す・直す・消す訪問があるか */
export const bookingHasChanges = (r: Pick<BookingImportResult, 'added' | 'updated' | 'removed'>): boolean =>
  r.added + r.updated + r.removed > 0;

/** 件数の行（「追加 3件・更新 1件・削除 2件・変更なし 5件」） */
export const bookingSummary = (r: Pick<BookingImportResult, 'added' | 'updated' | 'removed' | 'unchanged'>): string =>
  `追加 ${r.added}件・更新 ${r.updated}件・削除 ${r.removed}件・変更なし ${r.unchanged}件`;

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
  /** 勤務日・時間に入らない予約の文（lib/bookingFit の outsideHoursNote。PRD D428）。無ければ null */
  outsideNote?: string | null;
}): string {
  const { r } = x;
  return [
    `「${x.fileName}」を訪問として読み込みます（${r.otherForm.label}の CSV）。`,
    bookingSummary(r),
    ...(r.keptMissing
      ? ['読めない行・入れなかった行があるので、ファイルに無い訪問は消しません（直して読み直すと消します）。']
      : []),
    ...(r.cancelledSkipped > 0 ? [`取り消し済みで、まだ入れていない ${r.cancelledSkipped}件は入れません。`] : []),
    ...bookingProblems(r, x.clientTerm),
    ...(x.outsideNote ? [x.outsideNote] : []),
    otherFormSkippedText(r.otherForm),
    '総入れ替えです。ファイルの最初の日〜最後の日の単発の訪問をファイルに合わせ、ファイルに無い訪問と取り消しの予約の訪問は消します（繰り返しの訪問・範囲の外の日はそのまま）。アプリで取り消した訪問も、ファイルで有効なら戻します。すでに入っている予約の担当は残ります。読み込んだあと、担当なしと要対応を自動で組みます。',
    keepNote(x.keep),
  ].join('\n');
}

/** 読み込んだあとの知らせ（担当なし・要対応はこのあと自動で組む。PRD D442） */
export const bookingDoneText = (
  r: Pick<BookingImportResult, 'added' | 'updated' | 'removed'>,
  keep: KeepState,
): string =>
  `訪問を読み込みました（追加 ${r.added}件・更新 ${r.updated}件・削除 ${r.removed}件）。担当なしは自動で組みます${keptSuffix(keep)}`;
