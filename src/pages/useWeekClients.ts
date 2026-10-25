import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ClientFilterState,
  decodeFilter,
  encodeFilter,
  type FilterFacts,
  filterClients,
  filterFacts,
  knownTypes,
  resolveStaffId,
  sameFilter,
  WEEK_TABLE_FILTER,
} from '../lib/clientFilter';
import { colorOf } from '../lib/colors';
import {
  clientParamOf,
  handoffFromTable,
  TIMELINE_CLIENT_MAX,
  timelineChipIds,
  timelineSelection,
} from '../lib/timelineClients';
import { clientWeekTable } from '../lib/week';
import { timelineClientMaxText } from '../lib/weekScreen';
import { isTimeline, type WeekView, weekViewParams } from '../lib/weekView';
import type { WeekModel } from './useWeekModel';
import type { WeekNav } from './useWeekNav';

/**
 * チップで8人を超えて選ぼうとしたときの文（PRD D138）。announce で出す（同じ文でも読み上げ直すよう、いったん空にしてから
 * 入れ直す）。選択・週・見る人が変わったら消す（戻るボタンで URL が変わったときも）
 */
function useChipMessage(clientParam: string | null, anchor: string, by: string) {
  const [chipMessage, setChipMessage] = useState<string | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = (text: string | null) => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = null;
    setChipMessage(null);
    if (text !== null) messageTimer.current = setTimeout(() => setChipMessage(text), 60);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の値が変わったときだけ
  useEffect(() => {
    announce(null);
  }, [clientParam, anchor, by]);
  useEffect(
    () => () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    },
    [],
  );
  return { chipMessage, announce };
}

/** 〈利用者さん〉×曜日の表の絞り込み（PRD D108〜D112。?cf=）と行（表のときだけ） */
function useClientTable(model: WeekModel, nav: WeekNav, facts: FilterFacts) {
  const { data, days, clients, activeStaff } = model;
  const { tab, cfParam, go } = nav;
  // URL に残った消えた種類の id は外す（今ある種類で絞る）
  const tableFilter = useMemo(
    () => knownTypes(decodeFilter(cfParam, WEEK_TABLE_FILTER), data.visitTypes),
    [cfParam, data.visitTypes],
  );
  /** 表の行の〈利用者さん〉：絞り込みに当てはまる人（表示名の順。表のときだけ。時間軸へ移るときの引き継ぎにも使う） */
  const filteredClients = useMemo(() => {
    if (tab !== 'clients') return [];
    const sid = resolveStaffId(tableFilter, activeStaff, facts, clients);
    return filterClients(clients, tableFilter, facts, sid);
  }, [tab, tableFilter, activeStaff, facts, clients]);
  const clientRows = useMemo(
    () =>
      tab === 'clients'
        ? filteredClients.length === 0
          ? []
          : clientWeekTable(
              data,
              days,
              filteredClients.map((c) => c.id),
            )
        : null,
    [tab, data, days, filteredClients],
  );

  /** 表の絞り込みを URL に書く（既定なら消す。文字を打つたびに履歴を増やさない） */
  const setTableFilter = (f: ClientFilterState) =>
    go({ cf: sameFilter(f, WEEK_TABLE_FILTER) ? null : encodeFilter(f) }, true);
  return { tableFilter, setTableFilter, filteredClients, clientRows };
}

/**
 * 週の予定の〈利用者さん〉の選び方：時間軸のチップ（PRD D136〜D139。?client=。8人まで・上限の文）と、
 * 〈利用者さん〉×曜日の表の絞り込み（PRD D108〜D112。?cf=）、表示の切り替え（表から時間軸へ移るときの引き継ぎ）
 */
