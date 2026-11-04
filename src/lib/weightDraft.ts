// 条件の重みの画面（#/rules）の下書き（PRD D286。ADR-0048・ADR-0100）：表の重みのスライダー・必須の切り替えは、動かしても保存せず
// 画面の中の下書き（型ごとの重み・必須）に置き、「保存」で「調整した重み」に書く（lib/presets の saveTunedWeights）。
// ここは下書きの差分・保存の確認の文を作る純粋関数。データを書き換えるのは画面の update(fn) だけ
import { HARDABLE, type Preset, type Rule, type RuleType } from '../contracts/rules';
import { weightLocked } from './common';

/** 型ごとの重み・必須（必須にできない型は hard を false にそろえる） */
export type WeightValue = { weight: number; hard: boolean };
/** 型ごとの保存済みの値 */
export type SavedWeights = Partial<Record<RuleType, WeightValue>>;
/**
 * 下書き：型ごとに、触った欄（重み・必須）のうち保存済みと違うものだけを持つ（同じ値に戻したら消す）。
 * 当てるときは保存済みに重ねる（触っていない欄は、別のタブで変わってもその値を使う。確定で上書きしない）
 */
export type WeightDraft = Partial<Record<RuleType, Partial<WeightValue>>>;

const norm = (type: RuleType, v: WeightValue): WeightValue => ({
  weight: v.weight,
  hard: HARDABLE.has(type) && v.hard,
});
const same = (a: WeightValue, b: WeightValue) => a.weight === b.weight && a.hard === b.hard;

/** 表に出す条件（基準のプリセットを当てたもの）から、型ごとの保存済みの値（型の最初の条件。同じ型は同じ重み） */
export function savedWeights(rules: readonly Rule[]): SavedWeights {
  const out: SavedWeights = {};
  for (const r of rules) if (!out[r.type]) out[r.type] = norm(r.type, r);
  return out;
}

/** 保存済みに下書きの欄を重ねた値 */
const over = (type: RuleType, base: WeightValue, part: Partial<WeightValue> | undefined): WeightValue =>
  norm(type, { ...base, ...part });

/** 保存済みと違う欄だけ残す（無ければ null） */
function diffPart(type: RuleType, base: WeightValue, part: Partial<WeightValue>): Partial<WeightValue> | null {
  const v = over(type, base, part);
  const out: Partial<WeightValue> = {};
  if (part.weight !== undefined && v.weight !== base.weight) out.weight = v.weight;
  if (part.hard !== undefined && v.hard !== base.hard) out.hard = v.hard;
  return out.weight === undefined && out.hard === undefined ? null : out;
}

/** 下書きを直す：触った欄を足し、保存済みの値と同じになった欄・型は下書きから外す。その型の条件が無ければ何もしない */
export function editDraft(
  draft: WeightDraft,
  saved: SavedWeights,
  type: RuleType,
  patch: Partial<WeightValue>,
): WeightDraft {
  const base = saved[type];
  if (!base) return draft;
  const next = diffPart(type, base, { ...draft[type], ...patch });
  const out = { ...draft };
  if (next) out[type] = next;
  else delete out[type];
  return out;
}

/**
 * 下書きを今のデータに合わせる：条件を消してその型の条件が無くなった型・保存済みと同じ値になった欄（プリセットの節で同じ値にした・
 * 別のタブで同じ値にした等）は外す。変わらなければ同じオブジェクトを返す（画面の state を書き直さない）
 */
export function pruneDraft(draft: WeightDraft, saved: SavedWeights): WeightDraft {
  let changed = false;
  const out: WeightDraft = {};
  for (const [t, v] of Object.entries(draft) as [RuleType, Partial<WeightValue>][]) {
    const base = saved[t];
    const next = base ? diffPart(t, base, v) : null;
    if (!next) {
      changed = true;
      continue;
    }
    if (next.weight !== v.weight || next.hard !== v.hard) changed = true;
    out[t] = next;
  }
  return changed ? out : draft;
}

/** 表に出す条件に下書きを当てる（型ごと。同じ型の条件はどれも保存済みに下書きの欄を重ねた値） */
export function withDraft(rules: readonly Rule[], draft: WeightDraft): Rule[] {
  const saved = savedWeights(rules);
  return rules.map((r) => {
    const part = draft[r.type];
    const base = saved[r.type];
    if (!part || !base) return r;
    const v = over(r.type, base, part);
    return { ...r, weight: v.weight, hard: v.hard };
  });
}

