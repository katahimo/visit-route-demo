import { beforeEach, describe, expect, it } from 'vitest';
import { clearErrors, recentErrors, recordError } from './errorLog';

describe('errorLog（直前のエラーの控え）', () => {
  beforeEach(clearErrors);
  it('新しい順に返し、10件を超えたら古いものを捨てる', () => {
    for (let i = 0; i < 12; i++) recordError('error', new Error(`e${i}`), i);
    const list = recentErrors();
    expect(list).toHaveLength(10);
    expect(list[0]?.message).toBe('e11');
    expect(list[9]?.message).toBe('e2');
  });
  it('長い文は切り、Error 以外も文にする', () => {
    recordError('console', 'x'.repeat(1000), 1);
    recordError('unhandledrejection', { a: 1 }, 2);
    expect(recentErrors()[1]?.message).toHaveLength(300);
    expect(recentErrors()[0]?.message).toBe('[object Object]');
  });
});
