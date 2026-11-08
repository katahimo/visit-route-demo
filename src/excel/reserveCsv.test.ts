// 予約システムの形の名簿（ADR-0075。PRD D396・D397）：列名で見分ける・名簿の列に写す・読まない列を挙げる・名簿として読み込める。値は架空
import { describe, expect, it } from 'vitest';
import type { ImportError, RosterImportResult } from '../contracts/data';
import { base } from './excel.testkit';
import { importRoster } from './index';
import {
  isReserveClientHeader,
  isReserveStaffHeader,
  reserveClientToRoster,
  reserveStaffToRoster,
  splitLatLng,
  splitPostal,
} from './reserveCsv';
import { ROSTER_FORMS, readRosterForm } from './rosterForms';

const STAFF_HEAD =
  'ID,氏名,住所,TEL,mail address,緯度・経度,入社日,退職日,ユーザーID,パスワード(暗号化),管理者,LW_ID,GoogleChatID,都度更新ユーザ識別(SessionToken),識別符号期限(SessionExpiry),性別'.split(
    ',',
  );
const staffRow = (v: Record<string, string>) => STAFF_HEAD.map((h) => v[h] ?? '');
const STAFF_TABLE = [
  STAFF_HEAD,
  staffRow({
    ID: 'S1',
    氏名: '架空 一子',
    TEL: '000-0000-0001',
    'mail address': 'a@example.com',
    緯度・経度: '35.1, 139.2',
    入社日: '2021.09.21',
    性別: '女',
  }),
  staffRow({ ID: 'S2', 氏名: '架空 二子', 緯度・経度: '35.2,139.3', 退職日: '2026.3.31' }),
  staffRow({ ID: 'S3', 氏名: '架空 三子', 退職日: '2026年12月31日' }),
  staffRow({ ID: 'S4', 性別: '女' }),
];

const CLIENT_HEAD = [
  '顧客ID',
  '姓',
  '名',
  '姓（カナ）※必須項目',
  '名（カナ）※必須項目',
  'メールアドレス',
  '国番号',
  '電話番号※必須項目',
  '会員種別',
  '会員状況（有効／無効）',
  'パスワード',
  '顧客メモ',
  '性別',
  '年代',
  '住所',
  '駐車場',
  '駐車場番号・指定場所の詳細など',
  '緊急連絡先',
  '世帯全員の情報（名前・生年月日・職業/所属・アレルギー・その他共有事項）',
  '住所2',
  '住所2[適用開始日YYYY/MM/DD]',
  '住所2[適用終了日YYYY/MM/DD]',
  '緯度・経度',
];
const clientRow = (v: Record<string, string>) => CLIENT_HEAD.map((h) => v[h] ?? '');
const CLIENT_TABLE = [
  CLIENT_HEAD,
  clientRow({
    顧客ID: 'C1',
    姓: '架空',
    名: '花子',
    '姓（カナ）※必須項目': 'カクウ',
    '名（カナ）※必須項目': 'ハナコ',
    '電話番号※必須項目': '000-0000-0000',
    '会員状況（有効／無効）': '有効',
    住所: '〒100-0001 架空市架空町1丁目',
    駐車場: 'コインパーキング',
    駐車場番号・指定場所の詳細など: '3番',
    緯度・経度: '35.5, 139.5',
    顧客メモ: '鍵は管理人',
    '世帯全員の情報（名前・生年月日・職業/所属・アレルギー・その他共有事項）': '卵アレルギー',
  }),
  clientRow({
    顧客ID: 'C2',
    '姓（カナ）※必須項目': 'ナナシ',
    '名（カナ）※必須項目': 'タロウ',
    住所: '架空市架空台2丁目',
    '会員状況（有効／無効）': '無効',
  }),
  clientRow({ 顧客ID: 'C3', 姓: '架空', 名: '花子', 住所: '1000002 架空市' }),
  clientRow({ 顧客ID: 'C4', 姓: '架空', 名: '月子' }),
];

