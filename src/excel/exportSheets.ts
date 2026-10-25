// 全体のブックのシートごとの書き出し（writeXxx）。シートの順は exportBook の exportWorkbook が決める
import type ExcelJS from 'exceljs';
import type { DemoData } from '../contracts/data';
import { COMPAT_LABELS, type CompatLevel, HARDABLE, ITEM_KINDS, RULE_TYPES } from '../contracts/rules';
import { hmText, kmOf, workDayOf } from '../lib/workload';
import { scorePresetOf } from '../seed/presets';
import { howtoLines } from './exportHowto';
import { addTable, type CellIn, condList, listFormula, MIN_ROWS, sheetRef, yes } from './exportTable';
import {
  absenceCols,
  availabilityCols,
  clientLeaveCols,
  ITEM_COLS,
  ORG_HEADERS,
  ORG_KEYS,
  PATTERN_EXTRA_COLS,
  PRESET_COLS,
  patternCols,
  presetWeightHeader,
  RULE_COLS,
  reqHeader,
  TYPE_COLS,
  VISIT_PIN_COL,
  VISIT_SAME_DAY_COL,
  VISIT_START_COL,
  visitCols,
  WORKLOAD_COLS,
  WORKLOAD_SHEET,
} from './layout';
import {
  condsToCell,
  dayTimesText,
  EVERY_WEEKS_LABELS,
  FIXED_SHEETS,
  hhmmToCell,
  INDUSTRY_LABELS,
  itemKindLabels,
  MONTHLY_LABEL,
  monthWeeksText,
  type personSheetNames,
  ruleTypeLabels,
  slotsCellText,
  usualStartsText,
  WINDOW_LABELS,
  workDaysText,
  YES,
} from './text';

/** 各シートの書き出しに渡す入れ物（名前の対応表・プルダウンが参照する範囲は先に作っておく） */
export interface SheetCtx {
  wb: ExcelJS.Workbook;
  data: DemoData;
  names: ReturnType<typeof personSheetNames>;
  staffName: Map<string, string>;
  clientName: Map<string, string>;
  typeName: Map<string, string>;
  staffNameRef: string;
  clientNameRef: string;
  typeNameRef: string;
  patternIdRef: string;
}

/** 書き出し用の入れ物を作る（ブックはまだ空） */
export function makeSheetCtx(
  wb: ExcelJS.Workbook,
  data: DemoData,
  names: ReturnType<typeof personSheetNames>,
): SheetCtx {
  return {
    wb,
    data,
    names,
    staffName: new Map(data.staff.map((s) => [s.id, s.name])),
    clientName: new Map(data.clients.map((c) => [c.id, c.displayName])),
    typeName: new Map(data.visitTypes.map((v) => [v.id, v.name])),
    staffNameRef: sheetRef(names.staff, 'B', Math.max(MIN_ROWS, data.staff.length + 200)),
    clientNameRef: sheetRef(names.client, 'B', Math.max(MIN_ROWS, data.clients.length + 200)),
    typeNameRef: sheetRef(FIXED_SHEETS.visitTypes, 'B', MIN_ROWS),
    patternIdRef: sheetRef(FIXED_SHEETS.patterns, 'A', Math.max(MIN_ROWS, data.patterns.length + 200)),
  };
}

/** 相性（自分のキーだけを引く。ID が constructor などでも組み込みの値を拾わない） */
function compatOf(data: DemoData, cid: string, sid: string): CompatLevel {
  const row = Object.hasOwn(data.compat, cid) ? data.compat[cid] : undefined;
  return (row && Object.hasOwn(row, sid) ? row[sid] : 0) ?? 0;
}

/** 使い方 */
export function writeHowto({ wb, data, names }: SheetCtx): void {
  const howto = wb.addWorksheet(FIXED_SHEETS.howto);
  howto.getColumn(1).width = 110;
  howtoLines(data, names).forEach((line, i) => {
    const row = howto.addRow([line]);
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    // 「・」で始まらない行は見出し（1行目は表題）
    if (line !== '' && !line.startsWith('・')) row.font = { bold: true, size: i === 0 ? 14 : 11 };
  });
}

