// 「AI で組む」（lib/monthBatch）の1日分の計算：組む日の並び・その日の問題・解いた結果からの提案の1日（純粋関数）
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import type { Problem, SolveResult } from '../contracts/problem';
import type { ReassignDiff } from '../contracts/reassign';
import type { Rule } from '../contracts/rules';
import { visitsOn } from '../patterns';
import { reassignDiff } from '../reassign';
import { own } from './common';
import { aiPinsOf, dayProblemOf, pinsOf, routesOf } from './dayPlan';
import type { BatchJob, BatchVariant, DayInputs, ProposalDay } from './monthBatch';

/** 組む日1つ（rules は組む条件で、無ければ今の条件。v は考え方ごとの案の番号、ふだんは -1） */
export type BatchTask = { date: string; rules: Rule[] | undefined; v: number };

/** 組む日と条件の並び（考え方ごとの案なら最初の日を考え方ごとに） */
export function batchTasksOf(
  job: Pick<BatchJob, 'days' | 'rules'>,
  variants: readonly BatchVariant[] | null,
): BatchTask[] {
  return variants
    ? variants.map((x, v) => ({ date: job.days[0]!.date, rules: x.rules as Rule[] | undefined, v }))
    : job.days.map((x) => ({ date: x.date, rules: job.rules, v: -1 }));
}

/** 組む条件（プリセットを当てた条件か、今の条件） */
function withRules(d: DemoData, rules: Rule[] | undefined): DemoData {
  return rules ? { ...d, rules } : d;
}

/**
 * 1日分の問題：その日の訪問と、ピンを入れたその日の問題。
 * 確定した日・問題が作れない日・訪問か担当がいない日は null（その日は飛ばす）
 */
export function batchDayProblem(d: DemoData, task: BatchTask): { visits: Visit[]; problem: Problem } | null {
  const day = task.date;
  // 組んでいる間に確定した日は飛ばす
  if (own(d.snapshots, day)) return null;
  const visits = visitsOn(d, day);
  // 手で付けたピンと標準のピン（ADR-0062）。考え方ごとの案は標準を決める前の案なので、手で付けたピンだけ（ADR-0064）
  const pins = task.v >= 0 ? pinsOf(visits) : aiPinsOf(withRules(d, task.rules), day, visits);
  const p = dayProblemOf(withRules(d, task.rules), day, Object.keys(pins).length > 0 ? pins : undefined);
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
