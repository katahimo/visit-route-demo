// 予約の CSV → 今のデータに訪問（単発）として入れる（ADR-0075。PRD D398）。形の見分けは bookingForms、ここはどの形でも共通の処理：
// 文字コードを見分けて読み、〈利用者さん〉と名前で突き合わせ、予約番号から決まる ID の訪問を足す・直す。
// データは書き換えない（ADR-0006）：新しい DemoData と件数を返し、画面が確かめてから store の update で入れる。最後は store の migrate を通す
import type { BookingImportResult, DemoData, ImportError } from '../contracts/data';
import type { Client, Visit } from '../contracts/documents';
import { nameKey } from '../lib/common';
import { decodeText, parseCsv } from '../lib/csv';
import { isImportError, migrate } from '../store/persist';
import type { Booking } from './booking';
import { BOOKING_FORMS, type BookingForm, readBookingForm } from './bookingForms';
import { clip } from './csvColumns';
import { MAX_FILE_BYTES } from './reader';
import { same } from './rosterRows';

/** 予約から作る訪問の ID（形の ID と予約番号。読み直すと同じ訪問を直す） */
export const bookingVisitId = (form: Pick<BookingForm, 'id'>, ref: string) => `bk-${form.id}-${clip(ref, 80)}`;

/** 名前の比べ方のキーから、末尾の「（…）」を除いたもの（同じ名前を分けた「名前（顧客ID）」の元の名前。nameKey で括弧は半角） */
const baseKey = (k: string) => k.replace(/\([^()]*\)$/, '');

/**
 * 名前 → 〈利用者さん〉（終了でない人を先に見る）。同じ名前の人と、名簿の読み込みで「名前（顧客ID）」に分けた人を合わせて
 * 2人以上なら 'many'（どの人の予約か分からないので入れない）
 */
export function clientFinder(clients: readonly Client[]): (name: string) => Client | 'many' | null {
  const exact = new Map<string, Client[]>();
  const split = new Map<string, Client[]>();
  const add = (m: Map<string, Client[]>, k: string, c: Client) => m.set(k, [...(m.get(k) ?? []), c]);
  for (const c of clients) {
    const k = nameKey(c.displayName);
    add(exact, k, c);
    if (baseKey(k) !== k) add(split, baseKey(k), c);
  }
  return (name) => {
    const k = nameKey(name);
    const all = [...(exact.get(k) ?? []), ...(split.get(k) ?? [])];
    const live = all.filter((c) => c.stage !== 'ended');
    const xs = live.length > 0 ? live : all;
    if (xs.length === 0) return null;
    return xs.length === 1 ? (xs[0] ?? null) : 'many';
  };
}

/**
 * 予約 → 訪問（今の訪問があれば担当・ピン・種類を残し、日付と時刻が変わらなければ組んだ開始も残す。
 * アプリで取り消した訪問（当日キャンセルなど）は、ファイルが取り消していなくても取り消しのまま）
 */
export function bookingToVisit(b: Booking, id: string, clientId: string, cur: Visit | undefined): Visit {
  const sameSlot = cur !== undefined && cur.date === b.date && cur.earliestStart === b.start;
  return {
    id,
    date: b.date,
    clientId,
    windowKind: 'fixed',
    earliestStart: b.start,
    latestStart: b.start,
    durationMinutes: b.durationMinutes,
    staffId: cur?.staffId ?? null,
    start: sameSlot ? (cur?.start ?? null) : null,
    pinned: cur?.pinned ?? false,
    cancelled: b.cancelled || (cur?.cancelled ?? false),
    note: b.note,
    typeId: cur?.typeId ?? null,
    pattern: null,
    cancelKind: cur?.cancelled ? cur.cancelKind : null,
  };
}

/** 入れなかった予約の名前を「名前（N件）」にまとめる（ファイルの順） */
function countNames(names: readonly string[]): string[] {
  const n = new Map<string, number>();
  for (const x of names) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].map(([x, k]) => `${x}（${k}件）`);
}

/**
 * 予約の CSV → 訪問を入れた結果。形が分からない・読めなければ ImportError（何も変えない）。
 * - 〈利用者さん〉は名前（全角半角・空白を同一視）で突き合わせる。いない・同じ名前が2人の予約は入れず unmatched に挙げる
 * - 担当は決めない（担当なし）。今ある訪問（同じ予約番号）の担当・ピンは残す
 * - ファイルに無い訪問は消さない。まだ入れていない取り消し済みの予約は足さない（cancelledSkipped に数える）
 */
export function importBookings(buf: ArrayBuffer, base: DemoData): BookingImportResult | ImportError {
  if (buf.byteLength > MAX_FILE_BYTES)
    return { code: 'INVALID_ARGUMENT', message: `ファイルが大きすぎます（${MAX_FILE_BYTES / 1024 / 1024}MB まで）` };
  const { text, encoding } = decodeText(new Uint8Array(buf));
  if (text.includes('\u0000')) return { code: 'INVALID_ARGUMENT', message: 'CSV のファイルとして読めませんでした' };
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { code: 'INVALID_ARGUMENT', message: 'CSV のファイルが空です' };
  const hit = readBookingForm(parsed);
  if (!hit)
    return {
      code: 'INVALID_ARGUMENT',
      message: `予約の CSV の形が分かりませんでした（1行目の列名を確かめてください。読める形：${BOOKING_FORMS.map((f) => f.label).join('・')}）`,
    };
  const { form, table } = hit;
  const find = clientFinder(base.clients);
  const curOf = new Map(base.visits.map((v) => [v.id, v]));
  const badRows = [...table.badRows];
  const unmatched: string[] = [];
  const seen = new Map<string, number>();
  const next = new Map<string, Visit>();
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let cancelledSkipped = 0;
  for (const b of table.bookings) {
    const id = bookingVisitId(form, b.ref);
    const before = seen.get(id);
    if (before !== undefined) {
      badRows.push(`${b.row}行目：予約番号「${b.ref}」が ${before}行目と重なっています`);
      continue;
    }
    seen.set(id, b.row);
    const c = find(b.clientName);
    if (c === null || c === 'many') {
      unmatched.push(c === 'many' ? `${b.clientName}（同じ名前が2人以上）` : b.clientName);
      continue;
    }
    const cur = curOf.get(id);
    // まだ入れていない予約が取り消し済みなら、取り消しの訪問を足さない
    if (!cur && b.cancelled) {
      cancelledSkipped++;
      continue;
    }
    const v = bookingToVisit(b, id, c.id, cur);
    if (!cur) added++;
    else if (same(v, cur)) unchanged++;
    else updated++;
    next.set(id, cur && same(v, cur) ? cur : v);
  }
  const visits = [
    ...base.visits.map((v) => next.get(v.id) ?? v),
    ...[...next.values()].filter((v) => !curOf.has(v.id)),
  ];
  const r = migrate({ ...base, visits });
  if (isImportError(r)) return { ...r, message: `読み込んだ内容に問題があります：${r.message}` };
  return {
    data: r,
    added,
    updated,
    unchanged,
    cancelledSkipped,
    unmatched: countNames(unmatched),
    badRows,
    source: { format: 'csv', encoding },
    otherForm: { label: form.label, skippedColumns: table.skipped },
  };
}
