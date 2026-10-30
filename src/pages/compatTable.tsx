// 相性の表（PRD D113〜D115・D177）：凡例・訪問先×スタッフの表（見出しを押すと詳細の吹き出し、セルを押すと相性を回す）・
// 絞り込みで誰もいないときの欄
import { RefreshCw, SearchX } from 'lucide-react';
import { memo } from 'react';
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
import { compatHintLabel, showCompatWeightNote } from '../lib/peopleView';

/** 開いている吹き出しの種類（列の見出し・行の名前） */
export type CompatOpenKind = 'staff' | 'client';

/** 表の1行（セルを押しても、ほかの行は描き直さない） */
const CompatRow = memo(function CompatRow({
  client: c,
  cols,
  row,
  open,
  popId,
  onToggle,
  onCycle,
}: {
  client: Client;
  cols: readonly Staff[];
  /** その行の相性（staffId → 相性） */
  row: Compat[string] | undefined;
  open: boolean;
  /** 吹き出しの id（ボタンの id は `${popId}-btn`） */
  popId: string;
  onToggle: (kind: CompatOpenKind, id: string) => void;
  onCycle: (clientId: string, staffId: string) => void;
}) {
  return (
    <tr>
      <th className="avail-name">
        <button
          type="button"
          id={`${popId}-btn`}
          className="compat-client-btn"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popId : undefined}
          aria-label={`${c.displayName}の詳細`}
          onClick={() => onToggle('client', c.id)}
          data-testid="compat-client-btn"
          data-id={c.id}
        >
          <span className="dot dot-sm" style={{ background: colorOf(c.color) }}>
            {initialOf(c.displayName)}
          </span>
          <span className="ellipsis">{c.displayName}</span>
          {c.tentative && <TentativeMark />}
        </button>
      </th>
      {cols.map((s) => {
        const l = compatLevelOf(row, s.id);
        return (
          <td key={s.id} className="compat-cell">
            <button
              type="button"
              className={`compat-btn ${compatLevelClass(l)}`}
              title={`${c.displayName} × ${s.name}：${COMPAT_MEANING[l]}（押すと変わります）`}
              aria-label={`${c.displayName}と${s.name}の相性：${COMPAT_MEANING[l]}`}
              data-testid="compat-cell"
              onClick={() => onCycle(c.id, s.id)}
              data-sid={s.id}
            >
              {COMPAT_LABELS[l]}
            </button>
          </td>
        );
      })}
    </tr>
  );
});

/** 凡例・点のしくみ・表を並べ直す（写しが古いときだけ） */
export function CompatLegend({ stale, onResort }: { stale: boolean; onResort: () => void }) {
  // エキスパート機能が切なら、点・条件の重みを言わない（PRD D384・D388）
  const only = useExceptionsOnly();
  return (
    <div className="compat-legend">
      {COMPAT_LEGEND.map((l) => (
        <span key={l.mark} className={`compat-legend-item ${l.cls}`}>
          <b>{l.mark}</b>
          {l.text}
        </span>
      ))}
      <Hint label={compatHintLabel(only)}>
        <ul className="hint-list">
          <li>◎○は選ばれやすく、△は選ばれにくくなります。</li>
          <li>
            <span className="red-text">×</span>は「NG」で、担当にしません。
          </li>
          {showCompatWeightNote(only) && <li>効き方の強さは、「条件の重み」の画面の「相性」の重みで決まります。</li>}
          <li>相性は人が入れるもので、自動では変わりません。</li>
        </ul>
      </Hint>
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

/** 訪問先×スタッフの表 */
export function CompatTable({
  clientTerm,
  staff,
  clients,
  compat,
  isOpen,
  popId,
  onToggle,
  onCycle,
}: {
  clientTerm: string;
  /** 列 */
  staff: readonly Staff[];
  /** 行 */
  clients: readonly Client[];
  compat: Compat;
  isOpen: (kind: CompatOpenKind, id: string) => boolean;
  /** 吹き出しの id（ボタンの id は `${popId}-btn`） */
  popId: (kind: CompatOpenKind, id: string) => string;
  onToggle: (kind: CompatOpenKind, id: string) => void;
  onCycle: (clientId: string, staffId: string) => void;
}) {
  return (
    <EdgeScroll className="table-scroll compat-scroll">
      <table className="compat-table" data-testid="compat-table">
        <thead>
          <tr>
            <th className="avail-name">{clientTerm}</th>
            {staff.map((s) => (
              <th key={s.id} className="compat-head">
                <button
                  type="button"
                  id={`${popId('staff', s.id)}-btn`}
                  className="compat-head-btn"
                  aria-haspopup="dialog"
                  aria-expanded={isOpen('staff', s.id)}
                  aria-controls={isOpen('staff', s.id) ? popId('staff', s.id) : undefined}
                  aria-label={`${s.name}の詳細`}
                  onClick={() => onToggle('staff', s.id)}
                  data-testid="compat-head-btn"
                  data-id={s.id}
                >
                  <StaffMark staff={s} size="md" />
                  <span className="compat-head-name" aria-hidden="true">
                    {nameLines(s.name).map((line, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: 同じ文字の行が並ぶこともある
                      <span key={i} className="compat-head-line">
                        {line}
                      </span>
                    ))}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <CompatRow
              key={c.id}
              client={c}
              cols={staff}
              row={Object.hasOwn(compat, c.id) ? compat[c.id] : undefined}
              open={isOpen('client', c.id)}
              popId={popId('client', c.id)}
              onToggle={onToggle}
              onCycle={onCycle}
            />
          ))}
        </tbody>
      </table>
    </EdgeScroll>
  );
}
