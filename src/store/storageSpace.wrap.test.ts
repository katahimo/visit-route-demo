// 領域のあるとき（?space=slides で起動）の包みと storage イベントのキーを確かめる
import { afterEach, describe, expect, it, vi } from 'vitest';

/** 手元の Storage（node の test には localStorage が無い） */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

async function load(search: string) {
  vi.resetModules();
  vi.stubGlobal('location', { search });
  vi.stubGlobal('localStorage', fakeStorage());
  vi.stubGlobal('sessionStorage', fakeStorage());
  return import('./storageSpace');
}
afterEach(() => vi.unstubAllGlobals());

describe('領域あり', () => {
  it('接頭辞のキーだけを読み書きし、clear も領域の中だけ', async () => {
    const m = await load('?space=slides');
    const base = globalThis.localStorage;
    base.clear();
    base.setItem('plain', '1');
    const s = m.appLocalStorage() as Storage;
    s.setItem('a', 'x');
    expect(base.getItem('vrdemo:space:slides:a')).toBe('x');
    expect(s.getItem('plain')).toBeNull();
    expect(s.getItem('a')).toBe('x');
    expect(s.length).toBe(1);
    expect(s.key(0)).toBe('a');
    s.removeItem('a');
    expect(base.getItem('vrdemo:space:slides:a')).toBeNull();
    s.setItem('b', 'y');
    s.clear();
    expect(s.length).toBe(0);
    expect(base.getItem('plain')).toBe('1');
    base.clear();
  });
  it('storage イベントは接頭辞付きだけ受ける', async () => {
    const m = await load('?space=slides');
    expect(m.isOwnStorageKey('vrdemo:space:slides:k')).toBe(true);
    expect(m.isOwnStorageKey('vrdemo:space:other:k')).toBe(false);
    expect(m.isOwnStorageKey('k')).toBe(false);
    expect(m.ownKeyOf('vrdemo:space:slides:k')).toBe('k');
  });
});

describe('領域なし', () => {
  it('素の localStorage を返す', async () => {
    const m = await load('');
    expect(m.appLocalStorage()).toBe(globalThis.localStorage);
    expect(m.appSessionStorage()).toBe(globalThis.sessionStorage);
  });
});
