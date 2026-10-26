// 組み方の標準の画面の「日で見る」（PRD D350。ADR-0065）の状態：期間の日付・案のタブ（画面の外の入れ物 standardWork に置く）と、
// その日の入力（点数の基準の物差しの問題・今の標準・案ごとの割当）
import { useMemo, useRef } from 'react';
import type { DemoData } from '../contracts/data';
import { scrollBehavior } from '../lib/motion';
import { standardDayVisits } from '../lib/standard';
import { type StandardWork, setDayView, templateScoreProblem } from '../lib/standardDraft';
import { standardDayDate, standardDayDates, standardDayInput } from '../lib/standardView';

export function useStandardDayView(data: DemoData, work: StandardWork) {
  const ref = useRef<HTMLElement>(null);
  const dates = useMemo(() => standardDayDates(work.proposals), [work.proposals]);
  const date = standardDayDate(work.dayView.date, dates);
  const scoreProblem = useMemo(() => (date ? templateScoreProblem(data, date) : null), [data, date]);
  const input = useMemo(
    () => (date ? standardDayInput(data, work.proposals, date, scoreProblem) : null),
    [data, work.proposals, date, scoreProblem],
  );
  const visits = useMemo(() => (date ? standardDayVisits(data, date) : []), [data, date]);
  /** カードの［日で見る］：その案のタブで開いて巻く */
  const open = (presetId: string) => {
    setDayView({ tab: presetId });
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() }));
  };
  return {
    ref,
    dates,
    date,
    input,
    visits,
    tab: work.dayView.tab,
    setDate: (d: string) => setDayView({ date: d }),
    setTab: (t: string) => setDayView({ tab: t }),
    open,
  };
}

/** useStandardDayView の返り値（日で見るの区画が受け取る） */
export type StandardDayViewState = ReturnType<typeof useStandardDayView>;
