// 予定の上の要対応の帯（PRD D383・D391）の中身：今日から翌月末まで（bandDays。自動の組みの範囲）の日ごとの状態
// （月の画面と同じ数え方。useDayStatuses）から、lib/attentionBand が担当なし・重なり・休みの人の件数を数える。
// エキスパート機能が入のときは、確定（伝えた）がまだの日・組み直しの知らせ・組み方の標準が無いも足す
import { useMemo } from 'react';
import { jstDate } from '../domain/time';
import { type AttentionBand, attentionBand, bandDays } from '../lib/attentionBand';
import { isHrefOn, isOn } from '../lib/features';
import { planYm } from '../lib/scheduleMode';
import { hasStandard } from '../lib/standard';
import { useDemoData } from '../store';
import { useBasisChanged } from './useArrangeBasis';
import { useCompileInput } from './useDayModel';
import { useDayStatuses } from './useDayStatuses';

/** 要対応の帯の中身（無ければ null） */
export function useAttentionBand(): AttentionBand | null {
  const { data } = useDemoData();
  const today = jstDate(Date.now());
  const compileInput = useCompileInput(data);
  const days = useMemo(() => bandDays(today), [today]);
  const perDay = useDayStatuses(data, compileInput, days);
  const basisChanged = useBasisChanged(data);
  const expert = isOn(data.org.features, 'expert');
  return useMemo(() => {
    // 最初の訪問を開始の早い順で選ぶための、訪問 ID → 最早開始（分）
    const start = new Map<string, number>();
    for (const d of days) for (const v of perDay.get(d)?.problem?.visits ?? []) start.set(v.id, v.earliest);
    return attentionBand(
      days.flatMap((d) => perDay.get(d)?.status ?? []),
      today,
      (id) => start.get(id) ?? null,
      expert
        ? {
            hasStandard: hasStandard(data),
            basisChanged,
            planYm: planYm(today),
            isOn: (href) => isHrefOn(data.org.features, href),
          }
        : undefined,
    );
  }, [days, perDay, today, expert, data, basisChanged]);
}
