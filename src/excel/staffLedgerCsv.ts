// 職員台帳の形（ADR-0075 の形の一覧に1行。PRD D421）：介護ソフトの職員台帳の CSV（所属・社員番号・職員名・職員カナ・入社年月日・退社年月日・
// 郵便番号〜建物名・電話・Eメール・雇用形態・在職状況・資格の取得日の列 …）を、〈スタッフ〉の名簿の列の表に写す。
// 顧客台帳（ledgerCsv）と同じソフトの書き出し。名簿のブックと同じ読み方（rosterRows）に渡すための純粋関数
import type { Item } from '../contracts/rules';
import { normalizeEmail } from '../lib/mailto';
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
import { STAFF_COLS, STAFF_EMAIL_COL, STAFF_LAST_DAY_COL, traitCols } from './layout';
import { NO, parseDateText, YES } from './text';

/** 職員台帳の列名（読む列） */
const STAFF_LEDGER = {
  name: '職員名',
  no: '社員番号',
  prefecture: '都道府県',
  city: '市区町村',
  town: '町名以下',
  building: '建物名',
  email: '職員Eメールアドレス',
  leftOn: '退社年月日',
  status: '在職状況',
} as const;

/** 職員台帳と見分ける列（「職員名」に加えて、このうち1つ以上があれば職員台帳。名簿の形には無い列名） */
const SIGNS: readonly string[] = [
  '職員カナ',
  STAFF_LEDGER.status,
  STAFF_LEDGER.no,
  STAFF_LEDGER.town,
  STAFF_LEDGER.email,
];

/** 辞めた人の在職状況（これなら休止） */
const LEFT = '退社済';

/** 〈スタッフ〉の名簿の上限（contracts の staffSchema・placeSchema と同じ） */
const MAX = { name: 50, address: 200 } as const;

/**
 * 資格の選択肢 → 職員台帳の列（どれかに取得日か「取得日不明」などの値があれば、その資格あり）。
 * ここに無い選択肢は同じ名前の列だけを見る（介護福祉士・看護師・理学療法士 など）。
 * 「初任者研修」は、初任者研修と同じかそれ以上の研修（旧ホームヘルパー1・2級・介護職員基礎研修・実務者研修）も含める
 */
const QUALIFICATION_ALIASES: Readonly<Record<string, readonly string[]>> = {
  初任者研修: [
    '介護職員初任者研修',
    '居宅介護職員初任者研修課程',
    '介護福祉士実務者研修',
    '介護職員基礎研修',
    'ホームヘルパー1級',
    'ホームヘルパー2級',
  ],
};

/** 1行目の列名が職員台帳の形か */
export function isStaffLedgerHeader(header: readonly string[]): boolean {
  const at = columnsOf(header);
  return (
    hasColumns(at, [STAFF_LEDGER.name]) && !at.has(colKey(STAFF_COLS.name)) && SIGNS.some((s) => at.has(colKey(s)))
  );
}

/** 資格の列1つ：名簿の見出し（特性：〈項目〉：〈選択肢〉）と、見る職員台帳の列 */
interface QualificationCol {
  header: string;
  sources: string[];
}

/**
 * 〈スタッフ〉の選択肢から複数の項目（初期は「資格」「研修」）の選択肢ごとの列。職員台帳に合う列が1つも無い項目は出さない（今のまま）。
 * 名簿の読み込みは選択肢の列をすべて求めるので、合う項目では台帳に列の無い選択肢（保育士など）も sources を空にして出す（セルは空＝持たない）
 */
export function qualificationCols(header: readonly string[], items: readonly Item[]): QualificationCol[] {
  const at = columnsOf(header);
  return items
    .filter((it) => it.target === 'staff' && it.kind === 'multi')
    .flatMap((item) => {
      // 見出しは名簿の書き出しと同じ（layout の traitCols。選択肢ごとの列）
      const cols = traitCols(item).map((c) => ({
        header: c.header,
        sources: [c.option ?? '', ...(QUALIFICATION_ALIASES[c.option ?? ''] ?? [])].filter(
          (h) => h !== '' && at.has(colKey(h)),
        ),
      }));
      return cols.some((c) => c.sources.length > 0) ? cols : [];
    });
}

