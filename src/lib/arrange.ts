// 担当を組む画面（#/arrange）のための純粋関数：範囲の読み取り・見込み時間・担当なしと要対応の数え方

import { isDate } from './isDate';
import type { BatchSource } from './monthBatch';
import { planYm } from './scheduleMode';
import { weekStart } from './week';
import { isYm, ymOf } from './ym';

/** 1日あたりの見込み（秒）：1日 約3〜5秒 */
const SEC_MIN = 3;
const SEC_MAX = 5;

/** 組む日数の見込み時間の文（「約3〜5秒」「約1〜2分」） */
export function etaText(days: number): string {
  const lo = days * SEC_MIN;
  const hi = days * SEC_MAX;
  if (hi < 60) return `約${lo}〜${hi}秒`;
  return `約${Math.max(1, Math.round(lo / 60))}〜${Math.ceil(hi / 60)}分`;
}

/**
 * URL から範囲を読む：?date=（日）・?d=（週。その日の週）・?ym=（月）の順。無ければ月（月の後半なら来月、前半なら今月）
 */
export function scopeOf(params: URLSearchParams, today: string): { scope: BatchSource; ym: string; at: string } {
  const day = params.get('date');
  if (day && isDate(day)) return { scope: 'day', ym: ymOf(day), at: day };
  const week = params.get('d');
  if (week && isDate(week)) return { scope: 'week', ym: ymOf(week), at: weekStart(week) };
  const ym = params.get('ym');
  const m = ym && isYm(ym) ? ym : planYm(today);
  return { scope: 'month', ym: m, at: m === ymOf(today) ? today : `${m}-01` };
}

/** 範囲の今日以降の担当なし・要対応の数（日の状態の数え方。月の予定と同じ） */
export function rangeCounts(
  dates: readonly string[],
  statuses: ReadonlyMap<string, { status: { unassigned: number; care: number } }>,
  today: string,
): { unassigned: number; unassignedDays: number; care: number } {
  let unassigned = 0;
  let unassignedDays = 0;
  let care = 0;
  for (const d of dates) {
    if (d < today) continue;
    const s = statuses.get(d)?.status;
    if (!s) continue;
    unassigned += s.unassigned;
    if (s.unassigned > 0) unassignedDays++;
    care += s.care;
  }
  return { unassigned, unassignedDays, care };
}
