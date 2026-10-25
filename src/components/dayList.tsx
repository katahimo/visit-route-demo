// スマホ（600px 以下）の日ごとのリスト（PRD D334。ADR-0055）：その日の訪問を時刻の順に1行ずつ
// （時刻・〈利用者さん〉・担当の印と名前・印（要対応・未連絡の変更・ピン））。行を押すと訪問の詳細の欄（下から出る欄）。
// 左右にスワイプすると前・次の日。行を長押しするか「選ぶ」で複数選択（選んでいる間は押すと選ぶ・外す）
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDayListPress } from './useDayListPress';
import { SelectToggle, VisitRow, type VisitRowData } from './visitParts';
import './dayList.css';

/** リストの1行（行の作りは共通の VisitRow。選べるか：今日より前・取り消し・休みは選ばない） */
export type DayListRow = VisitRowData & { selectable: boolean };

export function DayList({
  dateLabel,
  rows,
  onOpen,
  selecting,
  onSelecting,
  isSelected,
  onToggle,
  onPrev,
  onNext,
}: {
  /** 「10/23（金）」 */
  dateLabel: string;
  rows: readonly DayListRow[];
  onOpen: (visitId: string) => void;
  /** 選ぶ形か（「選ぶ」を押した・長押しした） */
  selecting: boolean;
  onSelecting: (on: boolean) => void;
  isSelected: (visitId: string) => boolean;
  onToggle: (visitId: string) => void;
  /** 前・次の日（その日が無ければ null。スワイプ） */
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const { onDown, onMove, onUp, onCancel, onRowClick } = useDayListPress<DayListRow>({
    selecting,
    onSelecting,
    onToggle,
    onOpen,
    onPrev,
    onNext,
  });
  const count = rows.filter((r) => !r.state).length;
  return (
    <section
      className={`day-list card${selecting ? ' is-selecting' : ''}`}
      aria-label={`${dateLabel}の訪問`}
      data-testid="day-list"
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('.day-row')) onDown(e, null);
      }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
    >
      <div className="day-list-head">
        <strong>
          訪問 <span data-testid="day-list-count">{count}</span>件
        </strong>
        <span className="sub day-list-swipe">左右にスワイプで日を送る</span>
        <SelectToggle
          selecting={selecting}
          onChange={onSelecting}
          testId="day-list-select"
          disabled={!rows.some((r) => r.selectable)}
        />
      </div>
      {rows.length === 0 ? (
        <p className="sub day-list-empty">この日の訪問はありません。</p>
      ) : (
        <ul className="vrow-list day-rows">
          {rows.map((r) => {
            const on = selecting && isSelected(r.visitId);
            return (
              <li key={r.visitId}>
                <VisitRow
                  row={r}
                  selecting={selecting}
                  selected={on}
                  testId="day-row"
                  markPrefix="day-mark"
                  extraClass="day-row"
                  props={{
                    'aria-pressed': selecting ? on : undefined,
                    'data-selected': on || undefined,
                    'data-visit-item': '',
                    onPointerDown: (e: ReactPointerEvent) => onDown(e, r),
                    onClick: () => onRowClick(r),
                    onContextMenu: (e: { preventDefault(): void }) => {
                      // 長押しで出るブラウザのメニューを出さない（長押しは複数選択）
                      if (r.selectable) e.preventDefault();
                    },
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