/** 事業所 */
export function writeOrg({ wb, data }: SheetCtx): void {
  const t = data.org.terms;
  addTable(wb, {
    name: FIXED_SHEETS.org,
    headers: [...ORG_HEADERS],
    rows: [
      [ORG_KEYS.name, data.org.name],
      [ORG_KEYS.industry, INDUSTRY_LABELS[data.org.industry]],
      [ORG_KEYS.staffTerm, t.staff],
      [ORG_KEYS.clientTerm, t.client],
      [ORG_KEYS.fare, data.org.fareYenPerKm],
      [ORG_KEYS.seed, data.seed],
      [ORG_KEYS.spanLimit, data.org.spanLimitHours],
    ],
    freezeCols: 1,
  });
  // 業種の値のセルだけにプルダウン
  const orgWs = wb.getWorksheet(FIXED_SHEETS.org);
  if (orgWs) {
    orgWs.getCell('B3').dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [listFormula(Object.values(INDUSTRY_LABELS)) ?? '""'],
      showErrorMessage: true,
      error: '一覧の中から選んでください',
    };
  }
}

/** 項目 */
export function writeItems({ wb, data }: SheetCtx): void {
  const t = data.org.terms;
  addTable(wb, {
    name: FIXED_SHEETS.items,
    headers: Object.values(ITEM_COLS),
    rows: data.items.map((it) => [
      it.id,
      it.target === 'staff' ? t.staff : t.client,
      it.name,
      itemKindLabels[it.kind],
      it.options.join('、'),
    ]),
    textCols: [1],
    lists: [
      { col: 2, values: [t.staff, t.client] },
      { col: 4, values: ITEM_KINDS.map((k) => itemKindLabels[k]) },
    ],
    freezeCols: 1,
  });
}

/** 条件 */
export function writeRules({ wb, data }: SheetCtx): void {
  const ruleLabels = ruleTypeLabels(data.org.terms);
  addTable(wb, {
    name: FIXED_SHEETS.rules,
    headers: Object.values(RULE_COLS),
    rows: data.rules.map((r) => [r.id, r.label, ruleLabels[r.type], r.weight, yes(r.hard)]),
    textCols: [1],
    lists: [
      { col: 3, values: RULE_TYPES.map((k) => ruleLabels[k]) },
      { col: 4, values: Array.from({ length: 11 }, (_, i) => String(i / 2)) },
      { col: 5, values: [YES] },
    ],
    freezeCols: 2,
  });
}

/** プリセット（ADR-0008）。点数の基準（ADR-0010）に ○ */
export function writePresets({ wb, data }: SheetCtx): void {
  const ruleLabels = ruleTypeLabels(data.org.terms);
  const rulerId = scorePresetOf(data.presets, data.scorePresetId)?.id;
  addTable(wb, {
    name: FIXED_SHEETS.presets,
    headers: [
      PRESET_COLS.id,
      PRESET_COLS.name,
      PRESET_COLS.note,
      ...RULE_TYPES.map((k) => presetWeightHeader(ruleLabels[k])),
      PRESET_COLS.hard,
      PRESET_COLS.scoreBase,
    ],
    rows: data.presets.map((p) => [
      p.id,
      p.name,
      p.note,
      ...RULE_TYPES.map((k) => p.weights[k].weight),
      RULE_TYPES.filter((k) => HARDABLE.has(k) && p.weights[k].hard)
        .map((k) => ruleLabels[k])
        .join('、'),
      yes(p.id === rulerId),
    ]),
    textCols: [1],
    lists: [
      ...RULE_TYPES.map((_, i) => ({ col: 4 + i, values: Array.from({ length: 11 }, (_, j) => String(j / 2)) })),
      { col: 4 + RULE_TYPES.length + 1, values: [YES] },
    ],
    freezeCols: 2,
  });
}

/** 相性 */
export function writeCompat({ wb, data }: SheetCtx): void {
  const t = data.org.terms;
  addTable(wb, {
    name: FIXED_SHEETS.compat,
    headers: [`${t.client}＼${t.staff}`, ...data.staff.map((s) => s.name)],
    rows: data.clients.map((c) => [
      c.displayName,
      ...data.staff.map((s) => COMPAT_LABELS[compatOf(data, c.id, s.id)] ?? ''),
    ]),
    lists: data.staff.map((_, i) => ({ col: i + 2, values: ['◎', '○', '△', '×'] })),
    freezeCols: 1,
  });
}

