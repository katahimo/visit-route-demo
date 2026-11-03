// 名簿のブックの「書き方」「記入例」のシート（読み込みでは見ない。PRD D103）
import type ExcelJS from 'exceljs';
import type { DemoData, RosterKind } from '../contracts/data';
import type { Item } from '../contracts/rules';
import { addTable, type CellIn, type TableSpec } from './exportTable';
import {
  CLIENT_ALLOWED_COL,
  CLIENT_COLS,
  CLIENT_KANA_COL,
  CLIENT_POSTAL_COL,
  CLIENT_RULE_COLS,
  CLIENT_STAGE_COLS,
  CLIENT_TENTATIVE_COL,
  prefHeader,
  reqHeader,
  STAFF_COLS,
  STAFF_EMAIL_COL,
  STAFF_ICON_COL,
  STAFF_LAST_DAY_COL,
  traitCols,
} from './layout';
import { YES } from './text';

export const GUIDE_SHEET = '書き方';
export const SAMPLE_SHEET = '記入例';

/** 列ごとの説明：何を書くか・例・空のとき */
interface ColDoc {
  what: string;
  example: string;
  blank: string;
}
const doc = (what: string, example: string, blank: string): ColDoc => ({ what, example, blank });

/** 行の数だけ並べる架空の値（列名 → 値）。名前は「記入例」と分かるもの、住所は仙台市の公共施設 */
type Sample = Record<string, CellIn>;

const PLACES = [
  { address: '仙台市青葉区国分町3丁目7-1', postal: '9808671' },
  { address: '仙台市青葉区春日町2-1', postal: '9800821' },
  { address: '仙台市青葉区上杉1丁目5-1', postal: '9808701' },
];

function staffDocs(t: DemoData['org']['terms']): [string, ColDoc][] {
  const S = STAFF_COLS;
  return [
    [S.id, doc('いま名簿にいる人を直すときの番号です。新しい人は空にします', '（空）', '空なら新しい人として足します')],
    [S.name, doc(`${t.staff}の名前です。必ず書きます`, '記入例 はなこ', '空の行は読めません')],
    [S.travelMode, doc('車・自転車・徒歩・公共交通から選びます', '車', '空なら車')],
    [S.workDays, doc('勤務する曜日を続けて書きます', '月火水木金', '空なら 月〜金')],
    [S.shiftStart, doc('勤務を始める時刻です', '9:00', '空なら 9:00')],
    [S.shiftEnd, doc('勤務を終える時刻です', '18:00', '空なら 18:00')],
    [S.active, doc('いま勤務している人に ○ を付けます', YES, '空なら利用中')],
    [S.address, doc('自宅の住所です', PLACES[0].address, '空のまま')],
    [S.lat, doc('地図の位置（緯度）です。わからなければ空でかまいません', '38.2682', '空のまま')],
    [S.lng, doc('地図の位置（経度）です。わからなければ空でかまいません', '140.8694', '空のまま')],
    [STAFF_LAST_DAY_COL, doc('辞める人・担当を外れる人の最後の勤務日です', '2026-12-28', '空ならなし')],
    [STAFF_EMAIL_COL, doc('予定をメールで送るときの宛先です', 'hanako@example.com', '空のまま')],
    [STAFF_ICON_COL, doc('画面の印に出す1〜2文字です', '花', '空なら苗字の最初の1文字')],
  ];
}

