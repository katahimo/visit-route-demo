import { describe, expect, it } from 'vitest';
import type { VacancyCell, VacancyResult } from '../contracts/vacancy';
import { client, DATE, makeData, staff } from '../matching/fixtures.testkit';
import { HOLD_DAYS, holdData, holdPatterns, holdSlots } from './hold';

// DATE（2026-10-12）は月曜

/** マス（weeksOk/weeksTotal で ○△×？ が決まる） */
const cell = (weekday: number, start: number, weeksOk: number, weeksTotal = 4): VacancyCell => ({
  weekday,
  start,
  byDate: [],
  min: weeksOk === weeksTotal ? 1 : 0,
  weeksOk,
  weeksTotal,
});
const result = (cells: VacancyCell[]): VacancyResult => ({
  exact: false,
  dates: [],
  noPlanDates: [],
  times: [...new Set(cells.map((c) => c.start))].sort((a, b) => a - b),
  cells,
});

describe('holdSlots（仮押さえの曜日と開始時刻）', () => {
  const r = result([
    cell(3, 600, 4), // 水 10:00 ○
    cell(1, 660, 4), // 月 11:00 ○
    cell(1, 600, 4), // 月 10:00 ○
    cell(2, 600, 2), // 火 10:00 △
    cell(0, 600, 4), // 日 10:00 ○
  ]);
  it('月〜日の順に、曜日ごとの最初の ○ を週の回数まで', () => {
    expect(holdSlots(r, [], '09:00', '12:00', 2)).toEqual([
      { weekday: 1, start: 600 },
      { weekday: 3, start: 600 },
    ]);
    expect(holdSlots(r, [], '09:00', '12:00', 3)).toEqual([
      { weekday: 1, start: 600 },
      { weekday: 3, start: 600 },
      { weekday: 0, start: 600 },
    ]);
  });
  it('希望の曜日・時間帯の中だけ見る（から・までを含む）', () => {
    expect(holdSlots(r, [1, 2], '11:00', '11:00', 1)).toEqual([{ weekday: 1, start: 660 }]);
    expect(holdSlots(r, [2], '09:00', '12:00', 1)).toEqual([]);
  });
  it('○ の曜日が週の回数に足りなければ空', () => {
    expect(holdSlots(r, [], '09:00', '12:00', 4)).toEqual([]);
  });
});

describe('holdPatterns（仮押さえの定期パターン）', () => {
  it('曜日ごとに毎週・開始時刻の固定のパターンを作る', () => {
    const ps = holdPatterns(
      'c9',
      [
        { weekday: 1, start: 600 },
        { weekday: 3, start: 630 },
      ],
      {
        typeId: null,
        durationMinutes: 60,
        from: DATE,
      },
    );
    expect(ps).toHaveLength(2);
    expect(ps?.[1]).toMatchObject({
      clientId: 'c9',
      weekdays: [3],
      everyWeeks: 1,
      windowKind: 'fixed',
      earliestStart: '10:30',
      latestStart: '10:30',
      durationMinutes: 60,
      from: DATE,
      to: null,
      usualStaffId: null,
    });
  });
  it('契約の形に合わなければ null', () => {
    expect(holdPatterns('c9', [{ weekday: 1, start: 600 }], { typeId: null, durationMinutes: 60, from: 'x' })).toBe(
      null,
    );
  });
});

describe('holdData（仮押さえの DemoData）', () => {
  it('〈利用者さん〉とパターンを足し、4週の回を空き時間に入れて、いちばん多く入った人を繰り返しの担当にする', () => {
    const d = makeData({ staff: [staff('s1', 38.26, 140.87)] });
    const c = client('c9', 38.27, 140.88, { tentative: true });
    const ps = holdPatterns(c.id, [{ weekday: 1, start: 600 }], { typeId: null, durationMinutes: 60, from: DATE });
    const r = holdData(d, c, ps ?? [], DATE);
    expect(r.added).toBe(HOLD_DAYS / 7);
    expect(r.inserted).toBe(r.added);
    expect(r.failedDates).toEqual([]);
    expect(r.data.clients.map((x) => x.id)).toEqual(['c9']);
    expect(r.data.patterns[0]?.usualStaffId).toBe('s1');
    // 元のデータは変えない
    expect(d.clients).toEqual([]);
    expect(d.patterns).toEqual([]);
  });
  it('入らない日は failedDates に出し、担当は null のまま', () => {
    const d = makeData({ staff: [staff('s1', 38.26, 140.87)] });
    const c = client('c9', 38.27, 140.88);
    // 23:00 開始は勤務の外で入らない
    const ps = holdPatterns(c.id, [{ weekday: 1, start: 1380 }], { typeId: null, durationMinutes: 30, from: DATE });
    const r = holdData(d, c, ps ?? [], DATE);
    expect(r.inserted).toBe(0);
    expect(r.failedDates).toHaveLength(r.added);
    expect(r.data.patterns[0]?.usualStaffId).toBe(null);
  });
});
