// iCalendar を読む（PRD D440。ADR-0107）。架空のカレンダーで確かめる
import { describe, expect, it } from 'vitest';
import { icsTime, occurrencesIn, parseIcs, parseRule } from './icsRead';

const cal = (events: string[], name = '架空 一郎') =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `X-WR-CALNAME:${name}`,
    'X-WR-TIMEZONE:Asia/Tokyo',
    ...events.flatMap((e) => ['BEGIN:VEVENT', ...e.split('\n'), 'END:VEVENT']),
    'END:VCALENDAR',
  ].join('\r\n');

describe('icsTime', () => {
  it('UTC は日本時間にする（日付もまたぐ）', () => {
    expect(icsTime('20261118T000000Z')).toEqual({ date: '2026-11-18', time: '09:00' });
    expect(icsTime('20261117T230000Z')).toEqual({ date: '2026-11-18', time: '08:00' });
  });
  it('終日と TZID 付きはそのまま', () => {
    expect(icsTime('20261105', { VALUE: 'DATE' })).toEqual({ date: '2026-11-05', time: null });
    expect(icsTime('20261107T080000', { TZID: 'Asia/Tokyo' })).toEqual({ date: '2026-11-07', time: '08:00' });
    expect(icsTime('x')).toBeNull();
  });
});

describe('parseIcs', () => {
  it('名前・件名・折り返し・通知を読む', () => {
    const c = parseIcs(
      cal([
        'UID:a\nDTSTART;VALUE=DATE:20261105\nDTEND;VALUE=DATE:20261106\nSUMMARY:休\n み\nBEGIN:VALARM\nSUMMARY:通知\nEND:VALARM',
      ]),
    );
    expect(c.name).toBe('架空 一郎');
    expect(c.events).toHaveLength(1);
    expect(c.events[0]!.summary).toBe('休み');
    expect(c.events[0]!.end).toEqual({ date: '2026-11-06', time: null });
  });
  it('取り消した予定・1回だけ直した回・除く回', () => {
    const c = parseIcs(
      cal([
        'UID:x\nSTATUS:CANCELLED\nDTSTART;VALUE=DATE:20261105\nSUMMARY:休み',
        'UID:r\nDTSTART;TZID=Asia/Tokyo:20261107T080000\nDTEND;TZID=Asia/Tokyo:20261107T130000\nRRULE:FREQ=DAILY\nEXDATE;TZID=Asia/Tokyo:20261108T080000,20261109T080000\nSUMMARY:休み',
        'UID:r\nRECURRENCE-ID;TZID=Asia/Tokyo:20261110T080000\nDTSTART;TZID=Asia/Tokyo:20261110T140000\nDTEND;TZID=Asia/Tokyo:20261110T170000\nSUMMARY:休み',
      ]),
    );
    const { list } = occurrencesIn(c, '2026-11-01', '2026-11-11');
    expect(list.map((o) => `${o.start.date} ${o.start.time}`)).toEqual([
      '2026-11-07 08:00',
      '2026-11-11 08:00',
      '2026-11-10 14:00',
    ]);
  });
});

