// 自動の組み（ADR-0072 第2段。PRD D372〜D376・D403・D405）の計算：欄の保存・要対応の帯の［要対応を組む］で、担当なしの訪問を自動で組む。
// エキスパート機能が切なら、間に合わない・重なり・休みの人の訪問（帯の種類。lib/bandIssues）も担当・開始を組み直してよい対象にする（ADR-0089。
// 伝えた日の訪問は除く。組み直しても要対応が減らない訪問は元の担当のまま）。
// DemoData を書き換えず、乱数と今の時刻を使わない（今日は引数、seed は data.seed。同じ入力なら同じ結果）。ただし帯の種類の訪問（bandIssueIds）は
// アプリで1つの日ごとの覚え（lib/dayStatuses の dayStatusMemo）から引くので、覚えを書き足す（結果は覚えの有無で変わらない）。
// 組む範囲は今日（繰り返しの開始日が先ならその日）から翌月末まで。ほかの訪問の担当は（手でも AI でも標準でも）ピンと同じに固定して動かさず、伝えた日は組まない（expert 切は伝えた日も担当なしだけ埋める。skipsToldDays）。
// 解く入れ物（Worker・キュー・反映の1手）は lib/autoArrangeBatch
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import type { Problem, ProblemStay, SolveOptions } from '../contracts/problem';
import type { Routes } from '../contracts/reassign';
import { addDays, hhmmToMinutes } from '../domain/time';
import { scheduleRoute } from '../matching';
import { findVisit, putVisits, visitsOn } from '../patterns';
import { defaultIterations } from '../solver';
import { dayBandIssues } from './bandIssues';
import { own } from './common';
import { activeDayVisits, clockOf, dayProblemOf } from './dayPlan';
import { bandIssueIds } from './dayStatuses';
import { type DayInputs, dayInputsOf, proposalDayFresh } from './monthBatch';
import { showConfirmStep } from './settledView';
import { monthDates, ymOf } from './ym';

/** 日付の範囲（両端を含む） */
export type DateRange = { from: string; to: string };

/** 日ごとの組む訪問（日付の順。ids はその日の訪問の ID） */
export type AutoTarget = { date: string; ids: string[] };

/**
 * 自動で組む範囲：今日から翌月末まで（PRD D372）。from（繰り返しの開始日。PRD D416）が今日より後なら、開始日からその翌月末まで
 */
export function autoRange(today: string, from: string = today): DateRange {
  const start = from > today ? from : today;
  const next = ymOf(addDays(`${ymOf(start)}-01`, 31));
  return { from: start, to: monthDates(next).at(-1) ?? start };
}

type TargetData = Pick<DemoData, 'visits' | 'patterns' | 'clients' | 'clientLeaves' | 'snapshots' | 'org'>;

/**
 * 伝えた日を自動の組みから外すか（その判定はここの1か所。ADR-0073）。expert 入は今の確定の操作があるので外す（伝えた内容を勝手に変えない）。
 * expert 切は伝えた日（決まった日）も、担当なしの訪問を埋める対象にする（担当のある訪問は動かさない。結果は伝えた内容と違うので「変更あり」）
 */
export const skipsToldDays = (data: Pick<DemoData, 'org'>): boolean => showConfirmStep(data.org.features);

/** 組む対象になれる訪問か：担当なし・ピンなし・取り消しでない・今日以降・その日が伝えていない */
export function isFree(data: Pick<DemoData, 'snapshots' | 'org'>, v: Visit, today: string): boolean {
  const told = skipsToldDays(data) && !!own(data.snapshots, v.date);
  return v.staffId === null && !v.pinned && !v.cancelled && v.date >= today && !told;
}

/**
 * 要対応の訪問（間に合わない・重なり・休みの人）も組み直すか（ADR-0089）：エキスパート機能が切のときだけ。
 * 入は担当を組むの画面で組むので、担当のある訪問は動かさない（ADR-0072）
 */
export const rearrangesIssues = (data: Pick<DemoData, 'org'>): boolean => !skipsToldDays(data);

/**
 * 組み直してよい担当のある訪問か（帯の種類に当たるかは呼ぶ側が見る）：担当あり・ピンなし・取り消しでない・今日以降・その日に伝えた記録が無い
 * （伝えた日の訪問は、伝えた内容を黙って変えないので動かさない）。エキスパート機能が入なら常に偽
 */
