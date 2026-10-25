import { describe, expect, it } from 'vitest';
import { overCap } from './cost';
import { EPS, fitStart } from './index';

/**
 * 浮動小数の誤差の許し EPS は1つ（1e-9）。以前は reassign・vacancy だけ 1e-6 だったが、
 * 時刻の最小の刻みは移動の1秒＝1/60分（約0.0167）で、1e-9 でも 1e-6 でもその刻みよりずっと小さいので、
 * どちらでも判定は変わらない（EPS を 1e-6 にして matching・solver・evaluate・reassign・vacancy・store のテスト259件が通ることも確かめた）
 */
describe('EPS', () => {
  it('最小の刻み（1秒＝1/60分）より十分小さい', () => {
    expect(EPS).toBeLessThan(1e-6 + Number.EPSILON);
    expect(EPS).toBeLessThan(1 / 60 / 1000);
  });
  it('足し算の丸め誤差（0.1 を10回足して1に届かない）は許し、1秒の違いは許さない', () => {
    let t = 0;
    for (let i = 0; i < 10; i++) t += 0.1;
    expect(t).not.toBe(1);
    expect(fitStart([{ start: 0, end: 60 }], 0, 60 + (t - 1))).toBe(0);
    expect(fitStart([{ start: 0, end: 60 }], 0, 60 + 1 / 60)).toBe(Number.POSITIVE_INFINITY);
    expect(fitStart([{ start: 0, end: 60 }], 0, 60 + 1e-7)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('overCap（件数の上限）', () => {
  const balance = { perVisit: 1, lo: [0, 0], hi: [2, 2], cap: [2, 3] };
  it('上限を超える件数だけ true。上限が無ければ false', () => {
    expect(overCap(balance, 0, 2)).toBe(false);
    expect(overCap(balance, 0, 3)).toBe(true);
    expect(overCap(balance, 1, 3)).toBe(false);
    expect(overCap(balance, 1, 4)).toBe(true);
    expect(overCap({ perVisit: 1, lo: [0], hi: [2], cap: null }, 0, 99)).toBe(false);
    expect(overCap(null, 0, 99)).toBe(false);
  });
});
