// 自動の組みで要対応の訪問（間に合わない・重なり・休みの人）も組み直す（PRD D403・D405。ADR-0089）：焼きなましで実際に解いて確かめる
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { findVisit, putVisits, visitsOn } from '../patterns';
import { createDemoData } from '../seed';
import { solve } from '../solver';
import {
  type AutoDay,
  applyAutoArrange,
  autoDayPlan,
  autoRange,
  autoSolveOptions,
  bandTargets,
  changedDays,
  isMovable,
  issueTargets,
  mergeTargets,
  rearrangesIssues,
  rearrangesOffDay,
} from './autoArrange';
import { dayBandIssues } from './bandIssues';
import { dayInputsOf } from './monthBatch';

const TODAY = '2026-10-21';
/** 今日の c1（初期データは s3 の 9:00 の固定） */
const C1 = `${TODAY}_c1`;

/** 今日の c1 を書き換えたデータ（expert 切） */
function withC1(x: Partial<Visit>): DemoData {
  const d = createDemoData(TODAY);
  const v = visitsOn(d, TODAY).find((y) => y.id === C1)!;
  return { ...d, visits: putVisits(d.visits, [{ ...v, ...x }]) };
}

/** その日を対象（targetIds）で解く */
function dayOf(d: DemoData, targetIds: string[]): AutoDay | null {
  const plan = autoDayPlan(d, TODAY, targetIds);
  if (!plan) return null;
  const result = solve(plan.problem, { ...autoSolveOptions(d, plan), iterations: 6000 });
  return {
    date: TODAY,
    problem: plan.problem,
    visits: plan.visits,
    inputs: dayInputsOf(d, TODAY),
    routes: result.routes,
    targetIds: plan.targetIds,
  };
}

const arrange = (d: DemoData, ids: string[]) => {
  const day = dayOf(d, ids);
  return day ? applyAutoArrange(d, [day], { writeUsual: false, rangeTo: TODAY }) : null;
};

