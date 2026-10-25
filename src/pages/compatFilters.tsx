// 相性の画面の絞り込みの欄（PRD D116）：列（〈スタッフ〉）と行（〈利用者さん〉）の畳める欄。値と書き換えは useCompatFilters
import { memo } from 'react';
import { ClientFilter } from '../components/ClientFilter';
import { StaffFilter } from '../components/StaffFilter';
import type { Terms, VisitType } from '../contracts/documents';
import { EMPTY_FILTER } from '../lib/clientFilter';
import { clientFilterSummary, EMPTY_STAFF_FILTER, staffFilterSummary } from '../lib/compatView';
import type { CompatFilters } from './useCompatFilters';

/** 絞り込みの欄（相性のセルを押しても、引数が変わらなければ描き直さない） */
const MemoClientFilter = memo(ClientFilter);

export function CompatFilterBoxes({
  filters: f,
  terms,
  visitTypes,
}: {
  filters: CompatFilters;
  terms: Pick<Terms, 'client' | 'staff'>;
  visitTypes: readonly VisitType[];
}) {
  return (
    <div className="compat-filters" data-testid="compat-filters">
      <details
        className="card compat-filter"
        open={f.sfOpen}
        onToggle={(e) => f.setSfOpen(e.currentTarget.open)}
        data-testid="compat-sf-box"
      >
        <summary className="compat-filter-summary">
          <span className="compat-filter-title">{terms.staff}（列）の絞り込み</span>
          <span className="sub" data-testid="compat-sf-summary">
            {staffFilterSummary(f.staffFilter, f.shownStaff.length, f.staff.length, terms.staff)}
          </span>
        </summary>
        <StaffFilter
          staff={f.staff}
          state={f.staffFilter}
          onChange={f.setStaffFilter}
          defs={f.defs}
          defaults={EMPTY_STAFF_FILTER}
          staffTerm={terms.staff}
          testId="compat-sf"
        />
      </details>
      <details
        className="card compat-filter"
        open={f.cfOpen}
        onToggle={(e) => f.setCfOpen(e.currentTarget.open)}
        data-testid="compat-cf-box"
      >
        <summary className="compat-filter-summary">
          <span className="compat-filter-title">{terms.client}（行）の絞り込み</span>
          <span className="sub" data-testid="compat-cf-summary">
            {clientFilterSummary(f.clientFilter, f.shownClients.length, f.clients.length, terms.client)}
          </span>
        </summary>
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
      </details>
    </div>
  );
}
