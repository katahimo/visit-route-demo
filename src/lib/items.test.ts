import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Item } from '../contracts/rules';
import { createDemoData } from '../seed';
import {
  addItem,
  changeItemKind,
  hasOptions,
  itemRefs,
  itemValueCount,
  newItemName,
  optionUseCount,
  patchItem,
  removeItem,
  removeOption,
  renameOption,
  replaceOption,
} from './items';

/** 〈スタッフ〉の項目「資格」（いくつでも選ぶ）を、スタッフ2人の値と利用者さん2人の条件で使うデータ */
const qual: Item = { id: 'i-q', name: '資格', target: 'staff', kind: 'multi', options: ['看護師', '介護福祉士'] };
const pet: Item = { id: 'i-p', name: 'ペット', target: 'client', kind: 'flag', options: [] };
function fixture(): DemoData {
  const d = createDemoData('2026-10-12');
  const [s0, s1, s2] = d.staff;
  const [c0, c1, c2] = d.clients;
  if (!s0 || !s1 || !s2 || !c0 || !c1 || !c2) throw new Error('初期データの人が足りない');
  return {
    ...d,
    items: [qual, pet],
    staff: [
      { ...s0, traits: { [qual.id]: ['看護師', '介護福祉士'] }, requirements: [], preferences: [] },
      {
        ...s1,
        traits: { [qual.id]: ['看護師'] },
        requirements: [{ itemId: pet.id, op: 'is', value: false }],
        preferences: [],
      },
      { ...s2, traits: { [qual.id]: [] }, requirements: [], preferences: [] },
    ],
    clients: [
      {
        ...c0,
        traits: { [pet.id]: true },
        requirements: [{ itemId: qual.id, op: 'hasAny', value: ['看護師'] }],
        preferences: [],
      },
      {
        ...c1,
        traits: {},
        requirements: [],
        preferences: [{ itemId: qual.id, op: 'hasAny', value: ['看護師', '介護福祉士'] }],
      },
      { ...c2, traits: {}, requirements: [], preferences: [] },
    ],
  };
}
const itemOf = (d: DemoData, id: string) => d.items.find((i) => i.id === id);

describe('項目の数え方', () => {
  it('参照している条件の持ち主は、相手側（〈スタッフ〉の項目なら利用者さん）の名前', () => {
    const d = fixture();
    expect(itemRefs(d, qual)).toEqual([d.clients[0]!.displayName, d.clients[1]!.displayName]);
    expect(itemRefs(d, pet)).toEqual([d.staff[1]!.name]);
  });
  it('値の件数は空の配列・null を数えない', () => {
    const d = fixture();
    expect(itemValueCount(d, qual)).toBe(2);
    expect(itemValueCount(d, pet)).toBe(1);
  });
  it('選択肢を使っている件数', () => {
    const d = fixture();
    expect(optionUseCount(d, qual, '看護師')).toBe(2);
    expect(optionUseCount(d, qual, '介護福祉士')).toBe(1);
  });
  it('選択肢を持つのは choice・multi だけ', () => {
    expect(hasOptions('choice')).toBe(true);
    expect(hasOptions('multi')).toBe(true);
    expect(hasOptions('flag')).toBe(false);
    expect(hasOptions('number')).toBe(false);
  });
  it('値の選択肢を替える・外す', () => {
    expect(replaceOption(undefined, 'a', 'b')).toBeNull();
    expect(replaceOption('a', 'a', 'b')).toBe('b');
    expect(replaceOption('a', 'a', null)).toBeNull();
    expect(replaceOption(['a', 'c'], 'a', 'b')).toEqual(['b', 'c']);
    expect(replaceOption(['a', 'c'], 'a', null)).toEqual(['c']);
    expect(replaceOption(3, 'a', 'b')).toBe(3);
  });
});

