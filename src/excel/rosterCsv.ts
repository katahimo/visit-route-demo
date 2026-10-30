// 名簿の CSV（ADR-0068）：書き出しは名簿のブックと同じ列・同じ値を BOM 付きの UTF-8 の CSV に、
// 読み込みは CSV を名簿のシート1枚のブックに写して、名簿のブックと同じ読み方（rosterRows）に渡す。
// Excel の無い環境でも、表計算のアプリやメモ帳で名簿を直せるようにする
import ExcelJS from 'exceljs';
import type { DemoData, ImportError, LedgerRead, RosterKind, RosterSource } from '../contracts/data';
import { nameKey } from '../lib/common';
import { CSV_BOM, CSV_MIME, decodeText, parseCsv, toCsv, unguardCell } from '../lib/csv';
import { exportProblem } from './exportBook';
import { clientTable, staffTable } from './exportPersonTables';
import { CLIENT_POSTAL_COL } from './layout';
import { ledgerToRoster } from './ledgerCsv';
import { loadWorkbook, MAX_FILE_BYTES } from './reader';
import { personSheetNames } from './text';

/** .xlsx（zip）の先頭の4バイト「PK\x03\x04」 */
const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** 名簿の CSV（.csv の Blob）。列は名簿のブックと同じ。書き出せないデータ（exportProblem）はブックと同じく止める */
export function exportRosterCsv(data: DemoData, kind: RosterKind): Blob {
  const problem = exportProblem(data);
  if (problem) throw new Error(problem);
  const names = personSheetNames(data.org.terms);
  const spec = kind === 'staff' ? staffTable(data, names.staff) : clientTable(data, names.client);
  return new Blob([CSV_BOM + toCsv([spec.headers, ...spec.rows])], { type: CSV_MIME });
}

/**
 * 名簿のファイル → ブック（と、顧客台帳の形で読んだときの読まなかった列。ADR-0073）。.xlsx（zip）ならそのまま開き、ほかは CSV として文字コードを見分けて読み、
 * 名簿のシート名（呼び方）のシート1枚に写す（値は文字。日付・時刻・数は rosterRows が文字から読む。書き出しで付けた数式よけの「'」は外す）
 */
export async function loadRosterBook(
  buf: ArrayBuffer,
  base: DemoData,
  kind: RosterKind,
): Promise<{ book: ExcelJS.Workbook; source: RosterSource; ledger: LedgerRead | null } | ImportError> {
  const bytes = new Uint8Array(buf);
  if (isZip(bytes)) {
    const book = await loadWorkbook(buf);
    return 'code' in book ? book : { book, source: { format: 'xlsx' }, ledger: null };
  }
  if (buf.byteLength > MAX_FILE_BYTES)
    return { code: 'INVALID_ARGUMENT', message: `ファイルが大きすぎます（${MAX_FILE_BYTES / 1024 / 1024}MB まで）` };
  const { text, encoding } = decodeText(bytes);
  // 文字の無いバイト（NUL）を含むなら、CSV ではない（壊れた・ほかの形の .xlsx など）
  if (text.includes('\u0000'))
    return { code: 'INVALID_ARGUMENT', message: 'Excel のファイル（.xlsx）か CSV のファイルとして読めませんでした' };
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { code: 'INVALID_ARGUMENT', message: 'CSV のファイルが空です' };
  // 〈利用者さん〉の名簿で、列名が顧客台帳の形なら名簿の列に写して読む（ADR-0073）
  const ledger = kind === 'client' ? ledgerToRoster(parsed) : null;
  const rows = ledger ? ledger.rows : parsed;
  const book = new ExcelJS.Workbook();
  const ws = book.addWorksheet(personSheetNames(base.org.terms)[kind]);
  // 郵便番号の列の数字だけの値は数のセルにする（Excel で CSV を開いて保存すると先頭の0が落ちる。数なら readPostal が7桁に戻す）
  const postal = kind === 'client' ? (rows[0] ?? []).findIndex((h) => nameKey(h) === nameKey(CLIENT_POSTAL_COL)) : -1;
  rows.forEach((r, n) => {
    const cells: (string | number)[] = ledger ? r : r.map(unguardCell);
    const p = cells[postal];
    if (n > 0 && typeof p === 'string' && /^\d{1,6}$/.test(p)) cells[postal] = Number(p);
    ws.addRow(cells);
  });
  return { book, source: { format: 'csv', encoding }, ledger: ledger ? { skippedColumns: ledger.skipped } : null };
}
