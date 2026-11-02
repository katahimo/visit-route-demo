// 予約システムの予約の形（ADR-0075。PRD D408）：予約番号・予約日・予約時（「AM枠 10:00～12:00」など）・所要時間(分)・メニュー名・状況・氏名 … を
// 予約の1件（Booking）に写す純粋関数。新規登録者（予約を入れた人）は担当ではないので読まない（担当は組むときに決める）
import { hhmmToMinutes } from '../domain/time';
import {
  type Booking,
  type BookingTable,
  DAY_MINUTES,
  BOOKING_MINUTES as MINUTES,
  BOOKING_NOTE_MAX as NOTE_MAX,
} from './booking';
import { cellOf, clip, columnsOf, hasColumns, isBlankRow, skippedColumns } from './csvColumns';
import { parseDateText } from './text';

/** 予約の CSV の列名（読む列） */
const COL = {
  ref: '予約番号',
  date: '予約日',
  time: '予約時',
  minutes: '所要時間(分)',
  menu: 'メニュー名',
  status: '状況',
  name: '氏名',
} as const;

/** 1行目の列名が予約の CSV の形か */
export const isReserveBookingHeader = (header: readonly string[]): boolean =>
  hasColumns(columnsOf(header), [COL.ref, COL.date, COL.time, COL.name]);

/** 「AM枠 10:00～12:00」「9:30〜17:00」→ 開始（HH:mm）と、終わりまでの分（無ければ null）。読めなければ null */
export function parseTimeRange(text: string): { start: string; minutes: number | null } | null {
  const m = /(\d{1,2}):(\d{2})(?:\s*[~-]\s*(\d{1,2}):(\d{2}))?/.exec(text.normalize('NFKC').replace(/[～〜]/g, '~'));
  if (!m) return null;
  const [, h1 = '', m1 = '', h2, m2] = m;
  const hm = (h: string, mm: string) => (Number(h) <= 23 && Number(mm) <= 59 ? `${h.padStart(2, '0')}:${mm}` : null);
  const start = hm(h1, m1);
  if (!start) return null;
  if (h2 === undefined || m2 === undefined) return { start, minutes: null };
  const end = hm(h2, m2);
  if (!end) return null;
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  return { start, minutes: e > s ? e - s : null };
}

/** 取り消しの状況か（「キャンセル」「取消」を含む） */
const isCancelled = (status: string) => /キャンセル|取消|取り消/.test(status);

/** 1行 → 予約の1件（読めなければ理由の文） */
function readRow(v: (h: string) => string, row: number): Booking | string {
  const ref = v(COL.ref);
  if (ref === '') return '予約番号がありません';
  const date = parseDateText(v(COL.date));
  if (!date) return `予約日「${v(COL.date)}」が日付として読めません`;
  const range = parseTimeRange(v(COL.time));
  if (!range) return `予約時「${v(COL.time)}」から開始の時刻が読めません`;
  const given = Number(v(COL.minutes).normalize('NFKC'));
  const minutes = v(COL.minutes) !== '' && Number.isInteger(given) && given > 0 ? given : range.minutes;
  if (minutes === null) return '所要時間が読めません（終わりが開始より前なら、日をまたぐ予約は入れられません）';
  if (minutes < MINUTES.min || minutes > MINUTES.max)
    return `所要時間 ${minutes}分は ${MINUTES.min}〜${MINUTES.max}分にしてください`;
  if (hhmmToMinutes(range.start) + minutes > DAY_MINUTES) return '日をまたぐ予約は入れられません';
  const clientName = v(COL.name);
  if (clientName === '') return '氏名がありません';
  return {
    ref,
    row,
    date,
    start: range.start,
    durationMinutes: minutes,
    clientName,
    cancelled: isCancelled(v(COL.status)),
    note: clip(v(COL.menu), NOTE_MAX),
  };
}

/** 予約の CSV（1行目が列名）→ 予約の並び。形が違えば null */
export function reserveToBookings(table: readonly (readonly string[])[]): BookingTable | null {
  const header = table[0];
  if (!header || !isReserveBookingHeader(header)) return null;
  const at = columnsOf(header);
  const body = table.slice(1);
  const bookings: Booking[] = [];
  const badRows: string[] = [];
  body.forEach((r, i) => {
    if (isBlankRow(r)) return;
    const got = readRow(cellOf(at, r), i + 2);
    if (typeof got === 'string') badRows.push(`${i + 2}行目：${got}`);
    else bookings.push(got);
  });
  return { bookings, badRows, skipped: skippedColumns(header, body, Object.values(COL)) };
}
