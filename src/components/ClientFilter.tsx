// 〈利用者さん〉の絞り込みの欄（PRD D108〜D112。ADR-0021）。週間の〈利用者さん〉×曜日の表と〈利用者さん〉の画面の一覧で使う。
// 名前・よみの検索、地区（1段目＝市区、選んだ市区の2段目＝町名。どちらも複数・人数つき）、絞り込みのチップ（AND）、
// 「終了の人も出す」。相性の画面では、画面ごとのチップ（extraChips）を足し、「終了の人も出す」を出さない（PRD D116）。中身の判定は lib/clientFilter の純粋関数。状態は呼ぶ側が持つ（週間は URL の ?cf=）。
// 検索の文字だけはこの部品の中にも持つ（日本語の変換を壊さないため。変換中は呼ぶ側へ渡さず、確定後に、
// ふつうの入力は少し遅らせて渡す。呼ぶ側の値が外から変わったら（戻るボタンなど）入力欄を合わせる）
import { Search } from 'lucide-react';
import { useId, useMemo } from 'react';
import type { Client } from '../contracts/documents';
import {
  type AreaChip,
  type ClientFilterState,
  chipCounts,
  chipHelp,
  chipLabel,
  cityChips,
  endedVisible,
  extraCounts,
  FILTER_CHIPS,
  type FilterChip,
  type FilterFacts,
  filterClients,
  NO_AREA,
  resolveStaffId,
  sameFilter,
  staffCounts,
  toggleChip,
  toggleCity,
  toggleExtra,
  toggleTown,
  toggleType,
  townChips,
  typeChips,
} from '../lib/clientFilter';
import { useFeature } from '../lib/useFeature';
import './clientFilter.css';
import { useImeQuery } from './useImeQuery';

export type ClientFilterProps = {
  /** 候補の〈利用者さん〉（終了の人も含めて渡す。「終了の人も出す」で出し分ける） */
  clients: readonly Client[];
  state: ClientFilterState;
  onChange: (next: ClientFilterState) => void;
  /** チップの判定に使う集まり（lib/clientFilter の filterFacts） */
  facts: FilterFacts;
  /** チップ「〈スタッフ〉が担当する人」で選べる〈スタッフ〉 */
  staff: readonly { id: string; name: string }[];
  /** 呼び方（org.terms） */
  terms: { client: string; staff: string };
  /** 期間の呼び方（例「この週」） */
  periodLabel: string;
  /**
   * 訪問の種類（data.visitTypes。PRD D285）。渡して1件以上あれば、絞り込みの上に「訪問の種類」のチップ（どれか）を出す。
   * 判定は facts.typeClientIds（filterFacts に visitTypes を渡す）
   */
  visitTypes?: readonly { id: string; name: string }[];
  /** 「絞り込みを戻す」で戻す状態（この画面の既定） */
  defaults: ClientFilterState;
  /**
   * 画面ごとに足すチップ（PRD D116。相性の画面だけ）。判定は facts.extraTests、押している状態は state.extra。
   * 絞り込みのチップの後ろに並べる
   */
  extraChips?: readonly { key: string; label: string; help: string }[];
  /** 「終了の人も出す」を出さない（終了の人を候補に入れない画面。相性の画面） */
  hideEnded?: boolean;
  /** 外枠の data-testid（チップは `${testId}-chip`、地区は `${testId}-city`・`${testId}-town`） */
  testId?: string;
};

/**
 * 絞り込みの欄。チップ・地区は押すと付け外し（aria-pressed）。押しても0人になるものは薄くして押せなくする
 * （aria-disabled。押しているものはいつでも外せる。「〈スタッフ〉が担当する人」は0人でも押せ、select で選び直せる）。
 * 人数は「押したら何人になるか」
 */
