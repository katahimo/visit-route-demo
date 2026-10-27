import { describe, expect, it } from 'vitest';
import type { ClientLeave } from '../contracts/documents';
import { visit } from '../matching/fixtures.testkit';
import type { ClientDay, DayStatus, StaffDay } from './month';
import type { BatchRun } from './monthBatch';
import {
  batchProgressValue,
  focusDayVisits,
  monthClientIds,
  monthFeatures,
  monthFocusOf,
  monthFocusPatch,
  monthFocusValue,
  monthListEntries,
  monthPrintHref,
  monthStaffClientPairs,
  monthSummary,
  monthUsualRest,
  offNoteOf,
  sameList,
  selectedCountByDate,
  visitRowState,
  visitRowTime,
} from './monthView';

const D1 = '2026-11-02';
const D2 = '2026-11-03';

const status = (date: string, over: Partial<DayStatus> = {}): DayStatus => ({
  date,
  count: 1,
  state: 'none',
  unassigned: 0,
  issues: new Map(),
  care: 0,
  changes: 0,
  absence: false,
  overSpan: [],
  needsCare: false,
  ...over,
});

describe('表示の選択', () => {
  const staff = [{ id: 's1' }];
  const clients = [{ id: 'c1' }];
  it('monthFocusOf：稼働している人だけ。〈スタッフ〉が先', () => {
    expect(monthFocusOf('s1', 'c1', staff, clients)).toEqual({ kind: 'staff', id: 's1' });
    expect(monthFocusOf('x', 'c1', staff, clients)).toEqual({ kind: 'client', id: 'c1' });
    expect(monthFocusOf(null, 'x', staff, clients)).toEqual({ kind: 'all' });
  });
  it('monthFocusValue：〈利用者さん〉は検索欄で選ぶので1つの値', () => {
    expect(monthFocusValue(false, { kind: 'all' })).toBe('all');
    expect(monthFocusValue(true, { kind: 'all' })).toBe('client');
    expect(monthFocusValue(false, { kind: 'client', id: 'c1' })).toBe('client');
    expect(monthFocusValue(false, { kind: 'staff', id: 's1' })).toBe('staff:s1');
  });
  it('monthFocusPatch：〈利用者さん〉を選んだら〈スタッフ〉を外して待つ（選んでいれば変えない）', () => {
    expect(monthFocusPatch('client', 'staff')).toEqual({ staff: null, client: null });
    expect(monthFocusPatch('client', 'client')).toBeNull();
    expect(monthFocusPatch('staff:a:b', 'all')).toEqual({ staff: 'a:b', client: null });
    expect(monthFocusPatch('all', 'staff')).toEqual({ staff: null, client: null });
  });
  it('monthPrintHref：〈スタッフ〉を選んでいればその人の分', () => {
    expect(monthPrintHref('2026-11', { kind: 'all' })).toBe('/month/print?ym=2026-11');
    expect(monthPrintHref('2026-11', { kind: 'staff', id: 'a b' })).toBe('/month/print?ym=2026-11&staff=a%20b');
    expect(monthPrintHref('2026-11', { kind: 'client', id: 'c1' })).toBe('/month/print?ym=2026-11');
  });
  it('monthFeatures：既定はどれも入', () => {
    expect(monthFeatures({})).toEqual({ print: true, requested: true, workload: true, sudden: true });
    expect(monthFeatures({ requestedOff: false }).requested).toBe(false);
  });
});

describe('日ごとの数', () => {
  const visits = new Map([
    [
      D1,
      [
        visit('v1', 'c1', '09:00', '09:00', { date: D1 }),
        visit('v2', 'c2', '10:00', '10:00', { date: D1, cancelled: true, cancelKind: 'sameDay' }),
      ],
    ],
    [D2, [visit('v3', 'c3', '09:00', '09:00', { date: D2 })]],
  ]);
  it('monthSummary：担当なしと当日キャンセル', () => {
    const st = new Map([
      [D1, status(D1, { unassigned: 2 })],
      [D2, status(D2, { unassigned: 1 })],
    ]);
    expect(monthSummary([D1, D2], st, visits)).toEqual({ unassigned: 3, sameDay: 1 });
  });
  it('monthClientIds：取り消し・休みの訪問の人は入れない', () => {
    const leaves: ClientLeave[] = [{ id: 'l', clientId: 'c3', from: D2, to: D2, note: '' }];
    expect([...monthClientIds([D1, D2], visits, leaves)]).toEqual(['c1']);
  });
  it('monthStaffClientPairs：案の担当と〈利用者さん〉の組', () => {
    const plans = new Map([[D1, { routes: { s1: ['v1', 'vx'] } }]]);
    expect(monthStaffClientPairs([D1, D2], plans, visits)).toEqual([
      ['s1', 'c1'],
      ['s1', undefined],
    ]);
  });
  it('monthUsualRest：この月の日だけで曜日ごとのふだんを数える', () => {
    const marks = new Map([[D1, { off: ['a'], requested: ['b'] }]]);
    const u = monthUsualRest(['2026-10-26', D1], '2026-11', marks);
    expect(u[1]).toBe(2);
  });
  it('selectedCountByDate：選んだ訪問のある日だけ', () => {
    expect([...selectedCountByDate([D1, D2], visits, ['v1', 'v2'])]).toEqual([[D1, 2]]);
  });
});

