// 予定の上の要対応の帯（PRD D400・D403・D404）の中身：今日から翌月末まで（bandDays。自動の組みの範囲）の日ごとの状態
// （月の画面と同じ数え方。useDayStatuses）から、lib/attentionBand が担当なし・間に合わない・重なり・休みの人の件数を数える。
// エキスパート機能が入のときは、確定（伝えた）がまだの日・組み直しの知らせ・組み方の標準が無いも足す
import { useMemo } from 'react';
import { jstDate } from '../domain/time';
import { type AttentionBand, attentionBand, bandDays } from '../lib/attentionBand';
import { isHrefOn, isOn } from '../lib/features';
import { planYm } from '../lib/scheduleMode';
import { hasStandard } from '../lib/standard';
import { reasonBreakdown, unassignedAcross } from '../lib/unassignedReason';
import { visitsOn } from '../patterns';
import { useDemoData } from '../store';
import { useBasisChanged } from './useArrangeBasis';
import { useCompileInput } from './useDayModel';
import { useDayStatuses } from './useDayStatuses';

/** 要対応の帯の中身と、担当なしの訪問の組めない理由の内訳（「勤務時間外 6・勤務日外 5」。担当なしが無ければ空。PRD D430） */
export type AttentionBandView = AttentionBand & { why: string };

/** 要対応の帯の中身（無ければ null） */
export function useAttentionBand(): AttentionBandView | null {
  const { data } = useDemoData();
  const today = jstDate(Date.now());
  const compileInput = useCompileInput(data);
  const days = useMemo(() => bandDays(today), [today]);
  const perDay = useDayStatuses(data, compileInput, days);
  const basisChanged = useBasisChanged(data);
  const expert = isOn(data.org.features, 'expert');
  const band = useMemo(() => {
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
  // 担当なしの訪問の組めない理由の内訳（帯の担当なしの訪問だけ。日ごとの問題と今の担当の列から）
  const why = useMemo(() => {
    if (!band || band.counts.unassigned === 0) return '';
    const byDay = new Map<string, string[]>();
    for (const v of band.visits) if (!v.attend) byDay.set(v.date, [...(byDay.get(v.date) ?? []), v.visitId]);
    const list = [...byDay].map(([date, ids]) => ({
      problem: perDay.get(date)?.problem ?? null,
      visits: visitsOn(compileInput, date),
      ids,
    }));
    return reasonBreakdown(unassignedAcross(list, data.org.terms).values());
  }, [band, perDay, compileInput, data.org.terms]);
  return band ? { ...band, why } : null;
}
