// 顧客台帳の形（ADR-0073。PRD D386・D387）：列名で見分ける・名簿の列に写す・読まない列を挙げる・名簿として読み込める。値は架空
import { describe, expect, it } from 'vitest';
import type { ImportError, RosterImportResult } from '../contracts/data';
import { toCsv } from '../lib/csv';
import { legacyEncoder } from '../lib/csv.testkit';
import { clip } from './csvColumns';
import { base } from './excel.testkit';
import { importRoster } from './index';
import { isLedgerHeader, ledgerToRoster, phoneLine } from './ledgerCsv';

const HEAD =
  '利用者名,利用者カナ,利用者生年月日,性別,郵便番号,都道府県,市区町村,町名以下,建物名,利用者電話番号,利用者携帯電話番号,請求方法,請求送付先,請求先氏名,続柄,請求先郵便番号,請求先都道府県,請求先市区町村,請求先町名以下,請求先建物名,請求先電話番号,顧客番号,銀行番号,支店番号,口座種別,口座番号,口座名義名カナ,利用者状態,備考'.split(
    ',',
  );
/** 29列の1行（値の指定が無い列は空） */
const rowOf = (v: Record<string, string>) => HEAD.map((h) => v[h] ?? '');
const HANAKO = rowOf({
  利用者名: '山田 花子',
  利用者カナ: 'ヤマダ ハナコ',
  利用者生年月日: '2000/1/1',
  性別: '女',
  郵便番号: '1000001',
  都道府県: '架空県',
  市区町村: '架空市',
  町名以下: '架空町1-1-1',
  建物名: '',
  利用者電話番号: '000-0000-0000',
  利用者携帯電話番号: '000-0000-0001',
  顧客番号: '12345',
  利用者状態: '利用中',
  備考: '移動支援',
});
const TARO = rowOf({
  利用者名: '鈴木 太郎',
  利用者カナ: 'ｽｽﾞｷ　ﾀﾛｳ',
  郵便番号: '100-0002',
  都道府県: '架空県',
  市区町村: '架空市',
  町名以下: '架空台２－３',
  建物名: 'サンプルハイツ101',
  利用者状態: '終了',
});
const table = [HEAD, HANAKO, TARO];
const rok = (r: RosterImportResult | ImportError): RosterImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};
const buf = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteLength + bytes.byteOffset) as ArrayBuffer;
const utf8 = (s: string) => buf(new TextEncoder().encode(s));

describe('顧客台帳の形の見分け', () => {
  it('列名で見分ける（利用者名があり、台帳らしい列がもう1つ以上）', () => {
    expect(isLedgerHeader(HEAD)).toBe(true);
    expect(isLedgerHeader(['利用者名', '利用者カナ'])).toBe(true);
    expect(isLedgerHeader(['利用者名'])).toBe(false);
    expect(isLedgerHeader(['表示名', 'よみ', '利用者名', '利用者カナ'])).toBe(false);
    expect(isLedgerHeader(['名前', '住所'])).toBe(false);
    expect(
      ledgerToRoster([
        ['表示名', 'メモ'],
        ['a', 'b'],
      ]),
    ).toBeNull();
  });
});

describe('顧客台帳 → 名簿の列', () => {
  const out = ledgerToRoster(table)!;
  it('名前・よみ（ひらがな・空白を詰める）・郵便番号・住所・備考（電話が先頭）・段階', () => {
    expect(out.rows[0]).toEqual(['表示名', 'よみ', '郵便番号', '住所', 'メモ', '段階']);
    expect(out.rows[1]).toEqual([
      '山田 花子',
      'やまだはなこ',
      '1000001',
      '架空県架空市架空町1-1-1',
      '電話 000-0000-0000　携帯 000-0000-0001\n移動支援',
      '利用中',
    ]);
    // 半角カナ・全角空白・建物名つき・状態が利用中でなければ終了・電話も備考も無ければメモは空
    expect(out.rows[2]).toEqual([
      '鈴木 太郎',
      'すずきたろう',
      '100-0002',
      '架空県架空市架空台２－３サンプルハイツ101',
      '',
      '終了',
    ]);
  });
  it('読まなかった列：請求・口座・生年月日・性別・続柄・顧客番号など', () => {
    expect(out.skipped).toEqual(
      HEAD.filter(
        (h) =>
          !/^(利用者名|利用者カナ|郵便番号|都道府県|市区町村|町名以下|建物名|利用者電話番号|利用者携帯電話番号|利用者状態|備考)$/.test(
            h,
          ),
      ),
    );
    expect(out.skipped).toHaveLength(18);
    expect(out.skipped).toContain('請求先郵便番号');
    expect(out.skipped).not.toContain('郵便番号');
  });
  it('状態が空・「利用中」以外は終了。空の行は空のまま残す（行番号を合わせる）', () => {
    const t = ledgerToRoster([
      HEAD,
      rowOf({ 利用者名: 'あ', 利用者状態: '' }),
      rowOf({}),
      rowOf({ 利用者名: 'い', 利用者状態: '待機' }),
    ])!;
    expect(t.rows.map((r) => [r[0], r[5]])).toEqual([
      ['表示名', '段階'],
      ['あ', '終了'],
      ['', ''],
      ['い', '終了'],
    ]);
  });
  it('電話の行：片方だけ・どちらも無い', () => {
    expect(phoneLine('1', '')).toBe('電話 1');
    expect(phoneLine('', '2')).toBe('携帯 2');
    expect(phoneLine('', '')).toBe('');
  });
  it('長さの上限（名前50・よみ50・住所200・備考500）に収める。サロゲートペアは割らない', () => {
    const long = ledgerToRoster([
      HEAD,
      rowOf({
        利用者名: 'あ'.repeat(60),
        利用者カナ: 'ア'.repeat(60),
        町名以下: 'い'.repeat(250),
        備考: 'う'.repeat(600),
      }),
    ])!.rows[1]!;
    expect(long[0]).toHaveLength(50);
    expect(long[1]).toHaveLength(50);
    expect(long[3]).toHaveLength(200);
    expect(long[4]).toHaveLength(500);
    expect(clip('𠮷𠮷𠮷', 5)).toBe('𠮷𠮷');
  });
});

