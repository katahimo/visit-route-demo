import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures';
import { expandPattern, findVisit, putVisits, visitsIn } from '../patterns';
import { canMoveVisit, weekDay } from './week';
import { insertAllIntoPlans, insertIntoPlan, moveFollowing, moveOnce } from './weekOps';

// DATE（2026-10-12）は月曜

function pattern(id: string, weekdays: number[], over: Partial<Pattern> = {}): Pattern {
  return {
    id,
    clientId: 'c1',
    typeId: null,
    weekdays,
    everyWeeks: 1,
    repeat: 'weekly',
    monthWeeks: [],
    dayTimes: [],
    windowKind: 'fixed',
    earliestStart: '09:00',
    latestStart: '09:00',
    durationMinutes: 60,
    from: DATE,
    to: null,
    usualStaffId: null,
    note: '',
    ...over,
  };
}

/** パターンのあるデータ（版2：回は計算する） */
function withPatterns(patterns: Pattern[]): DemoData {
  return makeData({
    staff: [staff('s1', 38.26, 140.87)],
    clients: [client('c1', 38.27, 140.88)],
    patterns,
  });
}
/** 10/12〜10/31 の訪問（計算した回も） */
const all = (d: DemoData, to = '2026-10-31') => visitsIn(d, { from: DATE, to });
const find = (d: DemoData, id: string) => findVisit(d, id)!;
/** その回を変えて保存する */
const put = (d: DemoData, id: string, over: Partial<ReturnType<typeof find>>): DemoData => ({
  ...d,
  visits: putVisits(d.visits, [{ ...find(d, id), ...over }]),
});

describe('moveOnce（この回だけ）', () => {
  it('その訪問の日付・開始（幅を保つ）だけ変え、edited にする。担当はそのまま、組んだ開始は外す', () => {
    const base = withPatterns([pattern('p1', [1], { windowKind: 'window', latestStart: '09:30' })]);
    const d = put(base, '2026-10-19_p1', { staffId: 's1', start: '09:10' });
    const next = moveOnce(d, '2026-10-19_p1', '2026-10-21', 10 * 60 + 15, DATE);
    const v = find(next, '2026-10-19_p1');
    expect(v.date).toBe('2026-10-21');
    expect(v.earliestStart).toBe('10:15');
    expect(v.latestStart).toBe('10:45');
    expect(v.pattern).toEqual({ id: 'p1', date: '2026-10-19', edited: true });
    expect([v.staffId, v.start]).toEqual(['s1', null]);
    // ほかの回とパターンは変わらない
    expect(all(next).filter((x) => x.id !== v.id)).toEqual(all(d).filter((x) => x.id !== v.id));
    expect(next.patterns).toEqual(d.patterns);
  });

  it('今日より前の訪問・今日より前の日へは動かさない（そのまま）', () => {
    const d = withPatterns([pattern('p1', [1])]);
    const today = '2026-10-14';
    expect(moveOnce(d, '2026-10-12_p1', '2026-10-20', 600, today)).toBe(d);
    expect(moveOnce(d, '2026-10-19_p1', '2026-10-13', 600, today)).toBe(d);
    expect(moveOnce(d, '2026-10-19_p1', today, 600, today)).not.toBe(d);
  });

  it('canMoveVisit：今日以降の訪問だけ・今日以降の日へだけ動かせる', () => {
    expect(canMoveVisit('2026-10-13', '2026-10-14')).toBe(false);
    expect(canMoveVisit('2026-10-14', '2026-10-14')).toBe(true);
    expect(canMoveVisit('2026-10-20', '2026-10-14')).toBe(true);
  });

  it('単発の訪問は pattern が null のまま。無い訪問はそのまま', () => {
    const d = makeData({ visits: [visit('v1', 'c1', '09:00', '09:00')] });
    const next = moveOnce(d, 'v1', DATE, 11 * 60, DATE);
    expect(next.visits[0]!.pattern).toBeNull();
    expect(next.visits[0]!.earliestStart).toBe('11:00');
    expect(moveOnce(d, 'nope', DATE, 600, DATE)).toBe(d);
  });
});

