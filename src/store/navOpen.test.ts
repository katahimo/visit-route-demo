import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../contracts/data';
import { createNavOpenMemory, NAV_OPEN_KEY } from './navOpen';

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

describe('navOpenMemory（メニューの開け閉め）', () => {
  it('はじめは空。覚えると読める（DemoData とは別のキー）。読む側に知らせる', () => {
    const { m, ls } = fake();
    const nav = createNavOpenMemory(() => ls);
    expect(nav.read()).toEqual({});
    const fn = vi.fn();
    const off = nav.subscribe(fn);
    nav.write('plan', false);
    nav.write('month', true);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(nav.read()).toEqual({ plan: false, month: true });
    expect(JSON.parse(m.get(NAV_OPEN_KEY)!)).toEqual({ plan: false, month: true });
    expect(NAV_OPEN_KEY).not.toBe(STORAGE_KEY);
    off();
    nav.write('plan', true);
    expect(fn).toHaveBeenCalledTimes(2);
    // 別に作っても（読み直しても）覚えている
    expect(createNavOpenMemory(() => ls).read()).toEqual({ plan: true, month: true });
  });
  it('同じ文字なら同じ物を返す（描き直さない）', () => {
    const { ls } = fake({ [NAV_OPEN_KEY]: '{"plan":false}' });
    const nav = createNavOpenMemory(() => ls);
    const a = nav.read();
    expect(nav.read()).toBe(a);
    expect(nav.cached()).toBe(a);
  });
  it('読めない文字は空', () => {
    const { ls } = fake({ [NAV_OPEN_KEY]: '{oops' });
    expect(createNavOpenMemory(() => ls).read()).toEqual({});
    const { ls: ls2 } = fake({ [NAV_OPEN_KEY]: 'null' });
    expect(createNavOpenMemory(() => ls2).read()).toEqual({});
  });
  it('localStorage が使えなくても落ちず、開いている間は覚える', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const nav = createNavOpenMemory(() => broken);
    expect(nav.read()).toEqual({});
    nav.write('plan', false);
    expect(nav.read()).toEqual({ plan: false });
    const none = createNavOpenMemory(() => null);
    none.write('plan', false);
    expect(none.read()).toEqual({ plan: false });
    // 書けないだけ（容量超過）なら、読める値に重ねて覚える
    const { ls } = fake({ [NAV_OPEN_KEY]: '{"month":true}' });
    const full = createNavOpenMemory(() => ({
      getItem: ls.getItem,
      setItem: () => {
        throw new Error('quota');
      },
    }));
    full.write('plan', false);
    expect(full.read()).toEqual({ month: true, plan: false });
  });
});
