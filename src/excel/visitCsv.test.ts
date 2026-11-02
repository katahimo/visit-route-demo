// 予定の CSV（このアプリの形。ADR-0090。PRD D423）：列の読み方・書き出し・テンプレート・書き出したものを読み直す往復。値は架空
import { describe, expect, it } from 'vitest';
import type { BookingImportResult, DemoData, ImportError } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { decodeText, parseCsv } from '../lib/csv';
import { oneOffVisitsIn } from '../lib/planCsv';
import { readBookingForm } from './bookingForms';
import { base } from './excel.testkit';
import { bookingVisitId, importBookings } from './importBookings';
import { exportVisitsCsv, VISIT_CSV_COLS, visitCsvTemplate, visitCsvToBookings } from './visitCsv';

const HEAD: string[] = Object.values(VISIT_CSV_COLS);
const row = (v: Partial<Record<(typeof HEAD)[number], string>>) => HEAD.map((h) => v[h] ?? '');
const buf = (t: string[][]) => {
  const b = new TextEncoder().encode(t.map((r) => r.join(',')).join('\n'));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const ok = (r: BookingImportResult | ImportError): BookingImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};
const blobTable = async (b: Blob) => parseCsv(decodeText(new Uint8Array(await b.arrayBuffer())).text);
const blobBuf = async (b: Blob) => b.arrayBuffer();

/** 〈利用者さん〉の名前を決め、単発の訪問を消したデータ */
const withClients = (): DemoData => {
  const d = base();
  const [a, b] = d.clients;
  if (!a || !b) throw new Error('seed に〈利用者さん〉がいない');
  return {
    ...d,
    clients: [{ ...a, displayName: '架空 花子' }, { ...b, displayName: '架空 次郎' }, ...d.clients.slice(2)],
    visits: d.visits.filter((v) => v.pattern !== null),
  };
};

describe('予定の CSV の形', () => {
  it('列名で見分ける（予約システムの形とは別）', () => {
    expect(readBookingForm([HEAD])?.form.id).toBe('visit');
    expect(readBookingForm([['日付', '開始', '所要(分)']])).toBeNull();
  });

  it('行を予約の1件に写す（訪問ID・開始の上限・取り消し・読めない行）', () => {
    const t = visitCsvToBookings([
      HEAD,
      row({ 訪問ID: 'v-1', 日付: '2026/11/3', 開始: '9:00', '所要(分)': '60', 訪問先: '架空 花子', メモ: "'=鍵" }),
      row({
        日付: '2026-11-04',
        開始: '10:00',
        開始の上限: '11:00',
        '所要(分)': '90',
        訪問先: '架空 次郎',
        取り消し: '取り消し',
      }),
      row({ 日付: '11/5', 開始: '9:00', '所要(分)': '60', 訪問先: '架空 花子' }),
      row({ 日付: '2026-11-05', 開始: '10:00', 開始の上限: '9:00', '所要(分)': '60', 訪問先: '架空 花子' }),
      row({ 日付: '2026-11-05', 開始: '23:00', '所要(分)': '120', 訪問先: '架空 花子' }),
      row({ 日付: '2026-11-05', 開始: '9:00', '所要(分)': '3', 訪問先: '架空 花子' }),
      row({ 日付: '2026-11-05', 開始: '9:00', '所要(分)': '60' }),
      row({}),
    ])!;
    expect(t.bookings).toEqual([
      {
        ref: 'v-1',
        visitId: 'v-1',
        row: 2,
        date: '2026-11-03',
        start: '09:00',
        durationMinutes: 60,
        clientName: '架空 花子',
        cancelled: false,
        note: '=鍵',
      },
      {
        ref: '2026-11-04_10:00_架空次郎',
        matchSlot: true,
        row: 3,
        date: '2026-11-04',
        start: '10:00',
        latestStart: '11:00',
        durationMinutes: 90,
        clientName: '架空 次郎',
        cancelled: true,
        note: '',
      },
    ]);
    expect(t.badRows).toEqual([
      '4行目：日付「11/5」が日付として読めません（2026-11-03 の形）',
      '5行目：開始の上限が開始より前です',
      '6行目：日をまたぐ訪問は入れられません',
      '7行目：所要(分)「3」は 5〜720 の整数にしてください',
      '8行目：訪問先がありません',
    ]);
    // 担当の列は書き出すだけなので、読まなかった列に数えない
    expect(t.skipped).toEqual([]);
  });
});

