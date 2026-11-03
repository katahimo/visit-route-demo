// 表のマスに札を積む入れ物（PRD D342。ADR-0057）：残りは「+N」で、押すとそのマスの札の一覧
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './visitParts.css';

/** 1マスに出す札の数（残りは「+N」） */
export const CHIPS_PER_CELL = 3;

/**
 * 表のマスに札を積む入れ物（PRD D342）：先頭から max 件（keep の訪問は必ず見せる：キーで動かした・欄で直した札）、残りは「+N」。
 * 「+N」を押すとそのマスの札の一覧（リストの行。モーダルにしない吹き出し。Esc・外を押すと閉じて「+N」へ）
 */
export function ChipStack<T extends { visitId: string }>({
  items,
  max = CHIPS_PER_CELL,
  keep,
  chip,
  row,
  listTitle,
  dragging = false,
  testId,
}: {
  items: readonly T[];
  max?: number;
  keep?: string | null;
  chip: (it: T) => ReactNode;
  row: (it: T) => ReactNode;
  /** 一覧の見出し（「10/28（水） 山田さんの訪問 5件」） */
  listTitle: string;
  /** ドラッグ中（一覧を薄くし、マウスを受けない。消すとドラッグが止まるので消さない） */
  dragging?: boolean;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  let shown = items.slice(0, max);
  if (keep && items.length > max && !shown.some((x) => x.visitId === keep)) {
    const k = items.find((x) => x.visitId === keep);
    if (k) shown = [...items.slice(0, max - 1), k];
  }
  const rest = items.length - shown.length;
  // 札が減って「+N」が無くなったら閉じる
  useEffect(() => {
    if (open && rest <= 0) setOpen(false);
  }, [open, rest]);
  /** 一覧の置き場所（「+N」の下。入らなければ上。表の箱は横に巻くので、body の直下に出して位置を合わせる） */
  const [at, setAt] = useState<{ left: number; top: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setAt(null);
      return;
    }
    const place = () => {
      const b = moreRef.current?.getBoundingClientRect();
      if (!b) return;
      const w = Math.min(300, window.innerWidth * 0.8);
      const left = Math.max(8, Math.min(b.left, window.innerWidth - w - 8));
      const up = b.bottom + 330 > window.innerHeight && b.top > window.innerHeight - b.bottom;
      setAt({ left, top: up ? b.top - 4 : b.bottom + 4, up });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[data-visit-item]')?.focus());
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (listRef.current?.contains(t) || moreRef.current?.contains(t))) return;
      // 一覧の行から開いた訪問の詳細の欄・確認の中を押しても閉じない
      if (t instanceof Element && t.closest('.drawer-wrap, [role="alertdialog"]')) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);
  if (items.length === 0) return null;
  return (
    <span className="vchips" data-testid={testId}>
      {shown.map((it) => (
        <span key={it.visitId} className="vchip-slot">
          {chip(it)}
        </span>
      ))}
      {rest > 0 && (
        <button
          ref={moreRef}
          type="button"
          className="vchip-more"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={`ほか${rest}件（押すとこのマスの訪問の一覧）`}
          onClick={() => setOpen(!open)}
          data-testid="chip-more"
          data-rest={rest}
        >
          +{rest}
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="dialog"
            aria-label={listTitle}
            className={`vchip-list${dragging ? ' is-dragging' : ''}${at?.up ? ' is-up' : ''}`}
            style={at ? { left: at.left, top: at.top } : { visibility: 'hidden' }}
            data-testid="chip-list"
            onKeyDown={(e) => {
              if (e.defaultPrevented) return;
              if (e.key === 'Tab') {
                // body の直下に出しているので、端の Tab は「+N」へ戻して閉じる（フォーカスを関係ない所へ落とさない）
                const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-visit-item]') ?? [])];
                const edge = e.shiftKey ? items[0] : items.at(-1);
                if (items.length > 0 && document.activeElement !== edge) return;
              } else if (e.key !== 'Escape') return;
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              moreRef.current?.focus();
            }}
          >
            <p className="vchip-list-title">{listTitle}</p>
            <ul className="vrow-list">
              {items.map((it) => (
                <li key={it.visitId}>{row(it)}</li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </span>
  );
}
