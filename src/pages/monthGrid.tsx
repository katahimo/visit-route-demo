// 月の画面の本体の2つの見せ方（PRD D189）：カレンダー（7列の表。日のマスは monthCell.tsx）と日ごとの一覧（縦に1日1行）
import { Lock, PencilLine } from 'lucide-react';
import { type RefObject, useMemo, useRef } from 'react';
import type { DropHover } from '../components/visitParts';
import { weekday } from '../domain/time';
import { WEEKDAY_LABELS } from '../lib/common';
import { mdText, ymText } from '../lib/dateText';
import { createTipStore } from '../lib/monthGuide';
import type { MonthListEntry } from '../lib/monthView';
import type { OffDayState } from '../lib/requestedOff';
import { ymOf } from '../lib/ym';
import { type CellContext, DayCell } from './monthCell';
import { MonthCellTip } from './monthCellTip';
import type { MonthDays } from './useMonthDays';
import type { MonthFocusDays } from './useMonthFocusDays';
import type { MonthVisitRows } from './useMonthVisitRows';

/**
 * カレンダー（7列の表）。日のマスは memo なので、どのマスでも同じもの（cell）はここで覚えて渡す。
 * 表へ一覧の行をドラッグすると、落とし先のマスに影を出す（PRD D341）
 */
