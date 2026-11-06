// 予約システムの形（ADR-0075。PRD D396・D397）：予約システムから書き出したスタッフの CSV（ID・氏名・TEL・mail address・緯度・経度・入社日・退職日 …）と
// 顧客の CSV（顧客ID・姓・名・姓（カナ）・住所・駐車場・住所2・緯度・経度 …）を、〈スタッフ〉・〈利用者さん〉の名簿の列の表に写す。
// 名簿のブックと同じ読み方（rosterRows）に渡すための純粋関数（顧客台帳の形 ledgerCsv と同じ作り）
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
  hasColumns,
  isBlankRow,
  type RosterTable,
  skippedColumns,
} from './csvColumns';
import {
  CLIENT_COLS,
  CLIENT_KANA_COL,
  CLIENT_POSTAL_COL,
  CLIENT_RULE_COLS,
  CLIENT_STAGE_COLS,
  STAFF_COLS,
  STAFF_EMAIL_COL,
  STAFF_LAST_DAY_COL,
} from './layout';
import { phoneLine } from './ledgerCsv';
import { NO, parseDateText, YES } from './text';

/** スタッフの CSV の列名（読む列） */
const STAFF = {
  id: 'ID',
  name: '氏名',
  address: '住所',
  email: 'mail address',
  latLng: '緯度・経度',
  lastDay: '退職日',
} as const;

/** 顧客の CSV の列名（読む列） */
const CLIENT = {
  id: '顧客ID',
  family: '姓',
  given: '名',
  familyKana: '姓（カナ）※必須項目',
  givenKana: '名（カナ）※必須項目',
  phone: '電話番号※必須項目',
  status: '会員状況（有効／無効）',
  memo: '顧客メモ',
  address: '住所',
  /** 訪問先の住所（契約者の住所と違う所へ訪ねるとき。あれば訪問先はこちら。住所は契約者の住所としてメモへ） */
  address2: '住所2',
  address2From: '住所2[適用開始日YYYY/MM/DD]',
  address2To: '住所2[適用終了日YYYY/MM/DD]',
  parking: '駐車場',
  parkingDetail: '駐車場番号・指定場所の詳細など',
  latLng: '緯度・経度',
} as const;

/** 名簿の上限（contracts の staffSchema・clientSchema・clientPlaceSchema と同じ） */
const MAX = { name: 50, kana: 50, address: 200, note: 500, rule: 200 } as const;

/** 1行目の列名がスタッフの CSV の形か（ID・氏名・緯度・経度・退職日がそろう。名簿の形の「名前」は無い） */
export function isReserveStaffHeader(header: readonly string[]): boolean {
  const at = columnsOf(header);
  return hasColumns(at, [STAFF.id, STAFF.name, STAFF.latLng, STAFF.lastDay]) && !at.has(colKey(STAFF_COLS.name));
}

/** 1行目の列名が顧客の CSV の形か（顧客ID・姓・名・姓（カナ）がそろう） */
export function isReserveClientHeader(header: readonly string[]): boolean {
  return hasColumns(columnsOf(header), [CLIENT.id, CLIENT.family, CLIENT.given, CLIENT.familyKana]);
}

/** 「38.3174, 140.8119」→ 緯度・経度の文字（読めなければ空。範囲は名簿の読み込みが確かめる） */
export function splitLatLng(text: string): { lat: string; lng: string } {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,，、\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text.normalize('NFKC'));
  return m ? { lat: m[1] ?? '', lng: m[2] ?? '' } : { lat: '', lng: '' };
}

/** 住所の先頭の郵便番号（「〒984-0802 仙台市…」「982-0037 仙台市…」）を分ける。無ければ郵便番号は空 */
export function splitPostal(address: string): { postal: string; address: string } {
  const m = /^〒?\s*(\d{3}[-－‐ー]?\d{4})\s*(.*)$/.exec(address.trim());
  const postal = m ? normalizePostalCode(m[1] ?? '') : null;
  return postal && m ? { postal, address: (m[2] ?? '').trim() } : { postal: '', address: address.trim() };
}

/** 名簿の列名 → スタッフの CSV の列名（誤りの文に使う） */
export const reserveStaffErrorMessage = columnMessage({
  [STAFF_COLS.name]: STAFF.name,
  [STAFF_EMAIL_COL]: STAFF.email,
  [STAFF_COLS.address]: STAFF.address,
  [STAFF_COLS.lat]: STAFF.latLng,
  [STAFF_COLS.lng]: STAFF.latLng,
  [STAFF_LAST_DAY_COL]: STAFF.lastDay,
});

