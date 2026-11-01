// 訪問の帯・行を選ぶ・押す（PRD D339〜D341。ADR-0056）：Shift／Ctrl＋クリック・Shift／Ctrl＋Enter・スマホは長押しか「選ぶ」と、
// キーで動かす・押して開く
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isMultiClick, isMultiKey, toggleGroup, toggleId } from '../lib/visitSelect';
import { toldDateOf, useOpenTold } from './openTold';

/**
 * 帯・行・札の button に重ねる props（useVisitItem の押し方・useVisitDrag の source・呼ぶ側の data-*）
 */
export type VisitItemProps = ButtonHTMLAttributes<HTMLButtonElement> & { [k: `data-${string}`]: unknown };

// ---- 選ぶ ----

/**
 * 選んだ訪問（日・週・月・人の予定表）。key（日付・週・月・人）が変わったら外す。Esc で外す（入力欄の中・欄が開いている間は除く）
 */
export function useVisitSelection(key: string) {
  const [ids, setIds] = useState<readonly string[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付・週・月が変わったら外す
  useEffect(() => {
    setIds([]);
  }, [key]);
  const toggle = useCallback((id: string) => setIds((xs) => toggleId(xs, id)), []);
  const toggleMany = useCallback((group: readonly string[]) => setIds((xs) => toggleGroup(xs, group)), []);
  const clear = useCallback(() => setIds([]), []);
  useEffect(() => {
    if (ids.length === 0) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"], .side-panel')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      setIds([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ids.length]);
  const set = useMemo(() => new Set(ids), [ids]);
  return { ids, has: (id: string) => set.has(id), toggle, toggleMany, clear, set: setIds };
}
export type VisitSelection = ReturnType<typeof useVisitSelection>;

/** 長押しとみなす時間（ms） */
export const LONG_PRESS_MS = 500;
/** 押したあと、これより動けば押したことにしない（px） */
const MOVE_SLOP = 10;

type KeyHandler = (e: KeyboardEvent<HTMLElement>, visitId: string) => boolean;

/**
 * 訪問の帯・行の押し方（どの画面でも同じ）。返す関数に訪問と「選べるか」「動かせるか」を渡すと、button に付ける props を返す：
 * クリック（Shift／Ctrl＋クリックで選ぶ・選ぶ形なら選ぶ・ほかは開く）、キー（Shift／Ctrl＋Enter で選ぶ・動かせればキーで動かす）、
 * longPress なら長押し（500ms）で選ぶ形に入って選ぶ（スマホ）
 */
export function useVisitItem(opts: {
  selection: Pick<VisitSelection, 'toggle'> | null;
  onOpen: (visitId: string) => void;
  keys?: KeyHandler | null;
  selecting?: boolean;
  longPress?: { onSelecting: (on: boolean) => void } | null;
}) {
  const ref = useRef(opts);
  ref.current = opts;
  const openTold = useOpenTold();
  const press = useRef<{
    id: string;
    x: number;
    y: number;
    long: boolean;
    moved: boolean;
    timer: number | null;
  } | null>(null);
  const stop = () => {
    const p = press.current;
    if (p?.timer) window.clearTimeout(p.timer);
    if (p) p.timer = null;
  };
  return (visitId: string, f: { selectable: boolean; movable: boolean; selected: boolean }) => {
    const o = ref.current;
    const lp = o.longPress;
    return {
      onClick: (e: MouseEvent<HTMLElement>) => {
        const p = press.current;
        press.current = null;
        if (p && p.id === visitId && (p.long || p.moved)) return;
        // 「変更あり」の印（expert 切。ADR-0073）：札の選択・開くにはせず、その日の連絡の一覧を開く
        const toldDate = toldDateOf(e.target);
        if (toldDate !== null) {
          e.preventDefault();
          openTold(toldDate);
          return;
        }
        if (isMultiClick(e) && o.selection) {
          e.preventDefault();
          if (f.selectable) o.selection.toggle(visitId);
          return;
        }
        if (o.selecting && o.selection) {
          if (f.selectable) o.selection.toggle(visitId);
          return;
        }
        o.onOpen(visitId);
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (isMultiKey(e) && o.selection) {
          e.preventDefault();
          if (f.selectable) o.selection.toggle(visitId);
          return;
        }
        if (f.movable && o.keys) o.keys(e, visitId);
      },
      ...(lp
        ? {
            onPointerDown: (e: PointerEvent<HTMLElement>) => {
              if (e.button !== 0) return;
              stop();
              const p = {
                id: visitId,
                x: e.clientX,
                y: e.clientY,
                long: false,
                moved: false,
                timer: null as number | null,
              };
              if (f.selectable && o.selection)
                p.timer = window.setTimeout(() => {
                  p.timer = null;
                  p.long = true;
                  lp.onSelecting(true);
                  o.selection?.toggle(visitId);
                }, LONG_PRESS_MS);
              press.current = p;
            },
            onPointerMove: (e: PointerEvent<HTMLElement>) => {
              const p = press.current;
              if (!p) return;
              if (Math.abs(e.clientX - p.x) > MOVE_SLOP || Math.abs(e.clientY - p.y) > MOVE_SLOP) {
                p.moved = true;
                stop();
              }
            },
            onPointerUp: stop,
            onPointerCancel: stop,
            onContextMenu: (e: MouseEvent<HTMLElement>) => {
              // 長押しで出るブラウザのメニューを出さない（長押しは選ぶ）
              if (f.selectable) e.preventDefault();
            },
          }
        : {}),
      'aria-pressed': f.selected || o.selecting ? f.selected : undefined,
      'data-selected': f.selected || undefined,
      'data-visit-item': '',
    };
  };
}
