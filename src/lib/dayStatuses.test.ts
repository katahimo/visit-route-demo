import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';
import type { CompileInput } from '../matching';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures';
import { createDayStatusMemo } from './dayStatuses';
import { dayStatus } from './month';

/** compile が読むデータだけ（components/useDayModel の useCompileInput と同じキー） */
const inputOf = (d: DemoData): CompileInput => ({
  org: d.org,
  items: d.items,
  rules: d.rules,
  staff: d.staff,
  clients: d.clients,
  compat: d.compat,
  visits: d.visits,
  availability: d.availability,
  absences: d.absences,
  visitTypes: d.visitTypes,
  patterns: d.patterns,
  clientLeaves: d.clientLeaves,
});

const data = () =>
  makeData({
    staff: [staff('s1', 38.26, 140.87)],
    clients: [client('c1', 38.27, 140.88)],
    visits: [
      visit('v1', 'c1', '09:00', '10:00', { staffId: 's1' }),
      visit('v2', 'c1', '09:00', '10:00', { date: addDays(DATE, 1) }),
    ],
  });

describe('createDayStatusMemo（日ごとの状態と覚え）', () => {
  it('lib/month の dayStatus と同じ状態。訪問の無い日は問題を作らない', () => {
    const d = data();
    const days = [DATE, addDays(DATE, 1), addDays(DATE, 2)];
    const r = createDayStatusMemo().statusesOf(d.snapshots, inputOf(d), days);
    expect([...r.keys()]).toEqual(days);
    for (const day of days) {
      const x = r.get(day)!;
      expect(x.status).toEqual(dayStatus(d, day, x.problem));
    }
    expect(r.get(DATE)!.problem).not.toBeNull();
    expect(r.get(addDays(DATE, 2))!.problem).toBeNull();
    expect(r.get(DATE)!.status.count).toBe(1);
    expect(r.get(addDays(DATE, 1))!.status.unassigned).toBe(1);
  });
  it('入力が同じもの（===）なら覚えを使う。入れ物を作り直しても中身が同じなら使う', () => {
    const d = data();
    const memo = createDayStatusMemo();
    const a = memo.statusesOf(d.snapshots, inputOf(d), [DATE]);
    const b = memo.statusesOf(d.snapshots, inputOf(d), [DATE]);
    expect(b.get(DATE)!.status).toBe(a.get(DATE)!.status);
    expect(b.get(DATE)!.problem).toBe(a.get(DATE)!.problem);
  });
  it('訪問・compile が読むデータが変われば計算し直す', () => {
    const d = data();
    const memo = createDayStatusMemo();
    const a = memo.statusesOf(d.snapshots, inputOf(d), [DATE]).get(DATE)!;
    const moved = { ...d, visits: d.visits.map((v) => (v.id === 'v1' ? { ...v, staffId: null } : v)) };
    const b = memo.statusesOf(moved.snapshots, inputOf(moved), [DATE]).get(DATE)!;
    expect(b.status).not.toBe(a.status);
    expect(b.status.unassigned).toBe(1);
    const ruled = { ...d, rules: [] };
    expect(memo.statusesOf(d.snapshots, inputOf(ruled), [DATE]).get(DATE)!.status).not.toBe(a.status);
  });
  it('日付ごとに最近の perDay 件・maxDays 日まで覚える（古いものから捨てる）', () => {
    const d = data();
    const memo = createDayStatusMemo(1, 1);
    const input = inputOf(d);
    const a = memo.statusesOf(d.snapshots, input, [DATE]).get(DATE)!;
    memo.statusesOf(d.snapshots, input, [addDays(DATE, 1)]);
    // 日付の数の上限で DATE の覚えは捨てた
    expect(memo.statusesOf(d.snapshots, input, [DATE]).get(DATE)!.status).not.toBe(a.status);
    const memo2 = createDayStatusMemo(2, 5);
    const x = memo2.statusesOf(d.snapshots, input, [DATE]).get(DATE)!;
    memo2.statusesOf(d.snapshots, inputOf({ ...d, rules: [] }), [DATE]);
    // 同じ日に2件まで覚えるので、前の入力に戻せば覚えを使う
    expect(memo2.statusesOf(d.snapshots, input, [DATE]).get(DATE)!.status).toBe(x.status);
  });
});
