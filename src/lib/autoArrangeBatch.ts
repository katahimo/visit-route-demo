// 自動の組み（lib/autoArrange。ADR-0072 第2段）を回す入れ物：欄の保存・ホームの［組む］の依頼を順に待たせ（キュー）、
// 1つの依頼＝範囲の日を Worker で1日ずつ解き、終わったら store の update 1回（1手）で担当を書く。
// 画面は依頼を出すだけで、計算はモジュールの入れ物で続ける（ほかの画面へ移っても止めない）。提案は出さず即反映する（元に戻すは全体の履歴）。
//
// monthBatch（担当を組む）との同時実行：どちらも Worker を1回ごとに作るので同時に解いてよい。書く日が重なっても、monthBatch の提案は
// 反映のときに proposalDayFresh で「組み始めたときのまま」でなければ飛ばされ、こちらも同じ判定で飛ばすので、同じ日に二重には書かない
import type { DemoData } from '../contracts/data';
import type { Problem, SolveOptions, SolveResult } from '../contracts/problem';
import { visitsOn } from '../patterns';
import { runSolve } from '../solver';
import {
  type AutoApplied,
  type AutoDay,
  type AutoTarget,
  applyAutoArrange,
  autoDayPlan,
  autoRange,
  autoSolveOptions,
  autoTargets,
  stillTargets,
  targetCount,
  unassignedTargets,
} from './autoArrange';
import { type BatchHost, dayInputsOf } from './monthBatch';
import { settleDates } from './settled';
import { createValueStore, type ReadableStore } from './valueStore';

/** 全体の履歴（元に戻す）に出る手の名前 */
export const AUTO_ARRANGE_LABEL = '自動で組む';

/** 依頼 */
export type AutoJob = {
  /** 日ごとの組む訪問（autoTargets・unassignedTargets） */
  targets: readonly AutoTarget[];
  /** 繰り返しの保存から来た（繰り返しの担当を書く。D376） */
  writeUsual: boolean;
  /** 組む範囲の終わり（autoRange の to。繰り返しの担当を書くとき、これ以前の書かなかった回は書く前のまま残す） */
  rangeTo: string;
  /**
   * 依頼を出した操作の前のデータと、保存で計算した次のデータ。保存の直後は画面が描き直されるまで store の data が古い（since のまま）ので、
   * そのあいだは after を読む（保存は update((d) => d === since ? after : …) で、描かれたデータは after と同じ参照）。
   * 無ければ（ホームの［組む］）store の data を読む
   */
  since: DemoData | null;
  after: DemoData | null;
  /** 今日（飛ばした日の対象を組み直すときの条件に使う） */
  today: string;
  /** 飛ばした日を組み直す依頼（組み直しは1回まで。繰り返しの担当は書かない） */
  retry?: true;
};

/** 進み具合：いまの依頼の何日目/何日と、待っている依頼の数 */
export type AutoRun = { index: number; total: number; waiting: number };

/** 終わった知らせ（終わるたびに新しい物。画面はこれを見てトーストを出す） */
export type AutoDone = {
  /** 担当が付いた対象の数 */
  written: number;
  /** 書いた日・飛ばした日（組んでいる間にその日が変わった） */
  appliedDays: number;
  skippedDays: number;
  /** 計算できずに止まった理由（無ければ null） */
  error: string | null;
};

type Solve = (
  problem: Problem,
  options: SolveOptions,
  onProgress?: (p: { iteration: number; total: number }) => void,
) => { promise: Promise<SolveResult>; stop(): void };

export type AutoArrange = {
  run: ReadableStore<AutoRun | null>;
  done: ReadableStore<AutoDone | null>;
  /** 依頼する（計算中なら待たせて、今のを終えて書いたあとに組む）。つながっていない・対象が無いときは false */
  request(job: AutoJob): boolean;
  /** 計算中か（待たせている依頼も含む） */
  running(): boolean;
  /** すぐ捨てる（データを丸ごと差し替えたとき。待たせている依頼ごと。結果は書かない） */
  abort(): void;
  /** データの持ち主をつなぐ。外すと（ページを閉じる）捨てる */
  connect(host: BatchHost): () => void;
};

