// 日の予定の計算（Worker。欠勤の振り直しの案B）：始める・止める・進み具合・画面を離れたら止める（PRD D249）
import { useEffect, useRef, useState } from 'react';
import type { Problem, ScoreScale, SolveResult } from '../contracts/problem';
import { attempt, formError } from '../lib/common';
import { pointsOf } from '../lib/dayPlan';
import { createValueStore, type ReadableStore } from '../lib/valueStore';
import { defaultIterations, runSolve } from '../solver';

/**
 * hundred：いまの最良を点数の基準の物差しで点数（100点満点）にした値（物差しを作れなければ null）。
 * 最良が変わらず Worker が bestRoutes を送らなかった進捗では、前の値のまま
 */
export type PlanProgress = { iteration: number; total: number; hundred: number | null };

/** 計算の種類（日の予定では欠勤の振り直しの案B だけ） */
type RunKind = 'anneal';

export type PlanRun = {
  /** 計算中の種類（していなければ null） */
  running: RunKind | null;
  /** 計算している日と条件の名前（「組んでいます」の表示） */
  runningFor: { date: string; label: string } | null;
  /** 計算の進み具合（100msごとに変わる。読む子の部品だけを描き直す。PRD D249） */
  progressStore: ReadableStore<PlanProgress | null>;
  /** 計算を始める（始められなければ false。エラーは onError へ） */
  run: (
    kind: RunKind,
    target: Problem,
    label: string,
    onDone: (r: SolveResult) => void,
    initial?: Record<string, string[]>,
  ) => boolean;
  /** 計算を止める（途中までの結果は onDone へ） */
  stop: () => void;
  /** いま Worker が動いているか（描き直しを待たずに見る） */
  busy: () => boolean;
};

/**
 * 計算の状態（Worker）。date・seed・点数の物差しは始めたときのもの。途中の最良は、解いている条件にかかわらず
 * 点数の基準の物差しで点数にする（ADR-0010）。画面を離れると世代を進め、前の世代の計算の結果は捨てる
 * （開発時の StrictMode の付け外しでも）
 */
export function usePlanRun(x: {
  date: string;
  seed: number;
  scoreProblem: Problem | null;
  scoreScale: ScoreScale | null;
  onError: (message: string | null) => void;
}): PlanRun {
  /**
   * 計算の進み具合（100msごとに変わる）。画面の state に置くと画面全体を描き直すので、外の入れ物に置き、
   * 読む子の部品（PlanProgressText・AnnealBox の進み具合）だけを描き直す（PRD D249）
   */
  const [progressStore] = useState(() => createValueStore<PlanProgress | null>(null));
  const [running, setRunning] = useState<RunKind | null>(null);
  const [runningFor, setRunningFor] = useState<{ date: string; label: string } | null>(null);
  const runRef = useRef<{ stop(): void } | null>(null);
  const generation = useRef(0);
  /** いちばん新しい点数の物差し（計算中の「いまの最良 N点」を基準の物差しで付け直す。ADR-0010） */
  const scoreRef = useRef({ problem: x.scoreProblem, scale: x.scoreScale });
  scoreRef.current = { problem: x.scoreProblem, scale: x.scoreScale };
  /** いちばん新しいデータの seed（計算を始めるときに読む） */
  const seedRef = useRef(x.seed);
  seedRef.current = x.seed;

  // 画面を離れたら Worker を止める（止めた結果は保存しない）
  useEffect(() => {
    setRunning(null);
    setRunningFor(null);
    progressStore.set(null);
    return () => {
      generation.current++;
      runRef.current?.stop();
      runRef.current = null;
    };
    // progressStore は作り直さない（一度だけ）
  }, [progressStore]);

  const run: PlanRun['run'] = (kind, target, label, onDone, initial) => {
    const gen = generation.current;
    const live = () => gen === generation.current;
    const started = attempt(() =>
      runSolve(
        target,
        { seed: seedRef.current, iterations: defaultIterations(target), ...(initial ? { initial } : {}) },
        (p) => {
          if (!live()) return;
          const { problem: sp, scale: ss } = scoreRef.current;
          const best = p.bestRoutes;
          if (!best) {
            progressStore.set((prev) => ({ iteration: p.iteration, total: p.total, hundred: prev?.hundred ?? null }));
            return;
          }
          const hundred = pointsOf(sp, ss, best);
          progressStore.set({ iteration: p.iteration, total: p.total, hundred });
        },
      ),
    );
    if (!started.value) {
      x.onError(started.error);
      return false;
    }
    runRef.current = started.value;
    setRunning(kind);
    setRunningFor({ date: x.date, label });
    progressStore.set(null);
    started.value.promise
      .then((result) => {
        if (live()) onDone(result);
      })
      .catch((e) => {
        if (live()) x.onError(`担当を組めませんでした（${formError(e)}）`);
      })
      .finally(() => {
        if (!live()) return;
        runRef.current = null;
        setRunning(null);
        setRunningFor(null);
        progressStore.set(null);
      });
    return true;
  };
  return {
    running,
    runningFor,
    progressStore,
    run,
    stop: () => runRef.current?.stop(),
    busy: () => runRef.current !== null,
  };
}
