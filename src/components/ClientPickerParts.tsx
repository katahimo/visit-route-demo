// ClientPicker の見た目の区画（選んだ人のチップ・近道の行・候補の一覧）。状態は持たず、ClientPicker から props で受ける
import { Search, X } from 'lucide-react';
import type { KeyboardEvent, RefObject } from 'react';
import type { Client } from '../contracts/documents';
import { colorOf, initialOf } from '../lib/colors';
import { chooseAllLabel, type PickerShortcut } from '../lib/search';
import { PersonButton } from './PersonPopover';
import { TentativeMark } from './parts';

/** 選んだ人のチップの列（複数で2人以上なら「全部外す」も） */
export type PickerChipsProps = {
  chosen: readonly Client[];
  label: string;
  testId: string;
  details: boolean;
  multiple: boolean;
  onUnselect: (id: string) => void;
  onClear: () => void;
};

export function PickerChips({ chosen, label, testId, details, multiple, onUnselect, onClear }: PickerChipsProps) {
  return (
    <ul className="client-picker-chips" aria-label={`選んでいる${label}`}>
      {chosen.map((c) => (
        <li key={c.id} className="client-picker-chip" data-testid={`${testId}-chip`} data-id={c.id}>
          <span className="dot dot-xs" style={{ background: colorOf(c.color) }} aria-hidden="true">
            {initialOf(c.displayName)}
          </span>
          {details ? <PersonButton kind="client" id={c.id} name={c.displayName} /> : <span>{c.displayName}</span>}
          {c.tentative && <TentativeMark />}
          <button
            type="button"
            className="client-picker-remove"
            aria-label={`${c.displayName}を外す`}
            onClick={() => onUnselect(c.id)}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </li>
      ))}
      {multiple && chosen.length >= 2 && (
        <li>
          <button type="button" className="btn btn-small" onClick={onClear} data-testid={`${testId}-clear`}>
            全部外す
          </button>
        </li>
      )}
    </ul>
  );
}

/** 近道の1つのボタン（押すと絞る。もう一度押すと外れる） */
function ShortcutButton({
  id,
  text,
  count,
  current,
  testId,
  onToggle,
}: {
  id: PickerShortcut;
  text: string;
  count: number | null;
  current: PickerShortcut | null;
  testId: string;
  onToggle: (s: PickerShortcut) => void;
}) {
  return (
    <button
      type="button"
      className={`client-picker-shortcut${current === id ? ' is-on' : ''}`}
      aria-pressed={current === id}
      onClick={() => onToggle(id)}
      data-testid={`${testId}-shortcut-${id}`}
    >
      {text}
      {count !== null && <span className="client-picker-count">{count}</span>}
    </button>
  );
}

export type PickerShortcutsProps = {
  testId: string;
  shortcut: PickerShortcut | null;
  onToggle: (s: PickerShortcut) => void;
  multiple: boolean;
  period?: { label: string; clientIds: ReadonlySet<string> };
  periodCount: number;
  byStaff?: { staffLabel: string; staff: readonly { id: string; name: string }[] };
  staffId: string;
  staffCount: ReadonlyMap<string, number>;
  onPickStaff: (id: string) => void;
  recentCount: number;
  /** 「仮押さえの人」を出すときの人数（出さないなら 0） */
  tentativeCount: number;
  /** まとめて選ぶと足される人 */
  toAdd: number;
  /** まとめて選ぶと上限を超える */
  overAll: boolean;
  /** 上限の文を添える（超え方が選択済みだけの分でないとき） */
  showOverNote: boolean;
  overText: string;
  chooseAllNoteId: string;
  onChooseAll: () => void;
};

