import { ChevronDown, House, ListFilter, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClientFilter } from '../components/ClientFilter';
import { RosterButton, RosterCard } from '../components/RosterCard';
import { BasicsNav } from '../components/SettingsTabs';
import { PageHeader, WithIcon } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { COMPACT_QUERY, useMedia } from '../components/useMedia';
import type { Client } from '../contracts/documents';
import { EMPTY_FILTER } from '../lib/clientFilter';
import { STAGE_LABELS } from '../lib/clientStage';
import { ClientsTable } from './clientsTable';
import { PlaceAllPanel } from './PlaceAllPanel';
import { useClientsList } from './useClientsList';
import './settings.css';

/**
 * 〈利用者さん〉一覧（PoC本体 ClientsPage.tsx を写し、性別希望・NG を特性・条件・相性に置き換えた）。
 * 行を押すとその人の画面（`#/clients/:id`。ClientPage）へ、「追加」は新しい人の画面（`#/clients/new`）へ（PRD D308）。
 * 「Excel・CSV」で名簿の欄（書き出し・読み込み。ADR-0068）を開く
 */

export default function ClientsPage() {
  // 機能の入り切り（ADR-0028）：切った機能の入力の欄・表示を出さない（データは消さず、保存しても今の値を残す）
  const stageOn = useFeature('clientStage');
  const allowedOn = useFeature('allowedStaff');
  const geocodeOn = useFeature('geocode');
  // 名簿の欄（Excel・CSV。ADR-0068）。Excel の入出力を切っていれば出さない（ADR-0028 の excel）
  const excelOn = useFeature('excel');
  const [rosterOpen, setRosterOpen] = useState(false);
  const rosterId = useId();
  /**
   * 狭い画面（600px 以下）では絞り込みの欄を「絞り込み（N）」のボタンの下に畳む（PRD D220。N は効いている絞り込みの数。
   * はじめは畳む。開いたかは画面の中だけ。広い画面ではいつも開いたまま）
   */
  const narrow = useMedia(COMPACT_QUERY);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBodyId = useId();
  const { data, clients, staff, activeStaff, filter, setFilter, facts, shown, filterCount, periodLabel, usualMap } =
    useClientsList();
  const terms = data.org.terms;
  const navigate = useNavigate();
  /** その人の画面へ */
  const openPerson = (c: Client) => navigate(`/clients/${encodeURIComponent(c.id)}`);

  return (
    <div className="stack">
      <PageHeader
        nav={<BasicsNav />}
        icon={House}
        title={`${terms.client}一覧`}
        lead={`${terms.client}の住所・特性・条件を決めます`}
        actions={
          <>
            {excelOn && (
              <RosterButton open={rosterOpen} onToggle={() => setRosterOpen((o) => !o)} controls={rosterId} />
            )}
            <Link to="/clients/new" className="btn btn-primary" data-testid="client-add">
              <WithIcon icon={Plus}>{terms.client}を追加</WithIcon>
            </Link>
          </>
        }
      />

      {excelOn && rosterOpen && <RosterCard kind="client" id={rosterId} onClose={() => setRosterOpen(false)} />}

      <div className="card stack" data-testid="clients-filter">
        {narrow && (
          <div className="row narrow-filter-head">
            <button
              type="button"
              className="btn btn-small narrow-filter-toggle"
              aria-expanded={filterOpen}
              aria-controls={filterBodyId}
              onClick={() => setFilterOpen((o) => !o)}
              data-testid="narrow-filter-toggle"
            >
              <WithIcon icon={ListFilter} size={14}>
                絞り込み（{filterCount}）
              </WithIcon>
              <ChevronDown size={14} aria-hidden="true" className="narrow-filter-mark" />
            </button>
            <span className="sub" data-testid="narrow-filter-count">
              {shown.length}人を表示
            </span>
          </div>
        )}
        <div id={filterBodyId} className="stack narrow-filter-body" hidden={narrow && !filterOpen}>
          <ClientFilter
            clients={clients}
            state={filter}
            onChange={setFilter}
            facts={facts}
            staff={activeStaff}
            terms={{ client: terms.client, staff: terms.staff }}
            periodLabel={periodLabel}
            defaults={EMPTY_FILTER}
            visitTypes={data.visitTypes}
            testId="clients-cf"
          />
          <span className="sub">
            {STAGE_LABELS.inquiry}〜{STAGE_LABELS.contract}
            の人は、一覧の「状態」の印で見分けられます。新しい相談は「空き状況」の画面で受けられる曜日・時間を試算し、仮押さえすると「
            {STAGE_LABELS.inquiry}」で入ります
          </span>
        </div>
      </div>

      {/* まとめて置けなかった人の「編集」は、住所を入れるためにその人の画面の住所の節を開く */}
      {/* 郵便番号・住所の検索を切っていれば出さない（ADR-0028 の geocode） */}
      {geocodeOn && (
        <PlaceAllPanel onEdit={(c) => navigate(`/clients/${encodeURIComponent(c.id)}?tab=basic&edit=place`)} />
      )}

      {/* 狭い画面（600px 以下）では行をカードにする（PRD D220。名前と状態が1行目、ほかは見出し付きの行、開くは右下） */}
      <div className="card table-scroll">
        <ClientsTable
          shown={shown}
          data={data}
          staff={staff}
          usualMap={usualMap}
          stageOn={stageOn}
          allowedOn={allowedOn}
          onOpen={openPerson}
        />
      </div>
    </div>
  );
}
