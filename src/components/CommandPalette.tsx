import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Terms } from '../contracts/documents';
import { jstDate } from '../domain/time';
import {
  filterPalette,
  isMacPlatform,
  moveActive,
  paletteActions,
  palettePeople,
  paletteScreens,
  paletteVisitList,
  paletteVisits,
  visitIndex,
} from '../lib/commandPalette';
import type { MenuItem, NavSection } from '../lib/nav';
import { useDemoData } from '../store';
import { PaletteFoot, PaletteGroups, PaletteHead, paletteOptionId } from './CommandPaletteParts';
import { useBodyScrollLock } from './useBodyScrollLock';
import { useAttentionCare } from './usePaletteCare';
import { usePaletteModal, usePaletteScroll } from './usePaletteModal';
import { usePalettePick } from './usePalettePick';
import './commandPalette.css';

/** このブラウザが mac か（⌘K と Ctrl+K のどちらで開くか・キーの印） */
export const IS_MAC = typeof navigator !== 'undefined' && isMacPlatform(navigator.platform || navigator.userAgent);

/**
 * コマンドパレット（PRD D181〜D183。ADR-0027）：画面・操作・〈利用者さん〉・〈スタッフ〉の名前を打って絞り込み、選ぶとそこへ移る。
 * body の直下に出し、開いているあいだ body のほかの子を inert にして裏を巻かない（確認ダイアログと同じ。ADR-0026）。
 * 入力欄は combobox、候補は listbox（aria-activedescendant）。↑↓ で選び Enter で開く。Esc・背景・Ctrl+K（mac は ⌘K）で閉じ、
 * フォーカスは開く前の要素へ戻す（移った先で欄が開けばそちらが取る）。データは書き換えない
 */
export function CommandPalette({
  sections,
  terms,
  onClose,
}: {
  /** 画面の一覧（画面の候補。lib/nav の screenSections。メニューから外した画面も1つずつ。PRD D273・D275） */
  sections: readonly NavSection<MenuItem>[];
  terms: Pick<Terms, 'client' | 'staff'>;
  onClose: () => void;
}) {
  const { data } = useDemoData();
  const today = jstDate(Date.now());
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const listId = useId();
  const statusId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  /** 打ったか（件数は打ってから読み上げる。開いたときには読まない） */
  const [typed, setTyped] = useState(false);

  // 候補（人の名前は比べる形にそろえておき、打つたびにそろえ直さない。300人×60人でも打つたびは絞り込むだけ）
  // 切った機能の操作は出さない（PRD D213。画面は screenSections から引くので、切った画面はもう無い）
  const features = data.org.features;
  const actions = useMemo(() => paletteActions(today, { features }), [today, features]);
  const screens = useMemo(() => paletteScreens(sections, terms), [sections, terms]);
  const people = useMemo(() => palettePeople(data.clients, data.staff, terms), [data.clients, data.staff, terms]);
  const items = useMemo(() => [...actions, ...screens, ...people], [actions, screens, people]);
  const base = useMemo(() => filterPalette(items, query), [items, query]);
  // 訪問の候補（PRD D304）：〈利用者さん〉の名前・よみ＋日付。索引は打ってから作り（開いただけでは作らない）、開いている間は使い回す
  const typedAny = query.trim() !== '';
  const vIndex = useMemo(
    () =>
      typedAny
        ? visitIndex(paletteVisitList({ visits: data.visits, patterns: data.patterns, clients: data.clients }, today))
        : null,
    [typedAny, data.visits, data.patterns, data.clients, today],
  );
  const { careOf, carePending } = useAttentionCare(data, query, today);
  const result = useMemo(() => {
    if (!vIndex) return base;
    const staffName = new Map(data.staff.map((s) => [s.id, s.name]));
    const visits = paletteVisits(
      query,
      people,
      vIndex,
      today,
      (v) => {
        if (v.cancelled) return v.cancelKind === 'sameDay' ? '当日キャンセル' : '取り消し';
        const sid = v.staffId;
        return sid ? (staffName.get(sid) ?? '') : '担当なし';
      },
      undefined,
      careOf,
    );
    if (visits.length === 0) return base;
    const groups = [...base.groups, { kind: 'visit' as const, items: visits, rest: 0 }];
    return { groups, flat: groups.flatMap((g) => g.items) };
  }, [base, vIndex, query, people, today, data, careOf]);
  const flat = result.flat;
  const at = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  const optionId = (i: number) => paletteOptionId(listId, i);

  useBodyScrollLock();
  usePaletteModal({ wrapRef, boxRef, inputRef, closeRef, isMac: IS_MAC });

  usePaletteScroll(listRef, at, optionId);

  const pick = usePalettePick(onClose, today);

  const onType = (v: string) => {
    setQuery(v);
    setActive(0);
    setTyped(true);
  };
  const status = !typed
    ? ''
    : carePending
      ? `要対応の訪問を調べています（${flat.length}件）`
      : flat.length === 0
        ? '見つかりません'
        : `${flat.length}件`;

  return createPortal(
    <div ref={wrapRef} className="cmdk-wrap" data-testid="cmdk-wrap">
      {/* 背景を押すと閉じる（キーボードは Esc） */}
      <div className="cmdk-backdrop" aria-hidden="true" onClick={onClose} data-testid="cmdk-backdrop" />
      <div ref={boxRef} className="cmdk" role="dialog" aria-modal="true" aria-label="探す・移動" data-testid="cmdk">
        <PaletteHead
          terms={terms}
          inputRef={inputRef}
          listId={listId}
          query={query}
          expanded={flat.length > 0}
          activeId={at >= 0 ? optionId(at) : undefined}
          onType={onType}
          onMove={(step) => setActive(moveActive(at, flat.length, step))}
          onEnter={() => void pick(flat[at])}
          onClose={onClose}
        />
        <div ref={listRef} id={listId} className="cmdk-list" role="listbox" aria-label="候補" data-testid="cmdk-list">
          <PaletteGroups
            groups={result.groups}
            listId={listId}
            terms={terms}
            at={at}
            onHover={setActive}
            onPick={(it) => void pick(it)}
          />
        </div>
        <PaletteFoot
          terms={terms}
          carePending={carePending}
          empty={flat.length === 0}
          query={query}
          statusId={statusId}
          status={status}
        />
      </div>
    </div>,
    document.body,
  );
}
