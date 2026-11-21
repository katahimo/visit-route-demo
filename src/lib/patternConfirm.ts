// 〈利用者さん〉の繰り返し（定期パターン）を 直す・消す・終わらせる 前の確認の文（ADR-0052。件数と確定した日を見せる）
import type { ConfirmOptions } from './confirmDialog';
import { mdText } from './dateText';

/**
 * 直す（「いつから」で分ける）前の確認。removed は繰り返しのとおりに戻る担当を組んだ回の数、
 * confirmedDays は「未連絡の変更」になる確定した日の数
 */
export const patternSplitConfirm = (since: string, removed: number, confirmedDays: number): ConfirmOptions => ({
  title: `繰り返しを${mdText(since)}から変えますか？`,
  body:
    `${mdText(since)}からの回は新しい繰り返しのとおりになります（担当は繰り返しの担当）。` +
    (removed > 0 ? `\n担当を組んだ回 ${removed}件も繰り返しのとおりに戻ります。` : '') +
    (confirmedDays > 0 ? `\n確定した日 ${confirmedDays}日の訪問は「未連絡の変更」になります。` : '') +
    '\nこの回だけ変えた訪問・取り消した訪問はそのままです。',
  confirmLabel: '変える',
});

/**
 * 直した（「いつから」で分けた）あとの知らせ（PRD D459。ADR-0117）。from は直す前の開始日、since は「いつから」（今日より前なら今日）。
 * 分けたときは前の中身がどこに残るか（今日から変えた＝「終わった繰り返し」、後の日から＝その前の日まで今の一覧）を言う。
 * auto は担当なしの回を自動で組むか
 */
export function patternSplitText(from: string, sinceIn: string, today: string, auto: boolean): string {
  const since = sinceIn < today ? today : sinceIn;
  const tail = auto ? '担当を自動で組みます' : '';
  const note =
    since <= from
      ? ''
      : since === today
        ? '前の中身は今日より前の回の記録として「終わった繰り返し」に残します'
        : `${mdText(since)}から変わります。それまでは前の中身のままです`;
  const parts = [note, tail].filter((x) => x !== '');
  return parts.length === 0 ? '繰り返しを直しました' : `繰り返しを直しました（${parts.join('。')}）`;
}

/** 消す前の確認 */
export const patternRemoveConfirm = (confirmedDays: number): ConfirmOptions => ({
  title: 'この繰り返しを消しますか？',
  body:
    '今日からの回を消します（今日より前の回は残し、昨日で終わらせます。今日より前に始まっていない繰り返しはまるごと消えます。この回だけ変えた回は単発の訪問として残します）。' +
    (confirmedDays > 0 ? `\n確定した日 ${confirmedDays}日の訪問は「未連絡の変更」になります。` : '') +
    '\nやめるだけなら「終わらせる」を使います。',
  confirmLabel: '訪問ごと消す',
  tone: 'danger',
});

/**
 * 消したあとの知らせ。kept は今日より前に始まっていて、昨日で終わらせて残したか（removePattern）。
 * 残したときは一覧の「終わった繰り返し」に移ったことを言う（一覧から消えないと思わせない）
 */
export const patternRemovedText = (kept: boolean): string =>
  kept ? '繰り返しを消しました（今日より前の回は「終わった繰り返し」に残します）' : '繰り返しを消しました';

/** 終わらせる前の確認（last は最後の日） */
export const patternEndConfirm = (last: string, removed: number, confirmedDays: number): ConfirmOptions => ({
  title: `繰り返しを${mdText(last)}で終わらせますか？`,
  body:
    `${mdText(last)}より後の回は無くなります${removed > 0 ? `（担当を組んだ回 ${removed}件も消します）` : ''}。` +
    (confirmedDays > 0 ? `\n確定した日 ${confirmedDays}日の訪問は「未連絡の変更」になります。` : '') +
    '\nこの回だけ変えた訪問・取り消した訪問はそのままです。',
  confirmLabel: '終わらせる',
});
