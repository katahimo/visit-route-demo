// 〈利用者さん〉一覧の絞り込みと移り先（PRD D108〜D112・D308）：選んでいる日を含む週の事実で絞る・いない人の画面から
// 移ってきたら知らせる・`?id=` で開いたらその人の画面へ
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDay } from '../components/day';
import { useToast } from '../components/Toast';
import {
  activeFilterCount,
  EMPTY_FILTER,
  filterClients,
  filterFacts,
  knownTypes,
  resolveStaffId,
} from '../lib/clientFilter';
import { byDisplayName, byName } from '../lib/common';
import { dateText } from '../lib/dateText';
import { usualStaffMap } from '../lib/usualStaff';
import { weekDates, weekDay } from '../lib/week';
import { useDemoData } from '../store';

export function useClientsList() {
  const { data } = useDemoData();
  const terms = data.org.terms;
  const clients = useMemo(() => [...data.clients].sort(byDisplayName), [data.clients]);
  const staff = useMemo(() => [...data.staff].sort(byName), [data.staff]);
  /**
   * 一覧の絞り込み（PRD D108〜D112。ClientFilter。画面の状態）：名前・よみ・地区・チップ（AND）・終了の人も出す。
   * チップの期間は選んでいる日を含む週（月〜日。週間の weekDay で、案・確定の判定も週間と同じ）
   */
  const { date } = useDay();
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);
  const dates = useMemo(() => weekDates(date), [date]);
  const days = useMemo(() => dates.map((d) => weekDay(data, d)), [data, dates]);
  const facts = useMemo(
    () =>
      filterFacts({
        days,
        clients,
        patterns: data.patterns,
        clientLeaves: data.clientLeaves,
        staff,
        visitTypes: data.visitTypes,
      }),
    [days, clients, data.patterns, data.clientLeaves, data.visitTypes, staff],
  );
  const shown = useMemo(
    () => filterClients(clients, filter, facts, resolveStaffId(filter, activeStaff, facts, clients)),
    [clients, filter, facts, activeStaff],
  );
  // 消えた種類を押したままでも数えない（今ある種類で絞る）
  const filterCount = activeFilterCount(knownTypes(filter, data.visitTypes));
  const periodLabel = `${dateText(dates[0]!)}からの週`;
  /** いつもの担当（繰り返しの担当。版2） */
  const usualMap = useMemo(() => usualStaffMap(data.patterns, date), [data.patterns, date]);

  // ?id= で開いたら（古いリンク・ブックマーク）、その人の画面（`#/clients/:id`）へ移る（PRD D308。いない人なら URL から消すだけ）
  const navigate = useNavigate();
  // いない人の画面（`/clients/:id`）から移ってきたときは知らせる（state.missing。1回だけ）
  const toastMissing = useToast();
  const location = useLocation();
  const missing = (location.state as { missing?: string } | null)?.missing;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 移ってきたときだけ
  useEffect(() => {
    if (!missing) return;
    toastMissing(`その${terms.client}は見つかりません（消されたか、URL が違います）`);
    navigate(location.pathname, { replace: true, state: null });
  }, [missing]);
  const [params, setParams] = useSearchParams();
  const openId = params.get('id');
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の id が変わったときだけ
  useEffect(() => {
    if (openId === null) return;
    if (data.clients.some((x) => x.id === openId)) {
      navigate(`/clients/${encodeURIComponent(openId)}`, { replace: true });
      return;
    }
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('id');
        return p;
      },
      { replace: true },
    );
  }, [openId]);

  return { data, clients, staff, activeStaff, filter, setFilter, facts, shown, filterCount, periodLabel, usualMap };
}