export function isMovable(data: Pick<DemoData, 'snapshots' | 'org'>, v: Visit, today: string): boolean {
  return (
    rearrangesIssues(data) &&
    v.staffId !== null &&
    !v.pinned &&
    !v.cancelled &&
    v.date >= today &&
    !own(data.snapshots, v.date)
  );
}

/** 日付 → 帯の種類の訪問の ID（lib/dayStatuses の bandIssueIds）。無い日は空 */
type IssueIds = ReadonlyMap<string, ReadonlySet<string>>;
const NO_IDS: ReadonlySet<string> = new Set();

/** 組む対象か：担当なし（isFree）か、帯の種類に当たる組み直してよい訪問（isMovable） */
const isTarget = (data: TargetData, v: Visit, today: string, issues: ReadonlySet<string>): boolean =>
  isFree(data, v, today) || (issues.has(v.id) && isMovable(data, v, today));

/** days の日ごとに、対象の訪問を集める（pick が真の訪問。対象が無い日は出さない） */
function collect(
  data: TargetData,
  today: string,
  days: readonly string[],
  pick: (v: Visit) => boolean,
  issues: IssueIds = new Map(),
): AutoTarget[] {
  const out: AutoTarget[] = [];
  for (const date of days) {
    const here = issues.get(date) ?? NO_IDS;
    // 利用中でない人・休みの訪問は問題に入らないので除く
    const ids = activeDayVisits(data, date)
      .filter((v) => isTarget(data, v, today, here) && pick(v))
      .map((v) => v.id);
    if (ids.length > 0) out.push({ date, ids });
  }
  return out;
}

/**
 * range の日（今日より前は除く。日付の順）。range を省くと自動の組みの範囲（autoRange）＝要対応の帯が見る日（lib/attentionBand）。
 * 日のリストはここの1か所で作る
 */
export function rangeDays(today: string, range: DateRange = autoRange(today)): string[] {
  const days: string[] = [];
  for (let date = range.from > today ? range.from : today; date <= range.to; date = addDays(date, 1)) days.push(date);
  return days;
}

/** 要対応の訪問も組み直すなら days の日ごとの帯の種類の訪問、組み直さないなら空 */
const issuesIn = (data: DemoData, days: readonly string[]): IssueIds =>
  rearrangesIssues(data) ? bandIssueIds(data, days) : new Map();

/**
 * 保存で変わった日：range の日（今日より前は除く）のうち、その日の訪問（visitsOn。保存した回と計算した回）か、その日の問題の入力
 * （欠勤・稼働時間・〈利用者さん〉の休み）が before と after で違う日
 */
export function changedDays(before: DemoData, after: DemoData, today: string, range: DateRange): string[] {
  return rangeDays(today, range).filter((date) => {
    const a = visitsOn(before, date);
    const b = visitsOn(after, date);
    if (a.length !== b.length || a.some((v, k) => v !== b[k])) return true;
    return dayInputsOf(before, date).day !== dayInputsOf(after, date).day;
  });
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
  return collect(after, today, rangeDays(today, range), (v) => {
    const b = findVisit(before, v.id);
    return !b || b.date !== v.date || b.earliestStart !== v.earliestStart || b.latestStart !== v.latestStart;
  });
}

/**
 * 要対応の帯の［要対応を組む］・デモの開始の組み（PRD D403・D409）：range の担当なし・ピンなし・伝えていない・今日以降の訪問すべてと、
 * エキスパート機能が切なら、帯の種類（間に合わない・重なり・休みの人）に当たる組み直してよい訪問（isMovable）。休み・利用中でない人の訪問は除く
 */
export function bandTargets(data: DemoData, today: string, range: DateRange): AutoTarget[] {
  const days = rangeDays(today, range);
  return collect(data, today, days, () => true, issuesIn(data, days));
}

/**
 * 保存のあとの自動の組みに足す対象（PRD D405。ADR-0089）：エキスパート機能が切なら、days（その保存で変わった日。changedDays）の
 * 帯の種類（間に合わない・重なり・休みの人）に当たる組み直してよい担当のある訪問（isMovable）。前からある担当なしは入れない
 * （拾うのは要対応の帯の［要対応を組む］。PRD D407）。変わっていない日の直せない要対応で、保存のたびに組みを走らせない
 */
export function issueTargets(data: DemoData, today: string, days: readonly string[]): AutoTarget[] {
  const from = days.filter((d) => d >= today);
  return collect(data, today, from, (v) => v.staffId !== null, issuesIn(data, from));
}

