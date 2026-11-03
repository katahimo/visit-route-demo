// 予約の CSV の読み込みで、どの〈スタッフ〉の勤務日・時間にも入らない予約を数える（PRD D428。ADR-0095）。純粋関数（データは書き換えない）。
// 担当なしが残る原因が「勤務時間に入らない」ことだと、読み込む前に分かるようにする
import type { DemoData } from '../contracts/data';
import type { Staff, Visit } from '../contracts/documents';
import { afterLastDay, availabilityOf, timeText } from '../domain/availability';
import { hhmmToMinutes } from '../domain/time';
import { clockTime, dateText } from './dateText';

/** 勤務日・時間に入らない予約の見込み（件数と、いちばん早い日の例） */
export type OutsideHours = { count: number; example: string };

/** 担当できる〈スタッフ〉：利用中で、日の最終勤務日より前（休止・最終勤務日後の人は除く） */
const canWorkOn = (s: Staff, date: string): boolean => s.active && !afterLastDay(s, date);

/** その訪問が、その〈スタッフ〉のその日の勤務の時間帯のどれかに、窓（開始（早）〜（遅））と所要ごと収まるか */
function fitsStaff(v: Visit, s: Staff, base: DemoData): boolean {
  const override = base.availability.find((a) => a.staffId === s.id && a.date === v.date);
  const { slots } = availabilityOf(s, v.date, override);
  const earliest = hhmmToMinutes(v.earliestStart);
  const latest = hhmmToMinutes(v.latestStart);
  return slots.some(
    (sl) => Math.max(earliest, hhmmToMinutes(sl.start)) <= Math.min(latest, hhmmToMinutes(sl.end) - v.durationMinutes),
  );
}

/**
 * 読み込みで足した・変えた予約（next の訪問のうち base と違うもの）のうち、どの〈スタッフ〉の勤務にも入らないもの。
 * 取り消した予約は数えない。利用中の〈スタッフ〉がいなければ null（勤務時間の話ではないので）。無ければ null
 */
export function bookingsOutsideHours(base: DemoData, next: DemoData): OutsideHours | null {
  if (!next.staff.some((s) => s.active)) return null;
  const before = new Map(base.visits.map((v) => [v.id, JSON.stringify(v)]));
  const out = next.visits
    .filter((v) => !v.cancelled && before.get(v.id) !== JSON.stringify(v))
    .filter((v) => !next.staff.some((s) => canWorkOn(s, v.date) && fitsStaff(v, s, next)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.earliestStart.localeCompare(b.earliestStart));
  const first = out[0];
  if (!first) return null;
  const end = clockTime(hhmmToMinutes(first.earliestStart) + first.durationMinutes);
  return { count: out.length, example: `${dateText(first.date)}${timeText(first.earliestStart)}〜${end}` };
}

/** 確認の本文に添える1文（無ければ null） */
export const outsideHoursNote = (o: OutsideHours | null, staffTerm: string): string | null =>
  o
    ? `${o.count}件はどの${staffTerm}の勤務日・時間にも入りません（例：${o.example}）。${staffTerm}の勤務時間を広げると組めます`
    : null;
