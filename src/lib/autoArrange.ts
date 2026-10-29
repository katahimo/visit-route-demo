// 自動の組み（ADR-0072 第2段。PRD D372〜D376）の計算：欄の保存・ホームの［組む］で、担当なしの訪問だけを自動で組む。
// どれも純粋関数（DemoData を書き換えない・乱数と今の時刻を使わない。今日は引数、seed は data.seed）。
// 組む範囲は今日から翌月末まで。ほかの訪問の担当は（手でも AI でも標準でも）ピンと同じに固定して動かさず、伝えた日は組まない。
// 解く入れ物（Worker・キュー・反映の1手）は lib/autoArrangeBatch
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import type { Problem, SolveOptions } from '../contracts/problem';
import type { Routes } from '../contracts/reassign';
import { addDays } from '../domain/time';
import { findVisit, putVisits, visitsOn } from '../patterns';
import { defaultIterations } from '../solver';
import { own } from './common';
import { activeDayVisits, clockOf, dayProblemOf, ownerOf, startsOf } from './dayPlan';
import { type DayInputs, proposalDayFresh } from './monthBatch';
import { monthDates, ymOf } from './ym';

/** 日付の範囲（両端を含む） */
export type DateRange = { from: string; to: string };

/** 日ごとの組む訪問（日付の順。ids はその日の訪問の ID） */
export type AutoTarget = { date: string; ids: string[] };

/** 自動で組む範囲：今日から翌月末まで（PRD D372） */
export function autoRange(today: string): DateRange {
  const ym = ymOf(today);
  const next = ymOf(addDays(`${ym}-01`, 31));
  return { from: today, to: monthDates(next).at(-1) ?? today };
}

type TargetData = Pick<DemoData, 'visits' | 'patterns' | 'clients' | 'clientLeaves' | 'snapshots'>;

/** 組む対象になれる訪問か：担当なし・ピンなし・取り消しでない・今日以降・その日が伝えていない */
function isFree(data: Pick<DemoData, 'snapshots'>, v: Visit, today: string): boolean {
  return v.staffId === null && !v.pinned && !v.cancelled && v.date >= today && !own(data.snapshots, v.date);
}

/** range（今日より前は除く）の日ごとに、対象の訪問を集める（pick が真の訪問。対象が無い日は出さない） */
function collect(data: TargetData, today: string, range: DateRange, pick: (v: Visit) => boolean): AutoTarget[] {
  const out: AutoTarget[] = [];
  const to = range.to;
  for (let date = range.from > today ? range.from : today; date <= to; date = addDays(date, 1)) {
    // 利用中でない人・休みの訪問は問題に入らないので除く
    const ids = activeDayVisits(data, date)
      .filter((v) => isFree(data, v, today) && pick(v))
      .map((v) => v.id);
    if (ids.length > 0) out.push({ date, ids });
  }
  return out;
}

/**
 * 保存の前後で、自動で組む対象（PRD D373）：after の range の訪問のうち、before に同じ ID が無い（増えた）か日付・開始（早）・
 * 開始（遅）が変わったもので、担当なし・ピンなし・取り消しでない・伝えていない日・今日以降のもの。日付ごと
 */
export function autoTargets(
  before: Pick<DemoData, 'visits' | 'patterns' | 'clients'>,
  after: TargetData,
  today: string,
  range: DateRange,
): AutoTarget[] {
  return collect(after, today, range, (v) => {
    const b = findVisit(before, v.id);
    return !b || b.date !== v.date || b.earliestStart !== v.earliestStart || b.latestStart !== v.latestStart;
  });
}

/** ホームの取りこぼし：range の担当なし・ピンなし・伝えていない・今日以降の訪問すべて（休み・利用中でない人の訪問は除く） */
export function unassignedTargets(data: TargetData, today: string, range: DateRange): AutoTarget[] {
  return collect(data, today, range, () => true);
}

/** 対象の訪問の件数（ホームの「担当なし N件」） */
export const targetCount = (targets: readonly AutoTarget[]): number => targets.reduce((n, t) => n + t.ids.length, 0);

/** 1日の問題（組み始めたときの訪問・解く問題・問題に入った対象の ID） */
export type AutoDayPlan = { visits: Visit[]; problem: Problem; targetIds: string[] };

