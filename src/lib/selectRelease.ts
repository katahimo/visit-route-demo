// 選んだもの（複数選択の訪問・日の予定で選んだ〈スタッフ〉と訪問）を Esc で外してよいかの判定。DOM は触らない

/** 文字を打つ要素（この中の Esc は入力の取り消しに使うので、選択は外さない） */
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Esc で選択を外すか：Esc で、ほかが先に受けておらず（defaultPrevented）、IME の変換中でなく、
 * 入力欄の中でなく、モーダル・右の欄が開いていない（overlayOpen。それぞれの Esc で閉じる）とき
 */
export function escReleases(x: {
  key: string;
  defaultPrevented: boolean;
  isComposing: boolean;
  targetTag: string | null;
  overlayOpen: boolean;
}): boolean {
  if (x.key !== 'Escape' || x.defaultPrevented || x.isComposing || x.overlayOpen) return false;
  return x.targetTag === null || !TYPING_TAGS.has(x.targetTag.toUpperCase());
}
