// ほかのソフトの CSV の形を読むときの共通の部品（ADR-0075）：列名の比べ方・列の位置・行の値の引き方・読まなかった列。
// 顧客台帳（ledgerCsv）・予約システム（reserveCsv・reserveBookings）など、形ごとのファイルから使う純粋関数
import type { Item } from '../contracts/rules';
import { nameKey } from '../lib/common';

/** ほかのソフトの形を名簿の列に写した結果：名簿の列の表と、読まなかった列の名前（rosterForms の形で共通） */
export interface RosterTable {
  rows: string[][];
  skipped: string[];
  /** 選択肢を足した項目の一覧（職員台帳で資格・研修の選択肢を足したときだけ。PRD D443） */
  items?: Item[];
  /** 足した選択肢の文（「資格（准看護師・保健師）」。items と一緒に） */
  addedOptions?: string[];
}

/** UTF-16 の長さが max に収まるように、文字（コードポイント）の途中で切らずに前から切る */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = '';
  for (const ch of s) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out;
}

/**
 * 同じ名前（全角半角・空白の違いも同じ）の人を、全員「名前（ID）」にして分ける（ファイルの並びに左右されない）。
 * ID が空の人・1人だけの名前はそのまま。max に収める
 */
export function distinctNames(people: readonly { name: string; id: string }[], max: number): string[] {
  const count = new Map<string, number>();
  for (const p of people) if (p.name !== '') count.set(nameKey(p.name), (count.get(nameKey(p.name)) ?? 0) + 1);
  return people.map((p) =>
    (count.get(nameKey(p.name)) ?? 0) > 1 && p.id !== '' ? clip(`${p.name}（${p.id}）`, max) : clip(p.name, max),
  );
}
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

/** 読まなかった列の名前（ファイルの表記のまま。読む列の最初の位置だけ読んだとみなす。列名が空でも値がある列は「（列名なし・N列目）」） */
export function skippedColumns(
  header: readonly string[],
  body: readonly (readonly string[])[],
  read: readonly string[],
): string[] {
  const at = columnsOf(header);
  const keys = new Set(read.map(colKey));
  return header
    .map((raw, i) => ({ raw: raw.replace(/^﻿/, '').trim(), h: colKey(raw), i }))
    .filter(({ h, i }) => (h === '' ? body.some((r) => (r[i] ?? '').trim() !== '') : !(keys.has(h) && at.get(h) === i)))
    .map(({ raw, h, i }) => (h === '' ? `（列名なし・${i + 1}列目）` : raw));
}

/** 空行か */
export const isBlankRow = (r: readonly string[]): boolean => r.every((c) => c.trim() === '');

/**
 * 読み込みの誤りの文の『列名』を、ほかのソフトの列名に直す関数を作る（names：名簿の列名 → その形の列名）。
 * 利用者が手元で見ているファイルの列名で誤りを出すため
 */
export const columnMessage =
  (names: Readonly<Record<string, string>>) =>
  (message: string): string =>
    message.replace(/『([^』]+)』/g, (m, h: string) => (names[h] ? `『${names[h]}』` : m));
