// 顧客台帳の形（ADR-0073。PRD D386・D387）：介護ソフトの顧客台帳の CSV（利用者名・利用者カナ・住所・電話・請求・口座・利用者状態など29列）を、
// 〈利用者さん〉の名簿の列（表示名・よみ・郵便番号・住所・メモ・段階）の表に写す。名簿のブックと同じ読み方（rosterRows）に渡すための純粋関数
import { normalizeKana } from '../lib/search';
import { CLIENT_COLS, CLIENT_KANA_COL, CLIENT_POSTAL_COL, CLIENT_STAGE_COLS } from './layout';

/** 顧客台帳の列名（読む列） */
const LEDGER = {
  name: '利用者名',
  kana: '利用者カナ',
  postal: '郵便番号',
  prefecture: '都道府県',
  city: '市区町村',
  town: '町名以下',
  building: '建物名',
  phone: '利用者電話番号',
  mobile: '利用者携帯電話番号',
  status: '利用者状態',
  note: '備考',
} as const;

/** 顧客台帳の形と見分ける列（「利用者名」に加えて、このうち1つ以上があれば顧客台帳。名簿の形には無い列名） */
const SIGNS: readonly string[] = [
  LEDGER.kana,
  LEDGER.status,
  LEDGER.town,
  LEDGER.prefecture,
  LEDGER.city,
  LEDGER.phone,
  LEDGER.mobile,
];

/** 〈利用者さん〉の名簿の上限（contracts の clientSchema・clientPlaceSchema と同じ） */
const MAX = { name: 50, kana: 50, address: 200, note: 500 } as const;

/** 利用中の印（これ以外の状態は終了） */
const IN_USE = '利用中';

/** 顧客台帳を読んだ結果：名簿の列の表と、読まなかった列の名前 */
export interface LedgerTable {
  rows: string[][];
  skipped: string[];
}

/** 名簿の列名 → 顧客台帳の列名（エラー文の『列名』を、利用者が手元で見ている台帳の列名で出す） */
const LEDGER_NAME_OF: Record<string, string> = {
  [CLIENT_COLS.name]: LEDGER.name,
  [CLIENT_KANA_COL]: LEDGER.kana,
  [CLIENT_POSTAL_COL]: LEDGER.postal,
  [CLIENT_COLS.address]: LEDGER.town,
  [CLIENT_COLS.note]: LEDGER.note,
  [CLIENT_STAGE_COLS.stage]: LEDGER.status,
};

/** 読み込みのエラー文の『列名』を台帳の列名に直す（顧客台帳の形で読んだときだけ使う） */
export const ledgerErrorMessage = (message: string): string =>
  message.replace(/『([^』]+)』/g, (m, h: string) => (LEDGER_NAME_OF[h] ? `『${LEDGER_NAME_OF[h]}』` : m));

/** 比べるための列名（前後の空白・BOM・全角半角を同一視） */
const key = (s: string) => s.normalize('NFKC').replace(/^﻿/, '').trim();

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

/** 1行目の列名が顧客台帳の形か */
export function isLedgerHeader(header: readonly string[]): boolean {
  const keys = new Set(header.map(key));
  return keys.has(LEDGER.name) && !keys.has(CLIENT_COLS.name) && SIGNS.some((s) => keys.has(s));
}

/** 電話の行（利用者電話番号・携帯。空なら無し）。例：「電話 03-1234-5678　携帯 090-1234-5678」 */
export function phoneLine(phone: string, mobile: string): string {
  return [phone === '' ? '' : `電話 ${phone}`, mobile === '' ? '' : `携帯 ${mobile}`]
    .filter((x) => x !== '')
    .join('　');
}

/**
 * 顧客台帳の表（1行目が列名）→ 名簿の列の表。顧客台帳の形でなければ null。
 * - よみ：カタカナをひらがなにし、空白を詰める（normalizeKana）
 * - 住所：都道府県＋市区町村＋町名以下＋建物名（空の列は飛ばしてつなぐ。区切りは入れない）
 * - 電話：利用者電話番号・携帯を、備考の先頭に1行
 * - 状態：利用中＝利用中、ほか（空を含む）＝終了
 * - 名前・よみ・住所・備考は上限に収める。請求・口座・生年月日・性別・続柄・顧客番号など、読まない列は skipped に名前を挙げる（データに残さない）
 */
export function ledgerToRoster(table: readonly (readonly string[])[]): LedgerTable | null {
  const header = table[0];
  if (!header || !isLedgerHeader(header)) return null;
  const at = new Map<string, number>();
  header.forEach((h, i) => {
    if (!at.has(key(h))) at.set(key(h), i);
  });
  const read = new Set<string>(Object.values(LEDGER));
  const body = table.slice(1);
  const skipped = header
    .map((raw, i) => ({ h: key(raw), i }))
    // 列名が空でも値がある列は「（列名なし・N列目）」として挙げる
    .filter(({ h, i }) => (h === '' ? body.some((r) => (r[i] ?? '').trim() !== '') : !(read.has(h) && at.get(h) === i)))
    .map(({ h, i }) => (h === '' ? `（列名なし・${i + 1}列目）` : h));
  const out: string[][] = [
    [
      CLIENT_COLS.name,
      CLIENT_KANA_COL,
      CLIENT_POSTAL_COL,
      CLIENT_COLS.address,
      CLIENT_COLS.note,
      CLIENT_STAGE_COLS.stage,
    ],
  ];
  for (const r of body) {
    // 空行は空のまま残す（名簿の読み込みが飛ばす。エラーの行番号を元のファイルと合わせる）
    if (r.every((c) => c.trim() === '')) {
      out.push(['', '', '', '', '', '']);
      continue;
    }
    const v = (h: string) => {
      const i = at.get(h);
      return i === undefined ? '' : (r[i] ?? '').trim();
    };
    const address = [LEDGER.prefecture, LEDGER.city, LEDGER.town, LEDGER.building].map(v).join('');
    const note = [phoneLine(v(LEDGER.phone), v(LEDGER.mobile)), v(LEDGER.note)].filter((x) => x !== '').join('\n');
    out.push([
      clip(v(LEDGER.name), MAX.name),
      clip(normalizeKana(v(LEDGER.kana)), MAX.kana),
      v(LEDGER.postal),
      clip(address, MAX.address),
      clip(note, MAX.note),
      v(LEDGER.status) === IN_USE ? '利用中' : '終了',
    ]);
  }
  return { rows: out, skipped };
}
