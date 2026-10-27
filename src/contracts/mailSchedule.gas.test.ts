// GAS のひな型（gas/Code.gs）の純粋な部品を Node の vm で読み、契約（mailScheduleRequestSchema）と同じ形を通すかを確かめる（ADR-0069）
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { MAIL_SCHEDULE_MAX_BODY, MAIL_SCHEDULE_MAX_MAILS, mailScheduleRequestSchema } from './mailSchedule';

type Gas = {
  validateQueue: (b: unknown) => string;
  escapeCell: (s: string) => string;
  unescapeCell: (s: string) => string;
  isExpired: (key: string, today: string) => boolean;
  retryStatus: (tries: number) => string;
  safeEquals: (a: string, b: string) => boolean;
  VERSION: number;
};

/** Code.gs を読む（GAS の大域のサービスは使わない部品だけを呼ぶ） */
function loadGas(): Gas {
  const code = readFileSync(path.resolve(import.meta.dirname, '../../gas/Code.gs'), 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(code, ctx);
  return ctx as unknown as Gas;
}

const gas = loadGas();
const mail = { to: 'a@example.com', subject: '10/28（水）の訪問予定', body: '本文\n2行目' };
const queue = (over: Record<string, unknown> = {}) => ({
  v: 1,
  token: 't',
  action: 'queue',
  key: '2026-10-28',
  sendAt: '2026-10-27T18:00:00+09:00',
  senderName: '事業所',
  mails: [mail],
  ...over,
});

describe('gas/Code.gs', () => {
  it('版はアプリと同じ', () => {
    expect(gas.VERSION).toBe(1);
  });
  it('契約に合う頼みを通す', () => {
    const ok = queue();
    expect(mailScheduleRequestSchema.safeParse(ok).success).toBe(true);
    expect(gas.validateQueue(ok)).toBe('');
    const max = queue({
      mails: Array.from({ length: MAIL_SCHEDULE_MAX_MAILS }, () => ({
        ...mail,
        body: 'x'.repeat(MAIL_SCHEDULE_MAX_BODY),
      })),
    });
    expect(mailScheduleRequestSchema.safeParse(max).success).toBe(true);
    expect(gas.validateQueue(max)).toBe('');
  });
  it('契約で落ちる頼みは GAS でも落とす', () => {
    const bad = [
      queue({ key: '2026/10/28' }),
      queue({ mails: [] }),
      queue({ mails: Array.from({ length: MAIL_SCHEDULE_MAX_MAILS + 1 }, () => mail) }),
      queue({ mails: [{ ...mail, body: '' }] }),
      queue({ mails: [{ ...mail, body: 'x'.repeat(MAIL_SCHEDULE_MAX_BODY + 1) }] }),
      queue({ mails: [{ ...mail, subject: '' }] }),
      queue({ senderName: 'x'.repeat(101) }),
    ];
    for (const b of bad) {
      expect(mailScheduleRequestSchema.safeParse(b).success).toBe(false);
      expect(gas.validateQueue(b)).not.toBe('');
    }
  });
  it('宛先の差し込み（改行・複数の宛先）と件名の改行は GAS で止める', () => {
    expect(gas.validateQueue(queue({ mails: [{ ...mail, to: 'a@example.com,b@example.com' }] }))).not.toBe('');
    expect(gas.validateQueue(queue({ mails: [{ ...mail, to: 'a@example.com\nBcc: x@y' }] }))).not.toBe('');
    expect(gas.validateQueue(queue({ mails: [{ ...mail, subject: '件名\nBcc: x@y' }] }))).not.toBe('');
  });
  it("数式になる文字は前に ' を付け、読むときに外す", () => {
    for (const s of ['=SUM(A1)', '+1', '-x', '@a']) {
      expect(gas.escapeCell(s)).toBe(`'${s}`);
      expect(gas.unescapeCell(gas.escapeCell(s))).toBe(s);
    }
    expect(gas.escapeCell('ふつう')).toBe('ふつう');
    expect(gas.unescapeCell("'ふつう")).toBe("'ふつう");
  });
  it('訪問の日を過ぎた予約は期限切れ。送り直しは3回目で失敗', () => {
    expect(gas.isExpired('2026-10-27', '2026-10-28')).toBe(true);
    expect(gas.isExpired('2026-10-28', '2026-10-28')).toBe(false);
    expect([1, 2, 3].map(gas.retryStatus)).toEqual(['予約', '予約', '失敗']);
  });
  it('合言葉の比較', () => {
    expect(gas.safeEquals('abc', 'abc')).toBe(true);
    expect(gas.safeEquals('abc', 'abd')).toBe(false);
    expect(gas.safeEquals('abc', 'abcd')).toBe(false);
  });
});
