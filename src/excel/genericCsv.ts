// 列名から読んだ名簿の形（暫定。ADR-0075 の形の一覧の最後）：事業所のソフトが分からないときのために、
// 「名前らしい列」があれば、カナ・郵便番号・住所・電話・メール・性別・緯度・経度・退職日などの列名を探して名簿の列の表に写す。
// アプリ自身の名簿の形（名簿の名前の列がある CSV）と、先に当たる既存の形（顧客台帳・予約システム・職員台帳）は読まない
import type { Item } from '../contracts/rules';
import { normalizeEmail } from '../lib/mailto';
import { normalizePostalCode } from '../lib/postalCode';
import { normalizeKana } from '../lib/search';
import {
  cellOf,
  clip,
  colKey,
  columnMessage,
  columnsOf,
  distinctNames,
  isBlankRow,
  type RosterTable,
  skippedColumns,
} from './csvColumns';
import {
  CLIENT_COLS,
  CLIENT_KANA_COL,
  CLIENT_POSTAL_COL,
  CLIENT_STAGE_COLS,
  STAFF_COLS,
  STAFF_EMAIL_COL,
  STAFF_LAST_DAY_COL,
  TRAIT_PREFIX,
} from './layout';
import { phoneLine } from './ledgerCsv';
import { splitLatLng, splitPostal } from './reserveCsv';
import { NO, parseDateText, YES } from './text';

/** 探す列名（前後の空白・全角半角は無視。上にあるものを先に使う） */
const NAMES = {
  clientName: ['利用者名', '利用者氏名', '氏名', '名前', 'お名前', '顧客名', '患者名'],
  staffName: ['職員名', '職員氏名', 'スタッフ名', '従業員名', '氏名', '名前', '社員名', '看護師名', 'ヘルパー名'],
  family: ['姓', '苗字', '名字'],
  given: ['名', '名前', '下の名前'],
  kana: ['氏名カナ', 'カナ', 'フリガナ', 'ふりがな', 'よみ', '利用者カナ', '職員カナ', '氏名フリガナ', '名前カナ'],
  familyKana: ['姓カナ', '姓（カナ）', '姓フリガナ', '苗字カナ', 'セイ'],
  givenKana: ['名カナ', '名（カナ）', '名フリガナ', 'メイ'],
  id: ['利用者番号', '顧客番号', '社員番号', '職員番号', '患者番号', 'ID', '番号'],
  postal: ['郵便番号', '郵便', '〒'],
  address: ['住所', '所在地'],
  prefecture: ['都道府県'],
  city: ['市区町村'],
  town: ['町名以下', '番地', '町名番地'],
  building: ['建物名'],
  phone: ['電話番号', '電話', 'TEL', '自宅電話番号', '固定電話'],
  mobile: ['携帯電話番号', '携帯電話', '携帯番号', '携帯'],
  email: ['メールアドレス', 'メール', 'Eメール', 'E-mail', 'email', 'mail address', 'Eメールアドレス'],
  gender: ['性別'],
  lat: ['緯度'],
  lng: ['経度'],
  latLng: ['緯度・経度', '緯度経度'],
  lastDay: ['退職日', '退社年月日', '退社日', '退職年月日', '最終勤務日'],
} as const;

/** 〈利用者さん〉・〈スタッフ〉の名簿の上限（contracts の clientSchema・staffSchema・placeSchema と同じ） */
const MAX = { name: 50, kana: 50, address: 200, note: 500 } as const;

/** 〈スタッフ〉の「性別」の項目の名前（項目があれば特性の列に写す） */
const GENDER_ITEM = '性別';

type At = Map<string, number>;
/** 列名の候補のうち、表にある最初の列名（無ければ null） */
const pick = (at: At, names: readonly string[]): string | null => names.find((n) => at.has(colKey(n))) ?? null;
const pickAll = (at: At, names: readonly string[]): string[] => names.filter((n) => at.has(colKey(n)));

/** 読む列名の決まり（表ごと） */
interface Layout {
  /** 名前の列（1つ）か、姓・名の列 */
  name: string[];
  kana: string[];
  id: string | null;
  address: string | null;
  addressParts: string[];
  /** 読んだ列名すべて（読まなかった列の判定に使う） */
  read: string[];
}

