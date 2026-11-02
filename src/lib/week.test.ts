import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import type { Item } from '../contracts/rules';
import { compile } from '../matching';
import { client, DATE, ITEMS, makeData, staff, visit } from '../matching/fixtures.testkit';
import { QUALIFICATION_OPTIONS } from '../seed/qualifications';
import {
  allowedStaffOf,
  clientItemMark,
  clientWeekTable,
  fitCountAt,
  laneLayout,
  limitUnfit,
  qualificationBadges,
  snapMinutes,
  staffWeekTable,
  staffWithQualification,
  typeUnfit,
  unfitMarks,
  weekDates,
  weekDay,
  weekStart,
} from './week';

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

/** 訪問に担当を書く */
const assign = (d: DemoData, routes: Record<string, string[]>): DemoData => {
  const owner = new Map(Object.entries(routes).flatMap(([sid, ids]) => ids.map((id) => [id, sid] as const)));
  return { ...d, visits: d.visits.map((v) => (owner.has(v.id) ? { ...v, staffId: owner.get(v.id)! } : v)) };
};

describe('weekDates・weekStart・snapMinutes', () => {
  it('月曜はじまりの7日（日曜はその前の月曜からの週）', () => {
    expect(weekDates('2026-10-14')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekDates('2026-11-01')[0]).toBe('2026-10-26');
  });

  it('15分刻みに丸める', () => {
    expect(snapMinutes(9 * 60 + 7)).toBe(9 * 60);
    expect(snapMinutes(9 * 60 + 8)).toBe(9 * 60 + 15);
  });
});

describe('laneLayout', () => {
  it('重なる帯は横に並べ、重ならない帯は1列', () => {
    const m = laneLayout([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 570, end: 630 },
      { id: 'c', start: 600, end: 660 },
      { id: 'd', start: 720, end: 780 },
    ]);
    expect(m.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(m.get('b')).toEqual({ lane: 1, lanes: 2 });
    // a が終わった時刻に始まる c は a のレーンに入る
    expect(m.get('c')).toEqual({ lane: 0, lanes: 2 });
    expect(m.get('d')).toEqual({ lane: 0, lanes: 1 });
  });

  it('3つ同時なら3レーン', () => {
    const m = laneLayout([
      { id: 'x', start: 540, end: 600 },
      { id: 'y', start: 540, end: 600 },
      { id: 'z', start: 550, end: 560 },
    ]);
    expect(new Set([...m.values()].map((l) => l.lane))).toEqual(new Set([0, 1, 2]));
    expect([...m.values()].every((l) => l.lanes === 3)).toBe(true);
  });
});

describe('weekDay', () => {
  it('担当の並びの lenient の時刻に帯を置き、担当なしの訪問は開始（早）に置く', () => {
    const d = makeData({
      staff: [staff('s1', 38.26, 140.87)],
      clients: [client('c1', 38.27, 140.88), client('c2', 38.27, 140.881)],
      visits: [visit('v1', 'c1', '09:00', '10:00', { staffId: 's1' }), visit('v2', 'c2', '14:00', '14:00')],
    });
    const w = weekDay(d, DATE);
    expect(w.routes).toEqual({ s1: ['v1'] });
    expect(w.bands.map((b) => [b.visitId, b.staffId, b.start, b.end, b.source])).toEqual([
      ['v1', 's1', 540, 600, 'plan'],
      ['v2', null, 840, 900, 'visit'],
    ]);
    expect(w.visits.map((v) => v.id)).toEqual(['v1', 'v2']);
  });
});

