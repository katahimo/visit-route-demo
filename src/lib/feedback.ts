// 画面への意見（PRD D449・D450。ADR-0114）の純粋な部分：画面の文、入力の確かめ、まとめた報告（HTML）、メールの件名と本文。
// 画面を撮るのは components/captureScreen、置き場所は store/feedback、パスワードで閉じるのは lib/feedbackSeal
import type { FeedbackItem } from '../contracts/feedback';
import { jstDate, jstHhmm } from '../domain/time';
import type { MailParts } from './mailto';

/** 意見の一覧と送る画面 */
export const FEEDBACK_PATH = '/feedback';
export const FEEDBACK_TITLE = '意見';
export const FEEDBACK_BUTTON = '意見を書く';
export const FEEDBACK_CAPTURING = '画面を撮っています…';
export const FEEDBACK_DIALOG_TITLE = 'この画面への意見';
export const FEEDBACK_COMMENT_LABEL = '気づいたこと・直してほしいこと';
export const FEEDBACK_WITH_IMAGE = '画面の画像を付ける';
export const FEEDBACK_NO_IMAGE = '画面の画像は撮れませんでした。文だけ残します。';
export const FEEDBACK_SAVE = '残す';
export const FEEDBACK_NOTE = '意見はこの端末に残り、「意見」の画面からまとめて送ります。押すまで外へは送りません。';
export const FEEDBACK_VOLATILE =
  'このブラウザでは意見を保存できないため、画面を閉じると消えます。閉じる前に送ってください。';
export const FEEDBACK_EMPTY =
  'まだ意見はありません。画面の左下の「意見を書く」を押すと、その画面の画像と一緒に残せます。';
/** パスワードの長さの下限 */
export const FEEDBACK_PASSWORD_MIN = 8;

/** 残したあとの知らせ */
export const feedbackSavedText = (count: number): string => `意見を残しました（${count}件）`;
/** 意見の画面へのリンク */
export const feedbackListLink = (count: number): string => `残した意見を見る・送る（${count}件）`;

/** 残せない理由（残せるなら null） */
export function feedbackProblem(comment: string): string | null {
  return comment.trim() === '' ? '意見を入れてください' : null;
}

/** パスワードで作れない理由（作れるなら null） */
export function passwordProblem(password: string): string | null {
  return password.length < FEEDBACK_PASSWORD_MIN ? `パスワードは${FEEDBACK_PASSWORD_MIN}文字以上にしてください` : null;
}

/** 残した時刻の表示（日本時間。例「2026-11-12 14:03」） */
export const feedbackAtText = (at: number): string => `${jstDate(at)} ${jstHhmm(at)}`;

/** まとめたファイルの名前（date は日本時間の YYYY-MM-DD） */
export const feedbackFileName = (date: string): string => `staff-assign-feedback-${date}.html`;

/** ファイルの大きさの表示（1MB 未満は KB） */
export function sizeText(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 画像は JPEG・PNG の data URL だけ出す（ほかの文字は属性に入れない） */
const safeImage = (image: string | null): string | null =>
  image !== null && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(image) ? image : null;

function itemHtml(x: FeedbackItem, n: number): string {
  const image = safeImage(x.image);
  return [
    '<section>',
    `<h2>${n}. ${esc(x.screen || x.path)}</h2>`,
    `<p class="meta">${esc(feedbackAtText(x.at))}　${esc(x.path)}　画面 ${x.width}×${x.height}　版 ${esc(x.version)}</p>`,
    `<p class="comment">${esc(x.comment)}</p>`,
    image ? `<img src="${image}" alt="意見を残したときの画面">` : '<p class="meta">（画像なし）</p>',
    `<p class="meta">${esc(x.userAgent)}</p>`,
    '</section>',
  ].join('\n');
}

/**
 * 意見をまとめた報告（1つの HTML。画像は中に入れる。外のファイル・スクリプトを読まない）。
 * org は事業所の名前、at は書き出した時刻
 */
export function feedbackReportHtml(items: readonly FeedbackItem[], x: { org: string; at: number }): string {
  return [
    '<!doctype html>',
    '<html lang="ja"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(FEEDBACK_TITLE)}（${items.length}件）</title>`,
    '<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:16px;line-height:1.7;color:#2b211b}',
    'section{border-top:1px solid #d8cdc4;padding:12px 0 20px}h1{font-size:1.3rem}h2{font-size:1.05rem;margin:0}',
    '.meta{color:#7a6a5e;font-size:.8rem;margin:2px 0;overflow-wrap:anywhere}.comment{white-space:pre-wrap;font-size:1rem;margin:8px 0}',
    'img{max-width:100%;border:1px solid #d8cdc4}</style></head><body>',
    `<h1>${esc(FEEDBACK_TITLE)}（${items.length}件）</h1>`,
    `<p class="meta">${esc(x.org)}　書き出し ${esc(feedbackAtText(x.at))}</p>`,
    ...items.map((item, i) => itemHtml(item, i + 1)),
    '</body></html>',
  ].join('\n');
}

/**
 * 送るメールの件名と本文（宛先は入れない。送る人がメールアプリで選ぶ）。ファイルは mailto では添付できないので、
 * 保存したファイルを添付する案内を書く。パスワードは書かない（同じメールに書くと閉じた意味が無い）
 */
export function feedbackMail(count: number, fileName: string): MailParts {
  return {
    to: [],
    subject: `アプリへの意見（${count}件）`,
    body: [
      `アプリへの意見を${count}件送ります。`,
      `保存したファイル「${fileName}」をこのメールに添付してください。`,
      'ファイルを開くパスワードは、このメールには書かず、電話や LINE など別の手段で伝えます。',
    ].join('\n'),
  };
}
