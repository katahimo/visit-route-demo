import { describe, expect, it } from 'vitest';
import { attentionBand, bandDays, exceptionStatus, isBandIssue } from './attentionBand';
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
const ZERO = { unassigned: 0, overlap: 0, off: 0, noStandard: 0, rebuild: 0, unconfirmed: 0 };

describe('attentionBand（要対応の帯。PRD D383・D391）', () => {
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
    expect(b?.counts).toEqual({ ...ZERO, unassigned: 3, overlap: 1, off: 1 });
    expect(b?.text).toBe('担当なし 3件・重なり 1件・休みの人 1件');
    expect(attentionBand([day(TODAY, { a: ['off'] })], TODAY)?.text).toBe('休みの人 1件');
  });
  it('条件に合わない（notAllowed）だけの訪問は数えない。重なりと重なった訪問は重なりに数える', () => {
    expect(attentionBand([day(TODAY, { a: ['notAllowed'] })], TODAY)).toBeNull();
    const b = attentionBand([day(TODAY, { a: ['notAllowed', 'late'], b: ['notAllowed'] })], TODAY);
    expect(b?.counts).toEqual({ ...ZERO, overlap: 1 });
  });
  it('1つの訪問は1つの種類（休みの人と重なりが重なっても休みの人）', () => {
    const b = attentionBand([day(TODAY, { a: ['late', 'off'] })], TODAY);
    expect(b?.counts).toEqual({ ...ZERO, off: 1 });
  });
  it('今日より前の日は数えない', () => {
    expect(attentionBand([day('2026-10-20', { a: ['unassigned'] })], TODAY)).toBeNull();
  });
  it('最初の訪問は日付 → 開始時刻の順（検査の並びが時刻順でなくても）', () => {
    const start: Record<string, number> = { a: 600, b: 540, c: 480 };
    const b = attentionBand(
      [day(TODAY, { a: ['unassigned'], b: ['late'], c: ['notAllowed'] }), day('2026-10-22', { z: ['off'] })],
      TODAY,
      (id) => start[id] ?? null,
    );
    expect(b?.go).toEqual({ to: '/plan', date: TODAY, visitId: 'b' });
  });
  it('bandDays：今日から翌月末まで（自動の組みの範囲と同じ）', () => {
    const d = bandDays('2026-10-21');
    expect(d[0]).toBe('2026-10-21');
    expect(d.at(-1)).toBe('2026-11-30');
    expect(d).toHaveLength(41);
  });
  it('最初の訪問：いちばん早い日の、その日の先頭の該当の訪問（日付が前後して渡されても）', () => {
    const b = attentionBand(
      [day('2026-10-25', { z: ['unassigned'] }), day('2026-10-22', { x: ['notAllowed'], y: ['off'], w: ['late'] })],
      TODAY,
    );
    expect(b?.go).toEqual({ to: '/plan', date: '2026-10-22', visitId: 'y' });
  });
});

