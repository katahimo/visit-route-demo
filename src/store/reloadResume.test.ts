import { describe, expect, it } from 'vitest';
import {
  RELOAD_FILE_KEY,
  RELOAD_FILE_MAX_BYTES,
  RELOAD_FILE_TTL_MS,
  stashReloadFile,
  takeReloadFile,
} from './reloadResume';

/** sessionStorage の代わり（setItem が投げるかを選べる） */
function memory(full = false) {
  const m = new Map<string, string>();
  const s = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
  };
  return { m, get: () => s };
}

const file = (bytes: Uint8Array<ArrayBuffer>, target = 'roster-client') => ({
  target,
  option: 'replace',
  name: '顧客.csv',
  type: 'text/csv',
  bytes,
});

describe('読み直しをまたぐファイルの控え', () => {
  it('控えたファイルを同じ欄が1回だけ取り出す（バイト列はそのまま）', () => {
    const s = memory();
    const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x41, 0x80, 0x7f]);
    expect(stashReloadFile(file(bytes), s.get)).toBe(true);
    expect(takeReloadFile('workbook', s.get)).toBeNull();
    const got = takeReloadFile('roster-client', s.get);
    expect(got).toMatchObject({ option: 'replace', name: '顧客.csv', type: 'text/csv' });
    expect(Array.from(got?.bytes ?? [])).toEqual(Array.from(bytes));
    expect(takeReloadFile('roster-client', s.get)).toBeNull();
  });
  it('ほかの欄の控えは取り出さずに残す', () => {
    const s = memory();
    stashReloadFile(file(new Uint8Array([1]), 'bookings'), s.get);
    expect(takeReloadFile('roster-client', s.get)).toBeNull();
    expect(s.m.has(RELOAD_FILE_KEY)).toBe(true);
  });
  it('大きい（区切って文字にする長さを超える）ファイルも戻せる', () => {
    const s = memory();
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(stashReloadFile(file(bytes), s.get)).toBe(true);
    expect(takeReloadFile('roster-client', s.get)?.bytes).toEqual(bytes);
  });
  it('上限を超える・書けない・壊れた控えは false か null（控えは残さない）', () => {
    const s = memory();
    expect(stashReloadFile(file(new Uint8Array(RELOAD_FILE_MAX_BYTES + 1)), s.get)).toBe(false);
    expect(s.m.size).toBe(0);
    expect(stashReloadFile(file(new Uint8Array([1])), memory(true).get)).toBe(false);
    s.m.set(RELOAD_FILE_KEY, '{壊れた');
    expect(takeReloadFile('roster-client', s.get)).toBeNull();
    expect(s.m.size).toBe(0);
    expect(stashReloadFile(file(new Uint8Array([1])), () => null)).toBe(false);
  });
  it('期限を過ぎた控えは、どの欄でも取り出さずに消す（あとで開いた欄が古いファイルを読み始めない）', () => {
    const s = memory();
    stashReloadFile(file(new Uint8Array([1]), 'bookings'), s.get, 1000);
    expect(takeReloadFile('roster-client', s.get, 1000 + RELOAD_FILE_TTL_MS)).toBeNull();
    expect(s.m.has(RELOAD_FILE_KEY)).toBe(true);
    expect(takeReloadFile('roster-client', s.get, 1001 + RELOAD_FILE_TTL_MS)).toBeNull();
    expect(s.m.has(RELOAD_FILE_KEY)).toBe(false);
    stashReloadFile(file(new Uint8Array([1]), 'bookings'), s.get, 1000);
    expect(takeReloadFile('bookings', s.get, 1001 + RELOAD_FILE_TTL_MS)).toBeNull();
  });
});
