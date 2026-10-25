import { describe, expect, it } from 'vitest';
import type { DayLoadSlot } from '../contracts/vacancy';
import { hhmmToMinutes } from '../domain/time';
import {
  BAR_END,
  BAR_ROWS,
  BAR_START,
  BAR_STEP,
  barEdgeNote,
  barEdges,
  barRangeText,
  barRowsOf,
  barRowsText,
  DAY_MINUTES,
  edgeLabel,
  inBar,
  loadEdgeTexts,
  rowRuns,
  withEdges,
} from './barRows';

const m = hhmmToMinutes;

describe('3段の区切り（PRD D82）', () => {
  it('8〜12・12〜16・16〜20時の等間隔（各30分×8マス）。目盛りの文も同じ所から', () => {
    expect(BAR_ROWS).toEqual([
      [8, 12],
      [12, 16],
      [16, 20],
    ]);
    expect(BAR_START).toBe(m('08:00'));
    expect(BAR_END).toBe(m('20:00'));
    for (const [a, b] of BAR_ROWS) expect(((b - a) * 60) / BAR_STEP).toBe(8);
    expect(barRowsText()).toBe('上から 8〜12時・12〜16時・16〜20時');
    expect(edgeLabel('early')).toBe('8時より前');
    expect(edgeLabel('late')).toBe('20時以降');
    expect(barRangeText()).toBe('8:00〜20:00');
    expect(barEdgeNote()).toBe('（8時より前・20時以降は端に ◀・▶）');
  });

  it('inBar・withEdges：まとめは 8〜20時のマスだけ、端の文は後ろに足す（二重に読まない）', () => {
    expect(inBar([m('07:30'), m('08:00'), m('19:30'), m('20:00')].map((start) => ({ start })))).toEqual([
      { start: m('08:00') },
      { start: m('19:30') },
    ]);
    expect(withEdges('時間帯：訪問 9:00〜10:00', { early: '8時より前：訪問 7:00〜7:30', late: null })).toBe(
      '時間帯：訪問 9:00〜10:00。8時より前：訪問 7:00〜7:30',
    );
    expect(withEdges('混み具合：…', undefined)).toBe('混み具合：…');
  });

  it('barRowsOf：0〜24時の30分のマスを段に分け、段の外は捨てる', () => {
    const slots = Array.from({ length: DAY_MINUTES / BAR_STEP }, (_, i) => ({ start: i * BAR_STEP }));
    const rows = barRowsOf(slots);
    expect(rows.map((r) => r.slots.length)).toEqual([8, 8, 8]);
    expect(rows[0]!.slots[0]!.start).toBe(m('08:00'));
    expect(rows[1]!.slots[0]!.start).toBe(m('12:00'));
    expect(rows[2]!.slots.at(-1)!.start).toBe(m('19:30'));
  });

  it('barEdges：8時より前・20時以降の active なマスだけ', () => {
    const slots = [m('07:00'), m('07:30'), m('08:00'), m('19:30'), m('20:00'), m('21:00')].map((start) => ({
      start,
      on: start !== m('07:00'),
    }));
    const e = barEdges(slots, (x) => x.on);
    expect(e.early.map((x) => x.start)).toEqual([m('07:30')]);
    expect(e.late.map((x) => x.start)).toEqual([m('20:00'), m('21:00')]);
  });
});

describe('loadEdgeTexts（混み具合の端の印）', () => {
  const slot = (hhmm: string, working: number, free: number): DayLoadSlot => ({ start: m(hhmm), working, free });

  it('働く人がいる30分を、時刻と人数が続く分でまとめる。働く人がいなければ null', () => {
    const load = [
      slot('06:00', 0, 0),
      slot('06:30', 1, 1),
      slot('07:00', 2, 1),
      slot('07:30', 2, 1),
      slot('08:00', 3, 3),
      slot('19:30', 3, 3),
      slot('20:00', 0, 0),
    ];
    expect(loadEdgeTexts(load)).toEqual({
      early: '8時より前：6:30〜7:00 空き 1人／働く 1人、7:00〜8:00 空き 1人／働く 2人',
      late: null,
    });
    expect(loadEdgeTexts([slot('20:30', 1, 0)])).toEqual({
      early: null,
      late: '20時以降：20:30〜21:00 空き 0人／働く 1人',
    });
  });
});

describe('rowRuns（同じ状態が続く30分を1本にまとめる。PRD D85）', () => {
  const at = (hhmm: string, level: string) => ({ start: m(hhmm), level });
  it('続く同じ状態は1本、状態が変われば切る。left・width は段（4時間）に対する割合', () => {
    const runs = rowRuns(
      [at('08:00', 'free'), at('08:30', 'free'), at('09:00', 'visit'), at('09:30', 'visit'), at('10:00', 'travel')],
      8,
      12,
    );
    expect(runs).toEqual([
      { left: 0, width: 60 / 240, level: 'free' },
      { left: 60 / 240, width: 60 / 240, level: 'visit' },
      { left: 120 / 240, width: 30 / 240, level: 'travel' },
    ]);
  });
  it('段の外のマスは捨て、30分が抜けたところでは同じ状態でも切る（並びは時刻の順に直す）', () => {
    const runs = rowRuns([at('11:30', 'rest'), at('07:30', 'rest'), at('10:30', 'rest'), at('12:00', 'rest')], 8, 12);
    expect(runs).toEqual([
      { left: 150 / 240, width: 30 / 240, level: 'rest' },
      { left: 210 / 240, width: 30 / 240, level: 'rest' },
    ]);
  });
  it('段いっぱいの同じ状態は幅1の1本（休みの日が細切れにならない）', () => {
    const slots = Array.from({ length: 8 }, (_, i) => ({ start: 16 * 60 + i * BAR_STEP, level: 'rest' }));
    expect(rowRuns(slots, 16, 20)).toEqual([{ left: 0, width: 1, level: 'rest' }]);
  });
});
