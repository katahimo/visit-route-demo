import { describe, expect, it } from 'vitest';
import type { VacancyResult } from '../contracts/vacancy';
import { inquirySummary } from '../vacancy';
import { holdSlots } from './hold';
import {
  bandInquiry,
  bandSpans,
  bandText,
  DURATION_CHIPS,
  inBands,
  startRangeText,
  toggleBand,
  WISH_BANDS,
  wishWindow,
} from './vacancyBands';
import { answerCard } from './vacancyView';

const terms = { client: '利用者さん', staff: 'スタッフ' };

/** 火曜の 7:00〜19:30 の30分ごと。ok の開始（分）だけ ○、ほかは × */
function result(ok: number[]): VacancyResult {
  const times = Array.from({ length: 26 }, (_, i) => 420 + i * 30);
  return {
    exact: true,
    dates: [],
    noPlanDates: [],
    times,
    cells: times.map((start) => {
      const on = ok.includes(start);
      return { weekday: 2, start, byDate: [], min: on ? 2 : 0, weeksOk: on ? 4 : 0, weeksTotal: 4 };
    }),
  };
}

describe('時間帯と所要のチップ（PRD D411）', () => {
  it('時間帯は 午前 8:00〜12:00・午後 12:00〜17:00・夕方 17:00〜20:00、所要は 30・45・60・90分', () => {
    expect(WISH_BANDS.map(bandText)).toEqual(['午前 8:00〜12:00', '午後 12:00〜17:00', '夕方 17:00〜20:00']);
    expect(DURATION_CHIPS).toEqual([30, 45, 60, 90]);
  });

  it('押すと足すか外す（並びは時刻の順）', () => {
    expect(toggleBand([], 'eve')).toEqual(['eve']);
    expect(toggleBand(['eve'], 'am')).toEqual(['am', 'eve']);
    expect(toggleBand(['am', 'eve'], 'am')).toEqual(['eve']);
  });

  it('開始の幅：接する帯はつなぎ、つながらない帯は分ける', () => {
    expect(bandSpans([])).toEqual([]);
    expect(bandSpans(['am'])).toEqual([{ from: 480, to: 720 }]);
    expect(bandSpans(['am', 'pm'])).toEqual([{ from: 480, to: 1020 }]);
    expect(bandSpans(['am', 'eve'])).toEqual([
      { from: 480, to: 720 },
      { from: 1020, to: 1200 },
    ]);
  });

  it('問い合わせの幅は端から端。選ばなければくわしい条件の幅', () => {
    const fallback = { from: '09:00', to: '17:00' };
    expect(wishWindow([], fallback)).toBe(fallback);
    expect(wishWindow(['pm'], fallback)).toEqual({ from: '12:00', to: '17:00' });
    expect(wishWindow(['am', 'eve'], fallback)).toEqual({ from: '08:00', to: '20:00' });
  });

  it('要約の行の開始の幅', () => {
    expect(startRangeText([], { from: '09:00', to: '17:00' })).toBe('9:00〜17:00');
    expect(startRangeText(['am', 'pm'], { from: '09:00', to: '17:00' })).toBe('8:00〜17:00');
    expect(startRangeText(['am', 'eve'], { from: '09:00', to: '17:00' })).toBe('8:00〜12:00・17:00〜20:00');
  });

  it('時間帯の外のマスを除く（終わりの時刻ちょうどは次の帯。時刻の列は残す）。選ばなければそのまま', () => {
    const r = result([]);
    expect(inBands(r, [])).toBe(r);
    const am = inBands(r, ['am']);
    expect(am.times).toEqual(r.times);
    expect(am.cells.map((c) => c.start)).toEqual([480, 510, 540, 570, 600, 630, 660, 690]);
  });

  it('午前と夕方：間の午後の ○ は答え・要約・仮押さえに入れず、つながらない範囲は分けて書く', () => {
    // ○ は 11:30〜13:00 と 17:00
    const r = result([690, 720, 750, 780, 1020]);
    const bands = ['am', 'eve'] as const;
    const w = wishWindow(bands, { from: '09:00', to: '17:00' });
    const wish = { weekdays: [2], ...w, perWeek: 1, startDate: '2026-11-03' };
    const only = inBands(r, bands);
    expect(answerCard(only, wish).body).toBe('火 11:30、17:00 に 2人');
    expect(inquirySummary(only, wish, terms)).toContain('火の 11:30、17:00');
    expect(holdSlots(only, [2], w.from, w.to, 1)).toEqual([{ weekday: 2, start: 690 }]);
    // 午後だけなら 12:00〜13:00（17:00 開始は夕方）。午前と午後はつないで 11:30〜13:00
    const pm = inBands(r, ['pm']);
    expect(answerCard(pm, { ...wish, ...wishWindow(['pm'], w) }).body).toBe('火 12:00〜13:00 に 2人');
    const day = inBands(r, ['am', 'pm']);
    expect(answerCard(day, { ...wish, ...wishWindow(['am', 'pm'], w) }).body).toBe('火 11:30〜13:00 に 2人');
  });

  it('bandInquiry：時間帯を選べばくわしい条件の幅が逆でも答える。選ばず逆なら答えない', () => {
    const r = result([690, 1020]);
    const q = { weekdays: [2], from: '17:00', to: '09:00', bands: [] as const, perWeek: 1, startDate: '2026-11-03' };
    const none = bandInquiry(r, q, terms);
    expect(none.wishOk).toBe(false);
    expect([none.answer, none.summary, none.answerResult]).toEqual([null, null, null]);
    expect(none.slots).toEqual([]);
    const eve = bandInquiry(r, { ...q, bands: ['eve'] }, terms);
    expect(eve.wishOk).toBe(true);
    expect(eve.wish).toMatchObject({ from: '17:00', to: '20:00' });
    expect(eve.answer?.body).toBe('火 17:00 に 2人');
    expect(eve.slots).toEqual([{ weekday: 2, start: 1020 }]);
    expect(bandInquiry(null, { ...q, bands: ['eve'] }, terms).answer).toBeNull();
  });
});
