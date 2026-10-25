// ページを読み直す（チャンクを読めなかったとき。PRD D248）。保存は間引いているので、待っている保存を書いてから少し待って読み直す。
// 保存を書くのは store なので、書く関数（store の flushSave）は呼ぶ側から受け取る（lib は store を import しない）

/** 読み直すまでの待ち（main.tsx の「初期状態に戻して読み直す」と同じ） */
export const RELOAD_WAIT_MS = 500;

/** flush（待っている保存を書く）を呼んでから、RELOAD_WAIT_MS 待って読み直す。flush が投げても読み直す */
export function reloadPage(flush: () => void): void {
  try {
    flush();
  } catch (e) {
    console.error(e);
  }
  setTimeout(() => location.reload(), RELOAD_WAIT_MS);
}