export function ClientFilter({
  clients,
  state,
  onChange,
  facts,
  staff,
  terms,
  periodLabel,
  defaults,
  visitTypes = [],
  extraChips = [],
  hideEnded = false,
  testId = 'client-filter',
}: ClientFilterProps) {
  const uid = useId();
  // 機能の入り切り（ADR-0028）：〈利用者さん〉の休みを切れば「休み」、担当を限るを切れば「担当を限る」のチップを出さない
  // （URL などで押したまま来たときは外せるように出す）
  const leaveOn = useFeature('clientLeave');
  const limitOn = useFeature('allowedStaff');
  const hiddenChip = (chip: FilterChip) => (chip === 'leave' && !leaveOn) || (chip === 'limited' && !limitOn);
  // ---- 検索の文字（変換中は呼ぶ側へ渡さない）----
  const { text, setLocalText, send, change, inputProps } = useImeQuery(state, onChange);

  const staffId = useMemo(() => resolveStaffId(state, staff, facts, clients), [state, staff, facts, clients]);
  const shown = useMemo(() => filterClients(clients, state, facts, staffId), [clients, state, facts, staffId]);
  const total = useMemo(() => clients.filter((c) => endedVisible(c, state, facts)).length, [clients, state, facts]);
  const counts = useMemo(() => chipCounts(clients, state, facts, staffId), [clients, state, facts, staffId]);
  const cities = useMemo(() => cityChips(clients, state, facts, staffId), [clients, state, facts, staffId]);
  const towns = useMemo(
    () =>
      state.cities
        .filter((c) => c !== NO_AREA)
        .map((city) => ({ city, chips: townChips(clients, state, facts, staffId, city) }))
        .filter((x) => x.chips.length > 0),
    [clients, state, facts, staffId],
  );
  /** select の「（N人）」：その〈スタッフ〉で押したら何人になるか（チップの人数と同じ数え方） */
  const staffCount = useMemo(() => staffCounts(clients, state, facts, staff), [clients, state, facts, staff]);
  const types = useMemo(
    () => typeChips(clients, state, facts, staffId, visitTypes),
    [clients, state, facts, staffId, visitTypes],
  );
  const extraKeys = useMemo(() => extraChips.map((x) => x.key), [extraChips]);
  const extraCount = useMemo(
    () => extraCounts(clients, state, facts, staffId, extraKeys),
    [clients, state, facts, staffId, extraKeys],
  );
  const t = { periodLabel, staffTerm: terms.staff };

  const areaChip = (a: AreaChip, on: boolean, toggle: () => void, kind: 'city' | 'town') => {
    const empty = !on && a.count === 0;
    return (
      <button
        key={a.key}
        type="button"
        className={`pick-chip client-filter-chip${on ? ' is-on' : ''}${empty ? ' is-empty' : ''}`}
        aria-pressed={on}
        aria-disabled={empty || undefined}
        title={empty ? `${a.label}：当てはまる人はいません（0人）` : undefined}
        onClick={() => !empty && toggle()}
        data-testid={`${testId}-${kind}`}
        data-key={a.key}
      >
        <span className="pick-chip-check" aria-hidden="true">
          {on ? '✓' : ''}
        </span>
        {a.label}
        <span className="client-filter-count">
          {a.count}
          <span className="sr-only">人</span>
        </span>
      </button>
    );
  };

  const filterChip = (chip: FilterChip) => {
    const on = state.chips.includes(chip);
    const n = counts[chip];
    const empty = !on && n === 0;
    // 「〈スタッフ〉が担当する人」は0人でも押せる（押すと select で〈スタッフ〉を選び直せる）
    const blocked = empty && chip !== 'staff';
    return (
      <button
        key={chip}
        type="button"
        className={`pick-chip client-filter-chip${on ? ' is-on' : ''}${empty ? ' is-empty' : ''}`}
        aria-pressed={on}
        aria-disabled={blocked || undefined}
        title={`${chipHelp(chip, t)}${empty ? '（当てはまる人はいません。0人）' : ''}`}
        onClick={() => !blocked && change(toggleChip(state, chip))}
        data-testid={`${testId}-chip`}
        data-chip={chip}
      >
        <span className="pick-chip-check" aria-hidden="true">
          {on ? '✓' : ''}
        </span>
        {chipLabel(chip, t)}
        <span className="client-filter-count">
          {n}
          <span className="sr-only">人</span>
        </span>
      </button>
    );
  };

  const extraChip = (x: { key: string; label: string; help: string }) => {
    const on = (state.extra ?? []).includes(x.key);
    const n = extraCount.get(x.key) ?? 0;
    const empty = !on && n === 0;
    return (
      <button
        key={x.key}
        type="button"
        className={`pick-chip client-filter-chip${on ? ' is-on' : ''}${empty ? ' is-empty' : ''}`}
        aria-pressed={on}
        aria-disabled={empty || undefined}
        title={`${x.help}${empty ? '（当てはまる人はいません。0人）' : ''}`}
        onClick={() => !empty && change(toggleExtra(state, x.key))}
        data-testid={`${testId}-chip`}
        data-chip={x.key}
      >
        <span className="pick-chip-check" aria-hidden="true">
          {on ? '✓' : ''}
        </span>
        {x.label}
        <span className="client-filter-count">
          {n}
          <span className="sr-only">人</span>
        </span>
      </button>
    );
  };

  return (
    <div className="client-filter stack" data-testid={testId}>
      <div className="row client-filter-top">
        <label className="client-filter-search" htmlFor={`${uid}-q`}>
          <span className="client-filter-label">{terms.client}を名前・よみで探す</span>
          <span className="client-filter-box">
            <Search size={14} className="client-filter-icon" aria-hidden="true" />
            <input
              id={`${uid}-q`}
              type="search"
              placeholder="名前・よみで探す"
              maxLength={50}
              autoComplete="off"
              {...inputProps}
              data-testid={`${testId}-input`}
            />
          </span>
        </label>
        {!hideEnded && (
          <label className="check client-filter-ended">
            <input
              type="checkbox"
              checked={state.showEnded}
              onChange={(e) => change({ ...state, showEnded: e.target.checked })}
              data-testid={`${testId}-ended`}
            />
            終了の人も出す
          </label>
        )}
        <output className="sub client-filter-total" data-testid={`${testId}-count`} aria-live="polite">
          {shown.length === total ? `${total}人` : `${shown.length}人／${total}人`}
        </output>
        {!sameFilter({ ...state, query: text }, defaults) && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setLocalText(defaults.query);
              send(defaults);
            }}
            data-testid={`${testId}-reset`}
          >
            絞り込みを戻す
          </button>
        )}
      </div>
      <fieldset className="pick-chips client-filter-row" data-testid={`${testId}-cities`}>
        <legend className="pick-chips-legend">地区</legend>
        {cities.map((a) => areaChip(a, state.cities.includes(a.key), () => change(toggleCity(state, a.key)), 'city'))}
      </fieldset>
      {towns.map(({ city, chips }) => (
        <fieldset key={city} className="pick-chips client-filter-row client-filter-towns" data-city={city}>
          <legend className="pick-chips-legend">{city}の町名</legend>
          {chips.map((a) => areaChip(a, state.towns.includes(a.key), () => change(toggleTown(state, a.key)), 'town'))}
        </fieldset>
      ))}
      {visitTypes.length > 0 && (
        <fieldset className="pick-chips client-filter-row" data-testid={`${testId}-types`}>
          <legend className="pick-chips-legend">訪問の種類（どれか）</legend>
          {types.map((x) => {
            const on = (state.types ?? []).includes(x.id);
            const empty = !on && x.count === 0;
            return (
              <button
                key={x.id}
                type="button"
                className={`pick-chip client-filter-chip${on ? ' is-on' : ''}${empty ? ' is-empty' : ''}`}
                aria-pressed={on}
                aria-disabled={empty || undefined}
                title={
                  empty
                    ? `${x.name}：${periodLabel}にその訪問がある人はいません（0人）`
                    : `${periodLabel}に「${x.name}」の訪問がある人`
                }
                onClick={() => !empty && change(toggleType(state, x.id, visitTypes))}
                data-testid={`${testId}-type`}
                data-key={x.id}
              >
                <span className="pick-chip-check" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                {x.name}
                <span className="client-filter-count">
                  {x.count}
                  <span className="sr-only">人</span>
                </span>
              </button>
            );
          })}
        </fieldset>
      )}
      <fieldset className="pick-chips client-filter-row" data-testid={`${testId}-chips`}>
        <legend className="pick-chips-legend">絞り込み（すべてに当てはまる人）</legend>
        {FILTER_CHIPS.filter((chip) => !hiddenChip(chip) || state.chips.includes(chip)).map((chip) =>
          chip === 'staff'
            ? staff.length > 0 && (
                <span key={chip} className="row client-filter-staff">
                  {filterChip(chip)}
                  {state.chips.includes('staff') && (
                    <select
                      aria-label={`担当する${terms.staff}`}
                      value={staffId}
                      onChange={(e) => change({ ...state, staffId: e.target.value })}
                      data-testid={`${testId}-staff`}
                    >
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}（{staffCount.get(s.id) ?? 0}人）
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              )
            : filterChip(chip),
        )}
        {extraChips.map(extraChip)}
      </fieldset>
    </div>
  );
}
