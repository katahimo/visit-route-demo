// 焼きなまし（ADR-0003）。ClassClassify の anneal.ts の構成：貪欲な初期解（素朴な案の方が良ければそれ）・差分評価・
// 初期温度を改悪幅の中央値から・指数冷却・最後に貪欲な仕上げ。止めるのは反復回数（時刻は使わない）
// 状態は annealState、近傍は annealMoves、初期解・初期温度・受理判定・仕上げ・結果は annealPhases にある
import type { Problem, SolveOptions, SolveResult, Solver } from '../contracts/problem';
import { EPS } from '../matching/timing';
import { randomMove } from './annealMoves';
import { accepts, buildInitial, coolingRate, initialTemperature, polish, resultOf } from './annealPhases';
import { copyRoutes, createAnnealState } from './annealState';

/** seed 付きの乱数（mulberry32）。[0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSolver(problem: Problem, options: SolveOptions): Solver {
  const st = createAnnealState(problem, mulberry32(options.seed));
  const total = Math.max(0, Math.floor(options.iterations));
  const { S, V } = st;
  buildInitial(st, options.initial);

  const T0 = initialTemperature(st);
  const alpha = coolingRate(T0, total);
  let T = T0;

  let bestTotal = st.current;
  let bestRoutes = copyRoutes(st);
  let iter = 0;
  let finished = false;

  /** end 回目まで焼きなます（反復ごとに冷やし、近傍を1つ作って受理判定し、最良を覚える） */
  const anneal = (end: number) => {
    while (iter < end) {
      iter++;
      T *= alpha;
      const m = randomMove(st);
      if (!m) continue;
      if (accepts(st, m.d, T)) {
        m.apply();
        st.current += m.d;
        if (st.current < bestTotal - EPS) {
          bestTotal = st.current;
          bestRoutes = copyRoutes(st);
        }
      }
    }
  };

  const step = (n: number): boolean => {
    if (finished) return true;
    const end = Math.min(total, iter + Math.max(1, Math.floor(n)));
    if (V > 0 && S > 0) anneal(end);
    else iter = total;
    if (iter >= total) {
      polish(st, bestRoutes);
      bestRoutes = copyRoutes(st);
      bestTotal = st.current;
      finished = true;
    }
    return finished;
  };

  const best = (): SolveResult => resultOf(problem, bestRoutes, options.seed, iter, !finished);

  return { step, iteration: () => iter, bestScore: () => bestTotal, best };
}

/** Worker なしで最後まで解く */
export function solve(problem: Problem, options: SolveOptions): SolveResult {
  const s = createSolver(problem, options);
  while (!s.step(10000));
  return s.best();
}
