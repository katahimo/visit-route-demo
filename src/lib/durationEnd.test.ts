import { describe, expect, it } from 'vitest';
import { endDraftOnStart, endTimeError, endTimeOf, minutesBetween, minutesOfText } from './durationEnd';

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

describe('開始を直したときの途中の終わり（endDraftOnStart）', () => {
  it('開始 9:00・終わり 7:00 を打ったあと開始を 6:00 にすると、打った 7:00 で所要 60分にする', () => {
    expect(endDraftOnStart('06:00', '07:00')).toEqual({ endDraft: null, minutes: '60' });
  });
  it('まだ開始より前なら途中の値を残す。途中の値が無ければ何もしない', () => {
    expect(endDraftOnStart('08:00', '07:00')).toEqual({ endDraft: '07:00', minutes: null });
    expect(endDraftOnStart('06:00', null)).toEqual({ endDraft: null, minutes: null });
  });
});
