import { type RefObject, useEffect, useRef } from 'react';
import { inertLock, useBodyScrollLock } from './useBodyScrollLock';

/** 欄の中で Tab で移れるもの */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

type Options = {
  panelRef: RefObject<HTMLElement | null>;
  wrapRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  fallbackFocus?: () => HTMLElement | null | undefined;
  returnFocus?: () => HTMLElement | null | undefined;
  focusPanel: boolean;
  focusKey?: string;
};

/**
 * 右から出る欄（SidePanel）のフォーカスと裏の画面の扱い：開いたら最初の入力欄（無ければ欄そのもの）へ移り、
 * 開いているあいだ裏を巻かず・inert にし、Esc で閉じ、Tab は欄の中で回し、閉じたら元のボタンへ戻す。
 * 中身が入れ替わった（focusKey が変わった）ときもフォーカスを移す
 */
export function useSidePanelFocus({
  panelRef,
  wrapRef,
  onClose,
  fallbackFocus,
  returnFocus,
  focusPanel,
  focusKey,
}: Options) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;
  const returnRef = useRef(returnFocus);
  returnRef.current = returnFocus;
  /** 開いたときの値だけを使う */
  const focusPanelRef = useRef(focusPanel);
  // 開いているあいだ裏の画面を巻かない（スマホのメニューの引き出しと重なっても数で数える）
  useBodyScrollLock();
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    // 開いているあいだ裏（body のほかの子：#root・メニューの引き出し）を inert にする（PRD D252。確認ダイアログと同じ
    // 要素ごとに数えるロック）。後から body の直下に出る吹き出し・確認ダイアログ・知らせ（data-inert-keep）は巻き込まない
    const releaseInert = inertLock.lock(
      Array.from(document.body.children).filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el !== wrapRef.current && !el.hasAttribute('data-inert-keep'),
      ),
    );
    const first = focusPanelRef.current
      ? null
      : panelRef.current?.querySelector<HTMLElement>('input, select, textarea');
    if (first) first.focus();
    else panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // 日本語の変換中の Esc は変換の取り消しなので閉じない
      if (e.key === 'Escape' && !e.isComposing) {
        // 裏の Esc（選んだ訪問を外すなど）に渡さない
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current || e.defaultPrevented) return;
      // 欄の中の名前から開いた詳細の吹き出しの中の Tab は、吹き出しに任せる（PRD D200）
      if (document.activeElement?.closest('.detail-popover')) return;
      const list = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      const head = list[0];
      const tail = list.at(-1);
      if (!head || !tail) {
        e.preventDefault();
        return;
      }
      const at = document.activeElement;
      const inside = at instanceof Node && panelRef.current.contains(at);
      if (e.shiftKey && (!inside || at === head || at === panelRef.current)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && (!inside || at === tail)) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // inert を外してから戻す（inert の中の要素にはフォーカスできない）
      releaseInert();
      const to = returnRef.current?.();
      if (to) to.focus({ preventScroll: true });
      else if (back?.isConnected) back.focus?.();
      else fallbackRef.current?.()?.focus();
    };
  }, [panelRef, wrapRef]);
  // 中身が入れ替わったら（開いたときは上で移しているので2回目から）、戻り先の印・最初の入力欄・欄そのものの順で
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    const first =
      panelRef.current?.querySelector<HTMLElement>('[data-return-focus]') ??
      panelRef.current?.querySelector<HTMLElement>('input, select, textarea');
    if (first) first.focus();
    else panelRef.current?.focus();
  }, [focusKey, panelRef]);
}
