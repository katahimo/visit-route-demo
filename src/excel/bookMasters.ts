// 全体のブックの、項目・条件・プリセットのシートを読む（importWorkbook から。ADR-0006・ADR-0008）
import {
  HARDABLE,
  HOME_NEAR_BEFORE_END_MAX,
  type Item,
  MAX_PRESETS,
  type Preset,
  RULE_TYPES,
  type Rule,
  type RuleType,
} from '../contracts/rules';
import { HOME_NEAR_OLD_LABEL, MAX_OPTIONS, optionNameError } from '../lib/common';
import type { BookCtx } from './bookContext';
import { ITEM_COLS, PRESET_COLS, presetWeightHeader, RULE_BEFORE_END_COL, RULE_COLS } from './layout';
import { idOf, Sheet, sheetMsg, uniqueName } from './reader';
import { FIXED_SHEETS, itemKindLabels, lookup, ruleTypeLabels, splitList, YES } from './text';

/** 項目のシート */
export function readItems(ctx: BookCtx, itemSheet: Sheet): Item[] {
  const { terms, used } = ctx;
  const items: Item[] = [];
  const ids = new Map<string, number>();
  // 項目の名前は対象ごとに重ならない（対象が違えば同じ名前でもよい）
  const seen = { staff: new Map<string, number>(), client: new Map<string, number>() };
  for (const r of itemSheet.rows()) {
    const id = idOf(r, ITEM_COLS.id, ids, 'i', used, 50);
    const name = r.required(ITEM_COLS.name, 30);
    const tText = r.required(ITEM_COLS.target);
    const target = tText === null ? null : lookup({ staff: terms.staff, client: terms.client }, tText);
    if (tText !== null && target === null)
      r.err(ITEM_COLS.target, `「${terms.staff}」か「${terms.client}」で書いてください`);
    if (name !== null && target) uniqueName(r, ITEM_COLS.name, name, seen[target]);
    const kText = r.required(ITEM_COLS.kind);
    const kind = kText === null ? null : lookup(itemKindLabels, kText);
    if (kText !== null && kind === null)
      r.err(ITEM_COLS.kind, `「${Object.values(itemKindLabels).join('」「')}」のどれかで書いてください`);
    const options = kind === 'choice' || kind === 'multi' ? splitList(r.text(ITEM_COLS.options)) : [];
    if (new Set(options).size !== options.length) r.err(ITEM_COLS.options, '同じ選択肢が2つあります');
    if (options.length > MAX_OPTIONS) r.err(ITEM_COLS.options, `選択肢は${MAX_OPTIONS}個までです`);
    for (const o of options) {
      const e = optionNameError(o);
      if (e) r.err(ITEM_COLS.options, `「${o}」：${e}`);
    }
    if (name !== null && target && kind) items.push({ id, name, target, kind, options });
  }
  return items;
}

/** 条件の種類の名前を読む（帰りの前は自宅に近い人は前の名前「夕方は自宅に近い人」でも読む。ADR-0121） */
function ruleTypeOf(labels: Record<RuleType, string>, text: string): RuleType | null {
  return lookup(labels, text) ?? lookup({ homeNear: HOME_NEAR_OLD_LABEL }, text, false);
}

/** 条件のシート */
export function readRules(ctx: BookCtx, ruleSheet: Sheet): Rule[] {
  const rules: Rule[] = [];
  const labels = ruleTypeLabels(ctx.terms);
  const ids = new Map<string, number>();
  // 条件の名前はどこからも参照しないので、重なってもよい
  for (const r of ruleSheet.rows()) {
    const id = idOf(r, RULE_COLS.id, ids, 'r', ctx.used, 50);
    const label = r.required(RULE_COLS.label, 40);
    const tText = r.required(RULE_COLS.type);
    const type = tText === null ? null : ruleTypeOf(labels, tText);
    if (tText !== null && type === null) r.err(RULE_COLS.type, '一覧にない種類です（プルダウンから選んでください）');
    const weight = r.num(RULE_COLS.weight, { min: 0, max: 5, required: true });
    if (typeof weight === 'number' && !Number.isInteger(weight * 2))
      r.err(RULE_COLS.weight, '重みは0.5刻みで書いてください');
    const hard = r.yes(RULE_COLS.hard);
    // 勤務の終わりの何分前から（帰りの前は自宅に近い人だけ。列が無い・空なら既定。ADR-0121）
    const beforeEnd =
      type === 'homeNear' ? r.num(RULE_BEFORE_END_COL, { int: true, min: 0, max: HOME_NEAR_BEFORE_END_MAX }) : null;
    if (label !== null && type && typeof weight === 'number')
      rules.push({ id, type, label, weight, hard, ...(typeof beforeEnd === 'number' && { beforeEndMin: beforeEnd }) });
  }
  return rules;
}

