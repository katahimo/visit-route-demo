// メールの予約送信（PRD D361〜D364。ADR-0067）：設定の検査・送る時刻・頼みの形・GAS を呼ぶ
import { describe, expect, it } from 'vitest';
import { mailScheduleRequestSchema } from '../contracts/mailSchedule';
import {
  cancelRequest,
  isGasUrl,
  isReady,
  mailScheduleMessage,
  normalizeSettings,
  pingRequest,
  postMailSchedule,
  queueRequest,
  scheduledMails,
  sendAtFor,
  sendAtText,
  settingsErrors,
} from './mailSchedule';

const URL_OK = 'https://script.google.com/macros/s/AKfy_abc-123/exec';
const S = { url: URL_OK, token: 'secret', sendTime: '18:00' };
/** 日本時間の時刻 → ms */
const jst = (s: string) => Date.parse(`${s}+09:00`);

describe('設定', () => {
  it('GAS のウェブアプリの URL だけを通す（個人・Workspace）', () => {
    expect(isGasUrl(URL_OK)).toBe(true);
    expect(isGasUrl('https://script.google.com/a/macros/example.co.jp/s/AKfy/exec')).toBe(true);
    expect(isGasUrl('https://script.google.com/macros/s/AKfy/dev')).toBe(false);
    expect(isGasUrl('http://script.google.com/macros/s/AKfy/exec')).toBe(false);
    expect(isGasUrl('https://evil.example.com/macros/s/AKfy/exec')).toBe(false);
  });
  it('前後の空白・全角を直し、時刻が空なら既定', () => {
    expect(normalizeSettings({ url: ` ${URL_OK} `, token: ' ａｂｃ ', sendTime: '' })).toEqual({
      url: URL_OK,
      token: 'abc',
      sendTime: '18:00',
    });
  });
  it('誤りは項目ごと。そろえば使える', () => {
    expect(Object.keys(settingsErrors({ url: 'x', token: '', sendTime: '25:00' })).sort()).toEqual([
      'sendTime',
      'token',
      'url',
    ]);
    expect(isReady(S)).toBe(true);
    expect(isReady({ ...S, token: '' })).toBe(false);
  });
});

describe('sendAtFor（送る時刻）', () => {
  it('訪問の前日の決めた時刻（日本時間）', () => {
    expect(sendAtFor('2026-10-28', '18:00', jst('2026-10-27T09:00:00'))).toEqual({
      iso: '2026-10-27T18:00:00+09:00',
      immediate: false,
    });
  });
  it('前日の時刻を過ぎていれば今（すぐ）。当日も予約できる', () => {
    expect(sendAtFor('2026-10-28', '18:00', jst('2026-10-27T19:30:05'))).toEqual({
      iso: '2026-10-27T19:30:05+09:00',
      immediate: true,
    });
    expect(sendAtFor('2026-10-28', '18:00', jst('2026-10-28T08:00:00'))?.immediate).toBe(true);
  });
  it('過ぎた日は予約できない', () => {
    expect(sendAtFor('2026-10-26', '18:00', jst('2026-10-27T09:00:00'))).toBeNull();
  });
  it('言い方', () => {
    expect(sendAtText({ iso: '2026-10-27T18:00:00+09:00', immediate: false })).toBe('10/27（火）18:00');
    expect(sendAtText({ iso: 'x', immediate: true })).toBe('すぐ（5分以内）');
  });
});

describe('頼み', () => {
  it('アドレスのある行だけを全文で預ける。契約の形に合う', () => {
    const mails = scheduledMails([
      { email: 'a@example.com', text: { subject: '件名', full: '本文\n2行目' } },
      { email: '', text: { subject: '件名', full: '本文' } },
    ]);
    expect(mails).toEqual([{ to: 'a@example.com', subject: '件名', body: '本文\n2行目' }]);
    const req = queueRequest({
      settings: S,
      date: '2026-10-28',
      sendAt: '2026-10-27T18:00:00+09:00',
      senderName: '事業所',
      mails,
    });
    expect(mailScheduleRequestSchema.parse(req)).toEqual(req);
    expect(mailScheduleRequestSchema.parse(cancelRequest(S, '2026-10-28')).action).toBe('cancel');
    expect(mailScheduleRequestSchema.parse(pingRequest(S)).action).toBe('ping');
  });
});

describe('postMailSchedule', () => {
  const reply =
    (body: unknown, ok = true) =>
    async () => ({ ok, json: async () => body });
  it('ヘッダーを付けずに JSON の文字を POST し、成功を読む', async () => {
    let seen: { url: string; init: { method: string; body: string } & Record<string, unknown> } | null = null;
    const r = await postMailSchedule(URL_OK, pingRequest(S), {
      fetch: async (url, init) => {
        seen = { url, init };
        return { ok: true, json: async () => ({ ok: true, v: 1, quota: 90 }) };
      },
    });
    expect(r).toEqual({ ok: true, res: { ok: true, v: 1, quota: 90 } });
    expect(seen!.url).toBe(URL_OK);
    expect(seen!.init.method).toBe('POST');
    expect('headers' in seen!.init).toBe(false);
    expect(JSON.parse(seen!.init.body)).toEqual(pingRequest(S));
  });
  it('GAS の失敗・形違い・HTTP のエラー・投げた・時間切れ', async () => {
    expect(
      await postMailSchedule(URL_OK, pingRequest(S), { fetch: reply({ ok: false, v: 1, error: 'unauthorized' }) }),
    ).toEqual({
      ok: false,
      reason: 'unauthorized',
      message: undefined,
    });
    expect((await postMailSchedule(URL_OK, pingRequest(S), { fetch: reply('<html>') })).ok).toBe(false);
    expect(await postMailSchedule(URL_OK, pingRequest(S), { fetch: reply('<html>') })).toMatchObject({
      reason: 'badResponse',
    });
    expect(await postMailSchedule(URL_OK, pingRequest(S), { fetch: reply({}, false) })).toMatchObject({
      reason: 'network',
    });
    expect(
      await postMailSchedule(URL_OK, pingRequest(S), {
        fetch: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
    ).toMatchObject({ reason: 'network' });
    expect(
      await postMailSchedule(URL_OK, pingRequest(S), {
        timeoutMs: 10,
        fetch: (_u, init) =>
          new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))),
      }),
    ).toMatchObject({ reason: 'timeout' });
  });
  it('どの失敗にも文がある', () => {
    for (const r of [
      'unauthorized',
      'badRequest',
      'notSetUp',
      'serverError',
      'timeout',
      'network',
      'badResponse',
    ] as const)
      expect(mailScheduleMessage(r).length).toBeGreaterThan(5);
  });
});