/** 名前の列（姓・名が別の列ならその2つ。名前の列が1つあれば先にそれ）。無ければ空 */
function nameColumns(at: At, kind: 'client' | 'staff'): string[] {
  const family = pick(at, NAMES.family);
  const given =
    family === null
      ? null
      : pick(
          at,
          NAMES.given.filter((n) => n !== family),
        );
  if (family !== null && given !== null) return [family, given];
  const one = pick(at, kind === 'client' ? NAMES.clientName : NAMES.staffName);
  return one === null ? [] : [one];
}

/** 1行目の列名から、読む列を決める（名前の列が無ければ null） */
function layoutOf(header: readonly string[], kind: 'client' | 'staff'): Layout | null {
  const at = columnsOf(header);
  const name = nameColumns(at, kind);
  if (name.length === 0) return null;
  // アプリ自身の名簿の形：名簿の名前の列があり、姓・名の列に分かれていない
  const own = kind === 'client' ? CLIENT_COLS.name : STAFF_COLS.name;
  if (at.has(colKey(own)) && name.length === 1) return null;
  const kanaOne = pick(
    at,
    NAMES.kana.filter((n) => !name.includes(n)),
  );
  const kanaSplit = [pick(at, NAMES.familyKana), pick(at, NAMES.givenKana)].filter((x): x is string => x !== null);
  const kana = kanaOne === null ? kanaSplit : [kanaOne];
  const id = pick(at, NAMES.id);
  const address = pick(at, NAMES.address);
  const parts = [NAMES.prefecture, NAMES.city, NAMES.town, NAMES.building].flatMap((n) => pickAll(at, n).slice(0, 1));
  return { name, kana, id, address, addressParts: parts, read: [...name, ...kana, ...(id ? [id] : [])] };
}

/** 名簿の列名 → この形で読んだ列名（誤りの文に使う。列名は表ごとに違うので呼び名にそろえる） */
export const genericClientErrorMessage = columnMessage({
  [CLIENT_COLS.name]: '名前',
  [CLIENT_KANA_COL]: 'カナ',
  [CLIENT_POSTAL_COL]: NAMES.postal[0],
  [CLIENT_COLS.address]: NAMES.address[0],
  [CLIENT_COLS.note]: '電話',
});

/** 名簿の列名 → この形で読んだ列名（〈スタッフ〉） */
export const genericStaffErrorMessage = columnMessage({
  [STAFF_COLS.name]: '名前',
  [STAFF_EMAIL_COL]: NAMES.email[0],
  [STAFF_COLS.address]: NAMES.address[0],
  [STAFF_LAST_DAY_COL]: NAMES.lastDay[0],
});

/** 〈利用者さん〉で、空なら今の値のままにする名簿の列（元の表に無い・空のことが多い値） */
export const GENERIC_CLIENT_KEEP_BLANK: readonly string[] = [
  CLIENT_KANA_COL,
  CLIENT_POSTAL_COL,
  CLIENT_COLS.address,
  CLIENT_COLS.lat,
  CLIENT_COLS.lng,
  CLIENT_COLS.note,
];

/** 〈スタッフ〉で、空なら今の値のままにする名簿の列 */
export const GENERIC_STAFF_KEEP_BLANK: readonly string[] = [
  STAFF_COLS.address,
  STAFF_COLS.lat,
  STAFF_COLS.lng,
  STAFF_EMAIL_COL,
];

/** 行から名前（姓・名なら空白1つでつなぐ） */
const nameOf = (v: (h: string) => string, cols: readonly string[]): string =>
  cols
    .map(v)
    .filter((x) => x !== '')
    .join(' ');

/** 住所：「住所」の列があればそれ、空なら 都道府県＋市区町村＋町名以下＋建物名 をつなぐ（区切りは入れない） */
function addressOf(v: (h: string) => string, l: Layout): string {
  const whole = l.address === null ? '' : v(l.address);
  return whole !== '' ? whole : l.addressParts.map(v).join('');
}