describe('moveFollowing（以降すべて）', () => {
  it('曜日が1つのパターン：元の日以降の回が新しい曜日・時刻になり、前の回は変わらない', () => {
    const d = withPatterns([pattern('p1', [1])]);
    const r = moveFollowing(d, '2026-10-19_p1', '2026-10-20', 10 * 60, DATE, ['np1', 'np2'])!;
    const ids = all(r.data)
      .map((v) => v.id)
      .sort();
    expect(ids).toEqual(['2026-10-12_p1', '2026-10-20_np1', '2026-10-27_np1']);
    expect(find(r.data, '2026-10-20_np1').earliestStart).toBe('10:00');
    expect(r.movedVisitId).toBe('2026-10-20_np1');
    const p1 = r.data.patterns.find((p) => p.id === 'p1')!;
    expect(p1.to).toBe('2026-10-18');
    const np1 = r.data.patterns.find((p) => p.id === 'np1')!;
    expect(np1.weekdays).toEqual([2]);
    // 新しいパターンの from はドラッグした日（複数の曜日の分岐とそろえる）
    expect(np1.from).toBe('2026-10-20');
  });

  it('ほかの曜日もあるパターン：ほかの曜日の時刻は変えず、動かした曜日だけ新しい曜日・時刻に', () => {
    const d = withPatterns([pattern('p1', [1, 3])]);
    const r = moveFollowing(d, '2026-10-19_p1', '2026-10-20', 10 * 60, DATE, ['np1', 'np2'])!;
    const after = all(r.data).filter((v) => v.date >= '2026-10-19');
    // 月曜の回は無くなる
    expect(after.some((v) => v.date === '2026-10-19' || v.date === '2026-10-26')).toBe(false);
    // 水曜の回は 09:00 のまま
    const wed = after.filter((v) => v.date === '2026-10-21' || v.date === '2026-10-28');
    expect(wed).toHaveLength(2);
    expect(wed.every((v) => v.earliestStart === '09:00')).toBe(true);
    // 火曜の回が 10:00 で入る
    const tue = after.filter((v) => v.date === '2026-10-20' || v.date === '2026-10-27');
    expect(tue.map((v) => v.earliestStart)).toEqual(['10:00', '10:00']);
    expect(r.movedVisitId).toBe('2026-10-20_np2');
    // 前の週は変わらない
    expect(all(r.data).filter((v) => v.date < '2026-10-19')).toEqual(all(d).filter((v) => v.date < '2026-10-19'));
    expect(r.data.patterns.map((p) => p.id)).toEqual(['p1', 'np1', 'np2']);
  });

  it('標準の開始：動かした繰り返しは持たず、残す側は動かした曜日の分を除く（ADR-0062）', () => {
    const base = pattern('p1', [1, 3]);
    const d = withPatterns([
      {
        ...base,
        usualStarts: [
          { weekday: 1, start: base.earliestStart },
          { weekday: 3, start: base.earliestStart },
        ],
      },
    ]);
    const r = moveFollowing(d, '2026-10-19_p1', '2026-10-20', 10 * 60, DATE, ['np1', 'np2'])!;
    expect(r.data.patterns.find((p) => p.id === 'np1')!.usualStarts).toEqual([
      { weekday: 3, start: base.earliestStart },
    ]);
    expect(r.data.patterns.find((p) => p.id === 'np2')!.usualStarts).toEqual([]);
  });

  it('over：動かした曜日の新しいパターンの所要・種類・幅・いつもの担当も変える（訪問の詳細の欄。PRD D301）', () => {
    const d = withPatterns([pattern('p1', [1, 3])]);
    const r = moveFollowing(d, '2026-10-19_p1', '2026-10-19', 10 * 60, DATE, ['np1', 'np2'], {
      durationMinutes: 90,
      windowKind: 'window',
      width: 30,
      usualStaffId: 's1',
    })!;
    const np2 = r.data.patterns.find((p) => p.id === 'np2')!;
    expect(np2).toMatchObject({
      durationMinutes: 90,
      windowKind: 'window',
      earliestStart: '10:00',
      latestStart: '10:30',
      usualStaffId: 's1',
    });
    // ほかの曜日（水曜）のパターンは変えない
    expect(r.data.patterns.find((p) => p.id === 'np1')!).toMatchObject({ durationMinutes: 60, usualStaffId: null });
  });

  it('単発の訪問は null', () => {
    const d = makeData({ visits: [visit('v1', 'c1', '09:00', '09:00')] });
    expect(moveFollowing(d, 'v1', DATE, 600, DATE, ['a', 'b'])).toBeNull();
  });

  it('取り消し・この回だけの変更の回は、時刻だけ動かしても復活・二重にならない（毎週水曜）', () => {
    const base = withPatterns([pattern('p1', [3])]);
    const d = put(base, '2026-10-28_p1', { cancelled: true, pattern: { id: 'p1', date: '2026-10-28', edited: true } });
    const r = moveFollowing(d, '2026-10-21_p1', '2026-10-21', 15 * 60, DATE, ['np1', 'np2'])!;
    // 取り消した回は新しいパターンの同じ週の回になり、二重にならない
    const on28 = all(r.data).filter((v) => v.date === '2026-10-28');
    expect(on28.map((v) => [v.id, v.cancelled])).toEqual([['2026-10-28_np1', true]]);
    expect(
      all(r.data)
        .filter((v) => v.date === '2026-10-21')
        .map((v) => v.id),
    ).toEqual(['2026-10-21_np1']);
    expect(r.movedVisitId).toBe('2026-10-21_np1');
  });

  it('ほかの曜日もあるパターンでも、取り消した回は二重にならない', () => {
    const base = withPatterns([pattern('p1', [1, 3])]);
    const d = put(base, '2026-10-28_p1', { cancelled: true, pattern: { id: 'p1', date: '2026-10-28', edited: true } });
    const r = moveFollowing(d, '2026-10-21_p1', '2026-10-21', 15 * 60, DATE, ['np1', 'np2'])!;
    const on28 = all(r.data).filter((v) => v.date === '2026-10-28');
    expect(on28).toHaveLength(1);
    expect(on28[0]!.cancelled).toBe(true);
    expect(r.movedVisitId).toBe('2026-10-21_np2');
  });

  it('この回だけ変えてあった回を「以降すべて」で同じ日に動かすと、その回は新しいパターンの回になる', () => {
    const base = withPatterns([pattern('p1', [3])]);
    const d = put(base, '2026-10-21_p1', {
      earliestStart: '16:00',
      latestStart: '16:00',
      pattern: { id: 'p1', date: '2026-10-21', edited: true },
    });
    const r = moveFollowing(d, '2026-10-21_p1', '2026-10-21', 15 * 60, DATE, ['np1', 'np2'])!;
    const on21 = all(r.data).filter((v) => v.date === '2026-10-21');
    expect(on21.map((v) => [v.id, v.earliestStart])).toEqual([['2026-10-21_np1', '15:00']]);
    expect(r.change.removed).toContainEqual({ visitId: '2026-10-21_p1', date: '2026-10-21' });
  });

  it('毎月のパターン（ADR-0013）：第N を「新しい日の第N − 元の日の第N」だけずらす（第3木 1/21 → 第4金 1/22）', () => {
    // 2027年1月の木曜は 7・14・21・28、金曜は 1・8・15・22・29。2月の金曜は 5・12・19・26
    const TODAY27 = '2027-01-10';
    const base = makeData({
      staff: [staff('s1', 38.26, 140.87)],
      clients: [client('c1', 38.27, 140.88)],
      patterns: [pattern('p1', [4], { repeat: 'monthly', monthWeeks: [3, 5], from: '2027-01-01' })],
    });
    const d = base;
    const in27 = (x: DemoData) => visitsIn(x, { from: TODAY27, to: '2027-02-28' });
    expect(in27(d).map((v) => v.date)).toEqual(['2027-01-21', '2027-02-18']);
    const r = moveFollowing(d, '2027-01-21_p1', '2027-01-22', 10 * 60, TODAY27, ['np1', 'np2'])!;
    expect(r).not.toBeNull();
    expect(r.movedVisitId).toBe('2027-01-22_np1');
    const np1 = r.data.patterns.find((p) => p.id === 'np1')!;
    // 第3 → 第4、第5 → 第6 は無いので捨てる
    expect([np1.weekdays, np1.monthWeeks, np1.from]).toEqual([[5], [4], '2027-01-22']);
    expect(
      in27(r.data)
        .map((v) => v.id)
        .sort(),
    ).toEqual(['2027-01-22_np1', '2027-02-26_np1']);
  });

  it('動かした回が新しい日にできない組み合わせ（毎月のパターンで第N が合わない）は null でデータを変えない', () => {
    const TODAY27 = '2027-01-10';
    const base = makeData({
      staff: [staff('s1', 38.26, 140.87)],
      clients: [client('c1', 38.27, 140.88)],
      // 元の日の 1/21 は第3だが、パターンは第1だけ（あとから直した）→ ずらすと第2・第0 で合わない
      patterns: [pattern('p1', [4], { repeat: 'monthly', monthWeeks: [1], from: '2027-01-01' })],
    });
    const v = expandPattern(pattern('p1', [4], { repeat: 'monthly', monthWeeks: [3], from: '2027-01-01' }), {
      from: TODAY27,
      to: '2027-01-31',
    })[0]!;
    const d = { ...base, visits: [v] };
    expect(moveFollowing(d, v.id, '2027-01-22', 600, TODAY27, ['np1', 'np2'])).toBeNull();
    // 第1 + 1 = 第2 の金曜（1/8）ではなく、1/22（第4）へは作れない
  });

  it('曜日ごとの時刻（ADR-0013）：動かした曜日の上書きは外し、ほかの曜日の時刻はそのまま', () => {
    // 月 9:00（共通）・水 14:00〜14:30（上書き）。水曜の回を木曜 15:00 へ「以降すべて」
    const d = withPatterns([
      pattern('p1', [1, 3], {
        windowKind: 'window',
        latestStart: '09:30',
        dayTimes: [{ weekday: 3, earliestStart: '14:00', latestStart: '14:30' }],
      }),
    ]);
    expect(find(d, '2026-10-21_p1').earliestStart).toBe('14:00');
    const r = moveFollowing(d, '2026-10-21_p1', '2026-10-22', 15 * 60, DATE, ['np1', 'np2'])!;
    const np1 = r.data.patterns.find((p) => p.id === 'np1')!;
    expect(np1.weekdays).toEqual([1]);
    expect(np1.dayTimes).toEqual([]);
    const np2 = r.data.patterns.find((p) => p.id === 'np2')!;
    // 動かした回の幅（30分）を保って共通の時刻にする
    expect([np2.weekdays, np2.earliestStart, np2.latestStart, np2.dayTimes]).toEqual([[4], '15:00', '15:30', []]);
    expect(find(r.data, '2026-10-22_np2').earliestStart).toBe('15:00');
    expect(find(r.data, '2026-10-26_np1').earliestStart).toBe('09:00');
  });

  it('隔週を翌週の別の曜日へ動かすと、ドラッグした日に回ができる（新しいパターンの from はドラッグした日）', () => {
    const d = withPatterns([pattern('p1', [1], { everyWeeks: 2 })]);
    expect(all(d).map((v) => v.id)).toEqual(['2026-10-12_p1', '2026-10-26_p1']);
    const r = moveFollowing(d, '2026-10-26_p1', '2026-11-03', 10 * 60, DATE, ['np1', 'np2'])!;
    expect(r.movedVisitId).toBe('2026-11-03_np1');
    expect(r.data.patterns.find((p) => p.id === 'np1')!.from).toBe('2026-11-03');
    expect(r.data.patterns.find((p) => p.id === 'p1')!.to).toBe('2026-10-25');
    expect(
      all(r.data, '2026-11-03')
        .map((v) => v.id)
        .sort(),
    ).toEqual(['2026-10-12_p1', '2026-11-03_np1']);
  });

  it('今日より前の訪問・今日より前の日へは動かさない（null）。今日より前の訪問は残る', () => {
    const d = withPatterns([pattern('p1', [1])]);
    const today = '2026-10-14';
    expect(moveFollowing(d, '2026-10-12_p1', '2026-10-20', 600, today, ['np1', 'np2'])).toBeNull();
    expect(moveFollowing(d, '2026-10-19_p1', '2026-10-13', 600, today, ['np1', 'np2'])).toBeNull();
  });
});

