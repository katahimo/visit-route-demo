import { type ReactNode, type RefObject, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { trapTarget } from '../lib/confirmDialog';
import { FOCUSABLE } from './ui';
import { inertLock, useBodyScrollLock } from './useBodyScrollLock';
import './confirmDialog.css';

/** 開いてから背景のクリックを無視する時間（ミリ秒） */
const BACKDROP_GUARD_MS = 300;

/**
 * 独自の確認ダイアログの殻（PRD D146〜D150。ADR-0026）：画面の中央にアプリの見た目で出す。中身は children。
 * body の直下に出し、開いているあいだ body のほかの子（#root・右の欄・メニューの引き出し）を inert にする。
 * 最初のフォーカスは initialFocus（取り消し＝安全な側）。Tab は中で回す。Esc・背景を押すは onCancel。閉じたら開く前の要素へ戻す。
 * 裏の画面は巻かない（useBodyScrollLock）。確認（ConfirmDialog）と設定のひな形の手順（SettingSetSteps）で使う
 */
export function DialogShell({
  onCancel,
  initialFocus,
  className,
  labelledBy,
  describedBy,
  testId,
  children,
}: {
  onCancel: () => void;
  initialFocus: RefObject<HTMLElement | null>;
  /** confirm-dialog に足すクラス（is-danger など） */
  className?: string;
  labelledBy: string;
  describedBy?: string;
  testId: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  /** 開いた時刻（背景のクリックを少しのあいだ無視する） */
  const openedAt = useRef(performance.now());
  useBodyScrollLock();
  // biome-ignore lint/correctness/useExhaustiveDependencies: 開いたときだけ（initialFocus は ref）
  useEffect(() => {
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // 裏（body のほかの子）を操作できなくする。要素ごとに数えるロックで、引き出しと閉じる順が逆でも残さない
    const releaseInert = inertLock.lock(
      Array.from(document.body.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el !== wrapRef.current,
      ),
    );
    // 長い中身（設定のひな形の手順）でも見出しから読めるよう、フォーカスで下へ巻かない
    initialFocus.current?.focus({ preventScroll: true });
    // 捕捉の段で受け、右の欄・引き出しの Esc（document で受けている）に渡さない
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        cancelRef.current();
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      e.stopPropagation();
      const list = [...boxRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
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
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div ref={wrapRef} className="confirm-wrap" data-testid="confirm-wrap">
      {/* 背景を押すと取り消し（キーボードは Esc・取り消しのボタン） */}
      <div
        className="confirm-backdrop"
        aria-hidden="true"
        onClick={(e) => {
          // 開くボタンのダブルクリックの2回目が背景に当たって取り消しにならないよう、開いてすぐ・連続のクリックは無視する
          if (e.detail > 1 || performance.now() - openedAt.current < BACKDROP_GUARD_MS) return;
          cancelRef.current();
        }}
        data-testid="confirm-backdrop"
      />
      <div
        ref={boxRef}
        className={`confirm-dialog ${className ?? ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        data-testid={testId}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
