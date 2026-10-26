import { describe, expect, it } from 'vitest';
import { createDemoData } from '../seed';
import { basisKey } from './arrangeBasis';

const data = createDemoData('2026-10-26');

describe('basisKey', () => {
  it('同じデータは同じ鍵（並びに寄らない）', () => {
    expect(basisKey(data)).toBe(basisKey({ ...data, patterns: [...data.patterns].reverse() }));
    expect(basisKey(data)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('繰り返しの時刻・相性・勤務時間が変わると鍵が変わる', () => {
    const base = basisKey(data);
    const p = data.patterns[0]!;
    const moved = { ...data, patterns: [{ ...p, durationMinutes: p.durationMinutes + 5 }, ...data.patterns.slice(1)] };
    expect(basisKey(moved)).not.toBe(base);
    const c = data.clients[0]!.id;
    const s = data.staff[0]!.id;
    const level = (data.compat[c]?.[s] ?? 0) === -2 ? 2 : -2;
    expect(basisKey({ ...data, compat: { ...data.compat, [c]: { ...data.compat[c], [s]: level } } })).not.toBe(base);
    const st = data.staff[0]!;
    expect(basisKey({ ...data, staff: [{ ...st, shiftEnd: '23:30' }, ...data.staff.slice(1)] })).not.toBe(base);
  });

  it('組んだ結果（いつもの担当）や、曜日ごとに分けただけの繰り返しでは鍵が変わらない', () => {
    const base = basisKey(data);
    const p = data.patterns.find((x) => x.weekdays.length >= 2 && x.dayTimes.length === 0)!;
    const other = data.staff.find((s) => s.id !== p.usualStaffId)!.id;
    const restaffed = data.patterns.map((x) => (x.id === p.id ? { ...x, usualStaffId: other } : x));
    expect(basisKey({ ...data, patterns: restaffed })).toBe(base);
    const split = data.patterns.flatMap((x) =>
      x.id === p.id ? x.weekdays.map((wd, i) => ({ ...x, id: `${x.id}-${i}`, weekdays: [wd] })) : [x],
    );
    expect(basisKey({ ...data, patterns: split })).toBe(base);
  });

  it('相性の未入力（0）は書いてあっても無くても同じ', () => {
    const c = data.clients[0]!.id;
    const s = data.staff.find((x) => (data.compat[c]?.[x.id] ?? 0) === 0)!.id;
    expect(basisKey({ ...data, compat: { ...data.compat, [c]: { ...data.compat[c], [s]: 0 } } })).toBe(basisKey(data));
  });
});
