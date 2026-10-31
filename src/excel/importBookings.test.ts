// 予約の CSV → 単発の訪問（ADR-0075。PRD D398）：予約の形の見分け・時刻の読み方・〈利用者さん〉との突き合わせ・読み直し。値は架空
import { describe, expect, it } from 'vitest';
import type { BookingImportResult, DemoData, ImportError } from '../contracts/data';
import { BOOKING_FORMS, readBookingForm } from './bookingForms';
import { base } from './excel.testkit';
import { bookingVisitId, importBookings } from './importBookings';
import { parseTimeRange, reserveToBookings } from './reserveBookings';

const HEAD =
  '予約番号,予約種類,予約日,予約時,所要時間(分),支払金額（合計）,消費税,メニュー名,オプション,状況,シンプルアンケート,新規登録者,氏名,会員番号,住所'.split(
    ',',
  );
const row = (v: Record<string, string>) => HEAD.map((h) => v[h] ?? '');

const buf = (t: string[][]) => {
  const b = new TextEncoder().encode(t.map((r) => r.join(',')).join('\n'));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const ok = (r: BookingImportResult | ImportError): BookingImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};

describe('予約時の読み方', () => {
  it('枠の言葉・全角の波ダッシュを読み飛ばし、開始と分を取る', () => {
    expect(parseTimeRange('AM枠 10:00～12:00')).toEqual({ start: '10:00', minutes: 120 });
    expect(parseTimeRange('9:30〜17:00')).toEqual({ start: '09:30', minutes: 450 });
    expect(parseTimeRange('14:00')).toEqual({ start: '14:00', minutes: null });
    expect(parseTimeRange('終日')).toBeNull();
    expect(parseTimeRange('25:00～26:00')).toBeNull();
  });
});

describe('予約の形', () => {
  const table = [
    HEAD,
    row({
      予約番号: 'R1',
      予約日: '2026/11/03',
      予約時: 'PM枠 13:00～15:00',
      '所要時間(分)': '120',
      メニュー名: '基本プラン',
      状況: '予約確定',
      新規登録者: '架空 一子',
      氏名: '架空 花子',
    }),
    row({ 予約番号: 'R2', 予約日: '2026/11/04', 予約時: '09:15～16:45', 状況: 'キャンセル', 氏名: '架空 花子' }),
    row({ 予約番号: 'R3', 予約日: '11月5日', 予約時: '10:00～12:00', 氏名: '架空 花子' }),
    row({ 予約番号: 'R4', 予約日: '2026/11/05', 予約時: '10:00～22:01', 氏名: '架空 花子' }),
  ];
  it('予約の並びに写す（新規登録者は担当にしない・取り消し・読めない行）', () => {
    const t = reserveToBookings(table)!;
    expect(t.bookings).toEqual([
      {
        ref: 'R1',
        row: 2,
        date: '2026-11-03',
        start: '13:00',
        durationMinutes: 120,
        clientName: '架空 花子',
        cancelled: false,
        note: '基本プラン',
      },
      {
        ref: 'R2',
        row: 3,
        date: '2026-11-04',
        start: '09:15',
        durationMinutes: 450,
        clientName: '架空 花子',
        cancelled: true,
        note: '',
      },
    ]);
    expect(t.badRows).toEqual([
      '4行目：予約日「11月5日」が日付として読めません',
      '5行目：所要時間 721分は 5〜720分にしてください',
    ]);
    expect(t.skipped).toContain('新規登録者');
  });
  it('形の一覧で見分ける（ID は重ならない）', () => {
    expect(readBookingForm(table)?.form.id).toBe('reserve');
    expect(readBookingForm([['名前', '日付']])).toBeNull();
    const ids = BOOKING_FORMS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('予約を訪問として読み込む', () => {
  const withClients = (): DemoData => {
    const d = base();
    const [a, b] = d.clients;
    if (!a || !b) throw new Error('seed に〈利用者さん〉がいない');
    return {
      ...d,
      clients: [{ ...a, displayName: '架空 花子' }, { ...b, displayName: '架空 次郎' }, ...d.clients.slice(2)],
    };
  };
  const table = [
    HEAD,
    row({
      予約番号: 'R1',
      予約日: '2026/11/03',
      予約時: '13:00～15:00',
      '所要時間(分)': '120',
      メニュー名: '基本プラン',
      氏名: '架空花子',
    }),
    row({ 予約番号: 'R2', 予約日: '2026/11/04', 予約時: '10:00～11:00', 氏名: 'いない 人' }),
    row({ 予約番号: 'R2', 予約日: '2026/11/04', 予約時: '10:00～11:00', 氏名: '架空 次郎' }),
    row({ 予約番号: 'R3', 予約日: '2026/11/05', 予約時: '10:00～11:00', 氏名: 'いない 人' }),
  ];

  it('名前（空白の違いは同じ）で突き合わせ、担当なしの単発の訪問を足す。いない人・重なる予約番号は入れない', () => {
    const d = withClients();
    const r = ok(importBookings(buf(table), d));
    expect(r).toMatchObject({ added: 1, updated: 0, unchanged: 0, unmatched: ['いない 人（2件）'] });
    expect(r.badRows).toEqual(['4行目：予約番号「R2」が 3行目と重なっています']);
    const v = r.data.visits.find((x) => x.id === bookingVisitId({ id: 'reserve' }, 'R1'));
    expect(v).toMatchObject({
      date: '2026-11-03',
      clientId: d.clients[0]?.id,
      windowKind: 'fixed',
      earliestStart: '13:00',
      latestStart: '13:00',
      durationMinutes: 120,
      staffId: null,
      pattern: null,
      note: '基本プラン',
    });
    expect(r.data.visits.length).toBe(d.visits.length + 1);
  });

  it('読み直すと同じ訪問を直す（担当・ピンは残し、時刻が変われば組んだ開始は外す）', () => {
    const first = ok(importBookings(buf(table), withClients())).data;
    const id = bookingVisitId({ id: 'reserve' }, 'R1');
    const staffId = first.staff[0]?.id ?? null;
    const assigned: DemoData = {
      ...first,
      visits: first.visits.map((v) => (v.id === id ? { ...v, staffId, start: '13:00', pinned: true } : v)),
    };
    const again = ok(importBookings(buf(table), assigned));
    expect(again).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    const moved = table.map((r, i) => (i === 1 ? r.map((c) => (c === '13:00～15:00' ? '14:00～16:00' : c)) : r));
    const r = ok(importBookings(buf(moved), assigned));
    expect(r).toMatchObject({ added: 0, updated: 1 });
    expect(r.data.visits.find((v) => v.id === id)).toMatchObject({
      staffId,
      pinned: true,
      start: null,
      earliestStart: '14:00',
    });
  });

  it('同じ名前の〈利用者さん〉が2人なら入れない', () => {
    const d = withClients();
    const dup: DemoData = {
      ...d,
      clients: d.clients.map((c, i) => (i === 1 ? { ...c, displayName: '架空 花子' } : c)),
    };
    const r = ok(importBookings(buf(table.slice(0, 2)), dup));
    expect(r.unmatched).toEqual(['架空花子（同じ名前が2人以上）（1件）']);
  });

  it('形が分からない・空なら止める', () => {
    expect(importBookings(buf([['名前', '日付']]), base())).toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(importBookings(new ArrayBuffer(0), base())).toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});