/** 緯度・経度（別の列か「緯度, 経度」の1列）。読めなければ空 */
function latLngOf(at: At, v: (h: string) => string): { lat: string; lng: string } {
  const both = pick(at, NAMES.latLng);
  if (both !== null && v(both) !== '') return splitLatLng(v(both));
  const lat = pick(at, NAMES.lat);
  const lng = pick(at, NAMES.lng);
  return { lat: lat === null ? '' : v(lat), lng: lng === null ? '' : v(lng) };
}

/** 読んだ列に足す緯度・経度の列名 */
const latLngNames = (at: At): string[] =>
  [pick(at, NAMES.latLng), pick(at, NAMES.lat), pick(at, NAMES.lng)].filter((x): x is string => x !== null);

/** 同じ名前の人を分ける ID の列から、行ごとの名前 */
function namesOf(at: At, body: readonly (readonly string[])[], l: Layout): string[] {
  return distinctNames(
    body.map((r) => {
      if (isBlankRow(r)) return { name: '', id: '' };
      const v = cellOf(at, r);
      return { name: nameOf(v, l.name), id: l.id === null ? '' : v(l.id) };
    }),
    MAX.name,
  );
}

/** 空の列（空行・名前の無い行を、行番号を合わせて残す） */
const blankRow = (n: number): string[] => Array.from({ length: n }, () => '');

/**
 * CSV の表（1行目が列名）→〈利用者さん〉の名簿の列の表。名前らしい列が無い・アプリの名簿の形なら null。
 * - 名前：利用者名・氏名・名前など。姓・名が別の列なら「姓 名」。同じ名前の人は ID の列（利用者番号など）があれば「名前（ID）」で分ける
 * - よみ：カナ・フリガナ（姓・名の列も）。ひらがなにして空白を詰める
 * - 郵便番号・住所：郵便番号の列。住所は「住所」1列か 都道府県＋市区町村＋町名以下＋建物名。住所の先頭の郵便番号は郵便番号の列に分ける
 * - 緯度・経度：別の列か「緯度, 経度」の1列
 * - 電話・携帯：メモの先頭に1行
 * - 段階：すべて「利用中」。性別・メール・生年月日・状態などほかの列は読まず、skipped に名前を挙げる
 */
export function genericClientToRoster(table: readonly (readonly string[])[]): RosterTable | null {
  const header = table[0];
  const l = header ? layoutOf(header, 'client') : null;
  if (!header || !l) return null;
  const at = columnsOf(header);
  const body = table.slice(1);
  const names = namesOf(at, body, l);
  const postalCol = pick(at, NAMES.postal);
  const phone = pick(at, NAMES.phone);
  const mobile = pick(at, NAMES.mobile);
  const out: string[][] = [
    [
      CLIENT_COLS.name,
      CLIENT_KANA_COL,
      CLIENT_POSTAL_COL,
      CLIENT_COLS.address,
      CLIENT_COLS.lat,
      CLIENT_COLS.lng,
      CLIENT_COLS.note,
      CLIENT_STAGE_COLS.stage,
    ],
  ];
  body.forEach((r, i) => {
    if (isBlankRow(r)) {
      out.push(blankRow(8));
      return;
    }
    const v = cellOf(at, r);
    const split = splitPostal(addressOf(v, l));
    const postalText = postalCol === null ? '' : v(postalCol);
    const postal = postalText !== '' ? (normalizePostalCode(postalText) ?? postalText) : split.postal;
    const { lat, lng } = latLngOf(at, v);
    const note = phoneLine(phone === null ? '' : v(phone), mobile === null ? '' : v(mobile));
    out.push([
      names[i] ?? '',
      clip(normalizeKana(l.kana.map(v).join('')), MAX.kana),
      postal,
      clip(split.address, MAX.address),
      lat,
      lng,
      clip(note, MAX.note),
      '利用中',
    ]);
  });
  const read = [
    ...l.read,
    ...(postalCol ? [postalCol] : []),
    ...(l.address ? [l.address] : []),
    ...l.addressParts,
    ...(phone ? [phone] : []),
    ...(mobile ? [mobile] : []),
    ...latLngNames(at),
  ];
  return { rows: out, skipped: skippedColumns(header, body, read) };
}

