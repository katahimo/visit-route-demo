// 予約の CSV の読み込みで、どの〈スタッフ〉の勤務日・時間にも入らない予約を数える（PRD D428。ADR-0095）。純粋関数（データは書き換えない）。
// 担当なしが残る原因が「勤務時間に入らない」ことだと、読み込む前に分かるようにする
import type { DemoData } from '../contracts/data';
import type { Staff, Visit } from '../contracts/documents';
import { afterLastDay, availabilityOf, timeText } from '../domain/availability';
import { hhmmToMinutes } from '../domain/time';
import { clockTime, dateText } from './dateText';
import { UNASSIGNED_LABELS } from './unassignedReason';

/**
 * 勤務日・時間に入らない予約の見込み（件数と、いちばん早い日の例）。dayOff はその日にだれも勤務しない（勤務日外）、
 * hours は勤務する人はいるが時間に収まらない（勤務時間外）。言葉は担当なしの組めない理由（PRD D430）とそろえる
 */
export type OutsideHours = { count: number; example: string; dayOff: number; hours: number };

/** 担当できる〈スタッフ〉：利用中で、日の最終勤務日より前（休止・最終勤務日後の人は除く） */
const canWorkOn = (s: Staff, date: string): boolean => s.active && !afterLastDay(s, date);

/** その〈スタッフ〉のその日の勤務の時間帯 */
function slotsOn(v: Visit, s: Staff, base: DemoData) {
  const override = base.availability.find((a) => a.staffId === s.id && a.date === v.date);
  return availabilityOf(s, v.date, override).slots;
}

/** その訪問が、その〈スタッフ〉のその日の勤務の時間帯のどれかに、窓（開始（早）〜（遅））と所要ごと収まるか */
function fitsStaff(v: Visit, s: Staff, base: DemoData): boolean {
  const slots = slotsOn(v, s, base);
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
  const dayOff = out.filter(
    (v) => !next.staff.some((s) => canWorkOn(s, v.date) && slotsOn(v, s, next).length > 0),
  ).length;
  return {
    count: out.length,
    example: `${dateText(first.date)}${timeText(first.earliestStart)}〜${end}`,
    dayOff,
    hours: out.length - dayOff,
  };
}

/** 確認の本文に添える1文（無ければ null）。内訳は担当なしの組めない理由と同じ言葉（勤務日外・勤務時間外。PRD D430） */
export function outsideHoursNote(o: OutsideHours | null, staffTerm: string): string | null {
  if (!o) return null;
  const parts = [
    o.dayOff > 0 ? `${UNASSIGNED_LABELS.dayOff} ${o.dayOff}` : '',
    o.hours > 0 ? `${UNASSIGNED_LABELS.hours} ${o.hours}` : '',
  ].filter(Boolean);
  const fix = [o.dayOff > 0 ? '勤務する曜日' : '', o.hours > 0 ? '勤務時間' : ''].filter(Boolean).join('・');
  return `${o.count}件はどの${staffTerm}の勤務日・時間にも入りません（${parts.join('・')}。例：${o.example}）。${staffTerm}の${fix}を広げると組めます`;
}
