// 案の時間軸の列（組み方の標準の日で見る。PRD D350。ADR-0065）
import { describe, expect, it } from 'vitest';
import { createDemoData } from '../seed';
import { solve } from '../solver';
import { busyStaff, choiceColumns } from './choiceView';
import { dayProblemOf, startsOf, stopsOf } from './dayPlan';

const TODAY = '2026-10-21';

describe('choiceColumns', () => {
  const d = createDemoData(TODAY);
  const problem = dayProblemOf(d, TODAY)!;
  const routes = solve(problem, { seed: 1, iterations: 2000 }).routes;
  const staffById = new Map(d.staff.map((s) => [s.id, s]));

  it('列は staffIds の人だけ・問題の担当の順。時刻は予定の画面と同じ（stopsOf・startsOf）', () => {
    const busy = busyStaff(problem, routes);
    const cols = choiceColumns(problem, routes, busy, staffById);
    expect(cols.map((c) => c.staffId)).toEqual(problem.staff.filter((s) => busy.has(s.id)).map((s) => s.id));
    const starts = startsOf(problem, routes);
    const stops = stopsOf(problem, routes);
    for (const c of cols) {
      expect(c.stops).toEqual(stops.get(c.staffId));
      for (const t of c.stops) expect(starts.get(t.visitId)).toEqual({ staffId: c.staffId, start: t.start });
      expect(c.stops.length).toBeGreaterThan(0);
    }
  });

  it('訪問の無い人も staffIds にあれば列にする（タブを替えても列が動かない）', () => {
    const all = new Set(problem.staff.map((s) => s.id));
    const cols = choiceColumns(problem, {}, all, staffById);
    expect(cols).toHaveLength(problem.staff.length);
    expect(cols.every((c) => c.stops.length === 0 && c.homeMinutes === null)).toBe(true);
  });
});
