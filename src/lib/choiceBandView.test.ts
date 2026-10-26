// 案を日で見る（ChoiceDayView）の表示の純粋関数（PRD D350。ADR-0065）
import { describe, expect, it } from 'vitest';
import { normalize } from '../evaluate';
import { visitsOn } from '../patterns';
import { reassignDiff } from '../reassign';
import { createDemoData } from '../seed';
import { solve } from '../solver';
import { changeNote, choiceDiff, choicePoints, choiceStaffIds, choiceTab, diffSign, pointText } from './choiceBandView';
import { busyStaff } from './choiceView';
import { dayProblemOf, pointsOf, routesOf } from './dayPlan';
import { type ProposalChange, proposalDayChanges } from './monthBatch';

const TODAY = '2026-10-21';

const change = (over: Partial<ProposalChange>): ProposalChange => ({
  visitId: 'v1',
  clientId: 'c1',
  at: 9 * 60 + 30,
  kind: 'staff',
  from: 's1',
  to: 's2',
  minutes: 0,
  ...over,
});

describe('choiceBandView（文）', () => {
  it('pointText：採点できなければ —', () => {
    expect(pointText(null)).toBe('—');
    expect(pointText(82)).toBe('82点');
  });

  it('diffSign：正は＋・負は−・0 は±', () => {
    expect([diffSign(3), diffSign(-3), diffSign(0)]).toEqual(['+', '−', '±']);
  });

  it('changeNote：担当が変わる・時刻だけ変わる・変わらない', () => {
    const name = (id: string | null) => (id === null ? '担当なし' : `${id}さん`);
    expect(changeNote(change({ kind: 'staff', from: 's1' }), name)).toBe('担当が変わる（今：s1さん）');
    expect(changeNote(change({ kind: 'staff', from: null }), name)).toBe('担当が変わる（今：担当なし）');
    expect(changeNote(change({ kind: 'time', minutes: 30 }), name)).toBe('時刻が変わる（今：09:00）');
    expect(changeNote(undefined, name)).toBeUndefined();
  });
});

describe('choiceBandView（点・列・差）', () => {
  const d = createDemoData(TODAY);
  const problem = dayProblemOf(d, TODAY)!;
  const current = routesOf(problem, visitsOn(d, TODAY));
  const solved = solve(problem, { seed: 1, iterations: 2000 }).routes;
  const choices = [
    { presetId: 'a', name: 'A', routes: solved },
    { presetId: 'b', name: 'B', routes: current },
  ];

  it('choicePoints：今と案ごとの点（点数の基準の物差し・100点満点）', () => {
    const scale = normalize(problem);
    expect(choicePoints(problem, current, choices)).toEqual({
      current: pointsOf(problem, scale, current),
      choices: [pointsOf(problem, scale, solved), pointsOf(problem, scale, current)],
    });
  });

  it('choiceStaffIds：今かどれかの案で訪問のある人', () => {
    const ids = choiceStaffIds(problem, {}, choices);
    expect([...ids].sort()).toEqual(
      [...new Set([...busyStaff(problem, solved), ...busyStaff(problem, current)])].sort(),
    );
  });

  it('choiceDiff：今 → 案の差と変わる訪問（提案の帯と同じ並び）。同じなら変わる訪問は無い', () => {
    const r = choiceDiff(problem, current, solved);
    const diff = reassignDiff({ problem, routes: current }, { problem, routes: solved });
    expect(r.diff).toEqual(diff);
    expect(r.changes).toEqual(proposalDayChanges({ problem, routes: solved, diff }));
    expect(choiceDiff(problem, current, current).changes).toEqual([]);
  });

  it('choiceTab：今（current）・選んだ案・無ければいちばん点の高い案・最初の案', () => {
    expect(choiceTab('current', choices, 1)).toBe(-1);
    expect(choiceTab('b', choices, 0)).toBe(1);
    expect(choiceTab(null, choices, 1)).toBe(1);
    expect(choiceTab('gone', choices, -1)).toBe(0);
    expect(choiceTab(null, [], -1)).toBe(-1);
  });
});
