import { describe, expect, it } from 'vitest';
import {
  addressLine,
  clientColumns,
  clientFolded,
  clientTabKeys,
  shiftText,
  splitFolded,
  staffColumns,
  staffFolded,
  staffNameNote,
  staffTabKeys,
  usualPlanText,
  workDaysText,
} from './peopleView';
import { CLIENT_TABS, STAFF_TABS } from './personPage';

describe('一覧の列', () => {
  it('切は〈利用者さん〉＝名前・住所・いつもの予定、〈スタッフ〉＝名前・勤務日・勤務時間の3列だけ', () => {
    expect(clientColumns(true)).toEqual(['name', 'address', 'plan']);
    expect(staffColumns(true)).toEqual(['name', 'days', 'hours']);
  });
  it('入は今の列のまま', () => {
    expect(clientColumns(false)).toEqual(['name', 'place', 'traits', 'requires', 'usual', 'state']);
    expect(staffColumns(false)).toEqual(['name', 'work', 'traits', 'requires', 'home', 'state']);
  });
});

describe('畳む欄', () => {
  it('切：〈利用者さん〉は段階・特性・決まりごと・担当を畳み、名前（基本）・住所は畳まない', () => {
    const f = clientFolded(true);
    expect(f).toEqual(['stage', 'traits', 'rules', 'staffing']);
    expect(f).not.toContain('basic');
    expect(f).not.toContain('place');
  });
  it('切：〈スタッフ〉は自宅・特性・求めること・最終勤務日・相性・日ごとの勤務を畳み、名前（基本）・ふだんの勤務は畳まない', () => {
    const f = staffFolded(true);
    expect(f).toEqual(['home', 'traits', 'conds', 'lastDay', 'compat', 'overrides']);
    expect(f).not.toContain('basic');
    expect(f).not.toContain('hours');
  });
  it('入は何も畳まない', () => {
    expect(clientFolded(false)).toEqual([]);
    expect(staffFolded(false)).toEqual([]);
  });
  it('splitFolded は並びを変えずに2つに分ける', () => {
    const parts = [
      { part: 'a', node: 1 },
      { part: 'b', node: 2 },
      { part: 'c', node: 3 },
    ];
    expect(splitFolded(parts, ['b'])).toEqual({ shown: [1, 3], folded: [2] });
    expect(splitFolded(parts, [])).toEqual({ shown: [1, 2, 3], folded: [] });
  });
});

describe('タブ', () => {
  it('切は担当・相性のタブを出さない。入はそのまま', () => {
    expect(clientTabKeys(CLIENT_TABS, true)).toEqual(['schedule', 'basic', 'leaves']);
    expect(staffTabKeys(STAFF_TABS, true)).toEqual(['schedule', 'basic', 'hours']);
    expect(clientTabKeys(CLIENT_TABS, false)).toEqual([...CLIENT_TABS]);
    expect(staffTabKeys(STAFF_TABS, false)).toEqual([...STAFF_TABS]);
  });
});

describe('短い文', () => {
  it('住所の1行：住所が無ければ郵便番号、どちらも無ければ空', () => {
    expect(addressLine({ address: '東京都千代田区1-1', postalCode: '1000001' })).toBe('東京都千代田区1-1');
    expect(addressLine({ address: '', postalCode: '1000001' })).toBe('〒100-0001');
    expect(addressLine({ address: '', postalCode: '' })).toBe('');
  });
  it('勤務日は曜日の順、勤務時間は始〜終', () => {
    expect(workDaysText({ workDays: [5, 1, 3] })).toBe('月水金');
    expect(shiftText({ shiftStart: '9:00', shiftEnd: '17:00' })).toBe('9:00〜17:00');
  });
  it('休止中だけ名前のそばに印', () => {
    expect(staffNameNote({ active: true })).toBe('');
    expect(staffNameNote({ active: false })).toBe('休止中');
  });
  const pat = (clientId: string, from: string, to: string | null, weekdays: number[], t: string) => ({
    clientId,
    from,
    to,
    weekdays,
    everyWeeks: 1,
    repeat: 'weekly' as const,
    monthWeeks: [],
    dayTimes: [],
    windowKind: 'fixed' as const,
    earliestStart: t,
    latestStart: t,
  });
  it('いつもの予定：その人の終わっていない繰り返しを始まりの順に。無ければ空', () => {
    const ps = [
      pat('c1', '2026-05-01', null, [1, 4], '10:00'),
      pat('c1', '2026-01-01', null, [3], '09:00'),
      pat('c1', '2025-01-01', '2025-12-31', [2], '08:00'),
      pat('c2', '2026-01-01', null, [5], '11:00'),
    ];
    expect(usualPlanText(ps, 'c1', '2026-10-30')).toBe('水 09:00、月・木 10:00');
    expect(usualPlanText(ps, 'c3', '2026-10-30')).toBe('');
  });
});