/** 終わった知らせの文（呼び方は terms から） */
export function autoDoneText(d: AutoDone, staffTerm: string): string {
  const skipped = d.skippedDays > 0 ? '（組んでいる間に変わった日は組んでいません）' : '';
  if (d.error)
    return `自動で組めませんでした（${d.error}）${d.written > 0 ? `。${d.written}件の担当は組みました` : ''}`;
  if (d.written === 0) return `組める${staffTerm}がいませんでした。担当なしのまま${skipped}`;
  return `${d.written}件の担当を組みました${skipped}`;
}

/** 進み具合の帯の文（「担当を自動で組んでいます 3/10日」。待っている依頼があれば添える） */
export function autoBandText(r: AutoRun): string {
  const wait = r.waiting > 0 ? `（あと${r.waiting}件待ち）` : '';
  return `担当を自動で組んでいます ${Math.min(r.index + 1, r.total)}/${r.total}日${wait}`;
}

/** 計算が読むデータ：保存の直後でまだ描かれていなければ after、描かれていれば store の data */
function read(h: BatchHost, job: AutoJob): DemoData {
  const now = h.get();
  return job.after !== null && now === job.since ? job.after : now;
}
/** 元に戻された（組んでいる途中で store が保存の前のデータへ戻った）か。after を読むのは最初の1日（まだ描かれていない間）だけ */
const undone = (h: BatchHost, job: AutoJob): boolean => job.since !== null && h.get() === job.since;

/** 飛ばした日の組み直しの依頼（今のデータで条件を見直す。1回まで・繰り返しの担当は書かない）。組む対象が無ければ null */
function retryOf(job: AutoJob, skipped: readonly string[], now: DemoData): AutoJob | null {
  if (job.retry || skipped.length === 0) return null;
  const again = stillTargets(
    now,
    job.targets.filter((t) => skipped.includes(t.date)),
    job.today,
  );
  return again.length > 0 ? { ...job, targets: again, writeUsual: false, since: null, after: null, retry: true } : null;
}

