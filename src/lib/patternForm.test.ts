// 繰り返し（定期パターン）の入力欄の中身（ADR-0012・0013・0062）
import { describe, expect, it } from 'vitest';
import type { DaySnapshot } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import {
  isRepeatChoice,
  MONTH_WEEKS_ERROR,
  type PatternForm,
  parsePatternForm,
  patternConfirmedDays,
  patternEndDefault,
  patternFormOf,
  patternSinceError,
  repeatChoiceLabel,
  repeatChoiceOf,
  repeatChoices,
  sortedWeekdays,
  toggleNumber,
  withRepeatChoice,
} from './patternForm';

const TODAY = '2026-10-12';
const TYPES = [{ id: 't1' }];

const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  id: 'p1',
  clientId: 'c1',
  typeId: 't1',
  weekdays: [4, 1],
  everyWeeks: 2,
  repeat: 'weekly',
  monthWeeks: [],
  dayTimes: [{ weekday: 1, earliestStart: '09:30', latestStart: '10:00' }],
  windowKind: 'window',
  earliestStart: '10:00',
  latestStart: '11:00',
  durationMinutes: 45,
  from: '2026-10-01',
  to: null,
  usualStaffId: 's1',
  usualStarts: [{ weekday: 4, start: '10:30' }],
  note: 'メモ',
  ...over,
});

/** 足す欄に曜日を入れたもの */
const addForm = (over: Partial<PatternForm> = {}): PatternForm => ({
  ...patternFormOf(null, TODAY, 60),
  weekdays: [1],
  ...over,
});

describe('patternFormOf', () => {
  it('足す欄は既定の値（開始日・いつからは今日、所要は渡した分）', () => {
    const f = patternFormOf(null, TODAY, 60);
    expect(f).toMatchObject({ id: null, weekdays: [], everyWeeks: 1, repeat: 'weekly', windowKind: 'fixed' });
    expect(f).toMatchObject({ earliestStart: '10:00', latestStart: '10:00', durationMinutes: '60' });
    expect(f).toMatchObject({ from: TODAY, since: TODAY, to: '', usualStaffId: '', note: '' });
  });

  it('直す欄はパターンの値（曜日ごとの時刻・標準の開始は曜日 → 値）', () => {
    const f = patternFormOf(pattern(), TODAY, 60);
    expect(f.id).toBe('p1');
    expect(f.perDay).toBe(true);
    expect(f.dayTimes).toEqual({ 1: { earliestStart: '09:30', latestStart: '10:00' } });
    expect(f.usualStarts).toEqual({ 4: '10:30' });
    expect(f.durationMinutes).toBe('45');
    expect(f.since).toBe(TODAY);
    expect(f.usualStaffId).toBe('s1');
  });

  it('直した欄をそのまま確かめると、もとのパターンに戻る', () => {
    const p = pattern();
    expect(parsePatternForm(patternFormOf(p, TODAY, 60), p.from, 'c1', TYPES)).toEqual({
      ...p,
      weekdays: [1, 4],
    });
  });
});