export function MonthGrid({
  ym,
  date,
  current,
  month,
  focusDays,
  cell,
  offStateOf,
  selectedByDate,
  listDay,
  drop,
}: {
  ym: string;
  /** 選んでいる日付 */
  date: string;
  /** いま作っている日（月まとめ作成） */
  current: string | undefined;
  month: Pick<MonthDays, 'weeks' | 'statuses' | 'marks' | 'attentionByDate' | 'usualRest'>;
  focusDays: Pick<MonthFocusDays, 'loads' | 'staffDays' | 'clientDays'>;
  cell: Omit<CellContext, 'tipStore'>;
  offStateOf: (date: string) => OffDayState | undefined;
  selectedByDate: ReadonlyMap<string, number>;
  listDay: string | null;
  /** 表に付けるドラッグの落とし先の props と、いまの影（落とし先の日・影） */
  drop: { gridProps: MonthVisitRows['gridDrop']; date: string | null; hover: DropHover | null };
}) {
  /** 日のマスの表（読み方の吹き出し MonthCellTip が見る。PRD D177） */
  const gridRef = useRef<HTMLTableElement>(null);
  /** マスの読み方の文の置き場（日付 → 文。PRD D177） */
  const tipStore = useMemo(() => createTipStore(), []);
  const { today, focus, typeById, staffById, clientTerm, staffTerm, onOpen, onToggleOff, onKey, onMulti } = cell;
  const ctx = useMemo(
    (): CellContext => ({
      tipStore,
      today,
      focus,
      typeById,
      staffById,
      clientTerm,
      staffTerm,
      onOpen,
      onToggleOff,
      onKey,
      onMulti,
    }),
    [tipStore, today, focus, typeById, staffById, clientTerm, staffTerm, onOpen, onToggleOff, onKey, onMulti],
  );
  const { statuses, marks } = month;
  return (
    <>
      <table ref={gridRef} className="month-grid" data-testid="month-grid" {...drop.gridProps}>
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((w, i) => (
              <th key={w} scope="col" className={i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}>
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {month.weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((d) => {
                const s = statuses.get(d);
                if (ymOf(d) !== ym || !s) {
                  return (
                    <td key={d} className="month-cell is-out">
                      <span className="month-day">{mdText(d)}</span>
                    </td>
                  );
                }
                return (
                  <DayCell
                    key={d}
                    date={d}
                    ctx={ctx}
                    status={s}
                    picked={d === date}
                    making={current === d}
                    marks={marks.get(d)!}
                    load={focus === 'all' ? (focusDays.loads.get(d) ?? null) : undefined}
                    staffDay={focusDays.staffDays.get(d)}
                    clientDay={focusDays.clientDays.get(d)}
                    offState={offStateOf(d)}
                    attention={month.attentionByDate.get(d) ?? 0}
                    usualRest={month.usualRest[weekday(d)] ?? 0}
                    selected={selectedByDate.get(d) ?? 0}
                    listed={listDay === d}
                    drop={drop.date === d ? (drop.hover ?? undefined) : undefined}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <MonthCellTip gridRef={gridRef} tipStore={tipStore} />
    </>
  );
}

/** 日ごとの一覧の1行（カレンダーのマスと同じ印。PRD D189） */
function MonthListItem({
  entry: { row: r, extra, off },
  date,
  listed,
  current,
  onPick,
  onToggleOff,
}: {
  entry: MonthListEntry;
  date: string;
  listed: boolean;
  current: string | undefined;
  onPick: (date: string) => void;
  onToggleOff: (date: string) => void;
}) {
  const offPress = off === 'open' || off === 'requested';
  return (
    <li>
      <button
        type="button"
        className={[
          'month-list-btn',
          `is-state-${r.state}`,
          r.isPast ? 'is-past' : '',
          r.care ? 'is-care' : '',
          r.isToday ? 'is-today' : '',
          r.date === date ? 'is-picked' : '',
          listed ? 'is-listed' : '',
          off ? `is-off-${off}` : '',
        ].join(' ')}
        aria-label={`${r.label}${current === r.date ? '・作っています' : ''}`}
        aria-pressed={off ? off === 'requested' : undefined}
        aria-disabled={off !== undefined && !offPress ? true : undefined}
        onClick={() => {
          // カレンダーのマスと同じ動き：ふだんはその日の訪問（右の欄・スマホは下から出る欄。もう一度で日の予定）、
          // 「休みを入れる」のときは希望休の付け外し
          if (!off) onPick(r.date);
          else if (offPress) onToggleOff(r.date);
        }}
        data-testid="month-list-day"
        data-date={r.date}
        data-state={r.state}
        data-off={off}
      >
        <span className={`month-list-date wd-${r.weekday}`}>
          {r.dayText}
          {r.isToday && <span className="month-today">今日</span>}
        </span>
        <span className="month-list-state">
          {r.state === 'told' && <Lock size={12} aria-hidden="true" />}
          {r.state === 'changed' && <PencilLine size={12} aria-hidden="true" />}
          {r.stateText}
        </span>
        <span className="month-list-count">{r.count > 0 ? `${r.count}件` : ''}</span>
        <span className="month-list-flags">
          {r.attention > 0 ? (
            <span className="month-attn" data-testid="month-attn">
              要対応 {r.attention}
            </span>
          ) : (
            r.care && <span className="month-dot" aria-hidden="true" />
          )}
          {r.flags.map((f) => (
            <span key={f.text} className={`month-flag is-${f.tone}`}>
              {f.text}
            </span>
          ))}
          {current === r.date && <span className="month-flag is-warn">作っています…</span>}
        </span>
        {extra.length > 0 && <span className="month-list-extra sub">{extra.join('・')}</span>}
      </button>
    </li>
  );
}

/** 日ごとの一覧（PRD D189）。今月なら「今日へ」 */
export function MonthList({
  ym,
  today,
  date,
  rows,
  listRef,
  onToday,
  isListed,
  current,
  onPick,
  onToggleOff,
}: {
  ym: string;
  today: string;
  date: string;
  rows: readonly MonthListEntry[];
  listRef: RefObject<HTMLUListElement | null>;
  onToday: () => void;
  /** その日の訪問を右の欄・下から出る欄に出している */
  isListed: (date: string) => boolean;
  current: string | undefined;
  onPick: (date: string) => void;
  onToggleOff: (date: string) => void;
}) {
  return (
    <>
      {ym === ymOf(today) && (
        <button
          type="button"
          className="btn btn-small month-list-today"
          onClick={onToday}
          data-testid="month-list-today"
        >
          今日へ
        </button>
      )}
      <ul ref={listRef} className="month-list" aria-label={`${ymText(ym)}の日ごとの一覧`} data-testid="month-list">
        {rows.map((entry) => (
          <MonthListItem
            key={entry.row.date}
            entry={entry}
            date={date}
            listed={isListed(entry.row.date)}
            current={current}
            onPick={onPick}
            onToggleOff={onToggleOff}
          />
        ))}
      </ul>
    </>
  );
}
