// 日の予定の表示に使う計算：地図の点と線（PRD D300）・スマホの日ごとのリストの行（PRD D334）・担当ごとの1日（PRD D84）・
// 「入らない」「守れない条件」の一覧の行（PRD D345）
import { useMemo } from 'react';
import type { DayListRow } from '../components/dayList';
import type { IssueRow } from '../components/PlanIssueCount';
import type { useRouteSelection } from '../components/useRouteSelection';
import type { Visit } from '../contracts/documents';
import { hhmmToMinutes, jstDate, minutesToHhmm } from '../domain/time';
import { colorOf } from '../lib/colors';
import { clockTime } from '../lib/dateText';
import { dayLineRange, dayLines } from '../lib/dayLine';
import { hardLinks } from '../lib/hardLinks';
import { linkIfOn } from '../lib/links';
import { typeOf } from '../lib/patternText';
import type { ReassignMarks } from '../lib/planReassign';
import { droppedRowsOf, hardRowsOf, unplacedReasons } from '../lib/planView';
import { buildRouteMap } from '../lib/routeView';
import { spansOf } from '../lib/spans';
import { canSelectVisit } from '../lib/visitSelect';
import type { PlanData } from './usePlanData';
import { PLAN_SET } from './usePlanNav';

/** 地図：今の担当の並び（担当ごとの色の実線） */
export function usePlanMap(d: PlanData, sel: ReturnType<typeof useRouteSelection>, marks: ReassignMarks) {
  const { hasPlan, columns, routes, staffById, colorOfStaff, visitById, clientById } = d;
  const { focusStaff } = sel;
  return useMemo(
    () =>
      hasPlan
        ? buildRouteMap({
            sets: [{ key: PLAN_SET, routes }],
            staffOrder: columns,
            staffById,
            visitById,
            clientById,
            colorOfStaff,
            focusStaff,
            picked: sel.picked,
            focusLeg: sel.focusLeg,
            emphasize: marks.emphasize,
          })
        : { points: [], lines: [] },
    [
      hasPlan,
      columns,
      routes,
      staffById,
      colorOfStaff,
      visitById,
      clientById,
      focusStaff,
      sel.picked,
      sel.focusLeg,
      marks,
    ],
  );
}

/**
 * スマホの日ごとのリスト（PRD D334）の行：その日の訪問（取り消し・休みの回も）を時刻の順に。時刻は今の担当の開始（無ければ開始の早い方）。
 * 印は要対応（訪問ごとの検査）・未連絡の変更・ピン。スマホの幅のときだけ作る
 */
export function useDayRows(d: PlanData, compact: boolean): DayListRow[] {
  const { m, explained, owner, staffById, clientById, looks, data } = d;
  return useMemo((): DayListRow[] => {
    if (!compact) return [];
    const startOf = (v: Visit) => explained.get(v.id)?.timing?.start ?? hhmmToMinutes(v.earliestStart);
    return [...m.allVisits]
      .sort((a, b) => startOf(a) - startOf(b) || a.id.localeCompare(b.id))
      .map((v) => {
        const sid = owner.get(v.id) ?? (v.cancelled ? v.staffId : null);
        const sName = sid ? (staffById.get(sid)?.name ?? '（不明）') : '';
        const s = sid ? (staffById.get(sid) ?? null) : null;
        const leave = !v.cancelled && m.leaveVisits.includes(v);
        const start = startOf(v);
        const type = typeOf(data.visitTypes, v.typeId);
        return {
          visitId: v.id,
          time: `${clockTime(start)}〜${clockTime(start + v.durationMinutes)}`,
          title: clientById.get(v.clientId)?.displayName ?? '（不明）',
          staff: s,
          staffName: sName,
          state: v.cancelled
            ? v.cancelKind === 'sameDay'
              ? '当日キャンセル'
              : '取り消し'
            : leave
              ? '休みのため無し'
              : null,
          look: looks.get(v.id),
          color: type ? colorOf(type.color) : null,
          selectable: canSelectVisit(v, leave, jstDate(Date.now())),
        };
      });
  }, [compact, m.allVisits, m.leaveVisits, explained, owner, staffById, clientById, looks, data]);
}

/** 担当ごとの1日（PRD D84）：今の担当の並びから。列と同じ人・同じ順 */
export function useStaffLines(d: PlanData) {
  const { problem, hasPlan, routes, columns, slotsOf } = d;
  const lines = useMemo(
    () =>
      problem && hasPlan ? dayLines(problem, routes, columns, (sid) => spansOf(slotsOf.get(sid)?.baseSlots ?? [])) : [],
    [problem, hasPlan, routes, columns, slotsOf],
  );
  const range = useMemo(() => dayLineRange(lines), [lines]);
  return { lines, range };
}

/** 「入らない N」「守れない条件 N」の一覧の行（PRD D345）。時刻は今の担当の開始、無ければ約束の開始 */
export function planIssueRows(d: PlanData): { dropped: IssueRow[]; hard: IssueRow[] } {
  const { explained, visitById, clientOf, problem, unassigned, cs, terms, data, staffName, whyOf } = d;
  const timeOf = (id: string) => {
    const t = explained.get(id)?.timing;
    return t ? minutesToHhmm(t.start) : (visitById.get(id)?.earliestStart ?? '');
  };
  const w = { timeOf, clientName: (id: string) => clientOf(id)?.displayName ?? '（不明）' };
  return {
    // 理由は「担当なしの訪問」の列の札と同じ
    dropped: droppedRowsOf(
      unassigned,
      (id) => unplacedReasons(problem, explained, id),
      w,
      (id) => (whyOf.get(id)?.links ?? []).filter((l) => linkIfOn(data.org.features, l.to) !== null),
    ),
    // 訪問ごとに1行。関連の画面は lib/hardLinks（切った機能の行き先は出さない）
    hard: hardRowsOf(
      cs?.hardViolations ?? [],
      (h) => hardLinks(h, clientOf(h.visitId)?.id, terms).filter((l) => linkIfOn(data.org.features, l.to) !== null),
      { ...w, staffName },
    ),
  };
}
