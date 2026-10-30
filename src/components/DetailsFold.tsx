import { type ReactNode, useEffect, useRef } from 'react';
import { DETAILS_LABEL } from '../lib/exceptionView';
import './detailsFold.css';

/**
 * 「詳しく ▾」（エキスパート機能が切のとき、点数・理由・件数の内訳・凡例・進み具合を畳む入れ物。PRD D384。ADR-0073）。
 * はじめは閉じている（開け閉めは覚えない）。中身が無いときは呼ぶ側が出さない（lib/exceptionView の foldedParts で、いま中身がある項目を確かめてから置く）
 */
export function DetailsFold({
  children,
  testId = 'details-fold',
  forceOpen = false,
}: {
  children: ReactNode;
  testId?: string;
  /** true になったら開く（中の欄を直す指定で来たとき。開いたあとの開け閉めは利用者の操作のまま） */
  forceOpen?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (forceOpen && ref.current) ref.current.open = true;
  }, [forceOpen]);
  return (
    <details ref={ref} className="details-fold" data-testid={testId}>
      <summary data-testid={`${testId}-summary`}>{DETAILS_LABEL} ▾</summary>
      <div className="details-fold-body stack">{children}</div>
    </details>
  );
}
