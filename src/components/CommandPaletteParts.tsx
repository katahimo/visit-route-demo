// CommandPalette の見た目の区画（入力欄の帯・候補の一覧・下の案内）。状態は持たず、CommandPalette から props で受ける
import { CornerDownLeft, Search, X } from 'lucide-react';
import type { RefObject } from 'react';
import type { Terms } from '../contracts/documents';
import { type PaletteItem, paletteKindLabel } from '../lib/commandPalette';
import { StaffMarkById } from './StaffMark';

/** 候補の要素の id（aria-activedescendant が指す） */
export const paletteOptionId = (listId: string, i: number) => `${listId}-o${i}`;

/** 入力欄の帯（combobox と閉じるボタン）。↑↓ は onMove、Enter は onEnter（変換中は何もしない） */
export function PaletteHead({
  terms,
  inputRef,
  listId,
  query,
  expanded,
  activeId,
  onType,
  onMove,
  onEnter,
  onClose,
}: {
  terms: Pick<Terms, 'client' | 'staff'>;
  inputRef: RefObject<HTMLInputElement | null>;
  listId: string;
  query: string;
  /** 候補があるか（aria-expanded） */
  expanded: boolean;
  /** 選んでいる候補の要素の id（aria-activedescendant） */
  activeId: string | undefined;
  onType: (v: string) => void;
  onMove: (step: 1 | -1) => void;
  onEnter: () => void;
  onClose: () => void;
}) {
  return (
    <div className="cmdk-head">
      <Search size={18} className="cmdk-head-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        className="cmdk-input"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-label={`画面・操作・${terms.client}・${terms.staff}の名前・訪問（名前と日付）で探す`}
        placeholder={`画面・操作・${terms.client}・${terms.staff}の名前`}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => onType(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            onMove(e.key === 'ArrowDown' ? 1 : -1);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
        }}
        data-testid="cmdk-input"
      />
      <button type="button" className="icon-btn cmdk-close" aria-label="閉じる" onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/** 候補の一覧の下：調べ中・見つからない・キーの案内・読み上げ用の件数 */
export function PaletteFoot({
  terms,
  carePending,
  empty,
  query,
  statusId,
  status,
}: {
  terms: Pick<Terms, 'client' | 'staff'>;
  carePending: boolean;
  /** 候補が0件 */
  empty: boolean;
  query: string;
  statusId: string;
  status: string;
}) {
  return (
    <>
      {carePending && (
        <p className="cmdk-empty" data-testid="cmdk-care-pending">
          要対応の訪問を調べています…（見つかった日から出します）
        </p>
      )}
      {empty && !carePending && (
        <p className="cmdk-empty" data-testid="cmdk-empty">
          見つかりません。画面の名前・操作・{terms.client}のよみ・{terms.staff}の名前・訪問（「名前
          10/28」「担当なし」「要対応」）で探せます
        </p>
      )}
      <p className="cmdk-foot" aria-hidden="true">
        <kbd>↑</kbd>
        <kbd>↓</kbd> で選ぶ・<kbd>Enter</kbd> で開く・<kbd>Esc</kbd> で閉じる
        {query === '' && (
          <span>
            ・名前を打つと{terms.client}・{terms.staff}も出ます
          </span>
        )}
      </p>
      <p id={statusId} className="sr-only" aria-live="polite" data-testid="cmdk-status">
        {status}
      </p>
    </>
  );
}

/** 候補の一覧（種類ごとのまとまり。選んでいる候補 at に印を付ける） */
export function PaletteGroups({
  groups,
  listId,
  terms,
  at,
  onHover,
  onPick,
}: {
  groups: { kind: PaletteItem['kind']; items: PaletteItem[]; rest: number }[];
  listId: string;
  terms: Pick<Terms, 'client' | 'staff'>;
  at: number;
  onHover: (i: number) => void;
  onPick: (it: PaletteItem) => void;
}) {
  let index = -1;
  return (
    <>
      {groups.map((g) => {
        const headId = `${listId}-g-${g.kind}`;
        return (
          // biome-ignore lint/a11y/useSemanticElements: listbox の中のまとまり（fieldset は listbox の子にできない）
          <div key={g.kind} role="group" aria-labelledby={headId} className="cmdk-group" data-kind={g.kind}>
            <div id={headId} role="presentation" className="cmdk-group-title">
              {paletteKindLabel(g.kind, terms)}
            </div>
            {g.items.map((it) => {
              index++;
              const i = index;
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードは入力欄の↑↓・Enter で選ぶ（combobox。フォーカスは入力欄のまま）
                <div
                  key={it.id}
                  id={paletteOptionId(listId, i)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === at}
                  className={i === at ? 'cmdk-option is-active' : 'cmdk-option'}
                  // 押してもフォーカスは入力欄のまま
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => {
                    if (i !== at) onHover(i);
                  }}
                  onClick={() => onPick(it)}
                  data-testid="cmdk-option"
                  data-kind={it.kind}
                  data-to={it.to}
                  data-visit={it.visitId}
                >
                  {/* 〈スタッフ〉は印を添える（PRD D298。飾りなので読み上げない） */}
                  {it.kind === 'staff' && <StaffMarkById id={it.id.slice('staff:'.length)} size="xs" />}
                  <span className="cmdk-option-label">{it.label}</span>
                  {it.hint && <span className="cmdk-option-hint">{it.hint}</span>}
                  {i === at && <CornerDownLeft size={14} className="cmdk-option-enter" aria-hidden="true" />}
                </div>
              );
            })}
            {g.rest > 0 && (
              // 読み上げは件数の知らせで足りるので、ここは目で見る補足だけ
              <div className="cmdk-rest" aria-hidden="true" data-testid="cmdk-rest">
                ほか {g.rest}人（続けて打つと絞り込めます）
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
