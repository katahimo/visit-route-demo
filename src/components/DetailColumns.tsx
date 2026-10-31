import { useSyncExternalStore } from 'react';
import { DETAIL_COLUMNS_LABEL, detailColumnsShown } from '../lib/peopleView';
import { columnsOpenKey, navOpenMemory } from '../store';
import { useFeature } from './useFeature';

/**
 * 〈利用者さん〉・〈スタッフ〉の一覧の「くわしい列」（エキスパート機能が入のとき。PRD D394）。
 * 切り替えは一覧ごとに端末に覚える（store/navOpen の `columns:<一覧>`。読み直しても同じ）。
 * 出すかの判定は lib/peopleView の detailColumnsShown。切のときは切り替えを出さず、いつも3列
 */
export function useDetailColumns(list: 'clients' | 'staff'): { available: boolean; detailed: boolean } {
  const expert = useFeature('expert');
  const stored = useSyncExternalStore(navOpenMemory.subscribe, navOpenMemory.read, navOpenMemory.cached);
  return { available: expert, detailed: detailColumnsShown(expert, stored[columnsOpenKey(list)] === true) };
}

/** 表の上の「くわしい列」の切り替え（チェックボックス。入のときだけ） */
export function DetailColumnsToggle({ list }: { list: 'clients' | 'staff' }) {
  const { available, detailed } = useDetailColumns(list);
  if (!available) return null;
  return (
    <div className="row people-columns-bar" data-testid="people-columns">
      <label className="check">
        <input
          type="checkbox"
          checked={detailed}
          onChange={(e) => navOpenMemory.write(columnsOpenKey(list), e.target.checked)}
          data-testid="people-columns-toggle"
        />
        {DETAIL_COLUMNS_LABEL}
      </label>
    </div>
  );
}
