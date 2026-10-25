// スワイプの判定（PRD D334）
import { describe, expect, it } from 'vitest';
import { isSwipe, movedFar } from './swipe';

describe('swipe', () => {
  it('isSwipe：横に60px以上・縦に40px以下', () => {
    expect(isSwipe(60, 40)).toBe(true);
    expect(isSwipe(-80, 0)).toBe(true);
    expect(isSwipe(59, 0)).toBe(false);
    expect(isSwipe(100, 41)).toBe(false);
  });
  it('movedFar：どちらかが10pxを超えたとき', () => {
    expect(movedFar(10, -10)).toBe(false);
    expect(movedFar(11, 0)).toBe(true);
    expect(movedFar(0, -11)).toBe(true);
  });
});