/** 2つの対象を日ごとにまとめる（同じ訪問は1つ。日付の順） */
export function mergeTargets(a: readonly AutoTarget[], b: readonly AutoTarget[]): AutoTarget[] {
  const byDate = new Map<string, string[]>();
  for (const t of [...a, ...b]) {
    const ids = byDate.get(t.date) ?? [];
    for (const id of t.ids) if (!ids.includes(id)) ids.push(id);
    byDate.set(t.date, ids);
  }
  return [...byDate].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([date, ids]) => ({ date, ids }));
}

/**
 * targets のうち、今のデータでも組める（担当なし・ピンなし・取り消しでない・伝えていない・今日以降。切なら組み直してよい担当のある訪問も）訪問だけに絞る。
 * 担当のある訪問が今も帯の種類に当たるかは、組むとき（autoDayPlan）に確かめる
 */
export function stillTargets(data: TargetData, targets: readonly AutoTarget[], today: string): AutoTarget[] {
  const out: AutoTarget[] = [];
  for (const t of targets) {
    const want = new Set(t.ids);
    const ids = activeDayVisits(data, t.date)
      .filter((v) => want.has(v.id) && (isFree(data, v, today) || isMovable(data, v, today)))
      .map((v) => v.id);
    if (ids.length > 0) out.push({ date: t.date, ids });
  }
  return out;
}

/** 対象の訪問の件数（「担当なしの訪問を組む N件」） */
export const targetCount = (targets: readonly AutoTarget[]): number => targets.reduce((n, t) => n + t.ids.length, 0);

/** 1日の問題（組み始めたときの訪問・解く問題・問題に入った対象の ID） */
export type AutoDayPlan = { visits: Visit[]; problem: Problem; targetIds: string[] };

/**
 * 自動の組みの1日の問題。対象は targetIds のうち今も組める（担当なし・ピンなし・取り消しでない）訪問と、エキスパート機能が切なら
 * 今も帯の種類（間に合わない・重なり・休みの人）に当たる組み直してよい訪問（isMovable。担当を外して自由に組む。ADR-0089）。それ以外は動かさない：
 * - 担当のある訪問は、手でも AI でも標準でも、すべてピン（担当を固定して問題に入れる）
 * - 対象でない担当なしの訪問は、組まないので問題から外す（取り消しと同じに扱う）。組めばその人の枠を先に取ってしまい、
 *   対象が入らなくなる。外した訪問は担当なしのまま残り、あとで手で選ぶ
 * - 担当が休止中（問題にいない人）の訪問も、動かせないので問題から外す。担当が休み・条件に合わない訪問は、ピンで担当を固定したまま
 *   解けない（担当なし扱い）が、書くのは対象の訪問だけなので担当は変わらない
 * 点数の基準は今のデータの条件（dayProblemOf と同じ）。
 * 伝えた日・対象が無い日・問題が作れない日（担当がいない・計算できない）は null
 */
export function autoDayPlan(data: DemoData, date: string, targetIds: readonly string[]): AutoDayPlan | null {
  if (skipsToldDays(data) && own(data.snapshots, date)) return null;
  const visits = visitsOn(data, date);
  const want = new Set(targetIds);
  const issues = issuesIn(data, [date]).get(date) ?? NO_IDS;
  const targets = visits.filter((v) => want.has(v.id) && isTarget(data, v, date, issues));
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
  return ids.length > 0 ? { visits, problem: holdFixed(problem, visits, free), targetIds: ids } : null;
}

/** 担当のある訪問を落とさない・動かさない重さ（Problem.stay の担当が変わった1件・開始がずれた1分の点） */
const HOLD_MOVE_POINTS = 1000;
const HOLD_MINUTE_POINTS = 1;

/**
 * 担当のある訪問（free でない）をそのまま保つ問題にする。pins は担当だけを固めるので、solver が列の中で並べ直したり落としたりして
 * 開始が動くことがある。そこで、開始が決まっている訪問は開始（早）＝開始（遅）＝今の開始に固め、Problem.stay で落とさない（keep）・
 * 担当・開始を変えない重い減点を付ける。開始が無い訪問は窓のまま、担当だけ保つ
 */
