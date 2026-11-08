// Excel のブック → DemoData（名前の参照を ID に直す）。データは書き換えない（ADR-0006）
// 最後は store の migrate（形の検査と repair）を通した結果を返す。画面が store の replace で入れる。
// シートごとの読み取りは bookMasters・bookPeople・bookSchedule、セル・行・シートの部品は reader
import type ExcelJS from 'exceljs';
import type { DemoData, ImportError } from '../contracts/data';
import { type Org, SPAN_LIMIT_DEFAULT_HOURS, type Terms } from '../contracts/documents';
import { isImportError, migrate } from '../store/persist';
import type { BookCtx } from './bookContext';
import { readItems, readPresets, readRules } from './bookMasters';
import { readClients, readCompat, readStaff } from './bookPeople';
import {
  readAbsences,
  readAvailability,
  readClientLeaves,
  readPatterns,
  readVisits,
  readVisitTypes,
} from './bookSchedule';
import {
  availabilityCols,
  CLIENT_COLS,
  ITEM_COLS,
  ORG_HEADERS,
  ORG_KEYS,
  RULE_COLS,
  STAFF_COLS,
  VISIT_PATTERN_COLS,
  VISIT_TYPE_COL,
  visitBaseCols,
  visitCols,
} from './layout';
import { Errors, loadWorkbook, type Row, Sheet, sheetMsg, usedIds } from './reader';
import { FIXED_SHEETS, INDUSTRY_LABELS, lookup, personSheetNames } from './text';

// テスト（excel.test.ts）がここから読む
export { MAX_FILE_BYTES, MAX_ROWS, prim } from './reader';

/** 事業所のシートから読んだ値（読めない値は null・undefined。最後にまとめて確かめる） */
interface OrgRead {
  terms: Terms;
  orgName: string;
  industry: Org['industry'] | null;
  fare: number | null | undefined;
  seed: number | null | undefined;
  spanLimit: number | null | undefined;
}

/** シートを開く（無ければエラーを積んで null） */
function sheetOf(wb: ExcelJS.Workbook, errors: Errors, name: string): Sheet | null {
  const ws = wb.getWorksheet(name);
  if (!ws) {
    errors.add(`シート『${name}』がありません（書き出したブックのシート名を変えないでください）`);
    return null;
  }
  return new Sheet(name, ws, errors);
}

/** 事業所のシート（呼び方でシート名・見出しが決まるので最初に読む）。呼び方が読めなければ null */
function readOrg(wb: ExcelJS.Workbook, errors: Errors): OrgRead | null {
  const orgSheet = sheetOf(wb, errors, FIXED_SHEETS.org);
  if (!orgSheet || !orgSheet.require(ORG_HEADERS)) return null;
  const orgRows = new Map<string, Row>();
  for (const r of orgSheet.rows()) {
    const k = r.text(ORG_HEADERS[0]);
    if (k !== '') orgRows.set(k, r);
  }
  const orgVal = (k: string): Row | null => {
    const r = orgRows.get(k);
    if (!r) errors.add(sheetMsg(FIXED_SHEETS.org, `「${k}」の行がありません`));
    return r ?? null;
  };
  const V = ORG_HEADERS[1];
  const nameRow = orgVal(ORG_KEYS.name);
  const industryRow = orgVal(ORG_KEYS.industry);
  const staffTermRow = orgVal(ORG_KEYS.staffTerm);
  const clientTermRow = orgVal(ORG_KEYS.clientTerm);
  const fareRow = orgVal(ORG_KEYS.fare);
  const seedRow = orgVal(ORG_KEYS.seed);
  const termOf = (r: Row | null) => {
    const t = r?.required(V) ?? null;
    if (t !== null && t.length > 10) return r?.err(V, '呼び方は10文字までです') ?? null;
    return t;
  };
  const staffTerm = termOf(staffTermRow);
  const clientTerm = termOf(clientTermRow);
  if (staffTerm !== null && staffTerm === clientTerm)
    clientTermRow?.err(V, '呼び方（訪問する人）と同じです。別の呼び方にしてください');
  if (errors.any || staffTerm === null || clientTerm === null) return null;
  const terms = { staff: staffTerm, client: clientTerm };
  const orgName = nameRow?.required(V, 100) ?? '';
  const industryText = industryRow?.required(V) ?? null;
  const industry = industryText === null ? null : lookup(INDUSTRY_LABELS, industryText);
  if (industryText !== null && industry === null)
    industryRow?.err(V, `「${Object.values(INDUSTRY_LABELS).join('」「')}」のどれかで書いてください`);
  const fare = fareRow?.num(V, { min: 0, max: 1000, required: true });
  const seed = seedRow?.num(V, { int: true, required: true });
  // 拘束の上限（ADR-0015）：行が無い古いブックは既定（10時間）。0.5刻み
  const spanRow = orgRows.get(ORG_KEYS.spanLimit);
  let spanLimit = spanRow ? spanRow.num(V, { min: 0, max: 24 }) : null;
  if (typeof spanLimit === 'number' && !Number.isInteger(spanLimit * 2)) {
    spanRow?.err(V, '0.5刻みで書いてください');
    spanLimit = undefined;
  }
  return { terms, orgName, industry, fare, seed, spanLimit };
}

