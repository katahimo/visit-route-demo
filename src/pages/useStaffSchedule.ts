// 〈スタッフ〉の画面の予定のタブ（PRD D308〜D310・D312。ADR-0052）：カレンダーの見せ方と基準の日（URL の ?cal=・?d=）・
// その期間の勤務の見込み・これから60日の欠勤と希望休・日ごとに変えた勤務
import { useMemo } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import type { Staff } from '../contracts/documents';
import { addDays } from '../domain/time';
import { type CalView, calDates, calViewOf, type StaffTab, staffAbsencesIn } from '../lib/personPage';
import { staffOverrides } from '../lib/staffEdit';
import { workDayOf, workTotals } from '../lib/workload';
import { ymOf } from '../lib/ym';
import { useDemoData } from '../store';

export function useStaffSchedule({
  params,
  setParams,
  tab,
  saved,
  today,
}: {
  params: URLSearchParams;
  setParams: SetURLSearchParams;
  tab: StaffTab;
  saved: Staff | undefined;
  today: string;
}) {
  const { data } = useDemoData();
  const calView = calViewOf(params.get('cal'));
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('d') ?? '') ? params.get('d')! : today;
  const setCal = ({ view, anchor: a }: { view: CalView; anchor: string }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (view === 'week') p.delete('cal');
        else p.set('cal', view);
        if (a === today) p.delete('d');
        else p.set('d', a);
        return p;
      },
      { replace: true },
    );
  const range = useMemo(() => {
    const ds = calDates(calView, anchor);
    return calView === 'month' ? ds.filter((d) => ymOf(d) === ymOf(anchor)) : ds;
  }, [calView, anchor]);
  /** その期間の勤務の見込み（訪問の今の担当。予定のタブのときだけ数える） */
  const work = useMemo(() => {
    if (tab !== 'schedule' || !saved) return null;
    const days = range.map((d) => workDayOf(data, d));
    return workTotals(days).get(saved.id) ?? null;
  }, [tab, saved, range, data]);
  const absences = useMemo(
    () => (saved ? staffAbsencesIn(data, saved.id, today, addDays(today, 60)) : []),
    [data, saved, today],
  );
  const overrides = useMemo(
    () => (saved ? staffOverrides(data.availability, saved.id, today) : []),
    [data.availability, saved, today],
  );
  return { calView, anchor, setCal, work, absences, overrides };
}

export type StaffSchedule = ReturnType<typeof useStaffSchedule>;
