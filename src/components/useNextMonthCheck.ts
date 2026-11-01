// 来月の確認（PRD D413。ADR-0081）の中身：エキスパート機能が切で月の20日以降なら、来月の日ごとの状態（要対応の帯・月の画面と同じ数え方。
// useDayStatuses）から lib/nextMonthCheck が件数と担当なし・重なり・休みの人を数える。閉じたかは端末に覚える（store/navOpen の鍵 nextMonth:<今月>。
// データ・書き出しには入れない）
import { useMemo, useSyncExternalStore } from 'react';
import { jstDate } from '../domain/time';
import { isOn } from '../lib/features';
import { type NextMonthCheck, nextMonthCheck, nextMonthCheckKey, nextMonthTarget } from '../lib/nextMonthCheck';
import { monthDates } from '../lib/ym';
import { navOpenMemory, useDemoData } from '../store';
import { useCompileInput } from './useDayModel';
import { useDayStatuses } from './useDayStatuses';

/** 来月の確認の中身と閉じる（出さないときは null） */
export function useNextMonthCheck(): { check: NextMonthCheck; close: () => void } | null {
  const { data } = useDemoData();
  const today = jstDate(Date.now());
  const stored = useSyncExternalStore(navOpenMemory.subscribe, navOpenMemory.read, navOpenMemory.cached);
  const ym = nextMonthTarget(today, isOn(data.org.features, 'expert'), stored);
  const compileInput = useCompileInput(data);
  // 出さないときは日を渡さない（計算しない）
  const days = useMemo(() => (ym ? monthDates(ym) : []), [ym]);
  const perDay = useDayStatuses(data, compileInput, days);
  const check = useMemo(
    () =>
      ym
        ? nextMonthCheck(
            days.flatMap((d) => perDay.get(d)?.status ?? []),
            ym,
          )
        : null,
    [ym, days, perDay],
  );
  if (!check) return null;
  return { check, close: () => navOpenMemory.write(nextMonthCheckKey(today), false) };
}
