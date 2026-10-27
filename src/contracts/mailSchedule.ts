import { z } from 'zod';

/**
 * メールの予約送信（PRD D361〜D364。ADR-0067）：アプリ ⇄ 事業所の Google Apps Script（GAS）の Web アプリのやりとり。
 * アプリは GAS の `/exec` へ JSON の文字を POST する（Content-Type・独自のヘッダーを付けない＝確認の問い合わせを出さない）。
 * GAS は預かり（シート「予約」）に書き、時刻トリガーで送る。GAS 側の実装は `gas/Code.gs`（同じ形を手で合わせる）
 */

/** やりとりの版。形を変えたら上げる（GAS は知らない版を badRequest で返す） */
export const MAIL_SCHEDULE_VERSION = 1;
/** 1回に預けるメールの上限（無料の Gmail の1日の宛先の上限に合わせる） */
export const MAIL_SCHEDULE_MAX_MAILS = 100;
/** 本文の長さの上限（文字。GAS のシートの1マス 50000字に収める） */
export const MAIL_SCHEDULE_MAX_BODY = 40000;

/** 預けるメール1通（宛先は1人。本文は文字だけ） */
export const scheduledMailSchema = z.object({
  to: z.string().min(3).max(254),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(MAIL_SCHEDULE_MAX_BODY),
});
export type ScheduledMail = z.infer<typeof scheduledMailSchema>;

const base = { v: z.literal(MAIL_SCHEDULE_VERSION), token: z.string().min(1).max(200) };
/** 日付のキー（訪問の日。同じキーで預け直すと上書き） */
const keySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** 頼み：つながるか（合言葉が合うか）を確かめる／預ける（同じ key は上書き）／取り消す（まだ送っていない分） */
export const mailScheduleRequestSchema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('ping') }),
  z.object({
    ...base,
    action: z.literal('queue'),
    key: keySchema,
    /** 送る時刻（ISO 8601、日本時間の +09:00 付き） */
    sendAt: z.string().min(1),
    /** 差出人の名前（事業所名） */
    senderName: z.string().max(100),
    mails: z.array(scheduledMailSchema).min(1).max(MAIL_SCHEDULE_MAX_MAILS),
  }),
  z.object({ ...base, action: z.literal('cancel'), key: keySchema }),
]);
export type MailScheduleRequest = z.infer<typeof mailScheduleRequestSchema>;

/** 失敗の種類：合言葉が違う／形が違う（版違いを含む）／初期設定をしていない／GAS の中のエラー */
export const MAIL_SCHEDULE_ERRORS = ['unauthorized', 'badRequest', 'notSetUp', 'serverError'] as const;
export type MailScheduleError = (typeof MAIL_SCHEDULE_ERRORS)[number];

/**
 * 返事。queued は預けた通数、canceled は取り消した通数（まだ送っていない分）、quota は今日あと送れる宛先の数（MailApp の残り）。
 * 知らない項目は捨てる（GAS を新しくしても古いアプリが読める）
 */
export const mailScheduleResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    v: z.number(),
    queued: z.number().int().nonnegative().optional(),
    canceled: z.number().int().nonnegative().optional(),
    quota: z.number().int().optional(),
  }),
  z.object({
    ok: z.literal(false),
    v: z.number(),
    error: z.enum(MAIL_SCHEDULE_ERRORS),
    message: z.string().optional(),
  }),
]);
export type MailScheduleResponse = z.infer<typeof mailScheduleResponseSchema>;
