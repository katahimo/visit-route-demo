// 相性の表（PRD D113〜D115・D177・D420）：凡例の1行・訪問先×スタッフの表・絞り込みで誰もいないときの欄。
// 表は1つの Tab の止まり所で矢印で動く grid（マスも見出しもボタンにしない）。見出し・名前を押すと詳細の吹き出し、
// マスを押すと相性を選ぶ欄（どちらも開くのは CompatPage）
import { RefreshCw, SearchX } from 'lucide-react';
import { type KeyboardEvent, type MouseEvent, memo, useRef, useState } from 'react';
import { EdgeScroll } from '../components/EdgeScroll';
import { TentativeMark } from '../components/parts';
import { StaffMark } from '../components/StaffMark';
import { Empty, Hint } from '../components/ui';
import { useExceptionsOnly } from '../components/useFeature';
import type { Client, Staff } from '../contracts/documents';
import { COMPAT_LABELS, type Compat } from '../contracts/rules';
import { colorOf, initialOf } from '../lib/colors';
import { COMPAT_LEGEND, COMPAT_MEANING, compatLevelClass, compatLevelOf } from '../lib/compatLevel';
import { nameLines } from '../lib/compatView';
import { clampGridPos, type GridPos, moveGridPos } from '../lib/gridFocus';
import { compatHintLabel } from '../lib/peopleView';

/** 開いている吹き出しの種類（列の見出し・行の名前・マスの相性を選ぶ欄） */
export type CompatOpenKind = 'staff' | 'client' | 'cell';

/** 表の1行（相性を変えても、ほかの行は描き直さない。矢印で動いても、動く前と後の行だけ描き直す） */
const CompatRow = memo(function CompatRow({
  client: c,
  cols,
  row,
  open,
  popId,
  openSid,
  cellPopId,
  activeCol,
  activeId,
}: {
  client: Client;
  cols: readonly Staff[];
  /** その行の相性（staffId → 相性） */
  row: Compat[string] | undefined;
  /** 名前の吹き出しが開いている */
  open: boolean;
  /** 名前の吹き出しの id（名前の欄の id は `${popId}-btn`） */
  popId: string;
  /** 相性を選ぶ欄が開いているマスの〈スタッフ〉（この行に無ければ null） */
  openSid: string | null;
  /** この行のマスの相性を選ぶ欄の id */
  cellPopId: string;
  /** この行で Tab の止まり所になる列（−1＝名前。null＝この行には無い） */
  activeCol: number | null;
  /** 止まり所のマスの id（相性を選ぶ欄をそこに出す） */
  activeId: string;
}) {
  return (
    <tr data-cid={c.id}>
      <th
        scope="row"
        className="avail-name compat-client"
        id={`${popId}-btn`}
        tabIndex={activeCol === -1 ? 0 : -1}
        aria-label={c.displayName}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        data-kind="client"
        data-testid="compat-client-btn"
        data-id={c.id}
      >
        <span className="compat-client-name">
          <span className="dot dot-sm" style={{ background: colorOf(c.color) }} aria-hidden="true">
            {initialOf(c.displayName)}
          </span>
          <span className="ellipsis">{c.displayName}</span>
          {c.tentative && <TentativeMark />}
        </span>
      </th>
      {cols.map((s, j) => {
        const l = compatLevelOf(row, s.id);
        const active = activeCol === j;
        const expanded = openSid === s.id;
        return (
          // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role="grid" の表のマス（gridcell）は aria-expanded を持てる（相性を選ぶ欄の開け閉め）
          <td
            key={s.id}
            id={active ? activeId : undefined}
            className={`compat-cell ${compatLevelClass(l)}`}
            tabIndex={active ? 0 : -1}
            title={`${c.displayName} × ${s.name}：${COMPAT_MEANING[l]}（押すと選べます）`}
            aria-label={`${c.displayName}と${s.name}の相性：${COMPAT_MEANING[l]}`}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            aria-controls={expanded ? cellPopId : undefined}
            data-kind="cell"
            data-testid="compat-cell"
            data-sid={s.id}
          >
            {COMPAT_LABELS[l]}
          </td>
        );
      })}
    </tr>
  );
});

