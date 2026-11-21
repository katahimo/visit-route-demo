import { describe, expect, it } from 'vitest';
import { DRAG_SCROLL_EDGE, DRAG_SCROLL_MAX, dragScrollStep } from './dragScroll';

describe('dragScrollStep（ドラッグ中に上下の端で巻く量）', () => {
  const top = 72;
  const bottom = 681;
  it('端でなければ巻かない', () => {
    expect(dragScrollStep(400, top, bottom)).toBe(0);
    expect(dragScrollStep(top + DRAG_SCROLL_EDGE + 1, top, bottom)).toBe(0);
    expect(dragScrollStep(bottom - DRAG_SCROLL_EDGE - 1, top, bottom)).toBe(0);
  });
  it('下の端は下へ、上の端は上へ。端に近いほど速い', () => {
    const near = dragScrollStep(bottom - 10, top, bottom);
    const far = dragScrollStep(bottom - 60, top, bottom);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(dragScrollStep(top + 10, top, bottom)).toBeLessThan(0);
  });
  it('範囲の外（上の帯の上・窓の下）は最大の速さ', () => {
    expect(dragScrollStep(bottom + 50, top, bottom)).toBe(DRAG_SCROLL_MAX);
    expect(dragScrollStep(10, top, bottom)).toBe(-DRAG_SCROLL_MAX);
  });
  it('端に入ったばかりでも1以上は巻く', () => {
    expect(dragScrollStep(bottom - DRAG_SCROLL_EDGE + 0.1, top, bottom)).toBe(1);
  });
  it('狭い範囲では端を3分の1までにして、真ん中では巻かない', () => {
    expect(dragScrollStep(150, 100, 220)).toBe(0);
    expect(dragScrollStep(105, 100, 220)).toBeLessThan(0);
    expect(dragScrollStep(100, 100, 100)).toBe(0);
  });
});
