import { type RefObject, useEffect } from 'react';
import { trapTarget } from '../lib/confirmDialog';
import { FOCUSABLE } from './ui';
import { inertLock } from './useBodyScrollLock';

/**
 * ツアーのカードを出している間の見張り（確認ダイアログと同じ流儀）：body のほかの子を inert、最初のフォーカスは「次へ」、
 * Esc は closeRef の関数で閉じる、Tab は中で回す、閉じたら開く前の要素へフォーカスを戻す
 */
export function useTourModal({
  wrapRef,
  boxRef,
  nextRef,
  closeRef,
}: {
  wrapRef: RefObject<HTMLDivElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  nextRef: RefObject<HTMLButtonElement | null>;
  closeRef: RefObject<() => void>;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: 開いたときに1回だけ（ref は中身を読むだけ）
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseInert = inertLock.lock(
      Array.from(document.body.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el !== wrapRef.current,
      ),
    );
    nextRef.current?.focus();
    // 捕捉の段で受け、右の欄・引き出し・コマンドパレットのキー（document・window で受けている）に渡さない
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      e.stopPropagation();
      // ラジオは選んでいる方だけ Tab で止まる（標準の radio group と同じ。切り替えは矢印）
      const box = boxRef.current;
      const list = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) =>
          !(el instanceof HTMLInputElement) ||
          el.type !== 'radio' ||
          el.checked ||
          !box.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`),
      );
      const at = document.activeElement;
      const to = trapTarget(list.length, at instanceof HTMLElement ? list.indexOf(at) : -1, e.shiftKey);
      if (to === null) return;
      e.preventDefault();
      list[to]?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      releaseInert();
      if (back?.isConnected && back !== document.body) back.focus({ preventScroll: true });
    };
  }, []);
}
