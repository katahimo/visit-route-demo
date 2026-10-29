// ホームの「次にすること」と「いつでも」の入口（PRD D141〜D145・D213。ADR-0025・0044）：
// 日の状態は月の画面と同じ数え方（useDayStatuses）。並びと文は lib/home の homeTasks・homeEntries
import { useMemo } from 'react';
import { useCompileInput } from '../components/useDayModel';
import { useDayStatuses } from '../components/useDayStatuses';
import type { DemoData } from '../contracts/data';
import { autoRange, targetCount, unassignedTargets } from '../lib/autoArrange';
import { homeDays, homeEntries, homeMonths, homeTasks, routedStaffCount } from '../lib/home';
import { dayPlanOf } from '../lib/month';

export function useHomeTasks(data: DemoData, today: string) {
  // compile が読むデータだけ（今日の問題は useDayStatuses が案のある日だけ作るので、ここでは compile しない）
  const compileInput = useCompileInput(data);
  const terms = data.org.terms;
  const days = useMemo(() => homeDays(today), [today]);
  const perDay = useDayStatuses(data, compileInput, days);
  const months = useMemo(() => homeMonths(today).map((ym) => ({ ym })), [today]);
  // 担当なしの訪問の数（今日〜翌月末。エキスパート機能が切のときの［組む］のカード）
  const autoCount = useMemo(() => targetCount(unassignedTargets(data, today, autoRange(today))), [data, today]);
  const { tasks, ready } = useMemo(() => {
    const statuses = days.flatMap((d) => perDay.get(d)?.status ?? []);
    const todayPlan = dayPlanOf(data, today, perDay.get(today)?.problem ?? null);
    const todayStaff = routedStaffCount(todayPlan.routes);
    return homeTasks({ today, statuses, months, todayStaff, data, features: data.org.features, autoCount });
  }, [days, perDay, months, data, today, autoCount]);
  const entries = useMemo(() => homeEntries(today, terms, data.org.features), [today, terms, data.org.features]);
  return { tasks, ready, entries };
}