describe('書き出しとテンプレート', () => {
  it('テンプレートは列名の行だけ（BOM 付きの UTF-8）', async () => {
    const b = visitCsvTemplate();
    const bytes = new Uint8Array(await b.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blobTable(b)).toEqual([HEAD]);
  });

  it('期間の単発の訪問だけを日付・開始の順に書き出す（繰り返しの回・期間の外は出さない）', async () => {
    const d = withClients();
    const [a, b] = d.clients;
    const staff = d.staff[0];
    const visit = (x: Partial<Visit> & Pick<Visit, 'id' | 'date' | 'earliestStart'>): Visit => ({
      clientId: a!.id,
      windowKind: 'fixed',
      latestStart: x.earliestStart,
      durationMinutes: 60,
      staffId: null,
      start: null,
      pinned: false,
      cancelled: false,
      note: '',
      typeId: null,
      pattern: null,
      cancelKind: null,
      ...x,
    });
    const data: DemoData = {
      ...d,
      visits: [
        ...d.visits,
        visit({ id: 'v-2', date: '2026-11-04', earliestStart: '10:00', clientId: b!.id, cancelled: true }),
        visit({
          id: 'v-1',
          date: '2026-11-03',
          earliestStart: '09:00',
          latestStart: '09:30',
          windowKind: 'window',
          staffId: staff?.id ?? null,
          note: '=鍵',
        }),
        visit({ id: 'v-out', date: '2026-12-01', earliestStart: '09:00' }),
      ],
    };
    expect(oneOffVisitsIn(data, '2026-11-01', '2026-11-30').map((v) => v.id)).toEqual(['v-1', 'v-2']);
    const t = await blobTable(exportVisitsCsv(data, '2026-11-01', '2026-11-30'));
    expect(t).toEqual([
      HEAD,
      ['v-1', '2026-11-03', '9:00', '9:30', '60', '架空 花子', "'=鍵", '', staff?.name ?? ''],
      ['v-2', '2026-11-04', '10:00', '', '60', '架空 次郎', '', '取り消し', ''],
    ]);
  });
});

