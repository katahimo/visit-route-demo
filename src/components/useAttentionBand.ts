// 予定の上の要対応の帯（エキスパート機能が切のとき。PRD D383）の中身：今日から（ホームが見ていた）月末までの日ごとの状態
// （月の画面と同じ数え方。useDayStatuses）から、lib/attentionBand が担当なし・重なり・休みの人の件数を数える
import { useMemo } from 'react';
import { jstDate } from '../domain/time';
import { type AttentionBand, attentionBand } from '../lib/attentionBand';
import { homeDays } from '../lib/home';
import { isSimpleMenu } from '../lib/nav';
import { useDemoData } from '../store';
import { useCompileInput } from './useDayModel';
import { useDayStatuses } from './useDayStatuses';

/** 見る日（今日〜月末。月の半ばからは来月末まで。lib/home の homeDays）がエキスパート機能が入のときは見ない（帯を出さないので数えない） */
const NONE: readonly string[] = [];

/** 要対応の帯の中身（無ければ・エキスパート機能が入なら null） */
export function useAttentionBand(): AttentionBand | null {
  const { data } = useDemoData();
  const simple = isSimpleMenu(data.org.features);
  const today = jstDate(Date.now());
  const compileInput = useCompileInput(data);
  const days = useMemo(() => (simple ? homeDays(today) : NONE), [simple, today]);
  const perDay = useDayStatuses(data, compileInput, days);
  return useMemo(
    () =>
      simple
        ? attentionBand(
            days.flatMap((d) => perDay.get(d)?.status ?? []),
            today,
          )
        : null,
    [simple, days, perDay, today],
  );
}
