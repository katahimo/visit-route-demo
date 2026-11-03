// 名簿のブック（〈利用者さん〉か〈スタッフ〉のシート1枚）の行を読む（importRoster から。PRD D103〜D107。ADR-0020）。
// シートを開いて列を確かめ、行を今のデータの人と突き合わせ、ブックにある列だけ読んだ値に替えた人を作る
import type ExcelJS from 'exceljs';
import type { DemoData, ImportError, RosterKind } from '../contracts/data';
import { type Client, type ClientStage, type Staff, stageOfLegacy, type Terms } from '../contracts/documents';
import type { Condition, Traits } from '../contracts/rules';
import { STAGE_LABELS, stageFlags } from '../lib/clientStage';
import { withTravel } from '../lib/clientTravel';
import { nameKey } from '../lib/common';
import { defaultStaffHours } from '../lib/staffDefaultHours';
import {
  CLIENT_ALLOWED_COL,
  CLIENT_COLS,
  CLIENT_KANA_COL,
  CLIENT_POSTAL_COL,
  CLIENT_RULE_COLS,
  CLIENT_STAGE_COLS,
  CLIENT_TENTATIVE_COL,
  CLIENT_TRAVEL_COLS,
  STAFF_COLS,
  STAFF_EMAIL_COL,
  STAFF_ICON_COL,
  STAFF_LAST_DAY_COL,
} from './layout';
import {
  checkGivenId,
  Errors,
  freshId,
  MAX_CONDS,
  type PersonCols,
  personCols,
  type Row,
  readEmail,
  readPerson,
  readPostal,
  readStaffIcon,
  readTravelMinutes,
  Sheet,
  sheetMsg,
  uniqueName,
  usedIds,
} from './reader';
import { lookup, parseWorkDays, personSheetNames, splitList, travelModeLabels } from './text';

