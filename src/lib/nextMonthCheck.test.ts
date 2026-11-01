import { describe, expect, it } from 'vitest';
import type { IssueKind } from './dayPlan';
import type { DayStatus } from './month';
import { NEXT_MONTH_FROM_DAY, nextMonthCheck, nextMonthCheckKey, nextMonthTarget } from './nextMonthCheck';

/** 日の状態（訪問の件数と、訪問ID → 検査の種類の並び）だけ持つ最小のもの */
const day = (date: string, count: number, issues: Record<string, IssueKind[]> = {}): DayStatus => ({
  date,
  count,
  state: 'none',
  unassigned: 0,
  issues: new Map(Object.entries(issues).map(([id, kinds]) => [id, kinds.map((kind) => ({ kind, label: kind }))])),
  care: Object.keys(issues).length,
  changes: 0,
  absence: false,
  overSpan: [],
  needsCare: Object.keys(issues).length > 0,
});

describe('nextMonthTarget（来月の確認を出すか。PRD D413）', () => {
  it('切で月の20日以降なら来月、19日までは出さない', () => {
    expect(NEXT_MONTH_FROM_DAY).toBe(20);
    expect(nextMonthTarget('2026-11-19', false, {})).toBeNull();
    expect(nextMonthTarget('2026-11-20', false, {})).toBe('2026-12');
    expect(nextMonthTarget('2026-11-30', false, {})).toBe('2026-12');
  });
  it('年をまたぐ：12月の20日以降は翌年の1月', () => {
    expect(nextMonthTarget('2026-12-25', false, {})).toBe('2027-01');
  });
  it('エキスパート機能が入なら出さない', () => {
    expect(nextMonthTarget('2026-11-25', true, {})).toBeNull();
  });
  it('［×］で閉じたら（今月の鍵が false）その月の間は出さず、次の月の20日にはまた出す', () => {
    const stored = { [nextMonthCheckKey('2026-11-21')]: false };
    expect(nextMonthCheckKey('2026-11-21')).toBe('nextMonth:2026-11');
    expect(nextMonthTarget('2026-11-30', false, stored)).toBeNull();
    expect(nextMonthTarget('2026-12-20', false, stored)).toBe('2027-01');
  });
});

describe('nextMonthCheck（来月の件数と要対応。PRD D413）', () => {
  it('来月の訪問の件数を数え、要対応が無ければ「〈来月〉の予定 N件はできています」だけ', () => {
    const c = nextMonthCheck([day('2026-11-30', 9), day('2026-12-01', 5), day('2026-12-31', 4)], '2026-12');
    expect(c).toEqual({
      ym: '2026-12',
      label: '12月',
      total: 9,
      counts: { unassigned: 0, overlap: 0, off: 0 },
      text: '12月の予定 9件はできています',
    });
  });
  it('担当なし・重なり・休みの人を要対応の帯と同じ数え方で足す（0件の種類は書かない。条件に合わないは数えない）', () => {
    const c = nextMonthCheck(
      [
        // 今月の担当なしは数えない
        day('2026-11-28', 3, { x: ['unassigned'] }),
        day('2026-12-02', 6, { a: ['unassigned'], b: ['unassigned', 'late'], c: ['notAllowed'] }),
        day('2026-12-03', 6, { d: ['off', 'late'] }),
      ],
      '2026-12',
    );
    expect(c?.counts).toEqual({ unassigned: 2, overlap: 0, off: 1 });
    expect(c?.text).toBe('12月の予定 12件はできています・担当なし 2件・休みの人 1件');
    const all = nextMonthCheck([day('2027-01-05', 2, { a: ['unassigned'], b: ['late'], c: ['off'] })], '2027-01');
    expect(all?.text).toBe('1月の予定 2件はできています・担当なし 1件・重なり 1件・休みの人 1件');
  });
  it('来月に訪問が1件も無ければ null（出さない）', () => {
    expect(nextMonthCheck([], '2026-12')).toBeNull();
    expect(nextMonthCheck([day('2026-11-30', 4), day('2026-12-01', 0)], '2026-12')).toBeNull();
  });
});