function clientDocs(t: DemoData['org']['terms']): [string, ColDoc][] {
  const C = CLIENT_COLS;
  const G = CLIENT_STAGE_COLS;
  const R = CLIENT_RULE_COLS;
  return [
    [C.id, doc('いま名簿にいる人を直すときの番号です。新しい人は空にします', '（空）', '空なら新しい人として足します')],
    [C.name, doc(`${t.client}の名前です。必ず書きます`, '記入例 さくら', '空の行は読めません')],
    [CLIENT_KANA_COL, doc('名前のよみ（ひらがな）です', 'きにゅうれい さくら', '空のまま')],
    [C.color, doc('画面で使う色の番号です（1〜8）', '1', '空なら順に決まります')],
    [C.active, doc(`いま${t.client}として使っている人に ○ を付けます`, YES, '空なら利用中')],
    [CLIENT_TENTATIVE_COL, doc('日程を仮に押さえている人に ○ を付けます', '', '空なら付けない')],
    [CLIENT_POSTAL_COL, doc('7桁の数字です（ハイフンは有っても無くてもかまいません）', PLACES[0].postal, '空のまま')],
    [C.address, doc('訪問先の住所です', PLACES[0].address, '空のまま')],
    [C.lat, doc('地図の位置（緯度）です。わからなければ空でかまいません', '38.2682', '空のまま')],
    [C.lng, doc('地図の位置（経度）です。わからなければ空でかまいません', '140.8694', '空のまま')],
    [
      CLIENT_ALLOWED_COL,
      doc(
        `担当を限るときだけ、${t.staff}の名前を「、」で区切って書きます`,
        '記入例 はなこ、記入例 たろう',
        '空なら限らない',
      ),
    ],
    [C.note, doc('自由なメモです（500文字まで）', '朝は食事の用意が必要', '空のまま')],
    [R.entry, doc('入り方です（200文字まで）', '玄関のインターホンを押す', '空のまま')],
    [R.key, doc('鍵のことです（200文字まで）', 'キーボックス（番号は事業所で確認）', '空のまま')],
    [R.parking, doc('車を止める場所です（200文字まで）', '建物の前に1台', '空のまま')],
    [R.caution, doc('気を付けることです（200文字まで）', '玄関に段差あり', '空のまま')],
    [G.stage, doc('相談受付・顔合わせ・契約・利用中・終了から選びます', '利用中', '空なら利用中')],
    [G.referrer, doc('紹介してくれた所です', '記入例 相談センター', '空のまま')],
    [G.referrerContact, doc('紹介元の連絡先です', '022-000-0000', '空のまま')],
    [G.referrerNote, doc('紹介元のメモです', '月に1回報告', '空のまま')],
    [G.referrerEmail, doc('紹介元のメールアドレスです', 'center@example.com', '空のまま')],
  ];
}

/** 選択肢の一覧の文（6つまで。それ以上は先頭の6つと「など」） */
const optionsText = (it: Item) =>
  it.options.length > 6 ? `${it.options.slice(0, 6).join('、')}など` : it.options.join('、');

/** 項目1つの特性の列の説明と、記入例 i 行目の値 */
function traitDoc(it: Item, option: string | null, i: number): { doc: ColDoc; value: CellIn } {
  const blank = '空なら未確認';
  const first = it.options[0] ?? '';
  switch (it.kind) {
    case 'flag':
      return { doc: doc('「あり」か「なし」を選びます', 'あり', blank), value: i % 2 === 0 ? 'あり' : 'なし' };
    case 'choice':
      return {
        doc: doc(`選択肢（${optionsText(it)}）から1つ選びます`, first, blank),
        value: it.options[i % Math.max(1, it.options.length)] ?? '',
      };
    case 'multi':
      return {
        doc: doc(`「${option}」を持っていれば ○、持っていなければ ×。この項目の列がすべて空なら未確認です`, YES, blank),
        value: it.options.indexOf(option ?? '') === i % Math.max(1, it.options.length) ? YES : '×',
      };
    case 'number':
      return { doc: doc('数を書きます', '5', blank), value: 3 + i };
    case 'startYear':
      return { doc: doc('始めた年を西暦で書きます。年数は自動で数えます', '2018', blank), value: 2018 + i };
  }
}

/** 条件（必要条件・希望）の列の説明の例 */
function condExample(it: Item): string {
  switch (it.kind) {
    case 'flag':
      return 'あり';
    case 'choice':
    case 'multi':
      return it.options[0] ?? '';
    case 'number':
    case 'startYear':
      return '3以上';
  }
}

/** 特性・必要条件・希望の列の説明と記入例（own＝自分の項目、other＝相手の項目） */
function itemDocs(own: Item[], other: Item[], rows: number, otherName: string) {
  const docs: [string, ColDoc][] = [];
  const samples: Sample[] = Array.from({ length: rows }, () => ({}));
  for (const it of own) {
    for (const c of traitCols(it)) {
      docs.push([c.header, traitDoc(it, c.option, 0).doc]);
      samples.forEach((s, i) => {
        s[c.header] = traitDoc(it, c.option, i).value;
      });
    }
  }
  for (const it of other) {
    docs.push([
      reqHeader(it),
      doc(`担当する${otherName}の「${it.name}」について、必ず守る条件です`, condExample(it), '空なら問わない'),
    ]);
  }
  for (const it of other) {
    docs.push([
      prefHeader(it),
      doc(
        `担当する${otherName}の「${it.name}」について、できればそうしたい条件です`,
        condExample(it),
        '空なら問わない',
      ),
    ]);
  }
  return { docs, samples };
}

