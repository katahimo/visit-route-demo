// 週の予定（D50）のデータを書く操作：これ以降で動かす、空き時間に入れる（この回だけ動かすのは訪問の詳細の欄。lib/visitOps の applyVisitEdit）。
// 純粋関数（データは書き換えず、新しい DemoData を返す。画面は update(fn) に渡す）。表の形の計算は lib/week
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import type { PatternChange } from '../contracts/patterns';
import type { Routes } from '../contracts/reassign';
import { addDays, minutesToHhmm, weekday } from '../domain/time';
import { findVisit, nthOfMonth, patternVisitId, splitPattern, timesOn, visitsOn } from '../patterns';
import { fitsOf, placeVisit } from '../reassign';
import { dayProblemOf, pinsOf, routesOf, writeRoutes } from './dayPlan';
import { canMoveVisit, shiftedTimes } from './week';

/**
 * 「これ以降」で動かす曜日の新しいパターンに、時刻のほかに変えるもの（訪問の詳細の欄。PRD D301）。
 * width は開始（早）〜開始（遅）の幅（分。無ければ元の曜日の幅を保つ）。usualStaffId は繰り返しの担当
 */
export type FollowingOver = Partial<Pick<Pattern, 'durationMinutes' | 'typeId' | 'windowKind' | 'usualStaffId'>> & {
  width?: number;
};

export type MoveFollowing = {
  data: DemoData;
  change: PatternChange;
  /** 動かした回の新しい訪問の ID（新しい日に無ければ null） */
  movedVisitId: string | null;
};

/**
 * 「これ以降」：元の日（since）以降の〈曜日〉の回を〈新しい曜日・時刻〉にする（patterns の splitPattern を使う）。
 * 元の日・元の曜日はパターンの元の日（visit.pattern.date）。新しい日が元の日より前なら since は新しい日。
 * 新しい曜日・時刻のパターンの from はドラッグした日（新しい日。隔週などの週の数え始め）。
 * パターンの曜日が1つだけなら、曜日を入れ替え時刻を変えたパターンに分ける。ほかの曜日もあるなら、ほかの曜日は時刻を変えずに残し
 * （splitPattern で元の曜日を抜く）、新しい曜日・時刻のパターンを newIds[1] で足す。回は見るときに計算するので展開はしない（版2）。
 * 動かす回の保存した回は消す（新しいパターンの回が代わりに出る）。この回だけ変えた・取り消した、動かす曜日の回は、新しいパターンの
 * 同じ週の回として ID を付け直す（同じ週に二重に出さない）。
 * 毎月のパターン（ADR-0013）は、第N（monthWeeks）を「新しい日の第N − 元の日の第N」だけずらす。1〜5 に収まらないものは捨て、
 * 空になれば「これ以降」は断る（null）。over を渡すと所要・種類・時間の約束・繰り返しの担当・時刻の幅も変える。
 * 繰り返しの回でない・パターンが無い・訪問の日か新しい日が今日より前・動かした回が新しい日にできない組み合わせなら null
 */
