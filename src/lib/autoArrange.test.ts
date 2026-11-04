import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Pattern, Visit } from '../contracts/documents';
import { addDays } from '../domain/time';
import { putVisits, visitsOn } from '../patterns';
import { createDemoData } from '../seed';
import { defaultIterations } from '../solver';
import { autoDayPlan, autoRange, autoSolveOptions, autoTargets, bandTargets, targetCount } from './autoArrange';

const TODAY = '2026-10-21';
const RANGE = autoRange(TODAY);

/** 繰り返しの担当を外したデモのデータ（どの回も担当なし） */
function unassigned(): DemoData {
  const d = createDemoData(TODAY);
  return { ...d, patterns: d.patterns.map((p) => ({ ...p, usualStaffId: null })) };
}

/** 新しい繰り返し（毎日。〈利用者さん〉 c2 の 10:00。from は今日） */
function newPattern(x: Partial<Pattern> = {}): Pattern {
  const base = unassigned().patterns[0]!;
  return {
    ...base,
    id: 'pn',
    clientId: 'c2',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    windowKind: 'fixed',
    earliestStart: '10:00',
    latestStart: '10:00',
    from: TODAY,
    to: null,
    usualStaffId: null,
    ...x,
  };
}
const withPattern = (d: DemoData, x: Partial<Pattern> = {}): DemoData => ({
  ...d,
  patterns: [...d.patterns, newPattern(x)],
});
const ids = (t: { ids: string[] }[]) => t.flatMap((x) => x.ids);
const dates = (t: { date: string }[]) => t.map((x) => x.date);

describe('autoRange', () => {
  it('今日から翌月末まで（年をまたぐ）', () => {
    expect(autoRange('2026-10-21')).toEqual({ from: '2026-10-21', to: '2026-11-30' });
    expect(autoRange('2026-12-31')).toEqual({ from: '2026-12-31', to: '2027-01-31' });
    expect(autoRange('2027-01-31').to).toBe('2027-02-28');
  });
  it('開始日が今日より後なら開始日からその翌月末まで。今日より前・今日なら今日から（PRD D416）', () => {
    expect(autoRange('2026-11-02', '2026-12-20')).toEqual({ from: '2026-12-20', to: '2027-01-31' });
    expect(autoRange('2026-11-02', '2026-11-10')).toEqual({ from: '2026-11-10', to: '2026-12-31' });
    expect(autoRange('2026-11-02', '2026-10-01')).toEqual({ from: '2026-11-02', to: '2026-12-31' });
    expect(autoRange('2026-11-02', '2026-11-02')).toEqual(autoRange('2026-11-02'));
  });
});

