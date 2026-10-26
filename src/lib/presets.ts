// 条件のプリセットの編集（ADR-0008・ADR-0065）。データを書き換えるのは store の update(fn) を通した画面だけ。ここは新しい DemoData を返す純粋関数。
// プリセットの重み・必須は変えない（ADR-0065）。条件の重みの表で変えた重みは、新しいプリセットとして足す（saveDraftAsPreset）
import type { DemoData } from '../contracts/data';
import { HARDABLE, MAX_PRESETS, type Preset, type Rule } from '../contracts/rules';
import { INITIAL_PRESETS, scorePresetOf, scoreRulesOf } from '../seed';
import { newId } from './common';
import { draftWeights, type WeightDraft } from './weightDraft';

/** プリセットの名前の上限（contracts の presetSchema と同じ） */
export const PRESET_NAME_MAX = 20;
export const PRESET_NOTE_MAX = 60;

/** 初期の3つ（バランス・移動を短く・人の組み合わせ重視。seed/presets の id）か。初期の3つは消せない（ADR-0065） */
export const isInitialPreset = (id: string): boolean => INITIAL_PRESETS.some((p) => p.id === id);

/** 足せない理由（足せるなら null）：名前が空・長すぎる・同じ名前がある・6つある */
export function addPresetError(d: Pick<DemoData, 'presets'>, name: string): string | null {
  const n = name.trim();
  if (n === '') return '名前を入れてください';
  if (n.length > PRESET_NAME_MAX) return `名前は${PRESET_NAME_MAX}文字までです`;
  if (d.presets.some((p) => p.name === n)) return '同じ名前のプリセットがあります';
  if (d.presets.length >= MAX_PRESETS) return `プリセットは${MAX_PRESETS}つまでです。使わないものを消してください`;
  return null;
}

/**
 * 表の下書きを新しい考え方として保存するときの既定の名前（ADR-0065）：「〈元の名前〉（改）」、同じ名前があれば「（改2）」「（改3）」…。
 * 名前の上限を超えるときは元の名前を詰めて収める
 */
export function draftPresetName(baseName: string, presets: readonly Pick<Preset, 'name'>[]): string {
  const names = new Set(presets.map((p) => p.name));
  for (let i = 1; ; i++) {
    const suffix = `（改${i === 1 ? '' : i}）`;
    const name = `${baseName.slice(0, PRESET_NAME_MAX - suffix.length)}${suffix}`;
    if (!names.has(name)) return name;
  }
}

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
 * 条件の重みの表の下書きを、新しい考え方として保存する（ADR-0065。PRD D286）：点数の基準のプリセットの保存済みの重みに
 * 下書きの欄を重ねたプリセットを名前を付けて最後に足し、それを点数の基準にする（元のプリセットはそのまま）。
 * 足せないとき（名前の誤り・6つある）・基準が無いときはそのまま返す
 */
export function saveDraftAsPreset(d: DemoData, draft: WeightDraft, name: string): DemoData {
  const basis = scorePresetOf(d.presets, d.scorePresetId);
  if (!basis || addPresetError(d, name)) return d;
  const used = new Set(d.presets.map((p) => p.id));
  let id = newId('p');
  while (used.has(id)) id = newId('p');
  const preset: Preset = { id, name: name.trim(), note: '', weights: draftWeights(basis.weights, draft) };
  return setScorePreset({ ...d, presets: [...d.presets, preset] }, id);
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