export function moveFollowing(
  d: DemoData,
  visitId: string,
  date: string,
  start: number,
  today: string,
  newIds: readonly [string, string],
  over: FollowingOver = {},
): MoveFollowing | null {
  const v = findVisit(d, visitId);
  const p = v?.pattern ? d.patterns.find((x) => x.id === v.pattern!.id) : undefined;
  if (!v?.pattern || !p) return null;
  if (!canMoveVisit(v.date, today) || !canMoveVisit(date, today)) return null;
  const origDate = v.pattern.date;
  const since = date < origDate ? date : origDate;
  const fromWd = weekday(origDate);
  const toWd = weekday(date);
  const times =
    over.width === undefined
      ? shiftedTimes(timesOn(p, fromWd), start)
      : { earliestStart: minutesToHhmm(start), latestStart: minutesToHhmm(start + over.width) };
  const { id: _id, from: _from, ...base0 } = p;
  const shift = nthOfMonth(date) - nthOfMonth(origDate);
  const monthWeeks =
    p.repeat === 'monthly' ? p.monthWeeks.map((n) => n + shift).filter((n) => n >= 1 && n <= 5) : p.monthWeeks;
  if (p.repeat === 'monthly' && monthWeeks.length === 0) return null;
  const { width: _width, ...fields } = over;
  // 動かした繰り返しは標準の開始を持たない（時間の約束が変わる。ADR-0062）
  const movedRest = { ...base0, ...fields, monthWeeks, usualStarts: [] };
  // 動かす回は除いてから分ける
  const visits = d.visits.filter((x) => x.id !== visitId);
  const input = { patterns: d.patterns, visits, clients: d.clients };
  const others = p.weekdays.filter((w) => w !== fromWd);
  let patterns: Pattern[];
  let split: PatternChange;
  let target: string;
  if (others.length === 0) {
    split = splitPattern(
      input,
      p.id,
      { ...movedRest, ...times, weekdays: [toWd], dayTimes: [] },
      since,
      today,
      newIds[0],
    );
    target = split.patterns.some((x) => x.id === newIds[0]) ? newIds[0] : p.id;
    patterns = split.patterns.map((x) => (x.id === target ? { ...x, from: date } : x));
  } else {
    split = splitPattern(
      input,
      p.id,
      {
        ...base0,
        weekdays: others,
        dayTimes: base0.dayTimes.filter((t) => t.weekday !== fromWd),
        usualStarts: (base0.usualStarts ?? []).filter((t) => t.weekday !== fromWd),
      },
      since,
      today,
      newIds[0],
    );
    const moved: Pattern = { ...movedRest, ...times, id: newIds[1], weekdays: [toWd], dayTimes: [], from: date };
    patterns = [...split.patterns];
    const anchor = patterns.findIndex((x) => x.id === newIds[0]);
    patterns.splice((anchor >= 0 ? anchor : patterns.findIndex((x) => x.id === p.id)) + 1, 0, moved);
    target = newIds[1];
  }
  // この回だけ変えた・取り消した、動かす曜日の回を新しいパターンの同じ週の回にする（二重に出さない）
  const first = since > today ? since : today;
  const delta = (toWd - fromWd + 7) % 7;
  const owners = new Set([p.id, newIds[0], target]);
  const rekeyed = split.visits.map((x) => {
    if (!x.pattern || !owners.has(x.pattern.id) || x.pattern.date < first || weekday(x.pattern.date) !== fromWd)
      return x;
    if (x.pattern.id === target && delta === 0) return x;
    const at = addDays(x.pattern.date, delta);
    return { ...x, id: patternVisitId(at, target), pattern: { id: target, date: at, edited: true } };
  });
  const change: PatternChange = {
    patterns,
    visits: rekeyed,
    removed: [...split.removed, ...(d.visits.some((x) => x.id === visitId) ? [{ visitId, date: v.date }] : [])],
  };
  const data = { ...d, patterns: change.patterns, visits: change.visits };
  const movedId = patternVisitId(date, target);
  const movedVisit = findVisit(data, movedId);
  // 動かした回が新しい日にできない組み合わせではデータを変えない（「この回だけ」を勧める）
  if (!movedVisit || movedVisit.cancelled) return null;
  return { data, change, movedVisitId: movedId };
}

// ---- 空き時間に入れる ----

export type InsertResult = {
  data: DemoData;
  /** 入れた人（入らない・訪問が問題に無ければ null。そのとき data は元のまま） */
  staffId: string | null;
};

/**
 * その日の担当の並びに、訪問を空き時間で入れる（D50）：その訪問を除いたピンでその日の問題を作り、
 * reassign の fitsOf の先頭の人（他の人の担当・順番・開始時刻を変えずに入る、増える費用の一番小さい人）に placeVisit で入れ、
 * ピンにする（訪問に書く）
 */
export function insertIntoPlan(d: DemoData, date: string, visitId: string): InsertResult {
  const visits = visitsOn(d, date);
  const pins = pinsOf(visits.filter((v) => v.id !== visitId));
  const problem = dayProblemOf(d, date, Object.keys(pins).length > 0 ? pins : undefined);
  if (!problem || !problem.visits.some((v) => v.id === visitId)) return { data: d, staffId: null };
  const current = routesOf(problem, visits);
  const base: Routes = {};
  for (const [k, list] of Object.entries(current)) base[k] = list.filter((id) => id !== visitId);
  const fit = fitsOf(problem, base, visitId)[0];
  if (!fit) return { data: d, staffId: null };
  const routes = placeVisit(problem, base, visitId, fit.staffId);
  return {
    data: writeRoutes(d, date, problem, routes, { pins: { ...pins, [visitId]: fit.staffId } }),
    staffId: fit.staffId,
  };
}

/**
 * 足した訪問（仮押さえなど）を insertIntoPlan で空き時間に入れる（日付の順）。
 * inserted は入れた件数、failedDates は入らなかった日（日付の順・重複なし）
 */
export function insertAllIntoPlans(
  d: DemoData,
  added: readonly { visitId: string; date: string }[],
): { data: DemoData; inserted: number; failedDates: string[] } {
  let data = d;
  let inserted = 0;
  const failed = new Set<string>();
  for (const x of [...added].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const r = insertIntoPlan(data, x.date, x.visitId);
    if (r.staffId) {
      data = r.data;
      inserted++;
    } else failed.add(x.date);
  }
  return { data, inserted, failedDates: [...failed].sort() };
}