/** 稼働時間 */
export function writeAvailability({ wb, data, staffName, staffNameRef }: SheetCtx): void {
  const ac = availabilityCols(data.org.terms);
  addTable(wb, {
    name: FIXED_SHEETS.availability,
    headers: Object.values(ac),
    rows: data.availability.map((a) => [staffName.get(a.staffId) ?? '', a.date, slotsCellText(a.slots)]),
    textCols: [2, 3],
    lists: [{ col: 1, ref: staffNameRef, strict: false }],
    freezeCols: 1,
  });
}

/** 欠勤（ADR-0011） */
export function writeAbsences({ wb, data, staffName, staffNameRef }: SheetCtx): void {
  const abc = absenceCols(data.org.terms);
  addTable(wb, {
    name: FIXED_SHEETS.absences,
    headers: Object.values(abc),
    rows: data.absences.map((a) => [
      a.id,
      staffName.get(a.staffId) ?? '',
      a.date,
      a.from === null ? '' : hhmmToCell(a.from),
      a.to === null ? '' : hhmmToCell(a.to),
      a.note,
    ]),
    textCols: [1, 3, 4, 5],
    lists: [{ col: 2, ref: staffNameRef, strict: false }],
    freezeCols: 2,
  });
}

/** 種類（ADR-0012）。必要条件は〈スタッフ〉の項目ごとの列（〈利用者さん〉の必要条件と同じ書き方） */
export function writeVisitTypes({ wb, data }: SheetCtx): void {
  const staffItems = data.items.filter((i) => i.target === 'staff');
  addTable(wb, {
    name: FIXED_SHEETS.visitTypes,
    headers: [
      TYPE_COLS.id,
      TYPE_COLS.name,
      TYPE_COLS.color,
      TYPE_COLS.duration,
      ...staffItems.map(reqHeader),
      TYPE_COLS.note,
    ],
    rows: data.visitTypes.map((v) => [
      v.id,
      v.name,
      v.color + 1,
      v.durationMinutes,
      ...staffItems.map((it) =>
        condsToCell(
          it,
          v.requirements.filter((c) => c.itemId === it.id),
        ),
      ),
      v.note,
    ]),
    textCols: [1],
    lists: [
      { col: 3, values: ['1', '2', '3', '4', '5', '6', '7', '8'] },
      ...staffItems.flatMap((it, i) => {
        const l = condList(it, 5 + i);
        return l ? [l] : [];
      }),
    ],
    freezeCols: 2,
  });
}

/** 定期パターン（ADR-0012） */
export function writePatterns({
  wb,
  data,
  clientName,
  staffName,
  typeName,
  clientNameRef,
  typeNameRef,
  staffNameRef,
}: SheetCtx): void {
  const pc = patternCols(data.org.terms);
  addTable(wb, {
    name: FIXED_SHEETS.patterns,
    headers: [...Object.values(pc), ...Object.values(PATTERN_EXTRA_COLS)],
    rows: data.patterns.map((p) => [
      p.id,
      clientName.get(p.clientId) ?? '',
      p.typeId === null ? '' : (typeName.get(p.typeId) ?? ''),
      workDaysText(p.weekdays),
      p.repeat === 'monthly' ? MONTHLY_LABEL : EVERY_WEEKS_LABELS[p.everyWeeks as 1 | 2 | 3 | 4],
      WINDOW_LABELS[p.windowKind],
      hhmmToCell(p.earliestStart),
      hhmmToCell(p.latestStart),
      p.durationMinutes,
      p.from,
      p.to ?? '',
      p.usualStaffId === null ? '' : (staffName.get(p.usualStaffId) ?? ''),
      p.note,
      p.repeat === 'monthly' ? monthWeeksText(p.monthWeeks) : '',
      dayTimesText(p.dayTimes, p.windowKind),
      usualStartsText(p.usualStarts),
    ]),
    textCols: [1, 4, 7, 8, 10, 11, 14, 15, 16],
    lists: [
      { col: 2, ref: clientNameRef, strict: false },
      { col: 3, ref: typeNameRef, strict: false },
      { col: 5, values: [...Object.values(EVERY_WEEKS_LABELS), MONTHLY_LABEL] },
      { col: 6, values: Object.values(WINDOW_LABELS) },
      { col: 12, ref: staffNameRef, strict: false },
    ],
    freezeCols: 2,
  });
}

