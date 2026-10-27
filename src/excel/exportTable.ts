// 書き出しの表の共通部分（表の型・列幅・書式・プルダウン）。exportBook・exportSheets・exportPersonTables が使う
import type ExcelJS from 'exceljs';
import type { Item } from '../contracts/rules';
import type { TraitCol } from './layout';
import { FLAG_COND_TEXTS, NO, YES } from './text';

/** 見出しの背景（淡いオレンジ） */
const HEADER_FILL = 'FFFDE3CF';
/** プルダウンを付ける行数の下限（書き足す行のぶん） */
export const MIN_ROWS = 500;

type RangeValidations = { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } };

export type CellIn = string | number | null;

export type ListRule =
  | { col: number; values: readonly string[]; strict?: boolean }
  | { col: number; ref: string; strict?: boolean };

export interface TableSpec {
  name: string;
  headers: string[];
  rows: CellIn[][];
  /** 文字列「@」の書式にする列（1始まり。日付・時刻・ID など、Excel に勝手に変換させない） */
  textCols?: number[];
  lists?: ListRule[];
  /** 左から固定する列の数 */
  freezeCols?: number;
}

/** 表示の幅（全角＝2） */
function displayWidth(v: CellIn): number {
  if (v === null) return 0;
  let w = 0;
  for (const line of String(v).split('\n')) {
    let lw = 0;
    for (const ch of line) lw += ch.charCodeAt(0) > 0xff ? 2 : 1;
    w = Math.max(w, lw);
  }
  return w;
}

/** Excel の入力規則のリスト（値の文字列は 255 文字まで。超える・「,」「"」を含むなら付けない） */
export function listFormula(values: readonly string[]): string | null {
  if (values.length === 0 || values.some((v) => v.includes(',') || v.includes('"'))) return null;
  const s = `"${values.join(',')}"`;
  return s.length > 257 ? null : s;
}

/** シートの名前を数式で参照する形（'スタッフ'!$B$2:$B$500） */
export const sheetRef = (sheet: string, colLetter: string, rows: number) =>
  `'${sheet.replace(/'/g, "''")}'!$${colLetter}$2:$${colLetter}$${rows}`;

export function addTable(wb: ExcelJS.Workbook, spec: TableSpec): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(spec.name, {
    views: [{ state: 'frozen', xSplit: spec.freezeCols ?? 0, ySplit: 1 }],
  });
  const text = new Set(spec.textCols ?? []);
  spec.headers.forEach((h, i) => {
    const col = ws.getColumn(i + 1);
    const w = Math.max(displayWidth(h), ...spec.rows.map((r) => displayWidth(r[i] ?? null)));
    col.width = Math.min(50, Math.max(8, w + 2));
    if (text.has(i + 1)) col.numFmt = '@';
  });
  ws.addRow(spec.headers);
  for (const r of spec.rows) {
    const row = ws.addRow(r.map((v) => (v === null ? null : v)));
    r.forEach((v, i) => {
      if (typeof v === 'string' && v.includes('\n')) row.getCell(i + 1).alignment = { wrapText: true, vertical: 'top' };
      if (text.has(i + 1)) row.getCell(i + 1).numFmt = '@';
    });
  }
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    c.font = { bold: true };
    c.alignment = { vertical: 'middle' };
    c.numFmt = '@';
  });
  const last = Math.max(MIN_ROWS, spec.rows.length + 200);
  for (const l of spec.lists ?? []) {
    const formula = 'values' in l ? listFormula(l.values) : l.ref;
    if (!formula) continue;
    const letter = ws.getColumn(l.col).letter;
    // 型定義には無いが、ExcelJS 4 の Worksheet は範囲（A2:A500）でまとめて付ける dataValidations を持つ
    (ws as unknown as RangeValidations).dataValidations.add(`${letter}2:${letter}${last}`, {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: l.strict === false ? 'warning' : 'stop',
      errorTitle: '入力の確認',
      error: '一覧の中から選んでください',
    });
  }
  return ws;
}

export const yes = (b: boolean) => (b ? YES : '');
export const nullable = (n: number | null) => (n === null ? null : n);

/** 特性の列のプルダウン（選択肢から複数は選択肢ごとの列の ○・×。ADR-0070） */
export function traitList(c: TraitCol, col: number): ListRule | null {
  if (c.option !== null) return { col, values: [YES, NO] };
  if (c.item.kind === 'flag') return { col, values: ['あり', 'なし'] };
  if (c.item.kind === 'choice') return { col, values: c.item.options };
  return null;
}
export function condList(it: Item, col: number): ListRule | null {
  if (it.kind === 'flag') return { col, values: FLAG_COND_TEXTS };
  return null;
}