describe('parsePatternForm', () => {
  it('曜日・第何週が無いときは理由の文', () => {
    expect(parsePatternForm(addForm({ weekdays: [] }), TODAY, 'c1', TYPES)).toBe('曜日を1つ以上選んでください');
    expect(parsePatternForm(addForm({ repeat: 'monthly' }), TODAY, 'c1', TYPES)).toBe(
      '第何週かを1つ以上選んでください',
    );
  });

  it('開始（遅）が開始（早）より前なら理由の文（ちょうどは開始（遅）＝開始（早））', () => {
    const f = addForm({ windowKind: 'window', earliestStart: '11:00', latestStart: '10:00' });
    expect(parsePatternForm(f, TODAY, 'c1', TYPES)).toBe('開始（遅）は開始（早）以降にしてください');
    const fixed = parsePatternForm({ ...f, windowKind: 'fixed' }, TODAY, 'c1', TYPES);
    expect(typeof fixed !== 'string' && fixed.latestStart).toBe('11:00');
  });

  it('曜日ごとの時刻：時刻を入れた曜日だけ。幅で開始（遅）が空なら共通の幅を保つ（23:59 まで）', () => {
    const f = addForm({
      weekdays: [3, 1, 5],
      windowKind: 'window',
      earliestStart: '10:00',
      latestStart: '10:30',
      perDay: true,
      dayTimes: {
        1: { earliestStart: '09:00', latestStart: '' },
        3: { earliestStart: '', latestStart: '' },
        5: { earliestStart: '23:45', latestStart: '' },
      },
    });
    const p = parsePatternForm(f, TODAY, 'c1', TYPES);
    expect(typeof p !== 'string' && p.dayTimes).toEqual([
      { weekday: 1, earliestStart: '09:00', latestStart: '09:30' },
      { weekday: 5, earliestStart: '23:45', latestStart: '23:59' },
    ]);
  });

  it('曜日ごとの時刻で開始（遅）が開始（早）より前ならその曜日の文', () => {
    const f = addForm({
      windowKind: 'window',
      earliestStart: '10:00',
      latestStart: '11:00',
      perDay: true,
      dayTimes: { 1: { earliestStart: '12:00', latestStart: '11:00' } },
    });
    expect(parsePatternForm(f, TODAY, 'c1', TYPES)).toBe('月曜の開始（遅）は開始（早）以降にしてください');
  });

  it('標準の開始はその曜日の開始の間だけ', () => {
    const f = addForm({
      windowKind: 'window',
      earliestStart: '10:00',
      latestStart: '11:00',
      usualStarts: { 1: '12:00' },
    });
    expect(parsePatternForm(f, TODAY, 'c1', TYPES)).toBe('月曜の標準の開始は、開始（10:00〜11:00）の間にしてください');
    const ok = parsePatternForm({ ...f, usualStarts: { 1: '10:30' } }, TODAY, 'c1', TYPES);
    expect(typeof ok !== 'string' && ok.usualStarts).toEqual([{ weekday: 1, start: '10:30' }]);
  });

  it('終了日が開始日（直すときは「いつから」）より前なら理由の文', () => {
    expect(parsePatternForm(addForm({ to: '2026-10-01' }), TODAY, 'c1', TYPES)).toBe(
      '終了日は開始日以降にしてください',
    );
    expect(parsePatternForm(addForm({ id: 'p1', to: '2026-10-01' }), TODAY, 'c1', TYPES)).toBe(
      '終了日は「いつから」以降にしてください',
    );
  });

  it('所要・日付が正しくなければ理由の文', () => {
    expect(parsePatternForm(addForm({ durationMinutes: '1' }), TODAY, 'c1', TYPES)).toBe(
      '所要は5〜720分で入れてください',
    );
    expect(parsePatternForm(addForm(), 'bad', 'c1', TYPES)).toBe('日付を正しく入れてください');
  });

  it('足すときは新しい ID。無い種類は種類なし、毎月は1週ごと・第何週を並べる', () => {
    const p = parsePatternForm(
      addForm({ typeId: 'gone', repeat: 'monthly', everyWeeks: 3, monthWeeks: [4, 2] }),
      TODAY,
      'c1',
      TYPES,
    );
    if (typeof p === 'string') throw new Error(p);
    expect(p.id).toMatch(/^pt-/);
    expect(p).toMatchObject({ clientId: 'c1', typeId: null, everyWeeks: 1, monthWeeks: [2, 4], from: TODAY });
    expect(p).toMatchObject({ to: null, usualStaffId: null });
    expect('usualStarts' in p).toBe(false);
  });
});

