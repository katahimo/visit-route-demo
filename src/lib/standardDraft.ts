// 組み方の標準（PRD D350〜D354。ADR-0063）の、画面の外に置く入れ物と案を作る計算。
// 案（プリセットごとの表と数字）・下書き・作っている途中の進み具合をここに置き、ほかの画面へ移っても残す
// （読み直す・タブを閉じると消える。データには入れない）。案を作る計算も画面を離れても続ける
import type { DemoData } from '../contracts/data';
import type { Problem } from '../contracts/problem';
import { normalize, score, toHundred } from '../evaluate';
import { compile } from '../matching';
import { applyPreset, scoreRulesOf } from '../seed';
import { defaultIterations, runSolve } from '../solver';
import { attempt } from './common';
import {
  hasStandard,
  type ProposalStats,
  periodDates,
  proposalStats,
  type StandardBaseDay,
  type StandardDay,
  type StandardPeriod,
  type StandardTable,
  standardDayRoutes,
  standardDayVisits,
  standardPatterns,
  standardPeriod,
  standardTemplate,
  tableFromDays,
} from './standard';
import { createValueStore } from './valueStore';

/** プリセットごとの案 */
export type StandardProposal = {
  presetId: string;
  /** 作り終えた表（作っている間・作れなかったときは null） */
  table: StandardTable | null;
  stats: ProposalStats | null;
  done: boolean;
  /** 日ごとの割当（日で見るに使う。訪問のある日だけ。問題は日の元 StandardWork.dayBase に日に1つ） */
  days: { date: string; routes: Record<string, string[]> }[];
};

/** 日で見るの選び（日付と案のタブ。null は既定＝最初の日・いちばん点の高い案。tab は案のプリセット ID か 'current'） */
export type StandardDaySelection = { date: string | null; tab: string | null };

/** 組み方の標準の画面の段（予定を組むの 2・3。1 の基本情報と 4 の担当を組むは別の画面。ADR-0067） */
export type StandardStep = 'proposals' | 'register';

/** 下書き（from＝どこから作ったか。案のプリセット ID・今の標準は null） */
export type StandardDraft = { table: StandardTable; from: string | null };

export type StandardWork = {
  /** 案（作り始めたプリセットの分。data.presets の順） */
  proposals: StandardProposal[];
  /** 日で見るの日付と案のタブ */
  dayView: StandardDaySelection;
  /** 日で見るの日の元（案を作ったときのデータで作った問題・訪問・今の標準。日付の順） */
  dayBase: StandardBaseDay[];
  /** 案を作った期間と、そのときの繰り返しの印（繰り返しが変わったら古い印を出す） */
  proposalsOf: { period: StandardPeriod; key: string } | null;
  running: { presetName: string; day: number; days: number } | null;
  error: string | null;
  draft: StandardDraft | null;
  /** 下書きを作ったときの繰り返しの印 */
  draftKey: string | null;
  /** 登録した直後の完了の表示（いつから） */
  /** 登録した「いつから」と登録の時刻（元に戻したら data.standard.at と合わなくなり、完了の表示を出さない） */
  registered: { since: string; at: number } | null;
  /** 今出している段（null は既定。standardStepOf。ADR-0066） */
  step: StandardStep | null;
};

const EMPTY: StandardWork = {
  proposals: [],
  dayView: { date: null, tab: null },
  dayBase: [],
  proposalsOf: null,
  running: null,
  error: null,
  draft: null,
  draftKey: null,
  registered: null,
  step: null,
};

export const standardWork = createValueStore<StandardWork>(EMPTY);

/** 表の行にする繰り返しの印（ID・曜日・担当・標準の開始。これが変わったら案・下書きは古い。ほかの画面で担当を替えたときも） */
export function patternsKey(data: Pick<DemoData, 'patterns' | 'clients'>, today: string): string {
  return standardPatterns(data, today)
    .map(
      (p) =>
        `${p.id}:${p.weekdays.join(',')}:${p.usualStaffId ?? ''}:${(p.usualStarts ?? []).map((x) => `${x.weekday}@${x.start}`).join(',')}`,
    )
    .sort()
    .join('|');
}

/** 下書きを置く（完了の表示は消す） */
export function setDraft(draft: StandardDraft | null, key: string | null): void {
  standardWork.set((w) => ({ ...w, draft, draftKey: draft ? key : null, registered: draft ? null : w.registered }));
}

/** 段を替える（ADR-0066） */
export function setStandardStep(step: StandardStep): void {
  standardWork.set((w) => ({ ...w, step }));
}

/** 今出す段：選んだ段、無ければ 登録した直後か下書きがあれば 標準にする・無ければ 案をくらべる（ADR-0066・ADR-0067） */
export function standardStepOf(w: Pick<StandardWork, 'step' | 'draft' | 'registered'>): StandardStep {
  return w.step ?? (w.registered || w.draft ? 'register' : 'proposals');
}

/** 日で見るの日付・案のタブを替える（渡した方だけ） */
export function setDayView(next: Partial<StandardDaySelection>): void {
  standardWork.set((w) => ({ ...w, dayView: { ...w.dayView, ...next } }));
}

/** 点数の基準の物差しで作ったひな形のその日の問題（案の点・日で見るの点と時間軸。作れなければ null） */
export function templateScoreProblem(data: DemoData, date: string): Problem | null {
  return attempt(() => compile({ ...standardTemplate(data), rules: scoreRulesOf(data) }, date)).value ?? null;
}

