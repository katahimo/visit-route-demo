import { describe, expect, it } from 'vitest';
import { clockTime, dateText, dateTextFrom, mdText, monthLabel, ymText } from './dateText';

describe('日付・年月・時刻の短い書式', () => {
  it('年が違えば年も付ける', () => {
    expect(dateTextFrom('2026-10-12', '2026-01-01')).toBe('10/12（月）');
    expect(dateTextFrom('2027-01-05', '2026-12-28')).toBe('2027/1/5（火）');
  });

  it('mdText・dateText：「11/4」「11/4（水）」（先頭の0を付けない）', () => {
    expect(mdText('2026-11-04')).toBe('11/4');
    expect(dateText('2026-11-04')).toBe('11/4（水）');
    expect(dateText('2026-10-12')).toBe('10/12（月）');
  });
  it('ymText・monthLabel：「2026年1月」「1月」（日付を渡してもその月）', () => {
    expect(ymText('2026-01')).toBe('2026年1月');
    expect(ymText('2026-11-04')).toBe('2026年11月');
    expect(monthLabel('2026-01')).toBe('1月');
  });
  it('clockTime：0時からの分 → 「9:05」（分は丸める。負は 0:00）', () => {
    expect(clockTime(545)).toBe('9:05');
    expect(clockTime(0)).toBe('0:00');
    expect(clockTime(1230)).toBe('20:30');
    expect(clockTime(59.6)).toBe('1:00');
    expect(clockTime(-5)).toBe('0:00');
  });
});
