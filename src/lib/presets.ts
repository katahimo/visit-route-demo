// 条件のプリセットの編集（ADR-0008・ADR-0065・ADR-0099）。データを書き換えるのは store の update(fn) を通した画面だけ。ここは新しい DemoData を返す純粋関数。
// 初期の3つ・名前を付けたプリセットの重みは変えない。条件の重みの表で変えた重みは「調整した重み」（1つだけ）に書き、点数の基準にする（saveTunedWeights）
import type { DemoData } from '../contracts/data';
import { HARDABLE, MAX_PRESETS, type Preset, type Rule } from '../contracts/rules';
import { INITIAL_PRESETS, scorePresetOf, scoreRulesOf } from '../seed';
import { draftWeights, type WeightDraft } from './weightDraft';

/** プリセットの名前の上限（contracts の presetSchema と同じ） */
export const PRESET_NAME_MAX = 20;
export const PRESET_NOTE_MAX = 60;

/** 初期の3つ（バランス・移動を短く・人の組み合わせ重視。seed/presets の id）か。初期の3つは消せない（ADR-0065） */
export const isInitialPreset = (id: string): boolean => INITIAL_PRESETS.some((p) => p.id === id);

/** 条件の重みの表で保存した重みのプリセットの id と名前（ADR-0099。1つだけ持ち、保存のたびに上書きする） */
export const TUNED_PRESET_ID = 'tuned';
export const TUNED_PRESET_NAME = '調整した重み';

/** 調整した重みを保存できないか（まだ無く、プリセットが上限の数あるとき） */
export const tunedFull = (d: Pick<DemoData, 'presets'>): boolean =>
  !d.presets.some((p) => p.id === TUNED_PRESET_ID) && d.presets.length >= MAX_PRESETS;

/**
 * 条件（data.rules）の重み・必須を点数の基準の重みにそろえる（ADR-0035・ADR-0053）。基準が替わったら呼ぶ。
 * 条件の追加・削除・名前はそのまま。基準と同じなら同じものを返す
 */
export function withBasisRules(d: DemoData): DemoData {
  const rules = scoreRulesOf(d);
  return JSON.stringify(rules) === JSON.stringify(d.rules) ? d : { ...d, rules };
}

/**
 * プリセットを消す（初期の3つと最後の1つは消さない。ADR-0065）。点数の基準のプリセットを消したら、基準はバランス（無ければ残りの先頭）に移り、
 * 条件の重みも新しい基準にそろえる（ADR-0010・ADR-0035）
 */
export function removePreset(d: DemoData, id: string): DemoData {
  if (d.presets.length <= 1 || isInitialPreset(id)) return d;
  const presets = d.presets.filter((p) => p.id !== id);
  const fallback = presets.find((p) => p.id === INITIAL_PRESETS[0]?.id) ?? presets[0];
  const scorePresetId = presets.some((p) => p.id === d.scorePresetId) ? d.scorePresetId : fallback?.id;
  const next = { ...d, presets, scorePresetId };
  return scorePresetId === d.scorePresetId ? next : withBasisRules(next);
}

/** 点数の基準のプリセットを変える（ADR-0010。無い id なら変えない）。条件の重みも新しい基準にそろえる（ADR-0035） */
export function setScorePreset(d: DemoData, id: string): DemoData {
  if (!d.presets.some((p) => p.id === id) || d.scorePresetId === id) return d;
  return withBasisRules({ ...d, scorePresetId: id });
}

/** プリセットの名前・一言を変える（重み・必須は変えない。ADR-0065）。名前が空なら変えない */
export function renamePreset(d: DemoData, id: string, patch: Partial<Pick<Preset, 'name' | 'note'>>): DemoData {
  const name = patch.name?.trim().slice(0, PRESET_NAME_MAX);
  const note = patch.note?.slice(0, PRESET_NOTE_MAX);
  if (name === '') return d;
  return {
    ...d,
    presets: d.presets.map((p) =>
      p.id === id ? { ...p, ...(name !== undefined && { name }), ...(note !== undefined && { note }) } : p,
    ),
  };
}

/**
 * 条件の重みの表の下書きを保存する（ADR-0099。PRD D286）：点数の基準のプリセットの保存済みの重みに下書きの欄を重ね、
 * 「調整した重み」（TUNED_PRESET_ID）に書いて点数の基準にする。無ければ最後に足し、あれば重みだけ上書きする（名前・一言はそのまま）。
 * ほかのプリセットは変えない。基準が無い・保存できない（tunedFull）ときはそのまま返す
 */
export function saveTunedWeights(d: DemoData, draft: WeightDraft): DemoData {
  const basis = scorePresetOf(d.presets, d.scorePresetId);
  if (!basis || tunedFull(d)) return d;
  const weights = draftWeights(basis.weights, draft);
  const has = d.presets.some((p) => p.id === TUNED_PRESET_ID);
  const presets = has
    ? d.presets.map((p) => (p.id === TUNED_PRESET_ID ? { ...p, weights } : p))
    : [...d.presets, { id: TUNED_PRESET_ID, name: TUNED_PRESET_NAME, note: '条件の重みの画面で直した重み', weights }];
  return withBasisRules({ ...d, presets, scorePresetId: TUNED_PRESET_ID });
}

/**
 * 条件を足す（条件の重みの画面。ADR-0035）。重み・必須は点数の基準のプリセットのその型。
 * プリセットが0件（ありえない）なら fallback。必須にできない型は必須にしない
 */
export function addRule(
  d: DemoData,
  rule: Pick<Rule, 'id' | 'type' | 'label'>,
  fallback: { weight: number; hard: boolean },
): DemoData {
  const w = scorePresetOf(d.presets, d.scorePresetId)?.weights[rule.type] ?? fallback;
  const added: Rule = { ...rule, weight: w.weight, hard: HARDABLE.has(rule.type) && w.hard };
  return { ...d, rules: [...d.rules, added] };
}
