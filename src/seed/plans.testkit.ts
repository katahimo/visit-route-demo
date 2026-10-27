// AI で組んだ日のあるデータを作る部品（テストで使う。本番の初期データは AI で組まない。ADR-0064）。
// 点数の基準の重みで1日ずつ AI で組み、担当・開始を訪問に書く（同じ日付なら同じデータ。Date.now を使わない）
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';
import { dayProblemOf, writeRoutes } from '../lib/dayPlan';
import { defaultIterations, solve } from '../solver';

/** 担当を入れる日数（今日から） */
export const SEED_PLAN_DAYS = 7;

/**
 * 反復回数の上限。画面の既定（defaultIterations：約2秒）より少なくし、テストを待たせない
 * （8人・約17件の日で 1日 約40ms。点数は既定の反復と1点以内）
 */
const SEED_ITERATIONS = 100_000;

/**
 * today から days 日分、AI で組んで担当・開始を訪問に書く。作れない日（問題を作れない・訪問や働ける人が無い）は飛ばす。
 * 元のデータは書き換えない。条件の重みは点数の基準（data.rules は基準にそろっている）
 */
export function withSeedPlans(data: DemoData, today: string, days: number = SEED_PLAN_DAYS): DemoData {
  let out = data;
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const p = dayProblemOf(out, date);
    if (!p || p.visits.length === 0 || p.staff.length === 0) continue;
    const iterations = Math.min(defaultIterations(p), SEED_ITERATIONS);
    const result = solve(p, { seed: out.seed, iterations });
    out = writeRoutes(out, date, p, result.routes, { pins: {} });
  }
  return out;
}
