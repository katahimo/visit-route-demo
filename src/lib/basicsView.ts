// 基本情報の表（#/basics。ADR-0067。PRD D362）のための純粋関数：行（標準の表と同じ繰り返し）・マス（時間の約束・標準の担当・
// 相性・勤務時間の外）・行の相性の一覧・マスで時刻を直したときの繰り返し
import type { DemoData } from '../contracts/data';
import type { Pattern, Staff } from '../contracts/documents';
import type { PatternChange, PatternInput } from '../contracts/patterns';
import type { CompatLevel } from '../contracts/rules';
import { hhmmToMinutes } from '../domain/time';
import { splitPattern, timesOn } from '../patterns';
import { compatLevelOf } from './compatLevel';
import { standardRows } from './standardView';

/** 担当がそのマスに行けない理由：休止（最終勤務日の後も）・勤務日でない・勤務時間の外 */
export type ShiftIssue = 'inactive' | 'off' | 'outside';

/** 勤務時間の外の言葉（マスの札・読み上げ） */
export const SHIFT_ISSUE_TEXT: Record<ShiftIssue, string> = {
  inactive: '休止中',
  off: '勤務日でない',
  outside: '勤務時間外',
};

/** 表の1マス（その曜日の時間の約束・標準の担当・その組の相性・勤務時間の外） */
export type BasicsCell = {
  earliestStart: string;
  latestStart: string;
  staffId: string | null;
  compat: CompatLevel;
  issue: ShiftIssue | null;
};

/** 表の1行（繰り返し。cells は曜日 → マス）と、その〈利用者さん〉と相性を入れた〈スタッフ〉（◎○△×の順） */
export type BasicsRow = {
  pattern: Pattern;
  cells: Record<number, BasicsCell>;
  compat: { staffId: string; level: CompatLevel }[];
};

/**
 * 担当がその曜日・時間の約束に行けるか（基本の勤務日・勤務時間で見る。標準の週の表なので日ごとの上書きは見ない）。
 * 約束の幅の中に勤務に収まる開始が1つも無ければ勤務時間の外（domain/scheduleModel の fitInSlots と同じ決まり）
 */
export function shiftIssue(
  staff: Pick<Staff, 'active' | 'workDays' | 'shiftStart' | 'shiftEnd' | 'lastDay'>,
  wd: number,
  times: { earliestStart: string; latestStart: string },
  durationMinutes: number,
  today: string,
): ShiftIssue | null {
  if (!staff.active || (staff.lastDay !== null && staff.lastDay !== undefined && staff.lastDay < today))
    return 'inactive';
  if (!staff.workDays.includes(wd)) return 'off';
  const at = Math.max(hhmmToMinutes(times.earliestStart), hhmmToMinutes(staff.shiftStart));
  if (at > hhmmToMinutes(times.latestStart) || at + durationMinutes > hhmmToMinutes(staff.shiftEnd)) return 'outside';
  return null;
}

/** 表のマスのうち、担当が勤務時間の外（休止・勤務日でないも）のマスの数 */
export const issueCount = (rows: readonly BasicsRow[]): number =>
  rows.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.issue).length, 0);

/** 基本情報の表の行（並びは標準の表と同じ。compatOn を切れば相性は 0・一覧は空） */
export function basicsRows(
  data: Pick<DemoData, 'patterns' | 'clients' | 'staff' | 'compat'>,
  today: string,
  compatOn: boolean,
): BasicsRow[] {
  const staffById = new Map(data.staff.map((s) => [s.id, s]));
  const names = new Map(data.staff.map((s) => [s.id, s.name]));
  return standardRows(data, today).map((p) => {
    const row = compatOn ? data.compat[p.clientId] : undefined;
    const cells: Record<number, BasicsCell> = {};
    for (const wd of p.weekdays) {
      const times = timesOn(p, wd);
      const staff = p.usualStaffId ? staffById.get(p.usualStaffId) : undefined;
      cells[wd] = {
        ...times,
        staffId: p.usualStaffId,
        compat: p.usualStaffId ? compatLevelOf(row, p.usualStaffId) : 0,
        issue: staff ? shiftIssue(staff, wd, times, p.durationMinutes, today) : null,
      };
    }
    const compat = Object.entries(row ?? {})
      .filter(([id, level]) => level !== 0 && staffById.get(id)?.active)
      .map(([staffId, level]) => ({ staffId, level: level as CompatLevel }))
      .sort(
        (a, b) => b.level - a.level || (names.get(a.staffId) ?? '').localeCompare(names.get(b.staffId) ?? '', 'ja'),
      );
    return { pattern: p, cells, compat };
  });
}

/** マスで時刻を直せるか：曜日が1つの繰り返しは共通の時刻、2つ以上は曜日ごとの時刻（毎月のパターンの機能が要る） */
export const canEditTime = (p: Pick<Pattern, 'weekdays'>, perDayOn: boolean): boolean =>
  p.weekdays.length === 1 || perDayOn;

/** 時刻の入力の誤り（無ければ null）。ちょうど（fixed）は開始（早）だけを見る */
export function basicsTimeError(earliestStart: string, latestStart: string): string | null {
  const ok = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!ok(earliestStart) || !ok(latestStart)) return '時刻は 9:30 のように入れてください';
  if (earliestStart > latestStart) return '開始（遅）は開始（早）以降にしてください';
  return null;
}

/**
 * マスで時刻を直した繰り返し：曜日が1つなら共通の時刻、2つ以上ならその曜日の時刻（dayTimes）。
 * 曜日ごとの時刻が共通の時刻と同じになったら、その曜日の上書きを消す
 */
export function setPatternTime(p: Pattern, wd: number, earliestStart: string, latestStart: string): Pattern {
  if (p.weekdays.length === 1) return { ...p, earliestStart, latestStart, dayTimes: [] };
  const rest = p.dayTimes.filter((t) => t.weekday !== wd);
  const same = earliestStart === p.earliestStart && latestStart === p.latestStart;
  const dayTimes = same
    ? rest
    : [...rest, { weekday: wd, earliestStart, latestStart }].sort((a, b) => a.weekday - b.weekday);
  return { ...p, dayTimes };
}

/**
 * マスで時刻を直したときの繰り返しと訪問（〈利用者さん〉の画面と同じく今日から分ける。今日より前の回は変えず、
 * 今日からの担当を組んだ回は繰り返しのとおりに戻す。patterns の splitPattern）。newId は分けたときの新しい繰り返しの id
 */
export function changePatternTime(
  data: PatternInput,
  patternId: string,
  wd: number,
  times: { earliestStart: string; latestStart: string },
  today: string,
  newId: string,
): PatternChange | null {
  const p = data.patterns.find((x) => x.id === patternId);
  if (!p) return null;
  const { id: _, from: __, ...next } = setPatternTime(p, wd, times.earliestStart, times.latestStart);
  return splitPattern(data, patternId, next, today, today, newId);
}