describe('insertIntoPlan（空き時間に入れる。版2）', () => {
  const base = () =>
    makeData({
      staff: [staff('s1', 38.26, 140.87), staff('s2', 38.3, 140.9)],
      clients: [client('c1', 38.27, 140.88), client('c2', 38.27, 140.881)],
      visits: [visit('v1', 'c1', '09:00', '09:00', { staffId: 's1' }), visit('v2', 'c2', '13:00', '13:00')],
    });

  it('担当の並びの空き時間に入れてピンを付け、他の訪問の開始は変えない', () => {
    const d = base();
    const before = weekDay(d, DATE);
    const r = insertIntoPlan(d, DATE, 'v2');
    expect(r.staffId).not.toBeNull();
    expect(find(r.data, 'v2')).toMatchObject({ staffId: r.staffId, pinned: true });
    const after = weekDay(r.data, DATE);
    const startOf = (w: typeof after, id: string) => w.bands.find((b) => b.visitId === id)!.start;
    expect(startOf(after, 'v1')).toBe(startOf(before, 'v1'));
  });

  it('空き時間に入らないときはそのまま（staffId は null）', () => {
    const d0 = base();
    // 稼働時間（08:00〜18:00）の外の訪問は入らない
    const late = {
      ...d0,
      visits: d0.visits.map((v) => (v.id === 'v2' ? { ...v, earliestStart: '19:00', latestStart: '19:00' } : v)),
    };
    const r = insertIntoPlan(late, DATE, 'v2');
    expect(r.staffId).toBeNull();
    expect(r.data).toBe(late);
  });
});

describe('insertAllIntoPlans', () => {
  it('入れられる日に入れ、入らない日を数える', () => {
    const d = makeData({
      staff: [staff('s1', 38.26, 140.87)],
      clients: [client('c1', 38.27, 140.88), client('c2', 38.27, 140.881)],
      visits: [
        visit('v1', 'c1', '09:00', '09:00', { staffId: 's1' }),
        visit('v2', 'c2', '13:00', '13:00'),
        visit('v3', 'c2', '19:00', '19:00', { date: '2026-10-13' }),
      ],
    });
    const r = insertAllIntoPlans(d, [
      { visitId: 'v3', date: '2026-10-13' },
      { visitId: 'v2', date: DATE },
    ]);
    expect(r.inserted).toBe(1);
    expect(r.failedDates).toEqual(['2026-10-13']);
    expect(find(r.data, 'v2').staffId).toBe('s1');
  });
});
