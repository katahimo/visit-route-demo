// Excel のブックを読む部品（全体のブック importBook・名簿のブック importRoster で共通）。
// セルの値の読み取り・見出しで列を引く行とシート・ID と名前の重なり・特性と条件の列（ADR-0006）
import ExcelJS from 'exceljs';
import type { DemoData, ImportError } from '../contracts/data';
import { graphemeCount, STAFF_ICON_MAX, STAFF_ICON_MAX_UNITS } from '../contracts/documents';
import type { Condition, Item, ItemTarget, Traits, TraitValue } from '../contracts/rules';
import { nameKey, newId } from '../lib/common';
import { normalizeEmail } from '../lib/mailto';
import { normalizePostalCode } from '../lib/postalCode';
import {
  CLIENT_POSTAL_COL,
  PREF_PREFIX,
  prefHeader,
  REQ_PREFIX,
  reqHeader,
  TRAIT_PREFIX,
  type TraitCol,
  traitCols,
} from './layout';
import {
  dateToTime,
  dateToYmd,
  FIXED_SHEETS,
  isTimeOnlyDate,
  multiFromMarks,
  NO_TEXTS,
  nfkc,
  parseConds,
  parseDateText,
  parseMark,
  parseNumberText,
  parseTimeText,
  parseTrait,
  serialToDate,
  serialToTime,
  YES,
  YES_TEXTS,
} from './text';

/** まとめて返すエラーの数の上限 */
const MAX_ERRORS = 10;
/** 読み込むファイルの大きさの上限（バイト） */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** 1つのシートの行数の上限（見出しを除く、空でない行） */
export const MAX_ROWS = 10_000;
/** ID に使えない名前（JavaScript のオブジェクトの組み込みの名前。キーにすると壊れる） */
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);
/** 1人の必要条件・希望の上限（contracts/documents.ts の max） */
export const MAX_CONDS = 20;

type Prim = string | number | boolean | Date | null;
/** 読めないセル（数式のエラー・結果の無い数式） */
type Bad = { bad: string };
const isBad = (v: Prim | Bad): v is Bad => typeof v === 'object' && v !== null && !(v instanceof Date);

/** ExcelJS のセルの値を、ふつうの値にする（リッチテキスト・数式の結果・リンクも読む）。テストのために出す */
export function prim(v: ExcelJS.CellValue | undefined): Prim | Bad {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') return v.trim() === '' ? null : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if ('error' in v) return { bad: `数式のエラー（${String(v.error)}）になっています` };
    if ('formula' in v || 'sharedFormula' in v) {
      const result = (v as { result?: ExcelJS.CellValue }).result;
      if (result === undefined)
        return { bad: '数式の結果が保存されていません（Excel で開いて保存し直すか、値を直接書いてください）' };
      return prim(result);
    }
    if ('richText' in v && Array.isArray(v.richText)) return prim(v.richText.map((r) => r.text).join(''));
    // リンクのセル（{ text, hyperlink }）：表示（text）が文字ならそれ、リッチテキストなら連結して読む。
    // 表示が無い・空なら、リンク先の「mailto:」以降を読む（メールアドレスの列。ADR-0017）
    if ('hyperlink' in v || 'text' in v) {
      const t = (v as { text?: unknown }).text;
      const shown =
        typeof t === 'string'
          ? t
          : typeof t === 'object' && t !== null && 'richText' in t && Array.isArray(t.richText)
            ? (t.richText as { text?: unknown }[]).map((r) => (typeof r.text === 'string' ? r.text : '')).join('')
            : '';
      if (shown.trim() !== '') return prim(shown);
      const link = (v as { hyperlink?: unknown }).hyperlink;
      if (typeof link === 'string' && /^mailto:/i.test(link)) {
        const addr = link.replace(/^mailto:/i, '').split('?')[0] ?? '';
        try {
          return prim(decodeURIComponent(addr));
        } catch {
          return prim(addr);
        }
      }
      return null;
    }
  }
  return null;
}

/**
 * メールアドレスの列（ADR-0017）：空・列が無いなら ''。全角・前後の空白・「mailto:」は直し、形が合わなければ行付きで止めて null
 */
export function readEmail(r: Row, h: string): string | null {
  const t = r.text(h);
  const e = normalizeEmail(t);
  if (e === null) r.err(h, `メールアドレスの形ではありません（例 name@example.com。いま「${t.slice(0, 40)}」）`);
  return e;
}