describe('顧客台帳を名簿として読み込む', () => {
  const asCsv = (sep: ',' | '\t', eol: '\n' | '\r\n') =>
    table.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c}"` : c)).join(sep)).join(eol) + eol;

  const check = (r: RosterImportResult) => {
    expect(r.added).toEqual(['山田 花子', '鈴木 太郎（終了）']);
    expect(r.otherForm?.skippedColumns).toHaveLength(18);
    const [h, t] = r.data.clients.slice(-2);
    expect(h).toMatchObject({
      displayName: '山田 花子',
      kana: 'やまだはなこ',
      place: { postalCode: '1000001', address: '架空県架空市架空町1-1-1' },
      note: '電話 000-0000-0000　携帯 000-0000-0001\n移動支援',
    });
    expect(h?.stage).toBe('active');
    expect(t?.stage).toBe('ended');
    expect(t?.place.postalCode).toBe('1000002');
    // 読まない値はデータに残さない
    const json = JSON.stringify(r.data);
    for (const s of ['2000/1/1', '12345']) expect(json).not.toContain(s);
  };

  for (const [sep, eol] of [
    [',', '\n'],
    ['\t', '\r\n'],
  ] as const) {
    it(`UTF-8（BOM なし）・${sep === ',' ? 'カンマ' : 'タブ'}区切り・${eol === '\n' ? 'LF' : 'CRLF'}`, async () => {
      const r = rok(await importRoster(utf8(asCsv(sep, eol)), base(), 'client', 'merge'));
      expect(r.source).toEqual({ format: 'csv', encoding: 'UTF-8' });
      check(r);
    });
  }

  it('BOM 付きの UTF-8', async () => {
    const r = rok(await importRoster(utf8(`﻿${asCsv(',', '\r\n')}`), base(), 'client', 'merge'));
    expect(r.source).toEqual({ format: 'csv', encoding: 'UTF-8' });
    check(r);
  });

  it('Shift_JIS（タブ区切り・CRLF）。BOM 付きの UTF-8 も同じに読む', async () => {
    const sjis = legacyEncoder('shift_jis')(asCsv('\t', '\r\n'));
    const r = rok(await importRoster(buf(sjis), base(), 'client', 'merge'));
    expect(r.source).toEqual({ format: 'csv', encoding: 'Shift_JIS' });
    check(r);
  });

  it('同じ名前の人は突き合わせて更新する（名簿と同じ。名前で）', async () => {
    const d = base();
    const first = rok(await importRoster(utf8(toCsv(table)), d, 'client', 'merge'));
    const again = rok(await importRoster(utf8(toCsv(table)), first.data, 'client', 'merge'));
    expect(again.added).toEqual([]);
    expect(again.updated).toEqual([]);
    expect(again.unchanged).toBe(2);
  });

  it('名簿の形は今までどおり（ledger は null）。〈スタッフ〉は台帳として読まない', async () => {
    const r = rok(await importRoster(utf8('表示名,メモ\r\n新しい人,あ\r\n'), base(), 'client', 'merge'));
    expect(r.otherForm).toBeNull();
    const bad = await importRoster(utf8(toCsv(table)), base(), 'staff', 'merge');
    expect('code' in bad).toBe(true);
  });

  it('名前が空の行は行付きで止める', async () => {
    const bad = await importRoster(utf8(toCsv([HEAD, rowOf({ 利用者カナ: 'ア' })])), base(), 'client', 'merge');
    expect('code' in bad && bad.message).toContain('2行目');
  });

  it('空行を挟んでも、エラーの行番号は元のファイルのまま。列名は台帳の列名で出す', async () => {
    const text = `${toCsv([HEAD, HANAKO]).trimEnd()}\r\n\r\n\r\n${toCsv([rowOf({ 利用者カナ: 'ア', 郵便番号: 'abc' })])}`;
    const bad = await importRoster(utf8(text), base(), 'client', 'merge');
    const msg = 'code' in bad ? bad.message : '';
    expect(msg).toContain('5行目・『利用者名』');
    expect(msg).toContain('5行目・『郵便番号』');
    expect(msg).not.toContain('『表示名』');
  });
});

describe('列名が空の列', () => {
  it('値があれば「（列名なし・N列目）」として読まなかった列に出す。値が無ければ出さない', () => {
    const withValue = ledgerToRoster([
      [...HEAD, '', ''],
      [...HANAKO, '何か', ''],
    ])!;
    expect(withValue.skipped).toContain(`（列名なし・${HEAD.length + 1}列目）`);
    expect(withValue.skipped).not.toContain(`（列名なし・${HEAD.length + 2}列目）`);
  });
});
