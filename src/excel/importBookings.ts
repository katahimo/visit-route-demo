// 予約の CSV → 今のデータに訪問（単発）として入れる（ADR-0075。PRD D408）。形の見分けは bookingForms、ここはどの形でも共通の処理：
// 文字コードを見分けて読み、〈利用者さん〉と名前で突き合わせ、予約番号から決まる ID の訪問を足す・直す。
// 総入れ替え（PRD D441。ADR-0108）：予約システムのデータを写す前提で、ファイルの最初の日〜最後の日の単発の訪問はファイルに合わせる
// （ファイルに無い訪問と、取り消しになった予約の訪問は消す）。繰り返しの回とその範囲の外の日は変えない。
// データは書き換えない（ADR-0006）：新しい DemoData と件数を返し、画面が確かめてから store の update で入れる。最後は store の migrate を通す
import type { BookingImportResult, DemoData, ImportError } from '../contracts/data';
import type { Client, Visit } from '../contracts/documents';
import { nameKey } from '../lib/common';
import { decodeText, parseCsv } from '../lib/csv';
import { parsePatternVisitId } from '../patterns';
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
 * 取り消しはファイルに合わせる：アプリで取り消した訪問も、ファイルで有効なら有効に戻す（予約システムが元。PRD D441。ADR-0108）
 */
export function bookingToVisit(b: Booking, id: string, clientId: string, cur: Visit | undefined): Visit {
  const latest = b.latestStart ?? b.start;
  const sameSlot =
    cur !== undefined && cur.date === b.date && cur.earliestStart === b.start && cur.latestStart === latest;
  return {
    id,
    date: b.date,
    clientId,
    windowKind: b.latestStart === undefined ? 'fixed' : 'window',
    earliestStart: b.start,
    latestStart: latest,
    durationMinutes: b.durationMinutes,
    staffId: cur?.staffId ?? null,
    start: sameSlot ? (cur?.start ?? null) : null,
    pinned: cur?.pinned ?? false,
    cancelled: b.cancelled,
    note: b.note,
    typeId: cur?.typeId ?? null,
    pattern: null,
    cancelKind: null,
  };
}

/** 同じ行の重なりの文（訪問ID・日付と開始と名前・予約番号のどれで重なったか） */
function dupText(b: Booking, before: number): string {
  if (b.visitId) return `${b.row}行目：訪問ID「${b.ref}」が ${before}行目と重なっています`;
  if (b.matchSlot) return `${b.row}行目：日付・開始・訪問先が ${before}行目と同じです`;
  return `${b.row}行目：予約番号「${b.ref}」が ${before}行目と重なっています`;
}

/** ID の無い行（matchSlot）が当たる今の単発の訪問の ID（無ければ null、2件以上なら 'many'） */
function slotVisitId(visits: readonly Visit[], b: Booking, clientId: string): string | 'many' | null {
  const hit = visits.filter(
    (v) => v.pattern === null && v.date === b.date && v.earliestStart === b.start && v.clientId === clientId,
  );
  return hit.length === 0 ? null : hit.length === 1 ? (hit[0]?.id ?? null) : 'many';
}

