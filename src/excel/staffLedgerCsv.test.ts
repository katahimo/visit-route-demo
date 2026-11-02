// 職員台帳の形（PRD D421）：列名で見分ける・〈スタッフ〉の名簿の列に写す・資格を項目「資格」に写す・名簿として読み込める。値は架空
import { describe, expect, it } from 'vitest';
import type { ImportError, RosterImportResult } from '../contracts/data';
import type { Item } from '../contracts/rules';
import { toCsv } from '../lib/csv';
import { legacyEncoder } from '../lib/csv.testkit';
import { base } from './excel.testkit';
import { importRoster } from './index';
import { readRosterForm } from './rosterForms';
import { isStaffLedgerHeader, qualificationCols, staffLedgerToRoster } from './staffLedgerCsv';

/** 介護ソフトの職員台帳の1行目（56列。書き出しのまま） */
const HEAD =
  '所属,社員番号,職員名,職員カナ,入社年月日,退社年月日,郵便番号,都道府県,市区町村,町名以下,建物名,職員電話番号,職員携帯電話番号,職員Eメールアドレス,雇用形態,在職状況,介護支援専門員,介護福祉士,ホームヘルパー1級,ホームヘルパー2級,看護師,准看護師,保健師,理学療法士,作業療法士,言語聴覚士,医師,薬剤師,管理栄養士,歯科衛生士,柔道整復師,あん摩マッサージ指圧師,社会福祉主事,社会福祉士,精神保健福祉士,義肢装具士,介護職員基礎研修,介護職員初任者研修,介護福祉士実務者研修,福祉住環境コーディネーター1級,福祉住環境コーディネーター2級,福祉住環境コーディネーター3級,居宅介護職員初任者研修課程,障害者居宅介護従業者基礎研修課程,重度訪問介護従業者養成研修(基礎),重度訪問介護従業者養成研修(追加),行動援護従業者養成研修,同行援護従業者養成研修(一般),同行援護従業者養成研修(応用),視覚障害者ガイド養成研修修了者,全身性障害者ガイド養成研修修了者,知的障害者ガイド養成研修修了者,児童発達支援管理責任者,心理士,児童指導員,調理師'.split(
    ',',
  );
/** 56列の1行（値の指定が無い列は空） */
const rowOf = (v: Record<string, string>) => HEAD.map((h) => v[h] ?? '');
const ICHIKO = rowOf({
  所属: '架空訪問介護',
  社員番号: '101',
  職員名: '架空 一子',
  職員カナ: 'カクウ イチコ',
  入社年月日: '2025/5/1',
  郵便番号: '1000001',
  都道府県: '架空県',
  市区町村: '架空市',
  町名以下: '架空町1-2-3',
  建物名: 'サンプル荘101',
  職員携帯電話番号: '000-0000-0000',
  職員Eメールアドレス: 'ichiko@example.com',
  雇用形態: '常勤',
  在職状況: '在職中',
  介護福祉士: '2021/4/2',
  介護職員初任者研修: '2020/12/24',
});
const JIRO = rowOf({
  社員番号: '102',
  職員名: '見本 次郎',
  入社年月日: '2025/3/1',
  退社年月日: '2025/4/30',
  職員Eメールアドレス: 'メール無し',
  在職状況: '退社済',
  ホームヘルパー2級: '取得日不明',
});
const SABURO = rowOf({
  社員番号: '103',
  職員名: '例 三郎',
  退社年月日: '2026/12/31',
  在職状況: '在職中',
  准看護師: '1993/6/17',
});
/** 職員名の無い行（書き出し元で名前を消した行） */
const NONAME = rowOf({ 入社年月日: '2026/1/1', 雇用形態: '常勤', 在職状況: '在職中', 介護福祉士: '2024/6/12' });
const table = [HEAD, ICHIKO, JIRO, SABURO, NONAME];
const TODAY = '2026-11-02';
const items = (): Item[] => base().items;
const rok = (r: RosterImportResult | ImportError): RosterImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};
const buf = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteLength + bytes.byteOffset) as ArrayBuffer;