/**
 * 〈スタッフ〉のアイコンの列（ADR-0050）：列が無い古いブック・空は ''。前後の空白は落とす。
 * 見た目で2文字（STAFF_ICON_MAX）・32コード単位（STAFF_ICON_MAX_UNITS）を超えれば行付きで止めて null
 */
export function readStaffIcon(r: Row, h: string): string | null {
  const t = r.text(h).trim();
  if (t.length > STAFF_ICON_MAX_UNITS || graphemeCount(t) > STAFF_ICON_MAX) {
    // 誤りの文の引用はコードポイントで切る（サロゲートの途中で切らない）
    r.err(h, `アイコンは${STAFF_ICON_MAX}文字までです（いま「${Array.from(t).slice(0, 20).join('')}」）`);
    return null;
  }
  return t;
}

/**
 * 郵便番号の列（ADR-0016）：列が無い古いブック・空は ''。ハイフン・全角は7桁に直し、直せなければ行付きで止めて null。
 * 数値のセル（文字列の書式でない列に 0380000 と書くと 38000 になる）は、0〜9999999 の整数なら先頭を0で埋めて7桁にする
 */
export function readPostal(r: Row): string | null {
  const postalRaw = r.raw(CLIENT_POSTAL_COL);
  const postalCode = normalizePostalCode(
    typeof postalRaw === 'number' && Number.isInteger(postalRaw) && postalRaw >= 0 && postalRaw <= 9_999_999
      ? String(postalRaw).padStart(7, '0')
      : r.text(CLIENT_POSTAL_COL),
  );
  if (postalCode === null)
    r.err(CLIENT_POSTAL_COL, '7桁の数字で書いてください（ハイフンは有っても無くても構いません）');
  return postalCode;
}

/** 見出しの比べ方（全角半角・コロンの揺れ・空白を許す） */
const headerKey = nameKey;

/** 値 → 文字（前後の空白は落とす。日付・時刻は 2026-10-13・9:00 の形） */
export function textOf(v: Prim): string {
  if (v === null) return '';
  if (v instanceof Date) {
    if (isTimeOnlyDate(v)) {
      const t = dateToTime(v);
      return `${Number(t.slice(0, 2))}:${t.slice(3)}`;
    }
    return dateToYmd(v);
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v).trim();
}

export class Errors {
  list: string[] = [];
  add(msg: string) {
    if (this.list.length < MAX_ERRORS) this.list.push(msg);
    else this.more = true;
  }
  more = false;
  get any() {
    return this.list.length > 0;
  }
  toError(): ImportError {
    const more = this.more ? '\n（ほかにもあります。直してからもう一度読み込んでください）' : '';
    return { code: 'INVALID_ARGUMENT', message: `${this.list.join('\n')}${more}` };
  }
}

export const sheetMsg = (sheet: string, msg: string) => `シート『${sheet}』：${msg}`;

