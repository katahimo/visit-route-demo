import { describe, expect, it } from 'vitest';
import { DATE, staff } from '../matching/fixtures.testkit';
import { daySlotsOf, ownerMap } from './dayModel';

describe('daySlotsOf（その日の稼働時間帯）', () => {
  const people = [staff('s1', 38.26, 140.87), staff('s2', 38.26, 140.87), staff('s3', 38.26, 140.87)];
  it('基本の時間・日ごとの上書き・欠勤の差し引き', () => {
    const m = daySlotsOf(
      people,
      {
        availability: [
          { staffId: 's2', date: DATE, slots: [{ start: '09:00', end: '12:00' }] },
          // 別の日の上書きは見ない
          { staffId: 's3', date: '2026-10-13', slots: [] },
        ],
        absences: [
          { id: 'x1', staffId: 's1', date: DATE, from: '10:00', to: '12:00', note: '' },
          { id: 'x2', staffId: 's3', date: '2026-10-13', from: null, to: null, note: '' },
        ],
      },
      DATE,
    );
    expect([...m.keys()]).toEqual(['s1', 's2', 's3']);
    expect(m.get('s1')).toEqual({
      slots: [
        { start: '08:00', end: '10:00' },
        { start: '12:00', end: '18:00' },
      ],
      baseSlots: [{ start: '08:00', end: '18:00' }],
      overridden: false,
      absence: { id: 'x1', staffId: 's1', date: DATE, from: '10:00', to: '12:00', note: '' },
    });
    expect(m.get('s2')).toEqual({
      slots: [{ start: '09:00', end: '12:00' }],
      baseSlots: [{ start: '09:00', end: '12:00' }],
      overridden: true,
      absence: null,
    });
    expect(m.get('s3')).toEqual({
      slots: [{ start: '08:00', end: '18:00' }],
      baseSlots: [{ start: '08:00', end: '18:00' }],
      overridden: false,
      absence: null,
    });
  });
  it('終日の欠勤は時間帯が空（差し引く前は残す）', () => {
    const m = daySlotsOf(
      people.slice(0, 1),
      { availability: [], absences: [{ id: 'x1', staffId: 's1', date: DATE, from: null, to: null, note: '' }] },
      DATE,
    );
    expect(m.get('s1')?.slots).toEqual([]);
    expect(m.get('s1')?.baseSlots).toEqual([{ start: '08:00', end: '18:00' }]);
  });
});

describe('ownerMap', () => {
  it('訪問ID → 担当（未割当は入れない）', () => {
    const m = ownerMap({ s1: ['v1', 'v2'], s2: ['v3'], __none: ['v4'] });
    expect([...m.entries()]).toEqual([
      ['v1', 's1'],
      ['v2', 's1'],
      ['v3', 's2'],
    ]);
  });
});
