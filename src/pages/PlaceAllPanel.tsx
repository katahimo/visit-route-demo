import { CircleStop, MapPinned, Pencil } from 'lucide-react';
import { type Ref, useMemo } from 'react';
import { RouteMap } from '../components/RouteMap';
import { WithIcon } from '../components/ui';
import type { PlaceAllRun } from '../components/usePlaceAllRun';
import type { Client } from '../contracts/documents';
import { colorOf, initialOf } from '../lib/colors';
import { hasLocation } from '../lib/common';
import { EXTERNAL_NOTICE, lookupMessage } from '../lib/geocode';
import { hasAddressNotFound, type PlaceAllResult } from '../lib/placeAll';
import { useDemoData } from '../store';
import '../components/placeLookup.css';

/** 送る先と中身の注記（PRD D90。まとめて置く欄と名簿のあとの導線で同じ文） */
const PLACE_ALL_NOTICE = `${EXTERNAL_NOTICE}（押したときだけ。1人ずつ間をあけて順に送ります。名前などほかの項目は送りません）`;

/**
 * 名簿を読み込んだあとの導線（PRD D399。ADR-0076）：名簿の欄の読み込みのすぐ下に出すふつうのボタンと注記。
 * 押すと一覧の画面がまとめて置く欄へ移って始める（この1回の押しが送る同意）
 */
export function PlaceAllLead({ label, onRun }: { label: string; onRun: () => void }) {
  return (
    <div className="stack" style={{ gap: 4 }} data-testid="roster-place-lead">
      <button
        type="button"
        className="btn"
        style={{ alignSelf: 'flex-start' }}
        onClick={onRun}
        data-testid="roster-place-all"
      >
        <WithIcon icon={MapPinned}>{label}</WithIcon>
      </button>
      <span className="sub place-notice">{PLACE_ALL_NOTICE}</span>
    </div>
  );
}

/**
 * 位置の無い〈利用者さん〉をまとめて地図に置く（PRD D89・D90。ADR-0016）。Excel の読み込みのあとなどに使う。
 * 状態と処理（対象・1人ずつ順に外部の検索を呼び、置けた人を1人ごとに書く）は一覧の画面が持つ usePlaceAllRun。
 * ref は名簿のあとの導線から移るときのフォーカスの先（PRD D399）
 */
export function PlaceAllPanel({
  model,
  onEdit,
  ref,
}: {
  model: PlaceAllRun;
  onEdit: (c: Client) => void;
  ref?: Ref<HTMLDivElement>;
}) {
  const { data } = useDemoData();
  const terms = data.org.terms;
  const { targets, skipped, running, total, results, stopped, run, stop } = model;
  const clientById = useMemo(() => new Map(data.clients.map((c) => [c.id, c])), [data.clients]);

  const ok = results.filter((r) => r.ok);
  // 置いた人の地図（毎回作り直すと地図が寄せ直すので memo）
  const placedPoints = useMemo(
    () =>
      results.flatMap((r) => {
        const cl = r.ok ? clientById.get(r.clientId) : undefined;
        return cl && hasLocation(cl.place)
          ? [{ lat: cl.place.lat, lng: cl.place.lng, label: initialOf(cl.displayName), color: colorOf(cl.color) }]
          : [];
      }),
    [results, clientById],
  );
  const fails = results.filter((r): r is Extract<PlaceAllResult, { ok: false }> => !r.ok);
  if (targets.length === 0 && skipped.length === 0 && results.length === 0) return null;

  const why = running ? '置いています' : targets.length === 0 ? '住所か郵便番号のある、位置の無い人がいません' : null;
  const name = (id: string) => clientById.get(id)?.displayName ?? '（消えた人）';
  return (
    <div className="card stack place-all" data-testid="place-all" ref={ref} tabIndex={-1}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <strong>
          <WithIcon icon={MapPinned} size={16}>
            位置が未登録の{terms.client}：{targets.length + skipped.length}人
          </WithIcon>
        </strong>
        <span className="sub" data-testid="place-all-count">
          住所か郵便番号あり {targets.length}人{skipped.length > 0 ? `・どちらも無い ${skipped.length}人` : ''}
          （段階が「終了」の人は数えません）
        </span>
        <button
          type="button"
          className="btn btn-small"
          aria-disabled={why ? true : undefined}
          title={why ?? `住所（無ければ郵便番号）から1人ずつ位置を探して、地図に置きます`}
          onClick={() => void run()}
          data-testid="place-all-run"
        >
          <WithIcon icon={MapPinned} size={14}>
            まとめて地図に置く{targets.length > 0 ? `（${targets.length}人）` : ''}
          </WithIcon>
        </button>
        {running && (
          <button type="button" className="btn btn-small" onClick={stop} data-testid="place-all-stop">
            <WithIcon icon={CircleStop} size={14}>
              止める
            </WithIcon>
          </button>
        )}
      </div>
      <span className="sub place-notice">{PLACE_ALL_NOTICE}</span>
      {(running || results.length > 0) && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <progress className="place-all-progress" max={Math.max(total, 1)} value={results.length} aria-hidden="true" />
          <output data-testid="place-all-progress">
            {running
              ? `置いています… ${results.length}／${total}人`
              : `${stopped ? '止めました' : '終わりました'}：${results.length}／${total}人`}
            （置けた {ok.length}人・置けなかった {fails.length}人）
          </output>
        </div>
      )}
      {fails.length > 0 && (
        <div className="stack" style={{ gap: 4 }} data-testid="place-all-failed">
          <span className="sub">置けなかった{terms.client}（編集の欄で直すか、地図をクリックして置いてください）</span>
          {hasAddressNotFound(fails) && (
            <span className="sub" data-testid="place-all-city-hint">
              市区町村の名前が無い住所（「〇〇区〇〇」など）は見つからないことがあります。編集の欄で市区町村から書き足してください
            </span>
          )}
          <ul className="place-all-fails">
            {fails.map((f) => {
              const cl = clientById.get(f.clientId);
              return (
                <li key={f.clientId} data-testid="place-all-fail">
                  <strong>{name(f.clientId)}</strong>：
                  {f.foundAddress !== null && (
                    <span data-testid="place-all-address-only">住所だけ入れました（{f.foundAddress}）。位置は </span>
                  )}
                  {lookupMessage(f.reason, f.step)}{' '}
                  {cl && (
                    <button type="button" className="btn btn-small" onClick={() => onEdit(cl)}>
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
      )}
      {skipped.length > 0 && (
        <div className="stack" style={{ gap: 4 }} data-testid="place-all-skipped">
          <span className="sub">住所も郵便番号もない{terms.client}（編集の欄で入れてください）</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {skipped.map((c) => (
              <button key={c.id} type="button" className="btn btn-small" onClick={() => onEdit(c)}>
                <WithIcon icon={Pencil} size={13}>
                  {c.displayName}
                </WithIcon>
              </button>
            ))}
          </div>
        </div>
      )}
      {!running && placedPoints.length > 0 && (
        <div className="stack" style={{ gap: 4 }} data-testid="place-all-map">
          <span className="sub">
            置いた{terms.client}（ずれていれば、編集の欄で「位置を消す」→地図をクリックで直せます）
          </span>
          <RouteMap points={placedPoints} height={240} />
        </div>
      )}
    </div>
  );
}
