import { useMemo } from 'react';
import { useDayModel } from '../components/useDayModel';
import type { Visit } from '../contracts/documents';
import { byDisplayName } from '../lib/common';
import { staffLabels } from '../lib/monthPrint';
import { type Band, qualificationBadges, qualificationItem, staffWeekTable, type WeekDay, weekDay } from '../lib/week';
import { staffCellBands } from '../lib/weekScreen';
import { visitsOn } from '../patterns';
import type { WeekTab } from './useWeekNav';

/**
 * 週の予定（pages/WeekPage.tsx）のデータ：日ごとの帯（lib/week の weekDay）・この週の訪問・〈スタッフ〉×曜日の表と
 * マスの訪問・資格の札・担当と〈利用者さん〉の呼び方
 */
export function useWeekModel(date: string, dates: readonly string[], tab: WeekTab) {
  const dayModel = useDayModel(date);
  // 週は日をまたぐので、〈利用者さん〉の場所はその日の訪問先（住所2。ADR-0105）に置き換えず住所のまま（絞り込みの地区など）
  const clients = useMemo(() => [...dayModel.data.clients].sort(byDisplayName), [dayModel.data.clients]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const model = { ...dayModel, clients, clientById };
  const { data, compileInput, staff, staffById } = model;
  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);
  const days: WeekDay[] = useMemo(() => dates.map((d) => weekDay(compileInput, d)), [compileInput, dates]);
  const dayOf = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  /** この週の訪問（計算した繰り返しの回も。版2。ADR-0053） */
  const visitById = useMemo(
    () => new Map(dates.flatMap((d) => visitsOn(data, d)).map((v) => [v.id, v])),
    [data, dates],
  );
  const table = useMemo(() => (tab === 'table' ? staffWeekTable(compileInput, days) : null), [tab, compileInput, days]);
  /** 〈スタッフ〉×曜日の表のマスの訪問（担当・日ごと。時刻の順。表で選ぶ・キーで動かす・ドラッグする。PRD D340） */
  const bandsOf = useMemo(() => (tab === 'table' ? staffCellBands(days) : new Map<string, Band[]>()), [tab, days]);
  const qualItem = useMemo(() => qualificationItem(data.items), [data.items]);
  const badgesOf = useMemo(
    () => new Map(activeStaff.map((s) => [s.id, qualificationBadges(data.items, s)])),
    [activeStaff, data.items],
  );
  const staffName = (id: string | null) => (id ? (staffById.get(id)?.name ?? '（不明）') : '担当なし');
  /** 〈利用者さん〉の帯の下の担当の呼び方（名字。重なればフルネーム。印刷と同じ）と、読み上げのフルネーム（PRD D342） */
  const labels = useMemo(() => staffLabels(staff), [staff]);
  const markNames = {
    short: (id: string) => labels.get(id) ?? staffName(id),
    full: (id: string) => staffName(id),
  };
  const clientName = (v: Visit | undefined) => clientById.get(v?.clientId ?? '')?.displayName ?? '（不明）';
  return {
    ...model,
    terms: data.org.terms,
    activeStaff,
    days,
    dayOf,
    visitById,
    table,
    bandsOf,
    qualItem,
    badgesOf,
    staffName,
    markNames,
    clientName,
  };
}

export type WeekModel = ReturnType<typeof useWeekModel>;
