// 決まった予定（ADR-0073。PRD D382）：expert 切のとき、visits が変わった日（今日〜1か月先）に自動で伝えた記録を付ける
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures.testkit';
import { putVisits } from '../patterns';
import { dayProblemOf, dayRoutes, toldChanges, toldStateOf, writeRoutes } from './dayPlan';
import { assignMany, cancelMany, moveManyToDate } from './multiEdit';
import { autoTell, isSettledDate, settledUntil } from './settled';

const fixed = (id: string, at: string, over = {}) => visit(id, 'c1', at, at, { windowKind: 'fixed', ...over });
const TODAY = DATE;
const AT = 1234;

function base(over: Partial<DemoData> = {}): DemoData {
  return makeData({
    org: { ...makeData().org, features: { expert: false } },
    staff: [staff('s1', 38.26, 140.87), staff('s2', 38.262, 140.872)],
    clients: [client('c1', 38.261, 140.871)],
    visits: [fixed('v1', '09:00', { staffId: 's1' }), fixed('v2', '11:00')],
    ...over,
  });
}

describe('settledUntil（今日の1か月後の同じ日。無い日は月末）', () => {
  it('月末の繰り下げと年またぎ', () => {
    expect(settledUntil('2026-10-30')).toBe('2026-11-30');
    expect(settledUntil('2026-10-31')).toBe('2026-11-30');
    expect(settledUntil('2026-01-31')).toBe('2026-02-28');
    expect(settledUntil('2028-01-31')).toBe('2028-02-29');
    expect(settledUntil('2026-12-31')).toBe('2027-01-31');
    expect(settledUntil('2026-10-12')).toBe('2026-11-12');
  });
  it('範囲は両端を含み、今日より前・先の日は外', () => {
    expect(isSettledDate('2026-10-30', '2026-10-30')).toBe(true);
    expect(isSettledDate('2026-11-30', '2026-10-30')).toBe(true);
    expect(isSettledDate('2026-12-01', '2026-10-30')).toBe(false);
    expect(isSettledDate('2026-10-29', '2026-10-30')).toBe(false);
  });
});