describe('autoTargets（増えた・日時が変わった担当なしの訪問。D373）', () => {
  const before = unassigned();

  it('増えた繰り返しの回だけが対象（もとからある担当なしの回は入らない）。日付の順', () => {
    const t = autoTargets(before, withPattern(before), TODAY, RANGE);
    expect(t.length).toBeGreaterThan(30);
    expect(ids(t).every((id) => id.endsWith('_pn'))).toBe(true);
    expect(dates(t)).toEqual([...dates(t)].sort());
    expect(t[0]!.date).toBe(TODAY);
    expect(t.at(-1)!.date).toBe(RANGE.to);
  });

  it('日付・開始（早）・開始（遅）が変わった回が対象。同じなら対象でない', () => {
    const c1 = before.patterns.find((p) => p.id === 'c1')!;
    const moved = {
      ...before,
      patterns: before.patterns.map((p) =>
        p.id === 'c1' ? { ...c1, earliestStart: '10:30', latestStart: '10:30' } : p,
      ),
    };
    const t = autoTargets(before, moved, TODAY, RANGE);
    expect(t.length).toBeGreaterThan(0);
    expect(ids(t).every((id) => id.endsWith('_c1'))).toBe(true);
    const note = { ...before, patterns: before.patterns.map((p) => (p.id === 'c1' ? { ...c1, note: 'メモ' } : p)) };
    expect(autoTargets(before, note, TODAY, RANGE)).toEqual([]);
    // 保存した回の日付を動かす
    const v = visitsOn(before, TODAY).find((x) => x.id === `${TODAY}_c1`);
    const base = v ?? visitsOn(before, TODAY)[0]!;
    const next = addDays(TODAY, 1);
    const day: Visit = { ...base, date: next };
    const after = { ...before, visits: putVisits(before.visits, [day]) };
    expect(ids(autoTargets(before, after, TODAY, RANGE))).toContain(base.id);
  });

  it('担当あり・ピンあり・取り消しは対象でない', () => {
    expect(autoTargets(before, withPattern(before, { usualStaffId: 's3' }), TODAY, RANGE)).toEqual([]);
    const d = withPattern(before);
    const v = visitsOn(d, TODAY).find((x) => x.id === `${TODAY}_pn`)!;
    const pinned = { ...d, visits: putVisits(d.visits, [{ ...v, pinned: true }]) };
    expect(ids(autoTargets(before, pinned, TODAY, RANGE))).not.toContain(v.id);
    const cancelled = { ...d, visits: putVisits(d.visits, [{ ...v, cancelled: true }]) };
    expect(ids(autoTargets(before, cancelled, TODAY, RANGE))).not.toContain(v.id);
    const staffed = { ...d, visits: putVisits(d.visits, [{ ...v, staffId: 's1' }]) };
    expect(ids(autoTargets(before, staffed, TODAY, RANGE))).not.toContain(v.id);
  });

  it('伝えた日・昨日・範囲外は対象でない', () => {
    const d = withPattern(before, { from: addDays(TODAY, -3) });
    const told = {
      ...d,
      org: { ...d.org, features: { expert: true } },
      snapshots: { [addDays(TODAY, 2)]: { date: addDays(TODAY, 2), at: 0, visits: [] } },
    };
    const t = autoTargets(before, told, TODAY, RANGE);
    expect(dates(t)).not.toContain(addDays(TODAY, 2));
    expect(dates(t).every((x) => x >= TODAY)).toBe(true);
    expect(dates(t)).toContain(addDays(TODAY, 1));
    const narrow = autoTargets(before, d, TODAY, { from: TODAY, to: addDays(TODAY, 2) });
    expect(dates(narrow)).toEqual([TODAY, addDays(TODAY, 1), addDays(TODAY, 2)]);
    // 範囲が今日より前から始まっても、昨日以前は組まない
    expect(dates(autoTargets(before, d, TODAY, { from: addDays(TODAY, -5), to: addDays(TODAY, 1) }))).toEqual([
      TODAY,
      addDays(TODAY, 1),
    ]);
  });
});

describe('bandTargets（要対応の帯の［要対応を組む］の対象）', () => {
  it('範囲の担当なし・ピンなし・伝えていない・今日以降の訪問すべて。数も数える', () => {
    const d = unassigned();
    const t = bandTargets(d, TODAY, RANGE);
    expect(dates(t)[0]).toBe(TODAY);
    expect(targetCount(t)).toBe(ids(t).length);
    const first = t[0]!;
    expect(first.ids).toEqual(
      visitsOn(d, TODAY)
        .filter((v) => !v.cancelled)
        .map((v) => v.id),
    );
    const told = {
      ...d,
      org: { ...d.org, features: { expert: true } },
      snapshots: { [TODAY]: { date: TODAY, at: 0, visits: [] } },
    };
    expect(dates(bandTargets(told, TODAY, RANGE))).not.toContain(TODAY);
  });

  it('担当のある訪問（入は全部・切は帯の種類に当たらないもの）・利用中でない人の訪問・休みの訪問は入らない', () => {
    const d0 = unassigned();
    const d = { ...d0, patterns: d0.patterns.map((p) => ({ ...p, usualStaffId: 's3' })) };
    const expert = { ...d, org: { ...d.org, features: { expert: true } } };
    expect(targetCount(bandTargets(expert, TODAY, RANGE))).toBe(0);
    // 切：全部 s3 にすると重なる回が帯の種類（重なり）になり、それだけが入る（ADR-0089）
    const today = bandTargets(d, TODAY, { from: TODAY, to: TODAY });
    const all = visitsOn(d, TODAY).filter((v) => !v.cancelled);
    expect(targetCount(today)).toBeGreaterThan(0);
    expect(targetCount(today)).toBeLessThan(all.length);
    const u = unassigned();
    const c = u.clients[0]!;
    const stopped = { ...u, clients: u.clients.map((x) => (x.id === c.id ? { ...x, active: false } : x)) };
    expect(targetCount(bandTargets(stopped, TODAY, RANGE))).toBeLessThan(targetCount(bandTargets(u, TODAY, RANGE)));
    const leave = { ...u, clientLeaves: [{ id: 'l1', clientId: c.id, from: TODAY, to: RANGE.to, note: '' }] };
    expect(targetCount(bandTargets(leave, TODAY, RANGE))).toBeLessThan(targetCount(bandTargets(u, TODAY, RANGE)));
  });
});