describe('職員台帳の形の見分け', () => {
  it('職員名があり、台帳らしい列がもう1つ以上。名簿の形（名前）・顧客台帳は違う', () => {
    expect(isStaffLedgerHeader(HEAD)).toBe(true);
    expect(isStaffLedgerHeader(['職員名', '在職状況'])).toBe(true);
    expect(isStaffLedgerHeader(['職員名'])).toBe(false);
    expect(isStaffLedgerHeader(['名前', '職員名', '在職状況'])).toBe(false);
    expect(isStaffLedgerHeader(['利用者名', '利用者カナ', '町名以下'])).toBe(false);
  });
  it('〈スタッフ〉の名簿でだけ、この形で読む', () => {
    expect(readRosterForm(table, 'staff', { today: TODAY, items: items() })?.form.id).toBe('staff-ledger');
    expect(readRosterForm(table, 'client', { today: TODAY, items: items() })).toBeNull();
  });
});

/** 職員台帳の資格・研修の列（社会福祉主事などを含む40列。HEAD の17列目から） */
const QUAL_HEAD = HEAD.slice(16);

describe('資格・研修の列', () => {
  it('初期の項目「資格」「研修」の選択肢は、職員台帳の資格・研修の列をすべて網羅する（介護職員初任者研修は「初任者研修」）', () => {
    const cols = qualificationCols(HEAD, items());
    const read = new Set(cols.flatMap((c) => c.sources));
    expect(QUAL_HEAD).toHaveLength(40);
    expect(QUAL_HEAD.filter((h) => !read.has(h))).toEqual([]);
    expect(cols.filter((c) => c.header.startsWith('特性：資格：'))).toHaveLength(27);
    expect(cols.filter((c) => c.header.startsWith('特性：研修：'))).toHaveLength(14);
    expect(cols.find((c) => c.header === '特性：資格：初任者研修')?.sources).toEqual([
      '介護職員初任者研修',
      '居宅介護職員初任者研修課程',
      '介護福祉士実務者研修',
      '介護職員基礎研修',
      'ホームヘルパー1級',
      'ホームヘルパー2級',
    ]);
    // 台帳に列の無い選択肢も出す（名簿の読み込みは選択肢の列をすべて求める）。セルは空
    expect(cols.filter((c) => c.sources.length === 0).map((c) => c.header)).toEqual(['特性：資格：保育士']);
  });
  it('台帳に合う列の無い項目（得意など）・項目が無いときは写さない', () => {
    expect(qualificationCols(HEAD, items()).some((c) => c.header.startsWith('特性：得意：'))).toBe(false);
    expect(qualificationCols(HEAD, [])).toEqual([]);
  });
});

