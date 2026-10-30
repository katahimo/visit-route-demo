import { describe, expect, it } from 'vitest';
import { demoDataSchema } from '../contracts/data';
import { addDays } from '../domain/time';
import { createOneOffDemoData, ONE_OFF_DEMO_DAYS } from './oneOff';

const TODAY = '2026-10-30';
const d = createOneOffDemoData(TODAY, {});

describe('createOneOffDemoData（PRD D380。単発のデモ）', () => {
  it('契約（demoDataSchema）を通り、同じ日付なら同じデータ（乱数・現在時刻を使わない）', () => {
    expect(() => demoDataSchema.parse(d)).not.toThrow();
    expect(createOneOffDemoData(TODAY, {})).toEqual(d);
    expect(createOneOffDemoData('2027-03-01', {}).baseDate).toBe('2027-03-01');
  });

  it('呼び名はお客様・シッター（業種 sitter）', () => {
    expect(d.org.terms).toEqual({ client: 'お客様', staff: 'シッター' });
    expect(d.org.industry).toBe('sitter');
  });

  it('今日から14日分の単発の予約だけ（繰り返しは無く、どの日にも1件以上ある）', () => {
    expect(d.patterns).toEqual([]);
    expect(d.visits.every((v) => v.pattern === null)).toBe(true);
    const days = Array.from({ length: ONE_OFF_DEMO_DAYS }, (_, i) => addDays(TODAY, i));
    expect([...new Set(d.visits.map((v) => v.date))]).toEqual(days);
    expect(d.visits.length).toBeGreaterThanOrEqual(ONE_OFF_DEMO_DAYS);
  });

  it('人・訪問の参照が成り立ち、同じ日に同じお客様は重ならず、IDは重複しない', () => {
    expect(d.clients.length).toBeGreaterThanOrEqual(5);
    expect(d.staff.length).toBeGreaterThanOrEqual(3);
    const clientIds = new Set(d.clients.map((c) => c.id));
    expect(d.visits.every((v) => clientIds.has(v.clientId))).toBe(true);
    expect(new Set(d.visits.map((v) => v.id)).size).toBe(d.visits.length);
    expect(new Set(d.visits.map((v) => `${v.date}/${v.clientId}`)).size).toBe(d.visits.length);
    expect(d.visits.every((v) => d.visitTypes.some((t) => t.id === v.typeId))).toBe(true);
  });

  it('予約は担当付きで、担当は存在するシッターで、同じ日に時間が重ならない', () => {
    const staffIds = new Set(d.staff.map((s) => s.id));
    expect(d.visits.every((v) => v.staffId !== null && staffIds.has(v.staffId))).toBe(true);
    const key = (v: (typeof d.visits)[number]) => `${v.date}/${v.staffId}`;
    const by = new Map<string, (typeof d.visits)[number][]>();
    for (const v of d.visits) by.set(key(v), [...(by.get(key(v)) ?? []), v]);
    for (const list of by.values()) {
      const sorted = [...list].sort((a, b) => a.earliestStart.localeCompare(b.earliestStart));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]!;
        const end =
          Number(prev.earliestStart.slice(0, 2)) * 60 + Number(prev.earliestStart.slice(3)) + prev.durationMinutes;
        expect(end).toBeLessThanOrEqual(
          Number(sorted[i]!.earliestStart.slice(0, 2)) * 60 + Number(sorted[i]!.earliestStart.slice(3)),
        );
      }
    }
  });

  it('機能の入り切りは渡したものを使う。伝えた記録・欠勤は無い', () => {
    expect(createOneOffDemoData(TODAY, { patterns: false }).org.features).toEqual({ patterns: false });
    expect(d.snapshots).toEqual({});
    expect(d.absences).toEqual([]);
  });
});