function holdFixed(problem: Problem, visits: readonly Visit[], free: ReadonlySet<string>): Problem {
  const byId = new Map(visits.map((v) => [v.id, v]));
  const staffAt = new Map(problem.staff.map((s, i) => [s.id, i]));
  const stay: ProblemStay = {
    staff: [],
    start: [],
    keep: [],
    movePoints: HOLD_MOVE_POINTS,
    minutePoints: HOLD_MINUTE_POINTS,
  };
  const list = problem.visits.map((pv) => {
    const v = byId.get(pv.id);
    const held = !!v && !free.has(v.id) && v.staffId !== null;
    const start = held && v.start !== null ? hhmmToMinutes(v.start) : null;
    stay.staff.push(held ? (staffAt.get(v.staffId as string) ?? null) : null);
    stay.start.push(start);
    stay.keep.push(held);
    return start === null ? pv : { ...pv, earliest: start, latest: start };
  });
  return { ...problem, visits: list, stay };
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
  /** 繰り返しの保存から来た（繰り返しの担当を書く。D376）。単発・要対応の帯の［要対応を組む］は false */
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

/**
 * 1人の列を確かめる：col（訪問の並び。早い順）を lenient で数え直し、遅れ（時間の違反）が無く、固めた訪問（fixed。担当のある訪問と、
 * 書かずに元へ戻す訪問）がすべて開始が保存した開始のままのときだけ、各訪問の開始（分）を返す。満たさなければ null
 */
function checkColumn(
  problem: Problem,
  si: number,
  col: readonly string[],
  index: ReadonlyMap<string, number>,
  fixed: ReadonlyMap<string, Visit>,
): Map<string, number> | null {
  const timing = scheduleRoute(
    problem,
    si,
    col.map((id) => index.get(id)!),
    'lenient',
  );
  if (!timing || timing.violations.length > 0) return null;
  const at = new Map(timing.stops.map((x) => [x.visitId, x.start]));
  for (const v of fixed.values()) {
    const start = at.get(v.id);
    if (start === undefined || (v.start !== null && Math.round(start) !== hhmmToMinutes(v.start))) return null;
  }
  return at;
}

/** 書かずに元の担当・開始へ戻す対象を、その開始（無ければ開始（早））で固めた問題（列の確かめに入れる） */
function pinBack(problem: Problem, back: readonly Visit[], index: ReadonlyMap<string, number>): Problem {
  if (back.length === 0) return problem;
  const list = [...problem.visits];
  for (const v of back) {
    const j = index.get(v.id)!;
    if (v.start !== null) list[j] = { ...list[j]!, earliest: hhmmToMinutes(v.start), latest: hhmmToMinutes(v.start) };
  }
  return { ...problem, visits: list };
}

/**
 * その日の解いた担当・開始（対象の訪問だけ。訪問ID → 担当・開始）。対象が入った担当ごとに、その担当への対象を書くかを決める：
 * 解いた列に、書かずに元の担当・開始へ戻す担当ありの対象（ほかの担当で書けなかった要対応の訪問）のうちその担当のものを開始の順に入れて
 * lenient で数え直し、その担当の既存の訪問（担当のある訪問）と戻した訪問がすべて保存した開始のままで、遅れ（時間の違反）も無いときだけ書く。
 * 満たさない担当への書き込みをやめると、その担当の列にあった担当ありの対象が元の担当へ戻るので、変わらなくなるまで繰り返す
 * （書く担当は減る一方なので必ず止まる）。書かない対象は、担当なしは担当なしのまま、要対応の担当のある訪問は元の担当・開始のまま
 * （ほかの担当の訪問の開始・並びを崩さない）。書いた列は遅れが無いので組み直した要対応は減り、減らない訪問は元のまま（ADR-0089）
 */
function solvedOf(day: AutoDay): Solved {
  const out: Solved = new Map();
  const problem = day.problem;
  if (!problem) return out;
  const target = new Set(day.targetIds);
  const index = new Map(problem.visits.map((v, j) => [v.id, j]));
  const columns = new Map<string, string[]>();
  for (const st of problem.staff) {
    const column = (day.routes[st.id] ?? []).filter((id) => index.has(id));
    if (column.some((id) => target.has(id))) columns.set(st.id, column);
  }
  /** 書く担当（初めは対象が入った担当すべて。確かめで落ちた担当を外していく） */
  const writing = new Set(columns.keys());
  let starts = new Map<string, Map<string, number>>();
  for (let changed = true; changed; ) {
    changed = false;
    const written = new Set<string>();
    for (const sid of writing) for (const id of columns.get(sid)!) if (target.has(id)) written.add(id);
    // 書かない担当ありの対象は元の担当・開始へ戻る
    const back = day.visits.filter(
      (v) => target.has(v.id) && !written.has(v.id) && v.staffId !== null && index.has(v.id),
    );
    const checked = pinBack(problem, back, index);
    starts = new Map();
    for (const sid of [...writing]) {
      const si = problem.staff.findIndex((s) => s.id === sid);
      const column = columns.get(sid)!;
      const mine = back.filter((v) => v.staffId === sid);
      const fixed = new Map<string, Visit>();
      for (const v of day.visits)
        if (v.staffId === sid && index.has(v.id) && (!target.has(v.id) || mine.includes(v))) fixed.set(v.id, v);
      const at = checkColumn(checked, si, withBack(checked, si, column, index, mine), index, fixed);
      if (at) starts.set(sid, at);
      else {
        writing.delete(sid);
        changed = true;
      }
    }
  }
  for (const sid of writing) {
    const at = starts.get(sid)!;
    for (const id of columns.get(sid)!)
      if (target.has(id)) out.set(id, { staffId: sid, start: clockOf(at.get(id) ?? 0) });
  }
  return out;
}

/**
 * 解いた列（column）に、戻した訪問（mine）を保存した開始（無ければ開始（早））の順に入れた並び。列の訪問の開始は lenient で数えた開始
 * （遅れがあっても並べるのに使うだけ。遅れは checkColumn が見る）
 */
function withBack(
  problem: Problem,
  si: number,
  column: readonly string[],
  index: ReadonlyMap<string, number>,
  mine: readonly Visit[],
): string[] {
  if (mine.length === 0) return [...column];
  const timing = scheduleRoute(
    problem,
    si,
    column.map((id) => index.get(id)!),
    'lenient',
  );
  const at = new Map(timing?.stops.map((x) => [x.visitId, x.start]) ?? []);
  const list = column.map((id) => ({ id, t: at.get(id) ?? 0 }));
  for (const v of mine) list.push({ id: v.id, t: hhmmToMinutes(v.start ?? v.earliestStart) });
  return list.sort((x, y) => x.t - y.t).map((x) => x.id);
}

/**
 * 安全柵：その日の解いた担当・開始（here）を書くと、帯の種類の訪問（lib/bandIssues の dayBandIssues）の数が減るときだけそのまま返し、
 * 減らない日は書かない（空）。列の確かめ（solvedOf）をすり抜けて要対応を増やす・減らさない書き込みを残さない（ADR-0089）
 */
function keepIfFewer(data: DemoData, day: AutoDay, here: Solved): Solved {
  if (here.size === 0) return here;
  const put: Visit[] = [];
  for (const v of visitsOn(data, day.date)) {
    const to = here.get(v.id);
    if (to) put.push({ ...v, staffId: to.staffId, start: to.start, pinned: false });
  }
  const after = { ...data, visits: putVisits(data.visits, put) };
  return dayBandIssues(after, day.date).size < dayBandIssues(data, day.date).size ? here : new Map();
}

/**
 * 自動の組みを反映する（純粋関数。PRD D405）：組み始めたときのままの日（proposalDayFresh）だけ、対象の訪問の担当・開始を書く。
 * ピンなどほかの訪問は変えない。組めなかった対象は担当なしのまま（要対応の担当のある訪問は元の担当のまま）。
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
    if (!proposalDayFresh(data, day, { allowTold: !skipsToldDays(data) })) {
      skippedDays.push(day.date);
      continue;
    }
    appliedDays.push(day.date);
    solved.set(day.date, keepIfFewer(data, day, solvedOf(day)));
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
  /** 今回担当を書いた対象（書いた担当が計算した回と同じで put に入らなくても、残すループで担当なしに戻さない） */
  const wrote = new Set<string>();
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
      wrote.add(v.id);
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
        if (v.pattern?.id !== patternId || put.has(v.id) || wrote.has(v.id)) continue;
        const was = findVisit(data, v.id);
        if (was && (was.staffId !== v.staffId || was.start !== v.start)) put.set(v.id, was);
      }
    }
  }
  const out = put.size > 0 ? { ...withUsual, visits: putVisits(withUsual.visits, [...put.values()]) } : withUsual;
  return { data: out, written, appliedDays, skippedDays };
}