describe('autoTell', () => {
  it('手で直した日（visits が変わった日）に、その日の問題で伝えた記録を付ける', () => {
    const before = base();
    const p = dayProblemOf(before, DATE)!;
    const after = writeRoutes(before, DATE, p, { s2: ['v1', 'v2'] });
    const out = autoTell(before, after, TODAY, AT);
    expect(out.snapshots[DATE]).toMatchObject({ date: DATE, at: AT });
    expect(out.snapshots[DATE]!.visits.map((x) => [x.id, x.staffId])).toEqual([
      ['v1', 's2'],
      ['v2', 's2'],
    ]);
    expect(out.visits).toBe(after.visits);
  });
  it('伝えた記録のある日は書き換えず、そのあとの変更は「変更あり」になる', () => {
    const d0 = base();
    const d1 = autoTell(d0, writeRoutes(d0, DATE, dayProblemOf(d0, DATE)!, { s2: ['v1', 'v2'] }), TODAY, AT);
    const d2 = writeRoutes(d1, DATE, dayProblemOf(d1, DATE)!, { s1: ['v1'], s2: ['v2'] });
    const out = autoTell(d1, d2, TODAY, AT + 1);
    expect(out).toBe(d2);
    expect(out.snapshots[DATE]!.at).toBe(AT);
    const p = dayProblemOf(out, DATE)!;
    expect(toldStateOf(out, DATE, toldChanges(out, DATE, p, dayRoutes(out, DATE, p)))).toBe('changed');
  });
  it('expert 入なら何もしない', () => {
    const before = base({ org: { ...makeData().org, features: { expert: true } } });
    const after = writeRoutes(before, DATE, dayProblemOf(before, DATE)!, { s2: ['v1', 'v2'] });
    expect(autoTell(before, after, TODAY, AT)).toBe(after);
    // features に expert の記載が無い（既定は入）ときも
    const none = makeData({ ...before, org: { ...before.org, features: {} } });
    expect(autoTell(none, { ...none, visits: after.visits }, TODAY, AT).snapshots).toEqual({});
  });
  it('visits が変わらない操作（visits の外だけ・同じ中身の作り直し）は記録しない', () => {
    const before = base();
    expect(autoTell(before, { ...before, staff: [...before.staff] }, TODAY, AT).snapshots).toEqual({});
    expect(autoTell(before, { ...before, visits: before.visits.map((v) => ({ ...v })) }, TODAY, AT).snapshots).toEqual(
      {},
    );
  });
  it('今日より前・1か月先より後の日は変えない。範囲の両端の日は付ける', () => {
    const yesterday = addDays(TODAY, -1);
    const last = settledUntil(TODAY);
    const beyond = addDays(last, 1);
    const before = base({
      visits: [
        fixed('past', '09:00', { date: yesterday }),
        fixed('last', '09:00', { date: last }),
        fixed('beyond', '09:00', { date: beyond }),
        fixed('today', '09:00'),
      ],
    });
    const after = { ...before, visits: before.visits.map((v) => ({ ...v, staffId: 's1' })) };
    const out = autoTell(before, after, TODAY, AT);
    expect(Object.keys(out.snapshots).sort()).toEqual([TODAY, last]);
  });
  it('変わった日だけ付ける（ほかの日は付けない）', () => {
    const other = addDays(TODAY, 2);
    const before = base({ visits: [fixed('a', '09:00'), fixed('b', '09:00', { date: other })] });
    const after = {
      ...before,
      visits: putVisits(before.visits, [{ ...before.visits[1]!, staffId: 's1', start: '09:00' }]),
    };
    expect(Object.keys(autoTell(before, after, TODAY, AT).snapshots)).toEqual([other]);
  });
  it('訪問の追加・取り消しも拾う。計算に入れる訪問が無い日は付けない', () => {
    const before = base({ visits: [fixed('a', '09:00', { staffId: 's1' })] });
    const added = { ...before, visits: [...before.visits, fixed('b', '11:00', { staffId: 's2' })] };
    expect(autoTell(before, added, TODAY, AT).snapshots[DATE]!.visits).toHaveLength(2);
    const cancelled = { ...before, visits: [{ ...before.visits[0]!, cancelled: true }] };
    expect(autoTell(before, cancelled, TODAY, AT).snapshots).toEqual({});
  });
  it('担当なし・ピンなしの訪問が残る日は付けない（自動の組みが担当を付けたあとの update で付く）', () => {
    const before = base({ visits: [fixed('a', '09:00', { staffId: 's1' })] });
    const added = { ...before, visits: [...before.visits, fixed('b', '11:00')] };
    expect(autoTell(before, added, TODAY, AT).snapshots).toEqual({});
    const arranged = {
      ...added,
      visits: putVisits(added.visits, [{ ...added.visits[1]!, staffId: 's2', start: '11:00' }]),
    };
    expect(autoTell(added, arranged, TODAY, AT).snapshots[DATE]!.visits.map((x) => x.staffId)).toEqual(['s1', 's2']);
  });
  it('まとめて直す（multiEdit）の結果も拾う', () => {
    const before = base();
    const r = assignMany(before, ['v2'], 's2', TODAY);
    expect(r.done).toBe(1);
    expect(autoTell(before, r.data, TODAY, AT).snapshots[DATE]).toBeTruthy();
    const c = cancelMany(before, ['v2'], TODAY);
    expect(autoTell(before, c.data, TODAY, AT).snapshots[DATE]!.visits.map((x) => x.id)).toEqual(['v1']);
    const staffed = assignMany(before, ['v2'], 's2', TODAY).data;
    const m = moveManyToDate(staffed, ['v2'], addDays(TODAY, 1), TODAY);
    expect(Object.keys(autoTell(staffed, m.data, TODAY, AT).snapshots).sort()).toEqual([TODAY, addDays(TODAY, 1)]);
  });
});
