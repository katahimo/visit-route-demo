// 決まった予定（ADR-0073。PRD D382）：expert 切のとき、visits が変わった日（今日〜1か月先）に自動で伝えた記録を付ける
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures.testkit';
import { putVisits } from '../patterns';
import { dayProblemOf, dayRoutes, toldChanges, toldStateOf, writeRoutes } from './dayPlan';
import { createHistory } from './history';
import { assignMany, cancelMany, moveManyToDate } from './multiEdit';
import { autoTell, settleDates, settledUntil, settleUpdate } from './settled';

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
  it('今回入れた・変えた訪問が担当なし・ピンなしの日は付けない（自動の組みが担当を付けたあとの update で付く）。前からの担当なしは待たない', () => {
    const before = base({ visits: [fixed('a', '09:00', { staffId: 's1' })] });
    const added = { ...before, visits: [...before.visits, fixed('b', '11:00')] };
    expect(autoTell(before, added, TODAY, AT).snapshots).toEqual({});
    const arranged = {
      ...added,
      visits: putVisits(added.visits, [{ ...added.visits[1]!, staffId: 's2', start: '11:00' }]),
    };
    expect(autoTell(added, arranged, TODAY, AT).snapshots[DATE]!.visits.map((x) => x.staffId)).toEqual(['s1', 's2']);
    // 前からある担当なしの訪問（b）が残る日は、別の訪問（a）を手で直しても付けない（要対応が残る日。ADR-0089）
    const edited = {
      ...added,
      visits: putVisits(added.visits, [{ ...added.visits[0]!, staffId: 's2', start: '09:00' }]),
    };
    expect(autoTell(added, edited, TODAY, AT).snapshots).toEqual({});
  });
  it('帯の種類（担当なし・間に合わない・重なり・休みの人）の訪問が残る日は付けず、直して無くなったときに付ける（ADR-0089）', () => {
    const before = base({ visits: [fixed('a', '09:00', { staffId: 's1' }), fixed('b', '11:00', { staffId: 's2' })] });
    // b を a と同じ 9:00・同じ s1 にする＝重なり
    const overlap = {
      ...before,
      visits: putVisits(before.visits, [
        { ...before.visits[1]!, staffId: 's1', earliestStart: '09:00', latestStart: '09:00', start: null },
      ]),
    };
    const out = autoTell(before, overlap, TODAY, AT);
    expect(out.snapshots[DATE]).toBeUndefined();
    // 担当を s2 に直すと重なりが無くなり、その操作で付く
    const fixedDay = {
      ...out,
      visits: putVisits(out.visits, [{ ...overlap.visits[1]!, staffId: 's2', start: '09:00' }]),
    };
    expect(autoTell(out, fixedDay, TODAY, AT + 1).snapshots[DATE]).toMatchObject({ at: AT + 1 });
    // すでに伝えた日は、あとで重なりができても記録はそのまま（その後の変更は「変更あり」）
    const told = autoTell(out, fixedDay, TODAY, AT + 1);
    expect(autoTell(told, { ...told, visits: overlap.visits }, TODAY, AT + 2).snapshots[DATE]!.at).toBe(AT + 1);
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

describe('待ちの条件（自動の組みの依頼が出る訪問だけ待つ）', () => {
  it('担当を外した（担当なしの列へ）日は、担当なしが残るので付けない（ADR-0089）', () => {
    const before = base({ visits: [fixed('a', '09:00', { staffId: 's1' }), fixed('b', '11:00', { staffId: 's2' })] });
    const none = {
      ...before,
      visits: putVisits(before.visits, [{ ...before.visits[1]!, staffId: null, start: null }]),
    };
    expect(autoTell(before, none, TODAY, AT).snapshots[DATE]).toBeUndefined();
  });
  it('別の日へ移した担当なしの訪問は待つ。依頼を出さない保存（wait:false）でも担当なしが残る日は付けない', () => {
    const before = base({ visits: [fixed('a', '09:00', { staffId: 's1' }), fixed('b', '11:00')] });
    const day = addDays(TODAY, 1);
    const moved = { ...before, visits: putVisits(before.visits, [{ ...before.visits[1]!, date: day }]) };
    // 元の日（a だけ残る）は付き、移した先は付かない
    expect(Object.keys(autoTell(before, moved, TODAY, AT).snapshots)).toEqual([TODAY]);
    expect(Object.keys(autoTell(before, moved, TODAY, AT, { wait: false }).snapshots)).toEqual([TODAY]);
  });
});

describe('settleDates（自動の組みが終わったとき。待っていた日を終わらせる）', () => {
  it('範囲内で伝えた記録の無い日に付ける。付いている日・範囲外・今日より前は変えない', () => {
    const d = base({
      visits: [fixed('a', '09:00', { staffId: 's1' }), fixed('b', '09:00', { date: addDays(TODAY, 1), staffId: 's2' })],
    });
    const out = settleDates(
      d,
      [TODAY, addDays(TODAY, 1), addDays(TODAY, -1), addDays(settledUntil(TODAY), 1)],
      TODAY,
      AT,
    );
    expect(Object.keys(out.snapshots).sort()).toEqual([TODAY, addDays(TODAY, 1)]);
    expect(out.snapshots[TODAY]!.at).toBe(AT);
    // 付いている日は書き換えない
    expect(settleDates(out, [TODAY], TODAY, AT + 1).snapshots[TODAY]!.at).toBe(AT);
  });
  it('expert 入なら何もしない', () => {
    const d = base({ org: { ...makeData().org, features: { expert: true } } });
    expect(settleDates(d, [TODAY], TODAY, AT)).toBe(d);
  });
  it('組めずに要対応（担当なし）が残る日は付けない（ADR-0089）', () => {
    const d = base({ visits: [fixed('a', '09:00', { staffId: 's1' }), fixed('b', '11:00')] });
    expect(settleDates(d, [TODAY], TODAY, AT).snapshots).toEqual({});
  });
});

describe('settleUpdate（store の update が使う1か所）', () => {
  const NOW = Date.parse('2026-10-12T12:00:00+09:00');
  const edit = (d: DemoData) => writeRoutes(d, DATE, dayProblemOf(d, DATE)!, { s2: ['v1', 'v2'] });

  it('今日（日本時間）の日に伝えた記録を付ける。tell:false なら付けない', () => {
    const before = base();
    const made = edit(before);
    expect(settleUpdate(before, made, undefined, NOW).snapshots[DATE]!.at).toBe(NOW);
    expect(settleUpdate(before, made, { tell: false }, NOW)).toBe(made);
  });
  it('設定の操作（訪問の種類を消すなど visits を書くが予定の直しでない）は tell:false で記録しない', () => {
    const before = base({ visits: [fixed('a', '09:00', { staffId: 's1', typeId: 't1' })] });
    const made = { ...before, visits: before.visits.map((v) => ({ ...v, typeId: null })) };
    expect(Object.keys(settleUpdate(before, made, undefined, NOW).snapshots)).toEqual([DATE]);
    expect(settleUpdate(before, made, { tell: false }, NOW).snapshots).toEqual({});
  });
  it('記録は同じ1手に入り、元に戻すで一緒に戻る（履歴は前後のデータを持つ）', () => {
    const before = base();
    const after = settleUpdate(before, edit(before), undefined, NOW);
    const h = createHistory();
    h.record(before, after, '手直し');
    const r = h.undo(after);
    expect(r!.data).toBe(before);
    expect(r!.data.snapshots).toEqual({});
  });
});
