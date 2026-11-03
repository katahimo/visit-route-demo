import { ChevronDown, House, ListFilter, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClientFilter } from '../components/ClientFilter';
import { DetailColumnsToggle, useDetailColumns } from '../components/DetailColumns';
import { RosterButton, RosterCard } from '../components/RosterCard';
import { PeopleTabs } from '../components/SettingsTabs';
import { PageHeader, WithIcon } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { useIntro } from '../components/useIntro';
import { COMPACT_QUERY, useMedia } from '../components/useMedia';
import { useNoPlaceRow } from '../components/useNoPlaceRow';
import { usePlaceAllRun } from '../components/usePlaceAllRun';
import { useRosterAutoPlace } from '../components/useRosterAutoPlace';
import type { Client } from '../contracts/documents';
import { EMPTY_FILTER, toggleExtra } from '../lib/clientFilter';
import { STAGE_LABELS } from '../lib/clientStage';
import { peopleIntro, showStageNote } from '../lib/peopleView';
import { NO_PLACE_CHIP } from '../lib/placeAll';
import { ClientsTable } from './clientsTable';
import { PlaceAllPanel } from './PlaceAllPanel';
import { useClientsList } from './useClientsList';
import './settings.css';

/**
 * 〈利用者さん〉一覧（PoC本体 ClientsPage.tsx を写したもの。性別希望・NG は特性・条件・相性で持つ）。
 * 行を押すとその人の画面（`#/clients/:id`。ClientPage）へ、「追加」は新しい人の画面（`#/clients/new`）へ（PRD D308）。
 * 「Excel・CSV」で名簿の欄（書き出し・読み込み。ADR-0068）を開く。名簿が入ったら、郵便番号・住所の検索が入なら
 * 位置の無い人を自動でまとめて地図に置き始める（PRD D427。ADR-0094）。位置の無い人は絞り込みのチップ「位置なし」と
 * 行の「位置なし」（［住所から探す］［地図で置く］）で分かる
 */

/** 絞り込みに足すチップ「位置なし」（PRD D427） */
const NO_PLACE_CHIPS = [
  { key: NO_PLACE_CHIP, label: '位置なし', help: '地図の位置が未登録の人（終了を除く）' },
] as const;

export default function ClientsPage() {
  // 機能の入り切り（ADR-0028）：切った機能の入力の欄・表示を出さない（データは消さず、保存しても今の値を残す）
  const stageOn = useFeature('clientStage');
  const allowedOn = useFeature('allowedStaff');
  const geocodeOn = useFeature('geocode');
  // 一覧の列は名前・住所・いつもの予定の3列。入は表の上の「くわしい列」で専門の列を足せる（PRD D385・D394）
  const { available: expert, detailed } = useDetailColumns('clients');
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
  const lead = useIntro('clients', `${terms.client}の住所・特性・条件を決めます`, peopleIntro('clients'));
  const navigate = useNavigate();
  /** その人の画面へ */
  const openPerson = (c: Client) => navigate(`/clients/${encodeURIComponent(c.id)}`);
  // まとめて地図に置く（PRD D89・D427）。名簿が入ったあと（自動で始める）・行の［住所から探す］も同じ処理を使う
  const placeRun = usePlaceAllRun('client');
  const autoPlace = useRosterAutoPlace({ run: placeRun, geocodeOn, onStart: () => setRosterOpen(false) });
  /** その人の画面の住所の節を開く（まとめて置けなかった人の「編集」・行の［地図で置く］） */
  const openPlace = (id: string) => navigate(`/clients/${encodeURIComponent(id)}?tab=basic&edit=place`);
  const noPlace = useNoPlaceRow({ run: placeRun, geocodeOn, onMap: openPlace });
  const noPlaceOnly = {
    on: (filter.extra ?? []).includes(NO_PLACE_CHIP),
    toggle: () => setFilter(toggleExtra(filter, NO_PLACE_CHIP)),
  };

  return (
    <div className="stack">
      <PageHeader
        // 一覧・相性の小さいタブ（入切とも。PRD D394）
        nav={<PeopleTabs />}
        icon={House}
        // 見出しはメニューの名前と同じ（PRD D230）
        title={terms.client}
        lead={lead}
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

      {excelOn && (
        <RosterCard
          kind="client"
          id={rosterId}
          open={rosterOpen}
          onClose={() => setRosterOpen(false)}
          onPlace={autoPlace.onPlace}
        />
      )}

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
            extraChips={NO_PLACE_CHIPS}
            testId="clients-cf"
          />
          {showStageNote(detailed) && (
            <span className="sub">
              {STAGE_LABELS.inquiry}〜{STAGE_LABELS.contract}
              の人は、一覧の「状態」の印で見分けられます。新しい相談は「空き状況」の画面で受けられる曜日・時間を試算し、仮押さえすると「
              {STAGE_LABELS.inquiry}」で入ります
            </span>
          )}
        </div>
      </div>

      {/* 位置の無い人の1行（まとめて置く・位置なしだけ見る）。郵便番号・住所の検索が切なら探すボタンは出さない（ADR-0028 の geocode） */}
      <PlaceAllPanel
        model={placeRun}
        geocodeOn={geocodeOn}
        ref={autoPlace.panelRef}
        onEdit={openPlace}
        only={noPlaceOnly}
      />

      {/* 狭い画面（600px 以下）では行をカードにする（PRD D220。名前と状態が1行目、ほかは見出し付きの行、開くは右下） */}
      <DetailColumnsToggle list="clients" />
      <div className="card table-scroll">
        <ClientsTable
          shown={shown}
          data={data}
          staff={staff}
          usualMap={usualMap}
          stageOn={stageOn}
          allowedOn={allowedOn}
          detailed={detailed}
          expert={expert}
          onOpen={openPerson}
          noPlace={noPlace}
        />
      </div>
    </div>
  );
}
