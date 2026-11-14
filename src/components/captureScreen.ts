// いま見えている画面を画像（JPEG の data URL）にする（PRD D449。ADR-0114）。modern-screenshot（DOM を SVG に写して描く）を使い、
// 外へは送らない。撮るのは見えている範囲だけ：文書全体を写し、巻いた分だけずらして画面の大きさで切る。
// 写しは巻かれていないので、固定（fixed）・貼り付き（sticky）の部品は見えている位置へずらす（印の属性を付け、写しの側で動かす）

/** 撮らない部品（意見のボタンとダイアログ）に付ける属性 */
export const NO_CAPTURE_ATTR = 'data-no-capture';
/** 写しの側でずらす量（`<x>px <y>px`）を入れる属性（撮るあいだだけ付ける） */
const SHIFT_ATTR = 'data-capture-shift';
/** スマホの幅（これより狭ければ、字が読めるよう2倍で撮る） */
const NARROW_PX = 700;

/** 固定・貼り付きの部品に、写しの側でずらす量の印を付ける。付けた要素を返す */
function markShifts(sx: number, sy: number): HTMLElement[] {
  const marked: HTMLElement[] = [];
  for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
    const pos = getComputedStyle(el).position;
    if (pos !== 'sticky' && pos !== 'fixed') continue;
    let dx = sx;
    let dy = sy;
    if (pos === 'sticky') {
      // 貼り付いていないときの位置との差（position を一時的に relative にして測る）
      const shown = el.getBoundingClientRect();
      const { position, inset } = el.style;
      el.style.position = 'relative';
      el.style.inset = 'auto';
      const natural = el.getBoundingClientRect();
      el.style.position = position;
      el.style.inset = inset;
      dx = shown.left - natural.left;
      dy = shown.top - natural.top;
    }
    if (dx === 0 && dy === 0) continue;
    el.setAttribute(SHIFT_ATTR, `${dx}px ${dy}px`);
    marked.push(el);
  }
  return marked;
}

/** 画面の地の色（body、透明なら html、どちらも透明なら白）。JPEG は透明を持てないので、地の色で塗る */
function pageBackground(): string {
  for (const el of [document.body, document.documentElement]) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return '#fff';
}

/** いま見えている画面の画像。撮れなければ null（意見は文だけで残せる） */
export async function captureScreen(): Promise<string | null> {
  const sx = window.scrollX;
  const sy = window.scrollY;
  const marked = markShifts(sx, sy);
  try {
    const { domToCanvas } = await import('modern-screenshot');
    const shot = await domToCanvas(document.documentElement, {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: window.innerWidth < NARROW_PX ? Math.min(2, window.devicePixelRatio || 1) : 1,
      timeout: 8000,
      style: { transform: `translate(${-sx}px, ${-sy}px)` },
      filter: (node) => !(node instanceof Element && node.hasAttribute(NO_CAPTURE_ATTR)),
      onCloneEachNode: (cloned) => {
        if (!(cloned instanceof HTMLElement)) return;
        const shift = cloned.getAttribute(SHIFT_ATTR);
        if (shift) cloned.style.translate = shift;
      },
    });
    // 地の色で塗ってから重ねる（写しは巻いた分ずらしているので、写しの地だけでは下が塗られない。JPEG は透明を持てない）
    const out = document.createElement('canvas');
    out.width = shot.width;
    out.height = shot.height;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = pageBackground();
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(shot, 0, 0);
    return out.toDataURL('image/jpeg', 0.7);
  } catch (e) {
    console.error(e);
    return null;
  } finally {
    for (const el of marked) el.removeAttribute(SHIFT_ATTR);
  }
}