/**
 * 自動の組みの1日の問題。対象は targetIds のうち今も組める（担当なし・ピンなし・取り消しでない）訪問。それ以外は動かさない：
 * - 担当のある訪問は、手でも AI でも標準でも、すべてピン（担当を固定して問題に入れる）
 * - 対象でない担当なしの訪問は、組まないので問題から外す（取り消しと同じに扱う）。組めばその人の枠を先に取ってしまい、
 *   対象が入らなくなる。外した訪問は担当なしのまま残り、あとで手で選ぶ
 * - 担当が休止中（問題にいない人）の訪問も、動かせないので問題から外す。担当が休み・条件に合わない訪問は、ピンで担当を固定したまま
 *   解けない（担当なし扱い）が、書くのは対象の訪問だけなので担当は変わらない
 * 標準（data.standard）は見ない（無くても組む）。点数の基準は今のデータの条件（dayProblemOf と同じ）。
 * 伝えた日・対象が無い日・問題が作れない日（担当がいない・計算できない）は null
 */
export function autoDayPlan(data: DemoData, date: string, targetIds: readonly string[]): AutoDayPlan | null {
  if (own(data.snapshots, date)) return null;
  const visits = visitsOn(data, date);
  const want = new Set(targetIds);
  const targets = visits.filter((v) => want.has(v.id) && isFree(data, v, date));
  if (targets.length === 0) return null;
  const free = new Set(targets.map((v) => v.id));
  const active = new Set(data.staff.filter((s) => s.active).map((s) => s.id));
  const pins: Record<string, string> = {};
  const left: Visit[] = [];
  for (const v of visits) {
    if (v.cancelled || free.has(v.id)) continue;
    if (v.staffId !== null && active.has(v.staffId)) pins[v.id] = v.staffId;
    else left.push({ ...v, cancelled: true });
  }
  const view = left.length > 0 ? { ...data, visits: putVisits(data.visits, left) } : data;
  const problem = dayProblemOf(view, date, pins);
  if (!problem || problem.staff.length === 0) return null;
  const inProblem = new Set(problem.visits.map((v) => v.id));
  const ids = targets.filter((v) => inProblem.has(v.id)).map((v) => v.id);
  return ids.length > 0 ? { visits, problem, targetIds: ids } : null;
}

/** 自由な訪問（対象）1件あたりの反復回数と下限（自動の組み） */
const ITERATIONS_PER_FREE = 4_000;
const MIN_ITERATIONS = 20_000;

/**
 * 解く設定。自動の組みは担当のある訪問をピンで固定するので、動く（自由な）訪問は対象の数だけで探す範囲が小さい。
 * 日ごとに待たせないよう、反復回数は自由な訪問の数に合わせ（1件 4,000 回・最低 20,000 回）、通常の組み（defaultIterations）を超えない。seed は data.seed
 */
export function autoSolveOptions(
  data: Pick<DemoData, 'seed'>,
  plan: Pick<AutoDayPlan, 'problem' | 'targetIds'>,
): SolveOptions {
  const wanted = Math.max(MIN_ITERATIONS, plan.targetIds.length * ITERATIONS_PER_FREE);
  return { seed: data.seed, iterations: Math.min(defaultIterations(plan.problem), wanted) };
}

/** 反映する1日（problem が null の日は組めなかった日。担当は変えない） */
export type AutoDay = {
  date: string;
  problem: Problem | null;
  /** 組み始めたときのその日の訪問（今と違えば反映しない） */
  visits: readonly Visit[];
  /** 組み始めたときのその日の問題の入力（今と違えば反映しない） */
  inputs: DayInputs;
  /** 解いた担当の並び */
  routes: Routes;
  /** この日の組む訪問の ID（組み始める前に決めたもの） */
  targetIds: readonly string[];
};

export type AutoApplyOptions = {
  /** 繰り返しの保存から来た（繰り返しの担当を書く。D376）。単発・ホームの［組む］は false */
  writeUsual: boolean;
  /** 組む範囲の終わり（autoRange の to）。繰り返しの担当を書くとき、これ以前の回で今回書かなかったものは書く前の担当のまま残す */
  rangeTo: string;
};

export type AutoApplied = {
  data: DemoData;
  /** 担当が付いた対象の訪問の数 */
  written: number;
  /** 反映した日（組み始めたときのままだった日） */
  appliedDays: string[];
  /** 飛ばした日（組んでいる間にその日が変わった・伝えた） */
  skippedDays: string[];
};

/** 解いた担当（訪問ID → 担当・開始） */
type Solved = Map<string, { staffId: string; start: string }>;

