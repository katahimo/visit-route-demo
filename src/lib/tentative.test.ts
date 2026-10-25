import { describe, expect, it } from 'vitest';
import { DATE } from '../matching/fixtures';
import { confirmedDatesOf } from './tentative';

describe('confirmedDatesOf', () => {
  it('その人の訪問を伝えた日（日付の順）', () => {
    const snap = (date: string, clientId: string) => ({
      date,
      at: 1,
      visits: [{ id: `v-${date}`, clientId, staffId: 's1', start: '09:00' }],
    });
    const snapshots = {
      '2026-10-14': snap('2026-10-14', 'c2'),
      [DATE]: snap(DATE, 'c2'),
      '2026-10-13': snap('2026-10-13', 'c1'),
    };
    expect(confirmedDatesOf({ snapshots }, 'c2')).toEqual([DATE, '2026-10-14']);
    expect(confirmedDatesOf({ snapshots: {} }, 'c2')).toEqual([]);
  });
});