/** 入れ物を作る（solve は差し替えられる。テストは Worker なしで解く） */
export function createAutoArrange(solve: Solve = runSolve): AutoArrange {
  const run = createValueStore<AutoRun | null>(null);
  const done = createValueStore<AutoDone | null>(null);
  let host: BatchHost | null = null;
  /** 世代。捨てる（abort・外す）と進め、前の世代の計算の結果は捨てる */
  let generation = 0;
  let queue: AutoJob[] = [];
  let working = false;
  let current: { stop(): void } | null = null;
  /** 直前の依頼が書いたか（次の依頼は書いた結果が描かれてから読む） */
  let wrote = false;

  /** 1日解く（計算した結果を返す。捨てられたら null） */
  const solveDay = async (problem: Problem, options: SolveOptions, live: () => boolean) => {
    const s = solve(problem, options);
    current = s;
    try {
      const result = await s.promise;
      return live() ? result : null;
    } finally {
      if (current === s) current = null;
    }
  };

  /** 1つの依頼を組んで書く（捨てられたら null） */
  const runJob = async (job: AutoJob, live: () => boolean): Promise<AutoDone | null> => {
    const h = host;
    if (!h) return null;
    // 前の依頼を書いた直後は、書いた結果が描かれるのを1回待つ（次の依頼は前の依頼の結果の上に組む）
    if (wrote) {
      wrote = false;
      await new Promise((r) => setTimeout(r, 0));
    }
    const days: AutoDay[] = [];
    let error: string | null = null;
    for (let i = 0; i < job.targets.length && live(); i++) {
      const t = job.targets[i]!;
      run.set({ index: i, total: job.targets.length, waiting: queue.length });
      if (i > 0 && undone(h, job)) return null;
      const latest = read(h, job);
      const plan = autoDayPlan(latest, t.date, t.ids);
      const base = {
        date: t.date,
        visits: visitsOn(latest, t.date),
        inputs: dayInputsOf(latest, t.date),
        targetIds: t.ids,
      };
      if (!plan) {
        days.push({ ...base, problem: null, routes: {} });
        continue;
      }
      try {
        const result = await solveDay(plan.problem, autoSolveOptions(latest, plan), live);
        if (!result) return null;
        days.push({
          ...base,
          visits: plan.visits,
          problem: plan.problem,
          routes: result.routes,
          targetIds: plan.targetIds,
        });
      } catch (e) {
        if (!live()) return null;
        error = e instanceof Error ? e.message : '担当を組めませんでした';
        break;
      }
    }
    if (!live()) return null;
    // 組んでいる間に元に戻されたら書かずに捨てる（知らせも出さない）
    if (undone(h, job)) return null;
    const now = h.get();
    const opts = { writeUsual: job.writeUsual, rangeTo: job.rangeTo };
    const r: AutoApplied = applyAutoArrange(now, days, opts);
    // 仕事が終わったら、反映した・何も書かなかったに関わらず、対象の日を決まった扱いにする（expert 切。待っていた日を終わらせる。ADR-0073）
    const dates = job.targets.map((t) => t.date);
    const settle = (d: DemoData) => settleDates(d, dates, job.today);
    if (r.data !== now || settle(r.data) !== r.data) {
      wrote = true;
      // 書くときの今のデータで、組み始めたときのままの日だけをもう一度確かめて書く（1手。決まった扱いにする記録も同じ手）
      h.update((d) => settle(applyAutoArrange(d, days, opts).data), AUTO_ARRANGE_LABEL);
    }
    // 計算中にほかの変更が入って飛ばした日は、あと1回だけ組み直す
    const again = retryOf(job, r.skippedDays, now);
    if (again) queue.push(again);
    return { written: r.written, appliedDays: r.appliedDays.length, skippedDays: r.skippedDays.length, error };
  };

  /** キューを順に回す（1つずつ。今のを書き終えてから次を組む） */
  const pump = async () => {
    working = true;
    const gen = generation;
    const live = () => gen === generation && host !== null;
    while (queue.length > 0 && live()) {
      const job = queue.shift()!;
      const result = await runJob(job, live);
      if (!live()) return;
      if (result) done.set(result);
    }
    if (gen === generation) {
      working = false;
      run.set(null);
    }
  };

  const drop = () => {
    generation++;
    queue = [];
    working = false;
    wrote = false;
    current?.stop();
    current = null;
    run.set(null);
  };

  return {
    run,
    done,
    request: (job) => {
      if (host === null || targetCount(job.targets) === 0) return false;
      queue.push(job);
      if (working) run.set((r) => (r ? { ...r, waiting: queue.length } : r));
      else {
        // 帯が出るのは最初の1日を組み始めてから（待つ間も計算中として数える）
        run.set({ index: 0, total: job.targets.length, waiting: 0 });
        void pump();
      }
      return true;
    },
    running: () => working,
    abort: drop,
    connect: (h) => {
      host = h;
      return () => {
        if (host !== h) return;
        host = null;
        drop();
      };
    },
  };
}

/** アプリで1つの入れ物 */
export const autoArrange: AutoArrange = createAutoArrange();

/**
 * 保存の前後で増えた・日時が変わった担当なしの訪問を自動で組む依頼を出す（欄の保存。PRD D375）。
 * before・after は保存の前のデータと、保存で計算した次のデータ（store の data を後で読まない。保存は after をそのまま store に入れる）。依頼を出したら true
 */
export function requestAutoArrange(a: {
  before: DemoData;
  after: DemoData;
  today: string;
  writeUsual: boolean;
}): boolean {
  const range = autoRange(a.today);
  const targets = autoTargets(a.before, a.after, a.today, range);
  return autoArrange.request({
    targets,
    writeUsual: a.writeUsual,
    rangeTo: range.to,
    since: a.before,
    after: a.after,
    today: a.today,
  });
}

/** 今の担当なしの訪問（今日〜翌月末）を自動で組む依頼を出す（ホームの［組む］。繰り返しの担当は書かない）。依頼を出したら true */
export function requestUnassignedArrange(data: DemoData, today: string): boolean {
  const range = autoRange(today);
  const targets = unassignedTargets(data, today, range);
  return autoArrange.request({ targets, writeUsual: false, rangeTo: range.to, since: null, after: null, today });
}
