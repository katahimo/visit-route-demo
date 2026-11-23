// 定期パターンの表示の文（ADR-0012・ADR-0013）
import { describe, expect, it } from 'vitest';
import type { Pattern } from '../contracts/documents';
import { removePattern, splitPattern } from '../patterns';
import { patternPhaseText, patternWhenText, repeatText, splitEndedPatterns, usualStartsLabel } from './patternText';

const p = (over: Partial<Pattern> = {}) => ({
  weekdays: [1, 4],
  everyWeeks: 1,
  repeat: 'weekly' as const,
  monthWeeks: [] as number[],
  dayTimes: [] as Pattern['dayTimes'],
  windowKind: 'fixed' as const,
  earliestStart: '10:00',
  latestStart: '10:00',
  ...over,
});

describe('patternWhenText', () => {
  it('毎週・隔週は今までどおり', () => {
    expect(patternWhenText(p())).toBe('月・木 10:00');
    expect(patternWhenText(p({ everyWeeks: 2, weekdays: [1] }))).toBe('隔週 月 10:00');
  });
  it('毎月の第N曜日（ADR-0013）', () => {
    expect(patternWhenText(p({ repeat: 'monthly', monthWeeks: [4, 3], weekdays: [4] }))).toBe('毎月 第3・第4 木 10:00');
    expect(repeatText(p({ repeat: 'monthly', monthWeeks: [5, 1, 1] }))).toBe('毎月 第1・第5');
    expect(repeatText(p({ repeat: 'monthly', monthWeeks: [2], everyWeeks: 2 }))).toBe('毎月 第2');
    expect(repeatText(p())).toBe('');
  });
  it('曜日ごとの時刻があれば曜日ごとに時刻を並べる（上書きの無い曜日は共通の時刻）', () => {
    expect(
      patternWhenText(
        p({
          earliestStart: '15:00',
          latestStart: '15:00',
          dayTimes: [{ weekday: 1, earliestStart: '09:30', latestStart: '09:30' }],
        }),
      ),
    ).toBe('月 09:30・木 15:00');
    expect(
      patternWhenText(
        p({
          windowKind: 'window',
          latestStart: '10:30',
          weekdays: [2],
          dayTimes: [{ weekday: 2, earliestStart: '13:00', latestStart: '14:00' }],
        }),
      ),
    ).toBe('火 13:00〜14:00の間');
  });
});

describe('usualStartsLabel（標準の開始の文。ADR-0062）', () => {
  it('曜日の順に「曜 開始」を並べる。無ければ空', () => {
    expect(
      usualStartsLabel({
        usualStarts: [
          { weekday: 3, start: '11:00' },
          { weekday: 1, start: '10:00' },
        ],
      }),
    ).toBe('標準の開始：月 10:00・水 11:00');
    expect(usualStartsLabel({ usualStarts: [] })).toBe('');
    expect(usualStartsLabel({})).toBe('');
  });
});

describe('splitEndedPatterns', () => {
  const at = (id: string, to: string | null) => ({ id, to });
  it('最後の日が今日より前の繰り返しは「終わった」に分ける（今日まで・続くものは今の並び。順はそのまま）', () => {
    const r = splitEndedPatterns(
      [at('a', null), at('b', '2026-11-19'), at('c', '2026-11-20'), at('d', '2026-12-31')],
      '2026-11-20',
    );
    expect(r.current.map((p) => p.id)).toEqual(['a', 'c', 'd']);
    expect(r.ended.map((p) => p.id)).toEqual(['b']);
  });
  it('今日より前に始まった繰り返しを消すと（昨日で終わらせて残る）、今の並びから外れる（#4）', () => {
    const p: Pattern = {
      id: 'p1',
      clientId: 'c1',
      typeId: null,
      weekdays: [1, 4],
      everyWeeks: 1,
      repeat: 'weekly',
      monthWeeks: [],
      dayTimes: [],
      windowKind: 'fixed',
      earliestStart: '08:30',
      latestStart: '08:30',
      durationMinutes: 30,
      from: '2026-11-16',
      to: '2026-11-30',
      usualStaffId: null,
      note: '',
    };
    const today = '2026-11-20';
    const r = removePattern({ patterns: [p], visits: [], clients: [] }, 'p1', today);
    expect(r.patterns).toHaveLength(1);
    expect(splitEndedPatterns(r.patterns, today)).toEqual({ current: [], ended: [{ ...p, to: '2026-11-19' }] });
  });
});

describe('patternPhaseText（今の一覧の札。PRD D459）', () => {
  const base: Pattern = {
    id: 'p1',
    clientId: 'c1',
    typeId: null,
    weekdays: [1, 2, 4],
    everyWeeks: 1,
    repeat: 'weekly',
    monthWeeks: [],
    dayTimes: [],
    windowKind: 'fixed',
    earliestStart: '08:30',
    latestStart: '08:30',
    durationMinutes: 30,
    from: '2026-11-10',
    to: null,
    usualStaffId: null,
    note: '',
  };
  const today = '2026-11-16';
  it('始まっていて終わりの無い繰り返しは札なし、まだ始まっていない繰り返しは「M/Dから」', () => {
    expect(patternPhaseText(base, [base], today)).toBeNull();
    expect(patternPhaseText({ ...base, from: '2026-11-23' }, [base], today)).toBe('11/23から');
  });
  it('終わりの決まった繰り返しは「M/Dまで」、終わった繰り返しは札なし', () => {
    expect(patternPhaseText({ ...base, to: '2026-11-30' }, [base], today)).toBe('11/30まで');
    expect(patternPhaseText({ ...base, to: '2026-11-15' }, [base], today)).toBeNull();
  });
  it('後の日から直して分けると、前は「M/Dまで（翌日から変わります）」、後ろは「翌日から」（#7）', () => {
    const data = { patterns: [base], visits: [] };
    const { id: _, from: __, ...next } = { ...base, durationMinutes: 60 };
    const r = splitPattern(data as never, 'p1', next, '2026-11-23', today, 'p2');
    const [cut, rebuilt] = r.patterns;
    expect(patternPhaseText(cut!, r.patterns, today)).toBe('11/22まで（11/23から変わります）');
    expect(patternPhaseText(rebuilt!, r.patterns, today)).toBe('11/23から');
  });
  it('今日から直して分けると、前の中身は終わった繰り返しに入る（#7）', () => {
    const data = { patterns: [base], visits: [] };
    const { id: _, from: __, ...next } = { ...base, durationMinutes: 60 };
    const r = splitPattern(data as never, 'p1', next, today, today, 'p2');
    const s = splitEndedPatterns(r.patterns, today);
    expect(s.current.map((x) => x.id)).toEqual(['p2']);
    expect(s.ended.map((x) => x.id)).toEqual(['p1']);
    expect(patternPhaseText(s.current[0]!, r.patterns, today)).toBeNull();
  });
});
