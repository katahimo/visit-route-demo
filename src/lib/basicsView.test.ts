import { describe, expect, it } from 'vitest';
import type { Pattern } from '../contracts/documents';
import { createDemoData } from '../seed';
import {
  basicsRowPatterns,
  basicsRows,
  basicsTimeError,
  canEditTime,
  changePatternTime,
  issueCount,
  setPatternTime,
  shiftIssue,
} from './basicsView';

const today = '2026-10-26';
const data = createDemoData(today);
const staff = { active: true, workDays: [1, 2, 3], shiftStart: '09:00', shiftEnd: '17:00', lastDay: null };
const at10 = { earliestStart: '10:00', latestStart: '10:30' };

describe('shiftIssue', () => {
  it('勤務日・勤務時間の中なら null', () => {
    expect(shiftIssue(staff, 1, at10, 60, today)).toBeNull();
  });
  it('休止・最終勤務日の後・勤務日でない・終わりが勤務の外', () => {
    expect(shiftIssue({ ...staff, active: false }, 1, at10, 60, today)).toBe('inactive');
    expect(shiftIssue({ ...staff, lastDay: '2026-10-01' }, 1, at10, 60, today)).toBe('inactive');
    expect(shiftIssue(staff, 5, at10, 60, today)).toBe('off');
    expect(shiftIssue(staff, 1, { earliestStart: '16:30', latestStart: '17:00' }, 60, today)).toBe('outside');
    expect(shiftIssue(staff, 1, { earliestStart: '07:00', latestStart: '08:30' }, 30, today)).toBe('outside');
  });
  it('約束の幅の中に勤務に収まる開始があれば勤務時間の外にしない（fitInSlots と同じ）', () => {
    expect(shiftIssue(staff, 1, { earliestStart: '08:30', latestStart: '10:00' }, 30, today)).toBeNull();
    expect(shiftIssue(staff, 1, { earliestStart: '16:00', latestStart: '16:30' }, 60, today)).toBeNull();
  });
});

describe('basicsRows', () => {
  it('行は標準の表と同じ並び、マスは行く曜日だけで担当は繰り返しのいつもの担当', () => {
    const rows = basicsRows(data, today, true);
    expect(rows.map((r) => r.pattern.id)).toEqual(basicsRowPatterns(data, today).map((p) => p.id));
    for (const r of rows) {
      expect(Object.keys(r.cells).map(Number).sort()).toEqual([...r.pattern.weekdays].sort());
      for (const c of Object.values(r.cells)) expect(c.staffId).toBe(r.pattern.usualStaffId);
    }
  });
  it('相性の一覧は ◎ から × の順で未入力を含まない。相性を切ると空', () => {
    const rows = basicsRows(data, today, true);
    const withCompat = rows.find((r) => r.compat.length >= 2);
    if (withCompat) {
      const levels = withCompat.compat.map((c) => c.level);
      expect(levels).toEqual([...levels].sort((a, b) => b - a));
      expect(levels).not.toContain(0);
    }
    expect(basicsRows(data, today, false).every((r) => r.compat.length === 0)).toBe(true);
  });
});

describe('setPatternTime', () => {
  const base = data.patterns[0]!;
  const one: Pattern = { ...base, weekdays: [1], earliestStart: '09:00', latestStart: '09:00', dayTimes: [] };
  const two: Pattern = { ...one, weekdays: [1, 4] };
  it('曜日が1つなら共通の時刻', () => {
    const p = setPatternTime(one, 1, '10:00', '10:30');
    expect([p.earliestStart, p.latestStart, p.dayTimes]).toEqual(['10:00', '10:30', []]);
  });
  it('曜日が2つ以上ならその曜日の時刻を書き、共通と同じに戻せば消す', () => {
    const p = setPatternTime(two, 4, '14:00', '14:00');
    expect(p.earliestStart).toBe('09:00');
    expect(p.dayTimes).toEqual([{ weekday: 4, earliestStart: '14:00', latestStart: '14:00' }]);
    expect(setPatternTime(p, 4, '09:00', '09:00').dayTimes).toEqual([]);
  });
  it('曜日ごとの時刻は機能が切れていれば直せない（曜日が1つなら直せる）', () => {
    expect(canEditTime(two, false)).toBe(false);
    expect(canEditTime(one, false)).toBe(true);
    expect(canEditTime(two, true)).toBe(true);
  });
});

describe('basicsTimeError', () => {
  it('形と前後を見る', () => {
    expect(basicsTimeError('10:00', '10:30')).toBeNull();
    expect(basicsTimeError('10:3', '10:30')).not.toBeNull();
    expect(basicsTimeError('11:00', '10:30')).toBe('開始（遅）は開始（早）以降にしてください');
  });
});

describe('issueCount', () => {
  it('勤務時間の外のマスを数える', () => {
    const rows = basicsRows(data, today, true);
    const n = rows.reduce((a, r) => a + Object.values(r.cells).filter((c) => c.issue !== null).length, 0);
    expect(issueCount(rows)).toBe(n);
  });
});

describe('changePatternTime（今日から分ける）', () => {
  it('今日より前に始まった繰り返しは昨日で終わらせ、今日から新しい時刻の繰り返し', () => {
    const p = data.patterns.find((x) => x.from < today && x.weekdays.length === 1)!;
    const wd = p.weekdays[0]!;
    const c = changePatternTime(data, p.id, wd, { earliestStart: '06:00', latestStart: '06:00' }, today, 'pt-new')!;
    const old = c.patterns.find((x) => x.id === p.id)!;
    const next = c.patterns.find((x) => x.id === 'pt-new')!;
    expect(old.earliestStart).toBe(p.earliestStart);
    expect(old.to).toBe('2026-10-25');
    expect([next.from, next.earliestStart]).toEqual([today, '06:00']);
  });
  it('無い繰り返しは null', () => {
    expect(changePatternTime(data, 'nope', 1, at10, today, 'x')).toBeNull();
  });
});
