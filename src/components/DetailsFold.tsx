import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import { DETAILS_LABEL } from '../lib/exceptionView';
import { type DetailsScreen, detailsOpenKey, navOpenMemory } from '../store';
import './detailsFold.css';

/**
 * 「詳しく ▾」（点数・理由・件数の内訳・凡例・進み具合を畳む入れ物。PRD D384・D393。ADR-0073・ADR-0074）。
 * はじめは閉じている。screen を渡すと（予定の月・週・日・空き状況）開け閉めを画面ごとに端末に覚え、読み直しても開いたまま。
 * heading を渡すと（入）、閉じていても読めるよう見出しの1行に要点の数（点数・移動・未確定など。lib/detailsHeading）を出す。
 * 中身が無いときは呼ぶ側が出さない（lib/exceptionView の foldedParts で、いま中身がある項目を確かめてから置く）
 */
export function DetailsFold({
  children,
  testId = 'details-fold',
  forceOpen = false,
  screen,
  heading,
}: {
  children: ReactNode;
  testId?: string;
  /** true になったら開く（中の欄を直す指定で来たとき。開いたあとの開け閉めは利用者の操作のまま） */
  forceOpen?: boolean;
  /** 開け閉めを覚える画面（予定の月・週・日と空き状況。無ければ覚えず、閉じて始める） */
  screen?: DetailsScreen;
  /** 見出しの1行の数（空なら出さない） */
  heading?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const stored = useSyncExternalStore(navOpenMemory.subscribe, navOpenMemory.read, navOpenMemory.cached);
  const key = screen ? detailsOpenKey(screen) : null;
  const remembered = key ? stored[key] === true : undefined;
  useEffect(() => {
    if (forceOpen && ref.current) ref.current.open = true;
  }, [forceOpen]);
  return (
    <details
      ref={ref}
      className="details-fold"
      data-testid={testId}
      open={remembered}
      onToggle={(e) => {
        if (key && e.currentTarget.open !== remembered) navOpenMemory.write(key, e.currentTarget.open);
      }}
    >
      <summary data-testid={`${testId}-summary`}>
        {DETAILS_LABEL} ▾
        {heading && (
          <span className="details-fold-heading" data-testid={`${testId}-heading`}>
            {heading}
          </span>
        )}
      </summary>
      <div className="details-fold-body stack">{children}</div>
    </details>
  );
}