describe('その日の回', () => {
  const a = visit('b', 'c1', '10:00', '11:00', { staffId: 's1' });
  const b = visit('a', 'c2', '10:00', '11:00', { staffId: 's2' });
  const c = visit('c', 'c1', '08:00', '09:00', { start: '12:00', staffId: 's1' });
  it('focusDayVisits：その人の回だけ、開始の順（同じなら ID の順）', () => {
    expect(focusDayVisits([a, b, c], { kind: 'all' }).map((v) => v.id)).toEqual(['a', 'b', 'c']);
    expect(focusDayVisits([a, b, c], { kind: 'staff', id: 's1' }).map((v) => v.id)).toEqual(['b', 'c']);
    expect(focusDayVisits([a, b, c], { kind: 'client', id: 'c2' }).map((v) => v.id)).toEqual(['a']);
  });
  it('visitRowTime・visitRowState', () => {
    expect(visitRowTime(c)).toBe('12:00〜13:00');
    expect(visitRowTime(a)).toBe('10:00〜11:00');
    expect(visitRowTime(visit('x', 'c', '09:00', '09:00'))).toBe('9:00〜10:00');
    expect(visitRowState({ cancelled: true, cancelKind: 'sameDay' }, false)).toBe('当日キャンセル');
    expect(visitRowState({ cancelled: true, cancelKind: null }, true)).toBe('取り消し');
    expect(visitRowState({ cancelled: false, cancelKind: null }, true)).toBe('休みのため無し');
    expect(visitRowState({ cancelled: false, cancelKind: null }, false)).toBeNull();
  });
});

describe('monthListEntries', () => {
  const base = {
    days: [D1, D2, '2026-11-04'],
    statuses: new Map([
      [D1, status(D1)],
      [D2, status(D2)],
    ]),
    today: '2026-11-01',
    staffDays: new Map<string, StaffDay>(),
    clientDays: new Map<string, ClientDay>(),
    staffName: (id: string) => (id === 's1' ? '消防 まもる' : ''),
    offStateOf: () => undefined,
    attentionByDate: new Map([[D2, 2]]),
  };
  it('日の状態の無い日は出さない。要対応の札の数を行に入れる', () => {
    const rows = monthListEntries({ ...base, focus: 'all' });
    expect(rows.map((r) => r.row.date)).toEqual([D1, D2]);
    expect(rows[1]!.row.attention).toBe(2);
    expect(rows[0]!.extra).toEqual([]);
  });
  it('〈スタッフ〉：休み・欠勤・担当の件数。「休みを入れる」の説明', () => {
    const sd = {
      slots: [],
      off: true,
      absence: null,
      requested: false,
      retired: false,
      count: 1,
    } as unknown as StaffDay;
    const rows = monthListEntries({
      ...base,
      focus: 'staff',
      staffDays: new Map([[D1, sd]]),
      offStateOf: (d) => (d === D1 ? 'noShift' : undefined),
    });
    expect(rows[0]!.extra).toEqual(['休み', '担当 1件', '勤務の無い日です（押せません）']);
    expect(rows[0]!.off).toBe('noShift');
    expect(rows[0]!.row.label).toContain('休み・担当 1件');
  });
  it('〈利用者さん〉：時刻と担当（取り消し・休み・入らない・担当未定）', () => {
    const v = { visitId: 'v', start: 540, typeId: null, substitute: false, edited: false, sameDay: false };
    const cd: ClientDay = {
      date: D1,
      visits: [
        { ...v, staffId: 's1', cancelled: false, leave: false, unassigned: false },
        { ...v, staffId: null, cancelled: true, leave: false, unassigned: false },
        { ...v, staffId: null, cancelled: false, leave: true, unassigned: false },
        { ...v, staffId: null, cancelled: false, leave: false, unassigned: true },
        { ...v, staffId: null, cancelled: false, leave: false, unassigned: false },
      ],
    };
    const rows = monthListEntries({ ...base, focus: 'client', clientDays: new Map([[D1, cd]]) });
    expect(rows[0]!.extra).toEqual(['9:00 消防、9:00 取り消し、9:00 休み、9:00 入らない、9:00 担当未定']);
  });
});

describe('そのほか', () => {
  it('batchProgressValue：日の番号＋その日の計算の進み（1まで）', () => {
    const r = (over: Partial<BatchRun>) => ({ index: 2, iteration: 50, total: 100, ...over });
    expect(batchProgressValue(r({}))).toBe(2.5);
    expect(batchProgressValue(r({ iteration: 300 }))).toBe(3);
    expect(batchProgressValue(r({ total: 0 }))).toBe(2);
  });
  it('offNoteOf：付けた日に訪問があれば注意（欠勤の機能が入なら「欠勤を直す」へ）', () => {
    const base = { date: D1, name: '消防', suddenOn: true };
    expect(offNoteOf({ ...base, result: 'removed', count: 3 })).toEqual({
      date: D1,
      warn: false,
      text: '11/2 の希望休を外しました',
    });
    expect(offNoteOf({ ...base, result: 'added', count: 0 }).text).toBe('11/2 を希望休にしました');
    const warn = offNoteOf({ ...base, result: 'added', count: 2 });
    expect(warn.warn).toBe(true);
    expect(warn.text).toBe(
      '11/2 を希望休にしました。消防さんにこの日の訪問が 2件あります。日の予定のその人の列の「欠勤を直す」から振り直してください',
    );
    expect(offNoteOf({ ...base, suddenOn: false, result: 'added', count: 1 }).text).toContain(
      '日の予定で担当を振り直してください',
    );
  });
  it('sameList：同じ物が同じ順', () => {
    const o = {};
    expect(sameList([o, 1], [o, 1])).toBe(true);
    expect(sameList([o], [{}])).toBe(false);
    expect(sameList([1], [1, 2])).toBe(false);
  });
});
