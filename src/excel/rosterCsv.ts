// 名簿の CSV（ADR-0068）：書き出しは名簿のブックと同じ列・同じ値を BOM 付きの UTF-8 の CSV に、
// 読み込みは CSV を名簿のシート1枚のブックに写して、名簿のブックと同じ読み方（rosterRows）に渡す。
// Excel の無い環境でも、表計算のアプリやメモ帳で名簿を直せるようにする
import ExcelJS from 'exceljs';
import type { DemoData, ImportError, RosterKind, RosterSource } from '../contracts/data';
import { nameKey } from '../lib/common';
import { CSV_BOM, CSV_MIME, decodeText, parseCsv, toCsv, unguardCell } from '../lib/csv';
import { rosterWrongPlace } from './csvPlace';
import { exportProblem } from './exportBook';
import { clientTable, staffTable } from './exportPersonTables';
import { CLIENT_POSTAL_COL } from './layout';
import { loadWorkbook, MAX_FILE_BYTES } from './reader';
import { type RosterForm, type RosterFormEnv, readRosterForm } from './rosterForms';
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

/** 開いた名簿（ブックと、読んだファイルの形・ほかのソフトの形で読んだときの形と読まなかった列） */
export type LoadedRoster = {
  book: ExcelJS.Workbook;
  source: RosterSource;
  other: { form: RosterForm; skipped: string[] } | null;
};

/**
 * 名簿のファイル → ブック（と、ほかのソフトの形で読んだときの形と読まなかった列。ADR-0073・ADR-0075）。.xlsx（zip）ならそのまま開き、ほかは CSV として文字コードを見分けて読み、
 * 名簿のシート名（呼び方）のシート1枚に写す（値は文字。日付・時刻・数は rosterRows が文字から読む。書き出しで付けた数式よけの「'」は外す）
 */
export async function loadRosterBook(
  buf: ArrayBuffer,
  base: DemoData,
  kind: RosterKind,
  env: RosterFormEnv,
): Promise<LoadedRoster | ImportError> {
  const bytes = new Uint8Array(buf);
  if (isZip(bytes)) {
    const book = await loadWorkbook(buf);
    return 'code' in book ? book : { book, source: { format: 'xlsx' }, other: null };
  }
  if (buf.byteLength > MAX_FILE_BYTES)
    return { code: 'INVALID_ARGUMENT', message: `ファイルが大きすぎます（${MAX_FILE_BYTES / 1024 / 1024}MB まで）` };
  const { text, encoding } = decodeText(bytes);
  // 文字の無いバイト（NUL）を含むなら、CSV ではない（壊れた・ほかの形の .xlsx など）
  if (text.includes('\u0000'))
    return { code: 'INVALID_ARGUMENT', message: 'Excel のファイル（.xlsx）か CSV のファイルとして読めませんでした' };
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { code: 'INVALID_ARGUMENT', message: 'CSV のファイルが空です' };
  // 予約の CSV・もう一方の名簿の CSV なら、読む欄を伝えて止める（取り違え。PRD D443）
  const wrong = rosterWrongPlace(parsed, kind, base.org.terms);
  if (wrong) return { code: 'INVALID_ARGUMENT', message: wrong };
  // 列名がほかのソフトの形（顧客台帳・予約システムなど。rosterForms）なら名簿の列に写して読む（ADR-0073・ADR-0075）
  const hit = readRosterForm(parsed, kind, env);
  const rows = hit ? hit.table.rows : parsed;
  const book = new ExcelJS.Workbook();
  const ws = book.addWorksheet(personSheetNames(base.org.terms)[kind]);
  // 郵便番号の列の数字だけの値は数のセルにする（Excel で CSV を開いて保存すると先頭の0が落ちる。数なら readPostal が7桁に戻す）
  const postal = kind === 'client' ? (rows[0] ?? []).findIndex((h) => nameKey(h) === nameKey(CLIENT_POSTAL_COL)) : -1;
  rows.forEach((r, n) => {
    const cells: (string | number)[] = hit ? r : r.map(unguardCell);
    const p = cells[postal];
    if (n > 0 && typeof p === 'string' && /^\d{1,6}$/.test(p)) cells[postal] = Number(p);
    ws.addRow(cells);
  });
  return {
    book,
    source: { format: 'csv', encoding },
    other: hit ? { form: hit.form, skipped: hit.table.skipped } : null,
  };
}
