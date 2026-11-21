import { describe, expect, it } from 'vitest';
import type { VacancyCell, VacancyResult } from '../contracts/vacancy';
import { inBands } from './vacancyBands';
import { vacancyStrip } from './vacancyStrip';

const times = Array.from({ length: 26 }, (_, i) => 420 + i * 30); // 7:00〜19:30

const cell = (weekday: number, start: number, min: number, weeksOk = min > 0 ? 4 : 0, weeksTotal = 4): VacancyCell => ({
  weekday,
  start,
  byDate: [],
  min,
  weeksOk,
  weeksTotal,
});

/** 全曜日×全時刻のマス。f で人数などを決める（既定は 0人＝×） */
function result(f: (wd: number, t: number) => VacancyCell | null, exact = true): VacancyResult {
  const cells = [0, 1, 2, 3, 4, 5, 6].flatMap((wd) =>
    times.flatMap((t) => {
      const c = f(wd, t) ?? cell(wd, t, 0);
      return [c];
    }),
  );
  return { exact, dates: [], noPlanDates: [], times, cells };
}

describe('週の空きの帯（PRD D472）', () => {
  it('行は月〜日の順で、区画は時刻の列と同じ数、目盛りは3時間ごと', () => {
    const s = vacancyStrip(
      result(() => null),
      null,
      [],
    );
    expect(s.rows.map((r) => r.dayLabel).join('')).toBe('月火水木金土日');
    expect(s.rows.every((r) => r.segments.length === times.length)).toBe(true);
    expect(s.ticks.map((t) => t.label)).toEqual(['9:00', '12:00', '15:00', '18:00']);
  });

  it('○ の開始時刻は続いた範囲にまとめ、人数の幅を添える（目安は「約」）', () => {
    const r = result(
      (wd, t) =>
        wd === 2 && t >= 600 && t <= 690 ? cell(2, t, t === 600 ? 2 : 3) : wd === 2 && t === 780 ? cell(2, t, 1) : null,
      false,
    );
    const row = vacancyStrip(r, null, []).rows.find((x) => x.weekday === 2);
    expect(row?.verdict).toBe('ok');
    expect(row?.text).toBe('○ 10:00〜11:30、13:00・約1〜3人');
    const seg = row?.segments.find((x) => x.start === 600);
    expect(seg?.face).toBe('2');
    expect(seg?.level).toBe('two');
    expect(seg?.label).toContain('○ どの週も受けられる（約2人）');
  });

  it('受けられない行は × と文字で書き、色だけにしない', () => {
    const row = vacancyStrip(
      result(() => null),
      null,
      [],
    ).rows[0];
    expect(row?.verdict).toBe('ng');
    expect(row?.text).toBe('× 受けられない');
    expect(row?.segments[0]?.face).toBe('');
  });

  it('受けられない週がある（△）と数えられない（？）の行', () => {
    const r = result((wd, t) => (wd === 1 ? cell(1, t, 0, 2, 4) : wd === 3 ? cell(3, t, 0, 0, 0) : null));
    const rows = vacancyStrip(r, null, []).rows;
    expect(rows[0]?.text).toBe('△ 受けられない週がある');
    expect(rows[0]?.segments[0]).toMatchObject({ face: '△', level: 'partial' });
    expect(rows[2]?.text).toBe('？ 数えられない日');
    expect(rows[2]?.segments[0]?.level).toBe('unknown');
  });

  it('全部の週に1人以上いれば ○', () => {
    const r = result((wd, t) => (wd === 1 ? cell(1, t, 1, 4, 4) : null));
    expect(vacancyStrip(r, null, []).rows[0]?.verdict).toBe('ok');
  });

  it('時間帯のチップの外は範囲外（薄く描く）で、行の一言にも入れない', () => {
    const r = result((wd, t) => (wd === 1 && (t === 540 || t === 900) ? cell(1, t, 2) : null));
    const am = inBands(r, ['am']);
    const row = vacancyStrip(r, am, []).rows[0];
    expect(row?.text).toBe('○ 9:00・2人');
    expect(row?.segments.find((x) => x.start === 540)?.inRange).toBe(true);
    expect(row?.segments.find((x) => x.start === 900)?.inRange).toBe(false);
  });

  it('範囲に区画が無い行は「範囲の外」、希望でない曜日は wished が false', () => {
    const r = result(() => null);
    const none = { ...r, cells: [] };
    const s = vacancyStrip(r, none, [2]);
    expect(s.rows.every((x) => x.verdict === 'none' && x.text === '— 範囲の外')).toBe(true);
    expect(s.rows.filter((x) => x.wished).map((x) => x.dayLabel)).toEqual(['火']);
  });

  it('時刻の列に無いマスは level が null', () => {
    const r = result(() => null);
    const sparse = { ...r, cells: r.cells.filter((c) => c.start !== 420) };
    expect(vacancyStrip(sparse, null, []).rows[0]?.segments[0]).toMatchObject({ start: 420, level: null, face: '' });
  });
});