/** 凡例の1行（記号の意味はここだけ）・点のしくみ（入だけ）・表を並べ直す（写しが古いときだけ） */
export function CompatLegend({ stale, onResort }: { stale: boolean; onResort: () => void }) {
  // エキスパート機能が切なら、点・条件の重みの説明を出さない（PRD D384・D394・D420）
  const hint = compatHintLabel(useExceptionsOnly());
  return (
    <div className="compat-legend" data-testid="compat-legend">
      <p className="compat-legend-line">
        {COMPAT_LEGEND.map((l) => (
          <span key={l.mark} className="compat-legend-mark">
            <b className={l.cls}>{l.mark}</b>
            {l.text}
          </span>
        ))}
      </p>
      {hint && (
        <Hint label={hint}>
          <ul className="hint-list">
            <li>◎○は点が下がって選ばれやすく、△は点が上がって選ばれにくくなります。</li>
            <li>
              <span className="red-text">×</span>は「NG」で、担当にしません。
            </li>
            <li>効き方の強さは、「条件の重み」の画面の「相性」の重みで決まります。</li>
            <li>相性は人が入れるもので、自動では変わりません。</li>
          </ul>
        </Hint>
      )}
      {stale && (
        <button
          type="button"
          className="btn btn-small compat-resort"
          title="絞り込みを、いまの相性で並べ直します"
          onClick={onResort}
          data-testid="compat-resort"
        >
          <RefreshCw size={14} strokeWidth={2.2} aria-hidden="true" />
          表を並べ直す
        </button>
      )}
    </div>
  );
}

/** 絞り込みで当てはまる人がいないときの1つ分（絞り込みがあれば戻すボタン） */
function CompatEmptyOne({
  term,
  filtered,
  onReset,
  resetTestId,
}: {
  term: string;
  filtered: boolean;
  onReset: () => void;
  resetTestId: string;
}) {
  return (
    <Empty icon={SearchX}>
      当てはまる{term}がいません
      {filtered && (
        <div>
          <button type="button" className="btn btn-small" onClick={onReset} data-testid={resetTestId}>
            絞り込みを戻す
          </button>
        </div>
      )}
    </Empty>
  );
}

/** 列・行のどちらかに誰もいないときの欄 */
export function CompatEmpty({
  staff,
  clients,
}: {
  /** 列（null：いる） */
  staff: { term: string; filtered: boolean; onReset: () => void } | null;
  /** 行（null：いる） */
  clients: { term: string; filtered: boolean; onReset: () => void } | null;
}) {
  return (
    <div className="stack" data-testid="compat-empty">
      {staff && <CompatEmptyOne {...staff} resetTestId="compat-empty-sf-reset" />}
      {clients && <CompatEmptyOne {...clients} resetTestId="compat-empty-cf-reset" />}
    </div>
  );
}

/** 押した・キーを押した欄（見出し・名前・マス）と、その表の中の位置 */
function cellOf(target: EventTarget): { el: HTMLTableCellElement; pos: GridPos } | null {
  const el = target instanceof Element ? target.closest<HTMLTableCellElement>('th[data-kind], td[data-kind]') : null;
  const tr = el?.parentElement;
  if (!el || !(tr instanceof HTMLTableRowElement)) return null;
  const row = tr.parentElement?.tagName === 'THEAD' ? -1 : tr.sectionRowIndex;
  return { el, pos: { row, col: el.cellIndex - 1 } };
}