/** 近道の行（検索欄の上） */
export function PickerShortcuts(p: PickerShortcutsProps) {
  const btn = (id: PickerShortcut, text: string, count: number | null) => (
    <ShortcutButton id={id} text={text} count={count} current={p.shortcut} testId={p.testId} onToggle={p.onToggle} />
  );
  const { byStaff } = p;
  return (
    <fieldset className="client-picker-shortcuts">
      <legend className="sr-only">近道</legend>
      {p.period && btn('period', `${p.period.label}に訪問がある人`, p.periodCount)}
      {byStaff && byStaff.staff.length > 0 && (
        <span className="client-picker-staff">
          {btn('staff', `${byStaff.staffLabel}が担当する人`, null)}
          {p.shortcut === 'staff' && (
            <select
              aria-label={`担当する${byStaff.staffLabel}`}
              value={p.staffId}
              onChange={(e) => p.onPickStaff(e.target.value)}
              data-testid={`${p.testId}-staff`}
            >
              {byStaff.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{p.staffCount.get(s.id) ?? 0}人）
                </option>
              ))}
            </select>
          )}
        </span>
      )}
      {btn('recent', '最近選んだ人', p.recentCount)}
      {p.tentativeCount > 0 && btn('tentative', '仮押さえの人', p.tentativeCount)}
      {p.multiple && p.shortcut !== null && p.toAdd > 0 && (
        <button
          type="button"
          className="btn btn-small"
          aria-disabled={p.overAll || undefined}
          aria-describedby={p.overAll ? p.chooseAllNoteId : undefined}
          onClick={p.onChooseAll}
          data-testid={`${p.testId}-choose-all`}
        >
          {chooseAllLabel(p.toAdd)}
        </button>
      )}
      {p.multiple && p.shortcut !== null && p.toAdd > 0 && p.overAll && p.showOverNote && (
        <small id={p.chooseAllNoteId} className="client-picker-over" data-testid={`${p.testId}-choose-all-note`}>
          {p.overText}
        </small>
      )}
    </fieldset>
  );
}

/** 検索欄と候補の一覧（候補は閉じていても hidden で残す） */
export type PickerBoxProps = {
  input: {
    ref: RefObject<HTMLInputElement | null>;
    id: string;
    query: string;
    placeholder: string;
    /** 指している候補の要素の id（aria-activedescendant） */
    activeId: string | undefined;
    onQuery: (v: string) => void;
    onOpen: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  };
  pop: {
    testId: string;
    label: string;
    multiple: boolean;
    listId: string;
    open: boolean;
    options: readonly Client[];
    active: number;
    rest: number;
    emptyText: string;
    isSelected: (id: string) => boolean;
    optId: (id: string) => string;
    onHover: (i: number) => void;
    onChoose: (c: Client) => void;
  };
};

export function PickerBox({ input, pop: p }: PickerBoxProps) {
  return (
    <div className="client-picker-box">
      <Search size={14} className="client-picker-icon" aria-hidden="true" />
      <input
        ref={input.ref}
        id={input.id}
        type="text"
        role="combobox"
        aria-expanded={p.open}
        aria-controls={p.listId}
        aria-autocomplete="list"
        aria-activedescendant={input.activeId}
        autoComplete="off"
        value={input.query}
        placeholder={input.placeholder}
        maxLength={50}
        onChange={(e) => input.onQuery(e.target.value)}
        onFocus={input.onOpen}
        onClick={input.onOpen}
        onKeyDown={input.onKeyDown}
        data-testid={`${p.testId}-input`}
      />
      <div className="client-picker-pop" hidden={!p.open}>
        <div
          id={p.listId}
          role="listbox"
          aria-label={`${p.label}の候補`}
          aria-multiselectable={p.multiple || undefined}
          className="client-picker-list"
        >
          {p.options.map((c, i) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードは検索欄の↑↓・Enter で選ぶ（combobox。フォーカスは検索欄のまま）
            <div
              key={c.id}
              id={p.optId(c.id)}
              role="option"
              tabIndex={-1}
              aria-selected={p.isSelected(c.id)}
              className={`client-picker-option${i === p.active ? ' is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => p.onHover(i)}
              onClick={() => p.onChoose(c)}
              data-testid={`${p.testId}-option`}
              data-id={c.id}
            >
              <span className="client-picker-check" aria-hidden="true">
                {p.isSelected(c.id) ? '✓' : ''}
              </span>
              <span className="dot dot-xs" style={{ background: colorOf(c.color) }} aria-hidden="true">
                {initialOf(c.displayName)}
              </span>
              <span className="client-picker-name">{c.displayName}</span>
              {c.kana && <small className="client-picker-kana">{c.kana}</small>}
              {c.tentative && <TentativeMark />}
            </div>
          ))}
        </div>
        {p.options.length === 0 && (
          <p className="client-picker-note" data-testid={`${p.testId}-empty`}>
            {p.emptyText}
          </p>
        )}
        {p.rest > 0 && <p className="client-picker-note">ほか {p.rest}人。名前・よみを入れて絞り込んでください</p>}
      </div>
    </div>
  );
}
