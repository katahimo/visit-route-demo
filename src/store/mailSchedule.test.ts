import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../contracts/data';
import { createMailScheduleMemory, MAIL_SCHEDULE_KEY } from './mailSchedule';

const fake = (init: Record<string, string> = {}) => {
  const m = new Map<string, string>(Object.entries(init));
  return {
    m,
    ls: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        m.set(k, v);
      },
    },
  };
};
const S = { url: 'https://script.google.com/macros/s/x/exec', token: 't', sendTime: '17:30' };

describe('mailScheduleMemory（メールの予約送信の設定と預けた記録）', () => {
  it('はじめは空。設定と記録を DemoData と別のキーに覚え、読む側に知らせる', () => {
    const { m, ls } = fake();
    const mem = createMailScheduleMemory(() => ls);
    expect(mem.read().settings).toEqual({ url: '', token: '', sendTime: '18:00' });
    const fn = vi.fn();
    mem.subscribe(fn);
    mem.setSettings(S);
    mem.setReservation('2026-10-28', { sendAt: '2026-10-27T18:00:00+09:00', count: 3, at: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(mem.read().settings).toEqual(S);
    expect(mem.read().reservations['2026-10-28']?.count).toBe(3);
    expect(MAIL_SCHEDULE_KEY).not.toBe(STORAGE_KEY);
    expect(JSON.parse(m.get(MAIL_SCHEDULE_KEY)!).settings).toEqual(S);
    mem.setReservation('2026-10-28', null);
    expect(mem.read().reservations).toEqual({});
  });
  it('設定を空にすると記録も消す。壊れた値・形の違う値は捨てる', () => {
    const { ls } = fake({
      [MAIL_SCHEDULE_KEY]: JSON.stringify({
        settings: { url: 1, token: 't' },
        reservations: { x: {}, '2026-10-01': { sendAt: 's', count: 1, at: 2 } },
      }),
    });
    const mem = createMailScheduleMemory(() => ls);
    expect(mem.read().settings).toEqual({ url: '', token: 't', sendTime: '18:00' });
    expect(Object.keys(mem.read().reservations)).toEqual(['2026-10-01']);
    mem.setSettings({ url: '', token: '', sendTime: '18:00' });
    expect(mem.read().reservations).toEqual({});
    expect(createMailScheduleMemory(() => fake({ [MAIL_SCHEDULE_KEY]: '{' }).ls).read().reservations).toEqual({});
  });
  it('localStorage が使えなくても開いている間は覚える', () => {
    const mem = createMailScheduleMemory(() => null);
    mem.setSettings(S);
    expect(mem.read().settings).toEqual(S);
  });
});
