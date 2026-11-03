// デモを作った直後に要対応（担当なし・間に合わない・重なり・休みの人）を組むか（PRD D409。ADR-0079）
import { describe, expect, it } from 'vitest';
import {
  ARRANGE_PENDING_KEY,
  arrangePending,
  arrangesAfterStart,
  clearArrangePending,
  markArrangeAfterStart,
} from './start';

describe('arrangesAfterStart', () => {
  it('「デモで試す」で始めたとき・初期状態に戻したときは組む', () => {
    expect(arrangesAfterStart({ kind: 'answer', start: 'demo' }, false)).toBe(true);
    expect(arrangesAfterStart({ kind: 'reset' }, false)).toBe(true);
  });
  it('「自分のデータで始める」は組まない', () => {
    expect(arrangesAfterStart({ kind: 'answer', start: 'own' }, false)).toBe(false);
  });
  it('印「all」があれば組まない', () => {
    expect(arrangesAfterStart({ kind: 'answer', start: 'demo' }, true)).toBe(false);
    expect(arrangesAfterStart({ kind: 'reset' }, true)).toBe(false);
  });
});

/** sessionStorage の代わり */
function memStore() {
  const m = new Map<string, string>();
  const s = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
  return { m, get: () => s };
}

describe('組む印（読み直しをまたぐ）', () => {
  it('初期状態に戻すと印を書き、消すまで何度読んでも残る（読み直しのあとの起動でも読める）', () => {
    const { m, get } = memStore();
    markArrangeAfterStart({ kind: 'reset' }, false, get);
    expect(m.get(ARRANGE_PENDING_KEY)).toBe('1');
    expect(arrangePending(get)).toBe(true);
    expect(arrangePending(get)).toBe(true);
    clearArrangePending(get);
    expect(arrangePending(get)).toBe(false);
  });
  it('組まない始め方は印を消す（前の印を持ち越さない）', () => {
    const { get } = memStore();
    markArrangeAfterStart({ kind: 'reset' }, false, get);
    markArrangeAfterStart({ kind: 'answer', start: 'own' }, false, get);
    expect(arrangePending(get)).toBe(false);
    markArrangeAfterStart({ kind: 'reset' }, true, get);
    expect(arrangePending(get)).toBe(false);
  });
  it('保存が使えなければ印なし（例外を出さない）', () => {
    const broken = () => {
      throw new Error('no');
    };
    expect(() => markArrangeAfterStart({ kind: 'reset' }, false, broken)).not.toThrow();
    expect(arrangePending(broken)).toBe(false);
    expect(() => clearArrangePending(broken)).not.toThrow();
  });
});