/** 名簿の列名 → 顧客の CSV の列名（誤りの文に使う） */
export const reserveClientErrorMessage = columnMessage({
  [CLIENT_COLS.name]: `${CLIENT.family}・${CLIENT.given}`,
  [CLIENT_POSTAL_COL]: `${CLIENT.address2}・${CLIENT.address}`,
  [CLIENT_COLS.address]: `${CLIENT.address2}・${CLIENT.address}`,
  [CLIENT_COLS.lat]: CLIENT.latLng,
  [CLIENT_COLS.lng]: CLIENT.latLng,
  [CLIENT_COLS.note]: `${CLIENT.phone}・${CLIENT.memo}`,
});

/** スタッフの CSV で、空なら今の値のままにする名簿の列（アプリで入れた住所・位置・メールを消さない） */
export const RESERVE_STAFF_KEEP_BLANK: readonly string[] = [
  STAFF_COLS.address,
  STAFF_COLS.lat,
  STAFF_COLS.lng,
  STAFF_EMAIL_COL,
];

/** 顧客の CSV で、空なら今の値のままにする名簿の列 */
export const RESERVE_CLIENT_KEEP_BLANK: readonly string[] = [
  CLIENT_KANA_COL,
  CLIENT_POSTAL_COL,
  CLIENT_COLS.address,
  CLIENT_COLS.lat,
  CLIENT_COLS.lng,
  CLIENT_RULE_COLS.parking,
  CLIENT_COLS.note,
];

/**
 * スタッフの CSV（1行目が列名）→〈スタッフ〉の名簿の列の表。形が違えば null。
 * - 氏名が空の行（枠だけの ID）は飛ばす（空行にして行番号を元のファイルと合わせる）
 * - 同じ氏名の人は全員「氏名（ID）」にして分ける
 * - 退職日：最終勤務日にする（2026.3.31・2026/3/31・2026年3月31日）。today より前に辞めた人は休止（×）、ほかは利用中（○）。
 *   読めない退職日はそのまま渡し、名簿の読み込みが『退職日』の誤りにする
 * - mail address：形の違う値は読まず、skipped に「mail address（形の違う値 N件）」を挙げる
 * - 緯度・経度：「緯度, 経度」を2つの列に分ける
 * - TEL・入社日・ユーザーID・パスワード・管理者・性別などは読まず、skipped に名前を挙げる（データに残さない）
 */
export function reserveStaffToRoster(table: readonly (readonly string[])[], today: string): RosterTable | null {
  const header = table[0];
  if (!header || !isReserveStaffHeader(header)) return null;
  const at = columnsOf(header);
  const body = table.slice(1);
  const names = distinctNames(
    body.map((r) => ({ name: cellOf(at, r)(STAFF.name), id: cellOf(at, r)(STAFF.id) })),
    MAX.name,
  );
  let badEmails = 0;
  const out: string[][] = [
    [
      STAFF_COLS.name,
      STAFF_EMAIL_COL,
      STAFF_COLS.address,
      STAFF_COLS.lat,
      STAFF_COLS.lng,
      STAFF_COLS.active,
      STAFF_LAST_DAY_COL,
    ],
  ];
  body.forEach((r, i) => {
    const v = cellOf(at, r);
    if (v(STAFF.name) === '') {
      out.push(['', '', '', '', '', '', '']);
      return;
    }
    const { lat, lng } = splitLatLng(v(STAFF.latLng));
    const email = normalizeEmail(v(STAFF.email));
    if (email === null) badEmails++;
    const last = v(STAFF.lastDay);
    const lastDay = last === '' ? '' : (parseDateText(last) ?? last);
    const left = /^\d{4}-\d{2}-\d{2}$/.test(lastDay) && lastDay < today;
    out.push([names[i] ?? '', email ?? '', clip(v(STAFF.address), MAX.address), lat, lng, left ? NO : YES, lastDay]);
  });
  const skipped = skippedColumns(header, body, Object.values(STAFF));
  if (badEmails > 0) skipped.push(`${STAFF.email}（形の違う値 ${badEmails}件）`);
  return { rows: out, skipped };
}

/** 顧客の名前：姓＋名（空白1つ）。どちらも空ならカナ、それも空なら顧客ID */
function clientName(v: (h: string) => string): string {
  const name = [v(CLIENT.family), v(CLIENT.given)].filter((x) => x !== '').join(' ');
  if (name !== '') return name;
  const kana = [v(CLIENT.familyKana), v(CLIENT.givenKana)].filter((x) => x !== '').join(' ');
  return kana !== '' ? kana : v(CLIENT.id);
}

/** 住所2 の適用期間に today（YYYY-MM-DD）が入るか。空・読めない日付の端は限らない（開始・終了の日も入る） */
function inTerm(from: string, to: string, today: string): boolean {
  const f = parseDateText(from);
  const t = parseDateText(to);
  return (f === null || f <= today) && (t === null || today <= t);
}