/** 繰り返しの担当に書く人：書いた回で最も多く付いた担当（同数なら早い日の担当）。対象の回の繰り返しのうち担当が決まっていないものだけ */
function usualStaffOf(data: DemoData, days: readonly { visits: readonly Visit[]; solved: Solved; date: string }[]) {
  const open = new Set(data.patterns.filter((p) => p.usualStaffId === null).map((p) => p.id));
  const tally = new Map<string, Map<string, { n: number; first: string }>>();
  for (const day of days) {
    for (const v of day.visits) {
      const staffId = day.solved.get(v.id)?.staffId;
      if (!v.pattern || !staffId || !open.has(v.pattern.id)) continue;
      const per = tally.get(v.pattern.id) ?? new Map<string, { n: number; first: string }>();
      const t = per.get(staffId);
      per.set(staffId, { n: (t?.n ?? 0) + 1, first: t?.first ?? day.date });
      tally.set(v.pattern.id, per);
    }
  }
  const out = new Map<string, string>();
  for (const [patternId, per] of tally) {
    const best = [...per].sort(([, a], [, b]) => b.n - a.n || (a.first < b.first ? -1 : a.first > b.first ? 1 : 0))[0];
    if (best) out.set(patternId, best[0]);
  }
  return out;
}

/** その日の解いた担当・開始（対象の訪問だけ。訪問ID → 担当・開始） */
function solvedOf(day: AutoDay): Solved {
  const out: Solved = new Map();
  if (!day.problem) return out;
  const owner = ownerOf(day.routes);
  const starts = startsOf(day.problem, day.routes);
  for (const id of day.targetIds) {
    const staffId = owner.get(id);
    const at = starts.get(id);
    if (staffId && at) out.set(id, { staffId, start: clockOf(at.start) });
  }
  return out;
}

/**
 * 自動の組みを反映する（純粋関数。PRD D374）：組み始めたときのままの日（proposalDayFresh）だけ、対象の訪問の担当・開始を書く。
 * ピンなどほかの訪問は変えない。組めなかった対象は担当なしのまま。
 * writeUsual が真のとき（繰り返しの保存から）は、対象の回の繰り返しで担当が決まっていないものの usualStaffId に、書いた回で最も多く付いた
 * 担当を書く（D376）。書くと計算した回の担当がその人に変わるので、先に繰り返しに書いてから、解いた対象の回を保存した回に書き、
 * 範囲の終わり（rangeTo）以前の書かなかった回は書く前の担当のまま保存した回として残す（担当なしで残った回・別の人の回・過去・伝えた日は変わらない）
 */
export function applyAutoArrange(data: DemoData, days: readonly AutoDay[], opts: AutoApplyOptions): AutoApplied {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const appliedDays: string[] = [];
  const skippedDays: string[] = [];
  const solved = new Map<string, Solved>();
  for (const day of sorted) {
    if (!day.problem) continue;
    if (!proposalDayFresh(data, day)) {
      skippedDays.push(day.date);
      continue;
    }
    appliedDays.push(day.date);
    solved.set(day.date, solvedOf(day));
  }
  const usual = opts.writeUsual
    ? usualStaffOf(
        data,
        sorted
          .filter((d) => solved.has(d.date))
          .map((d) => ({ date: d.date, visits: d.visits, solved: solved.get(d.date)! })),
      )
    : new Map<string, string>();
  const withUsual =
    usual.size > 0
      ? {
          ...data,
          patterns: data.patterns.map((p) => (usual.has(p.id) ? { ...p, usualStaffId: usual.get(p.id)! } : p)),
        }
      : data;
  const put = new Map<string, Visit>();
  let written = 0;
  // 解いた日の対象の担当・開始を書く
  for (const day of sorted) {
    const here = solved.get(day.date);
    if (!here) continue;
    const ids = new Set(day.targetIds);
    for (const v of visitsOn(withUsual, day.date)) {
      const to = here.get(v.id);
      if (!ids.has(v.id) || !to) continue;
      written++;
      if (v.staffId !== to.staffId || v.start !== to.start)
        put.set(v.id, { ...v, staffId: to.staffId, start: to.start, pinned: false });
    }
  }
  // 繰り返しの担当を書くと計算した回の担当が変わる。範囲の終わり以前の回で今回書かなかったもの（昨日以前・伝えた日・組めなかった日・
  // 飛ばした日）は、書く前の担当のまま保存した回として残す（過去・伝えた日の予定を黙って変えない）。範囲より後の回だけが新しい担当になる
  for (const patternId of usual.keys()) {
    const from = data.patterns.find((p) => p.id === patternId)?.from;
    if (!from) continue;
    for (let date = from; date <= opts.rangeTo; date = addDays(date, 1)) {
      for (const v of visitsOn(withUsual, date)) {
        if (v.pattern?.id !== patternId || put.has(v.id)) continue;
        const was = findVisit(data, v.id);
        if (was && (was.staffId !== v.staffId || was.start !== v.start)) put.set(v.id, was);
      }
    }
  }
  const out = put.size > 0 ? { ...withUsual, visits: putVisits(withUsual.visits, [...put.values()]) } : withUsual;
  return { data: out, written, appliedDays, skippedDays };
}
