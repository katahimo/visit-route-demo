// 月の画面の表示の選択に依る数（PRD D54・D55・D61・D69）：〈利用者さん〉の検索欄の近道・混み具合（全体のとき）・
// 選んだ〈スタッフ〉／〈利用者さん〉の日と月の集計・希望休の日
import { useCallback, useMemo, useRef } from 'react';
import type { DemoData } from '../contracts/data';
import { attempt } from '../lib/common';
import { type ClientDay, clientDay, type StaffDay, staffDay, staffMonth } from '../lib/month';
import { type MonthFocus, monthClientIds, monthStaffClientPairs, sameList } from '../lib/monthView';
import { requestedOffDates } from '../lib/requestedOff';
import { staffClientMap } from '../lib/search';
import { usualStaffMap } from '../lib/usualStaff';
import type { CompileInput } from '../matching';
import { type DayLoadSlot, dayLoad } from '../vacancy';
import type { MonthDays } from './useMonthDays';

export function useMonthFocusDays(x: {
  data: DemoData;
  compileInput: CompileInput;
  month: Pick<MonthDays, 'days' | 'visitsByDate' | 'dayPlans'>;
  focus: MonthFocus;
  /** 混み具合で数える人（null＝すべての人。種類の ID） */
  loadType: string | null;
  ym: string;
  today: string;
}) {
  const { data, compileInput, focus, loadType, ym, today } = x;
  const { days, visitsByDate, dayPlans } = x.month;

  // ---- 〈利用者さん〉の検索欄の近道（PRD D61）----
  /** この月に（取り消しでも〈利用者さん〉の休み（ADR-0013）でもない）訪問がある〈利用者さん〉 */
  const clientIds = useMemo(
    () => monthClientIds(days, visitsByDate, data.clientLeaves),
    [days, visitsByDate, data.clientLeaves],
  );
  /** 〈スタッフ〉が担当する〈利用者さん〉：この月の訪問の今の担当と、いつもの担当 */
  const staffClients = useMemo(
    () =>
      staffClientMap(
        monthStaffClientPairs(days, dayPlans, visitsByDate),
        data.clients,
        usualStaffMap(data.patterns, today),
      ),
    [days, dayPlans, visitsByDate, data.clients, data.patterns, today],
  );
  const clientsOfStaff = useCallback((sid: string) => staffClients.get(sid) ?? new Set<string>(), [staffClients]);

  // ---- 混み具合（D54。日付・数える人・compile が読むデータ・案で覚える）----
  const loadMemo = useRef(new Map<string, { key: readonly unknown[]; value: DayLoadSlot[] | null }>());
  const loads = useMemo(() => {
    const out = new Map<string, DayLoadSlot[] | null>();
    if (focus.kind !== 'all') return out;
    const base = [
      data.org,
      data.items,
      data.staff,
      data.clients,
      data.compat,
      data.availability,
      data.absences,
      data.visitTypes,
      data.rules,
      loadType,
    ];
    for (const d of days) {
      const visits = visitsByDate.get(d) ?? [];
      const key = [...base, ...visits];
      const hit = loadMemo.current.get(d);
      if (hit && sameList(hit.key, key)) {
        out.set(d, hit.value);
        continue;
      }
      const value = attempt(() => dayLoad(data, d, { typeId: loadType })).value ?? null;
      loadMemo.current.set(d, { key, value });
      out.set(d, value);
    }
    return out;
  }, [focus.kind, days, data, visitsByDate, loadType]);

  // ---- 選んだ人の日と月の集計（D55）----
  const staffDays = useMemo(() => {
    const out = new Map<string, StaffDay>();
    if (focus.kind !== 'staff') return out;
    for (const d of days) out.set(d, staffDay(compileInput, dayPlans.get(d)!, focus.id));
    return out;
  }, [focus, days, compileInput, dayPlans]);
  const clientDays = useMemo(() => {
    const out = new Map<string, ClientDay>();
    if (focus.kind !== 'client') return out;
    for (const d of days) out.set(d, clientDay(compileInput, dayPlans.get(d)!, focus.id));
    return out;
  }, [focus, days, compileInput, dayPlans]);
  /** 選んでいる〈スタッフ〉のこの月の希望休の日 */
  const offDates = useMemo(
    () => (focus.kind === 'staff' ? requestedOffDates(data, focus.id, ym) : []),
    [focus, data, ym],
  );
  const monthPlans = useMemo(() => days.map((d) => dayPlans.get(d)!), [days, dayPlans]);
  const staffSum = useMemo(
    () => (focus.kind === 'staff' ? staffMonth(compileInput, monthPlans, focus.id) : null),
    [focus, compileInput, monthPlans],
  );

  return { clientIds, clientsOfStaff, loads, staffDays, clientDays, offDates, staffSum };
}

export type MonthFocusDays = ReturnType<typeof useMonthFocusDays>;