/** 訪問 */
export function writeVisits(ctx: SheetCtx): void {
  const { wb, data, clientName, staffName, typeName, clientNameRef, typeNameRef, staffNameRef, patternIdRef } = ctx;
  const vc = visitCols(data.org.terms);
  addTable(wb, {
    name: FIXED_SHEETS.visits,
    headers: [...Object.values(vc), VISIT_SAME_DAY_COL, VISIT_START_COL, VISIT_PIN_COL],
    rows: data.visits.map((v) => [
      v.id,
      v.date,
      clientName.get(v.clientId) ?? '',
      v.typeId === null ? '' : (typeName.get(v.typeId) ?? ''),
      WINDOW_LABELS[v.windowKind],
      hhmmToCell(v.earliestStart),
      hhmmToCell(v.latestStart),
      v.durationMinutes,
      v.staffId === null ? '' : (staffName.get(v.staffId) ?? ''),
      yes(v.cancelled),
      v.pattern?.id ?? '',
      v.pattern?.date ?? '',
      yes(v.pattern?.edited ?? false),
      v.note,
      yes(v.cancelled && v.cancelKind === 'sameDay'),
      v.start === null ? '' : hhmmToCell(v.start),
      yes(v.pinned),
    ]),
    textCols: [1, 2, 6, 7, 11, 12, 16],
    lists: [
      { col: 3, ref: clientNameRef, strict: false },
      { col: 4, ref: typeNameRef, strict: false },
      { col: 5, values: Object.values(WINDOW_LABELS) },
      { col: 9, ref: staffNameRef, strict: false },
      { col: 10, values: [YES] },
      { col: 11, ref: patternIdRef, strict: false },
      { col: 13, values: [YES] },
      { col: 15, values: [YES] },
      { col: 17, values: [YES] },
    ],
    freezeCols: 3,
  });
}

/** 〈利用者さん〉の休み（ADR-0013） */
export function writeClientLeaves({ wb, data, clientName, clientNameRef }: SheetCtx): void {
  const lc = clientLeaveCols(data.org.terms);
  addTable(wb, {
    name: FIXED_SHEETS.clientLeaves,
    headers: Object.values(lc),
    rows: data.clientLeaves.map((l) => [l.id, clientName.get(l.clientId) ?? '', l.from, l.to, l.note]),
    textCols: [1, 3, 4],
    lists: [{ col: 2, ref: clientNameRef, strict: false }],
    freezeCols: 2,
  });
}

/** 稼働の見込み（ADR-0015）：書き出すだけ（読み込みでは見ない） */
export function writeWorkload({ wb, data }: SheetCtx): void {
  addTable(wb, {
    name: WORKLOAD_SHEET,
    headers: [...WORKLOAD_COLS],
    rows: workloadRows(data),
    textCols: [1],
    freezeCols: 2,
  });
}

/**
 * 「稼働の見込み」のシートの行（PRD D72。ADR-0015）：担当を組んだ日（保存した訪問か伝えた内容のある日。版2）ごとに、
 * 訪問のある〈スタッフ〉1行。日付・名前の順。交通費は単価が 0 なら空
 */
export function workloadRows(data: DemoData): CellIn[][] {
  const dates = [...new Set([...data.visits.map((v) => v.date), ...Object.keys(data.snapshots)])].sort();
  const nameOf = new Map(data.staff.map((s) => [s.id, s.name]));
  const rows: CellIn[][] = [];
  for (const date of dates) {
    const day = workDayOf(data, date);
    const stats = [...day.stats].sort((a, b) =>
      (nameOf.get(a.staffId) ?? '').localeCompare(nameOf.get(b.staffId) ?? '', 'ja'),
    );
    for (const x of stats) {
      rows.push([
        date,
        nameOf.get(x.staffId) ?? '',
        day.source === 'confirmed' ? YES : '',
        x.count,
        hmText(x.start),
        hmText(x.end),
        Math.round(x.span),
        Math.round(x.visit),
        Math.round(x.travel),
        Math.round(x.wait),
        Math.round(x.home),
        kmOf(x.meters),
        data.org.fareYenPerKm > 0 ? x.fareYen : null,
        x.over ? YES : '',
      ]);
    }
  }
  return rows;
}
