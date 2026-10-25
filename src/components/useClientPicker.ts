import { type FocusEvent, type KeyboardEvent, type RefObject, useId, useMemo, useRef, useState } from 'react';
import type { Client } from '../contracts/documents';
import {
  type PickerShortcut,
  pickerBase,
  pickerEmptyText,
  pickerKeyAction,
  pushRecent,
  searchClients,
} from '../lib/search';
import type { PickerBoxProps, PickerChipsProps, PickerShortcutsProps } from './ClientPickerParts';
import { runPickerKeyAction } from './clientPickerKeys';
import { type ClientPickerProps, PICKER_LIMIT, RECENT_LIMIT } from './clientPickerTypes';
import { usePickerEffects, usePickerLookups } from './usePickerLookups';

/**
 * ClientPicker の状態と処理（近道・候補・選ぶ・キー）。画面の区画ごとの props（チップ・近道・検索欄と候補）にして返す
 */
export function useClientPicker({
  clients,
  selected,
  onChange,
  multiple = false,
  max,
  maxMessage,
  label,
  placeholder = '名前・よみで探す',
  period,
  byStaff,
  tentativeShortcut = false,
  details = false,
  testId = 'client-picker',
}: ClientPickerProps): {
  rootRef: RefObject<HTMLDivElement | null>;
  inputId: string;
  message: string | null;
  /** 部品の外へフォーカスが出たら候補を閉じる */
  onBlur: (e: FocusEvent<HTMLDivElement>) => void;
  chips: PickerChipsProps | null;
  shortcuts: PickerShortcutsProps;
  box: PickerBoxProps;
} {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const optId = (id: string) => `${uid}-opt-${id}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [shortcut, setShortcut] = useState<PickerShortcut | null>(null);
  /** 近道で選んだ〈スタッフ〉（null＝まだ選んでいない。担当する人がいる最初の人を使う） */
  const [pickedStaff, setPickedStaff] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const { byId, chosen, tentativeCount, staffCount, staffId, staffSet, periodCount } = usePickerLookups({
    clients,
    selected,
    byStaff,
    period,
    pickedStaff,
  });
  const isSelected = (id: string) => selected.includes(id);

  /** 近道で絞った人（近道なしなら全員） */
  const base = useMemo(
    () => pickerBase(shortcut, clients, { period: period?.clientIds, staffSet, recent, byId }),
    [shortcut, clients, period, staffSet, recent, byId],
  );
  const found = useMemo(() => searchClients(base, query, PICKER_LIMIT), [base, query]);
  const options = found.list;

  usePickerEffects({ options, max, open, active, optId, setActive, setMessage });

  const remember = (id: string) => setRecent((r) => pushRecent(r, [id], RECENT_LIMIT));
  const overText = maxMessage ?? `${max}人まで選べます`;

  const choose = (c: Client) => {
    setMessage(null);
    if (!multiple) {
      onChange([c.id]);
      remember(c.id);
      setQuery('');
      setOpen(false);
      return;
    }
    if (isSelected(c.id)) {
      onChange(selected.filter((x) => x !== c.id));
      return;
    }
    if (max !== undefined && selected.length >= max) {
      setMessage(overText);
      return;
    }
    onChange([...selected, c.id]);
    remember(c.id);
  };
  const unselect = (id: string) => {
    setMessage(null);
    onChange(selected.filter((x) => x !== id));
  };
  /** まとめて選ぶと足される人（選んでいない人） */
  const toAdd = base.filter((c) => !isSelected(c.id)).length;
  /** まとめて選ぶと上限（max）を超えるか（超えるときはボタンを残したまま押せなくして理由を添える） */
  const overAll = max !== undefined && selected.length + toAdd > max;
  const chooseAllNoteId = `${uid}-choose-all-note`;
  /** 近道で絞った人をまとめて選ぶ（複数のとき。上限を超えるなら選ばない） */
  const chooseAll = () => {
    const add = base.map((c) => c.id).filter((id) => !isSelected(id));
    if (overAll) return;
    setMessage(null);
    onChange([...selected, ...add]);
    // まとめて選んだら候補の欄は閉じる（開いたままだと下の表・時間軸を隠す）
    setOpen(false);
    setRecent((r) => pushRecent(r, add, RECENT_LIMIT));
  };
  const toggleShortcut = (s: PickerShortcut) => {
    setShortcut((cur) => (cur === s ? null : s));
    setOpen(true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const act = pickerKeyAction(
      { key: e.key, composing: e.nativeEvent.isComposing || e.keyCode === 229 },
      {
        open,
        optionCount: options.length,
        hasActive: options[active] !== undefined,
        hasQuery: query !== '',
        multiple,
        hasSelected: selected.length > 0,
      },
    );
    if (act.type !== 'none' && act.prevent) e.preventDefault();
    runPickerKeyAction(act, {
      open: setOpen,
      move: (step) => setActive((i) => (i + step + options.length) % options.length),
      choose: () => choose(options[active]!),
      clearQuery: () => setQuery(''),
      unselectLast: () => unselect(selected[selected.length - 1]!),
    });
  };

  const activeOpt = open ? options[active] : undefined;
  const emptyText = pickerEmptyText(query, shortcut, {
    staffName: byStaff?.staff.find((s) => s.id === staffId)?.name ?? '',
    periodLabel: period?.label,
  });
  return {
    rootRef,
    inputId,
    message,
    onBlur: (e) => {
      if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
    },
    chips:
      chosen.length > 0
        ? {
            chosen,
            label,
            testId,
            details,
            multiple,
            onUnselect: unselect,
            onClear: () => {
              setMessage(null);
              onChange([]);
            },
          }
        : null,
    shortcuts: {
      testId,
      shortcut,
      onToggle: toggleShortcut,
      multiple,
      period,
      periodCount,
      byStaff,
      staffId,
      staffCount,
      onPickStaff: (id) => {
        setPickedStaff(id);
        setOpen(true);
      },
      recentCount: recent.length,
      tentativeCount: tentativeShortcut ? tentativeCount : 0,
      toAdd,
      overAll,
      showOverNote: max === undefined || selected.length <= max,
      overText,
      chooseAllNoteId,
      onChooseAll: chooseAll,
    },
    box: {
      input: {
        ref: inputRef,
        id: inputId,
        query,
        placeholder,
        activeId: activeOpt ? optId(activeOpt.id) : undefined,
        onQuery: (v) => {
          setQuery(v);
          setOpen(true);
        },
        onOpen: () => setOpen(true),
        onKeyDown,
      },
      pop: {
        testId,
        label,
        multiple,
        listId,
        open,
        options,
        active,
        rest: found.rest,
        emptyText,
        isSelected,
        optId,
        onHover: setActive,
        onChoose: choose,
      },
    },
  };
}
