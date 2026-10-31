// チップの欄を畳む計測（PickChips。PRD D140）：全員を並べて位置を測り、rows 行に入らない人（選んでいる人を除く）を描く前に外す
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { foldHidden } from '../lib/fold';

export type ChipFold = { rows: number; open: boolean; onOpenChange: (open: boolean) => void };

/**
 * 畳みの計測。measured は畳んだとき隠す人（開いているあいだも測っておき、「畳む」を出すかに使う。測り終えるまで null）、
 * hidden は今隠している人（畳んでいて測り終えているときだけ）
 */
export function useChipFold(
  fold: ChipFold | undefined,
  label: string,
  people: readonly { id: string }[],
  isOn: (id: string) => boolean,
) {
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const [width, setWidth] = useState(0);
  const folding = !!fold;
  /** 書体の読み込みが終わったら測り直す（読み込み前に測ると幅が違い、行の数がずれたまま「あと N人」が出なくなる） */
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    if (!folding) return;
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) setFontEpoch(1);
    });
    return () => {
      alive = false;
    };
  }, [folding]);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!folding || !el) return;
    setWidth(Math.round(el.clientWidth));
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [folding]);
  /** 測り直す鍵：幅・書体の読み込み・人・選んでいるか・見出しが変われば測り直す（ドラッグ中の強調では変えない） */
  const foldKey = fold
    ? `${width}|${fontEpoch}|${label}|${people.map((p) => `${p.id}:${isOn(p.id) ? 1 : 0}`).join(',')}`
    : null;
  const [hiddenFor, setHiddenFor] = useState<{ key: string; ids: Set<string> } | null>(null);
  const measured = foldKey !== null && hiddenFor?.key === foldKey ? hiddenFor.ids : null;
  const hidden = fold && !fold.open ? measured : null;
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
