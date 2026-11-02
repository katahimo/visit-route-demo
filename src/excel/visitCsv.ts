// 予定の CSV（このアプリの形。ADR-0090。PRD D423）：単発の訪問を CSV で書き出す・テンプレートを出す・読む。
// 列は VISIT_CSV_COLS の1か所。読むときは予約の1件（Booking）に写し、〈利用者さん〉との突き合わせと訪問にするのは importBookings が共通で行う。
// 書き出した訪問ID の列があれば、読み直すとその訪問を直す（往復できる）。担当の列は書き出すだけで、読むときは使わない

import type { DemoData } from '../contracts/data';
import { hhmmToMinutes } from '../domain/time';
import { nameKey } from '../lib/common';
import { CSV_BOM, CSV_MIME, toCsv, unguardCell } from '../lib/csv';
import { oneOffVisitsIn } from '../lib/planCsv';
import { BOOKING_MINUTES, BOOKING_NOTE_MAX, type Booking, type BookingTable, DAY_MINUTES } from './booking';
import { cellOf, clip, columnsOf, hasColumns, isBlankRow, skippedColumns } from './csvColumns';
import { hhmmToCell, NO_TEXTS, parseDateText, parseTimeText, YES_TEXTS } from './text';

/** 予定の CSV の列名（並びは書き出しの列の順） */
export const VISIT_CSV_COLS = {
  id: '訪問ID',
  date: '日付',
  start: '開始',
  latest: '開始の上限',
  minutes: '所要(分)',
  client: '訪問先',
  note: 'メモ',
  cancelled: '取り消し',
  staff: '担当',
} as const;

/** 形を見分ける列（どれも無ければこの形ではない） */
const REQUIRED = [VISIT_CSV_COLS.date, VISIT_CSV_COLS.start, VISIT_CSV_COLS.minutes, VISIT_CSV_COLS.client];
/** 取り消しの列に書く値 */
const CANCELLED_TEXT = '取り消し';

/** 取り消しの列の値 → 取り消しか（「取り消し」・○・はい など／空・×・いいえ・なし など）。どちらでもなければ null */
function readCancelled(text: string): boolean | null {
  const t = text.normalize('NFKC').trim();
  if (t === CANCELLED_TEXT || t === '取消' || YES_TEXTS.includes(t) || t === '1') return true;
  if (t === '' || t === 'なし' || t === '0' || NO_TEXTS.includes(t)) return false;
  return null;
}
/** 訪問ID の上限（contracts の idSchema と同じ） */
const ID_MAX = 100;

/** 1行目の列名が予定の CSV の形か */
export const isVisitCsvHeader = (header: readonly string[]): boolean => hasColumns(columnsOf(header), REQUIRED);

/** 1行 → 予約の1件（読めなければ理由の文）。値の先頭の数式よけの「'」は外す */
function readRow(raw: (h: string) => string, row: number): Booking | string {
  const v = (h: string) => unguardCell(raw(h));
  const C = VISIT_CSV_COLS;
  const date = parseDateText(v(C.date));
  if (!date) return `${C.date}「${v(C.date)}」が日付として読めません（2026-11-03 の形）`;
  const start = parseTimeText(v(C.start));
  if (!start) return `${C.start}「${v(C.start)}」が時刻として読めません（9:00 の形）`;
  const latest = v(C.latest) === '' ? start : parseTimeText(v(C.latest));
  if (!latest) return `${C.latest}「${v(C.latest)}」が時刻として読めません（9:00 の形）`;
  if (hhmmToMinutes(latest) < hhmmToMinutes(start)) return `${C.latest}が${C.start}より前です`;
  const minutes = Number(v(C.minutes).normalize('NFKC'));
  if (!Number.isInteger(minutes) || minutes < BOOKING_MINUTES.min || minutes > BOOKING_MINUTES.max)
    return `${C.minutes}「${v(C.minutes)}」は ${BOOKING_MINUTES.min}〜${BOOKING_MINUTES.max} の整数にしてください`;
  if (hhmmToMinutes(latest) + minutes > DAY_MINUTES) return '日をまたぐ訪問は入れられません';
  const clientName = v(C.client);
  if (clientName === '') return `${C.client}がありません`;
  const id = v(C.id);
  if (id.length > ID_MAX) return `${C.id}は ${ID_MAX}文字までにしてください`;
  const cancelled = readCancelled(v(C.cancelled));
  if (cancelled === null) return `${C.cancelled}「${v(C.cancelled)}」は「${CANCELLED_TEXT}」か空にしてください`;
  return {
    // 訪問ID が無ければ、日付・開始・名前で今の単発の訪問に当てる（無ければ足し、同じファイルを読み直しても二重に入れない）
    ref: id !== '' ? id : `${date}_${start}_${nameKey(clientName)}`,
    ...(id !== '' ? { visitId: id } : { matchSlot: true }),
    row,
    date,
    start,
    ...(v(C.latest) === '' ? {} : { latestStart: latest }),
    durationMinutes: minutes,
    clientName,
    cancelled,
    note: clip(v(C.note), BOOKING_NOTE_MAX),
  };
}

/** 予定の CSV（1行目が列名）→ 予約の並び。形が違えば null。担当の列は書き出すだけなので、読まなかった列に数えない */
export function visitCsvToBookings(table: readonly (readonly string[])[]): BookingTable | null {
  const header = table[0];
  if (!header || !isVisitCsvHeader(header)) return null;
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
  return { bookings, badRows, skipped: skippedColumns(header, body, Object.values(VISIT_CSV_COLS)) };
}

/** 列名の行 */
const HEADER: string[] = Object.values(VISIT_CSV_COLS);

/** 行と値 → BOM 付きの UTF-8 の CSV の Blob */
const csvBlob = (rows: readonly (readonly (string | number)[])[]) =>
  new Blob([CSV_BOM + toCsv([HEADER, ...rows])], { type: CSV_MIME });

/** from〜to（YYYY-MM-DD・両端を含む）の単発の訪問を予定の CSV に書き出す */
export function exportVisitsCsv(data: DemoData, from: string, to: string): Blob {
  const client = new Map(data.clients.map((c) => [c.id, c.displayName]));
  const staff = new Map(data.staff.map((s) => [s.id, s.name]));
  return csvBlob(
    oneOffVisitsIn(data, from, to).map((v) => [
      v.id,
      v.date,
      hhmmToCell(v.earliestStart),
      v.windowKind === 'fixed' ? '' : hhmmToCell(v.latestStart),
      v.durationMinutes,
      client.get(v.clientId) ?? '',
      v.note,
      v.cancelled ? CANCELLED_TEXT : '',
      v.staffId === null ? '' : (staff.get(v.staffId) ?? ''),
    ]),
  );
}

/** 予定の CSV のテンプレート（列名の行だけ） */
export const visitCsvTemplate = (): Blob => csvBlob([]);