/** 記入例の固定の列の値（列名 → 値）。名前は「記入例」と分かるもの */
function fixedSamples(kind: RosterKind): Sample[] {
  if (kind === 'staff') {
    const names = ['記入例 はなこ', '記入例 たろう', '記入例 ゆうこ'];
    const modes = ['車', '自転車', '公共交通'];
    const days = ['月火水木金', '月水金', '火木土'];
    return names.map((n, i) => ({
      [STAFF_COLS.name]: n,
      [STAFF_COLS.travelMode]: modes[i],
      [STAFF_COLS.workDays]: days[i],
      [STAFF_COLS.shiftStart]: i === 1 ? '8:30' : '9:00',
      [STAFF_COLS.shiftEnd]: i === 1 ? '17:30' : '18:00',
      [STAFF_COLS.active]: YES,
      [STAFF_COLS.address]: PLACES[i].address,
    }));
  }
  const names = ['記入例 さくら', '記入例 けんた', '記入例 みどり'];
  const kana = ['きにゅうれい さくら', 'きにゅうれい けんた', 'きにゅうれい みどり'];
  return names.map((n, i) => ({
    [CLIENT_COLS.name]: n,
    [CLIENT_KANA_COL]: kana[i],
    [CLIENT_COLS.color]: i + 1,
    [CLIENT_COLS.active]: YES,
    [CLIENT_POSTAL_COL]: PLACES[i].postal,
    [CLIENT_COLS.address]: PLACES[i].address,
    [CLIENT_RULE_COLS.entry]: i === 0 ? '玄関のインターホンを押す' : '',
    [CLIENT_RULE_COLS.caution]: i === 1 ? '玄関に段差あり' : '',
    [CLIENT_STAGE_COLS.stage]: '利用中',
  }));
}

/** 書き方の手順（はじめの数行） */
export function guideIntro(sheetName: string): string[] {
  return [
    `『${sheetName}』のシートに1行に1人ずつ書きます。`,
    '保存して、アプリの［CSV・Excel を読み込む］で選びます。',
    '名前だけでも読めます。空の列には決まった値が入ります。',
    `この『${GUIDE_SHEET}』『${SAMPLE_SHEET}』のシートは読み込みません。`,
  ];
}

const GUIDE_HEADERS = ['列の名前', '何を書くか', '例', '空のとき'];

/** 書き方・記入例のシートの中身（人のシートの列に合わせる）。人のシートの列の並びは table.headers が正 */
export function rosterGuide(data: DemoData, kind: RosterKind, table: TableSpec) {
  const t = data.org.terms;
  const staffItems = data.items.filter((i) => i.target === 'staff');
  const clientItems = data.items.filter((i) => i.target === 'client');
  const rows = 3;
  const own = kind === 'staff' ? staffItems : clientItems;
  const other = kind === 'staff' ? clientItems : staffItems;
  const fixed = kind === 'staff' ? staffDocs(t) : clientDocs(t);
  const items = itemDocs(own, other, rows, kind === 'staff' ? t.client : t.staff);
  const docOf = new Map([...fixed, ...items.docs]);
  const lines = table.headers.map((h) => {
    const d = docOf.get(h) ?? doc('', '', '');
    return [h, d.what, d.example, d.blank];
  });
  const sample = fixedSamples(kind).map((s, i) => ({ ...s, ...items.samples[i] }));
  const sampleRows = sample.map((s) => table.headers.map((h): CellIn => s[h] ?? null));
  return { lines, sampleRows };
}

/** 「書き方」のシートを足す */
function addGuideSheet(wb: ExcelJS.Workbook, sheetName: string, lines: string[][]): void {
  const ws = wb.addWorksheet(GUIDE_SHEET);
  [18, 60, 30, 28].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  guideIntro(sheetName).forEach((line, i) => {
    ws.mergeCells(i + 1, 1, i + 1, 4);
    ws.getCell(i + 1, 1).value = line;
  });
  ws.addRow([]);
  const hr = ws.addRow(GUIDE_HEADERS);
  hr.font = { bold: true };
  hr.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE3CF' } };
  });
  for (const l of lines) {
    const r = ws.addRow(l);
    r.alignment = { wrapText: true, vertical: 'top' };
    // 例の列が空の文字でも、Excel に数や日付へ変えさせない
    r.getCell(3).numFmt = '@';
  }
}

/** 名簿のブックに「書き方」「記入例」を足す（人のシートの次。読み込みはこの2枚を見ない） */
export function addRosterGuideSheets(wb: ExcelJS.Workbook, data: DemoData, kind: RosterKind, table: TableSpec): void {
  const { lines, sampleRows } = rosterGuide(data, kind, table);
  addGuideSheet(wb, table.name, lines);
  addTable(wb, { ...table, name: SAMPLE_SHEET, rows: sampleRows, lists: [] });
}
