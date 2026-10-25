import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Pattern, VisitType } from '../contracts/documents';
import { client, DATE, makeData, staff } from '../matching/fixtures';
import { colorOf } from './colors';
import {
  type CalTextCtx,
  calHlClass,
  calItemText,
  calListDays,
  calRowOf,
  calShortWho,
  calWho,
  dropBox,
  dropStartAt,
  ghostBox,
  highlightCount,
  itemBox,
  PCAL_HEIGHT,
  PCAL_HOURS,
  pcalY,
  slotMinuteAt,
} from './personCalendar';
import { type CalItem, calDates, clientCalItems, itemsByDate } from './personPage';

// DATE（2026-10-12）は月曜。繰り返し p1 は月・水の 09:30〜（45分）

const TYPE: VisitType = { id: 't1', name: '身体', color: 2, durationMinutes: 45, requirements: [], note: '' };

function data(): DemoData {
  const p: Pattern = {
    id: 'p1',
    clientId: 'c1',
    typeId: 't1',
    weekdays: [1, 3],
    everyWeeks: 1,
    repeat: 'weekly',
    monthWeeks: [],
    dayTimes: [],
    windowKind: 'fixed',
    earliestStart: '09:30',
    latestStart: '09:30',
    durationMinutes: 45,
    from: DATE,
    to: null,
    usualStaffId: null,
    note: '',
  };
  return makeData({
    staff: [staff('s1', 38.26, 140.87, { name: '山田 花子' })],
    clients: [client('c1', 38.27, 140.88, { displayName: '佐藤 一郎' })],
    patterns: [p],
    visitTypes: [TYPE],
  });
}

function ctx(d: DemoData, isClient: boolean): CalTextCtx {
  return {
    isClient,
    staffById: new Map(d.staff.map((s) => [s.id, s])),
    clientById: new Map(d.clients.map((c) => [c.id, c])),
    visitTypes: d.visitTypes,
  };
}

/** 週の回（月曜の回に担当 s1 を入れた形と、水曜の担当なしの回） */
function items(d: DemoData): [CalItem, CalItem] {
  const [mon, wed] = clientCalItems(d, 'c1', '2026-10-12', '2026-10-18');
  return [{ ...mon!, staffId: 's1', state: 'assigned', pinned: true }, wed!];
}

describe('時間軸の位置', () => {
  it('目盛りは 07:00〜20:00 の1時間ごと。分 → px は 0.8 倍で、範囲の外は端に寄せる', () => {
    expect(PCAL_HOURS).toEqual(Array.from({ length: 14 }, (_, i) => 420 + i * 60));
    expect(PCAL_HEIGHT).toBe(780 * 0.8);
    expect(pcalY(420)).toBe(0);
    expect(pcalY(480)).toBe(48);
    expect(pcalY(300)).toBe(0);
    expect(pcalY(1300)).toBe(PCAL_HEIGHT);
  });
  it('押した位置は15分の枠の始まり（07:00〜19:45）。落とした位置は15分に丸める', () => {
    expect(slotMinuteAt(0)).toBe(420);
    expect(slotMinuteAt(11)).toBe(420);
    expect(slotMinuteAt(12)).toBe(435);
    expect(slotMinuteAt(-50)).toBe(420);
    expect(slotMinuteAt(10_000)).toBe(1185);
    expect(dropStartAt(0)).toBe(420);
    expect(dropStartAt(7)).toBe(435);
    expect(dropStartAt(5)).toBe(420);
  });
  it('回は重なりの列で横に並べ、高さは 20px 以上。押している範囲は 12px・影は 24px 以上', () => {
    expect(itemBox({ start: 480, end: 540 }, { lane: 1, lanes: 2 })).toEqual({
      top: 48,
      height: 48,
      left: 'calc(50% + 2px)',
      width: 'calc(50% - 4px)',
    });
    expect(itemBox({ start: 1190, end: 1250 }, { lane: 0, lanes: 1 }).height).toBe(20);
    expect(ghostBox(600, 540)).toEqual({ top: 96, height: 60 });
    expect(ghostBox(600, 600)).toEqual({ top: 144, height: 12 });
    expect(dropBox(480, 60)).toEqual({ top: 48, height: 48 });
    expect(dropBox(480, 15)).toEqual({ top: 48, height: 24 });
  });
});

describe('回の文', () => {
  it('〈利用者さん〉の画面は担当（札は名字だけ）か様子、〈スタッフ〉の画面は〈利用者さん〉と様子', () => {
    const d = data();
    const [mon, wed] = items(d);
    expect(calWho(mon, ctx(d, true))).toBe('山田 花子');
    expect(calShortWho(mon, ctx(d, true))).toBe('山田');
    expect(calWho(wed, ctx(d, true))).toBe('担当なし');
    expect(calShortWho(mon, ctx(d, false))).toBe('佐藤 一郎');
    expect(calItemText(mon, ctx(d, true))).toBe('10/12（月） 09:30〜10:15 山田 花子（身体・固定）');
    expect(calItemText(wed, ctx(d, false))).toBe('10/14（水） 09:30〜10:15 佐藤 一郎（担当なし・身体）');
  });
  it('強調する繰り返しの回は is-hl、ほかは is-dim。数は強調する繰り返しの回だけ', () => {
    const d = data();
    const [mon] = items(d);
    expect(calHlClass(mon, null)).toBe('');
    expect(calHlClass(mon, 'p1')).toBe(' is-hl');
    expect(calHlClass(mon, 'p2')).toBe(' is-dim');
    expect(highlightCount(items(d), 'p1')).toBe(2);
    expect(highlightCount(items(d), null)).toBe(0);
  });
  it('日ごとのリストの行：〈利用者さん〉の画面は種類と担当、〈スタッフ〉の画面は〈利用者さん〉（担当は出さない）', () => {
    const d = data();
    const [mon, wed] = items(d);
    expect(calRowOf(mon, ctx(d, true))).toEqual({
      visitId: mon.visit.id,
      time: '9:30〜10:15',
      title: '身体',
      staff: d.staff[0],
      staffName: '山田 花子',
      state: null,
      color: colorOf(2),
      hideStaff: false,
    });
    expect(calRowOf(wed, ctx(d, false))).toMatchObject({
      title: '佐藤 一郎',
      staff: null,
      staffName: '',
      hideStaff: true,
    });
    expect(calRowOf({ ...wed, state: 'leave' }, ctx(d, true)).state).toBe('休みのため無し');
  });
});

describe('日ごとのリストの日', () => {
  it('週は7日とも、月はその月の日のうち回がある日と今日', () => {
    const d = data();
    const week = calDates('week', DATE);
    const byWeek = itemsByDate(clientCalItems(d, 'c1', week[0]!, week.at(-1)!));
    expect(calListDays('week', DATE, week, byWeek, '2026-10-13')).toEqual(week);
    const month = calDates('month', DATE);
    const byMonth = itemsByDate(clientCalItems(d, 'c1', month[0]!, month.at(-1)!));
    const days = calListDays('month', DATE, month, byMonth, '2026-10-13');
    expect(days.slice(0, 4)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-19']);
    expect(days.every((x) => x.startsWith('2026-10'))).toBe(true);
  });
});
