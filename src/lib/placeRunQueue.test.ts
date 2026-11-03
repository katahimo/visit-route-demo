import { describe, expect, it } from 'vitest';
import { createPlaceLane, createPlaceRunGate } from './placeRunQueue';

/** 外から終わらせられる仕事 */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createPlaceLane（外部の検索を同時に1本にする列。ADR-0016）', () => {
  it('前の仕事が終わってから次を始める（同時に走るのは1本）', async () => {
    const lane = createPlaceLane();
    const log: string[] = [];
    const a = deferred();
    const pa = lane.run(async () => {
      log.push('a始め');
      await a.promise;
      log.push('a終わり');
      return 'a';
    });
    const pb = lane.run(async () => {
      log.push('b始め');
      return 'b';
    });
    await flush();
    expect(log).toEqual(['a始め']);
    expect(lane.busy()).toBe(true);
    a.resolve();
    expect(await pa).toBe('a');
    expect(await pb).toBe('b');
    expect(log).toEqual(['a始め', 'a終わり', 'b始め']);
    expect(lane.busy()).toBe(false);
  });
  it('待っている間に止めたら仕事を呼ばず null。その後ろの仕事は前の仕事が終わるまで待つ', async () => {
    const lane = createPlaceLane();
    const log: string[] = [];
    const a = deferred();
    void lane.run(async () => {
      await a.promise;
      log.push('a');
    });
    const c = new AbortController();
    const pb = lane.run(async () => {
      log.push('b');
    }, c.signal);
    const pc = lane.run(async () => {
      log.push('c');
    });
    c.abort();
    expect(await pb).toBeNull();
    await flush();
    expect(log).toEqual([]);
    a.resolve();
    await pc;
    expect(log).toEqual(['a', 'c']);
  });
  it('仕事が失敗しても次の仕事は始まる', async () => {
    const lane = createPlaceLane();
    const pa = lane.run(async () => {
      throw new Error('x');
    });
    const pb = lane.run(async () => 'b');
    await expect(pa).rejects.toThrow('x');
    expect(await pb).toBe('b');
  });
});

describe('createPlaceRunGate（走っている最中に頼まれたら、終わったあと続けて探す）', () => {
  it('走っていなければ始める。走っている最中は予約して false。終わったら予約の分を続ける', () => {
    const g = createPlaceRunGate();
    expect(g.request()).toBe(true);
    expect(g.request()).toBe(false);
    expect(g.finish(false)).toBe(true); // 続けて探す（走っているまま）
    expect(g.request()).toBe(false);
    expect(g.finish(false)).toBe(true);
    expect(g.finish(false)).toBe(false); // 予約が無ければ空く
    expect(g.request()).toBe(true);
  });
  it('止めたら予約を捨てて空く', () => {
    const g = createPlaceRunGate();
    g.request();
    g.request();
    expect(g.finish(true)).toBe(false);
    expect(g.request()).toBe(true);
  });
});