describe('予定の CSV を読み込む', () => {
  it('訪問ID が無い行は足し、同じファイルを読み直しても二重に入れない', () => {
    const d = withClients();
    const t = [HEAD, row({ 日付: '2026-11-03', 開始: '9:00', '所要(分)': '60', 訪問先: '架空花子', メモ: '初回' })];
    const r = ok(importBookings(buf(t), d));
    expect(r).toMatchObject({ added: 1, updated: 0, otherForm: { label: 'このアプリの予定' } });
    const v = r.data.visits.find((x) => x.id === bookingVisitId({ id: 'visit' }, '2026-11-03_09:00_架空花子'));
    expect(v).toMatchObject({ clientId: d.clients[0]?.id, windowKind: 'fixed', staffId: null, note: '初回' });
    const again = ok(importBookings(buf(t), r.data));
    expect(again).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
  });

  it('書き出したファイルを直して読むと、同じ訪問を直す（担当は残す。担当の列は読まない）', async () => {
    const d = withClients();
    const staffId = d.staff[0]?.id ?? null;
    const first = ok(
      importBookings(buf([HEAD, row({ 日付: '2026-11-03', 開始: '9:00', '所要(分)': '60', 訪問先: '架空 花子' })]), d),
    ).data;
    const assigned: DemoData = {
      ...first,
      visits: first.visits.map((v) => (v.pattern === null ? { ...v, staffId, pinned: true } : v)),
    };
    const exported = await blobTable(exportVisitsCsv(assigned, '2026-11-01', '2026-11-30'));
    const edited = exported.map((r, i) =>
      i === 0 ? r : r.map((c, j) => (HEAD[j] === '開始の上限' ? '10:00' : HEAD[j] === '担当' ? '架空 だれか' : c)),
    );
    const r = ok(importBookings(buf(edited), assigned));
    expect(r).toMatchObject({ added: 0, updated: 1, unchanged: 0, badRows: [] });
    const v = r.data.visits.find((x) => x.pattern === null && x.date === '2026-11-03');
    expect(v).toMatchObject({
      windowKind: 'window',
      earliestStart: '09:00',
      latestStart: '10:00',
      staffId,
      pinned: true,
    });
    // そのまま読み直せば変更なし
    const same = ok(importBookings(await blobBuf(exportVisitsCsv(r.data, '2026-11-01', '2026-11-30')), r.data));
    expect(same).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
  });

  it('繰り返しの回の訪問ID は直さない（保存した回も、まだ保存していない計算した回も）', () => {
    const d = base();
    const saved = d.visits.find((v) => v.pattern !== null);
    const pat = d.patterns[0];
    expect(saved).toBeDefined();
    expect(pat).toBeDefined();
    const name = (clientId: string) => d.clients.find((c) => c.id === clientId)?.displayName ?? '';
    const computed = `2099-01-05_${pat!.id}`;
    const t = [
      HEAD,
      row({ 訪問ID: saved!.id, 日付: saved!.date, 開始: '9:00', '所要(分)': '60', 訪問先: name(saved!.clientId) }),
      row({ 訪問ID: computed, 日付: '2099-01-05', 開始: '9:00', '所要(分)': '60', 訪問先: name(pat!.clientId) }),
    ];
    const r = ok(importBookings(buf(t), d));
    expect(r.badRows).toEqual([
      `2行目：訪問ID「${saved!.id}」は繰り返しの回なので直せません`,
      `3行目：訪問ID「${computed}」は繰り返しの回なので直せません`,
    ]);
    expect(r.added + r.updated).toBe(0);
  });

  it('訪問ID が無い行は、同じ日・開始・訪問先の今の単発の訪問を直す（2件以上なら読めない行）', () => {
    const d = withClients();
    const a = d.clients[0]!;
    const mk = (id: string): Visit => ({
      id,
      date: '2026-11-03',
      clientId: a.id,
      windowKind: 'fixed',
      earliestStart: '09:00',
      latestStart: '09:00',
      durationMinutes: 60,
      staffId: d.staff[0]?.id ?? null,
      start: null,
      pinned: false,
      cancelled: false,
      note: '',
      typeId: null,
      pattern: null,
      cancelKind: null,
    });
    const t = [HEAD, row({ 日付: '2026/11/3', 開始: '9:00', '所要(分)': '90', 訪問先: '架空 花子' })];
    const one: DemoData = { ...d, visits: [...d.visits, mk('v-app')] };
    const r = ok(importBookings(buf(t), one));
    expect(r).toMatchObject({ added: 0, updated: 1 });
    expect(r.data.visits.find((v) => v.id === 'v-app')).toMatchObject({ durationMinutes: 90, staffId: d.staff[0]?.id });
    const two: DemoData = { ...d, visits: [...d.visits, mk('v-a'), mk('v-b')] };
    const r2 = ok(importBookings(buf(t), two));
    expect(r2.badRows).toEqual(['2行目：同じ日・開始・訪問先の訪問が2件以上あるので、訪問ID を入れてください']);
  });

  it('別の人の訪問の訪問ID は直さない（訪問先は変えられない）', () => {
    const d = withClients();
    const first = ok(
      importBookings(buf([HEAD, row({ 日付: '2026-11-03', 開始: '9:00', '所要(分)': '60', 訪問先: '架空 花子' })]), d),
    ).data;
    const id = first.visits.find((v) => v.pattern === null)!.id;
    const r = ok(
      importBookings(
        buf([HEAD, row({ 訪問ID: id, 日付: '2026-11-03', 開始: '9:00', '所要(分)': '60', 訪問先: '架空 次郎' })]),
        first,
      ),
    );
    expect(r.badRows).toEqual([`2行目：訪問ID「${id}」は別の人の訪問です（訪問先は変えられません）`]);
  });

  it('取り消しの列：○・はい は取り消し、×・なし・空は取り消しでない、ほかは読めない行', () => {
    const at = (x: string) =>
      visitCsvToBookings([
        HEAD,
        row({ 日付: '2026-11-03', 開始: '9:00', '所要(分)': '60', 訪問先: 'A', 取り消し: x }),
      ])!;
    for (const x of ['取り消し', '○', 'はい', 'TRUE']) expect(at(x).bookings[0]?.cancelled, x).toBe(true);
    for (const x of ['', '×', 'なし', 'いいえ', 'FALSE', '0']) expect(at(x).bookings[0]?.cancelled, x).toBe(false);
    expect(at('たぶん').badRows).toEqual(['2行目：取り消し「たぶん」は「取り消し」か空にしてください']);
  });

  it('時間帯の訪問は開始の上限が開始と同じでも往復で変わらない。Excel で保存し直した形（2026/11/3・9:00:00）も読める', async () => {
    const d = withClients();
    const t = [
      HEAD,
      row({ 日付: '2026/11/3', 開始: '9:00:00', 開始の上限: '9:00', '所要(分)': '60', 訪問先: '架空 花子' }),
    ];
    const r = ok(importBookings(buf(t), d));
    const v = r.data.visits.find((x) => x.pattern === null);
    expect(v).toMatchObject({ windowKind: 'window', earliestStart: '09:00', latestStart: '09:00' });
    const again = ok(importBookings(await blobBuf(exportVisitsCsv(r.data, '2026-11-01', '2026-11-30')), r.data));
    expect(again).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
  });
});
