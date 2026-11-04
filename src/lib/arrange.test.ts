import { describe, expect, it } from 'vitest';
import { etaText, rangeCounts, scopeOf } from './arrange';

describe('etaText（組む日数の見込み時間）', () => {
  it('1分に満たなければ秒で、超えれば分で書く', () => {
    expect(etaText(1)).toBe('約3〜5秒');
    expect(etaText(11)).toBe('約33〜55秒');
    expect(etaText(12)).toBe('約1〜1分');
    expect(etaText(31)).toBe('約2〜3分');
  });
});

describe('scopeOf（URL から範囲を読む）', () => {
  const today = '2026-11-10';
  it('?date= があれば日', () => {
    expect(scopeOf(new URLSearchParams('date=2026-11-03'), today)).toEqual({
      scope: 'day',
      ym: '2026-11',
      at: '2026-11-03',
    });
  });
  it('?d= があればその日の週（月曜）', () => {
    expect(scopeOf(new URLSearchParams('d=2026-11-04'), today)).toEqual({
      scope: 'week',
      ym: '2026-11',
      at: '2026-11-02',
    });
  });
  it('?ym= があれば月。今日の月なら今日、別の月なら1日', () => {
    expect(scopeOf(new URLSearchParams('ym=2026-11'), today).at).toBe(today);
    expect(scopeOf(new URLSearchParams('ym=2026-12'), today)).toEqual({
      scope: 'month',
      ym: '2026-12',
      at: '2026-12-01',
    });
  });
  it('無効な値は読み飛ばして月にする', () => {
    expect(scopeOf(new URLSearchParams('date=x&d=y&ym=z'), today).scope).toBe('month');
  });
});

describe('rangeCounts（今日以降の担当なし・要対応）', () => {
  const st = (unassigned: number, care: number) => ({ status: { unassigned, care } });
  it('今日より前と状態の無い日は数えない', () => {
    const statuses = new Map([
      ['2026-11-09', st(5, 5)],
      ['2026-11-10', st(2, 1)],
      ['2026-11-11', st(0, 3)],
    ]);
    const dates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
    expect(rangeCounts(dates, statuses, '2026-11-10')).toEqual({ unassigned: 2, unassignedDays: 1, care: 4 });
  });
});

