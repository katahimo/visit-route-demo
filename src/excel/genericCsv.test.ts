// 列名から読んだ名簿の形（暫定）：名前らしい列で見分ける・名簿の列に写す・読まない列を挙げる・既存の形とぶつからない。値は架空
import { describe, expect, it } from 'vitest';
import type { Item } from '../contracts/rules';
import { base } from './excel.testkit';
import { genericClientToRoster, genericStaffToRoster } from './genericCsv';
import { ROSTER_FORMS, readRosterForm } from './rosterForms';

const TODAY = '2026-06-01';
const items = (): Item[] => base().items;
const env = { today: TODAY, items: items() };
const isGenericHeader = (h: string[], kind: 'client' | 'staff') =>
  (kind === 'client' ? genericClientToRoster([h]) : genericStaffToRoster([h], TODAY, [])) !== null;
const idOf = (t: string[][], kind: 'client' | 'staff') => readRosterForm(t, kind, env)?.form.id ?? null;

describe('見分け', () => {
  it('名前らしい列があり、ほかの形でもアプリの名簿の形でもなければ当たる', () => {
    expect(
      idOf(
        [
          ['利用者氏名', 'カナ'],
          ['架空 一郎', 'カクウ'],
        ],
        'client',
      ),
    ).toBe('generic-client');
    expect(
      idOf(
        [
          ['職員氏名', '電話'],
          ['架空 花子', '000'],
        ],
        'staff',
      ),
    ).toBe('generic-staff');
    expect(idOf([['氏名'], ['架空 太郎']], 'client')).toBe('generic-client');
  });

  it('アプリの名簿の形・名前らしい列の無い表は読まない', () => {
    expect(isGenericHeader(['ID', '表示名', '住所'], 'client')).toBe(false);
    expect(isGenericHeader(['ID', '名前', '勤務する曜日'], 'staff')).toBe(false);
    expect(isGenericHeader(['住所', '電話'], 'client')).toBe(false);
    expect(
      idOf(
        [
          ['ID', '表示名'],
          ['1', '架空 一郎'],
        ],
        'client',
      ),
    ).toBeNull();
  });

  it('既存の形が先に当たる', () => {
    expect(
      idOf(
        [
          ['利用者名', '利用者カナ'],
          ['架空 一郎', 'カクウ'],
        ],
        'client',
      ),
    ).toBe('ledger');
    expect(
      idOf(
        [
          ['職員名', '職員カナ', '在職状況'],
          ['架空 花子', 'カクウ', ''],
        ],
        'staff',
      ),
    ).toBe('staff-ledger');
    expect(ROSTER_FORMS.slice(-2).map((f) => f.id)).toEqual(['generic-client', 'generic-staff']);
  });

  it('姓・名が別の列でも当たる', () => {
    expect(isGenericHeader(['姓', '名'], 'client')).toBe(true);
    expect(isGenericHeader(['苗字', '名前'], 'staff')).toBe(true);
  });
});

describe('〈利用者さん〉', () => {
  const table = [
    [
      'No',
      '氏名',
      'フリガナ',
      '〒',
      '都道府県',
      '市区町村',
      '町名以下',
      '建物名',
      '電話番号',
      '携帯',
      '生年月日',
      '緯度',
      '経度',
    ],
    [
      '',
      '架空 一郎',
      'カクウ イチロウ',
      '000-0001',
      '架空県',
      '架空市',
      '架空町1-2',
      'サンプル荘',
      '000-0000-0001',
      '090-0000-0002',
      '1940/1/1',
      '35.1',
      '139.2',
    ],
    ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '架空 二郎', '', '', '', '', '', '', '', '', '', '', ''],
  ];

  it('名簿の列に写し、読まなかった列を挙げる', () => {
    const r = genericClientToRoster(table);
    expect(r?.rows[0]).toEqual(['表示名', 'よみ', '郵便番号', '住所', '緯度', '経度', 'メモ', '段階']);
    expect(r?.rows[1]).toEqual([
      '架空 一郎',
      'かくう いちろう'.replace(' ', ''),
      '0000001',
      '架空県架空市架空町1-2サンプル荘',
      '35.1',
      '139.2',
      '電話 000-0000-0001　携帯 090-0000-0002',
      '利用中',
    ]);
    expect(r?.rows[2]).toEqual(['', '', '', '', '', '', '', '']);
    expect(r?.rows[3]?.[0]).toBe('架空 二郎');
    expect(r?.skipped).toEqual(['No', '生年月日']);
  });

  it('姓・名を「姓 名」でつなぎ、「住所」1列の先頭の郵便番号を分ける', () => {
    const r = genericClientToRoster([
      ['姓', '名', '住所', '緯度・経度'],
      ['架空', '三郎', '〒000-0002 架空県架空市1-1', '35.5, 139.5'],
    ]);
    expect(r?.rows[1]).toEqual(['架空 三郎', '', '0000002', '架空県架空市1-1', '35.5', '139.5', '', '利用中']);
  });

  it('同じ名前の人は ID の列で分ける', () => {
    const r = genericClientToRoster([
      ['利用者番号', '氏名'],
      ['A1', '架空 四郎'],
      ['A2', '架空 四郎'],
    ]);
    expect(r?.rows.slice(1).map((x) => x[0])).toEqual(['架空 四郎（A1）', '架空 四郎（A2）']);
  });
});

describe('〈スタッフ〉', () => {
  const head = ['職員氏名', 'カナ', 'メール', '住所', '電話', '性別', '退社年月日', '備考'];
  const table = [
    head,
    ['架空 花子', 'カクウ ハナコ', 'hana@example.com', '架空県架空市1-1', '000', '女', '', 'x'],
    ['架空 月子', '', 'bad-mail', '', '', '男性', '2026/3/31', ''],
  ];

  it('名簿の列に写し、退職日が過ぎた人は休止にする', () => {
    const r = genericStaffToRoster(table, TODAY, []);
    expect(r?.rows[0]).toEqual(['名前', 'メールアドレス', '住所', '緯度', '経度', '利用中', '最終勤務日']);
    expect(r?.rows[1]).toEqual(['架空 花子', 'hana@example.com', '架空県架空市1-1', '', '', '○', '']);
    expect(r?.rows[2]).toEqual(['架空 月子', '', '', '', '', '×', '2026-03-31']);
    expect(r?.skipped).toEqual(['カナ', '電話', '性別', '備考', 'メール（形の違う値 1件）']);
  });

  it('項目「性別」があれば特性の列に写す', () => {
    const r = genericStaffToRoster(table, TODAY, items());
    const col = r?.rows[0]?.indexOf('特性：性別') ?? -1;
    expect(col).toBeGreaterThan(0);
    expect(r?.rows.slice(1).map((x) => x[col])).toEqual(['女性', '男性']);
    expect(r?.skipped).not.toContain('性別');
  });
});
