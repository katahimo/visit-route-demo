// 組み方の標準の画面の「日で見る」（PRD D350。ADR-0065）の状態：期間の日付・案のタブ（画面の外の入れ物 standardWork に置く）と、
// その日の入力。入力は案を作ったときに残した日の元（点数の基準の物差しの問題・ひな形の訪問・そのときの今の標準）と案の割当だけで作る
// （そのあとに標準を登録した・訪問を直したときも、今のデータと古い案を突き合わせない）
import { useMemo, useRef } from 'react';
import type { DemoData } from '../contracts/data';
import { scrollBehavior } from '../lib/motion';
import { type StandardWork, setDayView } from '../lib/standardDraft';
import { standardDayDate, standardDayDates, standardDayInput, standardDayOpen } from '../lib/standardView';

export function useStandardDayView(data: DemoData, work: StandardWork) {
  const ref = useRef<HTMLElement>(null);
  const dates = useMemo(
    () => standardDayDates(data.presets, work.proposals, work.dayBase),
    [data.presets, work.proposals, work.dayBase],
  );
  const date = standardDayDate(work.dayView.date, dates);
  const base = work.dayBase.find((b) => b.date === date) ?? null;
  const input = useMemo(
    () => (base ? standardDayInput(data.presets, work.proposals, base) : null),
    [data.presets, work.proposals, base],
  );
  /** カードの［日で見る］：その案のタブで開いて巻く（見ている日にその案の日が無ければ、その案の最初の日も選ぶ） */
  const open = (presetId: string) => {
    const days = work.proposals.find((p) => p.presetId === presetId)?.days ?? [];
    setDayView({ tab: presetId, date: standardDayOpen(date, days, dates) });
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() }));
  };
  return {
    ref,
    dates,
    date,
    input,
    visits: base?.visits ?? [],
    tab: work.dayView.tab,
    setDate: (d: string) => setDayView({ date: d }),
    setTab: (t: string) => setDayView({ tab: t }),
    open,
  };
}

/** useStandardDayView の返り値（日で見るの区画が受け取る） */
export type StandardDayViewState = ReturnType<typeof useStandardDayView>;