/** 性別の文字 → 項目「性別」の選択肢（そのまま・全角半角をそろえて・「女」「男」の頭の文字で合う選択肢）。合わなければ空 */
function genderOption(item: Item, text: string): string {
  const t = text.normalize('NFKC').trim();
  if (t === '') return '';
  const exact = item.options.find((o) => o.normalize('NFKC') === t);
  if (exact) return exact;
  return item.options.find((o) => t !== '' && o.startsWith(t.slice(0, 1)) && /^[男女]/.test(t)) ?? '';
}

/**
 * CSV の表（1行目が列名）→〈スタッフ〉の名簿の列の表。名前らしい列が無い・アプリの名簿の形なら null。
 * - 名前・住所・緯度・経度：〈利用者さん〉と同じ読み方（郵便番号・よみ・電話は〈スタッフ〉の名簿に無いので読まず、skipped に挙げる）
 * - メールアドレス：形の違う値は読まず、skipped に「〈列名〉（形の違う値 N件）」
 * - 性別：〈スタッフ〉の項目「性別」（選択肢から1つ）があれば特性の列へ。選択肢に合わない値は空（未確認）
 * - 退職日・退社年月日：最終勤務日にする。today より前なら休止（×）、ほかは利用中（○）。読めない値はそのまま渡し、名簿の読み込みが誤りにする
 */
export function genericStaffToRoster(
  table: readonly (readonly string[])[],
  today: string,
  items: readonly Item[],
): RosterTable | null {
  const header = table[0];
  const l = header ? layoutOf(header, 'staff') : null;
  if (!header || !l) return null;
  const at = columnsOf(header);
  const body = table.slice(1);
  const names = namesOf(at, body, l);
  const emailCol = pick(at, NAMES.email);
  const lastCol = pick(at, NAMES.lastDay);
  const genderCol = pick(at, NAMES.gender);
  const item = items.find((it) => it.target === 'staff' && it.kind === 'choice' && it.name === GENDER_ITEM);
  const gender = genderCol !== null && item ? { col: genderCol, item } : null;
  const fixed = [STAFF_COLS.name, STAFF_EMAIL_COL, STAFF_COLS.address, STAFF_COLS.lat, STAFF_COLS.lng];
  const head = [...fixed, STAFF_COLS.active, STAFF_LAST_DAY_COL, ...(gender ? [`${TRAIT_PREFIX}${GENDER_ITEM}`] : [])];
  const out: string[][] = [head];
  let badEmails = 0;
  body.forEach((r, i) => {
    if (isBlankRow(r) || (names[i] ?? '') === '') {
      out.push(blankRow(head.length));
      return;
    }
    const v = cellOf(at, r);
    const email = normalizeEmail(emailCol === null ? '' : v(emailCol));
    if (email === null) badEmails++;
    const { lat, lng } = latLngOf(at, v);
    const last = lastCol === null ? '' : v(lastCol);
    const lastDay = last === '' ? '' : (parseDateText(last) ?? last);
    const left = /^\d{4}-\d{2}-\d{2}$/.test(lastDay) && lastDay < today;
    out.push([
      names[i] ?? '',
      email ?? '',
      clip(addressOf(v, l), MAX.address),
      lat,
      lng,
      left ? NO : YES,
      lastDay,
      ...(gender ? [genderOption(gender.item, v(gender.col))] : []),
    ]);
  });
  const read = [
    ...l.read.filter((h) => !l.kana.includes(h)),
    ...(l.address ? [l.address] : []),
    ...l.addressParts,
    ...(emailCol ? [emailCol] : []),
    ...(lastCol ? [lastCol] : []),
    ...(gender ? [gender.col] : []),
    ...latLngNames(at),
  ];
  const skipped = skippedColumns(header, body, read);
  if (emailCol !== null && badEmails > 0) skipped.push(`${emailCol}（形の違う値 ${badEmails}件）`);
  return { rows: out, skipped };
}
