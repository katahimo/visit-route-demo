import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { firstRunBackAction, isFirstRunEntry } from '../lib/firstRun';
import { useDemoData } from '../store';

/**
 * ブラウザの「戻る」「進む」と最初の設定（PRD D381・D438）：最初の設定を出していた履歴の項目（FIRST_RUN_ENTRY の印）へ
 * 戻ったら、最初の設定をやり直しとして出す（答えるまでは今のデータのまま・「閉じる」で今のデータのまま戻る）。
 * やり直しの2問を出しているあいだに、印の無い項目へ移ったら閉じる。開いたとき・読み直したときは見ない（履歴での移動だけ）。
 * 戻った直後の描画から2問を出すか（true）を返す。本体の画面を先に出すと、`#/` の転送が項目を置き換えて印が消えるため
 */
export function useFirstRunBack(): boolean {
  const { needsFirstRun, redoingFirstRun, askFirstRun, cancelFirstRun } = useDemoData();
  const location = useLocation();
  const navType = useNavigationType();
  const lastKey = useRef(location.key);
  const moved = lastKey.current !== location.key && navType === 'POP';
  const marked = isFirstRunEntry(location.state);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 履歴の項目が替わったとき（location.key）だけ見る
  useEffect(() => {
    if (lastKey.current === location.key) return;
    lastKey.current = location.key;
    const act = firstRunBackAction({ pop: navType === 'POP', marked, needsFirstRun, redoing: redoingFirstRun });
    if (act === 'ask') askFirstRun();
    else if (act === 'cancel') cancelFirstRun();
  }, [location.key]);
  return moved && marked;
}
