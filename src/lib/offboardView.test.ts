// 退職・担当替えの一括振り直しの欄の文と並び（PRD D71。ADR-0015）
import { describe, expect, it } from 'vitest';
import { offboardCandidateText, offboardConfirmBody, offboardDays, offboardRolesText } from './offboardView';

describe('offboardRolesText', () => {
  it('繰り返しが2つ以上なら数を添える', () => {
    expect(offboardRolesText({ roles: ['pattern'], patternIds: ['p1'] })).toBe('繰り返しの担当');
    expect(offboardRolesText({ roles: ['pattern', 'allowed'], patternIds: ['p1', 'p2'] })).toBe(
      '繰り返しの担当（2つ）・担当できる人',
    );
    expect(offboardRolesText({ roles: ['allowed'], patternIds: [] })).toBe('担当できる人');
  });
});

describe('offboardCandidateText', () => {
  it('見本の訪問・入れる回の有無で文を変える', () => {
    const x = { staffId: 's2', fits: 3, load: 12 };
    expect(offboardCandidateText({ sample: 0 }, x)).toBe('（見本の訪問なし・4週の受け持ち 12回）');
    expect(offboardCandidateText({ sample: 4 }, { ...x, fits: 0 })).toBe('（入れる回なし・4週の受け持ち 12回）');
    expect(offboardCandidateText({ sample: 4 }, x)).toBe('（入れる 3/4回・4週の受け持ち 12回）');
  });
});

describe('offboardDays', () => {
  it('日ごとに件数と確定した件数をまとめる（出てきた順）', () => {
    expect(
      offboardDays([
        { date: '2026-10-14', confirmed: false },
        { date: '2026-10-13', confirmed: true },
        { date: '2026-10-14', confirmed: true },
      ]),
    ).toEqual([
      ['2026-10-14', { count: 2, confirmed: 1 }],
      ['2026-10-13', { count: 1, confirmed: 1 }],
    ]);
    expect(offboardDays([])).toEqual([]);
  });
});

describe('offboardConfirmBody', () => {
  const terms = { client: '利用者さん', staff: 'スタッフ' };

  it('だれにもしない・限らなくなる・分けた回が無ければその文を出さない', () => {
    expect(offboardConfirmBody({ count: 2, from: '2026-10-13', nobody: [], unlimited: [], renamed: 0, terms })).toBe(
      '2人の利用者さんの担当を、10/13から選んだスタッフに移します（それより前の日はそのまま）。10/13からの訪問の担当も選んだ人になります（入らない回は要対応に出ます）。',
    );
  });

  it('あれば名前・件数を入れる', () => {
    const body = offboardConfirmBody({
      count: 3,
      from: '2026-10-13',
      nobody: ['田中', '鈴木'],
      unlimited: ['田中'],
      renamed: 2,
      terms,
    });
    expect(body).toContain('田中・鈴木は「だれにもしない」なので、担当なしになります。');
    expect(body).toContain('田中は担当できる人がいなくなり、担当を限らなくなります（だれでも担当できます）。');
    expect(body).toContain(
      '繰り返しは10/13で分け、この回だけ変えた 2件は新しい繰り返しの回にします（時刻・メモはそのまま）。',
    );
  });
});
