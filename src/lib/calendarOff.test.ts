// カレンダーの休みを取り込む（PRD D440。ADR-0107）。架空の名前・予定で確かめる
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { makeData, staff } from '../matching/fixtures.testkit';
import { readCalendarFile } from './calendarFile';
import {
  applyCalendarOff,
  calAbsenceId,
  calendarOffRows,
  calOffApplyLabel,
  calOffDoneText,
  isOffSummary,
  offDaysOf,
  offSpansOf,
  staffOfCalendar,
} from './calendarOff';
import { type IcsCalendar, parseIcs } from './icsRead';
import { makeZip } from './zipRead.testkit';

/** 2026-10-12 は月曜。s1・s2 は平日 8:00〜18:00 */
const TODAY = '2026-10-12';

const data = (over: Partial<DemoData> = {}): DemoData =>
  makeData({
    staff: [staff('s1', 38.26, 140.87, { name: '架空 花子' }), staff('s2', 38.27, 140.88, { name: '見本 次郎' })],
    ...over,
  });

const ics = (name: string, events: string[]) =>
  [
    'BEGIN:VCALENDAR',
    `X-WR-CALNAME:${name}`,
    ...events.flatMap((e) => ['BEGIN:VEVENT', ...e.split('\n'), 'END:VEVENT']),
    'END:VCALENDAR',
  ].join('\r\n');

const allDay = (date: string, summary: string) =>
  `UID:${date}${summary}\nDTSTART;VALUE=DATE:${date}\nSUMMARY:${summary}`;
const timed = (start: string, end: string, summary: string) =>
  `UID:${start}\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:${summary}`;

describe('件名と時間帯', () => {
  it('休みの件名だけ', () => {
    expect(isOffSummary('休み')).toBe(true);
    expect(isOffSummary('AM休み')).toBe(true);
    expect(isOffSummary('産前産後休業')).toBe(true);
    expect(isOffSummary('評価委員会（休眠預金）')).toBe(false);
    expect(isOffSummary('mtg')).toBe(false);
  });
  it('終日の AM・PM は午前・午後、時刻つきは30分単位に広げる', () => {
    const at = (date: string, time: string | null) => ({ date, time });
    expect(offDaysOf({ summary: 'AM休み', start: at('2026-10-13', null), end: at('2026-10-14', null) })).toEqual([
      { date: '2026-10-13', from: null, to: '12:00' },
    ]);
    expect(offDaysOf({ summary: 'PM休み', start: at('2026-10-13', null), end: at('2026-10-14', null) })[0]).toEqual({
      date: '2026-10-13',
      from: '12:00',
      to: null,
    });
    expect(offDaysOf({ summary: '休み', start: at('2026-10-13', '09:15'), end: at('2026-10-13', '12:45') })).toEqual([
      { date: '2026-10-13', from: '09:00', to: '13:00' },
    ]);
    // 日をまたぐ（23:00〜翌 0:00 は1日だけ）
    expect(offDaysOf({ summary: '休み', start: at('2026-10-13', '23:00'), end: at('2026-10-14', '00:00') })).toEqual([
      { date: '2026-10-13', from: '23:00', to: null },
    ]);
    expect(
      offDaysOf({ summary: '休み', start: at('2026-10-13', null), end: at('2026-10-16', null) }).map((d) => d.date),
    ).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
  });
  it('同じ日の2つは広げてまとめる・希望休', () => {
    const at = (date: string, time: string | null) => ({ date, time });
    const m = offSpansOf(
      [
        { summary: '休み', start: at('2026-10-13', '09:00'), end: at('2026-10-13', '10:00') },
        { summary: '通院の休み', start: at('2026-10-13', '14:00'), end: at('2026-10-13', '15:00') },
        { summary: '希望休', start: at('2026-10-14', null), end: at('2026-10-15', null) },
        { summary: 'mtg', start: at('2026-10-15', null), end: at('2026-10-16', null) },
      ],
      '2026-10-12',
      '2026-10-31',
    );
    expect(m.get('2026-10-13')).toEqual({ from: '09:00', to: '15:00', note: '休み・通院の休み' });
    expect(m.get('2026-10-14')).toEqual({ from: null, to: null, note: '希望休' });
    expect(m.has('2026-10-15')).toBe(false);
  });
});

describe('名前を当てる', () => {
  it('空白・全角半角の違いは問わない。同じ名前が2人・利用中でない人は当てない', () => {
    const list = [
      { id: 's1', name: '架空 花子', active: true },
      { id: 's2', name: '見本 次郎', active: false },
    ];
    expect(staffOfCalendar(list, '架空花子')).toBe('s1');
    expect(staffOfCalendar(list, '見本次郎')).toBeNull();
    expect(staffOfCalendar([...list, { id: 's3', name: '架空花子', active: true }], '架空 花子')).toBeNull();
    expect(staffOfCalendar(list, 'office@example.com')).toBeNull();
  });
});

