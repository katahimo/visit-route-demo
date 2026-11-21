// 所要（分）と終わりの時刻の読み替え（PRD D462。ADR-0117）：データは所要（分）で持ち、入力と表示だけ終わりの時刻でも入れられる。
// 繰り返しの欄・訪問の詳細の欄・「定期の予定を追加」で同じものを使う（components/DurationEndFields）
import { hhmmToMinutes, minutesToHhmm } from '../domain/time';

const HHMM = /^\d{2}:\d{2}$/;
/** 1日の分 */
const DAY_MINUTES = 24 * 60;

/** 所要の文字（欄の値）→ 分。数でない・空・整数でないなら null */
export function minutesOfText(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : null;
}

/**
 * 開始と所要（分）→ 終わりの時刻（HH:mm）。開始が時刻でない・所要が正の整数でない・その日のうちに終わらない（24:00 以降）なら ''
 */
export function endTimeOf(start: string, minutes: number | null): string {
  if (!HHMM.test(start) || minutes === null || !Number.isInteger(minutes) || minutes <= 0) return '';
  const end = hhmmToMinutes(start) + minutes;
  return end >= DAY_MINUTES ? '' : minutesToHhmm(end);
}

/** 開始と終わりの時刻 → 所要（分）。どちらかが時刻でない・終わりが開始より後でないなら null */
export function minutesBetween(start: string, end: string): number | null {
  if (!HHMM.test(start) || !HHMM.test(end)) return null;
  const m = hhmmToMinutes(end) - hhmmToMinutes(start);
  return m > 0 ? m : null;
}

/** 終わりの時刻の欄の誤り（よければ null）。空は誤りにしない（所要の欄で入れる） */
export function endTimeError(start: string, end: string): string | null {
  if (end === '' || !HHMM.test(start)) return null;
  return minutesBetween(start, end) === null ? '終わりは開始より後の時刻にしてください' : null;
}
