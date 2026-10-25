// 稼働時間帯の決まり（上限・30分単位・検査）。contracts の検査（documents.ts の availabilitySchema）と
// domain（availability.ts が再 export して使う）の両方が使う。contracts は domain に依存しないので、ここに置く
// （時刻の分への直しは、domain/time の hhmmToMinutes と同じ式を持つ：contracts → domain の向きを作らない）

export type Slot = { start: string; end: string };
/** 30分単位 */
export const SLOT_STEP_MINUTES = 30;
/** 1日の時間帯の上限 */
export const MAX_SLOTS = 4;

/** 時間帯・欠勤の入力の理由の文（画面で同じ文を使う。デモで1か所にまとめた） */
export const HALF_HOUR_ERROR = '時間は30分単位で選んでください';
export const END_AFTER_START_ERROR = '終了は開始より後にしてください';

/** HH:mm → 0時からの分 */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 30分単位の時刻か（HH:mm） */
export function isHalfHour(hhmm: string): boolean {
  return minutesOf(hhmm) % SLOT_STEP_MINUTES === 0;
}

/** 時間帯が正しいか（30分単位・開始の順・重なりなし・開始＜終了・上限以内）。正しくなければ理由 */
export function slotsError(slots: Slot[]): string | null {
  if (slots.length > MAX_SLOTS) return `時間帯は${MAX_SLOTS}つまでです`;
  let prevEnd = -1;
  for (const s of slots) {
    const a = minutesOf(s.start);
    const b = minutesOf(s.end);
    if (!isHalfHour(s.start) || !isHalfHour(s.end)) return HALF_HOUR_ERROR;
    if (a >= b) return END_AFTER_START_ERROR;
    if (a < prevEnd) return '時間帯が重なっています';
    prevEnd = b;
  }
  return null;
}
