import { describe, expect, it } from 'vitest';
import { endTimeError, endTimeOf, minutesBetween, minutesOfText } from './durationEnd';

describe('所要（分）と終わりの時刻（PRD D462）', () => {
  it('開始と所要から終わりの時刻を作る（7:00＋90分＝8:30）', () => {
    expect(endTimeOf('07:00', 90)).toBe('08:30');
    expect(endTimeOf('23:00', 59)).toBe('23:59');
  });
  it('その日のうちに終わらない・所要が無い・開始が空なら空', () => {
    expect(endTimeOf('23:00', 60)).toBe('');
    expect(endTimeOf('07:00', null)).toBe('');
    expect(endTimeOf('07:00', 0)).toBe('');
    expect(endTimeOf('', 30)).toBe('');
  });
  it('開始と終わりから所要（分）を出す。終わりが開始より後でなければ null', () => {
    expect(minutesBetween('07:00', '08:30')).toBe(90);
    expect(minutesBetween('07:00', '07:00')).toBeNull();
    expect(minutesBetween('07:00', '06:30')).toBeNull();
    expect(minutesBetween('', '08:30')).toBeNull();
  });
  it('所要の欄の文字を分にする（空・数でない・小数は null）', () => {
    expect(minutesOfText('90')).toBe(90);
    expect(minutesOfText('')).toBeNull();
    expect(minutesOfText('abc')).toBeNull();
    expect(minutesOfText('1.5')).toBeNull();
  });
  it('終わりが開始より前なら誤りの文。空は誤りにしない', () => {
    expect(endTimeError('07:00', '06:00')).toBe('終わりは開始より後の時刻にしてください');
    expect(endTimeError('07:00', '')).toBeNull();
    expect(endTimeError('07:00', '08:30')).toBeNull();
  });
});
