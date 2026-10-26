// 「AI で組む」（lib/monthBatch）の1日分の計算：その日の問題・解いた結果からの提案の1日（純粋関数）
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import type { Problem, SolveResult } from '../contracts/problem';
import type { ReassignDiff } from '../contracts/reassign';
import { visitsOn } from '../patterns';
import { reassignDiff } from '../reassign';
import { own } from './common';
import { aiPinsOf, dayProblemOf, routesOf } from './dayPlan';
import type { DayInputs, ProposalDay } from './monthBatch';

/**
 * 1日分の問題：その日の訪問と、ピンを入れたその日の問題。
 * 確定した日・問題が作れない日・訪問か担当がいない日は null（その日は飛ばす）
 */
export function batchDayProblem(d: DemoData, day: string): { visits: Visit[]; problem: Problem } | null {
  // 組んでいる間に確定した日は飛ばす
  if (own(d.snapshots, day)) return null;
  const visits = visitsOn(d, day);
  // 手で付けたピンと標準のピン（ADR-0062）。条件はデータの条件（点数の基準にそろえた重み。ADR-0065）
  const pins = aiPinsOf(d, day, visits);
  const p = dayProblemOf(d, day, Object.keys(pins).length > 0 ? pins : undefined);
  if (!p || p.visits.length === 0 || p.staff.length === 0) return null;
  return { visits, problem: p };
}

/**
 * 解いた結果から提案の1日を作る。planned は batchDayProblem の結果、inputs は組み始めたときのその日の問題の入力
 * （monthBatch の dayInputsOf）。組み始めたときの担当との差が出せなければ diff は null
 */
export function proposalDayOf(
  date: string,
  planned: { visits: readonly Visit[]; problem: Problem },
  result: Pick<SolveResult, 'routes' | 'unassigned'>,
  inputs: DayInputs,
): ProposalDay {
  const { visits, problem: p } = planned;
  const before = routesOf(p, visits);
  let diff: ReassignDiff | null = null;
  try {
    diff = reassignDiff({ problem: p, routes: before }, { problem: p, routes: result.routes });
  } catch {
    diff = null;
  }
  return { date, problem: p, visits, inputs, routes: result.routes, diff, unassigned: result.unassigned.length };
}
