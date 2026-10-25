// 写した元：katahimo-dev/visit-route-poc @ a46e7db packages/shared/src/domain/availability.ts
import {
  END_AFTER_START_ERROR,
  HALF_HOUR_ERROR,
  isHalfHour,
  MAX_SLOTS,
  SLOT_STEP_MINUTES,
  type Slot,
  slotsError,
} from '../contracts/slots';
import { hhmmToMinutes, minutesToHhmm, weekday } from './time';

/**
 * スタッフの稼働時間帯（ADR-0008）。基本の曜日と時間に、日ごとの上書きを重ねる。
 * 「その日に働ける時間帯」を決めるのはこのファイルだけ（画面・予定の警告・AI案で同じものを使う）。
 */

// 時間帯の型・上限・30分単位・検査は contracts/slots.ts（contracts の検査と共有するため）。画面は今までどおりここから import する
export { END_AFTER_START_ERROR, HALF_HOUR_ERROR, isHalfHour, MAX_SLOTS, SLOT_STEP_MINUTES, type Slot, slotsError };

/**
 * 基本の曜日と時間。lastDay（最終勤務日。デモで足した。PRD D71・ADR-0015）があれば、その翌日からは勤務なし
 */
type WeeklyBase = { workDays: number[]; shiftStart: string; shiftEnd: string; lastDay?: string | null };

/** 最終勤務日の後の日か（デモで足した。ADR-0015） */
export function afterLastDay(base: { lastDay?: string | null }, date: string): boolean {
  return base.lastDay !== undefined && base.lastDay !== null && date > base.lastDay;
}

/** 基本の曜日と時間から、その日の時間帯（勤務日でなければ空） */
export function weeklySlots(base: WeeklyBase, date: string): Slot[] {
  return base.workDays.includes(weekday(date)) ? [{ start: base.shiftStart, end: base.shiftEnd }] : [];
}

/**
 * その日の時間帯。上書き（availability 文書）があればそれ、無ければ基本。
 * override の slots が空なら「その日は休み」。最終勤務日の後（デモで足した。ADR-0015）は上書きがあっても空
 */
export function availabilityOf(
  base: WeeklyBase,
  date: string,
  override: { slots: Slot[] } | null | undefined,
): { slots: Slot[]; overridden: boolean } {
  if (afterLastDay(base, date)) return { slots: [], overridden: false };
  return override ? { slots: override.slots, overridden: true } : { slots: weeklySlots(base, date), overridden: false };
}

/** 時刻の表示（先頭の0を落とす：09:00 → 9:00）。デモで1か所にまとめた */
export function timeText(hhmm: string): string {
  return hhmm.replace(/^0(\d)/, '$1');
}

/** 開始の順に並べ、くっついた・重なった時間帯をまとめる */
export function normalizeSlots(slots: Slot[]): Slot[] {
  const sorted = [...slots].sort((x, y) => x.start.localeCompare(y.start));
  const out: Slot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) {
      if (s.end > last.end) last.end = s.end;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

/** 30分単位に丸める（開始は切り捨て、終了は切り上げ）。30分単位でない基本の時間から下書きを作るとき用 */
export function toHalfHours(slots: Slot[]): Slot[] {
  const step = SLOT_STEP_MINUTES;
  const last = 24 * 60 - step;
  return normalizeSlots(
    slots.map((s) => ({
      start: minutesToHhmm(Math.floor(hhmmToMinutes(s.start) / step) * step),
      end: minutesToHhmm(Math.min(last, Math.ceil(hhmmToMinutes(s.end) / step) * step)),
    })),
  ).filter((s) => s.start < s.end);
}

/** 分の区間 [start, end) が、どれか1つの時間帯の中に収まるか */
export function withinSlots(slots: Slot[], startMinutes: number, endMinutes: number): boolean {
  return slots.some((s) => hhmmToMinutes(s.start) <= startMinutes && endMinutes <= hhmmToMinutes(s.end));
}

/** 表示用：「9:00〜18:00」「9:00〜12:00・14:00〜18:00」「休み」 */
export function slotsText(slots: Slot[]): string {
  if (slots.length === 0) return '休み';
  return slots.map((s) => `${timeText(s.start)}〜${timeText(s.end)}`).join('・');
}

/**
 * 稼働時間帯から欠勤を差し引く（デモ独自。PoC本体には無い。ADR-0011）。
 * from が null＝始業から、to が null＝終業まで（両方 null＝終日で空になる）。
 * 結果は開始の順・重なりなし・長さ0の時間帯なし。保存しない値なので MAX_SLOTS の検査はしない
 */
export function withoutAbsences(slots: Slot[], absences: { from: string | null; to: string | null }[]): Slot[] {
  let cur = normalizeSlots(slots).map((x) => ({ start: hhmmToMinutes(x.start), end: hhmmToMinutes(x.end) }));
  for (const a of absences) {
    const from = a.from === null ? Number.NEGATIVE_INFINITY : hhmmToMinutes(a.from);
    const to = a.to === null ? Number.POSITIVE_INFINITY : hhmmToMinutes(a.to);
    if (!(from < to)) continue;
    const next: { start: number; end: number }[] = [];
    for (const x of cur) {
      if (to <= x.start || x.end <= from) {
        next.push(x);
        continue;
      }
      if (x.start < from) next.push({ start: x.start, end: from });
      if (to < x.end) next.push({ start: to, end: x.end });
    }
    cur = next;
  }
  return cur.filter((x) => x.start < x.end).map((x) => ({ start: minutesToHhmm(x.start), end: minutesToHhmm(x.end) }));
}

/** 30分刻みの時刻の選択肢（00:00〜23:30） */
export const HALF_HOURS: string[] = Array.from({ length: 48 }, (_, i) => minutesToHhmm(i * SLOT_STEP_MINUTES));