/** 繰り返しの回の ID か（保存した回・まだ保存していない計算した回の `${日付}_${パターンID}`） */
const isPatternVisit = (base: DemoData, cur: Visit | undefined, id: string): boolean => {
  if (cur) return cur.pattern !== null;
  const p = parsePatternVisitId(id);
  return p !== null && base.patterns.some((x) => x.id === p.patternId);
};

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
 * - 総入れ替え：ファイルの最初の日〜最後の日（取り消しの行も含めた日付）の単発の訪問のうち、ファイルに無いものを消す（removed）。
 *   入れなかった行（名前が無い・読めない重なりなど）が指す訪問は消さない。取り消しの予約は、入っている訪問を消し、まだ入っていなければ足さない
 *   （cancelledSkipped に数える）。繰り返しの回は消さない
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
  /** どの訪問を指すか分からない行がある（読めない行・名前が当たらない行・同じ枠が2件）。あればファイルに無い訪問は消さない */
  let unsure = table.badRows.length > 0;
  const unmatched: string[] = [];
  const seen = new Map<string, number>();
  const next = new Map<string, Visit>();
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let cancelledSkipped = 0;
  /** 取り消しの予約で消す訪問 */
  const drop = new Set<string>();
  const dates = table.bookings.map((b) => b.date).sort();
  for (const b of table.bookings) {
    const key = b.visitId ?? bookingVisitId(form, b.ref);
    const before = seen.get(key);
    if (before !== undefined) {
      badRows.push(dupText(b, before));
      continue;
    }
    seen.set(key, b.row);
    const c = find(b.clientName);
    if (c === null || c === 'many') {
      unmatched.push(c === 'many' ? `${b.clientName}（同じ名前が2人以上）` : b.clientName);
      // どの訪問を指す行か分からないので、ファイルに無い訪問を消さない
      unsure = true;
      continue;
    }
    const slot = b.matchSlot ? slotVisitId(base.visits, b, c.id) : null;
    if (slot === 'many') {
      unsure = true;
      badRows.push(`${b.row}行目：同じ日・開始・訪問先の訪問が2件以上あるので、訪問ID を入れてください`);
      continue;
    }
    const id = slot ?? key;
    if (id !== key) {
      const other = seen.get(id);
      if (other !== undefined) {
        badRows.push(`${b.row}行目：${other}行目と同じ訪問です`);
        continue;
      }
      seen.set(id, b.row);
    }
    const cur = curOf.get(id);
    // 繰り返しの回は、繰り返しの欄で直す（ここで単発に変えない）
    if (isPatternVisit(base, cur, id)) {
      badRows.push(`${b.row}行目：訪問ID「${b.ref}」は繰り返しの回なので直せません`);
      continue;
    }
    // 別の〈利用者さん〉の訪問は移さない（担当・ピンが前の人のまま残るため）
    if (cur && cur.clientId !== c.id) {
      badRows.push(`${b.row}行目：訪問ID「${b.ref}」は別の人の訪問です（訪問先は変えられません）`);
      continue;
    }
    // 取り消しの予約は、入っている訪問を消し、まだ入れていなければ足さない（総入れ替え）
    if (b.cancelled) {
      if (cur) drop.add(id);
      else cancelledSkipped++;
      continue;
    }
    const v = bookingToVisit(b, id, c.id, cur);
    if (!cur) added++;
    else if (same(v, cur)) unchanged++;
    else updated++;
    next.set(id, cur && same(v, cur) ? cur : v);
  }
  const from = dates[0];
  const to = dates[dates.length - 1];
  // ファイルの日の範囲の単発の訪問で、ファイルの行が指していないもの（入れなかった行が指す訪問は seen に入っていて残る）
  const gone = (v: Visit) =>
    drop.has(v.id) ||
    (!unsure &&
      from !== undefined &&
      to !== undefined &&
      v.pattern === null &&
      v.date >= from &&
      v.date <= to &&
      !seen.has(v.id));
  const removed = base.visits.filter(gone).length;
  const visits = [
    ...base.visits.filter((v) => !gone(v)).map((v) => next.get(v.id) ?? v),
    ...[...next.values()].filter((v) => !curOf.has(v.id)),
  ];
  const r = migrate({ ...base, visits });
  if (isImportError(r)) return { ...r, message: `読み込んだ内容に問題があります：${r.message}` };
  return {
    data: r,
    added,
    updated,
    removed,
    keptMissing: unsure,
    unchanged,
    cancelledSkipped,
    unmatched: countNames(unmatched),
    badRows,
    source: { format: 'csv', encoding },
    otherForm: { label: form.label, skippedColumns: table.skipped },
  };
}
