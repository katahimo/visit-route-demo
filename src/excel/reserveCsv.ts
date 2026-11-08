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
  CLIENT_PLACE2_COLS,
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
  /** 期間つきの訪問先（ADR-0105。契約者の住所と違う所へ、適用開始日〜終了日だけ訪ねる） */
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
  [CLIENT_POSTAL_COL]: CLIENT.address,
  [CLIENT_COLS.address]: CLIENT.address,
  [CLIENT_PLACE2_COLS.address]: CLIENT.address2,
  [CLIENT_PLACE2_COLS.postal]: CLIENT.address2,
  [CLIENT_PLACE2_COLS.lat]: CLIENT.latLng,
  [CLIENT_PLACE2_COLS.lng]: CLIENT.latLng,
  [CLIENT_PLACE2_COLS.from]: CLIENT.address2From,
  [CLIENT_PLACE2_COLS.to]: CLIENT.address2To,
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

/** 住所2 の期間の日付（YYYY-MM-DD）。空は ''、読めなければ null */
const termDate = (text: string): string | null => (text === '' ? '' : parseDateText(text));

/**
 * 住所2 の列（名簿の CLIENT_PLACE2_COLS の並び）。住所2 が空なら全部空（名簿の読み込みで住所2 なし）。
 * 緯度・経度の列は、住所2 があれば住所2 の位置。期間の日付が読めない・終了日が開始日より前なら、
 * 期間を空にすると毎日が住所2 になってしまうので住所2 を入れず（全部空）、bad に数える
 */
function place2Row(v: (h: string) => string, bad: { n: number }): string[] {
  const none = ['', '', '', '', '', ''];
  const second = v(CLIENT.address2);
  if (second === '') return none;
  const [from, to] = [termDate(v(CLIENT.address2From)), termDate(v(CLIENT.address2To))];
  if (from === null || to === null || (from !== '' && to !== '' && to < from)) {
    bad.n++;
    return none;
  }
  const { postal, address } = splitPostal(second);
  const { lat, lng } = splitLatLng(v(CLIENT.latLng));
  return [clip(address, MAX.address), postal, lat, lng, from, to];
}

/**
 * 顧客の CSV（1行目が列名）→〈利用者さん〉の名簿の列の表。形が違えば null。
 * - 表示名：姓＋名（空ならカナ、それも空なら顧客ID）。同じ名前の人は全員「名前（顧客ID）」にして分ける（ファイルの並びに左右されない）
 * - よみ：姓（カナ）＋名（カナ）をひらがなにし、空白を詰める（normalizeKana）
 * - 住所：契約者の住所（いつもの訪問先）。先頭の郵便番号（〒 付きも）は郵便番号の列へ分ける
 * - 住所2・適用開始日・適用終了日：期間つきの訪問先（ADR-0105）。期間内の訪問は住所2 へ行く（domain/place2）。
 *   住所2 の列がある CSV では、住所2 が空の人は住所2 なしにする（正本は予約システム）。期間の日付が読めない・逆なら住所2 を入れず、skipped に件数
 * - 緯度・経度：「緯度, 経度」を2つの列に分ける。住所2 があればその位置（無ければ住所の位置）
 * - 駐車場：駐車場＋詳細を決まりごとの「駐車場」へ
 * - 電話：メモの先頭に1行（顧客メモを続ける）
 * - 会員状況：無効＝終了、ほか（空を含む）＝利用中
 * - メールアドレス・会費・パスワード・性別・年代・緊急連絡先・避難場所・世帯の情報などは読まず、skipped に名前を挙げる
 */
export function reserveClientToRoster(table: readonly (readonly string[])[]): RosterTable | null {
  const header = table[0];
  if (!header || !isReserveClientHeader(header)) return null;
  const at = columnsOf(header);
  const body = table.slice(1);
  /** 住所2 の列がある CSV か（無い古い書き出しなら、アプリの住所2 は今のまま） */
  const withPlace2 = at.has(colKey(CLIENT.address2));
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
      ...(withPlace2 ? Object.values(CLIENT_PLACE2_COLS) : []),
    ],
  ];
  const badTerms = { n: 0 };
  body.forEach((r, i) => {
    if (isBlankRow(r)) {
      out.push(out[0]!.map(() => ''));
      return;
    }
    const v = cellOf(at, r);
    const { postal, address } = splitPostal(v(CLIENT.address));
    // 緯度・経度は住所2 があれば住所2 の位置なので、住所の位置には使わない（住所2 を入れなかった行も）
    const second = withPlace2 && v(CLIENT.address2) !== '';
    const { lat, lng } = second ? { lat: '', lng: '' } : splitLatLng(v(CLIENT.latLng));
    const parking = [v(CLIENT.parking), v(CLIENT.parkingDetail)].filter((x) => x !== '').join('　');
    const note = [phoneLine(v(CLIENT.phone), ''), v(CLIENT.memo)].filter((x) => x !== '').join('\n');
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
      ...(withPlace2 ? place2Row(v, badTerms) : []),
    ]);
  });
  const skipped = skippedColumns(header, body, Object.values(CLIENT));
  if (badTerms.n > 0) skipped.push(`住所2（適用期間の日付が読めない・逆のため入れなかった ${badTerms.n}件）`);
  return { rows: out, skipped };
}
