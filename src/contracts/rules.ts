import { z } from 'zod';

/**
 * 項目と条件（ADR-0002・design.md §5）。ClassClassify の「列の種類・重み0〜5」にならう。
 * 費用はすべて「点」＝移動1分。重み1＝1件あたり移動10分ぶん（POINTS_PER_WEIGHT）。
 */

export const POINTS_PER_WEIGHT = 10;
/** 落とした訪問1件の点 */
export const DROP_POINTS = 10000;
/**
 * 案B（欠勤の振り直し。ADR-0011）で、案A に入っている訪問（Problem.stay.keep）を落とした1件の点（DROP_POINTS の10倍）。
 * 振り直す訪問を入れるために、案A に入っている訪問を落とす「入れ替え」をしないため。探索の途中で一時的に落とすのは許す
 */
export const KEEP_DROP_POINTS = DROP_POINTS * 10;

/**
 * あり/なし・選択肢から1つ・選択肢から複数・数値・開始年（ADR-0070）。
 * 開始年は始めた年（西暦）を持ち、条件はその日までの年数（その日の年 − 開始年。0 未満は 0）で比べる（例：経験年数）。
 * 持つ値が変わらないので、年が変わっても入れ直さずに年数が増える
 */
export const ITEM_KINDS = ['flag', 'choice', 'multi', 'number', 'startYear'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
/** その項目の値を持つのはスタッフか訪問先か */
export const ITEM_TARGETS = ['staff', 'client'] as const;
export type ItemTarget = (typeof ITEM_TARGETS)[number];

export const itemSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(30),
  target: z.enum(ITEM_TARGETS),
  kind: z.enum(ITEM_KINDS),
  /** choice・multi の選択肢（flag・number では空） */
  options: z.array(z.string().min(1).max(30)).max(30),
});
export type Item = z.infer<typeof itemSchema>;

/** 開始年として受ける年（西暦の整数。画面と Excel で止める） */
export const START_YEAR_MIN = 1900;
export const START_YEAR_MAX = 2100;
/** 開始年として受ける年か（西暦の整数で START_YEAR_MIN〜START_YEAR_MAX） */
export const isStartYear = (n: number): boolean => Number.isInteger(n) && n >= START_YEAR_MIN && n <= START_YEAR_MAX;

/** 値。flag=boolean、choice=string、multi=string[]、number=number、startYear=number（西暦）、未入力=null */
export const traitValueSchema = z.union([z.boolean(), z.string(), z.array(z.string()), z.number(), z.null()]);
export type TraitValue = z.infer<typeof traitValueSchema>;
/** itemId → 値 */
export const traitsSchema = z.record(z.string(), traitValueSchema);
export type Traits = z.infer<typeof traitsSchema>;

/**
 * 相手の特性に対する条件。
 * is：flag/choice/number が value と等しい。not：等しくない（未入力は満たす）
 * in：choice が value（配列）のどれか。hasAny/hasAll：multi が value（配列）のどれか/すべてを含む
 * gte/lte：number が value 以上/以下。未入力（null）は is/in/hasAny/hasAll/gte/lte を満たさない
 * startYear の項目の is/not/gte/lte は、開始年でなく、その日までの年数を value（年数）と比べる（ADR-0070）
 */
export const OPS = ['is', 'not', 'in', 'hasAny', 'hasAll', 'gte', 'lte'] as const;
export type Op = (typeof OPS)[number];
export const conditionSchema = z.object({
  itemId: z.string().min(1),
  op: z.enum(OPS),
  value: traitValueSchema,
});
export type Condition = z.infer<typeof conditionSchema>;

/**
 * 条件（ルール）の型。重み1件あたり：
 * clientRequirement / staffRequirement：満たさない条件1つ＝重み×10点。hard なら可否で外す（既定 hard）
 * clientPreference / staffPreference：満たさない条件1つ＝重み×10点。hard も可
 * compatibility：◎(2)＝−重み×10、○(1)＝−重み×5、空(0)＝0、△(-1)＝＋重み×10。×(-2) は重み・hard にかかわらず外す
 *               hard なら △ も外す
 * continuity：いつもの担当（usualStaffId）がいる訪問先で、別の人＝重み×10点。hard なら可否で外す
 * balance：スタッフごとに、稼働時間に比例した件数の目安の帯 [floor, ceil] から外れた件数 e について 重み×10×e² 点。
 *          hard なら件数の上限＝ceil+1（超える割当はしない）
 * wait：待ち1分＝重み×0.1点（hard は使わない）
 * 同じ型の条件が複数あってもよい（重みは足し合わせる）。weight=0 かつ hard=false は無効
 */
export const RULE_TYPES = [
  'clientRequirement',
  'clientPreference',
  'staffRequirement',
  'staffPreference',
  'compatibility',
  'continuity',
  'balance',
  'wait',
] as const;
export type RuleType = (typeof RULE_TYPES)[number];
export const HARDABLE: ReadonlySet<RuleType> = new Set([
  'clientRequirement',
  'clientPreference',
  'staffRequirement',
  'staffPreference',
  'compatibility',
  'continuity',
  'balance',
]);

export const ruleSchema = z.object({
  id: z.string().min(1).max(50),
  type: z.enum(RULE_TYPES),
  label: z.string().min(1).max(40),
  /** 0〜5、0.5刻み */
  weight: z.number().min(0).max(5).multipleOf(0.5),
  hard: z.boolean(),
});
export type Rule = z.infer<typeof ruleSchema>;

/** 相性。2=◎ 1=○ 0=未入力 -1=△ -2=×（NG） */
export const COMPAT_LEVELS = [2, 1, 0, -1, -2] as const;
export type CompatLevel = (typeof COMPAT_LEVELS)[number];
export const COMPAT_LABELS: Record<CompatLevel, string> = { 2: '◎', 1: '○', 0: '', [-1]: '△', [-2]: '×' };
export const compatSchema = z.record(
  z.string(),
  z.record(z.string(), z.union([z.literal(2), z.literal(1), z.literal(0), z.literal(-1), z.literal(-2)])),
);
/** clientId → staffId → 相性 */
export type Compat = z.infer<typeof compatSchema>;

/** プリセットの数の上限（初期の3つ＋利用者が足す3つ。ADR-0008） */
export const MAX_PRESETS = 6;

/** プリセットの型ごとの重み・必須。重みの範囲（0〜5・0.5刻み）は zod では止めず store の repair で直す */
const presetWeightSchema = z.object({ weight: z.number(), hard: z.boolean() });

/**
 * 条件のプリセット（ADR-0005・ADR-0008）。条件の型ごとに重み・必須を決め、その日の条件（rules）の同じ型に上書きする。
 * データ（DemoData.presets）に入り、利用者が編集・追加・削除できる。初期値は seed の INITIAL_PRESETS。
 * weights に無い型は 重み0・必須でない で補う
 */
export const presetSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(20),
  /** 画面に出す一言 */
  note: z.string().max(60),
  weights: z.preprocess(
    (raw) => {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
      const o = raw as Record<string, unknown>;
      return Object.fromEntries(RULE_TYPES.map((t) => [t, Object.hasOwn(o, t) ? o[t] : { weight: 0, hard: false }]));
    },
    z.object(
      Object.fromEntries(RULE_TYPES.map((t) => [t, presetWeightSchema])) as Record<RuleType, typeof presetWeightSchema>,
    ),
  ),
});
export type Preset = z.infer<typeof presetSchema>;