/** 1行（見出しの名前で列を引き、読めない値は場所付きのエラーにする） */
export class Row {
  constructor(
    readonly sheet: Sheet,
    readonly n: number,
  ) {}
  raw(h: string): Prim {
    const c = this.sheet.cols.get(headerKey(h));
    return c === undefined ? null : this.sheet.read(this.n, c, h);
  }
  text(h: string): string {
    return textOf(this.raw(h));
  }
  err(h: string, msg: string): null {
    this.sheet.errors.add(`シート『${this.sheet.name}』の ${this.n}行目・『${h}』：${msg}`);
    return null;
  }
  required(h: string, max?: number): string | null {
    const t = this.text(h);
    if (t === '') return this.err(h, '空にはできません');
    return this.limit(h, t, max);
  }
  /** 文字数の上限（contracts の max）。超えたらエラーにして null */
  limit(h: string, t: string, max?: number): string | null {
    if (max !== undefined && t.length > max) return this.err(h, `${max}文字までです（いま${t.length}文字）`);
    return t;
  }
  /** 空でもよい文字（上限を超えたらエラーにして ''） */
  optional(h: string, max: number): string {
    return this.limit(h, this.text(h), max) ?? '';
  }
  date(h: string): string | null {
    const v = this.raw(h);
    if (v === null) return this.err(h, '日付を書いてください');
    const d = v instanceof Date ? dateToYmd(v) : typeof v === 'number' ? serialToDate(v) : parseDateText(textOf(v));
    return d ?? this.err(h, '日付は 2026-10-13 の形で書いてください');
  }
  time(h: string, required = true): string | null {
    const v = this.raw(h);
    if (v === null) return required ? this.err(h, '時刻を書いてください') : null;
    const t = v instanceof Date ? dateToTime(v) : typeof v === 'number' ? serialToTime(v) : parseTimeText(textOf(v));
    return t ?? this.err(h, '時刻は 9:00 の形で書いてください');
  }
  /** 数（空は null。読めない・範囲外はエラーにして undefined） */
  num(h: string, o: { int?: boolean; min?: number; max?: number; required?: boolean } = {}): number | null | undefined {
    const v = this.raw(h);
    if (v === null) {
      if (o.required) {
        this.err(h, '数を書いてください');
        return undefined;
      }
      return null;
    }
    const n = typeof v === 'number' ? v : parseNumberText(textOf(v));
    const range =
      o.min !== undefined && o.max !== undefined
        ? `（${o.min}〜${o.max}）`
        : o.min !== undefined
          ? `（${o.min}以上）`
          : '';
    if (n === null || (o.int && !Number.isInteger(n))) {
      this.err(h, `${o.int ? '整数' : '数'}で書いてください${range}`);
      return undefined;
    }
    if ((o.min !== undefined && n < o.min) || (o.max !== undefined && n > o.max)) {
      this.err(h, `${range.slice(1, -1)}の数で書いてください`);
      return undefined;
    }
    return n;
  }
  /** ○＝はい、空＝いいえ */
  yes(h: string): boolean {
    const v = this.raw(h);
    if (v === null || v === false) return false;
    if (v === true) return true;
    const t = nfkc(textOf(v));
    if (YES_TEXTS.includes(t)) return true;
    if (NO_TEXTS.includes(t)) return false;
    this.err(h, `「${YES}」か空で書いてください`);
    return false;
  }
}

export class Sheet {
  /** 見出しの比べ方（headerKey）→ 列番号 */
  readonly cols = new Map<string, number>();
  /** 見出しの並び（列番号の順。name は書いてあるまま） */
  readonly headers: { name: string; key: string; col: number }[] = [];
  /** 空でない行の番号（2行目から） */
  readonly rowNumbers: number[] = [];
  constructor(
    readonly name: string,
    readonly ws: ExcelJS.Worksheet,
    readonly errors: Errors,
  ) {
    for (let c = 1; c <= ws.columnCount; c++) {
      const h = textOf(this.read(1, c, `${c}列目の見出し`));
      if (h === '') continue;
      const key = headerKey(h);
      if (this.cols.has(key)) {
        errors.add(sheetMsg(name, `見出し『${h}』の列が2つあります`));
        continue;
      }
      this.cols.set(key, c);
      this.headers.push({ name: h, key, col: c });
    }
    // 値のある行だけを回す（遠くの行に空白が1つあっても、100万行を回さない）
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1 || this.rowNumbers.length > MAX_ROWS) return;
      let any = false;
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (!any && prim(cell.value) !== null) any = true;
      });
      if (any) this.rowNumbers.push(n);
    });
    if (this.rowNumbers.length > MAX_ROWS) {
      errors.add(sheetMsg(name, `行が多すぎます（${MAX_ROWS.toLocaleString()}行まで）`));
      this.rowNumbers.length = 0;
    }
  }
  /** 1つのセルを読む（数式のエラーなどは場所付きのエラーにして空とみなす） */
  read(n: number, col: number, h: string): Prim {
    const cell = this.ws.getRow(n).getCell(col);
    // 結合したセルの下・右のセルは、左上の値が入って見える。黙って同じ値を読まないよう止める
    if (cell.isMerged && cell.master !== cell) {
      this.errors.add(
        `シート『${this.name}』の ${n}行目・『${h}』：結合したセルは読めません。結合を外して1つずつ書いてください`,
      );
      return null;
    }
    const v = prim(cell.value);
    if (!isBad(v)) return v;
    this.errors.add(`シート『${this.name}』の ${n}行目・『${h}』：${v.bad}`);
    return null;
  }
  has(h: string): boolean {
    return this.cols.has(headerKey(h));
  }
  /** 必須の列があるか（無ければエラー） */
  require(hs: readonly string[]): boolean {
    let ok = true;
    for (const h of hs) {
      if (!this.has(h)) {
        this.errors.add(sheetMsg(this.name, `『${h}』の列がありません（1行目の見出しを確かめてください）`));
        ok = false;
      }
    }
    return ok;
  }
  /** 2行目からの、見出しのある列に値がある行 */
  rows(): Row[] {
    return this.rowNumbers
      .filter((n) => {
        const row = this.ws.getRow(n);
        return this.headers.some((h) => prim(row.getCell(h.col).value) !== null);
      })
      .map((n) => new Row(this, n));
  }
}

