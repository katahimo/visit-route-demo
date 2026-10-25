import { type RefObject, useEffect } from 'react';
import { isPaletteShortcut } from '../lib/commandPalette';
import { trapTarget } from '../lib/confirmDialog';
import { FOCUSABLE } from './ui';
import { inertLock } from './useBodyScrollLock';

/**
 * コマンドパレットを出している間の見張り：body のほかの子を inert、入力欄へフォーカス、Esc・開くキーで closeRef を呼ぶ、
 * Tab は中で回す、閉じたら開く前の要素へフォーカスを戻す
 */
export function usePaletteModal({
  wrapRef,
  boxRef,
  inputRef,
  closeRef,
  isMac,
}: {
  wrapRef: RefObject<HTMLDivElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  closeRef: RefObject<() => void>;
  isMac: boolean;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: 開いたときに1回だけ（ref は中身を読むだけ）
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseInert = inertLock.lock(
      Array.from(document.body.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el !== wrapRef.current,
      ),
    );
    inputRef.current?.focus();
    // 捕捉の段で受け、右の欄・引き出しの Esc・Tab（document で受けている）に渡さない
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Escape' && !e.isComposing) || isPaletteShortcut(e, isMac)) {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      e.stopPropagation();
      const list = [...boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      const now = document.activeElement;
      const to = trapTarget(list.length, now instanceof HTMLElement ? list.indexOf(now) : -1, e.shiftKey);
      if (to === null) return;
      e.preventDefault();
      list[to]?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      releaseInert();
      // 開く前の要素が消えていたら（吹き出しの中から開いて、吹き出しが閉じたなど）上の帯の「探す」へ
      // 開く前の要素が消えていたら、見えている「探す」（広い画面は上の帯、狭い画面は下のタブ）へ
      const opener = [
        ...document.querySelectorAll<HTMLElement>('[data-testid="cmdk-open"], [data-testid="bottom-search"]'),
      ].find((el) => el.offsetParent !== null);
      const to = back?.isConnected ? back : opener;
      to?.focus({ preventScroll: true });
    };
  }, []);
}

/** 選んでいる候補を見える所へ。先頭なら一番上まで、種類の先頭の候補なら見出しごと見せる（↓ で末尾から回ったときに見出しを隠さない） */
export function usePaletteScroll(
  listRef: RefObject<HTMLDivElement | null>,
  at: number,
  optionId: (i: number) => string,
) {
  useEffect(() => {
    const list = listRef.current;
    const el = at < 0 ? null : document.getElementById(optionId(at));
    if (!list || !el) return;
    if (at === 0) {
      list.scrollTop = 0;
      return;
    }
    el.scrollIntoView({ block: 'nearest' });
    const title = el.previousElementSibling;
    if (title instanceof HTMLElement && title.classList.contains('cmdk-group-title')) {
      const top = title.getBoundingClientRect().top - list.getBoundingClientRect().top;
      if (top < 0) list.scrollTop += top;
    }
  });
}