/** 名簿の列名 → 職員台帳の列名（誤りの文に使う） */
export const staffLedgerErrorMessage = columnMessage({
  [STAFF_COLS.name]: STAFF_LEDGER.name,
  [STAFF_EMAIL_COL]: STAFF_LEDGER.email,
  [STAFF_COLS.address]: `${STAFF_LEDGER.prefecture}〜${STAFF_LEDGER.building}`,
  [STAFF_LAST_DAY_COL]: STAFF_LEDGER.leftOn,
});

/** 職員台帳で、空なら今の値のままにする名簿の列（アプリで入れた住所・メールを消さない） */
export const STAFF_LEDGER_KEEP_BLANK: readonly string[] = [STAFF_COLS.address, STAFF_EMAIL_COL];

/**
 * 職員台帳の表（1行目が列名）→〈スタッフ〉の名簿の列の表。職員台帳の形でなければ null。
 * - 職員名が空の行は飛ばす（空行にして行番号を元のファイルと合わせる）。件数を skipped に「職員名（空の行 N件）」
 * - 同じ職員名の人は全員「職員名（社員番号）」にして分ける
 * - 住所：都道府県＋市区町村＋町名以下＋建物名（空の列は飛ばしてつなぐ）。郵便番号は〈スタッフ〉に無いので読まない
 * - 職員Eメールアドレス：形の違う値は読まず、skipped に「職員Eメールアドレス（形の違う値 N件）」
 * - 退社年月日：最終勤務日にする。在職状況が「退社済」か、退社年月日が today より前なら休止（×）、ほかは利用中（○）。
 *   読めない退社年月日はそのまま渡し、名簿の読み込みが『退社年月日』の誤りにする
 * - 資格・研修：〈スタッフ〉の選択肢から複数の項目の選択肢に合う列（qualificationCols）に値（取得日・取得日不明など）があれば ○、無ければ ×。
 *   台帳に列の無い選択肢は空（読み込むと持たない）
 * - カナ・入社年月日・電話・雇用形態・所属・ほかの資格などは読まず、skipped に名前を挙げる（データに残さない）
 */
export function staffLedgerToRoster(
  table: readonly (readonly string[])[],
  today: string,
  items: readonly Item[],
): RosterTable | null {
  const header = table[0];
  if (!header || !isStaffLedgerHeader(header)) return null;
  const at = columnsOf(header);
  const body = table.slice(1);
  const quals = qualificationCols(header, items);
  const names = distinctNames(
    body.map((r) => ({ name: cellOf(at, r)(STAFF_LEDGER.name), id: cellOf(at, r)(STAFF_LEDGER.no) })),
    MAX.name,
  );
  const fixed = [STAFF_COLS.name, STAFF_EMAIL_COL, STAFF_COLS.address, STAFF_COLS.active, STAFF_LAST_DAY_COL];
  const out: string[][] = [[...fixed, ...quals.map((q) => q.header)]];
  const blank = () => out.push([...fixed, ...quals].map(() => ''));
  let badEmails = 0;
  let unnamed = 0;
  body.forEach((r, i) => {
    const v = cellOf(at, r);
    if (v(STAFF_LEDGER.name) === '') {
      if (!isBlankRow(r)) unnamed++;
      blank();
      return;
    }
    const email = normalizeEmail(v(STAFF_LEDGER.email));
    if (email === null) badEmails++;
    const address = [STAFF_LEDGER.prefecture, STAFF_LEDGER.city, STAFF_LEDGER.town, STAFF_LEDGER.building]
      .map(v)
      .join('');
    const left = v(STAFF_LEDGER.leftOn);
    const lastDay = left === '' ? '' : (parseDateText(left) ?? left);
    const gone = v(STAFF_LEDGER.status) === LEFT || (/^\d{4}-\d{2}-\d{2}$/.test(lastDay) && lastDay < today);
    out.push([
      names[i] ?? '',
      email ?? '',
      clip(address, MAX.address),
      gone ? NO : YES,
      lastDay,
      ...quals.map((q) => (q.sources.length === 0 ? '' : q.sources.some((h) => v(h) !== '') ? YES : NO)),
    ]);
  });
  const read = [...Object.values(STAFF_LEDGER), ...quals.flatMap((q) => q.sources)];
  const skipped = skippedColumns(header, body, read);
  if (badEmails > 0) skipped.push(`${STAFF_LEDGER.email}（形の違う値 ${badEmails}件）`);
  if (unnamed > 0) skipped.push(`${STAFF_LEDGER.name}（空の行 ${unnamed}件）`);
  return { rows: out, skipped };
}