/** 書いてある ID を確かめる（使えない名前・文字数・同じ ID が2行。エラーは行付き）。見た行を seen に覚える */
export function checkGivenId(row: Row, h: string, t: string, seen: Map<string, number>, max: number) {
  if (RESERVED_IDS.has(t)) row.err(h, `「${t}」は ID に使えません`);
  row.limit(h, t, max);
  const before = seen.get(t);
  if (before !== undefined) row.err(h, `ID「${t}」が ${before}行目と重なっています`);
  seen.set(t, row.n);
}

/** 新しい ID（いまある ID・ブックに書いてある ID と重ならない）。採った ID は used に足す */
export function freshId(prefix: string, used: Set<string>, seen: Map<string, number>): string {
  let id = newId(prefix);
  while (used.has(id) || seen.has(id)) id = newId(prefix);
  used.add(id);
  return id;
}

/** ID の列：空なら新しい ID、同じ ID が2行あればエラー */
export function idOf(
  row: Row,
  h: string,
  seen: Map<string, number>,
  prefix: string,
  used: Set<string>,
  max: number,
): string {
  const t = row.text(h);
  if (t === '') return freshId(prefix, used, seen);
  checkGivenId(row, h, t, seen, max);
  return t;
}

/** いまある ID（新しい ID と重ならないように。ほかの種類のデータの ID と同じ ID で足さない） */
export function usedIds(base: DemoData): Set<string> {
  return new Set<string>([
    ...base.items.map((x) => x.id),
    ...base.rules.map((x) => x.id),
    ...base.staff.map((x) => x.id),
    ...base.clients.map((x) => x.id),
    ...base.visits.map((x) => x.id),
    ...base.absences.map((x) => x.id),
    ...base.visitTypes.map((x) => x.id),
    ...base.patterns.map((x) => x.id),
    ...base.clientLeaves.map((x) => x.id),
  ]);
}

/** 名前の重なりを調べる（同じ名前があればエラー） */
export function uniqueName(row: Row, h: string, name: string, seen: Map<string, number>) {
  // 全角半角・空白だけが違う名前も同じとみなす（見出しで区別できないため）
  const key = nameKey(name);
  const before = seen.get(key);
  if (before !== undefined)
    row.err(
      h,
      `「${name}」が ${before}行目と重なっています（全角半角・空白だけの違いも同じ名前とみなします。名前は重ならないようにしてください）`,
    );
  else seen.set(key, row.n);
}

/** 特性・必要条件・希望の列を項目に結びつける（h はシートの見出しの文字） */
export interface PersonCols {
  traits: (TraitCol & { h: string })[];
  reqs: { h: string; item: Item }[];
  prefs: { h: string; item: Item }[];
}
/**
 * kinds：読む列の種類（種類のシートは必要条件だけ。ADR-0012）。読まない種類の見出しは知らない列として読まない。
 * requireAll：項目の列が無ければ止める（全体のブック）。名簿のブック（PRD D105）は false で、無い列はその値を今のままにする。
 * 選択肢から複数の選択肢ごとの列（ADR-0070）は、名簿でも1つでもあれば全部そろえる（一部だけでは値が決まらないため）
 */