/**
 * 日で見るの日の元：点数の基準の物差しの問題 scoreProblem（templateScoreProblem。作れなければ fallback＝案の問題）・
 * ひな形の訪問・今の標準（標準を登録する前は null）
 */
export function standardBaseDay(
  data: DemoData,
  date: string,
  scoreProblem: Problem | null,
  fallback: Problem,
): StandardBaseDay {
  const problem = scoreProblem ?? fallback;
  return {
    date,
    problem,
    visits: standardDayVisits(data, date),
    current: hasStandard(data) ? standardDayRoutes(data, problem) : null,
  };
}

/** 作っている計算（1つだけ） */
let ctl: { stopped: boolean; stop: (() => void) | null } | null = null;

/** 作るのを止める（作り終えた案は残す） */
export function stopProposals(): void {
  if (!ctl) return;
  ctl.stopped = true;
  ctl.stop?.();
}

/**
 * 案・下書き・段・完了の表示を捨てて、作っている計算も止める。データを丸ごと差し替えたとき（読み込み・初期状態に戻す・
 * 直前の状態に戻す・別のタブの変更）に呼ぶ：前のデータの繰り返しで作った表は、新しいデータの今の標準とくらべられない
 * （くらべると違う所が 0 になり、［この表を標準にする］が押せなくなる）
 */
export function clearStandardWork(): void {
  stopProposals();
  standardWork.set(EMPTY);
}

/**
 * プリセットごとに案を作る（data.presets の順）。期間（standardPeriod）の日を1日ずつ、そのプリセットの重みで Worker で解き、
 * 日ごとの割当から標準の表（tableFromDays）とカードの数（点は点数の基準の物差し）を作る。始めたときのデータで作る
 */
export async function runProposals(data: DemoData, today: string): Promise<void> {
  if (ctl) return;
  const me: { stopped: boolean; stop: (() => void) | null } = { stopped: false, stop: null };
  ctl = me;
  const period = standardPeriod(data, today);
  const dates = periodDates(period);
  const base = standardTemplate(data);
  const proposals: StandardProposal[] = data.presets.map((p) => ({
    presetId: p.id,
    table: null,
    stats: null,
    done: false,
    days: [],
  }));
  standardWork.set((w) => ({
    ...w,
    proposals: proposals.map((p) => ({ ...p })),
    dayView: { date: null, tab: null },
    dayBase: [],
    proposalsOf: { period, key: patternsKey(data, today) },
    error: null,
  }));
  /** 日で見るの日の元（日に1つ。案を作ったときのデータで） */
  const dayBase = new Map<string, StandardBaseDay>();
  const publish = () =>
    standardWork.set((w) => ({
      ...w,
      proposals: proposals.map((p) => ({ ...p })),
      dayBase: [...dayBase.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    }));
  /** 点数の基準の物差しのひな形の問題（日ごとに1回だけ作る。点と日で見るで同じもの） */
  const scoreProblems = new Map<string, Problem | null>();
  const scoreProblemOf = (date: string): Problem | null => {
    if (!scoreProblems.has(date)) scoreProblems.set(date, templateScoreProblem(data, date));
    return scoreProblems.get(date) ?? null;
  };
  /** 点数の基準の物差しで 100点満点にする */
  const pointsCache = new Map<string, number | null>();
  const toPoints = (day: StandardDay): number | null => {
    const key = `${day.date}|${JSON.stringify(day.routes)}`;
    const hit = pointsCache.get(key);
    if (hit !== undefined) return hit;
    const p = scoreProblemOf(day.date);
    const sc = p ? attempt(() => score(p, day.routes)).value : null;
    const scale = p ? attempt(() => normalize(p)).value : null;
    const out = sc && scale ? toHundred(sc.total, scale) : null;
    pointsCache.set(key, out);
    return out;
  };
  try {
    for (const [pi, preset] of data.presets.entries()) {
      if (me.stopped) break;
      const input = { ...base, rules: applyPreset(base.rules, preset) };
      const days: StandardDay[] = [];
      for (const [i, date] of dates.entries()) {
        if (me.stopped) break;
        standardWork.set((w) => ({ ...w, running: { presetName: preset.name, day: i + 1, days: dates.length } }));
        const p = attempt(() => compile(input, date)).value;
        if (!p || p.visits.length === 0 || p.staff.length === 0) continue;
        const started = runSolve(p, { seed: data.seed, iterations: defaultIterations(p) });
        me.stop = started.stop;
        const res = await started.promise;
        me.stop = null;
        if (me.stopped) break;
        days.push({ date, problem: p, routes: res.routes });
        if (!dayBase.has(date)) dayBase.set(date, standardBaseDay(data, date, scoreProblemOf(date), p));
      }
      if (me.stopped) break;
      const prop = proposals[pi] as StandardProposal;
      prop.table = tableFromDays(data, days, today);
      prop.stats = days.length > 0 ? proposalStats(days, toPoints) : null;
      // 日で見るには割当だけを残す（プリセットごとの問題は持ち続けない）
      prop.days = days.map((d) => ({ date: d.date, routes: d.routes }));
      prop.done = true;
      publish();
    }
  } catch (e) {
    standardWork.set((w) => ({ ...w, error: e instanceof Error ? e.message : '案を作れませんでした' }));
  } finally {
    ctl = null;
    // 止めたときは作り終えていない案を外す
    standardWork.set((w) => ({ ...w, running: null, proposals: w.proposals.filter((p) => p.done) }));
  }
}
