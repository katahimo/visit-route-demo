// 読み込む欄の取り違え（PRD D444）：予約の CSV・もう一方の名簿の CSV を選んだら、どの欄で読むかを伝える。値は手引きのサンプル（架空）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeText, parseCsv } from '../lib/csv';
import { bookingWrongPlace, rosterWrongPlace } from './csvPlace';
import { base } from './excel.testkit';
import { importBookings, importRoster } from './index';

const SAMPLES = 'docs/manual/samples/';
const bytes = (name: string) => new Uint8Array(readFileSync(`${SAMPLES}${name}`));
const table = (name: string) => parseCsv(decodeText(bytes(name)).text);
const buf = (name: string) => {
  const b = bytes(name);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const STAFF = 'ベビーシッター_スタッフ_サンプル.csv';
const CLIENT = 'ベビーシッター_顧客_サンプル.csv';
const BOOKING = 'ベビーシッター_予約_サンプル.csv';
const terms = { staff: 'シッター', client: 'お客様' };

describe('名簿の欄', () => {
  it('その名簿の形なら止めない', () => {
    expect(rosterWrongPlace(table(STAFF), 'staff', terms)).toBeNull();
    expect(rosterWrongPlace(table(CLIENT), 'client', terms)).toBeNull();
    expect(rosterWrongPlace(table('職員台帳_サンプル.csv'), 'staff', terms)).toBeNull();
    expect(rosterWrongPlace(table('利用者台帳_サンプル.csv'), 'client', terms)).toBeNull();
  });
  it('もう一方の名簿・予約の CSV なら読む欄を伝える', () => {
    expect(rosterWrongPlace(table(STAFF), 'client', terms)).toBe(
      'このファイルは「予約システムのスタッフ」の CSV（シッターの名簿）です。シッターの名簿の欄で読み込んでください',
    );
    expect(rosterWrongPlace(table(CLIENT), 'staff', terms)).toContain('（お客様の名簿）です。お客様の名簿の欄で');
    expect(rosterWrongPlace(table(BOOKING), 'client', terms)).toBe(
      'このファイルは「予約システムの予約」の CSV（予約）です。「予約の CSV」の欄（登録の案内の③・設定 › データ）で読み込んでください',
    );
  });
  it('読み込みは、名前の重なりの誤りや「列名から読んだ名簿」でなく、読む欄の文で止める', async () => {
    const r = await importRoster(buf(BOOKING), base(), 'client', 'replace', '2026-11-07');
    expect('code' in r && r.message).toContain('「予約の CSV」の欄');
    const s = await importRoster(buf(STAFF), base(), 'client', 'replace', '2026-11-07');
    expect('code' in s && s.message).toContain('の名簿の欄で読み込んでください');
  });
});

describe('予約の欄', () => {
  it('名簿の CSV なら読む名簿の欄を伝える。予約の CSV は止めない', () => {
    expect(bookingWrongPlace(table(CLIENT), terms)).toContain('（お客様の名簿）です。お客様の名簿の欄で');
    expect(bookingWrongPlace(table(STAFF), terms)).toContain('（シッターの名簿）です');
    expect(bookingWrongPlace(table(BOOKING), terms)).toBeNull();
    const r = importBookings(buf(CLIENT), base());
    expect('code' in r && r.message).toContain('の名簿の欄で読み込んでください');
  });
});
