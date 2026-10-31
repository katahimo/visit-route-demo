// チップの欄を畳む計測（PickChips。PRD D140）：全員を並べて位置を測り、rows 行に入らない人（選んでいる人を除く）を描く前に外す
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chipFoldKey, type FoldChip, foldHidden, nextFullHeight } from '../lib/fold';

export type ChipFold = { rows: number; open: boolean; onOpenChange: (open: boolean) => void };

/**
 * 畳みの計測。measured は畳んだとき隠す人（開いているあいだも測っておき、「畳む」を出すかに使う。測り終えるまで null）、
 * hidden は今隠している人（畳んでいて測り終えているときだけ）
 */
export function useChipFold(
  fold: ChipFold | undefined,
  label: string,
  people: readonly FoldChip[],
  isOn: (id: string) => boolean,
) {
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const [width, setWidth] = useState(0);
  const folding = !!fold;
  const [height, setHeight] = useState(0);
  /** 書体が遅れて読み込まれたら測り直す（アプリに @font-face は無く、端末の書体だけなら起きない。起きるときの備え） */
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    if (!folding) return;
    const fonts = document.fonts;
    if (!fonts) return;
    const onDone = () => setFontEpoch((n) => n + 1);
    fonts.addEventListener('loadingdone', onDone);
    return () => fonts.removeEventListener('loadingdone', onDone);
  }, [folding]);
  /** 今、全員を並べているか（畳んで隠している間は false）。ResizeObserver が畳んだ高さを採らないための印 */
  const fullRef = useRef(true);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!folding || !el) return;
    setWidth(Math.round(el.clientWidth));
    setHeight((h) => nextFullHeight(h, el.scrollHeight, fullRef.current));
    // 幅のほか、中身の高さ（書体・折り返しの違いで行が増減したとき）も測り直しのきっかけにする。
    // disconnect したあとは呼ばれないので、アンマウント後の setState は起きない
    const ro = new ResizeObserver(() => {
      setWidth(Math.round(el.clientWidth));
      setHeight((h) => nextFullHeight(h, el.scrollHeight, fullRef.current));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [folding]);
  /** 測り直す鍵：幅・高さ・書体・見出し・チップの表示・選んでいるかが変われば測り直す */
  const foldKey = fold ? chipFoldKey({ width, height, epoch: fontEpoch, label }, people, isOn) : null;
  const [hiddenFor, setHiddenFor] = useState<{ key: string; ids: Set<string> } | null>(null);
  const measured = foldKey !== null && hiddenFor?.key === foldKey ? hiddenFor.ids : null;
  const hidden = fold && !fold.open ? measured : null;
  fullRef.current = !hidden || hidden.size === 0;
  useLayoutEffect(() => {
    const root = rootRef.current;
    // 測るのは全員を並べているとき（開いている、または畳んでいてまだ測っていない）
    if (foldKey === null || measured !== null || !root || !fold) return;
    const items = [...root.querySelectorAll<HTMLElement>('[data-fold-item]')].map((el) => ({
      id: el.dataset.foldItem ?? '',
      top: el.getBoundingClientRect().top,
    }));
    const first = root.querySelector('legend')?.getBoundingClientRect().top;
    const keep = new Set(people.filter((p) => isOn(p.id)).map((p) => p.id));
    setHiddenFor({ key: foldKey, ids: foldHidden(items, keep, fold.rows, first) });
  });
  return { rootRef, measured, hidden };
}
