import { describe, expect, it } from 'vitest';
import { chipFoldKey, foldHidden, nextFullHeight } from './fold';

const items = [
  { id: 'a', top: 0 },
  { id: 'b', top: 1 },
  { id: 'c', top: 30 },
  { id: 'd', top: 31 },
  { id: 'e', top: 60 },
  { id: 'f', top: 90 },
];

describe('foldHidden', () => {
  it('2行に入らない項目を隠す', () => {
    expect([...foldHidden(items, new Set(), 2)]).toEqual(['e', 'f']);
  });
  it('選んでいる人は3行目より下でも隠さない', () => {
    expect([...foldHidden(items, new Set(['f']), 2)]).toEqual(['e']);
  });
  it('見出しの行（firstTop）も1行目に数える', () => {
    expect([...foldHidden(items.slice(2), new Set(), 2, 0)]).toEqual(['e', 'f']);
  });
  it('入りきれば何も隠さない', () => {
    expect(foldHidden(items.slice(0, 4), new Set(), 2).size).toBe(0);
    expect(foldHidden([], new Set(), 2).size).toBe(0);
  });
});

describe('chipFoldKey', () => {
  const base = { width: 300, height: 80, epoch: 0, label: '利用者さん' };
  const p = { id: 'a', name: '青木' };
  const key = (x = base, people: Parameters<typeof chipFoldKey>[1] = [p], f = () => true) => chipFoldKey(x, people, f);
  it('同じ入力なら同じ鍵', () => {
    expect(key()).toBe(key());
  });
  it('幅・高さ・書体・見出しが変われば変わる', () => {
    for (const d of [{ width: 301 }, { height: 120 }, { epoch: 1 }, { label: 'x' }]) {
      expect(key({ ...base, ...d })).not.toBe(key());
    }
  });
  it('選んでいるか・名前・色・印・バッジが変われば変わる', () => {
    expect(key(base, [p], () => false)).not.toBe(key());
    for (const d of [
      { name: '青木 花' },
      { color: '#f00' },
      { mark: {} },
      { badges: [{ short: '介', name: '介護福祉士' }] },
    ]) {
      expect(key(base, [{ ...p, ...d }])).not.toBe(key());
    }
  });
});

describe('nextFullHeight', () => {
  it('全員を並べているときだけ高さを採る', () => {
    expect(nextFullHeight(80, 120.4, true)).toBe(120);
    expect(nextFullHeight(80, 50, false)).toBe(80);
  });
});
