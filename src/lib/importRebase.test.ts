// 読み込みの読み直し（lib/importRebase）：変わっていなければそのまま・変わっていたら今のデータで読み直し、確かめた内容が同じときだけ入れる
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { rebaseImport, sameOutcome } from './importRebase';

const d = (n: number) => ({ seed: n }) as unknown as DemoData;
type R = { data: DemoData; added: string[] };

describe('sameOutcome', () => {
  it('data を除いて比べる', () => {
    expect(sameOutcome({ data: d(1), added: ['a'] }, { data: d(2), added: ['a'] })).toBe(true);
    expect(sameOutcome({ data: d(1), added: ['a'] }, { data: d(1), added: ['b'] })).toBe(false);
  });
});

describe('rebaseImport', () => {
  it('変わっていなければ読み直さずにそのまま', async () => {
    const base = d(1);
    const r: R = { data: d(10), added: ['a'] };
    let reads = 0;
    const out = await rebaseImport(
      base,
      r,
      () => base,
      () => {
        reads++;
        return r;
      },
    );
    expect(out).toEqual({ base, r });
    expect(reads).toBe(0);
  });
  it('変わっていたら今のデータで読み直し、内容が同じなら読み直した結果', async () => {
    const now = d(2);
    const again: R = { data: d(20), added: ['a'] };
    const out = await rebaseImport(
      d(1),
      { data: d(10), added: ['a'] },
      () => now,
      async (x) => (x === now ? again : { code: 'INVALID_ARGUMENT', message: '' }),
    );
    expect(out).toEqual({ base: now, r: again });
  });
  it('内容が違う・読めないときは null', async () => {
    const r: R = { data: d(10), added: ['a'] };
    expect(
      await rebaseImport(
        d(1),
        r,
        () => d(2),
        () => ({ data: d(20), added: ['b'] }),
      ),
    ).toBeNull();
    expect(
      await rebaseImport(
        d(1),
        r,
        () => d(2),
        () => ({ code: 'INVALID_ARGUMENT' as const, message: 'x' }),
      ),
    ).toBeNull();
  });
  it('読み直すあいだも変わり続けたら諦める', async () => {
    let n = 100;
    const out = await rebaseImport(
      d(1),
      { data: d(10), added: ['a'] },
      () => d(n++),
      () => ({ data: d(0), added: ['a'] }),
    );
    expect(out).toBeNull();
  });
});
