import { describe, expect, it } from 'vitest';
import { createPlaceLock, createPlaceRunGate } from './placeRunQueue';

describe('createPlaceLock（外部の検索を同時に1本にする鍵。ADR-0016・PRD D445）', () => {
  it('持っている間は待たせ、外したら次へ渡す。待っている人が複数なら priority の小さい方・同じなら先に待った方', async () => {
    const lock = createPlaceLock();
    const order: string[] = [];
    const first = (await lock.acquire(1))!;
    expect(lock.busy()).toBe(true);
    const waits: boolean[] = [];
    const client = lock
      .acquire(1, undefined, (w) => waits.push(w))
      .then((r) => {
        order.push('client');
        return r;
      });
    const staff = lock.acquire(0).then((r) => {
      order.push('staff');
      return r;
    });
    first();
    (await staff)!();
    (await client)!();
    expect(order).toEqual(['staff', 'client']);
    expect(waits).toEqual([true, false]);
    expect(lock.busy()).toBe(false);
  });
  it('待っている間に止めたら null（次の人へは渡さない）。外す手を二度呼んでもほかの人の鍵を外さない', async () => {
    const lock = createPlaceLock();
    const release = (await lock.acquire(1))!;
    const c = new AbortController();
    const quitter = lock.acquire(1, c.signal);
    const next = lock.acquire(1);
    c.abort();
    expect(await quitter).toBeNull();
    release();
    const r2 = (await next)!;
    release();
    expect(lock.busy()).toBe(true);
    r2();
    expect(lock.busy()).toBe(false);
    expect(await lock.acquire(1, AbortSignal.abort())).toBeNull();
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