describe('autoDayPlan（1日の問題）', () => {
  const d0 = unassigned();

  it('担当のある訪問はすべてピンとして固定し、対象でない担当なしの訪問は問題から外す', () => {
    // c1 は担当あり（s3）、新しい繰り返しだけが対象、ほかは担当なしの対象でない訪問
    const d = withPattern({
      ...d0,
      patterns: d0.patterns.map((p) => (p.id === 'c1' ? { ...p, usualStaffId: 's3' } : p)),
    });
    const plan = autoDayPlan(d, TODAY, [`${TODAY}_pn`])!;
    expect(plan).not.toBeNull();
    const inProblem = plan.problem.visits.map((v) => v.id);
    expect(inProblem).toContain(`${TODAY}_pn`);
    expect(plan.targetIds).toEqual([`${TODAY}_pn`]);
    // 対象でない担当なしの訪問は入らない
    const others = visitsOn(d, TODAY).filter((v) => v.staffId === null && v.id !== `${TODAY}_pn`);
    expect(others.length).toBeGreaterThan(0);
    for (const v of others) expect(inProblem).not.toContain(v.id);
    // 担当のある訪問は入り、固定した担当だけが可
    const pinned = visitsOn(d, TODAY).filter((v) => v.staffId !== null && !v.cancelled);
    expect(pinned.length).toBeGreaterThan(0);
    for (const v of pinned) {
      const j = inProblem.indexOf(v.id);
      expect(j).toBeGreaterThanOrEqual(0);
      const si = plan.problem.staff.findIndex((s) => s.id === v.staffId);
      expect(plan.problem.allowed[j]!.map((ok, k) => ok === (k === si))).not.toContain(false);
    }
  });

  it('組める。対象が無い・伝えた日・訪問の無い日は null', () => {
    const d = withPattern(d0);
    expect(autoDayPlan(d, TODAY, [`${TODAY}_pn`])).not.toBeNull();
    expect(autoDayPlan(d, TODAY, [])).toBeNull();
    expect(autoDayPlan(d, TODAY, ['nothing'])).toBeNull();
    const told = {
      ...d,
      org: { ...d.org, features: { expert: true } },
      snapshots: { [TODAY]: { date: TODAY, at: 0, visits: [] } },
    };
    expect(autoDayPlan(told, TODAY, [`${TODAY}_pn`])).toBeNull();
    // expert 切：決まった（伝えた）日も担当なしの訪問を埋める対象（担当のある訪問は固定。ADR-0073）
    const settled = { ...told, org: { ...told.org, features: { expert: false } } };
    const plan = autoDayPlan(settled, TODAY, [`${TODAY}_pn`]);
    expect(plan).not.toBeNull();
    expect(plan!.targetIds).toEqual([`${TODAY}_pn`]);
    expect(dates(bandTargets(settled, TODAY, RANGE))).toContain(TODAY);
    // 担当のスタッフがいなければ問題にならない
    const none = { ...d, staff: d.staff.map((s) => ({ ...s, active: false })) };
    expect(autoDayPlan(none, TODAY, [`${TODAY}_pn`])).toBeNull();
  });

  it('担当が今は担当なしでなくなった対象は組まない', () => {
    const d = withPattern(d0);
    const v = visitsOn(d, TODAY).find((x) => x.id === `${TODAY}_pn`)!;
    const staffed = { ...d, visits: putVisits(d.visits, [{ ...v, staffId: 's1' }]) };
    expect(autoDayPlan(staffed, TODAY, [v.id])).toBeNull();
  });

  it('解く回数は自由な訪問の数に合わせ、通常の組みを超えない。seed は data.seed', () => {
    const d = withPattern(d0);
    const plan = autoDayPlan(d, TODAY, [`${TODAY}_pn`])!;
    const o = autoSolveOptions(d, plan);
    expect(o.seed).toBe(d.seed);
    expect(o.iterations).toBeLessThanOrEqual(defaultIterations(plan.problem));
    expect(o.iterations).toBeGreaterThanOrEqual(20_000);
    const many = autoSolveOptions(d, {
      problem: plan.problem,
      targetIds: Array.from({ length: 1000 }, (_, i) => String(i)),
    });
    expect(many.iterations).toBe(defaultIterations(plan.problem));
  });
});
