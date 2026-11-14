import { describe, expect, it } from 'vitest';
import { createErrorLog } from './errorLog';

describe('errorLog（直前のエラーの控え）', () => {
  it('新しい順に返し、10件を超えたら古いものを捨てる', () => {
    const log = createErrorLog();
    for (let i = 0; i < 12; i++) log.record('error', new Error(`e${i}`), i);
    const list = log.recent();
    expect(list).toHaveLength(10);
    expect(list[0]?.message).toBe('e11');
    expect(list[9]?.message).toBe('e2');
  });
  it('長い文は切り、Error 以外も文にする', () => {
    const log = createErrorLog();
    log.record('console', 'x'.repeat(1000), 1);
    log.record('unhandledrejection', { a: 1 }, 2);
    expect(log.recent()[1]?.message).toHaveLength(300);
    expect(log.recent()[0]?.message).toBe('[object Object]');
  });
});
