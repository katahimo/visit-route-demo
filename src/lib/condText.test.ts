import { describe, expect, it } from 'vitest';
import type { Item } from '../contracts/rules';
import { conditionText } from '../matching';
import { condText } from './condText';

const pet: Item = { id: 'pet', name: 'ペット', target: 'client', kind: 'flag', options: [] };
const gender: Item = { id: 'gender', name: '性別', target: 'staff', kind: 'choice', options: ['女性', '男性'] };

describe('condText（条件の表示文）', () => {
  it('あり/なしの項目は「項目：あり」の形。not は「未確認も可」を足す', () => {
    expect(condText({ itemId: 'pet', op: 'is', value: true }, pet)).toBe('ペット：あり');
    expect(condText({ itemId: 'pet', op: 'is', value: false }, pet)).toBe('ペット：なし');
    expect(condText({ itemId: 'pet', op: 'not', value: true }, pet)).toBe('ペット：なし（未確認も可）');
  });
  it('ほかは matching の conditionText（項目が無いときも）', () => {
    const c = { itemId: 'gender', op: 'is' as const, value: '女性' };
    expect(condText(c, gender)).toBe(conditionText(c, gender));
    expect(condText({ itemId: 'x', op: 'is', value: 'a' }, undefined)).toBe('（項目がありません）');
  });
});
