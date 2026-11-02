import { HeartHandshake } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { DetailPopover } from '../components/DetailPopover';
import { ClientDetail, StaffDetail } from '../components/personDetail';
import { PeopleTabs } from '../components/SettingsTabs';
import { PageHeader } from '../components/ui';
import type { CompatLevel } from '../contracts/rules';
import { EMPTY_FILTER, sameFilter } from '../lib/clientFilter';
import { compatLevelOf, setCompatLevel } from '../lib/compatLevel';
import { EMPTY_STAFF_FILTER, sameStaffFilter } from '../lib/compatView';
import { useDemoData } from '../store';
import { CompatChoice } from './compatChoice';
import { CompatFilterBox } from './compatFilters';
import { CompatEmpty, CompatLegend, type CompatOpenKind, CompatTable } from './compatTable';
import { useCompatFilters } from './useCompatFilters';
import './settings.css';

/** 開いている吹き出し（見出し・名前は ID、マスは〈利用者さん〉の ID と〈スタッフ〉の sid で持ち、そのたびに引く） */
type Opened = { kind: CompatOpenKind; id: string; sid?: string };

/**
 * 相性：訪問先×スタッフの表。マスを押すと相性を選ぶ欄（◎・○・未入力・△・×。×は担当にしない。PRD D420）。
 * 列の見出し・行の名前を押すと詳細の吹き出し（PRD D114・D115）。表の上の畳んだ「絞り込み」で列（?sf=）と行（?cf=）を絞り込む（PRD D116）。
 * 絞り込みは useCompatFilters、欄は compatFilters、表は compatTable、選ぶ欄は compatChoice
 */
export default function CompatPage() {
  const { data, update } = useDemoData();
  const terms = data.org.terms;
  const uid = useId();
  const [opened, setOpened] = useState<Opened | null>(null);
  const filters = useCompatFilters(data);
  const { shownStaff, shownClients, staffFilter, clientFilter, setStaffFilter, setClientFilter } = filters;

  /** 見出し・名前・マスを押す（同じものをもう一度押すと閉じる） */
  const open = useCallback(
    (kind: CompatOpenKind, id: string, sid?: string) =>
      setOpened((o) => (o && o.kind === kind && o.id === id && o.sid === sid ? null : { kind, id, sid })),
    [],
  );
  const close = useCallback(() => setOpened(null), []);
  const isOpen = (kind: CompatOpenKind, id: string) => opened?.kind === kind && opened.id === id;
  const popId = (kind: CompatOpenKind, id: string) => `${uid}-${kind}-${id}`;
  const cellAnchorId = `${uid}-cell`;

  // 絞り込みで見出し・マスが消えたら吹き出しを閉じる
  const openStaff =
    opened?.kind === 'staff' || opened?.kind === 'cell'
      ? shownStaff.find((s) => s.id === (opened.kind === 'cell' ? opened.sid : opened.id))
      : undefined;
  const openClient =
    opened?.kind === 'client' || opened?.kind === 'cell' ? shownClients.find((c) => c.id === opened.id) : undefined;
  const shown = opened?.kind === 'cell' ? !!openStaff && !!openClient : !!openStaff || !!openClient;
  if (opened && !shown) setOpened(null);
  const noStaff = shownStaff.length === 0;
  const noClients = shownClients.length === 0;

  const pick = (level: CompatLevel) => {
    if (!openClient || !openStaff) return;
    const cid = openClient.id;
    const sid = openStaff.id;
    update((d) => ({ ...d, compat: setCompatLevel(d.compat, cid, sid, level) }), '相性');
    close();
  };

  return (
    <div className="stack">
      <PageHeader nav={<PeopleTabs />} icon={HeartHandshake} title="相性" lead="マスを押して相性を選びます" />
      <CompatFilterBox filters={filters} terms={terms} visitTypes={data.visitTypes} />
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
            cellAnchorId={cellAnchorId}
            onOpen={open}
          />
        )}
      </div>
      {opened?.kind === 'cell' && openStaff && openClient && (
        <CompatChoice
          key={`cell-${openClient.id}-${openStaff.id}`}
          id={popId('cell', openClient.id)}
          anchorId={cellAnchorId}
          clientName={openClient.displayName}
          staffName={openStaff.name}
          current={compatLevelOf(
            Object.hasOwn(data.compat, openClient.id) ? data.compat[openClient.id] : undefined,
            openStaff.id,
          )}
          onPick={pick}
          onClose={close}
        />
      )}
      {opened?.kind === 'staff' && openStaff && (
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
      {opened?.kind === 'client' && openClient && (
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