describe('staffWeekTable', () => {
  it('件数・稼働時間・移動・種類・週の合計・平均との差・休み', () => {
    const d = makeData({
      staff: [staff('s1', 38.26, 140.87), staff('s2', 38.3, 140.9)],
      clients: [client('c1', 38.27, 140.88), client('c2', 38.27, 140.881)],
      visitTypes: [{ id: 't1', name: '介護', color: 0, durationMinutes: 60, requirements: [], note: '' }],
      visits: [visit('v1', 'c1', '09:00', '09:00', { typeId: 't1' }), visit('v2', 'c2', '13:00', '13:00')],
      absences: [{ id: 'a1', staffId: 's2', date: DATE, from: '08:00', to: '12:00', note: '' }],
    });
    const days0 = assign(d, { s1: ['v1', 'v2'] });
    const days = weekDates(DATE).map((date) => weekDay(days0, date));
    const t = staffWeekTable(days0, days);
    expect(t.rows.map((r) => r.staffId)).toEqual(['s1', 's2']);
    const [r1, r2] = t.rows;
    const mon = r1!.cells[0]!;
    expect(mon).toMatchObject({ count: 2, hours: 10, off: false, types: [{ typeId: 't1', count: 1 }] });
    expect(mon.travel).toBeGreaterThan(0);
    // 欠勤を差し引いた稼働時間
    expect(r2!.cells[0]!.hours).toBe(6);
    // 訪問の無い日は空き。休みの日は全部休み。月曜は訪問・空き（PRD D76）
    expect(r1!.cells[1]!.bar.some((x) => x.state === 'noplan')).toBe(false);
    expect(r1!.cells[1]!.bar.some((x) => x.state === 'free')).toBe(true);
    expect(r1!.cells[5]!.bar.filter((x) => x.start >= 480 && x.start < 1200).every((x) => x.state === 'rest')).toBe(
      true,
    );
    expect(mon.bar.some((x) => x.state === 'visit')).toBe(true);
    expect(mon.bar.some((x) => x.state === 'free')).toBe(true);
    expect(mon.bar.some((x) => x.state === 'noplan')).toBe(false);
    // 日ごとの合計に訪問の件数（案なしの日の「案なし（訪問 N件）」）
    expect(t.days[0]!.visits).toBe(2);
    expect(t.days[1]!.visits).toBe(0);
    expect(r1!.cells[5]!.off).toBe(true);
    expect(r1!.cells[6]!.off).toBe(true);
    expect(r1!.total).toMatchObject({ count: 2, hours: 50 });
    expect(t.average).toBe(1);
    expect(r1!.diff).toBe(1);
    expect(r2!.diff).toBe(-1);
    expect(r1!.strong && r2!.strong).toBe(true);
    expect(t.days[0]).toMatchObject({ count: 2, visits: 2 });
    // 担当なしの訪問だけの日は、勤務内は空き（担当の件数は 0。日の合計の訪問の件数には入る）
    const t2 = staffWeekTable(
      d,
      weekDates(DATE).map((date) => weekDay(d, date)),
    );
    const c = t2.rows[0]!.cells[0]!;
    expect(c.count).toBe(0);
    expect(c.bar.some((x) => x.state === 'free')).toBe(true);
    expect(t2.days[0]).toMatchObject({ count: 0, visits: 2 });
    // 終日休みの人に残る件数は count
    const off = { ...days0, absences: [{ id: 'a2', staffId: 's1', date: DATE, from: null, to: null, note: '' }] };
    const t3 = staffWeekTable(
      off,
      weekDates(DATE).map((date) => weekDay(off, date)),
    );
    expect(t3.rows[0]!.cells[0]).toMatchObject({ off: true, count: 2 });
  });
});

describe('qualificationBadges・staffWithQualification（資格）', () => {
  const nurse = staff('s1', 38.26, 140.87, { traits: { license: ['看護師', '介護福祉士'] } });
  const care = staff('s2', 38.26, 140.87, { traits: { license: ['介護福祉士'] } });
  const resting = staff('s3', 38.26, 140.87, { active: false, traits: { license: ['看護師'] } });

  it('選択肢の順に頭文字2字までのバッジと正式名', () => {
    expect(qualificationBadges(ITEMS, nurse)).toEqual([
      { short: '介護', name: '介護福祉士' },
      { short: '看護', name: '看護師' },
    ]);
    expect(qualificationBadges(ITEMS, staff('s4', 38, 140))).toEqual([]);
  });

  it('初期の資格の選択肢（27）のバッジは重ならない（先頭2文字で重なるものは別の短い名前。PRD D422）', () => {
    const items: Item[] = [
      { id: 'q', name: '資格', target: 'staff', kind: 'multi', options: [...QUALIFICATION_OPTIONS] },
    ];
    const all = qualificationBadges(items, staff('s9', 38, 140, { traits: { q: [...QUALIFICATION_OPTIONS] } }));
    expect(all).toHaveLength(27);
    expect(new Set(all.map((b) => b.short)).size).toBe(27);
  });

  it('項目「資格」が無ければバッジもチップの選択も無い', () => {
    const items = ITEMS.filter((i) => i.name !== '資格');
    expect(qualificationBadges(items, nurse)).toEqual([]);
    expect(staffWithQualification(items, [nurse], '看護師')).toEqual([]);
  });

  it('その資格を持つ稼働中の人だけ', () => {
    expect(staffWithQualification(ITEMS, [nurse, care, resting], '看護師')).toEqual(['s1']);
    expect(staffWithQualification(ITEMS, [nurse, care, resting], '介護福祉士')).toEqual(['s1', 's2']);
  });
});