describe('parseRule と繰り返し', () => {
  it('読めない決まりは null で数える', () => {
    expect(parseRule('FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO')).toBeNull();
    const c = parseIcs(cal(['UID:a\nDTSTART;VALUE=DATE:20261101\nRRULE:FREQ=HOURLY\nSUMMARY:休み']));
    expect(occurrencesIn(c, '2026-11-01', '2026-11-30').unsupported).toBe(1);
  });
  it('毎週（曜日・間隔）・COUNT・UNTIL', () => {
    // 2026-11-02 は月曜
    const c = parseIcs(
      cal([
        'UID:w\nDTSTART;VALUE=DATE:20261102\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=3\nSUMMARY:休み',
        'UID:d\nDTSTART;VALUE=DATE:20261101\nRRULE:FREQ=DAILY;UNTIL=20261103\nSUMMARY:休み',
      ]),
    );
    const dates = (uid: string) =>
      occurrencesIn({ events: c.events.filter((e) => e.uid === uid) }, '2026-10-01', '2026-12-31').list.map(
        (o) => o.start.date,
      );
    expect(dates('w')).toEqual(['2026-11-02', '2026-11-04', '2026-11-16']);
    expect(dates('d')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
  it('毎月（第1月曜・最後の金曜・日付）と毎年', () => {
    const c = parseIcs(
      cal([
        'UID:m1\nDTSTART;VALUE=DATE:20261102\nRRULE:FREQ=MONTHLY;BYDAY=1MO\nSUMMARY:休み',
        'UID:m2\nDTSTART;VALUE=DATE:20261127\nRRULE:FREQ=MONTHLY;BYDAY=-1FR\nSUMMARY:休み',
        'UID:m3\nDTSTART;VALUE=DATE:20261130\nRRULE:FREQ=MONTHLY;BYMONTHDAY=30\nSUMMARY:休み',
        'UID:y\nDTSTART;VALUE=DATE:20251203\nRRULE:FREQ=YEARLY\nSUMMARY:休み',
      ]),
    );
    const dates = (uid: string) =>
      occurrencesIn({ events: c.events.filter((e) => e.uid === uid) }, '2026-11-01', '2027-03-31').list.map(
        (o) => o.start.date,
      );
    expect(dates('m1')).toEqual(['2026-11-02', '2026-12-07', '2027-01-04', '2027-02-01', '2027-03-01']);
    expect(dates('m2')).toEqual(['2026-11-27', '2026-12-25', '2027-01-29', '2027-02-26', '2027-03-26']);
    expect(dates('m3')).toEqual(['2026-11-30', '2026-12-30', '2027-01-30', '2027-03-30']);
    expect(dates('y')).toEqual(['2026-12-03']);
  });
  it('見る範囲にかかる何日もの予定', () => {
    const c = parseIcs(cal(['UID:a\nDTSTART;VALUE=DATE:20261020\nDTEND;VALUE=DATE:20261105\nSUMMARY:産休']));
    expect(occurrencesIn(c, '2026-11-01', '2026-11-30').list).toHaveLength(1);
    expect(occurrencesIn(c, '2026-11-05', '2026-11-30').list).toHaveLength(0);
  });
  it('WKST=SU の隔週（日曜を含む）は日曜はじまりの週で数える', () => {
    // 2026-11-01 は日曜
    const c = parseIcs(
      cal(['UID:w\nDTSTART;VALUE=DATE:20261101\nRRULE:FREQ=WEEKLY;WKST=SU;INTERVAL=2;BYDAY=SU,MO\nSUMMARY:休み']),
    );
    expect(occurrencesIn(c, '2026-11-01', '2026-11-16').list.map((o) => o.start.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-15',
      '2026-11-16',
    ]);
  });
  it('UTC の繰り返しは UTC の曜日で当ててから日本時間にする', () => {
    // 2026-11-04（水）15:00Z ＝ 日本時間 11-05（木）0:00
    const c = parseIcs(
      cal(['UID:u\nDTSTART:20261104T150000Z\nDTEND:20261104T160000Z\nRRULE:FREQ=WEEKLY;BYDAY=WE\nSUMMARY:休み']),
    );
    const list = occurrencesIn(c, '2026-11-01', '2026-11-20').list;
    expect(list.map((o) => `${o.start.date} ${o.start.time}-${o.end.time}`)).toEqual([
      '2026-11-05 00:00-01:00',
      '2026-11-12 00:00-01:00',
      '2026-11-19 00:00-01:00',
    ]);
  });
  it('件名で絞ると、ほかの予定は開かず読めない繰り返しにも数えない。古い開始日の繰り返しも範囲に届く', () => {
    const c = parseIcs(
      cal([
        'UID:a\nDTSTART;VALUE=DATE:19900101\nRRULE:FREQ=DAILY\nSUMMARY:休み',
        'UID:b\nDTSTART;VALUE=DATE:20261101\nRRULE:FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO\nSUMMARY:mtg',
      ]),
    );
    const r = occurrencesIn(c, '2026-11-01', '2026-11-03', (s) => s.includes('休'));
    expect(r.unsupported).toBe(0);
    expect(r.list.map((o) => o.start.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
});
