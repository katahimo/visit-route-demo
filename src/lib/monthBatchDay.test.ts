import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';
import { visitsOn } from '../patterns';
import { reassignDiff } from '../reassign';
import { createDemoData } from '../seed';
import { solve } from '../solver';
import { aiPinsOf, dayProblemOf, routesOf } from './dayPlan';
import { dayInputsOf } from './monthBatch';
import { batchDayProblem, proposalDayOf } from './monthBatchDay';

const TODAY = '2026-10-21';
const DAY = addDays(TODAY, 1);

/** 繰り返しの担当を外したデモのデータ（どの回も担当なし。版2） */
function unassigned(): DemoData {
  const d = createDemoData(TODAY);
  return { ...d, patterns: d.patterns.map((p) => ({ ...p, usualStaffId: null })) };
}

describe('batchDayProblem（1日分の問題）', () => {
  it('その日の訪問と、手で付けたピン・標準のピンを入れた問題', () => {
    const d = createDemoData(TODAY);
    const visits = visitsOn(d, DAY);
    const r = batchDayProblem(d, DAY)!;
    const pins = aiPinsOf(d, DAY, visits);
    expect(r.visits).toEqual(visits);
    expect(r.problem).toEqual(dayProblemOf(d, DAY, Object.keys(pins).length > 0 ? pins : undefined));
  });

  it('確定した日・訪問の無い日・働ける人のいない日は null（飛ばす）', () => {
    const d = unassigned();
    const task = DAY;
    expect(batchDayProblem({ ...d, snapshots: { [DAY]: { date: DAY, at: 1, visits: [] } } }, task)).toBeNull();
    expect(batchDayProblem({ ...d, patterns: [], visits: [] }, task)).toBeNull();
    expect(batchDayProblem({ ...d, staff: d.staff.map((s) => ({ ...s, active: false })) }, task)).toBeNull();
  });
});

describe('proposalDayOf（解いた結果から提案の1日）', () => {
  it('組み始めたときの担当との差・担当なしの数・入力の控えを持つ', () => {
    const d = unassigned();
    const planned = batchDayProblem(d, DAY)!;
    const result = solve(planned.problem, { seed: 1, iterations: 2000 });
    const inputs = dayInputsOf(d, DAY);
    const day = proposalDayOf(DAY, planned, result, inputs);
    expect(day).toEqual({
      date: DAY,
      problem: planned.problem,
      visits: planned.visits,
      inputs,
      routes: result.routes,
      diff: reassignDiff(
        { problem: planned.problem, routes: routesOf(planned.problem, planned.visits) },
        { problem: planned.problem, routes: result.routes },
      ),
      unassigned: result.unassigned.length,
    });
    expect(day.diff!.moved.length).toBeGreaterThan(0);
  });
});