describe('allowedStaffOf・typeUnfit・fitCountAt（ドラッグ中の予告）', () => {
  const rehab = {
    id: 't1',
    name: 'リハビリ',
    color: 1,
    durationMinutes: 60,
    requirements: [{ itemId: 'license', op: 'hasAny' as const, value: ['看護師'] }],
    note: '',
  };
  const base = () =>
    makeData({
      staff: [
        staff('s1', 38.26, 140.87, { traits: { license: ['看護師'] } }),
        staff('s2', 38.26, 140.871, { traits: { license: ['介護福祉士'] } }),
      ],
      clients: [client('c1', 38.27, 140.88), client('c2', 38.27, 140.881)],
      visitTypes: [rehab],
      visits: [
        visit('v1', 'c1', '09:00', '09:00', { typeId: 't1', staffId: 's2' }),
        visit('v2', 'c2', '09:00', '09:00', { staffId: 's1' }),
      ],
    });

  it('担当できる人と、種類の必要条件で可でない担当（資格✗）', () => {
    const w = weekDay(base(), DATE);
    expect(allowedStaffOf(w.problem, 'v1')).toEqual(['s1']);
    expect(allowedStaffOf(w.problem, 'v2')).toEqual(['s1', 's2']);
    expect(typeUnfit(w.problem, 'v1', 's2')).toBe(true);
    expect(typeUnfit(w.problem, 'v1', 's1')).toBe(false);
    expect(typeUnfit(w.problem, 'v1', null)).toBe(false);
    expect(allowedStaffOf(null, 'v1')).toEqual([]);
  });

  it('落とす日・時刻で空き時間に入れられる人の数（データは変えない）', () => {
    const d = base();
    // 9:00 は s1 が v2 で埋まっている（s2 は資格が無い）
    expect(fitCountAt(d, 'v1', DATE, 9 * 60)).toBe(0);
    // 13:00 なら s1 に入る
    expect(fitCountAt(d, 'v1', DATE, 13 * 60)).toBe(1);
    // 種類なしの v2 を 13:00 に：s1・s2 とも入る
    expect(fitCountAt(d, 'v2', DATE, 13 * 60)).toBe(2);
    // 訪問の無い火曜は空の列で数える
    const tue = '2026-10-13';
    expect(fitCountAt(d, 'v2', tue, 10 * 60)).toBe(2);
    // 土曜は誰も働かない
    expect(fitCountAt(d, 'v2', '2026-10-17', 10 * 60)).toBe(0);
    expect(d.visits.find((v) => v.id === 'v1')!.earliestStart).toBe('09:00');
    expect(fitCountAt(d, 'nope', DATE, 600)).toBeNull();
  });
});