/** 訪問先×スタッフの表（grid。Tab で入り、矢印・Home・End・PageUp・PageDown で動き、Enter・Space か押すと開く） */
export function CompatTable({
  clientTerm,
  staff,
  clients,
  compat,
  isOpen,
  popId,
  cellAnchorId,
  onOpen,
}: {
  clientTerm: string;
  /** 列 */
  staff: readonly Staff[];
  /** 行 */
  clients: readonly Client[];
  compat: Compat;
  /** 開いているか（sid を渡すとマスの〈スタッフ〉まで見る） */
  isOpen: (kind: CompatOpenKind, id: string, sid?: string) => boolean;
  /** 吹き出しの id（見出し・名前の欄の id は `${popId}-btn`） */
  popId: (kind: CompatOpenKind, id: string) => string;
  /** 止まり所のマスの id（相性を選ぶ欄の位置とフォーカスの戻り先） */
  cellAnchorId: string;
  /** 開く（staff・client は詳細の吹き出し、cell は相性を選ぶ欄。id は〈スタッフ〉か〈利用者さん〉、sid はマスの〈スタッフ〉） */
  onOpen: (kind: CompatOpenKind, id: string, sid?: string) => void;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [pos, setPos] = useState<GridPos>({ row: 0, col: 0 });
  const size = { rows: clients.length, cols: staff.length };
  // 絞り込みで行・列が減ったら、止まり所を表の中に収める
  const at = clampGridPos(pos, size) ?? { row: 0, col: 0 };

  /** その欄を開く（見出し・名前は詳細、マスは相性を選ぶ欄） */
  const activate = (el: HTMLTableCellElement) => {
    const kind = el.dataset.kind;
    if (kind === 'staff' || kind === 'client') onOpen(kind, el.dataset.id ?? '');
    else if (kind === 'cell') onOpen('cell', el.closest('tr')?.dataset.cid ?? '', el.dataset.sid);
  };
  const onClick = (e: MouseEvent<HTMLTableElement>) => {
    const hit = cellOf(e.target);
    if (!hit) return;
    setPos(hit.pos);
    activate(hit.el);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    if (e.nativeEvent.isComposing) return;
    const hit = cellOf(e.target);
    if (!hit) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(hit.el);
      return;
    }
    const next = moveGridPos(hit.pos, e.key, e.ctrlKey || e.metaKey, size);
    if (!next) return;
    e.preventDefault();
    setPos(next);
    tableRef.current?.rows[next.row + 1]?.cells[next.col + 1]?.focus();
  };

  return (
    <EdgeScroll className="table-scroll compat-scroll">
      {/* biome-ignore lint/a11y/useSemanticElements: 表（table）のまま grid の役割を足す */}
      <table
        ref={tableRef}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: 表のまま grid の役割（矢印で動く）を足す（見出し・行の読み上げを保つ）
        role="grid"
        aria-label={`${clientTerm}と相性`}
        className="compat-table"
        data-testid="compat-table"
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <thead>
          <tr>
            <th className="avail-name">{clientTerm}</th>
            {staff.map((s, j) => (
              <th
                key={s.id}
                scope="col"
                className="compat-head"
                id={`${popId('staff', s.id)}-btn`}
                tabIndex={at.row === -1 && at.col === j ? 0 : -1}
                aria-label={s.name}
                aria-haspopup="dialog"
                aria-expanded={isOpen('staff', s.id)}
                aria-controls={isOpen('staff', s.id) ? popId('staff', s.id) : undefined}
                data-kind="staff"
                data-testid="compat-head-btn"
                data-id={s.id}
              >
                <span className="compat-head-inner">
                  <StaffMark staff={s} size="md" />
                  <span className="compat-head-name" aria-hidden="true">
                    {nameLines(s.name).map((line, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: 同じ文字の行が並ぶこともある
                      <span key={i} className="compat-head-line">
                        {line}
                      </span>
                    ))}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map((c, i) => (
            <CompatRow
              key={c.id}
              client={c}
              cols={staff}
              row={Object.hasOwn(compat, c.id) ? compat[c.id] : undefined}
              open={isOpen('client', c.id)}
              popId={popId('client', c.id)}
              openSid={isOpen('cell', c.id) ? (staff.find((s) => isOpen('cell', c.id, s.id))?.id ?? null) : null}
              cellPopId={popId('cell', c.id)}
              activeCol={at.row === i ? at.col : null}
              activeId={cellAnchorId}
            />
          ))}
        </tbody>
      </table>
    </EdgeScroll>
  );
}
