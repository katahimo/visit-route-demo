// 考え方ごとの案の時間軸の列（予定の画面と同じ時間軸。担当ごとの列・訪問の帯・印）
import { Clock } from 'lucide-react';
import type { DemoData } from '../contracts/data';
import type { Staff } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import { slotsText } from '../domain/availability';
import { changeNote } from '../lib/choiceBandView';
import { choiceColumns } from '../lib/choiceView';
import { colorOf } from '../lib/colors';
import type { DaySlots } from '../lib/dayModel';
import type { ProposalChange } from '../lib/monthBatch';
import { typeOf } from '../lib/patternText';
import { legsOf } from '../lib/timeline';
import type { TimelineColumn } from './routeTimeline';
import { StaffFocusButton } from './routeView';
import { shiftShort, TlMark } from './timelineMarks';
import type { useRouteSelection } from './useRouteSelection';

/** 地図・選択の集まりのキー（案は1つずつ見る） */
export const CHOICE_SET = 'choice';
const NO_DROP = { onDragOver: () => {}, onDragLeave: () => {}, onDrop: () => {} };

/** 列を作るのに要るもの（見ている案の問題・担当の並び・今との違い・選択と名前の引き方） */
export type ChoiceColumnsInput = {
  problem: Problem;
  routes: Record<string, string[]>;
  staffIds: ReadonlySet<string>;
  staffById: ReadonlyMap<string, Staff>;
  colorOfStaff: ReadonlyMap<string, string>;
  slotsOf: ReadonlyMap<string, DaySlots>;
  changes: ReadonlyMap<string, ProposalChange>;
  visitTypes: DemoData['visitTypes'];
  sel: ReturnType<typeof useRouteSelection>;
  typeIdOf: (visitId: string) => string | null | undefined;
  clientName: (visitId: string) => string;
  staffName: (id: string | null) => string;
};

export function choiceTimelineColumns(i: ChoiceColumnsInput): TimelineColumn[] {
  const { sel, changes } = i;
  return choiceColumns(i.problem, i.routes, i.staffIds, i.staffById).map((col) => {
    const s = i.staffById.get(col.staffId);
    return {
      staffId: col.staffId,
      // 地図で見ている人の列を強調し、ほかを薄くする（予定の画面と同じ）
      className: [
        sel.focusStaff === col.staffId ? 'is-focus' : '',
        sel.focusStaff && sel.focusStaff !== col.staffId ? 'is-dim-col' : '',
      ].join(' '),
      style: { borderTopColor: i.colorOfStaff.get(col.staffId) },
      drop: NO_DROP,
      header: (
        <>
          <div className="spread">
            <StaffFocusButton
              staff={s}
              name={s?.name ?? '（不明）'}
              on={sel.focusStaff === col.staffId}
              onToggle={() => sel.focusOn(sel.focusStaff === col.staffId ? null : col.staffId)}
            />
            <span className="chip">{col.stops.length}件</span>
          </div>
          <div className="col-hours">
            <span className="sub item-time">
              <Clock size={13} aria-hidden="true" />
              {slotsText(i.slotsOf.get(col.staffId)?.slots ?? [])}
            </span>
          </div>
        </>
      ),
      baseSlots: col.slots,
      slots: col.slots,
      bands: col.stops.map((t) => {
        const c = changes.get(t.visitId);
        const type = typeOf(i.visitTypes, i.typeIdOf(t.visitId));
        // 予定の画面の振り直しと同じ印：担当が変わる（代）・時刻だけ変わる（±分）
        const note = changeNote(c, i.staffName);
        return {
          visitId: t.visitId,
          start: t.start,
          end: t.end,
          name: i.clientName(t.visitId),
          color: type ? colorOf(type.color) : null,
          tone: null,
          picked: sel.isPicked({ id: t.visitId, set: CHOICE_SET }),
          dragging: false,
          onPick: () => sel.togglePick({ id: t.visitId, set: CHOICE_SET }),
          note,
          marks:
            c && note ? (
              <TlMark tone={c.kind === 'staff' ? 'is-move' : 'is-warn'} title={note} testId="choice-mark">
                {c.kind === 'staff' ? '代' : shiftShort(c.minutes)}
              </TlMark>
            ) : undefined,
        };
      }),
      legs: legsOf(col.stops, col.homeMinutes),
      shadow: null,
      emptyText: '訪問なし',
    };
  });
}
