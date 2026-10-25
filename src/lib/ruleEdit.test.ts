import { describe, expect, it } from 'vitest';
import type { Rule } from '../contracts/rules';
import { createDemoData } from '../seed';
import {
  isSavedHard,
  parseSeed,
  RULE_NAME_MAX,
  removeRule,
  renameRule,
  ruleNameOf,
  ruleRowClass,
  setSeed,
} from './ruleEdit';

const base = () => createDemoData('2026-10-12');
const rule = (id: string, type: Rule['type'], weight: number, hard: boolean): Rule => ({
  id,
  type,
  label: id,
  weight,
  hard,
});

describe('条件の名前・削除', () => {
  it('名前を変えるのはその条件だけ', () => {
    const d0 = base();
    const [r0, r1] = d0.rules;
    if (!r0 || !r1) throw new Error('初期データの条件が足りない');
    const d = renameRule(d0, r0.id, '新しい名前');
    expect(d.rules[0]?.label).toBe('新しい名前');
    expect(d.rules[1]).toBe(r1);
  });
  it('消すのはその条件だけ', () => {
    const d0 = base();
    const r0 = d0.rules[0];
    if (!r0) throw new Error('初期データの条件が足りない');
    const d = removeRule(d0, r0.id);
    expect(d.rules).toHaveLength(d0.rules.length - 1);
    expect(d.rules.some((r) => r.id === r0.id)).toBe(false);
  });
  it('打った名前は前後の空白を落として上限まで。空なら型の名前に戻す', () => {
    expect(ruleNameOf('  希望 ', '型')).toBe('希望');
    expect(ruleNameOf('   ', '型')).toBe('型');
    expect(ruleNameOf('あ'.repeat(RULE_NAME_MAX + 5), '型')).toHaveLength(RULE_NAME_MAX);
  });
});

describe('必須の判定と行の印', () => {
  it('必須かは保存済みの条件で見る（必須にできない型は必須でない）', () => {
    const saved = [rule('a', 'clientRequirement', 3, true), rule('b', 'continuity', 2, false)];
    expect(isSavedHard(saved, rule('a', 'clientRequirement', 3, false))).toBe(true);
    expect(isSavedHard(saved, rule('b', 'continuity', 2, true))).toBe(false);
    expect(isSavedHard(saved, rule('x', 'clientRequirement', 3, true))).toBe(false);
  });
  it('重み0で必須でない行は半透明、下書きのある行は注意の色', () => {
    expect(ruleRowClass({ weight: 2 }, false, false)).toBeUndefined();
    expect(ruleRowClass({ weight: 0 }, false, false)).toBe('is-dim');
    expect(ruleRowClass({ weight: 0 }, true, false)).toBeUndefined();
    expect(ruleRowClass({ weight: 0 }, false, true)).toBe('is-dim is-draft');
    expect(ruleRowClass({ weight: 1 }, false, true)).toBe('is-draft');
  });
});

describe('乱数の種', () => {
  it('整数だけを数にする（前後の空白は許す）', () => {
    expect(parseSeed('42')).toBe(42);
    expect(parseSeed(' -7 ')).toBe(-7);
    expect(parseSeed('1.5')).toBeNull();
    expect(parseSeed('abc')).toBeNull();
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('99999999999999999999')).toBeNull();
  });
  it('同じ種なら元のデータのまま', () => {
    const d = base();
    expect(setSeed(d, d.seed)).toBe(d);
    expect(setSeed(d, d.seed + 1).seed).toBe(d.seed + 1);
  });
});