/**
 * 訪問先の住所と、メモに足す行（取り込んだ日 today で決める。顧客の正本は予約システムで、読み直すたびに決め直す）。
 * - 住所2 が空：訪問先は住所
 * - 住所2 があり、期間が空か期間内：訪問先は住所2。住所は「契約者の住所」の行にする（住所2 と同じなら付けない）。緯度・経度は住所2 の位置
 * - 住所2 があり、期間外：訪問先は住所。住所2 は「住所2 …（期間外）」の行にする。緯度・経度は住所2 の位置なので読まない
 * 期間があれば行に添える
 */
function visitAddress(v: (h: string) => string, today: string): { visit: string; line: string; useLatLng: boolean } {
  const home = v(CLIENT.address);
  const second = v(CLIENT.address2);
  if (second === '') return { visit: home, line: '', useLatLng: true };
  const from = v(CLIENT.address2From);
  const to = v(CLIENT.address2To);
  const term = from === '' && to === '' ? '' : `期間 ${from}〜${to}`;
  if (inTerm(from, to, today)) {
    const contract = home === '' || home === second ? '' : `契約者の住所 ${home}`;
    return {
      visit: second,
      line: contract === '' ? '' : `${contract}${term ? `（住所2の${term}）` : ''}`,
      useLatLng: true,
    };
  }
  return { visit: home, line: `住所2 ${second}（${term}。期間外）`, useLatLng: false };
}

/**
 * 顧客の CSV（1行目が列名）→〈利用者さん〉の名簿の列の表。形が違えば null。
 * - 表示名：姓＋名（空ならカナ、それも空なら顧客ID）。同じ名前の人は全員「名前（顧客ID）」にして分ける（ファイルの並びに左右されない）
 * - よみ：姓（カナ）＋名（カナ）をひらがなにし、空白を詰める（normalizeKana）
 * - 住所：訪問先の住所。住所2 があり、期間が空か today が期間内なら住所2（住所は「契約者の住所」としてメモの電話の次の行へ）、
 *   期間外なら住所（住所2 はメモへ）。visitAddress。先頭の郵便番号（〒 付きも）は郵便番号の列へ分ける
 * - 緯度・経度：「緯度, 経度」を2つの列に分ける
 * - 駐車場：駐車場＋詳細を決まりごとの「駐車場」へ
 * - 電話：メモの先頭に1行（顧客メモを続ける）
 * - 会員状況：無効＝終了、ほか（空を含む）＝利用中
 * - メールアドレス・会費・パスワード・性別・年代・緊急連絡先・避難場所・世帯の情報などは読まず、skipped に名前を挙げる
 */
export function reserveClientToRoster(table: readonly (readonly string[])[], today: string): RosterTable | null {
  const header = table[0];
  if (!header || !isReserveClientHeader(header)) return null;
  const at = columnsOf(header);
  const body = table.slice(1);
  const names = distinctNames(
    body.map((r) =>
      isBlankRow(r) ? { name: '', id: '' } : { name: clientName(cellOf(at, r)), id: cellOf(at, r)(CLIENT.id) },
    ),
    MAX.name,
  );
  const out: string[][] = [
    [
      CLIENT_COLS.name,
      CLIENT_KANA_COL,
      CLIENT_POSTAL_COL,
      CLIENT_COLS.address,
      CLIENT_COLS.lat,
      CLIENT_COLS.lng,
      CLIENT_RULE_COLS.parking,
      CLIENT_COLS.note,
      CLIENT_STAGE_COLS.stage,
    ],
  ];
  body.forEach((r, i) => {
    if (isBlankRow(r)) {
      out.push(['', '', '', '', '', '', '', '', '']);
      return;
    }
    const v = cellOf(at, r);
    const { visit, line, useLatLng } = visitAddress(v, today);
    const { postal, address } = splitPostal(visit);
    const { lat, lng } = useLatLng ? splitLatLng(v(CLIENT.latLng)) : { lat: '', lng: '' };
    const parking = [v(CLIENT.parking), v(CLIENT.parkingDetail)].filter((x) => x !== '').join('　');
    const note = [phoneLine(v(CLIENT.phone), ''), line, v(CLIENT.memo)].filter((x) => x !== '').join('\n');
    out.push([
      names[i] ?? '',
      clip(normalizeKana(`${v(CLIENT.familyKana)}${v(CLIENT.givenKana)}`), MAX.kana),
      postal,
      clip(address, MAX.address),
      lat,
      lng,
      clip(parking, MAX.rule),
      clip(note, MAX.note),
      v(CLIENT.status) === '無効' ? '終了' : '利用中',
    ]);
  });
  return { rows: out, skipped: skippedColumns(header, body, Object.values(CLIENT)) };
}
