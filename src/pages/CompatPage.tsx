import { HeartHandshake } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { DetailPopover } from '../components/DetailPopover';
import { ClientDetail, StaffDetail } from '../components/personDetail';
import { BasicsNav } from '../components/SettingsTabs';
import { PageHeader } from '../components/ui';
import { EMPTY_FILTER, sameFilter } from '../lib/clientFilter';
import { cycleCompat } from '../lib/compatLevel';
import { EMPTY_STAFF_FILTER, sameStaffFilter } from '../lib/compatView';
import { useDemoData } from '../store';
import { CompatFilterBoxes } from './compatFilters';
import { CompatEmpty, CompatLegend, type CompatOpenKind, CompatTable } from './compatTable';
import { useCompatFilters } from './useCompatFilters';
import './settings.css';

/** 開いている吹き出し（見出しのボタンは ID で持ち、そのたびに引く） */
type Opened = { kind: CompatOpenKind; id: string };

/**
 * 相性：訪問先×スタッフの表。セルを押すと ◎→○→空→△→× を回す（×は担当にしない）。
 * 列の見出し・行の名前を押すと詳細の吹き出し（PRD D114・D115）。表の上で列（?sf=）と行（?cf=）を絞り込む（PRD D116）。
 * 絞り込みは useCompatFilters、欄は compatFilters、表は compatTable
 */
export default function CompatPage() {
  const { data, update } = useDemoData();
  const terms = data.org.terms;
  const uid = useId();
  const [opened, setOpened] = useState<Opened | null>(null);
  const filters = useCompatFilters(data);
  const { shownStaff, shownClients, staffFilter, clientFilter, setStaffFilter, setClientFilter } = filters;

  const cycle = useCallback(
    (clientId: string, staffId: string) =>
      update((d) => ({ ...d, compat: cycleCompat(d.compat, clientId, staffId) }), '相性'),
    [update],
  );

  /** 見出しのボタンを押す（同じボタンをもう一度押すと閉じる） */
  const toggle = useCallback(
    (kind: CompatOpenKind, id: string) => setOpened((o) => (o && o.kind === kind && o.id === id ? null : { kind, id })),
    [],
  );
  const close = useCallback(() => setOpened(null), []);
  const isOpen = (kind: CompatOpenKind, id: string) => opened?.kind === kind && opened.id === id;
  const popId = (kind: CompatOpenKind, id: string) => `${uid}-${kind}-${id}`;

  // 絞り込みで見出しが消えたら吹き出しを閉じる
  const openStaff = opened?.kind === 'staff' ? shownStaff.find((s) => s.id === opened.id) : undefined;
  const openClient = opened?.kind === 'client' ? shownClients.find((c) => c.id === opened.id) : undefined;
  if (opened && !openStaff && !openClient) setOpened(null);
  const noStaff = shownStaff.length === 0;
  const noClients = shownClients.length === 0;

  return (
    <div className="stack">
      <PageHeader
        nav={<BasicsNav />}
        icon={HeartHandshake}
        title="相性"
        lead="セルを押すと ◎ → ○ → 空 → △ → × と変わります"
      />
      <CompatFilterBoxes filters={filters} terms={terms} visitTypes={data.visitTypes} />
      <div className="card stack">
        <CompatLegend stale={filters.stale} onResort={filters.resort} />
        {noStaff || noClients ? (
          <CompatEmpty
            staff={
              noStaff
                ? {
                    term: terms.staff,
                    filtered: !sameStaffFilter(staffFilter, EMPTY_STAFF_FILTER),
                    onReset: () => setStaffFilter(EMPTY_STAFF_FILTER),
                  }
                : null
            }
            clients={
              noClients
                ? {
                    term: terms.client,
                    filtered: !sameFilter(clientFilter, EMPTY_FILTER),
                    onReset: () => setClientFilter(EMPTY_FILTER),
                  }
                : null
            }
          />
        ) : (
          <CompatTable
            clientTerm={terms.client}
            staff={shownStaff}
            clients={shownClients}
            compat={data.compat}
            isOpen={isOpen}
            popId={popId}
            onToggle={toggle}
            onCycle={cycle}
          />
        )}
        <p className="sub">
          休止中の{terms.client}・{terms.staff}は出していません。
        </p>
      </div>
      {openStaff && (
        <DetailPopover
          key={`staff-${openStaff.id}`}
          id={popId('staff', openStaff.id)}
          anchorId={`${popId('staff', openStaff.id)}-btn`}
          title={openStaff.name}
          titleId={`${popId('staff', openStaff.id)}-title`}
          onClose={close}
          testId="compat-pop"
        >
          <StaffDetail staff={openStaff} data={data} linkTestId="compat-pop-link" countsTestId="compat-pop-counts" />
        </DetailPopover>
      )}
      {openClient && (
        <DetailPopover
          key={`client-${openClient.id}`}
          id={popId('client', openClient.id)}
          anchorId={`${popId('client', openClient.id)}-btn`}
          title={openClient.displayName}
          titleId={`${popId('client', openClient.id)}-title`}
          onClose={close}
          testId="compat-pop"
        >
          <ClientDetail client={openClient} data={data} linkTestId="compat-pop-link" />
        </DetailPopover>
      )}
    </div>
  );
}