describe('項目を足す・直す', () => {
  it('名前は同じ対象の中で重ならない「新しい項目N」', () => {
    const a = { ...qual, name: '新しい項目2' };
    expect(newItemName([])).toBe('新しい項目1');
    expect(newItemName([a])).toBe('新しい項目3');
  });
  it('足すのはあり／なしの形で最後に。名前は同じ対象の項目だけで決める', () => {
    const d = addItem(fixture(), 'staff');
    const added = d.items.at(-1)!;
    expect(added).toMatchObject({ name: '新しい項目2', target: 'staff', kind: 'flag', options: [] });
    expect(added.id).toMatch(/^i-/);
  });
  it('直すのはその項目だけ', () => {
    const d = patchItem(fixture(), qual.id, { name: '免許' });
    expect(itemOf(d, qual.id)?.name).toBe('免許');
    expect(itemOf(d, pet.id)).toEqual(pet);
  });
});

describe('項目を消す', () => {
  it('項目と入っている値を消し、条件は残す', () => {
    const d = removeItem(fixture(), qual);
    expect(itemOf(d, qual.id)).toBeUndefined();
    expect(d.staff.every((s) => !(qual.id in s.traits))).toBe(true);
    expect(d.clients[0]!.requirements).toHaveLength(1);
  });
});

describe('項目の形を変える', () => {
  it('値と、その項目を使う条件を消す。選択肢を持たない形なら選択肢も消す', () => {
    const d = changeItemKind(fixture(), qual, 'flag');
    expect(itemOf(d, qual.id)).toMatchObject({ kind: 'flag', options: [] });
    expect(d.staff.every((s) => !(qual.id in s.traits))).toBe(true);
    expect(d.clients[0]!.requirements).toEqual([]);
    expect(d.clients[1]!.preferences).toEqual([]);
    // ほかの項目の条件は残す
    expect(d.staff[1]!.requirements).toHaveLength(1);
  });
  it('選択肢を持つ形のあいだなら選択肢は残す', () => {
    const d = changeItemKind(fixture(), qual, 'choice');
    expect(itemOf(d, qual.id)).toMatchObject({ kind: 'choice', options: ['看護師', '介護福祉士'] });
  });
});

describe('選択肢の名前を変える・消す', () => {
  it('名前を変えると、選択肢・入っている値・条件の値も替わる', () => {
    const d = renameOption(fixture(), qual, '看護師', '正看護師');
    expect(itemOf(d, qual.id)?.options).toEqual(['正看護師', '介護福祉士']);
    expect(d.staff[0]!.traits[qual.id]).toEqual(['正看護師', '介護福祉士']);
    expect(d.staff[1]!.traits[qual.id]).toEqual(['正看護師']);
    expect(d.clients[0]!.requirements[0]!.value).toEqual(['正看護師']);
    expect(d.clients[1]!.preferences[0]!.value).toEqual(['正看護師', '介護福祉士']);
    // 値を持たない人には足さない
    expect(qual.id in d.clients[2]!.traits).toBe(false);
  });
  it('消すと、値から外し、値が空になった条件は消す', () => {
    const d = removeOption(fixture(), qual, '看護師');
    expect(itemOf(d, qual.id)?.options).toEqual(['介護福祉士']);
    expect(d.staff[0]!.traits[qual.id]).toEqual(['介護福祉士']);
    expect(d.staff[1]!.traits[qual.id]).toEqual([]);
    expect(d.clients[0]!.requirements).toEqual([]);
    expect(d.clients[1]!.preferences[0]!.value).toEqual(['介護福祉士']);
  });
  it('ひとつ選ぶ形の値・条件がその選択肢なら、値は null にし条件は消す', () => {
    const one: Item = { ...qual, kind: 'choice' };
    const base = fixture();
    const d0: DemoData = {
      ...base,
      items: [one, pet],
      staff: base.staff.map((s, i) => ({ ...s, traits: i === 0 ? { [one.id]: '看護師' } : {} })),
      clients: base.clients.map((c, i) => ({
        ...c,
        requirements: i === 0 ? [{ itemId: one.id, op: 'is' as const, value: '看護師' }] : [],
        preferences: [],
      })),
    };
    const d = removeOption(d0, one, '看護師');
    expect(d.staff[0]!.traits[one.id]).toBeNull();
    expect(d.clients[0]!.requirements).toEqual([]);
  });
});
