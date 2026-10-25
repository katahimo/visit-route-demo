// 相性の画面の絞り込み（PRD D116）：列（〈スタッフ〉。?sf=）と行（〈利用者さん〉。?cf=。期間は選んでいる日を含む週）。
// URL を読み書きし、相性のチップの判定に使う相性の写しを持つ。畳める欄の開け閉めも持つ
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDay } from '../components/day';
import type { DemoData } from '../contracts/data';
import {
  type ClientFilterState,
  decodeFilter,
  EMPTY_FILTER,
  encodeFilter,
  filterClients,
  filterFacts,
  knownTypes,
  resolveStaffId,
  sameFilter,
} from '../lib/clientFilter';
import { byDisplayName, byName, paramOf } from '../lib/common';
import {
  COMPAT_CHIPS,
  compatChipSets,
  compatChipTests,
  compatChipText,
  decodeStaffFilter,
  EMPTY_STAFF_FILTER,
  encodeStaffFilter,
  filterStaff,
  type StaffFilterState,
  sameStaffFilter,
  staffChipDefs,
} from '../lib/compatView';
import { dateText } from '../lib/dateText';
import { weekDates, weekDay } from '../lib/week';

export function useCompatFilters(data: DemoData) {
  const terms = data.org.terms;
  const [params, setParams] = useSearchParams();
  const clients = useMemo(() => data.clients.filter((c) => c.active).sort(byDisplayName), [data.clients]);
  const clientIds = useMemo(() => clients.map((c) => c.id), [clients]);
  const staff = useMemo(() => data.staff.filter((s) => s.active).sort(byName), [data.staff]);

  // ---- 列（〈スタッフ〉）の絞り込み（?sf=）----
  const defs = useMemo(() => staffChipDefs(data.items), [data.items]);
  const sfParam = paramOf(params, 'sf');
  const staffFilter = useMemo(() => decodeStaffFilter(sfParam, defs), [sfParam, defs]);
  const shownStaff = useMemo(() => filterStaff(staff, staffFilter, defs), [staff, staffFilter, defs]);
  const shownStaffIds = useMemo(() => shownStaff.map((s) => s.id), [shownStaff]);
  const staffIds = useMemo(() => staff.map((s) => s.id), [staff]);

  // ---- 行（〈利用者さん〉）の絞り込み（?cf=。期間は選んでいる日を含む週）----
  const { date } = useDay();
  const dates = useMemo(() => weekDates(date), [date]);
  // 週の帯は、相性のセルを押すたびに作り直さない（チップの判定に使うのは帯の担当・訪問の有無だけ。担当は訪問にある）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 相性（compat）が変わっただけでは作り直さない
  const days = useMemo(
    () => dates.map((d) => weekDay(data, d)),
    [
      dates,
      data.org,
      data.items,
      data.rules,
      data.staff,
      data.clients,
      data.visits,
      data.availability,
      data.absences,
      data.visitTypes,
      data.patterns,
      data.clientLeaves,
    ],
  );
  const cfParam = paramOf(params, 'cf');
  // この画面は休止中の人を出さないので「終了の人も出す」はいつも外す。URL に残った消えた種類の id は外す（URL も書き直す）
  const clientFilter = useMemo(
    () => knownTypes({ ...decodeFilter(cfParam, EMPTY_FILTER, COMPAT_CHIPS), showEnded: false }, data.visitTypes),
    [cfParam, data.visitTypes],
  );
  const baseFacts = useMemo(
    () =>
      filterFacts({
        days,
        clients,
        patterns: data.patterns,
        clientLeaves: data.clientLeaves,
        staff: data.staff,
        visitTypes: data.visitTypes,
      }),
    [days, clients, data.patterns, data.clientLeaves, data.visitTypes, data.staff],
  );
  /**
   * 相性のチップの判定に使う相性の写し（PRD D116）。絞り込みを変えたときの相性に止め、セルを押しても行を消さない
   * （押した行が消えて、次の人のセルを押してしまわないように）。「表を並べ直す」でいまの相性に合わせる
   */
  const filterKey = `${cfParam ?? ''}|${sfParam ?? ''}`;
  const [snap, setSnap] = useState({ key: filterKey, compat: data.compat });
  if (snap.key !== filterKey) setSnap({ key: filterKey, compat: data.compat });
  const snapCompat = snap.key === filterKey ? snap.compat : data.compat;
  const chipSets = useMemo(
    () => compatChipSets(snapCompat, clientIds, shownStaffIds, staffIds),
    [snapCompat, clientIds, shownStaffIds, staffIds],
  );
  const facts = useMemo(() => ({ ...baseFacts, extraTests: compatChipTests(chipSets) }), [baseFacts, chipSets]);
  const shownClients = useMemo(
    () => filterClients(clients, clientFilter, facts, resolveStaffId(clientFilter, staff, facts, clients)),
    [clients, clientFilter, facts, staff],
  );
  const usesCompatChips = (clientFilter.extra?.length ?? 0) > 0;
  /** 写しが古い（相性のチップを押していて、そのあとセルを押した） */
  const stale = usesCompatChips && snapCompat !== data.compat;
  /** 写しをいまの相性に合わせる（表を並べ直す） */
  const resort = () => setSnap({ key: filterKey, compat: data.compat });
  const extraChips = useMemo(
    () => COMPAT_CHIPS.map((k) => ({ key: k, ...compatChipText(k, terms.staff) })),
    [terms.staff],
  );
  const filterTerms = useMemo(() => ({ client: terms.client, staff: terms.staff }), [terms.client, terms.staff]);
  const periodLabel = `${dateText(dates[0]!)}からの週`;

  /** URL に書く（既定なら消す。履歴を増やさない） */
  const go = useCallback(
    (key: 'cf' | 'sf', value: string | null) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (value === null) p.delete(key);
          else p.set(key, value);
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );
  const setClientFilter = useCallback(
    (f: ClientFilterState) => go('cf', sameFilter(f, EMPTY_FILTER) ? null : encodeFilter(f)),
    [go],
  );
  const setStaffFilter = useCallback(
    (f: StaffFilterState) => go('sf', sameStaffFilter(f, EMPTY_STAFF_FILTER) ? null : encodeStaffFilter(f)),
    [go],
  );
  // URL に知らないチップ・項目があって捨てたら、URL も書き直す（replace）
  useEffect(() => {
    if (sfParam !== null) {
      const v = sameStaffFilter(staffFilter, EMPTY_STAFF_FILTER) ? null : encodeStaffFilter(staffFilter);
      if (v !== sfParam) go('sf', v);
    }
  }, [sfParam, staffFilter, go]);
  useEffect(() => {
    if (cfParam !== null) {
      const v = sameFilter(clientFilter, EMPTY_FILTER) ? null : encodeFilter(clientFilter);
      if (v !== cfParam) go('cf', v);
    }
  }, [cfParam, clientFilter, go]);

  // ---- 絞り込みの欄（畳める。URL に絞り込みがあるときだけ開いておく）----
  const [sfOpen, setSfOpen] = useState(() => sfParam !== null);
  const [cfOpen, setCfOpen] = useState(() => cfParam !== null);

  return {
    clients,
    staff,
    defs,
    staffFilter,
    shownStaff,
    setStaffFilter,
    clientFilter,
    facts,
    shownClients,
    setClientFilter,
    stale,
    resort,
    extraChips,
    filterTerms,
    periodLabel,
    sfOpen,
    setSfOpen,
    cfOpen,
    setCfOpen,
  };
}

/** 絞り込みの値と書き換え（欄に渡す） */
export type CompatFilters = ReturnType<typeof useCompatFilters>;