/** 下書きの変更（1つの型＝1件） */
export type WeightChange = {
  type: RuleType;
  /** その型の条件の名前（表の並び） */
  labels: string[];
  before: WeightValue;
  after: WeightValue;
};

/** 下書きの変更の一覧（表の並び。型ごとに1件） */
export function draftChanges(rules: readonly Rule[], draft: WeightDraft): WeightChange[] {
  const saved = savedWeights(rules);
  const out: WeightChange[] = [];
  for (const r of rules) {
    const part = draft[r.type];
    const before = saved[r.type];
    if (!part || !before) continue;
    const after = over(r.type, before, part);
    if (same(after, before)) continue;
    const hit = out.find((c) => c.type === r.type);
    if (hit) hit.labels.push(r.label);
    else out.push({ type: r.type, labels: [r.label], before, after });
  }
  return out;
}

/** 重み・必須の短い文（「3」「0（使わない）」「必須」。重みを使わない必須は「必須」だけ、バランスの必須は「3・必須」） */
function weightText(type: RuleType, v: WeightValue): string {
  if (weightLocked({ type, hard: v.hard })) return '必須';
  const w = v.weight === 0 ? '0（使わない）' : String(v.weight);
  return v.hard ? `${w}・必須` : w;
}

/** 前→後の文（行の印と確認の本文。例「3→4」「3→必須」） */
export const changeText = (c: Pick<WeightChange, 'type' | 'before' | 'after'>): string =>
  `${weightText(c.type, c.before)}→${weightText(c.type, c.after)}`;

/**
 * 保存するプリセットの重み（ADR-0065）：基準のプリセットの保存済みの重みに、下書きの触った欄を重ねたもの（深く写す。
 * 触っていない欄は保存済みの値のまま＝別のタブで変わった必須などを上書きしない）
 */
export function draftWeights(base: Preset['weights'], draft: WeightDraft): Preset['weights'] {
  return Object.fromEntries(
    (Object.entries(base) as [RuleType, WeightValue][]).map(([t, v]) => [t, over(t, v, draft[t])]),
  ) as Preset['weights'];
}

/**
 * プリセットの値を下書きに入れる（ADR-0100）：types の型ごとに、プリセットの重み・必須を触った欄として重ねる
 * （保存済みと同じ型は下書きから外れる。条件の無い型は入れない）
 */
export function fillDraft(
  draft: WeightDraft,
  saved: SavedWeights,
  weights: Preset['weights'],
  types: readonly RuleType[],
): WeightDraft {
  return types.reduce((d, t) => editDraft(d, saved, t, weights[t]), draft);
}

/** 保存の確認の見出し（PRD D286。ADR-0100） */
export const confirmTitle = (n: number): string => `重みを保存しますか？（${n}件）`;

/**
 * 保存の確認の本文（PRD D286。ADR-0100）：変わる条件と重み（前→後）、次に組むときから使うこと、今の担当は変えないこと（ADR-0053）
 */
export function confirmBody(changes: readonly WeightChange[]): string {
  const lines = changes.map((c) => `・${c.labels.join('・')}：${changeText(c)}`);
  return [
    '変わる条件：',
    ...lines,
    '',
    '予定を入れたときの自動の組み・「担当を組む」の AI で組む・点数・要対応の検査に、次から使います。',
    '今の担当は変わりません。組み直したいときは「担当を組む」で AI で組みます。',
  ].join('\n');
}

/** 保存のあとの知らせ */
export const SAVED_TEXT = '重みを保存しました。次に組むときから使います';

/** 画面を離れるときの確認（〈スタッフ〉・〈利用者さん〉の画面の「変更を捨てる」と同じ形。components/personPage の discardChanges） */
export function leaveDialog(n: number) {
  return {
    title: '重みの変更を捨てて、画面を移りますか？',
    body: `確定していない重みの変更（${n}件）があります。移ると捨てます。`,
    confirmLabel: '捨てて移る',
    cancelLabel: '編集を続ける',
    tone: 'danger' as const,
  };
}