const rok = (r: RosterImportResult | ImportError): RosterImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};
const csvBuf = (t: string[][]) => {
  const b = new TextEncoder().encode(
    t.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n'),
  );
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
/** UTF-16LE（BOM 付き）・タブ区切り（予約システムの書き出しと同じ） */
const utf16Tsv = (t: string[][]) => {
  const s = `${t.map((r) => r.join('\t')).join('\r\n')}\r\n`;
  const out = new Uint8Array(2 + s.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[2 + i * 2] = c & 0xff;
    out[3 + i * 2] = c >> 8;
  }
  return out.buffer;
};

describe('小さい変換', () => {
  it('緯度・経度を分ける', () => {
    expect(splitLatLng('38.3174, 140.8119')).toEqual({ lat: '38.3174', lng: '140.8119' });
    expect(splitLatLng('35.1,139.2')).toEqual({ lat: '35.1', lng: '139.2' });
    expect(splitLatLng('')).toEqual({ lat: '', lng: '' });
    expect(splitLatLng('不明')).toEqual({ lat: '', lng: '' });
  });
  it('住所の先頭の郵便番号を分ける', () => {
    expect(splitPostal('〒984-0802 架空市')).toEqual({ postal: '9840802', address: '架空市' });
    expect(splitPostal('982-0037 架空市')).toEqual({ postal: '9820037', address: '架空市' });
    expect(splitPostal('架空市1丁目')).toEqual({ postal: '', address: '架空市1丁目' });
  });
});

describe('スタッフの CSV', () => {
  it('列名で見分ける（名簿の形の「名前」があれば名簿として読む）', () => {
    expect(isReserveStaffHeader(STAFF_HEAD)).toBe(true);
    expect(isReserveStaffHeader([...STAFF_HEAD, '名前'])).toBe(false);
    expect(isReserveStaffHeader(['ID', '氏名'])).toBe(false);
  });
  it('名簿の列に写す（退職日を過ぎた人は休止・氏名の無い行は空行・読まない列を挙げる）', () => {
    const out = reserveStaffToRoster(STAFF_TABLE, '2026-10-31')!;
    expect(out.rows).toEqual([
      ['名前', 'メールアドレス', '住所', '緯度', '経度', '利用中', '最終勤務日'],
      ['架空 一子', 'a@example.com', '', '35.1', '139.2', '○', ''],
      ['架空 二子', '', '', '35.2', '139.3', '×', '2026-03-31'],
      ['架空 三子', '', '', '', '', '○', '2026-12-31'],
      ['', '', '', '', '', '', ''],
    ]);
    expect(out.skipped).toEqual(
      STAFF_HEAD.filter((h) => !['ID', '氏名', '住所', 'mail address', '緯度・経度', '退職日'].includes(h)),
    );
  });
  it('辞めた日は年月日の書き方も読む。読めない退職日はそのまま渡し、誤りの文は退職日の列名で出す', async () => {
    const t = [STAFF_HEAD, staffRow({ ID: 'S1', 氏名: '架空 一子', 退職日: '2026年3月31日' })];
    expect(reserveStaffToRoster(t, '2026-10-31')?.rows[1]?.slice(5)).toEqual(['×', '2026-03-31']);
    const bad = [STAFF_HEAD, staffRow({ ID: 'S1', 氏名: '架空 一子', 退職日: '来月' })];
    const r = await importRoster(csvBuf(bad), base(), 'staff', 'merge', '2026-10-31');
    expect('code' in r && r.message).toContain('『退職日』');
  });
  it('今いる人に H列の退職日（2026.03.31）を読み直すと、最終勤務日が入り、過ぎていれば休止になる', async () => {
    const one = [STAFF_HEAD, staffRow({ ID: 'S1', 氏名: '架空 一子' })];
    const first = rok(await importRoster(csvBuf(one), base(), 'staff', 'merge', '2026-11-07'));
    expect(first.data.staff.find((x) => x.name === '架空 一子')).toMatchObject({ active: true, lastDay: null });
    const t = [STAFF_HEAD, staffRow({ ID: 'S1', 氏名: '架空 一子', 退職日: '2026.03.31' })];
    expect(STAFF_HEAD.indexOf('退職日')).toBe(7);
    const r = rok(await importRoster(csvBuf(t), first.data, 'staff', 'merge', '2026-11-07'));
    expect(r.updated).toEqual(['架空 一子']);
    expect(r.data.staff.find((x) => x.name === '架空 一子')).toMatchObject({ active: false, lastDay: '2026-03-31' });
  });
  it('同じ氏名は全員 ID を添えて分け、形の違うメールは読まずに知らせる', () => {
    const t = [
      STAFF_HEAD,
      staffRow({ ID: 'S1', 氏名: '架空 一子', 'mail address': 'not-an-email' }),
      staffRow({ ID: 'S2', 氏名: '架空　一子' }),
    ];
    const out = reserveStaffToRoster(t, '2026-10-31')!;
    expect(out.rows.slice(1).map((r) => r.slice(0, 2))).toEqual([
      ['架空 一子（S1）', ''],
      ['架空　一子（S2）', ''],
    ]);
    expect(out.skipped).toContain('mail address（形の違う値 1件）');
  });
  it('〈スタッフ〉の名簿として読み込める（UTF-16LE・タブ区切り）', async () => {
    const r = rok(await importRoster(utf16Tsv(STAFF_TABLE), base(), 'staff', 'merge', '2026-10-31'));
    expect(r.otherForm?.label).toBe('予約システムのスタッフ');
    expect(r.added).toEqual(['架空 一子', '架空 二子（休止）', '架空 三子']);
    const s = r.data.staff.find((x) => x.name === '架空 一子');
    expect(s).toMatchObject({ email: 'a@example.com', home: { lat: 35.1, lng: 139.2 }, active: true, lastDay: null });
    expect(r.data.staff.find((x) => x.name === '架空 三子')?.lastDay).toBe('2026-12-31');
    expect(JSON.stringify(r.data)).not.toContain('000-0000-0001');
  });
});

describe('顧客の CSV', () => {
  it('列名で見分ける', () => {
    expect(isReserveClientHeader(CLIENT_HEAD)).toBe(true);
    expect(isReserveClientHeader(['顧客ID', '姓', '名'])).toBe(false);
  });
  it('名簿の列に写す（名前が無ければカナ・同じ名前は顧客ID を添える・無効は終了）', () => {
    const out = reserveClientToRoster(CLIENT_TABLE)!;
    expect(out.rows[0]?.slice(0, 9)).toEqual([
      '表示名',
      'よみ',
      '郵便番号',
      '住所',
      '緯度',
      '経度',
      '駐車場',
      'メモ',
      '段階',
    ]);
    expect(out.rows[1]?.slice(0, 9)).toEqual([
      '架空 花子（C1）',
      'かくうはなこ',
      '1000001',
      '架空市架空町1丁目',
      '35.5',
      '139.5',
      'コインパーキング　3番',
      '電話 000-0000-0000\n鍵は管理人',
      '利用中',
    ]);
    expect(out.rows[2]?.[0]).toBe('ナナシ タロウ');
    expect(out.rows[2]?.[8]).toBe('終了');
    expect(out.rows[3]?.slice(0, 4)).toEqual(['架空 花子（C3）', '', '1000002', '架空市']);
    expect(out.rows[4]?.[0]).toBe('架空 月子');
    // 読まなかった列はファイルの表記のまま
    expect(out.skipped).toContain('世帯全員の情報（名前・生年月日・職業/所属・アレルギー・その他共有事項）');
  });
  it('住所2・期間は期間つきの訪問先の列へ（緯度・経度は住所2 の位置。住所2 が空なら空）', () => {
    const out = reserveClientToRoster([
      CLIENT_HEAD,
      clientRow({
        顧客ID: 'A',
        姓: '架空',
        名: 'A',
        住所: '〒100-0001 架空県架空市本町1丁目',
        住所2: '〒100-0005 架空市駅前2丁目',
        '住所2[適用開始日YYYY/MM/DD]': '2026/8/1',
        '住所2[適用終了日YYYY/MM/DD]': '2026/8/30',
        緯度・経度: '35.6, 139.6',
      }),
      clientRow({ 顧客ID: 'B', 姓: '架空', 名: 'B', 住所: '架空市泉1丁目', 緯度・経度: '35.7, 139.7' }),
      clientRow({ 顧客ID: 'C', 姓: '架空', 名: 'C', 住所2: '架空市港3丁目', '住所2[適用開始日YYYY/MM/DD]': '不明' }),
    ])!;
    const head = out.rows[0]!;
    const row = (i: number) => Object.fromEntries(head.map((h, k) => [h, out.rows[i]?.[k]]));
    expect(row(1)).toMatchObject({
      郵便番号: '1000001',
      住所: '架空県架空市本町1丁目',
      緯度: '',
      経度: '',
      住所2: '架空市駅前2丁目',
      住所2の郵便番号: '1000005',
      住所2の緯度: '35.6',
      住所2の経度: '139.6',
      住所2の開始日: '2026-08-01',
      住所2の終了日: '2026-08-30',
      メモ: '',
    });
    expect(row(2)).toMatchObject({ 住所: '架空市泉1丁目', 緯度: '35.7', 住所2: '', 住所2の緯度: '' });
    // 読めない日付：期間を空にすると毎日が住所2 になるので、住所2 を入れない
    expect(row(3)).toMatchObject({ 住所2: '', 住所2の開始日: '', 住所2の終了日: '' });
    expect(out.skipped).toContain('住所2（適用期間の日付が読めない・逆のため入れなかった 1件）');
    expect(out.skipped).not.toContain('住所2');
  });
  it('住所2 が「なし」などなら住所2 なし（住所として位置を探さない）。緯度・経度は住所の位置にも使わない', () => {
    const out = reserveClientToRoster([
      CLIENT_HEAD,
      clientRow({ 顧客ID: 'A', 姓: '架空', 名: 'A', 住所: '架空市泉1丁目', 住所2: 'なし', 緯度・経度: '35.7, 139.7' }),
      clientRow({ 顧客ID: 'B', 姓: '架空', 名: 'B', 住所: '架空市港3丁目', 住所2: ' 無し。' }),
      clientRow({ 顧客ID: 'C', 姓: '架空', 名: 'C', 住所: '架空市港4丁目', 住所2: 'ー' }),
    ])!;
    const head = out.rows[0]!;
    const row = (i: number) => Object.fromEntries(head.map((h, k) => [h, out.rows[i]?.[k]]));
    expect(row(1)).toMatchObject({ 住所: '架空市泉1丁目', 緯度: '', 住所2: '', 住所2の緯度: '' });
    expect(row(2)).toMatchObject({ 住所2: '', 住所2の開始日: '' });
    expect(row(3)).toMatchObject({ 住所2: '' });
  });
  it('住所2 の列が無い CSV は住所2 の列を出さない（アプリの住所2 は今のまま）', () => {
    const head = CLIENT_HEAD.filter((h) => !h.startsWith('住所2'));
    const out = reserveClientToRoster([head, head.map((h) => (h === '姓' ? '架空' : ''))])!;
    expect(out.rows[0]).not.toContain('住所2');
  });
  it('読み直すたびに住所2 を置き換える。住所2 が空になれば無し。同じ住所2 の空の位置は今のまま', async () => {
    const row = (v: Record<string, string>) =>
      clientRow({ 顧客ID: 'C9', 姓: '架空', 名: '戻子', 住所: '架空市本町1丁目', ...v });
    const first = rok(
      await importRoster(
        csvBuf([
          CLIENT_HEAD,
          row({
            住所2: '架空市駅前2丁目',
            '住所2[適用開始日YYYY/MM/DD]': '2026/8/1',
            '住所2[適用終了日YYYY/MM/DD]': '2026/8/30',
            緯度・経度: '35.6, 139.6',
          }),
        ]),
        base(),
        'client',
        'merge',
        '2026-08-15',
      ),
    ).data;
    const c1 = first.clients.find((c) => c.displayName === '架空 戻子');
    expect(c1?.place.address).toBe('架空市本町1丁目');
    expect(c1?.place2).toEqual({
      address: '架空市駅前2丁目',
      postalCode: '',
      lat: 35.6,
      lng: 139.6,
      from: '2026-08-01',
      to: '2026-08-30',
    });
    const again = rok(
      await importRoster(
        csvBuf([CLIENT_HEAD, row({ 住所2: '架空市駅前2丁目', '住所2[適用終了日YYYY/MM/DD]': '2026/9/30' })]),
        first,
        'client',
        'merge',
        '2026-08-15',
      ),
    ).data;
    expect(again.clients.find((c) => c.displayName === '架空 戻子')?.place2).toMatchObject({
      lat: 35.6,
      from: '',
      to: '2026-09-30',
    });
    const cleared = rok(
      await importRoster(csvBuf([CLIENT_HEAD, row({})]), again, 'client', 'merge', '2026-08-15'),
    ).data;
    expect(cleared.clients.find((c) => c.displayName === '架空 戻子')?.place2).toBeUndefined();
  });
  it('以前の取り込みで住所に入った住所2 の位置は外す。住所の空白・全角半角の違いでは位置を消さない', async () => {
    const head = CLIENT_HEAD.filter((h) => !h.startsWith('住所2'));
    const old = rok(
      await importRoster(
        csvBuf([
          head,
          head.map(
            (h) =>
              ({ 顧客ID: 'C8', 姓: '架空', 名: '旧子', 住所: '架空市本町1丁目', 緯度・経度: '35.6, 139.6' })[h] ?? '',
          ),
        ]),
        base(),
        'client',
        'merge',
        '2026-08-15',
      ),
    ).data;
    expect(old.clients.find((c) => c.displayName === '架空 旧子')?.place.lat).toBe(35.6);
    const row = clientRow({
      顧客ID: 'C8',
      姓: '架空',
      名: '旧子',
      住所: '架空市本町１丁目 ',
      住所2: '架空市駅前2丁目',
      緯度・経度: '35.6, 139.6',
    });
    const now = rok(await importRoster(csvBuf([CLIENT_HEAD, row]), old, 'client', 'merge', '2026-08-15')).data;
    const c = now.clients.find((x) => x.displayName === '架空 旧子');
    expect(c?.place).toMatchObject({ lat: null, lng: null });
    expect(c?.place2).toMatchObject({ lat: 35.6, lng: 139.6 });
    // 住所2 の無い人：表記の違うだけの住所では位置を消さない
    const kept = rok(
      await importRoster(
        csvBuf([head, head.map((h) => ({ 顧客ID: 'C8', 姓: '架空', 名: '旧子', 住所: '架空市本町１丁目' })[h] ?? '')]),
        old,
        'client',
        'merge',
        '2026-08-15',
      ),
    ).data;
    expect(kept.clients.find((x) => x.displayName === '架空 旧子')?.place.lat).toBe(35.6);
  });
  it('〈利用者さん〉の名簿として読み込める。読まない値はデータに残さない', async () => {
    const r = rok(await importRoster(csvBuf(CLIENT_TABLE), base(), 'client', 'merge', '2026-10-31'));
    expect(r.otherForm?.label).toBe('予約システムの顧客');
    expect(r.added).toEqual(['架空 花子（C1）', 'ナナシ タロウ（終了）', '架空 花子（C3）', '架空 月子']);
    const c = r.data.clients.find((x) => x.displayName === '架空 花子（C1）');
    expect(c).toMatchObject({
      kana: 'かくうはなこ',
      parkingNote: 'コインパーキング　3番',
      place: { lat: 35.5, lng: 139.5, postalCode: '1000001' },
    });
    expect(JSON.stringify(r.data)).not.toContain('卵アレルギー');
  });
  it('並びが変わっても同じ人に当たり、空の欄はアプリで入れた値を消さない', async () => {
    const first = rok(await importRoster(csvBuf(CLIENT_TABLE), base(), 'client', 'merge', '2026-10-31')).data;
    const placed = {
      ...first,
      clients: first.clients.map((c) =>
        c.displayName === '架空 月子'
          ? { ...c, place: { ...c.place, address: '架空市3丁目', lat: 35.7, lng: 139.7 } }
          : c,
      ),
    };
    const [head, ...rows] = CLIENT_TABLE;
    const again = rok(await importRoster(csvBuf([head!, ...rows.reverse()]), placed, 'client', 'merge', '2026-10-31'));
    expect(again.added).toEqual([]);
    expect(again.updated).toEqual([]);
    expect(again.data.clients.find((c) => c.displayName === '架空 月子')?.place).toMatchObject({
      address: '架空市3丁目',
      lat: 35.7,
      lng: 139.7,
    });
  });
});

describe('形の一覧', () => {
  it('ID は重ならず、名簿の種類ごとに見分ける', () => {
    const ids = ROSTER_FORMS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 予約システムのスタッフの CSV を〈利用者さん〉で読むと、既存の形ではなく列名から読んだ名簿（氏名の列）になる
    expect(readRosterForm(STAFF_TABLE, 'client', { today: '2026-10-31', items: [] })?.form.id).toBe('generic-client');
    expect(readRosterForm(STAFF_TABLE, 'staff', { today: '2026-10-31', items: [] })?.form.id).toBe('reserve-staff');
    // アプリの名簿の形（名簿にしか無い列がある）はどの形でもない。「名前」だけなら列名から読む形
    expect(readRosterForm([['名前', '移動手段']], 'staff', { today: '2026-10-31', items: [] })).toBeNull();
    expect(readRosterForm([['名前']], 'staff', { today: '2026-10-31', items: [] })?.form.id).toBe('generic-staff');
  });
  it('形を足すと、その形で読む（別の会社の形を足すときの手本）', () => {
    const other = {
      id: 'other',
      label: '別の会社',
      kind: 'staff' as const,
      toRoster: (t: readonly (readonly string[])[]) =>
        t[0]?.[0] === 'スタッフ名' ? { rows: [['名前'], ...t.slice(1).map((r) => [r[0] ?? ''])], skipped: [] } : null,
    };
    const hit = readRosterForm([['スタッフ名'], ['架空 一子']], 'staff', { today: '2026-10-31', items: [] }, [
      other,
      ...ROSTER_FORMS,
    ]);
    expect(hit?.form.label).toBe('別の会社');
    expect(hit?.table.rows).toEqual([['名前'], ['架空 一子']]);
  });
});
