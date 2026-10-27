import { describe, expect, it } from 'vitest';
import { MAX_VISIT_TYPES, type VisitType } from '../contracts/documents';
import { visit } from '../matching/fixtures.testkit';
import { createDemoData } from '../seed';
import {
  blankVisitType,
  checkVisitTypeForm,
  removeVisitType,
  saveVisitType,
  typeUses,
  usesOf,
  visitTypeForm,
} from './visitTypes';

const base = () => createDemoData('2026-10-12');
const typeA: VisitType = {
  id: 't-a',
  name: '入浴',
  color: 1,
  durationMinutes: 45,
  requirements: [],
  note: '',
};

describe('訪問の種類の数え方', () => {
  it('種類ごとに使っている訪問・パターンを数える。使っていなければ 0 件', () => {
    const m = typeUses({
      visits: [{ typeId: 't-a' }, { typeId: 't-a' }, { typeId: null }],
      patterns: [{ typeId: 't-a' }, { typeId: null }],
    });
    expect(usesOf(m, 't-a')).toEqual({ visits: 2, patterns: 1 });
    expect(usesOf(m, 't-x')).toEqual({ visits: 0, patterns: 0 });
  });
});

describe('入力の形', () => {
  it('新しい種類は 60 分・色は数から順に回す', () => {
    const t = blankVisitType(1);
    expect(t).toMatchObject({ name: '', color: 1, durationMinutes: 60, requirements: [], note: '' });
    expect(t.id).toMatch(/^t-/);
  });
  it('入力中の形は所要を文字で持ち、元と中身を共有しない', () => {
    const t = { ...typeA, requirements: [{ itemId: 'i', op: 'is' as const, value: true }] };
    const f = visitTypeForm(t);
    expect(f.durationMinutes).toBe('45');
    expect(f.requirements).toEqual(t.requirements);
    expect(f.requirements).not.toBe(t.requirements);
  });
});

describe('入力の確かめ', () => {
  const form = (patch: Partial<ReturnType<typeof visitTypeForm>> = {}) => ({ ...visitTypeForm(typeA), ...patch });
  it('名前は前後の空白を落として保存する', () => {
    expect(checkVisitTypeForm(form({ name: ' 入浴 ' }), [], true)).toEqual({ type: { ...typeA, name: '入浴' } });
  });
  it('同じ名前のほかの種類があれば名前の欄の誤り（自分とは比べない）', () => {
    const other = { ...typeA, id: 't-b' };
    expect(checkVisitTypeForm(form(), [other], false)).toEqual({
      error: { text: '「入浴」と同じ名前の種類があります。名前を変えてください', field: 'name' },
    });
    expect('type' in checkVisitTypeForm(form(), [typeA], false)).toBe(true);
  });
  it('足すときに上限なら誤り', () => {
    const many = Array.from({ length: MAX_VISIT_TYPES }, (_, i) => ({ ...typeA, id: `t-${i}`, name: `種類${i}` }));
    expect(checkVisitTypeForm(form(), many, true)).toEqual({ error: { text: `種類は${MAX_VISIT_TYPES}までです` } });
  });
  it('名前が空・所要が範囲の外なら、その欄の誤り', () => {
    expect(checkVisitTypeForm(form({ name: '  ' }), [], true)).toEqual({
      error: { text: '名前は1〜20字で入れてください', field: 'name' },
    });
    expect(checkVisitTypeForm(form({ durationMinutes: '3' }), [], true)).toEqual({
      error: { text: '標準の所要は5〜720分で入れてください', field: 'durationMinutes' },
    });
  });
});

describe('種類の保存と削除', () => {
  it('同じ id は置き換え、無ければ最後に足す', () => {
    const d0 = { ...base(), visitTypes: [typeA] };
    const d1 = saveVisitType(d0, { ...typeA, name: '入浴介助' });
    expect(d1.visitTypes).toEqual([{ ...typeA, name: '入浴介助' }]);
    const d2 = saveVisitType(d1, { ...typeA, id: 't-b' });
    expect(d2.visitTypes.map((t) => t.id)).toEqual(['t-a', 't-b']);
  });
  it('消すと、使っている訪問・パターンは種類なしになる', () => {
    const d0 = base();
    const [p0, p1] = d0.patterns;
    if (!p0 || !p1) throw new Error('初期データが足りない');
    const d = removeVisitType(
      {
        ...d0,
        visitTypes: [typeA, { ...typeA, id: 't-b' }],
        visits: [
          visit('v1', 'c1', '09:00', '09:00', { typeId: 't-a' }),
          visit('v2', 'c1', '10:00', '10:00', { typeId: 't-b' }),
        ],
        patterns: [
          { ...p0, typeId: 't-a' },
          { ...p1, typeId: 't-b' },
        ],
      },
      't-a',
    );
    expect(d.visitTypes.map((t) => t.id)).toEqual(['t-b']);
    expect(d.visits.map((v) => v.typeId)).toEqual([null, 't-b']);
    expect(d.patterns.map((p) => p.typeId)).toEqual([null, 't-b']);
  });
});
