// 自動の組みの反映（applyAutoArrange）：焼きなましで実際に解いて確かめる（重い計算なので autoArrange.test.ts と分ける）
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import { addDays } from '../domain/time';
import { findVisit, putVisits, visitsOn } from '../patterns';
import { createDemoData } from '../seed';
import { solve } from '../solver';
import { type AutoDay, applyAutoArrange, autoDayPlan, autoSolveOptions } from './autoArrange';
import { settleDay } from './dayPlan';
import { dayInputsOf } from './monthBatch';

const TODAY = '2026-10-21';
/** 組む範囲の終わり（テストでは3日目まで）。これより後の回は繰り返しの担当のとおり */
const RANGE_TO = addDays(TODAY, 3);

/** 繰り返しの担当を外したデモのデータ */
function unassigned(): DemoData {
  const d = createDemoData(TODAY);
  return { ...d, patterns: d.patterns.map((p) => ({ ...p, usualStaffId: null })) };
}

/** 新しい繰り返し（毎日。〈利用者さん〉 c2 の 10:00。担当なし） */
function withNew(d: DemoData, x: Partial<Pattern> = {}): DemoData {
  const np: Pattern = {
    ...d.patterns[0]!,
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
  return { ...d, patterns: [...d.patterns, np] };
}

/** expert 入（伝えた日は自動の組みから外す）にしたデータ */
const expertOn = (d: DemoData): DemoData => ({ ...d, org: { ...d.org, features: { expert: true } } });

/** その日の対象（新しい繰り返しの回）を解く */
function dayOf(d: DemoData, date: string): AutoDay {
  const targetIds = [`${date}_pn`];
  const plan = autoDayPlan(d, date, targetIds)!;
  const result = solve(plan.problem, { ...autoSolveOptions(d, plan), iterations: 4000 });
  return {
    date,
    problem: plan.problem,
    visits: plan.visits,
    inputs: dayInputsOf(d, date),
    routes: result.routes,
    targetIds: plan.targetIds,
  };
}
const staffOf = (d: DemoData, id: string) => findVisit(d, id)?.staffId ?? null;

describe('applyAutoArrange（反映。D373・D374）', () => {
  const d = expertOn(withNew(unassigned()));
  const dates = [0, 1, 2].map((i) => addDays(TODAY, i));

  it('対象の担当を書き、ほかの訪問の担当・ピンは変えない。書いた件数と日を返す', () => {
    // c1 は担当あり（s3）・手で付けたピンもある
    const c1 = d.patterns.find((p) => p.id === 'c1')!;
    const base = { ...d, patterns: d.patterns.map((p) => (p.id === 'c1' ? { ...c1, usualStaffId: 's3' } : p)) };
    const days = dates.map((x) => dayOf(base, x));
    const r = applyAutoArrange(base, days, { writeUsual: false, rangeTo: RANGE_TO });
    expect(r.appliedDays).toEqual(dates);
    expect(r.skippedDays).toEqual([]);
    for (const x of dates) {
      expect(staffOf(r.data, `${x}_pn`)).not.toBeNull();
      // ほかの訪問は変わらない
      for (const v of visitsOn(base, x)) if (v.id !== `${x}_pn`) expect(findVisit(r.data, v.id)).toEqual(v);
    }
    expect(r.written).toBe(3);
    expect(findVisit(r.data, `${dates[0]}_pn`)!.pinned).toBe(false);
    // 単発・ホームの［組む］（writeUsual: false）は繰り返しの担当に書かない
    expect(r.data.patterns.find((p) => p.id === 'pn')!.usualStaffId).toBeNull();
  });

  it('組み始めたときから変わった日・伝えた日は飛ばす（担当なしのまま）', () => {
    const days = dates.map((x) => dayOf(d, x));
    const changed = {
      ...d,
      absences: [
        ...d.absences,
        { id: 'ab', staffId: 's1', date: dates[1]!, kind: 'absent' as const, note: '' } as never,
      ],
    };
    const told = {
      ...changed,
      snapshots: { [dates[2]!]: { date: dates[2]!, at: 0, visits: [] } },
    };
    const r = applyAutoArrange(told, days, { writeUsual: false, rangeTo: RANGE_TO });
    expect(r.appliedDays).toEqual([dates[0]]);
    expect(r.skippedDays).toEqual([dates[1], dates[2]]);
    expect(r.written).toBe(1);
    expect(staffOf(r.data, `${dates[1]}_pn`)).toBeNull();
    expect(staffOf(r.data, `${dates[2]}_pn`)).toBeNull();
    expect(applyAutoArrange(told, [], { writeUsual: false, rangeTo: RANGE_TO }).data).toBe(told);
  });

  it('組めなかった対象は担当なしのまま（書かない）', () => {
    const day = dayOf(d, dates[0]!);
    const none = { ...day, routes: {} };
    const r = applyAutoArrange(d, [none], { writeUsual: false, rangeTo: RANGE_TO });
    expect(r.written).toBe(0);
    expect(r.data).toBe(d);
  });
});

describe('繰り返しの担当（D376）', () => {
  const d = withNew(unassigned());
  const dates = [0, 1, 2, 3].map((i) => addDays(TODAY, i));

  /** 最初の日の解きから、別の人を1人選ぶ */
  const solved = dates.map((x) => dayOf(d, x));
  const staffIds = (day: AutoDay) =>
    Object.entries(day.routes).flatMap(([s, list]) => (list.includes(`${day.date}_pn`) ? [s] : []));

  it('書いた回で最も多く付いた担当を usualStaffId に書く。別の人に付いた回・組めなかった回は保存した回として正しく残る', () => {
    const main = staffIds(solved[0]!)[0]!;
    // 0・1・3日目は main、2日目は別の人、…を手で作る（組めなかった回は4日目）
    const other = d.staff.find((s) => s.active && s.id !== main)!.id;
    const asStaff = (day: AutoDay, staffId: string): AutoDay => ({ ...day, routes: { [staffId]: [`${day.date}_pn`] } });
    const days: AutoDay[] = [
      asStaff(solved[0]!, main),
      asStaff(solved[1]!, main),
      asStaff(solved[2]!, other),
      { ...solved[3]!, routes: {} },
    ];
    const r = applyAutoArrange(d, days, { writeUsual: true, rangeTo: RANGE_TO });
    expect(r.data.patterns.find((p) => p.id === 'pn')!.usualStaffId).toBe(main);
    expect(staffOf(r.data, `${dates[0]}_pn`)).toBe(main);
    expect(staffOf(r.data, `${dates[1]}_pn`)).toBe(main);
    // 別の人に付いた回はその人
    expect(staffOf(r.data, `${dates[2]}_pn`)).toBe(other);
    // 組めなかった回は担当なしのまま（繰り返しの担当に引きずられない）
    expect(staffOf(r.data, `${dates[3]}_pn`)).toBeNull();
    expect(r.written).toBe(3);
    // 範囲の外の回（4日目より後）は繰り返しの担当のとおり
    expect(staffOf(r.data, `${addDays(RANGE_TO, 1)}_pn`)).toBe(main);
    expect(staffOf(r.data, `${addDays(TODAY, 10)}_pn`)).toBe(main);
  });

  it('同数なら早い日の担当。すでに繰り返しの担当がある繰り返しは変えない', () => {
    const a = staffIds(solved[0]!)[0]!;
    const b = d.staff.find((s) => s.active && s.id !== a)!.id;
    const asStaff = (day: AutoDay, staffId: string): AutoDay => ({ ...day, routes: { [staffId]: [`${day.date}_pn`] } });
    const days = [asStaff(solved[0]!, b), asStaff(solved[1]!, a)];
    const r = applyAutoArrange(d, days, { writeUsual: true, rangeTo: RANGE_TO });
    expect(r.data.patterns.find((p) => p.id === 'pn')!.usualStaffId).toBe(b);
    const set = { ...d, patterns: d.patterns.map((p) => (p.id === 'pn' ? { ...p, usualStaffId: b } : p)) };
    const keep = applyAutoArrange(
      set,
      days.map((x) => ({ ...x, visits: visitsOn(set, x.date), inputs: dayInputsOf(set, x.date) })),
      { writeUsual: true, rangeTo: RANGE_TO },
    );
    expect(keep.data.patterns.find((p) => p.id === 'pn')!.usualStaffId).toBe(b);
  });

  it('writeUsual が偽（単発・ホームの［組む］）なら書かない', () => {
    const main = staffIds(solved[0]!)[0]!;
    const r = applyAutoArrange(d, [{ ...solved[0]!, routes: { [main]: [`${dates[0]}_pn`] } }], {
      writeUsual: false,
      rangeTo: RANGE_TO,
    });
    expect(r.data.patterns.find((p) => p.id === 'pn')!.usualStaffId).toBeNull();
    expect(staffOf(r.data, `${dates[0]}_pn`)).toBe(main);
    expect(staffOf(r.data, `${dates[1]}_pn`)).toBeNull();
  });
});

describe('決まった日（expert 切）の自動の組み（ADR-0073）', () => {
  const off = withNew(unassigned());
  const date = addDays(TODAY, 1);
  const told = { ...off, snapshots: { [date]: { date, at: 0, visits: [] } } };

  it('伝えた日でも担当なしの訪問を埋める。expert 入なら伝えた日は組まない', () => {
    const r = applyAutoArrange(told, [dayOf(told, date)], { writeUsual: false, rangeTo: RANGE_TO });
    expect(r.appliedDays).toEqual([date]);
    expect(staffOf(r.data, `${date}_pn`)).not.toBeNull();
    // 伝えた内容は書き換えない
    expect(r.data.snapshots).toBe(told.snapshots);
    const on = expertOn(told);
    expect(autoDayPlan(on, date, [`${date}_pn`])).toBeNull();
    const skipped = applyAutoArrange(on, [dayOf(told, date)], { writeUsual: false, rangeTo: RANGE_TO });
    expect(skipped.appliedDays).toEqual([]);
  });
});

describe('繰り返しの担当を書いても、過去・伝えた日の回は変えない（D376）', () => {
  const yesterday = addDays(TODAY, -1);
  const d = expertOn(withNew(unassigned(), { from: yesterday }));
  const dates = [0, 1, 2].map((i) => addDays(TODAY, i));

  it('繰り返しの from が昨日のとき、昨日の回は担当なしのまま。伝えた日・飛ばした日の回も変わらない', () => {
    const told = {
      ...d,
      snapshots: { [dates[1]!]: { date: dates[1]!, at: 0, visits: [] } },
    };
    const days = dates.map((x) => dayOf(d, x));
    const r = applyAutoArrange(told, days, { writeUsual: true, rangeTo: RANGE_TO });
    const usual = r.data.patterns.find((p) => p.id === 'pn')!.usualStaffId;
    expect(usual).not.toBeNull();
    expect(staffOf(r.data, `${yesterday}_pn`)).toBeNull();
    // 伝えた日（飛ばした日）の回は書かず、担当なしのまま
    expect(r.skippedDays).toEqual([dates[1]]);
    expect(staffOf(r.data, `${dates[1]}_pn`)).toBeNull();
    expect(staffOf(r.data, `${dates[0]}_pn`)).not.toBeNull();
    // 範囲より後の回だけが新しい担当になる
    expect(staffOf(r.data, `${addDays(RANGE_TO, 1)}_pn`)).toBe(usual);
  });
});

describe('ほかの担当の訪問の開始・並びを崩さない（pins は担当だけを固めるため）', () => {
  const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  /** 1人だけが働く日：その人の既存の訪問を開始つきの固定の時刻にした、デモのデータ */
  function oneStaff() {
    const b = createDemoData(TODAY);
    const vs = visitsOn(b, TODAY);
    const count = new Map<string, number>();
    for (const v of vs) if (v.staffId) count.set(v.staffId, (count.get(v.staffId) ?? 0) + 1);
    const A = [...count].sort((x, y) => y[1] - x[1])[0]![0];
    const mine = vs.filter((v) => v.staffId === A);
    const edited = vs.map((v) =>
      v.staffId === A
        ? { ...v, windowKind: 'window' as const, earliestStart: '08:00', latestStart: '16:00' }
        : { ...v, cancelled: true },
    );
    let d = { ...b, staff: b.staff.map((s) => ({ ...s, active: s.id === A })), visits: putVisits(b.visits, edited) };
    d = settleDay(d, TODAY);
    const fixed = visitsOn(d, TODAY)
      .filter((v) => v.staffId === A)
      .map((v) => ({ ...v, windowKind: 'fixed' as const, earliestStart: v.start!, latestStart: v.start! }));
    d = { ...d, visits: putVisits(d.visits, fixed) };
    const cid = b.clients.find((c) => c.active && !mine.some((m) => m.clientId === c.id))!.id;
    return { d, A, cid, first: visitsOn(d, TODAY).find((v) => v.staffId === A)! };
  }

  it('対象を入れても既存の訪問の開始は変わらず、同じ人に時間の重なりが出ない', () => {
    const { d, A, cid, first } = oneStaff();
    const before = visitsOn(d, TODAY).filter((v) => v.staffId === A);
    expect(before.length).toBeGreaterThan(1);
    for (const t0 of ['08:00', '08:30', '09:30', '10:30', '11:00', '12:00', '13:00']) {
      const target = {
        ...first,
        id: 'T',
        clientId: cid,
        staffId: null,
        start: null,
        pinned: false,
        pattern: null,
        earliestStart: t0,
        latestStart: t0,
        windowKind: 'fixed' as const,
        durationMinutes: 60,
      };
      const d2 = { ...d, visits: [...d.visits, target] };
      const plan = autoDayPlan(d2, TODAY, ['T'])!;
      const res = solve(plan.problem, autoSolveOptions(d2, plan));
      const day: AutoDay = {
        date: TODAY,
        problem: plan.problem,
        visits: plan.visits,
        inputs: dayInputsOf(d2, TODAY),
        routes: res.routes,
        targetIds: plan.targetIds,
      };
      const r = applyAutoArrange(d2, [day], { writeUsual: false, rangeTo: TODAY });
      const list = visitsOn(r.data, TODAY)
        .filter((v) => v.staffId === A && v.start)
        .sort((x, y) => hm(x.start!) - hm(y.start!));
      // 既存の訪問の開始は変わらない
      for (const v of before) expect(findVisit(r.data, v.id)!.start, `${t0} ${v.id}`).toBe(v.start);
      // 同じ人に重なりが出ない
      for (let j = 1; j < list.length; j++)
        expect(hm(list[j - 1]!.start!) + list[j - 1]!.durationMinutes, `${t0}`).toBeLessThanOrEqual(
          hm(list[j]!.start!),
        );
    }
  });

  it('解いた列で既存の訪問が動くときは、その担当への対象を書かない（担当なしのまま）', () => {
    const { d, A, cid, first } = oneStaff();
    const target = {
      ...first,
      id: 'T',
      clientId: cid,
      staffId: null,
      start: null,
      pinned: false,
      pattern: null,
      earliestStart: first.start!,
      latestStart: first.start!,
      windowKind: 'fixed' as const,
      durationMinutes: 60,
    };
    const d2 = { ...d, visits: [...d.visits, target] };
    const plan = autoDayPlan(d2, TODAY, ['T'])!;
    // 既存の訪問と同じ時刻に対象を先頭で入れた列（既存の訪問が遅れる）
    const existing = visitsOn(d2, TODAY)
      .filter((v) => v.staffId === A)
      .map((v) => v.id);
    const day: AutoDay = {
      date: TODAY,
      problem: plan.problem,
      visits: plan.visits,
      inputs: dayInputsOf(d2, TODAY),
      routes: { [A]: ['T', ...existing] },
      targetIds: ['T'],
    };
    const r = applyAutoArrange(d2, [day], { writeUsual: false, rangeTo: TODAY });
    expect(r.written).toBe(0);
    expect(findVisit(r.data, 'T')!.staffId).toBeNull();
  });
});

describe('繰り返しの担当を書くとき、解いた担当・開始が計算した回と同じでも担当なしに戻さない', () => {
  it('標準の開始（usualStarts）と同じ開始で組めた回も、その担当のまま', () => {
    const base = withNew(unassigned());
    const np = base.patterns.find((p) => p.id === 'pn')!;
    const d = {
      ...base,
      patterns: base.patterns.map((p) =>
        p.id === 'pn' ? { ...np, usualStarts: [0, 1, 2, 3, 4, 5, 6].map((w) => ({ weekday: w, start: '10:00' })) } : p,
      ),
    };
    const dates = [0, 1, 2].map((i) => addDays(TODAY, i));
    const days = dates.map((x) => dayOf(d, x));
    const r = applyAutoArrange(d, days, { writeUsual: true, rangeTo: RANGE_TO });
    expect(r.written).toBe(3);
    for (const x of dates) expect(staffOf(r.data, `${x}_pn`)).not.toBeNull();
  });
});