describe('attentionBand の入だけの種類（エキスパート機能が入。PRD D391）', () => {
  const open = { hasStandard: true, basisChanged: false, planYm: '2026-11', isOn: () => true };
  /** 訪問があって伝えていない日 */
  const untold = (date: string): DayStatus => ({ ...day(date), state: 'none' });
  const told = (date: string): DayStatus => ({ ...day(date), state: 'told' });
  it('切（渡さない）は、伝えていない日・組み直し・標準が無いを数えない', () => {
    expect(attentionBand([untold(TODAY)], TODAY)).toBeNull();
  });
  it('未確定：訪問があって伝えていない日・未連絡の変更のある日を日数で数える。伝えた日・訪問の無い日・今日より前は数えない', () => {
    const changed: DayStatus = { ...day('2026-10-24'), state: 'changed' };
    const empty: DayStatus = { ...untold('2026-10-25'), count: 0 };
    const b = attentionBand(
      [untold(TODAY), told('2026-10-22'), untold('2026-10-23'), changed, empty, untold('2026-10-20')],
      TODAY,
      undefined,
      open,
    );
    expect(b?.counts.unconfirmed).toBe(3);
    expect(b?.text).toBe('未確定 3日');
    expect(attentionBand([told(TODAY)], TODAY, undefined, open)).toBeNull();
  });
  it('未確定の押した先：1日だけならその日の日の予定、2日以上なら最初の日の月の右の欄', () => {
    expect(attentionBand([untold('2026-10-23')], TODAY, undefined, open)?.go).toEqual({
      to: '/plan',
      date: '2026-10-23',
    });
    expect(attentionBand([untold('2026-11-02'), untold('2026-10-23')], TODAY, undefined, open)?.go).toEqual({
      to: '/month?ym=2026-10&do=unconfirmed',
    });
  });
  it('標準が無い：標準を登録していなければ1件（組み方の標準へ）。基本情報が変わったは標準を登録しているときだけ（担当を組む・組む月へ）', () => {
    const noStd = attentionBand([], TODAY, undefined, { ...open, hasStandard: false, basisChanged: true });
    expect(noStd?.counts).toEqual({ ...ZERO, noStandard: 1 });
    expect(noStd?.text).toBe('組み方の標準が無い');
    expect(noStd?.go).toEqual({ to: '/standard' });
    const changed = attentionBand([], TODAY, undefined, { ...open, basisChanged: true });
    expect(changed?.counts).toEqual({ ...ZERO, rebuild: 1 });
    expect(changed?.text).toBe('基本情報が変わった（組み直す）');
    expect(changed?.go).toEqual({ to: '/arrange?ym=2026-11' });
    expect(attentionBand([], TODAY, undefined, open)).toBeNull();
  });
  it('切った機能の種類は出さない（組み方の標準・担当を組むの URL が切れていれば）', () => {
    const off = { ...open, hasStandard: false, isOn: () => false };
    expect(attentionBand([], TODAY, undefined, off)).toBeNull();
    expect(attentionBand([], TODAY, undefined, { ...off, hasStandard: true, basisChanged: true })).toBeNull();
  });
  it('文は 訪問の種類 → 標準が無い／組み直し → 未確定 の順にまとめ、押した先は先頭の種類（訪問があれば訪問）', () => {
    const b = attentionBand([day(TODAY, { a: ['unassigned'], b: ['late'] }), untold('2026-10-23')], TODAY, undefined, {
      ...open,
      hasStandard: false,
    });
    expect(b?.text).toBe('担当なし 1件・重なり 1件・組み方の標準が無い・未確定 2日');
    expect(b?.go).toEqual({ to: '/plan', date: TODAY, visitId: 'a' });
    // 訪問の種類が無ければ、標準が無いへ（未確定より先）
    expect(attentionBand([untold('2026-10-23')], TODAY, undefined, { ...open, hasStandard: false })?.go).toEqual({
      to: '/standard',
    });
  });
});

describe('isBandIssue・exceptionStatus（例外だけ見せる）', () => {
  it('担当なし・休みの人・重なりは目立たせ、条件に合わないは目立たせない', () => {
    expect(isBandIssue('unassigned')).toBe(true);
    expect(isBandIssue('off')).toBe(true);
    expect(isBandIssue('late')).toBe(true);
    expect(isBandIssue('notAllowed')).toBe(false);
  });
  it('要対応を絞って数え直し、拘束超は見せない。元は変えない', () => {
    const s = {
      ...day('2026-11-04', { a: ['notAllowed'], b: ['notAllowed', 'late'], c: ['unassigned'] }),
      overSpan: ['s1'],
    };
    const e = exceptionStatus(s);
    expect([...e.issues.keys()]).toEqual(['b', 'c']);
    expect(e.issues.get('b')?.map((x) => x.kind)).toEqual(['late']);
    expect(e.care).toBe(2);
    expect(e.needsCare).toBe(true);
    expect(e.overSpan).toEqual([]);
    expect(s.care).toBe(3);
    expect(s.overSpan).toEqual(['s1']);
  });
  it('条件に合わないだけの日は赤にしない', () => {
    const e = exceptionStatus(day('2026-11-04', { a: ['notAllowed'] }));
    expect(e.care).toBe(0);
    expect(e.needsCare).toBe(false);
  });
});
