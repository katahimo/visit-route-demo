// ほかのソフトの CSV の形を読むときの共通の部品（ADR-0075）：列名の比べ方・列の位置・行の値の引き方・読まなかった列。
// 顧客台帳（ledgerCsv）・予約システム（reserveCsv・reserveBookings）など、形ごとのファイルから使う純粋関数
/** 比べるための列名（前後の空白・BOM・全角半角を同一視） */
export const colKey = (s: string) => s.normalize('NFKC').replace(/^﻿/, '').trim();

/** 1行目の列名 → 列の位置（同じ列名は最初の列） */
export function columnsOf(header: readonly string[]): Map<string, number> {
  const at = new Map<string, number>();
  header.forEach((h, i) => {
    if (!at.has(colKey(h))) at.set(colKey(h), i);
  });
  return at;
}

/** 列名がすべてあるか */
export const hasColumns = (at: Map<string, number>, names: readonly string[]): boolean =>
  names.every((h) => at.has(colKey(h)));

/** 行の値を列名で引く（無い列は空。前後の空白は除く） */
export const cellOf =
  (at: Map<string, number>, r: readonly string[]) =>
  (h: string): string => {
    const i = at.get(colKey(h));
    return i === undefined ? '' : (r[i] ?? '').trim();
  };

/** 読まなかった列の名前（読む列の最初の位置だけ読んだとみなす。列名が空でも値がある列は「（列名なし・N列目）」） */
export function skippedColumns(
  header: readonly string[],
  body: readonly (readonly string[])[],
  read: readonly string[],
): string[] {
  const at = columnsOf(header);
  const keys = new Set(read.map(colKey));
  return header
    .map((raw, i) => ({ h: colKey(raw), i }))
    .filter(({ h, i }) => (h === '' ? body.some((r) => (r[i] ?? '').trim() !== '') : !(keys.has(h) && at.get(h) === i)))
    .map(({ h, i }) => (h === '' ? `（列名なし・${i + 1}列目）` : h));
}

/** 空行か */
export const isBlankRow = (r: readonly string[]): boolean => r.every((c) => c.trim() === '');
