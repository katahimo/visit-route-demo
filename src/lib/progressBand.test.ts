import { describe, expect, it } from 'vitest';
import type { MonthProgress } from './month';
import { bandHref, bandNext, urgentCount, visitsText } from './progressBand';

/** 進み具合（既定は訪問のある日10日・全部確定・要対応なし） */
function pg(x: Partial<MonthProgress> = {}): MonthProgress {
  return { visits: 30, days: 10, planned: 10, confirmed: 10, unconfirmed: [], attention: 0, ...x };
}
const base = { emptyTargets: 0, urgent: 0 };

describe('bandNext（expert 切は確定していない日の段が無い。ADR-0073）', () => {
  it('確定していない日があっても、見るだけの要対応が無ければ済み', () => {
    const progress = pg({ unconfirmed: ['2026-10-20'] });
    expect(bandNext({ ...base, progress }).kind).toBe('unconfirmed');
    expect(bandNext({ ...base, progress, confirmStep: false }).kind).toBe('done');
    expect(
      bandNext({ ...base, progress: pg({ unconfirmed: ['2026-10-20'], attention: 1 }), confirmStep: false }).kind,
    ).toBe('attention');
  });
  it('担当なしの日が1日でも担当を AI で組む（その場で組むので。入は2日から）', () => {
    const input = { ...base, emptyTargets: 1, urgent: 1, progress: pg({ attention: 1 }) };
    expect(bandNext({ ...input, confirmStep: false }).kind).toBe('batch');
    expect(bandNext(input).kind).toBe('attention');
  });
});

describe('bandNext', () => {
  it('訪問が無い：ボタンなしで「訪問はありません」', () => {
    const r = bandNext({ ...base, progress: pg({ visits: 0, days: 0, planned: 0, confirmed: 0 }) });
    expect(r.kind).toBe('empty');
  });
  it('担当なしの日が2日以上：要対応・確定していない日より先に担当を AI で組む', () => {
    const r = bandNext({
      ...base,
      emptyTargets: 3,
      urgent: 2,
      progress: pg({ planned: 7, confirmed: 0, unconfirmed: ['2026-10-20'], attention: 2 }),
    });
    expect(r).toMatchObject({ kind: 'batch', label: '担当を AI で組む', short: '組む' });
    // 1日だけなら要対応から
    expect(bandNext({ ...base, emptyTargets: 1, urgent: 1, progress: pg({ attention: 1 }) }).kind).toBe('attention');
  });
  it('手当てが要る要対応がある：確定していない日より先に要対応', () => {
    const r = bandNext({
      ...base,
      urgent: 1,
      progress: pg({ confirmed: 4, unconfirmed: ['2026-10-20'], attention: 3 }),
    });
    expect(r).toMatchObject({ kind: 'attention', label: '要対応を見る' });
  });
  it('手当てが要るものは無い・確定していない日がある：確定していない日を見る（欠勤の日だけの要対応より先）', () => {
    const r = bandNext({
      ...base,
      progress: pg({ confirmed: 8, unconfirmed: ['2026-10-20', '2026-10-21'], attention: 1 }),
    });
    expect(r).toMatchObject({ kind: 'unconfirmed', label: '確定していない日を見る', short: '未確定' });
  });
  it('全部確定・見るだけの要対応（欠勤・拘束）が残る：要対応を見る', () => {
    expect(bandNext({ ...base, progress: pg({ attention: 1 }) }).kind).toBe('attention');
  });
  it('全部済み：ボタンなしで「準備は済みました」', () => {
    expect(bandNext({ ...base, progress: pg() })).toMatchObject({ kind: 'done', label: '準備は済みました' });
  });
});

describe('urgentCount', () => {
  it('要対応の訪問（care）だけを数え、未連絡の変更・拘束は数えない', () => {
    expect(urgentCount([{ kind: 'care' }, { kind: 'care' }, { kind: 'changed' }, { kind: 'overSpan' }])).toBe(2);
    expect(urgentCount([])).toBe(0);
  });
});

describe('bandHref・visitsText', () => {
  it('月の画面の欄へ', () => {
    expect(bandHref('2026-11', 'batch')).toBe('/arrange?ym=2026-11');
    expect(bandHref('2026-10', 'unconfirmed')).toBe('/month?ym=2026-10&do=unconfirmed');
  });
  it('訪問の件数', () => {
    expect(visitsText(12)).toBe('12件');
  });
});