describe('職員台帳 → 名簿の列', () => {
  const t = staffLedgerToRoster(table, TODAY, items());
  if (!t) throw new Error('職員台帳として見分けなかった');
  const at = (row: number, h: string) => t.rows[row]?.[t.rows[0]?.indexOf(h) ?? -1];

  it('名前・メール・住所・利用中・最終勤務日', () => {
    expect(t.rows[0]?.slice(0, 5)).toEqual(['名前', 'メールアドレス', '住所', '利用中', '最終勤務日']);
    expect(t.rows[1]?.slice(0, 5)).toEqual([
      '架空 一子',
      'ichiko@example.com',
      '架空県架空市架空町1-2-3サンプル荘101',
      '○',
      '',
    ]);
    expect(t.rows[2]?.slice(0, 5)).toEqual(['見本 次郎', '', '', '×', '2025-04-30']);
    // 退社年月日が先なら、それまでは利用中
    expect(t.rows[3]?.slice(0, 5)).toEqual(['例 三郎', '', '', '○', '2026-12-31']);
  });
  it('資格・研修：値（取得日・取得日不明）があれば ○。准看護師は看護師と分ける', () => {
    expect(at(1, '特性：資格：介護福祉士')).toBe('○');
    expect(at(1, '特性：資格：初任者研修')).toBe('○');
    expect(at(1, '特性：資格：看護師')).toBe('×');
    expect(at(1, '特性：研修：ホームヘルパー2級')).toBe('×');
    expect(at(2, '特性：資格：初任者研修')).toBe('○');
    expect(at(2, '特性：研修：ホームヘルパー2級')).toBe('○');
    expect(at(3, '特性：資格：看護師')).toBe('×');
    expect(at(3, '特性：資格：准看護師')).toBe('○');
    expect(at(1, '特性：資格：保育士')).toBe('');
  });
  it('職員名の無い行は空行にする', () => {
    expect(t.rows[4]?.every((c) => c === '')).toBe(true);
    expect(t.rows).toHaveLength(5);
  });
  it('読まなかった列：所属・カナ・入社年月日・郵便番号・電話・雇用形態と、形の違うメール・名前の無い行の件数', () => {
    expect(t.skipped).toEqual([
      '所属',
      '職員カナ',
      '入社年月日',
      '郵便番号',
      '職員電話番号',
      '職員携帯電話番号',
      '雇用形態',
      '職員Eメールアドレス（形の違う値 1件）',
      '職員名（空の行 1件）',
    ]);
  });
  it('同じ職員名の人は全員「職員名（社員番号）」', () => {
    const twin = rowOf({ 社員番号: '201', 職員名: '架空 一子' });
    const r = staffLedgerToRoster([HEAD, ICHIKO, twin], TODAY, items());
    expect(r?.rows.slice(1).map((x) => x[0])).toEqual(['架空 一子（101）', '架空 一子（201）']);
  });
});

describe('職員台帳を〈スタッフ〉の名簿として読み込む', () => {
  it('Shift_JIS の CSV を読み、足した人に資格・休止・最終勤務日が入る', async () => {
    const sjis = legacyEncoder('shift_jis')(toCsv(table));
    const r = rok(await importRoster(buf(sjis), base(), 'staff', 'merge', TODAY));
    expect(r.source).toEqual({ format: 'csv', encoding: 'Shift_JIS' });
    expect(r.otherForm?.label).toBe('職員台帳');
    expect(r.added).toEqual(['架空 一子', '見本 次郎（休止）', '例 三郎']);
    const ichiko = r.data.staff.find((s) => s.name === '架空 一子');
    const qual = r.data.items.find((it) => it.name === '資格');
    expect(ichiko?.email).toBe('ichiko@example.com');
    expect(ichiko?.home.address).toBe('架空県架空市架空町1-2-3サンプル荘101');
    const training = r.data.items.find((it) => it.name === '研修');
    expect(qual && ichiko?.traits[qual.id]).toEqual(['介護福祉士', '初任者研修']);
    expect(training && ichiko?.traits[training.id]).toEqual([]);
    const jiro = r.data.staff.find((s) => s.name === '見本 次郎');
    expect(qual && jiro?.traits[qual.id]).toEqual(['初任者研修']);
    expect(training && jiro?.traits[training.id]).toEqual(['ホームヘルパー2級']);
    expect(r.data.staff.find((s) => s.name === '見本 次郎')).toMatchObject({ active: false, lastDay: '2025-04-30' });
  });
  it('読み直すと同じ人に当てる（名前で）。空の住所・メールは今の値のまま', async () => {
    const first = rok(
      await importRoster(buf(legacyEncoder('shift_jis')(toCsv(table))), base(), 'staff', 'merge', TODAY),
    );
    const again = rok(
      await importRoster(buf(legacyEncoder('shift_jis')(toCsv(table))), first.data, 'staff', 'merge', TODAY),
    );
    expect(again.added).toEqual([]);
    expect(again.updated).toEqual([]);
  });
});