/** プリセットのシートで、無くてもよい重みの列の型（あとから足した条件。無い古いブックはプリセットの契約の既定。ADR-0116） */
const OPTIONAL_WEIGHT_TYPES: ReadonlySet<string> = new Set(['sameClient', 'homeNear']);

/**
 * プリセットのシート（ADR-0008）。シートが無い古いブックは、いまのプリセット・点数の基準のまま。
 * 列が足りない・読めない行があれば null（エラーは ctx.errors に積む。呼ぶ側が止める）
 */
export function readPresets(ctx: BookCtx): { presets: Preset[]; scorePresetId: string | undefined } | null {
  const { base, errors } = ctx;
  const presetWs = ctx.wb.getWorksheet(FIXED_SHEETS.presets);
  if (!presetWs) return { presets: base.presets, scorePresetId: base.scorePresetId };
  const sheet = new Sheet(FIXED_SHEETS.presets, presetWs, errors);
  const labels = ruleTypeLabels(ctx.terms);
  // 帰りの前は自宅に近い人の重みの列は、前の名前の見出し「重み：夕方は自宅に近い人」でも読む（ADR-0121）
  const oldHome = presetWeightHeader(HOME_NEAR_OLD_LABEL);
  const headerOf = (t: RuleType) => {
    const h = presetWeightHeader(labels[t]);
    return t === 'homeNear' && !sheet.has(h) && sheet.has(oldHome) ? oldHome : h;
  };
  const weightCols = RULE_TYPES.map((t) => ({ t, h: headerOf(t) })).filter(
    (c) => !OPTIONAL_WEIGHT_TYPES.has(c.t) || sheet.has(c.h),
  );
  if (
    !sheet.require([
      PRESET_COLS.id,
      PRESET_COLS.name,
      PRESET_COLS.note,
      ...weightCols.filter((c) => !OPTIONAL_WEIGHT_TYPES.has(c.t)).map((c) => c.h),
      PRESET_COLS.hard,
    ])
  )
    return null;
  const ids = new Map<string, number>();
  const presetIds = new Set(base.presets.map((p) => p.id));
  const read: Preset[] = [];
  /** 点数の基準（ADR-0010）に ○ を付けた行（列が無い・無印なら先頭。migrate の repair が補う） */
  const marked: { id: string; n: number }[] = [];
  const rows = sheet.rows();
  if (rows.length === 0) errors.add(sheetMsg(FIXED_SHEETS.presets, 'プリセットを1行以上書いてください'));
  if (rows.length > MAX_PRESETS)
    errors.add(sheetMsg(FIXED_SHEETS.presets, `プリセットは${MAX_PRESETS}つまでです（いま${rows.length}行）`));
  for (const r of rows) {
    const id = idOf(r, PRESET_COLS.id, ids, 'p', presetIds, 50);
    const name = r.required(PRESET_COLS.name, 20);
    const note = r.optional(PRESET_COLS.note, 60);
    const hardTypes = new Set<string>();
    for (const part of splitList(r.text(PRESET_COLS.hard))) {
      const t = lookup(labels, part);
      if (t === null) r.err(PRESET_COLS.hard, `「${part}」は条件の種類の名前ではありません`);
      else if (!HARDABLE.has(t)) r.err(PRESET_COLS.hard, `「${part}」は必須にできません`);
      else hardTypes.add(t);
    }
    const weights: Partial<Preset['weights']> = {};
    let ok = true;
    for (const { t, h } of weightCols) {
      const w = r.num(h, { min: 0, max: 5 });
      if (w === undefined) ok = false;
      else if (w !== null && !Number.isInteger(w * 2)) {
        r.err(h, '重みは0.5刻みで書いてください');
        ok = false;
      } else weights[t] = { weight: w ?? 0, hard: hardTypes.has(t) };
    }
    if (r.yes(PRESET_COLS.scoreBase)) {
      const first = marked[0];
      if (first) r.err(PRESET_COLS.scoreBase, `${YES} は1行だけにしてください（${first.n}行目にもあります）`);
      marked.push({ id, n: r.n });
    }
    if (name !== null && ok) read.push({ id, name, note, weights: weights as Preset['weights'] });
  }
  if (errors.any) return null;
  return { presets: read, scorePresetId: marked[0]?.id };
}
