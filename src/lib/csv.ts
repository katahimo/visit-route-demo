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

/** 読めない文字（U+FFFD）の数（どちらの文字コードでも読めてしまうときの取り違えらしさ。小さいほど良い） */
function badness(text: string): number {
  let n = 0;
  for (const ch of text) if (ch === '\uFFFD') n++;
  return n;
}

/** 誤りのある並びがあれば null（fatal で読む） */
function strictDecode(label: string, bytes: Uint8Array): string | null {
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * バイト列 → 文字（文字コードを見分ける）。BOM があればそれに従い、無ければ UTF-8 → Shift_JIS → EUC-JP の順に
 * 誤りなく読めるものを選ぶ（Shift_JIS の漢字の先頭のバイト 0x81〜0x9F は EUC-JP では読めないので、漢字があれば取り違えない）。
 * どれも誤りがあれば、読めない文字の少ないほう。先頭の BOM は落とす
 */
export function decodeText(bytes: Uint8Array): { text: string; encoding: TextEncodingName } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8' };
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16LE' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16BE' };
  const utf8 = strictDecode('utf-8', bytes);
  if (utf8 !== null) return { text: utf8, encoding: 'UTF-8' };
  for (const c of LEGACY) {
    const text = strictDecode(c.label, bytes);
    if (text !== null) return { text, encoding: c.name };
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

/** 表計算のアプリが数式として読む先頭の文字（= + - @。数は除く） */
const FORMULA_START = /^[=+\-@]/;
const NUMBER_TEXT = /^[-+]?\d+(\.\d+)?$/;
/** 数式と読まれないよう、先頭に「'」を付けた印（読み込みで外す） */
const GUARD = "'";

/**
 * 1つの値を CSV の形に。数式と読まれる先頭（= + - @）の文字の値は「'」を前に付ける（数式の差し込み・#NAME? を防ぐ。
 * 読み込みでは unguardCell で外す）。区切り・改行・「"」・前後の空白があれば引用符で囲む
 */
function csvCell(v: string | number | null): string {
  if (v === null) return '';
  const raw = String(v);
  const s = typeof v === 'string' && FORMULA_START.test(raw) && !NUMBER_TEXT.test(raw) ? GUARD + raw : raw;
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 行と値 → CSV の文字（カンマ区切り・改行は CRLF。Excel が読む形） */
export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** 書き出しで数式よけに付けた「'」を外す（「'」の次が = + - @ のときだけ） */
export const unguardCell = (s: string): string =>
  s.startsWith(GUARD) && FORMULA_START.test(s.slice(1)) ? s.slice(1) : s;

/** BOM 付きの UTF-8（Excel で開いても文字化けしない） */
export const CSV_BOM = '﻿';

export const CSV_MIME = 'text/csv;charset=utf-8';
