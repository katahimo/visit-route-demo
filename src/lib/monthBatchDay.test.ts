import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';
import { visitsOn } from '../patterns';
import { reassignDiff } from '../reassign';
import { createDemoData } from '../seed';
import { solve } from '../solver';
import { aiPinsOf, dayProblemOf, pinsOf, routesOf } from './dayPlan';
import { dayInputsOf } from './monthBatch';
import { batchDayProblem, batchTasksOf, proposalDayOf } from './monthBatchDay';

const TODAY = '2026-10-21';
const DAY = addDays(TODAY, 1);

/** 繰り返しの担当を外したデモのデータ（どの回も担当なし。版2） */
function unassigned(): DemoData {
  const d = createDemoData(TODAY);
  return { ...d, patterns: d.patterns.map((p) => ({ ...p, usualStaffId: null })) };
}

describe('batchTasksOf（組む日と条件の並び）', () => {
  const days = [
    { date: TODAY, mode: 'care' as const },
    { date: DAY, mode: 'all' as const },
  ];

  it('ふだんは日ごとに、渡した条件（無ければ今の条件）で組む', () => {
    const d = createDemoData(TODAY);
    expect(batchTasksOf({ days }, null)).toEqual([
      { date: TODAY, rules: undefined, v: -1 },
      { date: DAY, rules: undefined, v: -1 },
    ]);
    expect(batchTasksOf({ days, rules: d.rules }, null).map((x) => x.rules)).toEqual([d.rules, d.rules]);
  });

  it('考え方ごとの案は、最初の日を考え方ごとに（v は案の番号）', () => {
    const d = createDemoData(TODAY);
    const variants = [
      { presetId: 'a', name: 'A', rules: d.rules },
      { presetId: 'b', name: 'B', rules: [] },
    ];
    expect(batchTasksOf({ days, rules: [] }, variants)).toEqual([
      { date: TODAY, rules: d.rules, v: 0 },
      { date: TODAY, rules: [], v: 1 },
    ]);
  });
});

describe('batchDayProblem（1日分の問題）', () => {
  it('その日の訪問と、手で付けたピン・標準のピンを入れた問題', () => {
    const d = createDemoData(TODAY);
    const visits = visitsOn(d, DAY);
    const r = batchDayProblem(d, { date: DAY, rules: undefined, v: -1 })!;
    const pins = aiPinsOf(d, DAY, visits);
    expect(r.visits).toEqual(visits);
    expect(r.problem).toEqual(dayProblemOf(d, DAY, Object.keys(pins).length > 0 ? pins : undefined));
  });

  it('考え方ごとの案は手で付けたピンだけで、その案の条件で作る（データの条件は変えない）', () => {
    const d = createDemoData(TODAY);
    const rules = d.rules.map((x) => ({ ...x, weight: 0, hard: false }));
    const r = batchDayProblem(d, { date: DAY, rules, v: 0 })!;
    const pins = pinsOf(visitsOn(d, DAY));
    expect(r.problem).toEqual(dayProblemOf({ ...d, rules }, DAY, Object.keys(pins).length > 0 ? pins : undefined));
    expect(r.problem).not.toEqual(dayProblemOf(d, DAY, Object.keys(pins).length > 0 ? pins : undefined));
  });

  it('確定した日・訪問の無い日・働ける人のいない日は null（飛ばす）', () => {
    const d = unassigned();
    const task = { date: DAY, rules: undefined, v: -1 };
    expect(batchDayProblem({ ...d, snapshots: { [DAY]: { date: DAY, at: 1, visits: [] } } }, task)).toBeNull();
    expect(batchDayProblem({ ...d, patterns: [], visits: [] }, task)).toBeNull();
    expect(batchDayProblem({ ...d, staff: d.staff.map((s) => ({ ...s, active: false })) }, task)).toBeNull();
  });
});

describe('proposalDayOf（解いた結果から提案の1日）', () => {
  it('組み始めたときの担当との差・担当なしの数・入力の控えを持つ', () => {
    const d = unassigned();
    const planned = batchDayProblem(d, { date: DAY, rules: undefined, v: -1 })!;
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
