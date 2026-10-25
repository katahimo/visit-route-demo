import { afterEach, describe, expect, it, vi } from 'vitest';
import { RELOAD_WAIT_MS, reloadPage } from './reloadPage';

describe('reloadPage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('待っている保存を書いてから、少し待って読み直す。書くのに失敗しても読み直す', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const order: string[] = [];
    reloadPage(() => order.push('flush'));
    expect(order).toEqual(['flush']);
    vi.advanceTimersByTime(RELOAD_WAIT_MS - 1);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenCalledTimes(1);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    reloadPage(() => {
      throw new Error('full');
    });
    vi.advanceTimersByTime(RELOAD_WAIT_MS);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(err).toHaveBeenCalled();
  });
});