describe('clientWeekTable（利用者さん×曜日）', () => {
  const d = makeData({
    staff: [staff('s1', 38.26, 140.87)],
    clients: [
      client('c2', 38.27, 140.88, { displayName: 'いとう' }),
      client('c1', 38.27, 140.881, { displayName: 'あべ' }),
      client('c3', 38.27, 140.882, { displayName: 'うえだ', active: false }),
    ],
    visits: [
      visit('v1', 'c1', '13:00', '13:00', { typeId: 't1', staffId: 's1' }),
      visit('v2', 'c1', '09:00', '09:00', { staffId: 's1' }),
      visit('v3', 'c2', '10:00', '10:00', { date: '2026-10-14' }),
      visit('v4', 'c1', '11:00', '11:00', { cancelled: true }),
    ],
  });
  const days = weekDates(DATE).map((date) => weekDay(d, date));

  it('選ばなければ全員（表示名の順。休止中で訪問の無い人は除く）、マスは開始の順・取り消しも印として入る（PRD D342）', () => {
    const rows = clientWeekTable(d, days, null);
    expect(rows.map((r) => r.clientId)).toEqual(['c1', 'c2']);
    const mon = rows[0]!.cells[0]!;
    expect(mon.items.map((x) => [x.visitId, x.start, x.staffId, x.typeId, !!x.cancelled])).toEqual([
      ['v2', 540, 's1', null, false],
      ['v4', 660, null, null, true],
      ['v1', 780, 's1', 't1', false],
    ]);
    // 担当なしの訪問（水曜）は担当なしの印
    expect(rows[1]!.cells[2]!.items[0]!.unassigned).toBe(true);
    expect(rows[1]!.cells[2]!.items.map((x) => [x.visitId, x.staffId])).toEqual([['v3', null]]);
    expect(rows[1]!.cells[0]!.items).toEqual([]);
  });

  it('選んだ人だけ（休止中でも選べば出す）', () => {
    expect(clientWeekTable(d, days, ['c3', 'c2']).map((r) => r.clientId)).toEqual(['c2', 'c3']);
    expect(clientWeekTable(d, days, []).map((r) => r.clientId)).toEqual(['c1', 'c2']);
  });

  it('印（PRD D342）：当日キャンセル・いつもの担当でない（繰り返しの担当と違う）・担当なし・休み', () => {
    const p = pattern('p1', [1], { clientId: 'c1', usualStaffId: 's2' });
    const d2 = makeData({
      staff: [staff('s1', 38.26, 140.87), staff('s2', 38.26, 140.871)],
      clients: [client('c1', 38.27, 140.881), client('c2', 38.27, 140.88)],
      patterns: [p],
      visits: [
        visit(`${DATE}_p1`, 'c1', '09:00', '09:00', {
          pattern: { id: 'p1', date: DATE, edited: false },
          staffId: 's1',
        }),
        visit('b', 'c1', '13:00', '13:00', { staffId: 's1' }),
        visit('c', 'c1', '15:00', '15:00'),
        visit('x', 'c2', '10:00', '10:00', { cancelled: true, cancelKind: 'sameDay' }),
        visit('l', 'c2', '16:00', '16:00'),
      ],
      clientLeaves: [{ id: 'L1', clientId: 'c2', from: DATE, to: DATE, note: '入院' }],
    });
    const ds = weekDates(DATE).map((date) => weekDay(d2, date));
    const rows = clientWeekTable(d2, ds, null);
    const byId = new Map(rows.flatMap((r) => r.cells[0]!.items).map((x) => [x.visitId, x]));
    // 繰り返しの担当は s2 なので s1 は代
    expect(byId.get(`${DATE}_p1`)!.substitute).toBe(true);
    // b：繰り返しが無いので代にしない
    expect(byId.get('b')!.substitute).toBeUndefined();
    expect(byId.get('c')!.unassigned).toBe(true);
    expect(byId.get('x')).toMatchObject({ cancelled: true, sameDay: true, staffId: null });
    expect(byId.get('l')!.leave).toBe(true);
  });

  it('clientItemMark：形と短い文字（色だけにしない）', () => {
    const names = { short: (id: string) => `短${id}`, full: (id: string) => `名${id}` };
    const base = { visitId: 'v', date: DATE, start: 540, end: 600, typeId: null, staffId: null };
    expect(clientItemMark({ ...base, staffId: 's1', substitute: true }, names)).toEqual({
      kind: 'visit',
      short: '短s1',
      text: '名s1さん（いつもの担当でない）',
    });
    expect(clientItemMark({ ...base, cancelled: true }, names).short).toBe('取消');
    expect(clientItemMark({ ...base, cancelled: true, sameDay: true }, names).short).toBe('当日取消');
    expect(clientItemMark({ ...base, leave: true }, names)).toMatchObject({ kind: 'leave', short: '休' });
    expect(clientItemMark({ ...base, unassigned: true }, names)).toMatchObject({
      kind: 'unassigned',
      short: '担当なし',
    });
  });
});

describe('帯の印（unfitMarks。ADR-0014 の限✗）', () => {
  it('担当を限る決まりで可でない担当に「限✗」、限った人・担当なしには付かない', () => {
    const d = makeData({
      staff: [staff('s1', 38.26, 140.87), staff('s2', 38.27, 140.88)],
      clients: [client('c1', 38.265, 140.875, { allowedStaffIds: ['s1'] })],
      visits: [visit('v1', 'c1', '10:00', '11:00')],
    });
    const p = compile(d, DATE);
    expect(limitUnfit(p, 'v1', 's2')).toBe(true);
    expect(unfitMarks(p, 'v1', 's2').map((m) => m.short)).toEqual(['限✗']);
    expect(unfitMarks(p, 'v1', 's1')).toEqual([]);
    expect(unfitMarks(p, 'v1', null)).toEqual([]);
  });
});
