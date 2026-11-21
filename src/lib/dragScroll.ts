// ドラッグ中に画面の上下の端へ寄せたときに巻く量（日の予定の担当なしの訪問が長いとき、落とす先の列が画面の外に出るため）。
// ブラウザの巻き方（Safari は巻かないことがある）に頼らず、どのブラウザでも同じに巻く。DOM は触らない

/** 端の幅（px）と、1コマで巻く最大の量（px） */
export const DRAG_SCROLL_EDGE = 72;
export const DRAG_SCROLL_MAX = 22;

/**
 * 指（マウス）の高さ y が、見えている範囲 top〜bottom の上下の端（edge px）に入っていれば、1コマで巻く量を返す
 * （上は負・下は正・端に近いほど速い。範囲の外は最大）。端でなければ 0。範囲が狭いときは端を範囲の3分の1までにする
 */
export function dragScrollStep(
  y: number,
  top: number,
  bottom: number,
  edge: number = DRAG_SCROLL_EDGE,
  max: number = DRAG_SCROLL_MAX,
): number {
  const e = Math.min(edge, Math.max(0, (bottom - top) / 3));
  if (e <= 0) return 0;
  const speed = (depth: number) => Math.max(1, Math.round(max * Math.min(1, depth / e)));
  if (y < top + e) return -speed(top + e - y);
  if (y > bottom - e) return speed(y - (bottom - e));
  return 0;
}
