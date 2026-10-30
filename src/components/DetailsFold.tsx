import type { ReactNode } from 'react';
import { DETAILS_LABEL } from '../lib/exceptionView';
import './detailsFold.css';

/**
 * 「詳しく ▾」（エキスパート機能が切のとき、点数・理由・件数の内訳・凡例・進み具合を畳む入れ物。PRD D384。ADR-0073）。
 * はじめは閉じている（開け閉めは覚えない）。中身が無ければ出さない
 */
export function DetailsFold({ children, testId = 'details-fold' }: { children: ReactNode; testId?: string }) {
  return (
    <details className="details-fold" data-testid={testId}>
      <summary data-testid={`${testId}-summary`}>{DETAILS_LABEL} ▾</summary>
      <div className="details-fold-body stack">{children}</div>
    </details>
  );
}
