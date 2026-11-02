// 相性の画面の絞り込みの欄（PRD D116・D420）：列（〈スタッフ〉）と行（〈利用者さん〉）を1つの畳んだ「絞り込み」に入れる。
// 値と書き換えは useCompatFilters
import { memo } from 'react';
import { ClientFilter } from '../components/ClientFilter';
import { StaffFilter } from '../components/StaffFilter';
import type { Terms, VisitType } from '../contracts/documents';
import { EMPTY_FILTER } from '../lib/clientFilter';
import { compatFilterSummary, EMPTY_STAFF_FILTER } from '../lib/compatView';
import type { CompatFilters } from './useCompatFilters';

/** 絞り込みの欄（相性のマスを変えても、引数が変わらなければ描き直さない） */
const MemoClientFilter = memo(ClientFilter);

export function CompatFilterBox({
  filters: f,
  terms,
  visitTypes,
}: {
  filters: CompatFilters;
  terms: Pick<Terms, 'client' | 'staff'>;
  visitTypes: readonly VisitType[];
}) {
  return (
    <details
      className="card compat-filter"
      open={f.open}
      onToggle={(e) => f.setOpen(e.currentTarget.open)}
      data-testid="compat-filters"
    >
      <summary className="compat-filter-summary">
        <span className="compat-filter-title">絞り込み</span>
        <span className="sub" data-testid="compat-filter-summary">
          {compatFilterSummary(
            { state: f.staffFilter, shown: f.shownStaff.length, total: f.staff.length },
            { state: f.clientFilter, shown: f.shownClients.length, total: f.clients.length },
            terms,
          )}
        </span>
      </summary>
      <div className="compat-filters">
        <section
          className="compat-filter-part"
          aria-label={`${terms.staff}（列）の絞り込み`}
          data-testid="compat-sf-box"
        >
          <h3 className="compat-filter-part-title">{terms.staff}（列）</h3>
          <StaffFilter
            staff={f.staff}
            state={f.staffFilter}
            onChange={f.setStaffFilter}
            defs={f.defs}
            defaults={EMPTY_STAFF_FILTER}
            staffTerm={terms.staff}
            testId="compat-sf"
          />
        </section>
        <section
          className="compat-filter-part"
          aria-label={`${terms.client}（行）の絞り込み`}
          data-testid="compat-cf-box"
        >
          <h3 className="compat-filter-part-title">{terms.client}（行）</h3>
          <MemoClientFilter
            clients={f.clients}
            state={f.clientFilter}
            onChange={f.setClientFilter}
            facts={f.facts}
            staff={f.staff}
            terms={f.filterTerms}
            periodLabel={f.periodLabel}
            defaults={EMPTY_FILTER}
            visitTypes={visitTypes}
            extraChips={f.extraChips}
            hideEnded
            testId="compat-cf"
          />
        </section>
      </div>
    </details>
  );
}