describe('要対応の訪問の組み直し（ADR-0089）', () => {
  // s7 は 11:00 からしか働かないので、9:00 の c1 は「間に合わない」（その訪問だけでも収まらない）
  const late = withC1({ staffId: 's7' });

  it('間に合わない訪問は帯の種類 late になり、［要対応を組む］の対象に入る（担当なしも）', () => {
    expect(dayBandIssues(late, TODAY).get(C1)).toBe('late');
    const t = bandTargets(late, TODAY, { from: TODAY, to: TODAY });
    expect(t[0]?.ids).toContain(C1);
    // 担当なしの訪問も入る
    const unassigned = visitsOn(late, TODAY).filter((v) => v.staffId === null && !v.cancelled);
    for (const v of unassigned) expect(t[0]?.ids).toContain(v.id);
    // 問題の無い担当のある訪問は入らない
    expect(t[0]?.ids).not.toContain(`${TODAY}_c14`);
    // 保存のあとに足す対象（issueTargets）は担当のある要対応だけ（前からの担当なしは入れない）
    expect(issueTargets(late, TODAY, [TODAY])).toEqual([{ date: TODAY, ids: [C1] }]);
  });

  it('間に合わない訪問は組み直されて要対応が減り、問題の無い訪問は動かない', () => {
    const r = arrange(late, [C1])!;
    expect(r.written).toBe(1);
    const moved = findVisit(r.data, C1)!;
    expect(moved.staffId).not.toBe('s7');
    expect(moved.staffId).not.toBeNull();
    expect(dayBandIssues(r.data, TODAY).has(C1)).toBe(false);
    expect(dayBandIssues(r.data, TODAY).size).toBeLessThan(dayBandIssues(late, TODAY).size);
    for (const v of visitsOn(late, TODAY)) if (v.id !== C1) expect(findVisit(r.data, v.id)).toEqual(v);
  });

  it('組み直しても減らない（誰も間に合わない）ときは元の担当のまま', () => {
    // 6:00 の固定は誰の働ける時間にも入らない
    const none = withC1({ earliestStart: '06:00', latestStart: '06:00' });
    expect(dayBandIssues(none, TODAY).get(C1)).toBe('late');
    const r = arrange(none, [C1]);
    expect(r?.written ?? 0).toBe(0);
    expect(findVisit(r?.data ?? none, C1)).toEqual(findVisit(none, C1));
  });

  it('前の訪問と重なる訪問は「重なり」で、組み直すと別の人に移る', () => {
    // s1 の 9:00（c14）と同じ時刻に c1 も s1 にする
    const overlap = withC1({ staffId: 's1' });
    const kinds = dayBandIssues(overlap, TODAY);
    const target = [...kinds].find(([, k]) => k === 'overlap')?.[0];
    expect(target).toBeDefined();
    const r = arrange(overlap, [target!])!;
    expect(r.written).toBe(1);
    expect(dayBandIssues(r.data, TODAY).get(target!)).toBeUndefined();
  });

  it('書かずに元の担当へ戻した要対応の訪問も元の列で確かめ、違反が出る担当へは書かない（重なりを増やさない）', () => {
    // c1 を s2 にすると重なり1件。c12 を 10:00〜10:20 の10分にして担当なしで足す
    const base = withC1({ staffId: 's2' });
    const c12 = visitsOn(base, TODAY).find((v) => v.id === `${TODAY}_c12`)!;
    const d = {
      ...base,
      visits: putVisits(base.visits, [{ ...c12, earliestStart: '10:00', latestStart: '10:20', durationMinutes: 10 }]),
    };
    const before = dayBandIssues(d, TODAY);
    expect(before.get(C1)).toBe('overlap');
    const plan = autoDayPlan(d, TODAY, [C1, c12.id])!;
    expect(plan.targetIds).toEqual([C1, c12.id]);
    // 解いた結果を作る：c1 は s5 の先頭（s5 の訪問と重なって書けない）、c12 は s2 の c5 の前（c1 を s2 に戻すと重なる）
    const routes: Record<string, string[]> = {};
    for (const s of plan.problem.staff)
      routes[s.id] = plan.visits
        .filter((v) => v.staffId === s.id && !plan.targetIds.includes(v.id) && !v.cancelled)
        .map((v) => v.id);
    routes.s5 = [C1, ...(routes.s5 ?? [])];
    const s2 = routes.s2!;
    s2.splice(s2.indexOf(`${TODAY}_c5`), 0, c12.id);
    const day: AutoDay = {
      date: TODAY,
      problem: plan.problem,
      visits: plan.visits,
      inputs: dayInputsOf(d, TODAY),
      routes,
      targetIds: plan.targetIds,
    };
    const r = applyAutoArrange(d, [day], { writeUsual: false, rangeTo: TODAY });
    expect(r.written).toBe(0);
    expect(findVisit(r.data, c12.id)?.staffId).toBeNull();
    expect(findVisit(r.data, C1)).toEqual(findVisit(d, C1));
    const after = [...dayBandIssues(r.data, TODAY)].filter(([, k]) => k === 'overlap');
    expect(after).toEqual([[C1, 'overlap']]);
  });

  it('伝えた日の訪問は動かさない（担当なしは今までどおり埋める）。ピンの訪問・エキスパート入も動かさない', () => {
    const told = { ...late, snapshots: { [TODAY]: { date: TODAY, at: 0, visits: [] } } };
    const v = findVisit(told, C1)!;
    expect(isMovable(told, v, TODAY)).toBe(false);
    expect(bandTargets(told, TODAY, { from: TODAY, to: TODAY })[0]?.ids ?? []).not.toContain(C1);
    expect(autoDayPlan(told, TODAY, [C1])).toBeNull();
    const pinned = withC1({ staffId: 's7', pinned: true });
    expect(autoDayPlan(pinned, TODAY, [C1])).toBeNull();
    const expert = { ...late, org: { ...late.org, features: { expert: true } } };
    expect(rearrangesIssues(expert)).toBe(false);
    expect(bandTargets(expert, TODAY, { from: TODAY, to: TODAY })[0]?.ids ?? []).not.toContain(C1);
    expect(autoDayPlan(expert, TODAY, [C1])).toBeNull();
  });

  it('休みの人の訪問は伝えた日（自動で組んで決まった日）でも組み直す（ADR-0111）。ピン・エキスパート入は動かさない', () => {
    // c1 は s3 の 9:00。s3 が終日休みで、その日は決まった（伝えた）扱い
    const base = withC1({});
    const owner = findVisit(base, C1)!.staffId!;
    const absence = { id: 'ab-off', staffId: owner, date: TODAY, from: null, to: null, note: '希望休' };
    const off: DemoData = {
      ...base,
      absences: [...base.absences, absence],
      snapshots: { ...base.snapshots, [TODAY]: { date: TODAY, at: 0, visits: [] } },
    };
    expect(dayBandIssues(off, TODAY).get(C1)).toBe('off');
    expect(isMovable(off, findVisit(off, C1)!, TODAY, 'off')).toBe(true);
    expect(isMovable(off, findVisit(off, C1)!, TODAY)).toBe(false);
    expect(bandTargets(off, TODAY, { from: TODAY, to: TODAY })[0]?.ids).toContain(C1);
    const r = arrange(off, [C1])!;
    expect(r.written).toBeGreaterThan(0);
    const moved = findVisit(r.data, C1)!;
    expect(moved.staffId).not.toBe(owner);
    expect(moved.staffId).not.toBeNull();
    expect(dayBandIssues(r.data, TODAY).has(C1)).toBe(false);
    // 伝えた記録はそのまま（違いは「変更あり」に出る）
    expect(r.data.snapshots).toBe(off.snapshots);
    // 伝えた日の、休みの人でない要対応（間に合わない）は今までどおり動かさない
    const lateTold = { ...late, snapshots: off.snapshots };
    expect(bandTargets(lateTold, TODAY, { from: TODAY, to: TODAY })[0]?.ids ?? []).not.toContain(C1);
    // ピン・エキスパート入は動かさない
    const pinned = { ...off, visits: putVisits(off.visits, [{ ...findVisit(off, C1)!, pinned: true }]) };
    expect(autoDayPlan(pinned, TODAY, [C1])).toBeNull();
    const expert = { ...off, org: { ...off.org, features: { expert: true } } };
    expect(bandTargets(expert, TODAY, { from: TODAY, to: TODAY })[0]?.ids ?? []).not.toContain(C1);
  });

  it('rearrangesOffDay：希望休のあとに組み直すのは切で、今日〜翌月末の日だけ（ADR-0111）', () => {
    expect(rearrangesOffDay(late, TODAY, TODAY)).toBe(true);
    expect(rearrangesOffDay(late, '2026-11-30', TODAY)).toBe(true);
    expect(rearrangesOffDay(late, '2026-12-01', TODAY)).toBe(false);
    expect(rearrangesOffDay(late, '2026-10-20', TODAY)).toBe(false);
    const expert = { ...late, org: { ...late.org, features: { expert: true } } };
    expect(rearrangesOffDay(expert, TODAY, TODAY)).toBe(false);
  });

  it('changedDays：保存で訪問か問題の入力が変わった日だけ（保存のあとに足す要対応はその日だけ）', () => {
    const range = { from: TODAY, to: '2026-10-25' };
    expect(changedDays(late, late, TODAY, range)).toEqual([]);
    const c = visitsOn(late, '2026-10-23')[0]!;
    const moved = { ...late, visits: putVisits(late.visits, [{ ...c, earliestStart: '07:00', latestStart: '07:00' }]) };
    expect(changedDays(late, moved, TODAY, range)).toEqual(['2026-10-23']);
    const absence = { id: 'ab-x', staffId: 's1', date: '2026-10-24', from: null, to: null, note: '' };
    const off = { ...late, absences: [...late.absences, absence] } as DemoData;
    expect(changedDays(late, off, TODAY, range)).toEqual(['2026-10-24']);
    // 今日の c1 の間に合わないは、今日が変わっていなければ足さない
    const dates = issueTargets(moved, TODAY, changedDays(late, moved, TODAY, range)).map((t) => t.date);
    expect(dates).not.toContain(TODAY);
    expect(issueTargets(moved, TODAY, [TODAY])[0]?.ids).toContain(C1);
  });

  it('mergeTargets：日ごとにまとめ、同じ訪問は1つ・日付の順', () => {
    expect(
      mergeTargets(
        [
          { date: '2026-10-23', ids: ['a'] },
          { date: '2026-10-21', ids: ['b'] },
        ],
        [{ date: '2026-10-21', ids: ['b', 'c'] }],
      ),
    ).toEqual([
      { date: '2026-10-21', ids: ['b', 'c'] },
      { date: '2026-10-23', ids: ['a'] },
    ]);
    expect(autoRange(TODAY).to).toBe('2026-11-30');
  });
});
