// 同行の組（2人体制・研修同行。ADR-0120）の判定
import { describe, expect, it } from 'vitest';
import { companionsOf, hasCompanionBase } from './companion';

const v = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  date: '2026-10-12',
  clientId: 'c1',
  earliestStart: '09:00',
  cancelled: false,
  ...over,
});

describe('companionsOf', () => {
  it('同じ日・同じ〈利用者さん〉・同じ開始（早）で、同行の印のある訪問があれば組。元の訪問は group', () => {
    const m = companionsOf([v('a'), v('b', { accompany: 'pair' }), v('x', { clientId: 'c2' })]);
    expect(m.get('a')).toEqual({ role: 'group', kind: 'pair', partners: ['b'] });
    expect(m.get('b')).toEqual({ role: 'group', kind: 'pair', partners: ['a'] });
    expect(m.has('x')).toBe(false);
  });
  it('研修同行の分は trainee、組の種類は trainee', () => {
    const m = companionsOf([v('a'), v('t', { accompany: 'trainee' })]);
    expect(m.get('a')?.kind).toBe('trainee');
    expect(m.get('t')?.role).toBe('trainee');
  });
  it('同行の印が無い同じ時刻の2件（今までの入れ方）・時刻の違う訪問・取り消した訪問は組にしない', () => {
    expect(companionsOf([v('a'), v('b')]).size).toBe(0);
    expect(companionsOf([v('a'), v('b', { accompany: 'pair', earliestStart: '09:30' })]).size).toBe(0);
    expect(companionsOf([v('a', { cancelled: true }), v('b', { accompany: 'pair' })]).size).toBe(0);
    expect(companionsOf([v('a'), v('b', { accompany: 'pair', date: '2026-10-13' })]).size).toBe(0);
  });
});

describe('hasCompanionBase', () => {
  it('同じ日・〈利用者さん〉・開始（早）の取り消していないほかの訪問があるか', () => {
    const vs = [v('a'), v('c', { cancelled: true, earliestStart: '10:00' })];
    expect(hasCompanionBase(vs, { date: '2026-10-12', clientId: 'c1', earliestStart: '09:00' })).toBe(true);
    expect(hasCompanionBase(vs, { id: 'a', date: '2026-10-12', clientId: 'c1', earliestStart: '09:00' })).toBe(false);
    expect(hasCompanionBase(vs, { date: '2026-10-12', clientId: 'c1', earliestStart: '10:00' })).toBe(false);
  });
});
