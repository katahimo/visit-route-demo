import { describe, expect, it } from 'vitest';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures.testkit';
import { HOME_LABEL } from './mapsLink';
import { prevStopOf } from './prevStop';

const data = (over: Parameters<typeof makeData>[0] = {}) =>
  makeData({
    staff: [staff('s1', 35, 139)],
    clients: [client('c1', 35.1, 139), client('c2', 35.2, 139), client('c3', 35.3, 139)],
    visits: [
      visit('v1', 'c1', '09:00', '09:00', { staffId: 's1' }),
      visit('v2', 'c2', '10:00', '10:00', { staffId: 's1' }),
      visit('v3', 'c3', '11:00', '11:00', { staffId: 's1' }),
    ],
    ...over,
  });

describe('prevStopOf（道順の起点）', () => {
  it('1件目は担当の自宅から', () => {
    const r = prevStopOf(data(), 'v1');
    expect(r?.staff.id).toBe('s1');
    expect(r?.fromName).toBe(HOME_LABEL);
    expect(r?.from).toEqual({ address: '', lat: 35, lng: 139 });
  });

  it('2件目からは開始の順で前の訪問先から', () => {
    const r = prevStopOf(data(), 'v3');
    expect(r?.fromName).toBe('c2');
    expect(r?.from?.lat).toBe(35.2);
  });

  it('取り消した回・休みの回は並びから除く', () => {
    const d = data({
      visits: [
        visit('v1', 'c1', '09:00', '09:00', { staffId: 's1' }),
        visit('v2', 'c2', '10:00', '10:00', { staffId: 's1', cancelled: true }),
        visit('v3', 'c3', '11:00', '11:00', { staffId: 's1' }),
      ],
    });
    expect(prevStopOf(d, 'v3')?.fromName).toBe('c1');
    const leave = data({ clientLeaves: [{ id: 'l1', clientId: 'c2', from: DATE, to: DATE, note: '' }] });
    expect(prevStopOf(leave, 'v3')?.fromName).toBe('c1');
  });

  it('担当なし・取り消し・見つからない訪問は null', () => {
    const d = data({
      visits: [
        visit('v1', 'c1', '09:00', '09:00'),
        visit('v2', 'c2', '10:00', '10:00', { staffId: 's1', cancelled: true }),
      ],
    });
    expect(prevStopOf(d, 'v1')).toBeNull();
    expect(prevStopOf(d, 'v2')).toBeNull();
    expect(prevStopOf(d, 'nope')).toBeNull();
  });
});