/** 無くてはならないシートを開き、見つかったシートの必須の列もまとめて確かめる。足りなければ null */
function openSheets(wb: ExcelJS.Workbook, errors: Errors, terms: Terms) {
  const names = personSheetNames(terms);
  const itemSheet = sheetOf(wb, errors, FIXED_SHEETS.items);
  const ruleSheet = sheetOf(wb, errors, FIXED_SHEETS.rules);
  const staffSheet = sheetOf(wb, errors, names.staff);
  const clientSheet = sheetOf(wb, errors, names.client);
  const compatSheet = sheetOf(wb, errors, FIXED_SHEETS.compat);
  const availSheet = sheetOf(wb, errors, FIXED_SHEETS.availability);
  const visitSheet = sheetOf(wb, errors, FIXED_SHEETS.visits);
  const columnsOk = [
    itemSheet?.require(Object.values(ITEM_COLS)),
    ruleSheet?.require(Object.values(RULE_COLS)),
    staffSheet?.require(Object.values(STAFF_COLS)),
    clientSheet?.require(Object.values(CLIENT_COLS)),
    availSheet?.require(Object.values(availabilityCols(terms))),
    visitSheet?.require(Object.values(visitBaseCols(terms))),
  ].every((x) => x !== false);
  if (
    !itemSheet ||
    !ruleSheet ||
    !staffSheet ||
    !clientSheet ||
    !compatSheet ||
    !availSheet ||
    !visitSheet ||
    !columnsOk
  ) {
    return null;
  }
  return { names, itemSheet, ruleSheet, staffSheet, clientSheet, compatSheet, availSheet, visitSheet };
}

/** Excel のブック → DemoData。読めなければ、場所付きの日本語の ImportError */
export async function importWorkbook(buf: ArrayBuffer, base: DemoData): Promise<DemoData | ImportError> {
  const wb = await loadWorkbook(buf);
  if ('code' in wb) return wb;
  const errors = new Errors();
  const o = readOrg(wb, errors);
  if (!o) return errors.toError();
  const { terms } = o;
  const sheets = openSheets(wb, errors, terms);
  if (!sheets) return errors.toError();

  const ctx: BookCtx = {
    wb,
    base,
    errors,
    terms,
    names: sheets.names,
    used: usedIds(base),
    items: [],
    staffByName: new Map(),
    clientByName: new Map(),
    typeByName: new Map(),
    hasTypes: false,
    hasPatterns: false,
    patternIds: new Set(),
  };
  const items = readItems(ctx, sheets.itemSheet);
  ctx.items = items;
  const rules = readRules(ctx, sheets.ruleSheet);
  if (errors.any) return errors.toError();
  const preset = readPresets(ctx);
  if (!preset) return errors.toError();

  const staff = readStaff(ctx, sheets.staffSheet);
  const clients = readClients(ctx, sheets.clientSheet);
  const compat = readCompat(ctx, sheets.compatSheet);
  const availability = readAvailability(ctx, sheets.availSheet);
  const absences = readAbsences(ctx);
  const visitTypes = readVisitTypes(ctx);
  const patterns = readPatterns(ctx);
  // 種類・定期パターンのシートがあるブックは、訪問の対応する列も要る（列を消すと種類・パターンが黙って消えるため）
  if (ctx.hasTypes) sheets.visitSheet.require([VISIT_TYPE_COL]);
  if (ctx.hasPatterns) sheets.visitSheet.require(Object.values(VISIT_PATTERN_COLS));
  if (errors.any) return errors.toError();
  const visits = readVisits(ctx, sheets.visitSheet, visitCols(terms));
  const clientLeaves = readClientLeaves(ctx);

  const { industry, fare, seed, spanLimit } = o;
  if (
    errors.any ||
    industry === null ||
    typeof fare !== 'number' ||
    typeof seed !== 'number' ||
    spanLimit === undefined
  )
    return errors.toError();

  const org: Org = {
    name: o.orgName,
    industry,
    terms,
    fareYenPerKm: fare,
    spanLimitHours: spanLimit ?? SPAN_LIMIT_DEFAULT_HOURS,
    // 機能の入り切りはブックに入れない（ADR-0028）。読み込んでも今の入り切りのまま
    features: base.org.features,
    // 道路の移動時間の補正もブックに入れない（ADR-0101）。読み込んでも今の値のまま
    roadTravel: base.org.roadTravel,
    lineTravel: base.org.lineTravel,
  };
  const next: DemoData = {
    version: base.version,
    baseDate: base.baseDate,
    seed,
    org,
    items,
    rules,
    staff,
    clients,
    compat,
    visits,
    availability,
    absences,
    visitTypes,
    patterns,
    clientLeaves,
    // 伝えた内容・振り直しの情報は Excel のシートに無い。今のものを残す
    // （変わった所は「未連絡の変更」になる。ADR-0053。別の事業所のブックなら画面が消す：lib/dataScreen の withoutOrgState）
    snapshots: base.snapshots,
    reassigns: base.reassigns,
    // 道路の所要の表はシートに無い。位置で引くので、位置の変わらない地点はそのまま使える（ADR-0101）
    ...(base.roads ? { roads: base.roads } : {}),
    presets: preset.presets,
    scorePresetId: preset.scorePresetId,
  };
  const r = migrate(next);
  return isImportError(r) ? { ...r, message: `読み込んだ内容に問題があります：${r.message}` } : r;
}
