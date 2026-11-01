// 初めての訪問先（PRD D415。ADR-0082）の判定と決まりごとの行
import { describe, expect, it } from 'vitest';
import { addDays } from '../domain/time';
import { client, DATE, makeData, visit } from '../matching/fixtures.testkit';
import { FIRST_VISIT_WEEKS, isFirstVisit, servedPairsBefore, visitRuleLines } from './firstVisit';

const on = (id: string, date: string, staffId: string | null, cancelled = false) =>
  visit(id, 'c1', '10:00', '10:00', { date, staffId, cancelled });

describe('lib/firstVisit', () => {
  it('過去8週に担当した組は初めてでない。8週より前・当日・取り消し・担当なしは数えない', () => {
    const data = makeData({
      clients: [client('c1', 38.26, 140.87)],
      visits: [
        on('a', addDays(DATE, -7), 's1'),
        on('b', addDays(DATE, -7 * FIRST_VISIT_WEEKS), 's2'),
        on('c', addDays(DATE, -7 * FIRST_VISIT_WEEKS - 1), 's3'),
        on('d', DATE, 's4'),
        on('e', addDays(DATE, -1), 's5', true),
        on('f', addDays(DATE, -2), null),
      ],
    });
    const served = servedPairsBefore(data, DATE);
    expect(isFirstVisit(served, 'c1', 's1')).toBe(false);
    expect(isFirstVisit(served, 'c1', 's2')).toBe(false);
    expect(isFirstVisit(served, 'c1', 's3')).toBe(true);
    expect(isFirstVisit(served, 'c1', 's4')).toBe(true);
    expect(isFirstVisit(served, 'c1', 's5')).toBe(true);
    expect(isFirstVisit(served, 'c2', 's1')).toBe(true);
  });

  it('繰り返しの回の担当も履歴に数える', () => {
    const data = makeData({
      clients: [client('c1', 38.26, 140.87)],
      patterns: [
        {
          id: 'p1',
          clientId: 'c1',
          repeat: 'weekly',
          everyWeeks: 1,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          monthWeeks: [],
          dayTimes: [],
          windowKind: 'fixed',
          earliestStart: '10:00',
          latestStart: '10:00',
          durationMinutes: 60,
          from: addDays(DATE, -3),
          to: null,
          usualStaffId: 's1',
          typeId: null,
          note: '',
        },
      ],
    });
    expect(isFirstVisit(servedPairsBefore(data, DATE), 'c1', 's1')).toBe(false);
  });

  it('決まりごとの行は入っている項目だけを D66 の並びで、改行は空白に', () => {
    const c = client('c1', 38.26, 140.87, {
      entryNote: '',
      keyNote: 'ポストの\nキーボックス',
      parkingNote: '  ',
      cautionNote: '段差',
    });
    expect(visitRuleLines(c)).toEqual([
      { label: '鍵', text: 'ポストの キーボックス' },
      { label: '注意', text: '段差' },
    ]);
    expect(visitRuleLines(null)).toEqual([]);
  });
});
