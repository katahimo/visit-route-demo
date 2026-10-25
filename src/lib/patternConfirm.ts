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

/** 終わらせる前の確認（last は最後の日） */
export const patternEndConfirm = (last: string, removed: number, confirmedDays: number): ConfirmOptions => ({
  title: `繰り返しを${mdText(last)}で終わらせますか？`,
  body:
    `${mdText(last)}より後の回は無くなります${removed > 0 ? `（担当を組んだ回 ${removed}件も消します）` : ''}。` +
    (confirmedDays > 0 ? `\n確定した日 ${confirmedDays}日の訪問は「未連絡の変更」になります。` : '') +
    '\nこの回だけ変えた訪問・取り消した訪問はそのままです。',
  confirmLabel: '終わらせる',
});
