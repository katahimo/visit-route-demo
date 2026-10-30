import { describe, expect, it } from 'vitest';
import { attentionBand } from './attentionBand';
import type { IssueKind } from './dayPlan';
import type { DayStatus } from './month';

/** 日の状態（訪問ID → 検査の種類の並び）だけ持つ最小のもの */
const day = (date: string, issues: Record<string, IssueKind[]> = {}): DayStatus => ({
  date,
  count: 5,
  state: 'none',
  unassigned: 0,
  issues: new Map(Object.entries(issues).map(([id, kinds]) => [id, kinds.map((kind) => ({ kind, label: kind }))])),
  care: Object.keys(issues).length,
  changes: 0,
  absence: false,
  overSpan: [],
  needsCare: Object.keys(issues).length > 0,
});

const TODAY = '2026-10-21';

describe('attentionBand（要対応の帯。PRD D383）', () => {
  it('何も無ければ null（帯を出さない）', () => {
    expect(attentionBand([], TODAY)).toBeNull();
    expect(attentionBand([day(TODAY), day('2026-10-22')], TODAY)).toBeNull();
  });
  it('担当なし・重なり・休みの人の訪問を種類ごとに数え、1行の文にする（0件の種類は書かない）', () => {
    const b = attentionBand(
      [
        day(TODAY, { a: ['unassigned'], b: ['unassigned'], c: ['late'] }),
        day('2026-10-23', { d: ['off'], e: ['unassigned'] }),
      ],
      TODAY,
    );
    expect(b?.counts).toEqual({ unassigned: 3, overlap: 1, off: 1 });
    expect(b?.total).toBe(5);
    expect(b?.text).toBe('担当なし 3件・重なり 1件・休みの人 1件');
    expect(attentionBand([day(TODAY, { a: ['off'] })], TODAY)?.text).toBe('休みの人 1件');
  });
  it('条件に合わない（notAllowed）だけの訪問は数えない。重なりと重なった訪問は重なりに数える', () => {
    expect(attentionBand([day(TODAY, { a: ['notAllowed'] })], TODAY)).toBeNull();
    const b = attentionBand([day(TODAY, { a: ['notAllowed', 'late'], b: ['notAllowed'] })], TODAY);
    expect(b?.counts).toEqual({ unassigned: 0, overlap: 1, off: 0 });
  });
  it('1つの訪問は1つの種類（休みの人と重なりが重なっても休みの人）', () => {
    const b = attentionBand([day(TODAY, { a: ['late', 'off'] })], TODAY);
    expect(b?.counts).toEqual({ unassigned: 0, overlap: 0, off: 1 });
    expect(b?.total).toBe(1);
  });
  it('今日より前の日は数えない', () => {
    expect(attentionBand([day('2026-10-20', { a: ['unassigned'] })], TODAY)).toBeNull();
  });
  it('最初の訪問：いちばん早い日の、その日の先頭の該当の訪問（日付が前後して渡されても）', () => {
    const b = attentionBand(
      [day('2026-10-25', { z: ['unassigned'] }), day('2026-10-22', { x: ['notAllowed'], y: ['off'], w: ['late'] })],
      TODAY,
    );
    expect(b?.first).toEqual({ date: '2026-10-22', visitId: 'y' });
  });
});