describe('一覧と反映', () => {
  const cals = (): IcsCalendar[] => [
    parseIcs(
      ics('架空花子', [
        allDay('20261013', '休み'),
        timed('20261014T000000Z', '20261014T030000Z', '休み'), // 9:00〜12:00
        allDay('20261017', '休み'), // 土曜＝勤務の無い日
        allDay('20261001', '休み'), // 過ぎた日
        allDay('20261015', 'mtg'),
      ]),
    ),
    parseIcs(ics('事務所', [allDay('20261013', '休み')])),
  ];

  it('入れる・勤務の無い日は数えて入れない・合わないカレンダー', () => {
    const { rows, summary } = calendarOffRows(data(), cals(), TODAY);
    expect(rows.map((r) => [r.kind, r.date])).toEqual([
      ['add', '2026-10-13'],
      ['add', '2026-10-14'],
    ]);
    expect(rows[1]!.absence).toMatchObject({ id: calAbsenceId('s1', '2026-10-14'), from: '09:00', to: '12:00' });
    expect(summary).toMatchObject({
      calendars: 2,
      matched: ['架空花子'],
      unmatched: ['事務所'],
      unchanged: 0,
      noShift: 1,
    });
  });

  it('入れ替え：変わらない・直す・外す。手で入れた欠勤も入れ替える', () => {
    const first = calendarOffRows(data(), cals(), TODAY).rows;
    const d1 = applyCalendarOff(data(), first);
    expect(d1.absences.map((a) => a.date)).toEqual(['2026-10-13', '2026-10-14']);
    // カレンダーで 10/13 を消し、10/14 を AM休み（終日）に直し、10/16 に足す。10/15・10/16 は手で入れた欠勤がある
    const hand15 = { id: 'a-1', staffId: 's1', date: '2026-10-15', from: null, to: null, note: '' };
    const hand16 = { id: 'a-2', staffId: 's1', date: '2026-10-16', from: null, to: null, note: '' };
    const d2 = { ...d1, absences: [...d1.absences, hand15, hand16] };
    const again = [parseIcs(ics('架空 花子', [allDay('20261014', 'AM休み'), allDay('20261016', '休み')]))];
    const { rows } = calendarOffRows(d2, again, TODAY);
    expect(rows.map((r) => [r.kind, r.date])).toEqual([
      ['remove', '2026-10-13'],
      ['change', '2026-10-14'],
      ['remove', '2026-10-15'],
      ['change', '2026-10-16'],
    ]);
    const d3 = applyCalendarOff(d2, rows);
    expect(d3.absences).toEqual([
      {
        id: calAbsenceId('s1', '2026-10-14'),
        staffId: 's1',
        date: '2026-10-14',
        from: null,
        to: '12:00',
        note: 'AM休み',
      },
      { id: calAbsenceId('s1', '2026-10-16'), staffId: 's1', date: '2026-10-16', from: null, to: null, note: '休み' },
    ]);
    // もう一度読むと変わらない
    const third = calendarOffRows(d3, again, TODAY);
    expect(third.rows).toEqual([]);
    expect(third.summary.unchanged).toBe(2);
  });

  it('過ぎた日のカレンダーの欠勤・当たらない人の欠勤は外さない', () => {
    const past = {
      id: calAbsenceId('s1', '2026-10-01'),
      staffId: 's1',
      date: '2026-10-01',
      from: null,
      to: null,
      note: '休み',
    };
    const other = {
      id: calAbsenceId('s2', '2026-10-13'),
      staffId: 's2',
      date: '2026-10-13',
      from: null,
      to: null,
      note: '休み',
    };
    const { rows } = calendarOffRows(data({ absences: [past, other] }), [parseIcs(ics('架空花子', []))], TODAY);
    expect(rows).toEqual([]);
  });

  it('文', () => {
    expect(calOffApplyLabel(0)).toBe('変わる休みはありません');
    expect(calOffApplyLabel(3)).toBe('入れ替える（3件）');
    const { rows } = calendarOffRows(data(), cals(), TODAY);
    expect(calOffDoneText(rows.slice(0, 2), 1)).toBe('休みを入れ替えました（入れる 2・直す 0・外す 0）。要対応 1件');
  });
});

describe('readCalendarFile', () => {
  it('zip の中の .ics を読む（ほかのファイルは飛ばす）', async () => {
    const zip = makeZip([
      { name: 'x@group.calendar.google.com.ics', data: ics('架空花子', [allDay('20261013', '休み')]), deflate: true },
      { name: 'memo.txt', data: 'x' },
    ]);
    const r = await readCalendarFile(zip);
    expect(r.error).toBeNull();
    expect(r.calendars.map((c) => c.name)).toEqual(['架空花子']);
  });
  it('.ics 1つも読める。違うファイルは理由', async () => {
    const one = await readCalendarFile(new TextEncoder().encode(ics('', [])));
    expect(one.calendars).toHaveLength(1);
    expect((await readCalendarFile(new TextEncoder().encode('a,b,c'))).error).not.toBeNull();
    expect((await readCalendarFile(makeZip([{ name: 'a.txt', data: 'x' }]))).error).not.toBeNull();
  });
});
