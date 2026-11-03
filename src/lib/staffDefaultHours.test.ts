// 新しい〈スタッフ〉の勤務の既定（PRD D428。ADR-0095）
import { describe, expect, it } from 'vitest';
import { applyTemplate, TEMPLATE_IDS } from './features';
import {
  defaultStaffHours,
  hasWideDefaultHours,
  ONE_OFF_STAFF_HOURS,
  REGULAR_STAFF_HOURS,
  staffHoursText,
} from './staffDefaultHours';

describe('defaultStaffHours（使い方 → 勤務の既定）', () => {
  it('単発の予約は毎日 7:00〜22:00', () => {
    const h = defaultStaffHours(applyTemplate('oneOff'));
    expect(h).toEqual({ workDays: [1, 2, 3, 4, 5, 6, 0], shiftStart: '07:00', shiftEnd: '22:00' });
    expect(staffHoursText(h)).toBe('毎日 7:00〜22:00');
    expect(hasWideDefaultHours(applyTemplate('oneOff'))).toBe(true);
  });

  it('ほかの使い方は月〜金 9:00〜18:00', () => {
    for (const id of TEMPLATE_IDS.filter((t) => t !== 'oneOff')) {
      expect(defaultStaffHours(applyTemplate(id))).toEqual(REGULAR_STAFF_HOURS);
      expect(hasWideDefaultHours(applyTemplate(id))).toBe(false);
    }
    expect(staffHoursText(REGULAR_STAFF_HOURS)).toBe('月火水木金 9:00〜18:00');
  });

  it('返した配列を書き換えても既定は変わらない', () => {
    defaultStaffHours(applyTemplate('oneOff')).workDays.push(9);
    expect(ONE_OFF_STAFF_HOURS.workDays).toHaveLength(7);
  });
});
