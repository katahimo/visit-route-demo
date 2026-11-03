import { CircleStop, ListFilter, MapPinned, Pencil } from 'lucide-react';
import { type Ref, useMemo } from 'react';
import { RouteMap } from '../components/RouteMap';
import { WithIcon } from '../components/ui';
import type { PlaceAllRun } from '../components/usePlaceAllRun';
import { hasLocation } from '../lib/common';
import { EXTERNAL_NOTICE, lookupMessage } from '../lib/geocode';
import {
  hasAddressNotFound,
  NO_PLACE_NOTE,
  type PlaceAllResult,
  type PlaceAllTexts,
  type PlacePerson,
  placeAllRunLabel,
  placeAllTexts,
  placePeople,
} from '../lib/placeAll';
import { useDemoData } from '../store';
import '../components/placeLookup.css';

/** ほかの名簿の置く処理が終わるのを待っている間の文（外部の検索は同時に1本。ADR-0016） */
const PLACE_WAITING = 'ほかの名簿の緯度・経度を探し終わるのを待っています';

/** 「位置なしだけ見る」の押している状態と切り替え（一覧の絞り込み） */
export type NoPlaceOnly = { on: boolean; toggle: () => void };

type Fail = Extract<PlaceAllResult, { ok: false }>;

/**
 * 位置の無い人をまとめて地図に置く欄（PRD D89・D90・D427。ADR-0016・ADR-0094）。〈利用者さん〉一覧・〈スタッフ〉一覧・
 * 登録の案内の上に出す。1行目は「位置が未登録の〈…〉：N人」と［位置の無い N人を地図に置く］（一度探したあとは［続きを探す］）・
 * ［位置なしだけ見る］と、位置が無くても担当は組める補足（ADR-0093）。郵便番号・住所の検索が切（geocodeOn が false）なら
 * 探すボタンと送る先の注記は出さない。状態と処理は usePlaceAllRun。ref は名簿を読み込んだあとに移るフォーカスの先
 */
export function PlaceAllPanel({
  model,
  geocodeOn,
  onEdit,
  only,
  ref,
}: {
  model: PlaceAllRun;
  geocodeOn: boolean;
  /** その人の画面の場所（自宅）の欄を開く */
  onEdit: (id: string) => void;
  /** 無ければ［位置なしだけ見る］を出さない（登録の案内） */
  only?: NoPlaceOnly;
  ref?: Ref<HTMLDivElement>;
}) {
  const { data } = useDemoData();
  const { kind, targets, skipped, running, waiting, total, results, stopped, tried, run, stop } = model;
  const t = placeAllTexts(kind, data.org.terms);
  const byId = useMemo(() => new Map(placePeople(data, kind).map((p) => [p.id, p])), [data, kind]);
  const fails = results.filter((r): r is Fail => !r.ok);
  const missing = targets.length + skipped.length;
  if (missing === 0 && results.length === 0) return null;

  const why = running ? '探しています' : targets.length === 0 ? t.none : null;
  const ok = results.filter((r) => r.ok).length;
  return (
    <div className="card stack place-all" data-testid="place-all" data-kind={kind} ref={ref} tabIndex={-1}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <strong>
          <WithIcon icon={MapPinned} size={16}>
            {t.heading}：{missing}人
          </WithIcon>
        </strong>
        <span className="sub" data-testid="place-all-count">
          {t.has} {targets.length}人{skipped.length > 0 ? `・${t.hasNot} ${skipped.length}人` : ''}
        </span>
        {geocodeOn && (
          <button
            type="button"
            className="btn btn-small"
            aria-disabled={why ? true : undefined}
            title={why ?? t.how}
            onClick={() => !why && void run()}
            data-testid="place-all-run"
          >
            <WithIcon icon={MapPinned} size={14}>
              {placeAllRunLabel({ targets: targets.length, tried })}
            </WithIcon>
          </button>
        )}
        {running && (
          <button type="button" className="btn btn-small" onClick={stop} data-testid="place-all-stop">
            <WithIcon icon={CircleStop} size={14}>
              止める
            </WithIcon>
          </button>
        )}
        {only && missing > 0 && (
          <button
            type="button"
            className="btn btn-small"
            aria-pressed={only.on}
            onClick={only.toggle}
            data-testid="place-all-only"
          >
            <WithIcon icon={ListFilter} size={14}>
              {only.on ? 'すべて見る' : '緯度・経度なしだけ見る'}
            </WithIcon>
          </button>
        )}
      </div>
      <span className="sub" data-testid="place-all-note">
        {NO_PLACE_NOTE}
      </span>
      {geocodeOn && <span className="sub place-notice">{EXTERNAL_NOTICE}</span>}
      {(running || stopped || results.length > 0) && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <progress className="place-all-progress" max={Math.max(total, 1)} value={results.length} aria-hidden="true" />
          <output data-testid="place-all-progress">
            {waiting
              ? `${PLACE_WAITING}${total > 0 ? `… ${results.length}／${total}人` : ''}`
              : running
                ? `探しています… ${results.length}／${total}人`
                : `${stopped ? '止めました' : '終わりました'}：${results.length}／${total}人`}
            （入れた {ok}人・見つからない {fails.length}人）
          </output>
        </div>
      )}
      {fails.length > 0 && <FailList fails={fails} byId={byId} t={t} onEdit={onEdit} />}
      {skipped.length > 0 && <SkippedList skipped={skipped} t={t} onEdit={onEdit} />}
      {!running && <PlacedMap results={results} byId={byId} t={t} />}
    </div>
  );
}