/** 形の同じ値か（オブジェクトのキーの順は問わない） */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return (
    ka.length === kb.length &&
    ka.every(
      (k) =>
        Object.hasOwn(b as object, k) && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}

/** 並びだけが違う条件の列は同じとみなす（読み込むと条件は項目の列の順に並ぶため。同じなら今の並びを残す） */
function sameConds(a: readonly Condition[], b: readonly Condition[]): boolean {
  if (a.length !== b.length) return false;
  const key = (c: Condition) => JSON.stringify([c.itemId, c.op, c.value]);
  const ka = a.map(key).sort();
  const kb = b.map(key).sort();
  return ka.every((x, i) => x === kb[i]);
}

/**
 * 特性・必要条件・希望：ブックにある項目の列だけ読んだ値に替え、無い列の項目は今の値のまま（新しい人は空）。
 * 条件が並びだけ違うなら今の並びを残す
 */
function mergePerson(
  r: Row,
  cols: PersonCols,
  cur: { traits: Traits; requirements: Condition[]; preferences: Condition[] } | undefined,
): { traits: Traits; requirements: Condition[]; preferences: Condition[] } {
  const read = readPerson(r, cols);
  const traits: Traits = { ...(cur?.traits ?? {}) };
  for (const { item } of cols.traits) delete traits[item.id];
  Object.assign(traits, read.traits);
  const conds = (list: PersonCols['reqs'], now: Condition[] | undefined, got: Condition[], label: string) => {
    const readIds = new Set(list.map((c) => c.item.id));
    const kept = (now ?? []).filter((c) => !readIds.has(c.itemId));
    const out = [...kept, ...got];
    // 上限は、ブックに列の無い今の条件と合わせて数える（読んだぶんだけの上限は readPerson が見る）
    if (out.length > MAX_CONDS && kept.length > 0)
      r.err(list[0]?.h ?? label, `${label}は1人${MAX_CONDS}件までです（いま${out.length}件）`);
    return now && sameConds(out, now) ? now : out;
  };
  return {
    traits,
    requirements: conds(cols.reqs, cur?.requirements, read.requirements, '必要条件'),
    preferences: conds(cols.prefs, cur?.preferences, read.preferences, '希望'),
  };
}

/** 1行の読み取りの結果 */
export interface Read<P> {
  row: Row;
  person: P;
  /** 今のデータの人（無ければ新しい人） */
  cur: P | undefined;
  /** 新しい〈スタッフ〉で、勤務日・勤務時間の列が無い（か空）ため、使い方の既定にした（PRD D428） */
  hoursDefaulted?: boolean;
}

/** 名簿の読み込みの状態（シート・エラーの蓄積・項目の列・いまある ID） */
export interface RosterCtx {
  base: DemoData;
  kind: RosterKind;
  terms: Terms;
  /** 読む人の呼び方（〈スタッフ〉か〈利用者さん〉） */
  term: string;
  sheet: Sheet;
  errors: Errors;
  /** 名前の列（〈スタッフ〉は名前、〈利用者さん〉は表示名） */
  nameCol: string;
  /** 特性・必要条件・希望の列 */
  cols: PersonCols;
  /** いまある ID（新しい ID と重ならないように。ほかの種類のデータの ID と同じ ID で足さない） */
  used: Set<string>;
  /** セルが空なら今の値のままにする列（ほかのソフトの形で読むとき。ADR-0075。名簿の形は空） */
  keepBlank: ReadonlySet<string>;
}

/** 行の ID・名前と、突き合わせた今のデータの人の ID（無ければ新しい人） */
interface Match {
  id: string;
  name: string;
  curId: string | undefined;
}

/**
 * 列があれば読み、無ければ今の値（新しい人は既定値）。ほかのソフトの形で「空なら今のまま」とした列（ctx.keepBlank）は、
 * セルが空なら今の値のまま（アプリで入れた位置・住所などを、元のファイルの空の欄で消さない。ADR-0075）
 */
function pick<T>(ctx: RosterCtx, r: Row, h: string, read: () => T, keep: T): T {
  if (!ctx.sheet.has(h)) return keep;
  return ctx.keepBlank.has(h) && r.text(h) === '' ? keep : read();
}

/**
 * 新しい人の空のセルは、画面で足すときと同じ既定値（keep）にする（テンプレートに名前だけ書いて読めるように。ADR-0092）。
 * 今いる人の空のセルは今までどおり read に任せる（空にできない列はエラー）
 */
function pickNew<T>(ctx: RosterCtx, r: Row, h: string, isNew: boolean, read: () => T, keep: T): T {
  return isNew && r.text(h) === '' ? keep : pick(ctx, r, h, read, keep);
}

/**
 * 名簿のシートを開き、名前の列と項目の列を確かめる（項目の列は今のデータの項目と照らす。知らない項目の列は止める。無い列は今のまま）。
 * 読めなければ ImportError
 */
export function openRoster(
  book: ExcelJS.Workbook,
  base: DemoData,
  kind: RosterKind,
  keepBlank: readonly string[] = [],
): { ctx: RosterCtx; rows: Row[] } | ImportError {
  const terms = base.org.terms;
  const term = kind === 'staff' ? terms.staff : terms.client;
  const name = personSheetNames(terms)[kind];
  const ws = book.getWorksheet(name);
  if (!ws)
    return {
      code: 'INVALID_ARGUMENT',
      message: `シート『${name}』がありません（${term}の名簿のブックか、全体のブックを選んでください。シート名は呼び方の「${term}」から決まります）`,
    };
  const errors = new Errors();
  const sheet = new Sheet(name, ws, errors);
  const nameCol = kind === 'staff' ? STAFF_COLS.name : CLIENT_COLS.name;
  if (!sheet.require([nameCol])) return errors.toError();
  const fixed =
    kind === 'staff'
      ? [...Object.values(STAFF_COLS), STAFF_LAST_DAY_COL, STAFF_EMAIL_COL, STAFF_ICON_COL]
      : [
          ...Object.values(CLIENT_COLS),
          CLIENT_TENTATIVE_COL,
          CLIENT_KANA_COL,
          CLIENT_POSTAL_COL,
          ...Object.values(CLIENT_TRAVEL_COLS),
          CLIENT_ALLOWED_COL,
          ...Object.values(CLIENT_RULE_COLS),
          ...Object.values(CLIENT_STAGE_COLS),
        ];
  const cols = personCols(sheet, base.items, kind, fixed, undefined, false);
  if (errors.any) return errors.toError();
  const rows = sheet.rows();
  if (rows.length === 0) return { code: 'INVALID_ARGUMENT', message: sheetMsg(name, `${term}の行がありません`) };
  return {
    ctx: { base, kind, terms, term, sheet, errors, nameCol, cols, used: usedIds(base), keepBlank: new Set(keepBlank) },
    rows,
  };
}

/** 行の ID と、今のデータの人の突き合わせ（ID → 名前の順）。同じ人を2行が指せば止める */
export function rosterMatcher(ctx: RosterCtx): (r: Row) => Match {
  const { base, kind, nameCol, used } = ctx;
  const people: { id: string; name: string }[] =
    kind === 'staff'
      ? base.staff.map((s) => ({ id: s.id, name: s.name }))
      : base.clients.map((c) => ({ id: c.id, name: c.displayName }));
  const byId = new Map(people.map((p) => [p.id, p]));
  const byKey = new Map(people.map((p) => [nameKey(p.name), p]));
  const ids = new Map<string, number>();
  const names = new Map<string, number>();
  const matched = new Map<string, number>();
  const prefix = kind === 'staff' ? 's' : 'c';
  return (r) => {
    const t = r.text(CLIENT_COLS.id);
    const n = r.required(nameCol, 50) ?? '';
    if (n !== '') uniqueName(r, nameCol, n, names);
    let id: string;
    let curId: string | undefined;
    if (t !== '') {
      checkGivenId(r, CLIENT_COLS.id, t, ids, 100);
      curId = byId.get(t)?.id;
      if (curId === undefined && used.has(t))
        r.err(CLIENT_COLS.id, `ID「${t}」はほかのデータで使われています（新しい人なら ID を空にしてください）`);
      id = t;
    } else {
      curId = n === '' ? undefined : byKey.get(nameKey(n))?.id;
      id = curId !== undefined ? curId : freshId(prefix, used, ids);
    }
    if (curId !== undefined) {
      const before = matched.get(curId);
      if (before !== undefined)
        r.err(nameCol, `${before}行目と同じ${ctx.term}（ID「${curId}」）を指しています。1人1行にしてください`);
      matched.set(curId, r.n);
    }
    return { id, name: n, curId };
  };
}

/** 〈スタッフ〉の名簿の行を読む */
export function readStaffRows(ctx: RosterCtx, rows: Row[], match: (r: Row) => Match): Read<Staff>[] {
  const C = STAFF_COLS;
  const curOf = new Map(ctx.base.staff.map((s) => [s.id, s]));
  const out: Read<Staff>[] = [];
  for (const r of rows) {
    const m = match(r);
    const cur = m.curId === undefined ? undefined : curOf.get(m.curId);
    const isNew = cur === undefined;
    const travelMode = pickNew(
      ctx,
      r,
      C.travelMode,
      isNew,
      () => {
        const t = r.required(C.travelMode);
        const v = t === null ? null : lookup(travelModeLabels, t);
        if (t !== null && v === null)
          r.err(C.travelMode, `「${Object.values(travelModeLabels).join('」「')}」のどれかで書いてください`);
        return v ?? 'DRIVE';
      },
      cur?.travelMode ?? 'DRIVE',
    );
    const dflt = defaultStaffHours(ctx.base.org.features);
    const hoursDefaulted =
      isNew && [C.workDays, C.shiftStart, C.shiftEnd].some((h) => !ctx.sheet.has(h) || r.text(h) === '');
    const workDays = pickNew(
      ctx,
      r,
      C.workDays,
      isNew,
      () => {
        const v = parseWorkDays(r.text(C.workDays));
        if (v === null) r.err(C.workDays, '曜日は「月火水木金」のように書いてください');
        return v ?? [];
      },
      cur?.workDays ?? dflt.workDays,
    );
    const shiftStart = pickNew(
      ctx,
      r,
      C.shiftStart,
      isNew,
      () => r.time(C.shiftStart) ?? dflt.shiftStart,
      cur?.shiftStart ?? dflt.shiftStart,
    );
    const shiftEnd = pickNew(
      ctx,
      r,
      C.shiftEnd,
      isNew,
      () => r.time(C.shiftEnd) ?? dflt.shiftEnd,
      cur?.shiftEnd ?? dflt.shiftEnd,
    );
    // 新しい人の「利用中」が空なら利用中にする（名簿だけ。全体の読み込みは空＝休止のまま）
    const active = pick(
      ctx,
      r,
      C.active,
      () => (!cur && r.text(C.active) === '' ? true : r.yes(C.active)),
      cur?.active ?? true,
    );
    const home = {
      address: pick(ctx, r, C.address, () => r.optional(C.address, 200), cur?.home.address ?? ''),
      lat: pick(ctx, r, C.lat, () => r.num(C.lat, { min: -90, max: 90 }) ?? null, cur?.home.lat ?? null),
      lng: pick(ctx, r, C.lng, () => r.num(C.lng, { min: -180, max: 180 }) ?? null, cur?.home.lng ?? null),
    };
    const lastDay = pick(
      ctx,
      r,
      STAFF_LAST_DAY_COL,
      () => (r.text(STAFF_LAST_DAY_COL) === '' ? null : r.date(STAFF_LAST_DAY_COL)),
      cur?.lastDay ?? null,
    );
    const email = pick(ctx, r, STAFF_EMAIL_COL, () => readEmail(r, STAFF_EMAIL_COL) ?? '', cur?.email ?? '');
    // アイコン（ADR-0050）：列が無ければ今の値のまま
    const icon = pick(ctx, r, STAFF_ICON_COL, () => readStaffIcon(r, STAFF_ICON_COL) ?? '', cur?.icon ?? '');
    const p = mergePerson(r, ctx.cols, cur);
    const person: Staff = {
      ...(cur ?? {}),
      id: m.id,
      name: m.name,
      home: { ...(cur?.home ?? {}), ...home },
      travelMode,
      workDays,
      shiftStart,
      shiftEnd,
      active,
      ...p,
      lastDay,
      email,
      icon,
    };
    out.push({ row: r, person, cur, hoursDefaulted });
  }
  return out;
}

/** 段階が正（ADR-0015）：段階の列が空・無ければ、「利用中」「仮押さえ」の列があればそこから、無ければ今の段階 */
function readStage(
  ctx: RosterCtx,
  r: Row,
  cur: Client | undefined,
  flags: { active: boolean; tentative: boolean },
): ClientStage {
  const stageText = r.text(CLIENT_STAGE_COLS.stage);
  if (stageText !== '') {
    const v = lookup(STAGE_LABELS, stageText);
    if (v === null)
      r.err(CLIENT_STAGE_COLS.stage, `「${Object.values(STAGE_LABELS).join('」「')}」のどれかで書いてください`);
    return v ?? cur?.stage ?? 'active';
  }
  // 新しい人で段階・利用中・仮押さえがすべて空なら利用中（名簿だけ。全体の読み込みは空＝終了のまま）
  if (!cur && r.text(CLIENT_COLS.active) === '' && r.text(CLIENT_TENTATIVE_COL) === '') return 'active';
  if (ctx.sheet.has(CLIENT_COLS.active) || ctx.sheet.has(CLIENT_TENTATIVE_COL)) return stageOfLegacy(flags);
  return cur?.stage ?? 'active';
}

/** 担当できる人：今のデータの〈スタッフ〉の名前で探す（全角半角・空白は同一視）。同じなら今の並びを残す */
function readAllowedStaff(ctx: RosterCtx, r: Row, cur: Client | undefined, staffByKey: Map<string, string>): string[] {
  const out: string[] = [];
  for (const t of splitList(r.text(CLIENT_ALLOWED_COL))) {
    const sid = staffByKey.get(nameKey(t));
    if (sid === undefined)
      r.err(
        CLIENT_ALLOWED_COL,
        `「${t}」という${ctx.terms.staff}は、いまのデータにいません（先に${ctx.terms.staff}を足してください）`,
      );
    else if (!out.includes(sid)) out.push(sid);
  }
  return cur && same(out, cur.allowedStaffIds) ? cur.allowedStaffIds : out;
}

/** 〈利用者さん〉の名簿の行を読む */
export function readClientRows(ctx: RosterCtx, rows: Row[], match: (r: Row) => Match): Read<Client>[] {
  const { base } = ctx;
  const C = CLIENT_COLS;
  const curOf = new Map(base.clients.map((c) => [c.id, c]));
  const staffByKey = new Map(base.staff.map((s) => [nameKey(s.name), s.id]));
  let added = 0;
  const out: Read<Client>[] = [];
  for (const r of rows) {
    const m = match(r);
    const cur = m.curId === undefined ? undefined : curOf.get(m.curId);
    const color = pickNew(
      ctx,
      r,
      C.color,
      cur === undefined,
      () => {
        const v = r.num(C.color, { int: true, min: 1, max: 8, required: true });
        return typeof v === 'number' ? v - 1 : 0;
      },
      cur?.color ?? (base.clients.length + added) % 8,
    );
    if (!cur) added++;
    const active = pickNew(ctx, r, C.active, cur === undefined, () => r.yes(C.active), cur?.active ?? true);
    const tentative = pick(ctx, r, CLIENT_TENTATIVE_COL, () => r.yes(CLIENT_TENTATIVE_COL), cur?.tentative ?? false);
    const stage = readStage(ctx, r, cur, { active, tentative });
    const place = {
      address: pick(ctx, r, C.address, () => r.optional(C.address, 200), cur?.place.address ?? ''),
      lat: pick(ctx, r, C.lat, () => r.num(C.lat, { min: -90, max: 90 }) ?? null, cur?.place.lat ?? null),
      lng: pick(ctx, r, C.lng, () => r.num(C.lng, { min: -180, max: 180 }) ?? null, cur?.place.lng ?? null),
      postalCode: pick(ctx, r, CLIENT_POSTAL_COL, () => readPostal(r) ?? '', cur?.place.postalCode ?? ''),
    };
    // 移動時間（片道・分）・遠方（出張）（ADR-0096）：列が無ければ今のまま
    const travelMinutes = pick(
      ctx,
      r,
      CLIENT_TRAVEL_COLS.minutes,
      () => readTravelMinutes(r) ?? null,
      cur?.place.travelMinutes ?? null,
    );
    const farTrip = pick(
      ctx,
      r,
      CLIENT_TRAVEL_COLS.farTrip,
      () => r.yes(CLIENT_TRAVEL_COLS.farTrip),
      cur?.place.farTrip === true,
    );
    const allowedStaffIds = pick(
      ctx,
      r,
      CLIENT_ALLOWED_COL,
      () => readAllowedStaff(ctx, r, cur, staffByKey),
      cur?.allowedStaffIds ?? [],
    );
    const text = (h: string, max: number, keep: string | undefined) =>
      pick(ctx, r, h, () => r.optional(h, max), keep ?? '');
    const referrerEmail = pick(
      ctx,
      r,
      CLIENT_STAGE_COLS.referrerEmail,
      () => readEmail(r, CLIENT_STAGE_COLS.referrerEmail) ?? '',
      cur?.referrer.email ?? '',
    );
    const p = mergePerson(r, ctx.cols, cur);
    const person: Client = {
      ...(cur ?? {}),
      id: m.id,
      displayName: m.name,
      kana: text(CLIENT_KANA_COL, 50, cur?.kana),
      place: withTravel({ ...(cur?.place ?? {}), ...place }, travelMinutes, farTrip),
      note: text(C.note, 500, cur?.note),
      color,
      ...p,
      entryNote: text(CLIENT_RULE_COLS.entry, 200, cur?.entryNote),
      keyNote: text(CLIENT_RULE_COLS.key, 200, cur?.keyNote),
      parkingNote: text(CLIENT_RULE_COLS.parking, 200, cur?.parkingNote),
      cautionNote: text(CLIENT_RULE_COLS.caution, 200, cur?.cautionNote),
      allowedStaffIds,
      stage,
      // active・tentative は段階に合わせる（store の repair と同じ。比べるときに食い違いを変更とみなさない）
      ...stageFlags(stage, tentative),
      referrer: {
        ...(cur?.referrer ?? {}),
        name: text(CLIENT_STAGE_COLS.referrer, 50, cur?.referrer.name),
        contact: text(CLIENT_STAGE_COLS.referrerContact, 100, cur?.referrer.contact),
        note: text(CLIENT_STAGE_COLS.referrerNote, 200, cur?.referrer.note),
        email: referrerEmail,
      },
    };
    out.push({ row: r, person, cur });
  }
  return out;
}
