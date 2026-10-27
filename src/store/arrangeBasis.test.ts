import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../contracts/data';
import { ARRANGE_BASIS_KEY, createArrangeBasisMemory } from './arrangeBasis';

const fake = () => {
  const m = new Map<string, string>();
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

describe('createArrangeBasisMemory', () => {
  it('まだ組んでいなければ null、覚えた鍵を返す（DemoData とは別のキー）', () => {
    const { m, ls } = fake();
    const mem = createArrangeBasisMemory(() => ls);
    expect(mem.get()).toBeNull();
    mem.save('abc');
    expect(mem.get()).toBe('abc');
    expect(m.get(ARRANGE_BASIS_KEY)).toBe('abc');
    expect(ARRANGE_BASIS_KEY).not.toBe(STORAGE_KEY);
    // 読み直しても残る
    expect(createArrangeBasisMemory(() => ls).get()).toBe('abc');
  });

  it('覚え直すと知らせる（取り消せば知らせない）', () => {
    const mem = createArrangeBasisMemory(() => fake().ls);
    let n = 0;
    const off = mem.subscribe(() => n++);
    mem.save('a');
    off();
    mem.save('b');
    expect(n).toBe(1);
  });

  it('localStorage が使えなくても開いている間は覚える', () => {
    const mem = createArrangeBasisMemory(() => {
      throw new Error('no storage');
    });
    expect(mem.get()).toBeNull();
    mem.save('k1');
    expect(mem.get()).toBe('k1');
  });
});