export function personCols(
  sheet: Sheet,
  items: Item[],
  own: ItemTarget,
  fixed: readonly string[],
  kinds: readonly (keyof PersonCols)[] = ['traits', 'reqs', 'prefs'],
  requireAll = true,
): PersonCols {
  const out: PersonCols = { traits: [], reqs: [], prefs: [] };
  const other: ItemTarget = own === 'staff' ? 'client' : 'staff';
  const fixedKeys = new Set(fixed.map(headerKey));
  const wanted = {
    traits: kinds.includes('traits') ? items.filter((i) => i.target === own).flatMap(traitCols) : [],
    reqs: kinds.includes('reqs')
      ? items.filter((i) => i.target === other).map((item) => ({ header: reqHeader(item), item }))
      : [],
    prefs: kinds.includes('prefs')
      ? items.filter((i) => i.target === other).map((item) => ({ header: prefHeader(item), item }))
      : [],
  };
  const prefixes = (
    [
      ['traits', headerKey(TRAIT_PREFIX)],
      ['reqs', headerKey(REQ_PREFIX)],
      ['prefs', headerKey(PREF_PREFIX)],
    ] as const
  ).filter(([kind]) => kinds.includes(kind));
  for (const { name, key } of sheet.headers) {
    if (fixedKeys.has(key)) continue;
    const hit = prefixes.find(([, p]) => key.startsWith(p));
    if (!hit) continue; // 知らない列は読まない（メモ書きの列など）
    const [kind] = hit;
    if (kind === 'traits') {
      const c = wanted.traits.find((x) => headerKey(x.header) === key);
      if (c) out.traits.push({ ...c, h: name });
      else
        sheet.errors.add(
          sheetMsg(sheet.name, `見出し『${name}』に合う項目・選択肢が、シート『${FIXED_SHEETS.items}』にありません`),
        );
      continue;
    }
    const c = wanted[kind].find((x) => headerKey(x.header) === key);
    if (c) out[kind].push({ h: name, item: c.item });
    else
      sheet.errors.add(sheetMsg(sheet.name, `見出し『${name}』の項目が、シート『${FIXED_SHEETS.items}』にありません`));
  }
  // 項目のシートにある項目の列が無ければ止める（列を消すと特性・条件が黙って消えるため）
  const missing = (header: string) => sheet.errors.add(`シート『${sheet.name}』に列『${header}』がありません`);
  for (const c of wanted.traits) {
    if (out.traits.some((x) => x.header === c.header)) continue;
    const partial = c.option !== null && out.traits.some((x) => x.item === c.item);
    if (requireAll || partial) missing(c.header);
  }
  for (const kind of ['reqs', 'prefs'] as const) {
    for (const c of requireAll ? wanted[kind] : []) {
      if (!out[kind].some((x) => x.item === c.item)) missing(c.header);
    }
  }
  return out;
}

/** 1つの項目の特性の列から値を読む（空は undefined＝未確認。読めなければ行にエラーを出して undefined） */
function readTrait(row: Row, item: Item, cols: PersonCols['traits']): TraitValue | undefined {
  const cellOf = (h: string) => {
    const v = row.raw(h);
    return v === null ? '' : typeof v === 'number' || typeof v === 'boolean' ? v : textOf(v);
  };
  if (item.kind === 'multi') {
    let bad = false;
    const marks = item.options.map((o) => {
      const c = cols.find((x) => x.option === o);
      if (!c) return null;
      const r = parseMark(cellOf(c.h));
      if (r.ok) return r.value;
      row.err(c.h, r.error);
      bad = true;
      return null;
    });
    return bad ? undefined : multiFromMarks(item, marks);
  }
  const c = cols[0];
  if (!c) return undefined;
  const r = parseTrait(item, cellOf(c.h));
  if (r.ok) return r.value;
  row.err(c.h, r.error);
  return undefined;
}

export function readPerson(
  row: Row,
  cols: PersonCols,
): { traits: Traits; requirements: Condition[]; preferences: Condition[] } {
  const traits = new Map<string, Traits[string]>();
  for (const item of new Set(cols.traits.map((c) => c.item))) {
    const v = readTrait(
      row,
      item,
      cols.traits.filter((c) => c.item === item),
    );
    if (v !== undefined) traits.set(item.id, v);
  }
  const conds = (list: { h: string; item: Item }[], label: string) => {
    const out: Condition[] = [];
    for (const { h, item } of list) {
      const r = parseConds(item, row.text(h));
      if (!r.ok) row.err(h, r.error);
      else out.push(...r.value);
    }
    if (out.length > MAX_CONDS)
      row.err(list[0]?.h ?? label, `${label}は1人${MAX_CONDS}件までです（いま${out.length}件）`);
    return out;
  };
  return {
    traits: Object.fromEntries(traits),
    requirements: conds(cols.reqs, '必要条件'),
    preferences: conds(cols.prefs, '希望'),
  };
}

/** ファイルの大きさを確かめて、Excel のブックとして開く（全体・名簿で共通） */
export async function loadWorkbook(buf: ArrayBuffer): Promise<ExcelJS.Workbook | ImportError> {
  if (buf.byteLength > MAX_FILE_BYTES) {
    return { code: 'INVALID_ARGUMENT', message: `ファイルが大きすぎます（${MAX_FILE_BYTES / 1024 / 1024}MB まで）` };
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    return { code: 'INVALID_ARGUMENT', message: 'Excel のファイル（.xlsx）として読めませんでした' };
  }
  return wb;
}
