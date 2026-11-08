import { describe, expect, it } from 'vitest';
import {
  HISTORY_MAX_KEY,
  hasHistoryIdx,
  historyIdxOf,
  initialMaxIdx,
  loadHistoryMax,
  nextMaxIdx,
  saveHistoryMax,
} from './historyNav';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('nextMaxIdx', () => {
  it('新しく開いた（PUSH）ら今の番号（先の履歴は消える）', () => {
    expect(nextMaxIdx(5, 2, 'PUSH')).toBe(2);
  });
  it('戻る・進む（POP）と置き換え（REPLACE）は下げない', () => {
    expect(nextMaxIdx(5, 2, 'POP')).toBe(5);
    expect(nextMaxIdx(5, 2, 'REPLACE')).toBe(5);
    expect(nextMaxIdx(1, 3, 'POP')).toBe(3);
  });
});

describe('initialMaxIdx', () => {
  it('読み直し・履歴の行き来は覚えた番号を使う', () => {
    expect(initialMaxIdx(4, 1, true)).toBe(4);
    expect(initialMaxIdx(0, 2, true)).toBe(2);
  });
  it('新しく開いたときは覚えた番号を使わない', () => {
    expect(initialMaxIdx(4, 0, false)).toBe(0);
  });
});

describe('hasHistoryIdx', () => {
  it('react-router の番号があるときだけ真', () => {
    expect(hasHistoryIdx({ idx: 0 })).toBe(true);
    expect(hasHistoryIdx(null)).toBe(false);
    expect(hasHistoryIdx({ usr: null })).toBe(false);
  });
});

describe('historyIdxOf', () => {
  it('react-router の idx を読む。無い・壊れていれば 0', () => {
    expect(historyIdxOf({ idx: 3, key: 'a' })).toBe(3);
    expect(historyIdxOf(null)).toBe(0);
    expect(historyIdxOf({ idx: '3' })).toBe(0);
    expect(historyIdxOf({ idx: -1 })).toBe(0);
  });
});

describe('loadHistoryMax・saveHistoryMax', () => {
  it('覚えた番号を読み直せる', () => {
    const s = memory();
    expect(loadHistoryMax(s)).toBe(0);
    saveHistoryMax(4, s);
    expect(s.m.get(HISTORY_MAX_KEY)).toBe('4');
    expect(loadHistoryMax(s)).toBe(4);
  });
  it('読めない値・保存先が無いときは 0', () => {
    const s = memory();
    s.setItem(HISTORY_MAX_KEY, 'abc');
    expect(loadHistoryMax(s)).toBe(0);
    expect(loadHistoryMax(null)).toBe(0);
  });
});
