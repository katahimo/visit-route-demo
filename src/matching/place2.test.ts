// 期間つきの訪問先（住所2。ADR-0105）：その日の問題（compile）は、期間内の訪問を住所2 の位置で見積もる
import { describe, expect, it } from 'vitest';
import { compile } from './compile';
import { client, DATE, makeData, staff, visit } from './fixtures.testkit';

const far = { address: '遠い所', postalCode: '', lat: 36.0, lng: 140.0 };

describe('住所2 の位置で移動を見積もる', () => {
  const s = staff('s1', 35.0, 139.0);
  const home = (place2?: { from: string; to: string }) =>
    client('c1', 35.0, 139.0, place2 ? { place2: { ...far, ...place2 } } : {});

  it('期間内は住所2 の位置、期間外・住所2 なしは住所の位置', () => {
    const at = (c: ReturnType<typeof home>) => {
      const p = compile(makeData({ staff: [s], clients: [c], visits: [visit('v1', 'c1', '09:00', '12:00')] }), DATE);
      return p.travel[0]![p.visits[0]!.point]!;
    };
    const near = at(home());
    expect(at(home({ from: DATE, to: DATE }))).toBeGreaterThan(near);
    expect(at(home({ from: '', to: '' }))).toBeGreaterThan(near);
    expect(at(home({ from: '2026-01-01', to: '2026-01-31' }))).toBe(near);
  });
});
