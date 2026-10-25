// 年月（YYYY-MM）の計算の小さい部品（月の画面・稼働の見込み・担当を組むなどで使う）。純粋関数
import { addDays, weekday } from '../domain/time';

const YM = /^(\d{4})-(\d{2})$/;

/** 'YYYY-MM' として正しいか */
export function isYm(ym: string): boolean {
  const m = YM.exec(ym);
  if (!m) return false;
  const mm = Number(m[2]);
  return mm >= 1 && mm <= 12;
}

/** 日付（YYYY-MM-DD）の月（YYYY-MM） */
export const ymOf = (date: string): string => date.slice(0, 7);

/** 月を n か月ずらす */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const i = (y ?? 0) * 12 + ((m ?? 1) - 1) + n;
  const yy = Math.floor(i / 12);
  const mm = i - yy * 12 + 1;
  return `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}`;
}

/** 月を送ったときに選ぶ日付：その月の1日、ただし今月なら今日（PRD D59） */
export const firstDayOf = (ym: string, today: string): string => (ymOf(today) === ym ? today : `${ym}-01`);

/** その月の日付（1日から末日まで） */
export function monthDates(ym: string): string[] {
  const out: string[] = [];
  let d = `${ym}-01`;
  while (ymOf(d) === ym) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** 日曜はじまりの6週×7日の日付（前後の月の日を含む） */
export function calendarWeeks(ym: string): string[][] {
  const first = `${ym}-01`;
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
}
