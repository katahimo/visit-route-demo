// 住所から位置を探す順（lib/placePriority。PRD D445）：予定のある〈利用者さん〉を近い日から先に・組める段階
import { describe, expect, it } from 'vitest';
import type { Pattern } from '../contracts/documents';
import { client, makeData, staff, visit } from '../matching/fixtures.testkit';
import { placeAllTargets } from './placeAll';
import { arrangeReady, firstVisitDays, mattersForArrange, placeOrder } from './placePriority';

const TODAY = '2026-11-07';
const noPlace = (id: string) =>
  client(id, 0, 0, { displayName: id, place: { address: `架空市${id}`, lat: null, lng: null, postalCode: '' } });
const v = (id: string, clientId: string, date: string, over = {}) =>
  visit(id, clientId, '10:00', '10:00', { date, ...over });
const pattern = (clientId: string, from: string, to: string | null) => ({ clientId, from, to }) as unknown as Pattern;

describe('firstVisitDays', () => {
  it('組む範囲（今日〜翌月末）の最初の日。取り消し・範囲の外は数えない。繰り返しは範囲と重なる最初の日', () => {
    const d = makeData({
      visits: [
        v('1', 'a', '2026-11-20'),
        v('2', 'a', '2026-11-10'),
        v('3', 'b', '2026-11-06'),
        v('4', 'c', '2026-11-12', { cancelled: true }),
        v('5', 'd', '2027-01-05'),
      ],
      patterns: [
        pattern('e', '2026-10-01', null),
        pattern('f', '2026-12-15', null),
        pattern('g', '2026-01-01', '2026-10-31'),
      ],
    });
    expect(Object.fromEntries(firstVisitDays(d, TODAY))).toEqual({
      a: '2026-11-10',
      e: TODAY,
      f: '2026-12-15',
    });
  });
});

describe('placeOrder・arrangeReady', () => {
  const d = makeData({
    clients: [noPlace('a'), noPlace('b'), noPlace('c')],
    visits: [v('1', 'c', '2026-11-30'), v('2', 'b', '2026-11-09')],
  });
  const people = placeAllTargets(d, 'client').targets;
  it('予定のある人を近い日から先に、予定の無い人はあと（元の順）', () => {
    expect(placeOrder(d, 'client', people, TODAY).map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(mattersForArrange(d, 'client', 'a', TODAY)).toBe(false);
    expect(mattersForArrange(d, 'client', 'b', TODAY)).toBe(true);
    expect(mattersForArrange(d, 'staff', 's1', TODAY)).toBe(true);
  });
  it('予定のある人をみな探したら組める（見つからなかった人も探したに数える）。位置の無い〈スタッフ〉が残れば組めない', () => {
    expect(arrangeReady(d, TODAY, new Set(['client:b']))).toBe(false);
    expect(arrangeReady(d, TODAY, new Set(['client:b', 'client:c']))).toBe(true);
    const withStaff = { ...d, staff: [staff('s1', 0, 0, { home: { address: '架空市', lat: null, lng: null } })] };
    expect(arrangeReady(withStaff, TODAY, new Set(['client:b', 'client:c']))).toBe(false);
    expect(arrangeReady(withStaff, TODAY, new Set(['client:b', 'client:c', 'staff:s1']))).toBe(true);
  });
});
