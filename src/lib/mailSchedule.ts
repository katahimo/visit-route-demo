/**
 * メールの予約送信（PRD D366〜D369。ADR-0069）：事業所の Google Apps Script（GAS）へ、日の予定のメールを確定のときにまとめて預ける。
 * ここは頼みの組み立て・送る時刻・設定の検査・GAS を呼ぶ1か所（lib/geocode と同じく fetch を差し替えられる形）。
 * 呼ぶのは画面（日の予定のメールの欄・管理者設定のメールの予約送信）だけで、利用者がボタンを押したときだけ。
 * mailto（ADR-0017）はそのまま残し、Google を使えない事業所はメールアプリで送る
 */
import {
  MAIL_SCHEDULE_VERSION,
  type MailScheduleError,
  type MailScheduleRequest,
  type MailScheduleResponse,
  mailScheduleResponseSchema,
  type ScheduledMail,
} from '../contracts/mailSchedule';
import { addDays, jstDate } from '../domain/time';
import { mdw } from './mail';

/**
 * ひな型のスプレッドシート（GAS 付き）のコピー用のリンク（`https://docs.google.com/spreadsheets/d/<ID>/copy`）。
 * 提供側が gas/README.md の手順で作って入れる。空なら設定の欄に「まだ用意されていません」と出す
 */
export const GAS_TEMPLATE_URL = '';
/** 送る時刻の既定（前日の 18:00） */
export const DEFAULT_SEND_TIME = '18:00';
/** 1回の呼び出しの時間切れ（ミリ秒。GAS は起きるのが遅いことがある） */
export const MAIL_SCHEDULE_TIMEOUT_MS = 20000;
/** GAS の時刻トリガーの間隔（分。予約の時刻からの遅れの目安） */
export const GAS_TRIGGER_MINUTES = 5;

/** この端末に残す接続の設定（DemoData に入れない。書き出し・読み込み・初期化に入らない） */
export type MailScheduleSettings = {
  /** GAS の Web アプリの URL（…/exec） */
  url: string;
  /** 合言葉（GAS の初期設定で作ったもの） */
  token: string;
  /** 送る時刻（前日の HH:MM） */
  sendTime: string;
};

/** 預けた記録（日付ごと。この端末だけ。欄の「予約済み」に使う） */
export type MailReservation = { sendAt: string; count: number; at: number };

export const EMPTY_SETTINGS: MailScheduleSettings = { url: '', token: '', sendTime: DEFAULT_SEND_TIME };

/** GAS の Web アプリの URL か（個人：/macros/s/…/exec、Workspace：/a/macros/ドメイン/s/…/exec） */
export const isGasUrl = (url: string): boolean =>
  /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);

/** 時刻の形（HH:MM、00:00〜23:59） */
export const isHhmm = (s: string): boolean => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);

/** 入れた値を直す（前後の空白・全角の英数字） */
export function normalizeSettings(s: MailScheduleSettings): MailScheduleSettings {
  const fix = (x: string) => x.normalize('NFKC').trim();
  return { url: fix(s.url), token: fix(s.token), sendTime: fix(s.sendTime) || DEFAULT_SEND_TIME };
}

/** 設定の欄の誤り（項目 → 文）。無ければ空 */
export function settingsErrors(s: MailScheduleSettings): Partial<Record<keyof MailScheduleSettings, string>> {
  const out: Partial<Record<keyof MailScheduleSettings, string>> = {};
  if (!isGasUrl(s.url))
    out.url =
      'https://script.google.com/macros/s/…/exec の形の URL を貼ってください（デプロイで出た「ウェブアプリ」の URL）';
  if (s.token === '') out.token = '合言葉を貼ってください（シートの「設定」にあります）';
  else if (s.token.length > 200) out.token = '合言葉が長すぎます（200字まで）';
  if (!isHhmm(s.sendTime)) out.sendTime = '時刻は 18:00 のように入れてください';
  return out;
}

/** 予約して送れる設定か（URL・合言葉・時刻がそろっている） */
export const isReady = (s: MailScheduleSettings): boolean => Object.keys(settingsErrors(s)).length === 0;

/**
 * 送る時刻：訪問の日の前日の sendTime（日本時間）。その時刻を過ぎていれば今（次の時刻トリガーで送る）。
 * 訪問の日が今日より前なら null（予約できない）
 */
export function sendAtFor(date: string, sendTime: string, now: number): { iso: string; immediate: boolean } | null {
  if (date < jstDate(now)) return null;
  const iso = `${addDays(date, -1)}T${sendTime}:00+09:00`;
  if (Date.parse(iso) > now) return { iso, immediate: false };
  return { iso: jstIso(now), immediate: true };
}

/** ms → 日本時間の ISO 8601（秒まで、+09:00） */
function jstIso(ms: number): string {
  return `${new Date(ms + 9 * 3600_000).toISOString().slice(0, 19)}+09:00`;
}

