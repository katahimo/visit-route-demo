// 条件の重みの画面（pages/RulesPage）の条件・乱数の種の編集の純粋関数。データを書き換えるのは store の update(fn) を通した画面だけ。
// ここは新しい DemoData を返す（重みの下書きは lib/weightDraft、プリセットは lib/presets）
import type { DemoData } from '../contracts/data';
import { HARDABLE, type Rule, type RuleType } from '../contracts/rules';

/** 型ごとの既定（design.md §5 の表）。足したときの初期値 */
export const RULE_DEFAULTS: Record<RuleType, { weight: number; hard: boolean }> = {
  clientRequirement: { weight: 3, hard: true },
  clientPreference: { weight: 3, hard: false },
  staffRequirement: { weight: 3, hard: true },
  staffPreference: { weight: 2, hard: false },
  compatibility: { weight: 3, hard: false },
  continuity: { weight: 2, hard: false },
  balance: { weight: 3, hard: false },
  wait: { weight: 3, hard: false },
};

/** 条件の名前の上限 */
export const RULE_NAME_MAX = 40;

/** 条件の名前を変える */
export function renameRule(d: DemoData, id: string, label: string): DemoData {
  return { ...d, rules: d.rules.map((r) => (r.id === id ? { ...r, label } : r)) };
}
/** 条件を消す */
export function removeRule(d: DemoData, id: string): DemoData {
  return { ...d, rules: d.rules.filter((x) => x.id !== id) };
}
/** 保存済みの条件で必須か（消すときの断りに使う。PRD D271） */
export function isSavedHard(savedRules: readonly Rule[], r: Rule): boolean {
  return HARDABLE.has(r.type) && savedRules.find((x) => x.id === r.id)?.hard === true;
}
/**
 * 打った条件の名前から保存する名前を決める（PRD D271）：前後の空白を落として上限まで。空なら型の名前（fallback）に戻す
 * （契約は1文字以上。空のまま保存されると、次に開いたときデータ全体が読めずに初期状態へ戻ってしまう）
 */
export function ruleNameOf(draft: string, fallback: string): string {
  const t = draft.trim();
  return t ? t.slice(0, RULE_NAME_MAX) : fallback;
}
/** 表の行の印：重み0で必須でない行は半透明（無効）、下書きのある行は注意の色（PRD D286） */
export function ruleRowClass(r: { weight: number }, hard: boolean, draft: boolean): string | undefined {
  const cls = [r.weight === 0 && !hard ? 'is-dim' : '', draft ? 'is-draft' : ''].filter(Boolean);
  return cls.join(' ') || undefined;
}

/** 打った乱数の種を数にする（整数で、安全に表せる大きさでなければ null） */
export function parseSeed(text: string): number | null {
  if (!/^-?\d+$/.test(text.trim()) || !Number.isSafeInteger(Number(text))) return null;
  return Number(text);
}
/** 乱数の種を書く（同じなら元のまま） */
export function setSeed(d: DemoData, n: number): DemoData {
  return d.seed === n ? d : { ...d, seed: n };
}
