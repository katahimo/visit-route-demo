// 予定の上の要対応の帯（エキスパート機能が切のとき。PRD D383）の中身：今日から翌月末まで（bandDays。自動の組みの範囲）の日ごとの状態
// （月の画面と同じ数え方。useDayStatuses）から、lib/attentionBand が担当なし・重なり・休みの人の件数を数える
import { useMemo } from 'react';
import { jstDate } from '../domain/time';
import { type AttentionBand, attentionBand, bandDays } from '../lib/attentionBand';
import { isSimpleMenu } from '../lib/nav';
import { useDemoData } from '../store';
import { useCompileInput } from './useDayModel';
import { useDayStatuses } from './useDayStatuses';

/** エキスパート機能が入のときは見る日を空にする（帯を出さないので数えない） */
const NONE: readonly string[] = [];

/** 要対応の帯の中身（無ければ・エキスパート機能が入なら null） */
export function useAttentionBand(): AttentionBand | null {
  const { data } = useDemoData();
  const simple = isSimpleMenu(data.org.features);
  const today = jstDate(Date.now());
  const compileInput = useCompileInput(data);
  const days = useMemo(() => (simple ? bandDays(today) : NONE), [simple, today]);
  const perDay = useDayStatuses(data, compileInput, days);
  return useMemo(() => {
    if (!simple) return null;
    // 最初の訪問を開始の早い順で選ぶための、訪問 ID → 最早開始（分）
    const start = new Map<string, number>();
    for (const d of days) for (const v of perDay.get(d)?.problem?.visits ?? []) start.set(v.id, v.earliest);
    return attentionBand(
      days.flatMap((d) => perDay.get(d)?.status ?? []),
      today,
      (id) => start.get(id) ?? null,
    );
  }, [simple, days, perDay, today]);
}