/**
 * 走っている置く処理の1行（登録の案内で、いまの段の欄に出ない種類の分。PRD D427）：進み具合と［止める］。
 * 走っていなければ出さない
 */
export function PlaceAllBusyLine({ model }: { model: PlaceAllRun }) {
  const { data } = useDemoData();
  const { kind, running, waiting, total, results, stop } = model;
  if (!running) return null;
  const t = placeAllTexts(kind, data.org.terms);
  return (
    <div
      className="row"
      style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}
      data-testid="place-all-busy"
      data-kind={kind}
    >
      <output className="sub" data-testid="place-all-busy-progress">
        {waiting ? `${t.term}：${PLACE_WAITING}` : `${t.term}の緯度・経度を探しています… ${results.length}／${total}人`}
      </output>
      <button type="button" className="btn btn-small" onClick={stop} data-testid="place-all-busy-stop">
        <WithIcon icon={CircleStop} size={14}>
          止める
        </WithIcon>
      </button>
    </div>
  );
}

/** 置けなかった人と理由（「編集」でその人の場所の欄へ） */
function FailList({
  fails,
  byId,
  t,
  onEdit,
}: {
  fails: Fail[];
  byId: Map<string, PlacePerson>;
  t: PlaceAllTexts;
  onEdit: (id: string) => void;
}) {
  return (
    <div className="stack" style={{ gap: 4 }} data-testid="place-all-failed">
      <span className="sub">
        見つからなかった{t.term}（編集の欄で住所を直すか、地図をクリックして緯度・経度を入れてください）
      </span>
      {hasAddressNotFound(fails) && (
        <span className="sub" data-testid="place-all-city-hint">
          市区町村の名前が無い住所（「〇〇区〇〇」など）は見つからないことがあります。編集の欄で市区町村から書き足してください
        </span>
      )}
      <ul className="place-all-fails">
        {fails.map((f) => {
          const p = byId.get(f.personId);
          return (
            <li key={f.personId} data-testid="place-all-fail">
              <strong>{p?.name ?? '（消えた人）'}</strong>：
              {f.foundAddress !== null && (
                <span data-testid="place-all-address-only">住所だけ入れました（{f.foundAddress}）。緯度・経度は </span>
              )}
              {lookupMessage(f.reason, f.step)}{' '}
              {p && (
                <button type="button" className="btn btn-small" onClick={() => onEdit(p.id)}>
                  <WithIcon icon={Pencil} size={13}>
                    編集
                  </WithIcon>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 探す手がかりの無い人（「編集」でその人の場所の欄へ） */
function SkippedList({
  skipped,
  t,
  onEdit,
}: {
  skipped: PlacePerson[];
  t: PlaceAllTexts;
  onEdit: (id: string) => void;
}) {
  return (
    <div className="stack" style={{ gap: 4 }} data-testid="place-all-skipped">
      <span className="sub">{t.skipped}（編集の欄で入れてください）</span>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {skipped.map((p) => (
          <button key={p.id} type="button" className="btn btn-small" onClick={() => onEdit(p.id)}>
            <WithIcon icon={Pencil} size={13}>
              {p.name}
            </WithIcon>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 置いた人の地図（毎回作り直すと地図が寄せ直すので memo） */
function PlacedMap({
  results,
  byId,
  t,
}: {
  results: PlaceAllResult[];
  byId: Map<string, PlacePerson>;
  t: PlaceAllTexts;
}) {
  const points = useMemo(
    () =>
      results.flatMap((r) => {
        const p = r.ok ? byId.get(r.personId) : undefined;
        return p && hasLocation(p.place) ? [{ lat: p.place.lat, lng: p.place.lng, ...p.mark }] : [];
      }),
    [results, byId],
  );
  if (points.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 4 }} data-testid="place-all-map">
      <span className="sub">
        入れた{t.term}（ずれていれば、編集の欄で「緯度・経度を消す」→地図をクリックで直せます）
      </span>
      <RouteMap points={points} height={240} />
    </div>
  );
}
