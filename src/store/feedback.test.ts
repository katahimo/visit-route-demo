import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '../contracts/feedback';
import { createFeedbackStore } from './feedback';

const item = (id: string, at: number): FeedbackItem => ({
  id,
  at,
  path: '#/month',
  screen: '月の予定',
  comment: `意見 ${id}`,
  image: null,
  width: 1280,
  height: 800,
  version: 'test',
  userAgent: 'test',
});

describe('feedbackStore（IndexedDB が使えないとき）', () => {
  it('開いている間は覚え、古い順に返す。件数が変わると知らせる', async () => {
    const s = createFeedbackStore(() => null, 'test');
    let calls = 0;
    const off = s.subscribe(() => {
      calls += 1;
    });
    await s.add(item('b', 2));
    await s.add(item('a', 1));
    expect((await s.list()).map((x) => x.id)).toEqual(['a', 'b']);
    expect(s.count()).toBe(2);
    expect(calls).toBe(2);
    expect(s.volatile()).toBe(true);
    await s.remove(['a']);
    expect((await s.list()).map((x) => x.id)).toEqual(['b']);
    expect(s.count()).toBe(1);
    off();
    await s.remove(['b']);
    expect(calls).toBe(3);
  });
  it('IndexedDB を取るときの例外でも、開いている間だけ覚える', async () => {
    const s = createFeedbackStore(() => {
      throw new Error('使えません');
    }, 'test');
    await s.add(item('a', 1));
    expect(s.count()).toBe(1);
    expect(s.volatile()).toBe(true);
  });
});