export function useWeekClients(model: WeekModel, nav: WeekNav) {
  const { data, days, clients, staff, clientById, terms } = model;
  const { tab, by, view, narrow, anchor, clientParam, clientSel, go } = nav;
  /**
   * 絞り込みの集まり（PRD D112）：この週に訪問がある人・担当が決まっていない訪問がある人・休み・定期パターン・
   * 〈スタッフ〉が担当する人（この週の帯の担当といつもの担当）など。時間軸の検索欄の近道もここから引く
   */
  const facts = useMemo(
    () =>
      filterFacts({
        days,
        clients,
        patterns: data.patterns,
        clientLeaves: data.clientLeaves,
        staff,
        // この週に訪問がある人は終了でも表に出す（その訪問をドラッグできるように。PRD D111）
        showEndedInPeriod: true,
        visitTypes: data.visitTypes,
      }),
    [days, clients, data.patterns, data.clientLeaves, data.visitTypes, staff],
  );
  const { tableFilter, setTableFilter, filteredClients, clientRows } = useClientTable(model, nav, facts);
  /** この週に（取り消しでない）訪問がある〈利用者さん〉（検索欄の近道「この週に訪問がある人」） */
  const weekClientIds = facts.periodIds;
  /** 検索欄の候補の〈利用者さん〉：利用中の人と、休止中でもこの週に訪問がある人 */
  const weekClients = useMemo(
    () => clients.filter((c) => c.active || weekClientIds.has(c.id)),
    [clients, weekClientIds],
  );
  /** 〈スタッフ〉が担当する〈利用者さん〉（近道）：この週の帯の担当と、いつもの担当 */
  const clientsOfStaff = useCallback((sid: string) => facts.staffClientIds(sid), [facts]);
  /** 時間軸のチップに並べる人の元：この週に訪問がある人（表の既定の絞り込みと同じ人・同じ順。PRD D136） */
  const weekChipIds = useMemo(
    () => filterClients(clients, WEEK_TABLE_FILTER, facts, '').map((c) => c.id),
    [clients, facts],
  );
  /**
   * 選んでいる〈利用者さん〉（候補にいる人だけ）。?client= が無ければこの週の先頭8人（初期値。PRD D137）、
   * 空なら選んでいない
   */
  const selection = useMemo(
    () => timelineSelection(clientSel, weekChipIds, new Set(weekClients.map((c) => c.id))),
    [clientSel, weekChipIds, weekClients],
  );
  const pickedClients = selection.ids;
  /** 時間軸に出す〈利用者さん〉：選んだ順に8人まで（URL で9人以上渡されたとき。チップの✓もこの8人） */
  const timelineClients = useMemo(() => pickedClients.slice(0, TIMELINE_CLIENT_MAX), [pickedClients]);
  /** 時間軸のチップの人：この週に訪問がある人のあとに、「ほかの人を探す」で選んだ人 */
  const chipPeople = useMemo(
    () =>
      timelineChipIds(weekChipIds, timelineClients).flatMap((id) => {
        const c = clientById.get(id);
        return c ? [{ id: c.id, name: c.displayName, color: colorOf(c.color) }] : [];
      }),
    [weekChipIds, timelineClients, clientById],
  );
  /** チップの欄を開いているか（「あと N人」。この画面の中だけで覚える。PRD D140） */
  const [chipsOpen, setChipsOpen] = useState(false);
  const { chipMessage, announce } = useChipMessage(clientParam, anchor, by);
  /**
   * 表示を切り替える（PRD D188）。表から時間軸へ移るとき、?client= が無く表で絞り込んでいれば、表で絞り込んだ人の
   * うち時間軸に出せる人（検索欄の候補 weekClients にいる人）の先頭8人を引き継ぐ。絞り込んでいなければ書かない＝この週の先頭8人
   * （PRD D139。lib/timelineClients）
   */
  const goView = (v: WeekView) => {
    if (v === view) return;
    const next: Record<string, string | null> = { ...weekViewParams(v, narrow) };
    // 表から時間軸（〈スタッフ〉・〈利用者さん〉どちらでも）へ移るときに書く（main と同じ。〈スタッフ〉の時間軸から
    // 〈利用者さん〉に切り替えたときも引き継がれる。PR #44 のレビュー）
    if (tab === 'clients' && isTimeline(v)) {
      const known = new Set(weekClients.map((c) => c.id));
      const handoff = handoffFromTable({
        hasParam: clientParam !== null,
        filtered: !sameFilter(tableFilter, WEEK_TABLE_FILTER),
        filteredIds: filteredClients.filter((c) => known.has(c.id)).map((c) => c.id),
        weekIds: weekChipIds,
      });
      if (handoff !== null) next.client = handoff;
    }
    go(next);
  };
  /** 時間軸の〈利用者さん〉を選び直す（初期値と同じ人なら ?client= を消す。PRD D137） */
  const setTimelineClients = (ids: string[]) => {
    announce(null);
    go({ client: clientParamOf(ids, weekChipIds) });
  };
  /** チップを押したとき（PickChips は全員を選ぶと null を返す）。8人を超えるなら選ばずに上限の文を出す（PRD D138） */
  const onClientChips = (next: string[] | null) => {
    const ids = next ?? chipPeople.map((p) => p.id);
    if (ids.length > timelineClients.length && ids.length > TIMELINE_CLIENT_MAX) {
      announce(timelineClientMaxText(terms.client));
      return;
    }
    setTimelineClients(ids);
  };
  /** 全部外す：この週に訪問が0人でも、外したことを ?client= の空で残す（週を送っても先頭8人に戻さない） */
  const clearClients = () => {
    announce(null);
    go({ client: '' });
  };
  /** 先頭8人に戻す */
  const resetClients = () => {
    announce(null);
    go({ client: null });
  };
  return {
    tableFilter,
    setTableFilter,
    facts,
    weekClients,
    clientsOfStaff,
    weekChipIds,
    pickedClients,
    timelineClients,
    chipPeople,
    chipsOpen,
    setChipsOpen,
    chipMessage,
    /** 「先頭8人に戻す」を押せないか（初期値のまま・初期値と同じ人） */
    resetDisabled: selection.isDefault || clientParamOf(pickedClients, weekChipIds) === null,
    clientRows,
    goView,
    setTimelineClients,
    onClientChips,
    clearClients,
    resetClients,
  };
}

export type WeekClients = ReturnType<typeof useWeekClients>;
