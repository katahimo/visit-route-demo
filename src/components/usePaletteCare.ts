import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { paletteAttentionDays } from '../lib/commandPalette';
import { dayProblemOf, routesOf, visitIssues } from '../lib/dayPlan';
import { visitsOn } from '../patterns';

/** 「要対応」の語で引くときの訪問ごとの検査。careOf は訪問が要対応か、carePending は検査が終わっていない日があるか */
export function useAttentionCare(
  data: DemoData,
  query: string,
  today: string,
): { careOf: (v: Visit) => boolean; carePending: boolean } {
  /**
   * 「要対応」の語で引くときの訪問ごとの検査（PRD D337。日の予定と同じ visitIssues）。打った語に「要対応」があるときだけ、
   * 検査する日（paletteAttentionDays）を1日ずつ間を空けて計算し（描画を止めない）、終わった日から候補に出す。
   * 日ごとに覚え、データが変わったら捨てる
   */
  const careDays = useMemo(() => paletteAttentionDays(query, today), [query, today]);
  const careMemo = useMemo(() => {
    void data;
    return new Map<string, Set<string>>();
  }, [data]);
  const [careTick, setCareTick] = useState(0);
  const carePending = careDays.some((d) => !careMemo.has(d));
  useEffect(() => {
    const todo = careDays.filter((d) => !careMemo.has(d));
    if (todo.length === 0) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const step = (i: number) => {
      if (stop || i >= todo.length) return;
      const date = todo[i]!;
      if (!careMemo.has(date)) {
        const visits = visitsOn(data, date);
        const p = visits.some((x) => !x.cancelled) ? dayProblemOf(data, date) : null;
        careMemo.set(date, new Set(p ? visitIssues(p, routesOf(p, visits), visits).keys() : []));
        setCareTick((n) => n + 1);
      }
      timer = setTimeout(() => step(i + 1), 0);
    };
    timer = setTimeout(() => step(0), 0);
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [careDays, careMemo, data]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 検査が1日進む（careTick）たびに候補を作り直す
  const careOf = useCallback((v: Visit): boolean => careMemo.get(v.date)?.has(v.id) ?? false, [careMemo, careTick]);
  return { careOf, carePending };
}
