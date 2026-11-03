// 期間の訪問の見た目（PRD D339〜D341。ADR-0056）：日の状態 useDayStatuses から引き、画面ごとに判定を持たない
import { useMemo } from 'react';
import { isOnLeave } from '../domain/leaves';
import { jstDate } from '../domain/time';
import { exceptionsOnly } from '../lib/exceptionView';
import { showConfirmStep } from '../lib/settledView';
import { dayLooks, type VisitLook } from '../lib/visitLook';
import { visitsOn } from '../patterns';
import { useDemoData } from '../store';
import { useCompileInput } from './useDayModel';
import { useDayStatuses } from './useDayStatuses';

/**
 * 期間の訪問の見た目（訪問ID → VisitLook）。日の状態（月の予定・週の予定・要対応の帯と同じ useDayStatuses の覚え）から引くので、
 * どの画面でも同じ判定になる。dates は useMemo した配列を渡す
 */
export function useVisitLooks(dates: readonly string[]): (visitId: string) => VisitLook | undefined {
  const { data } = useDemoData();
  const compileInput = useCompileInput(data);
  const statuses = useDayStatuses(data, compileInput, dates);
  const today = jstDate(Date.now());
  const confirmStep = showConfirmStep(data.org.features);
  const only = exceptionsOnly(data.org.features);
  return useMemo(() => {
    const staffById = new Map(data.staff.map((s) => [s.id, s.name]));
    const tentative = new Set(data.clients.filter((c) => c.tentative).map((c) => c.id));
    const all = new Map<string, VisitLook>();
    for (const d of dates) {
      const st = statuses.get(d);
      const looks = dayLooks(
        {
          issues: st?.status.issues ?? new Map(),
          told: st?.status.told ?? null,
          problem: st?.problem ?? null,
        },
        visitsOn(data, d),
        {
          staffName: (id) => staffById.get(id) ?? '（不明）',
          leaveOf: (v) => isOnLeave(data.clientLeaves, { clientId: v.clientId, date: d }),
          tentativeOf: (id) => tentative.has(id),
          past: d < today,
          confirmStep,
          exceptionsOnly: only,
        },
      );
      for (const [id, l] of looks) all.set(id, l);
    }
    return (id: string) => all.get(id);
  }, [data, dates, statuses, today, confirmStep, only]);
}
