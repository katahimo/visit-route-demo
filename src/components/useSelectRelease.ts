// 選んだものを外す操作（Esc・空いた所を押す）のフック。判定は lib/selectRelease（純粋関数。テストあり）
import { useEffect, useRef } from 'react';
import { escReleases } from '../lib/selectRelease';

/** 開いているとその Esc を優先する重なり（モーダル・右の欄） */
const OVERLAY_SELECTOR = '[aria-modal="true"], .side-panel';

/**
 * 押すと何かが起きる要素。これの上を押したときは「空いた所」にしない
 * （帯・カード・区間・見出し・リンク・入力欄・開いた詳細の中・吹き出し・地図）
 */
const ACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="dialog"]',
  '[tabindex]',
  '[draggable="true"]',
  '.tl-detail',
  '.route-detail',
  '.leaflet-container',
].join(', ');

/** active の間、Esc（入力欄の中・モーダルや右の欄が開いている間・IME の変換中は除く）で onRelease */
export function useEscRelease(active: boolean, onRelease: () => void) {
  const ref = useRef(onRelease);
  ref.current = onRelease;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      const ok = escReleases({
        key: e.key,
        defaultPrevented: e.defaultPrevented,
        isComposing: e.isComposing,
        targetTag: t?.tagName ?? null,
        overlayOpen: document.querySelector(OVERLAY_SELECTOR) !== null,
      });
      if (ok) ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

/**
 * active の間、area（CSS のセレクタ）の中の空いた所（押すと何かが起きる要素の外）を押したら onRelease。
 * 文字を選んでいるとき（なぞって選んだ）は外さない
 */
export function useBlankClickRelease(active: boolean, area: string, onRelease: () => void) {
  const ref = useRef(onRelease);
  ref.current = onRelease;
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      const t = e.target instanceof Element ? e.target : null;
      if (!t?.closest(area) || t.closest(ACTIVE_SELECTOR)) return;
      if (window.getSelection()?.isCollapsed === false) return;
      ref.current();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [active, area]);
}
