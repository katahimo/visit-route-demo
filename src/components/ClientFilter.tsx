// 〈利用者さん〉の絞り込みの欄（PRD D108〜D112。ADR-0021）。週間の〈利用者さん〉×曜日の表と〈利用者さん〉の画面の一覧で使う。
// 名前・よみの検索、地区（1段目＝市区、選んだ市区の2段目＝町名。どちらも複数・人数つき）、絞り込みのチップ（AND）、
// 「終了の人も出す」。相性の画面では、画面ごとのチップ（extraChips）を足し、「終了の人も出す」を出さない（PRD D116）。中身の判定は lib/clientFilter の純粋関数。状態は呼ぶ側が持つ（週間は URL の ?cf=）。
// 検索の文字だけはこの部品の中にも持つ（日本語の変換を壊さないため。変換中は呼ぶ側へ渡さず、確定後に、
// ふつうの入力は少し遅らせて渡す。呼ぶ側の値が外から変わったら（戻るボタンなど）入力欄を合わせる）
import { Search } from 'lucide-react';
import { useId } from 'react';
import type { Client } from '../contracts/documents';
import {
  type AreaChip,
  type ClientFilterState,
  chipHelp,
  chipLabel,
  FILTER_CHIPS,
  type FilterChip,
  type FilterFacts,
  sameFilter,
  toggleChip,
  toggleCity,
  toggleExtra,
  toggleTown,
  toggleType,
} from '../lib/clientFilter';
import { useClientFilterModel } from './useClientFilterModel';
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
  // ---- 検索の文字（変換中は呼ぶ側へ渡さない）----
  const { text, setLocalText, send, change, inputProps } = useImeQuery(state, onChange);

  const { staffId, shown, total, counts, cities, towns, staffCount, types, extraCount, hiddenChip } =
    useClientFilterModel({
      clients,
      state,
      facts,
      staff,
      visitTypes,
      extraChips,
    });
  const t = { periodLabel, staffTerm: terms.staff };

  const areaChip = (a: AreaChip, on: boolean, toggle: () => void, kind: 'city' | 'town') => {
    const empty = !on && a.count === 0;
    return (
      <ChipButton
        key={a.key}
        on={on}
        empty={empty}
        blocked={empty}
        title={empty ? `${a.label}：当てはまる人はいません（0人）` : undefined}
        onClick={toggle}
        testId={`${testId}-${kind}`}
        data={{ 'data-key': a.key }}
        label={a.label}
        count={a.count}
      />
    );
  };

  const filterChip = (chip: FilterChip) => {
    const on = state.chips.includes(chip);
    const n = counts[chip];
    const empty = !on && n === 0;
    return (
      <ChipButton
        key={chip}
        on={on}
        empty={empty}
        // 「〈スタッフ〉が担当する人」は0人でも押せる（押すと select で〈スタッフ〉を選び直せる）
        blocked={empty && chip !== 'staff'}
        title={`${chipHelp(chip, t)}${empty ? '（当てはまる人はいません。0人）' : ''}`}
        onClick={() => change(toggleChip(state, chip))}
        testId={`${testId}-chip`}
        data={{ 'data-chip': chip }}
        label={chipLabel(chip, t)}
        count={n}
      />
    );
  };

  const extraChip = (x: { key: string; label: string; help: string }) => {
    const on = (state.extra ?? []).includes(x.key);
    const n = extraCount.get(x.key) ?? 0;
    const empty = !on && n === 0;
    return (
      <ChipButton
        key={x.key}
        on={on}
        empty={empty}
        blocked={empty}
        title={`${x.help}${empty ? '（当てはまる人はいません。0人）' : ''}`}
        onClick={() => change(toggleExtra(state, x.key))}
        testId={`${testId}-chip`}
        data={{ 'data-chip': x.key }}
        label={x.label}
        count={n}
      />
    );
  };

  return (
    <div className="client-filter stack" data-testid={testId}>
      <FilterTop
        uid={uid}
        testId={testId}
        clientTerm={terms.client}
        inputProps={inputProps}
        showEnded={state.showEnded}
        hideEnded={hideEnded}
        onShowEnded={(v) => change({ ...state, showEnded: v })}
        countText={shown.length === total ? `${total}人` : `${shown.length}人／${total}人`}
        modified={!sameFilter({ ...state, query: text }, defaults)}
        onReset={() => {
          setLocalText(defaults.query);
          send(defaults);
        }}
      />
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
        <TypeRow
          types={types}
          selected={state.types ?? []}
          periodLabel={periodLabel}
          onToggle={(id) => change(toggleType(state, id, visitTypes))}
          testId={testId}
        />
      )}
      <fieldset className="pick-chips client-filter-row" data-testid={`${testId}-chips`}>
        <legend className="pick-chips-legend">絞り込み（すべてに当てはまる人）</legend>
        {FILTER_CHIPS.filter((chip) => !hiddenChip(chip) || state.chips.includes(chip)).map((chip) =>
          chip === 'staff'
            ? staff.length > 0 && (
                <span key={chip} className="row client-filter-staff">
                  {filterChip(chip)}
                  {state.chips.includes('staff') && (
                    <StaffSelect
                      label={`担当する${terms.staff}`}
                      value={staffId}
                      staff={staff}
                      counts={staffCount}
                      onChange={(id) => change({ ...state, staffId: id })}
                      testId={`${testId}-staff`}
                    />
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

/** 絞り込みのチップ1つ（押すと付け外し。0人なら薄くして押せなくする＝blocked） */
function ChipButton({
  on,
  empty,
  blocked,
  title,
  onClick,
  testId,
  data,
  label,
  count,
}: {
  on: boolean;
  empty: boolean;
  blocked: boolean;
  title?: string;
  onClick: () => void;
  testId: string;
  /** チップを見分ける data 属性（data-key・data-chip） */
  data: Record<string, string>;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      className={`pick-chip client-filter-chip${on ? ' is-on' : ''}${empty ? ' is-empty' : ''}`}
      aria-pressed={on}
      aria-disabled={blocked || undefined}
      title={title}
      onClick={() => !blocked && onClick()}
      data-testid={testId}
      {...data}
    >
      <span className="pick-chip-check" aria-hidden="true">
        {on ? '✓' : ''}
      </span>
      {label}
      <span className="client-filter-count">
        {count}
        <span className="sr-only">人</span>
      </span>
    </button>
  );
}

/** 欄の上の行：名前・よみの検索・「終了の人も出す」・人数・「絞り込みを戻す」 */
function FilterTop({
  uid,
  testId,
  clientTerm,
  inputProps,
  showEnded,
  hideEnded,
  onShowEnded,
  countText,
  modified,
  onReset,
}: {
  uid: string;
  testId: string;
  clientTerm: string;
  inputProps: ReturnType<typeof useImeQuery>['inputProps'];
  showEnded: boolean;
  hideEnded: boolean;
  onShowEnded: (v: boolean) => void;
  countText: string;
  /** 既定から変わっている（「絞り込みを戻す」を出す） */
  modified: boolean;
  onReset: () => void;
}) {
  return (
    <div className="row client-filter-top">
      <label className="client-filter-search" htmlFor={`${uid}-q`}>
        <span className="client-filter-label">{clientTerm}を名前・よみで探す</span>
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
            checked={showEnded}
            onChange={(e) => onShowEnded(e.target.checked)}
            data-testid={`${testId}-ended`}
          />
          終了の人も出す
        </label>
      )}
      <output className="sub client-filter-total" data-testid={`${testId}-count`} aria-live="polite">
        {countText}
      </output>
      {modified && (
        <button type="button" className="btn btn-small" onClick={onReset} data-testid={`${testId}-reset`}>
          絞り込みを戻す
        </button>
      )}
    </div>
  );
}

/** 「〈スタッフ〉が担当する人」を押したときに出る〈スタッフ〉の選択（（N人）は選んだら何人になるか） */
function StaffSelect({
  label,
  value,
  staff,
  counts,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  staff: readonly { id: string; name: string }[];
  counts: ReadonlyMap<string, number>;
  onChange: (id: string) => void;
  testId: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}（{counts.get(s.id) ?? 0}人）
        </option>
      ))}
    </select>
  );
}

/** 「訪問の種類（どれか）」のチップの行 */
function TypeRow({
  types,
  selected,
  periodLabel,
  onToggle,
  testId,
}: {
  types: readonly { id: string; name: string; count: number }[];
  selected: readonly string[];
  periodLabel: string;
  onToggle: (id: string) => void;
  testId: string;
}) {
  return (
    <fieldset className="pick-chips client-filter-row" data-testid={`${testId}-types`}>
      <legend className="pick-chips-legend">訪問の種類（どれか）</legend>
      {types.map((x) => {
        const on = selected.includes(x.id);
        const empty = !on && x.count === 0;
        return (
          <ChipButton
            key={x.id}
            on={on}
            empty={empty}
            blocked={empty}
            title={
              empty
                ? `${x.name}：${periodLabel}にその訪問がある人はいません（0人）`
                : `${periodLabel}に「${x.name}」の訪問がある人`
            }
            onClick={() => onToggle(x.id)}
            testId={`${testId}-type`}
            data={{ 'data-key': x.id }}
            label={x.name}
            count={x.count}
          />
        );
      })}
    </fieldset>
  );
}
