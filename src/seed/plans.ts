// 起動したときの初期データ（PRD D322。ADR-0053・ADR-0064）と、AI で組んだ日のあるデータを作る部品（テストで使う）。
// 初期データの今日からの日は AI で組まない（繰り返しの担当のまま）。AI で組むのは「担当を組む」で（標準が無い間は考え方ごとの案。ADR-0064）。
// withSeedPlans は点数の基準の重みで1日ずつ AI で組み、担当・開始を訪問に書く（同じ日付なら同じデータ。Date.now を使わない）
import type { DemoData } from '../contracts/data';
import type { Features } from '../contracts/features';
import { addDays } from '../domain/time';
import { dayProblemOf, writeRoutes } from '../lib/dayPlan';
import { visitsOn } from '../patterns';
import { defaultIterations, solve } from '../solver';
import { createDemoData, seedPatternStart } from './index';

/** 担当を入れる日数（今日から） */
export const SEED_PLAN_DAYS = 7;

/**
 * 初期の担当の反復回数の上限。画面の既定（defaultIterations：約2秒）より少なくし、起動を待たせない
 * （8人・約17件の日で 1日 約40ms。点数は既定の反復と1点以内）
 */
export const SEED_ITERATIONS = 100_000;

/**
 * today から days 日分、AI で組んで担当・開始を訪問に書く。作れない日（問題を作れない・訪問や働ける人が無い）は飛ばす
 * （起動を止めない）。元のデータは書き換えない。条件の重みは点数の基準（data.rules は基準にそろっている）
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

/**
 * 起動したときの初期データ：seed の人・決まり・繰り返し（createDemoData）に、過去の日を伝えた状態にしたもの。
 * 今日からの日は繰り返しの担当のまま（AI で組まない。ADR-0064）。features は機能の入り切り（既定はすべて入の {}）
 */
export function createInitialData(today: string, features: Features = {}): DemoData {
  const d = createDemoData(today);
  return withPastTold({ ...d, org: { ...d.org, features } }, today);
}

/**
 * 繰り返しの開始日（前の月の1日）から昨日までを「伝えた」状態にする（過去の予定は済んだもの。月の予定で混み具合を見られる）。
 * 担当は繰り返しの担当（重ならない人を選んである）のまま、伝えた内容に今の担当を写す（開始は書かない＝時刻の違いを数えない）。
 * 確定した時刻はその日の18:00（日本時間）。計算しないので起動を待たせない
 */
export function withPastTold(data: DemoData, today: string): DemoData {
  const snapshots = { ...data.snapshots };
  for (let date = seedPatternStart(today); date < today; date = addDays(date, 1)) {
    const visits = visitsOn(data, date).filter((v) => !v.cancelled);
    if (visits.length === 0) continue;
    snapshots[date] = {
      date,
      at: Date.parse(`${date}T18:00:00+09:00`),
      visits: visits.map((v) => ({ id: v.id, clientId: v.clientId, staffId: v.staffId, start: null })),
    };
  }
  return { ...data, snapshots };
}