/** 送る時刻の言い方（「10/26（日）18:00」。すぐなら「すぐ（5分以内）」） */
export function sendAtText(at: { iso: string; immediate: boolean }): string {
  if (at.immediate) return `すぐ（${GAS_TRIGGER_MINUTES}分以内）`;
  return `${mdw(at.iso.slice(0, 10))}${at.iso.slice(11, 16)}`;
}

/** 預けるメール：アドレスがあり本文のある行だけ（本文は省かない全文。mailto の長さの目安は掛からない） */
export function scheduledMails(
  rows: readonly { email: string; text: { subject: string; full: string } }[],
): ScheduledMail[] {
  return rows.filter((r) => r.email !== '').map((r) => ({ to: r.email, subject: r.text.subject, body: r.text.full }));
}

/** 預ける頼み */
export function queueRequest(x: {
  settings: MailScheduleSettings;
  date: string;
  sendAt: string;
  senderName: string;
  mails: ScheduledMail[];
}): MailScheduleRequest {
  return {
    v: MAIL_SCHEDULE_VERSION,
    token: x.settings.token,
    action: 'queue',
    key: x.date,
    sendAt: x.sendAt,
    senderName: x.senderName.slice(0, 100),
    mails: x.mails,
  };
}

/** 取り消す・確かめる頼み */
export const cancelRequest = (settings: MailScheduleSettings, date: string): MailScheduleRequest => ({
  v: MAIL_SCHEDULE_VERSION,
  token: settings.token,
  action: 'cancel',
  key: date,
});
export const pingRequest = (settings: MailScheduleSettings): MailScheduleRequest => ({
  v: MAIL_SCHEDULE_VERSION,
  token: settings.token,
  action: 'ping',
});

/** 呼んだ結果の失敗の種類：GAS が返した失敗のほか、時間切れ・つながらない・応答の形が違う */
export type MailScheduleFail = MailScheduleError | 'timeout' | 'network' | 'badResponse';
export type MailScheduleResult =
  | { ok: true; res: Extract<MailScheduleResponse, { ok: true }> }
  | { ok: false; reason: MailScheduleFail; message?: string };

type FetchFn = (
  url: string,
  init: { method: 'POST'; body: string; signal: AbortSignal; redirect: 'follow' },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * GAS を呼ぶ。本文は JSON の文字で、Content-Type・独自のヘッダーを付けない（確認の問い合わせ（OPTIONS）を出さない。GAS は答えられない）。
 * GAS の返事は別のアドレスへの転送のあとに返るので、redirect は follow
 */
export async function postMailSchedule(
  url: string,
  req: MailScheduleRequest,
  opts: { fetch?: FetchFn; timeoutMs?: number } = {},
): Promise<MailScheduleResult> {
  const f: FetchFn = opts.fetch ?? ((u, init) => globalThis.fetch(u, init));
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? MAIL_SCHEDULE_TIMEOUT_MS);
  try {
    let raw: unknown;
    try {
      const res = await f(url, { method: 'POST', body: JSON.stringify(req), signal: ctrl.signal, redirect: 'follow' });
      if (!res.ok) return { ok: false, reason: 'network' };
      raw = await res.json();
    } catch {
      return { ok: false, reason: timedOut ? 'timeout' : 'network' };
    }
    const parsed = mailScheduleResponseSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: 'badResponse' };
    const r = parsed.data;
    return r.ok ? { ok: true, res: r } : { ok: false, reason: r.error, message: r.message };
  } finally {
    clearTimeout(timer);
  }
}

/** 失敗の知らせ：種類ごとの文に、GAS が返した理由（どの宛先が違うかなど）があれば添える */
export const mailScheduleFailText = (r: { reason: MailScheduleFail; message?: string }): string =>
  r.message ? `${mailScheduleMessage(r.reason)}（${r.message}）` : mailScheduleMessage(r.reason);

/** 失敗の文（画面の知らせ） */
export function mailScheduleMessage(reason: MailScheduleFail): string {
  switch (reason) {
    case 'unauthorized':
      return '合言葉が合いません。シートの「設定」の合言葉を貼り直してください';
    case 'notSetUp':
      return 'シートの初期設定がまだです。シートのメニュー「訪問予定 › 初期設定」を押してください';
    case 'badRequest':
      return '送った中身を Google の側で受け付けませんでした。シートのスクリプトが古いかもしれません（ひな型を貼り直してください）';
    case 'serverError':
      return 'Google の側でエラーが起きました。しばらくしてからもう一度押してください';
    case 'timeout':
      return `時間内に応答がありませんでした（${MAIL_SCHEDULE_TIMEOUT_MS / 1000}秒）。もう一度押してください`;
    case 'network':
      return 'つながりませんでした。URL（デプロイで出た …/exec）とネットの接続を確かめてください';
    case 'badResponse':
      return '応答の形が想定と違います。URL がウェブアプリの …/exec か確かめてください';
    default: {
      const _: never = reason;
      return _;
    }
  }
}
