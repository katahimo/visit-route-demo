import { describe, expect, it } from 'vitest';
import type { Client } from '../contracts/documents';
import { clientOn, place2On, placeOn } from './place2';

const home = {
  address: '架空市本町1丁目',
  lat: 35.1,
  lng: 139.1,
  postalCode: '1000001',
  travelMinutes: 90,
  farTrip: true,
};
const p2 = {
  address: '架空市駅前2丁目',
  lat: 35.2,
  lng: 139.2,
  postalCode: '1000002',
  from: '2026-08-01',
  to: '2026-08-30',
};
const c = (place2?: typeof p2): Pick<Client, 'place' | 'place2'> => ({ place: home, ...(place2 ? { place2 } : {}) });

describe('期間つきの訪問先（住所2）', () => {
  it('期間の両端を含む。空の端は限らない', () => {
    expect(place2On(p2, '2026-07-31')).toBe(false);
    expect(place2On(p2, '2026-08-01')).toBe(true);
    expect(place2On(p2, '2026-08-30')).toBe(true);
    expect(place2On(p2, '2026-08-31')).toBe(false);
    expect(place2On({ from: '', to: '' }, '2000-01-01')).toBe(true);
    expect(place2On({ from: '2026-08-01', to: '' }, '2030-01-01')).toBe(true);
    expect(place2On({ from: '', to: '2026-08-30' }, '2026-08-31')).toBe(false);
    expect(place2On(undefined, '2026-08-15')).toBe(false);
  });
  it('期間内は住所2（移動時間・遠方は付けない）、期間外・住所2 なしは住所のまま同じもの', () => {
    expect(placeOn(c(p2), '2026-08-15')).toEqual({
      address: '架空市駅前2丁目',
      lat: 35.2,
      lng: 139.2,
      postalCode: '1000002',
    });
    expect(placeOn(c(p2), '2026-09-01')).toBe(home);
    expect(placeOn(c(), '2026-08-15')).toBe(home);
    const out = c(p2);
    expect(clientOn(out, '2026-09-01')).toBe(out);
    expect(clientOn(out, '2026-08-15').place.address).toBe('架空市駅前2丁目');
  });
});
