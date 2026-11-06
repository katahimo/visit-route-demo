// 画面を開いたあとに新しい版が公開され、Excel の部品を読めなかったときの立て直し：
// 選んだファイルを控えて（store の stashReloadFile）画面を自動で読み直し、読み直した先の同じ欄が同じファイルで読み込みを続ける。
// 読み直しても読めなければ（2回目）、控えずに「画面を読み直す」の文を出す（読み直しを繰り返さない）
import { useEffect, useRef } from 'react';
import { isStaleBuild } from '../lib/common';
import { reloadPage } from '../lib/reloadPage';
import { flushSave, stashReloadFile, takeReloadFile } from '../store';

/**
 * e が古い版の部品の失敗で、読み直したあとの続き（resumed）でなければ、file を控えて読み直す。読み直すなら true
 * （控えられない＝大きすぎる・書けないときは false。呼ぶ側はいつもの文を出す）
 */
export async function reloadOnStale(
  e: unknown,
  x: { target: string; file: File; option?: string; resumed: boolean },
): Promise<boolean> {
  if (!isStaleBuild(e) || x.resumed) return false;
  const bytes = new Uint8Array(await x.file.arrayBuffer());
  const ok = stashReloadFile({ target: x.target, option: x.option ?? '', name: x.file.name, type: x.file.type, bytes });
  if (ok) reloadPage(flushSave);
  return ok;
}

/** 読み直した直後、target の欄の控えがあれば取り出して resume に渡す（開いたときに1回だけ） */
export function useResumeAfterReload(target: string, resume: (file: File, option: string) => void): void {
  const latest = useRef(resume);
  latest.current = resume;
  useEffect(() => {
    const f = takeReloadFile(target);
    if (f) latest.current(new File([f.bytes], f.name, { type: f.type }), f.option);
  }, [target]);
}