describe('くり返しの選択肢（ADR-0083）', () => {
  it('並びは 毎週・隔週・3週ごと・4週ごと（毎月は機能が入のときだけ）', () => {
    expect(repeatChoices(true).map(repeatChoiceLabel)).toEqual(['毎週', '隔週', '3週ごと', '4週ごと', '毎月（第N）']);
    expect(repeatChoices(false)).toEqual(['1', '2', '3', '4']);
  });
  it('欄の値 → 選択肢（1〜4 の外の間隔は毎週に寄せる）', () => {
    expect(repeatChoiceOf({ repeat: 'weekly', everyWeeks: 1 })).toBe('1');
    expect(repeatChoiceOf({ repeat: 'weekly', everyWeeks: 3 })).toBe('3');
    expect(repeatChoiceOf({ repeat: 'weekly', everyWeeks: 6 })).toBe('1');
    expect(repeatChoiceOf({ repeat: 'monthly', everyWeeks: 2 })).toBe('monthly');
  });
  it('選択肢 → 欄の値（毎月は repeat だけ、毎週系は repeat と everyWeeks）。契約の値になる', () => {
    const f = addForm({ everyWeeks: 2, monthWeeks: [3] });
    expect(withRepeatChoice(f, 'monthly')).toMatchObject({ repeat: 'monthly', everyWeeks: 2, monthWeeks: [3] });
    expect(withRepeatChoice({ ...f, repeat: 'monthly' }, '4')).toMatchObject({ repeat: 'weekly', everyWeeks: 4 });
    const p = parsePatternForm(withRepeatChoice(f, 'monthly'), TODAY, 'c1', TYPES);
    expect(p).toMatchObject({ repeat: 'monthly', everyWeeks: 1, monthWeeks: [3] });
    const w = parsePatternForm(withRepeatChoice(f, '3'), TODAY, 'c1', TYPES);
    expect(w).toMatchObject({ repeat: 'weekly', everyWeeks: 3, monthWeeks: [] });
  });
  it('毎月で第N なしは誤りの文', () => {
    expect(parsePatternForm(addForm({ repeat: 'monthly', monthWeeks: [] }), TODAY, 'c1', TYPES)).toBe(
      MONTH_WEEKS_ERROR,
    );
  });
  it('select の値か', () => {
    expect(['1', '4', 'monthly'].every(isRepeatChoice)).toBe(true);
    expect(['0', '5', ''].some(isRepeatChoice)).toBe(false);
  });
  it('toggleNumber：入れる・外す。小さい順', () => {
    expect(toggleNumber([4], 1)).toEqual([1, 4]);
    expect(toggleNumber([1, 4], 4)).toEqual([1]);
    expect(toggleNumber([5, 3], 1)).toEqual([1, 3, 5]);
  });
});

describe('sortedWeekdays', () => {
  it('日曜はじまりの順に並べる（欄の値は変えない）', () => {
    const f = { weekdays: [5, 0, 3] };
    expect(sortedWeekdays(f)).toEqual([0, 3, 5]);
    expect(f.weekdays).toEqual([5, 0, 3]);
  });
});

describe('patternSinceError', () => {
  it('日付でない・今日より前なら理由の文', () => {
    expect(patternSinceError('', TODAY)).toBe('「いつから変えますか」に日付を入れてください');
    expect(patternSinceError('2026-10-11', TODAY)).toBe(
      '「いつから変えますか」は今日以降にしてください（今日より前の回は変えません）',
    );
    expect(patternSinceError(TODAY, TODAY)).toBeNull();
  });
});

describe('patternEndDefault', () => {
  it('終わっていればその日、まだ始まっていなければ開始日、ほかは今日', () => {
    expect(patternEndDefault({ from: '2026-01-01', to: '2026-10-01' }, TODAY)).toBe('2026-10-01');
    expect(patternEndDefault({ from: '2026-11-01', to: null }, TODAY)).toBe('2026-11-01');
    expect(patternEndDefault({ from: '2026-01-01', to: '2026-12-31' }, TODAY)).toBe(TODAY);
  });
});

describe('patternConfirmedDays', () => {
  const snap = (date: string, ids: string[]): DaySnapshot => ({
    date,
    at: 1,
    visits: ids.map((id) => ({ id, clientId: 'c1', staffId: 's1', start: '10:00' })),
  });
  const snapshots = {
    '2026-10-05': snap('2026-10-05', ['2026-10-05_p1']),
    '2026-10-12': snap('2026-10-12', ['2026-10-12_p1']),
    '2026-10-13': snap('2026-10-13', ['2026-10-13_p2']),
    '2026-10-14': snap('2026-10-14', ['v-x']),
  };

  it('since 以降で、その繰り返しの回がある確定した日（消した回の日も数える）', () => {
    expect(patternConfirmedDays({ snapshots }, 'p1', TODAY)).toBe(1);
    expect(
      patternConfirmedDays({ snapshots }, 'p1', TODAY, { removed: [{ visitId: 'v-x', date: '2026-10-14' }] }),
    ).toBe(2);
  });
});
