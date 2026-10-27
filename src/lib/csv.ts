// CSV の文字と表の変換（名簿の CSV。ADR-0068）。文字コードの見分け（UTF-8・UTF-16・Shift_JIS・EUC-JP）・
// 区切り（カンマ・タブ）の見分け・引用符つきの値（区切り・改行・「"」を含む）を読み、書くときは BOM 付きの UTF-8 にする
import type { RosterSource } from '../contracts/data';

/** 見分けた文字コード（確認の文に出す名前） */
type TextEncodingName = Extract<RosterSource, { format: 'csv' }>['encoding'];

/** 日本語の CSV で使われる、BOM の無い文字コードの候補（UTF-8 で読めなかったときに比べる） */
const LEGACY: readonly { name: TextEncodingName; label: string }[] = [
  { name: 'Shift_JIS', label: 'shift_jis' },
  { name: 'EUC-JP', label: 'euc-jp' },
];

/** 読めない文字（U+FFFD）と半角カナ（EUC-JP を Shift_JIS で読むと多く出る）を数えて、取り違えらしさの点にする（小さいほど良い） */
function badness(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (ch === '�') n += 10;
    else if (ch >= '｡' && ch <= 'ﾟ') n += 1;
  }
  return n;
}

/**
 * バイト列 → 文字（文字コードを見分ける）。BOM があればそれに従い、無ければ UTF-8 として正しく読めるか確かめ、
 * 読めなければ Shift_JIS と EUC-JP で読んで取り違えらしさの少ないほう。先頭の BOM は落とす
 */
export function decodeText(bytes: Uint8Array): { text: string; encoding: TextEncodingName } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8' };
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16LE' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16BE' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    // UTF-8 ではない：古い日本語の文字コードの中から選ぶ
  }
  let best: { text: string; encoding: TextEncodingName; bad: number } | null = null;
  for (const c of LEGACY) {
    const text = new TextDecoder(c.label).decode(bytes);
    const bad = badness(text);
    if (best === null || bad < best.bad) best = { text, encoding: c.name, bad };
  }
  // LEGACY は空でないので best は必ずある
  return { text: best!.text, encoding: best!.encoding };
}

/** 1行目（引用符の外）の区切りの数で、タブ区切りかカンマ区切りかを決める（同じならカンマ） */
function detectDelimiter(text: string): ',' | '\t' {
  let commas = 0;
  let tabs = 0;
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch === ',') commas++;
    else if (!quoted && ch === '\t') tabs++;
  }
  return tabs > commas ? '\t' : ',';
}

/**
 * CSV の文字 → 行と値（RFC 4180。引用符の中の区切り・改行・「""」を読む。改行は CRLF・LF・CR）。
 * 区切りはカンマかタブを見分ける。値の中の改行は LF にそろえる。最後の空行は落とす
 */
export function parseCsv(text: string): string[][] {
  const sep = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else if (ch === '\r') {
        cell += '\n';
        if (text[i + 1] === '\n') i++;
      } else cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) endCell();
    else if (ch === '\r' || ch === '\n') {
      endRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else cell += ch;
    i++;
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

/** 1つの値を CSV の形に（区切り・改行・「"」・前後の空白があれば引用符で囲む） */
function csvCell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 行と値 → CSV の文字（カンマ区切り・改行は CRLF。Excel が読む形） */
export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** BOM 付きの UTF-8（Excel で開いても文字化けしない） */
export const CSV_BOM = '﻿';

export const CSV_MIME = 'text/csv;charset=utf-8';
