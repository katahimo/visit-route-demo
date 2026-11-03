// 勤務日・時間に入らない予約の判定（PRD D428。ADR-0095）
import { describe, expect, it } from 'vitest';
import { makeData, staff, visit } from '../matching/fixtures.testkit';
import { bookingsOutsideHours, outsideHoursNote } from './bookingFit';

// 2026-11-05 は木曜。staff の既定は月〜金 8:00〜18:00
const D = '2026-11-05';
const dataOf = (over: Parameters<typeof makeData>[0], visits: ReturnType<typeof visit>[]) =>
  makeData({ ...over, visits, availability: [] });
const evening = visit('v1', 'c1', '17:00', '17:00', { date: D, durationMinutes: 180 });

describe('bookingsOutsideHours', () => {
  const s = staff('s1', 35, 139);
  const base = dataOf({ staff: [s] }, []);

  it('勤務の終わりを越える予約を数え、例を添える', () => {
    const r = bookingsOutsideHours(base, dataOf({ staff: [s] }, [evening]));
    expect(r).toEqual({ count: 1, example: '11/5（木）17:00〜20:00' });
    expect(outsideHoursNote(r, 'シッター')).toBe(
      '1件はどのシッターの勤務日・時間にも入りません（例：11/5（木）17:00〜20:00）。シッターの勤務時間を広げると組めます',
    );
  });

  it('勤務の時間を広げた人がいれば入る。窓があれば窓の中で収まればよい', () => {
    const wide = staff('s2', 35, 139, { shiftEnd: '22:00' });
    expect(bookingsOutsideHours(base, dataOf({ staff: [s, wide] }, [evening]))).toBeNull();
    const win = visit('v2', 'c1', '15:00', '17:00', { date: D, durationMinutes: 180 });
    expect(bookingsOutsideHours(base, dataOf({ staff: [s] }, [win]))).toBeNull();
  });

  it('勤務日でない日（日曜）は入らない', () => {
    const sun = visit('v3', 'c1', '10:00', '10:00', { date: '2026-11-08', durationMinutes: 60 });
    expect(bookingsOutsideHours(base, dataOf({ staff: [s] }, [sun]))?.count).toBe(1);
  });

  it('休止・最終勤務日後の人は数えない', () => {
    const paused = staff('s2', 35, 139, { shiftEnd: '22:00', active: false });
    const left = staff('s3', 35, 139, { shiftEnd: '22:00', lastDay: '2026-11-04' });
    expect(bookingsOutsideHours(base, dataOf({ staff: [s, paused, left] }, [evening]))?.count).toBe(1);
  });

  it('日ごとの勤務の上書きを見る', () => {
    const next = dataOf({ staff: [s] }, [evening]);
    next.availability = [{ staffId: 's1', date: D, slots: [{ start: '16:00', end: '21:00' }] }];
    expect(bookingsOutsideHours(base, next)).toBeNull();
  });

  it('取り消した予約・読み込みで変わっていない予約・利用中の人がいないときは数えない', () => {
    expect(bookingsOutsideHours(base, dataOf({ staff: [s] }, [{ ...evening, cancelled: true }]))).toBeNull();
    const same = dataOf({ staff: [s] }, [evening]);
    expect(bookingsOutsideHours(same, same)).toBeNull();
    expect(bookingsOutsideHours(base, dataOf({ staff: [{ ...s, active: false }] }, [evening]))).toBeNull();
  });
});
