// Excel のブックの test の共通の部品（excel.test.ts・excel.sheets.test.ts・presets.test.ts）。
// テストのための部品（*.testkit.ts）なので check:code の対象から外す（code-rules.json の exclude）
import ExcelJS from 'exceljs';
import type { DemoData, ImportError } from '../contracts/data';
import { createDemoData } from '../seed';
import { withSeedPlans } from '../seed/plans';
import { isImportError } from '../store/persist';
import { exportWorkbook, importWorkbook } from './index';

/** seed のデータ（種類・定期パターン入り。ADR-0012。7日分の担当を書いた回が保存した訪問になる。版2） */
export const BASE = withSeedPlans(createDemoData('2026-10-13'), '2026-10-13', 7);
export const base = (): DemoData => structuredClone(BASE);
/** 読み込みで消えるもの（版2は無い。伝えた内容は base から引き継ぐ） */
export const withoutPlans = (d: DemoData): DemoData => d;

/**
 * 書き出したブック。同じ中身のデータの書き出しは使い回す（ExcelJS の書き出しは重く、多くの test が seed のデータをそのまま書き出す）。
 * 書き出しは中身だけで決まるので、確かめの意味は変わらない。読む側が触っても次の test に残らないよう写しを返す
 */
const exported = new Map<string, Promise<ArrayBuffer>>();
export async function toBuffer(d: DemoData): Promise<ArrayBuffer> {
  const key = JSON.stringify(d);
  let buf = exported.get(key);
  if (!buf) {
    buf = exportWorkbook(d).then((b) => b.arrayBuffer());
    exported.set(key, buf);
  }
  return (await buf).slice(0);
}

/** 書き出したブックを ExcelJS で直してから読み込む */
export async function editAndImport(d: DemoData, fn: (wb: ExcelJS.Workbook) => void): Promise<DemoData | ImportError> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await toBuffer(d));
  fn(wb);
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return importWorkbook(buf, d);
}

export const ok = (r: DemoData | ImportError): DemoData => {
  if (isImportError(r)) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};
export const fail = (r: DemoData | ImportError): string => {
  if (!isImportError(r)) throw new Error('エラーになるはずが読み込めた');
  return r.message;
};

/** 見出しの名前から列番号 */
export function col(ws: ExcelJS.Worksheet, header: string): number {
  for (let c = 1; c <= ws.columnCount; c++) if (ws.getRow(1).getCell(c).value === header) return c;
  throw new Error(`見出し ${header} がない`);
}
export function sheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`シート ${name} がない`);
  return ws;
}
