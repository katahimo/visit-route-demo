import { describe, expect, it } from 'vitest';
import {
  addressCellText,
  addressLine,
  clientColumns,
  clientFolded,
  clientNameNote,
  clientPartOf,
  clientTabFor,
  clientTabKeys,
  compatHintLabel,
  detailColumnsShown,
  editInFold,
  hasDetailColumns,
  newClientHint,
  newClientLead,
  newClientShowsStage,
  peopleIntro,
  shiftText,
  showStageNote,
  splitFolded,
  staffColumns,
  staffFolded,
  staffNameNote,
  staffTabKeys,
  usualPlanText,
  workDaysText,
} from './peopleView';
import { CLIENT_TABS, STAFF_TABS } from './personPage';

describe('一覧の列', () => {
  it('3列：〈利用者さん〉＝名前・住所・いつもの予定、〈スタッフ〉＝名前・勤務日・勤務時間（入切とも始めの列）', () => {
    expect(clientColumns(false)).toEqual(['name', 'address', 'plan']);
    expect(staffColumns(false)).toEqual(['name', 'days', 'hours']);
  });
  it('くわしい列を出すと3列に専門の列（位置・特性・求めること・いつもの担当・状態／特性・求めること・自宅の位置・状態）が足される', () => {
    expect(clientColumns(true)).toEqual(['name', 'address', 'plan', 'place', 'traits', 'requires', 'usual', 'state']);
    expect(staffColumns(true)).toEqual(['name', 'days', 'hours', 'traits', 'requires', 'home', 'state']);
  });
  it('くわしい列を出せるのは入だけ。出すのは入で切り替えを入れているときだけ（切は切り替えを入れていても出さない）', () => {
    expect(hasDetailColumns(true)).toBe(true);
    expect(hasDetailColumns(false)).toBe(false);
    expect(detailColumnsShown(true, true)).toBe(true);
    expect(detailColumnsShown(true, false)).toBe(false);
    expect(detailColumnsShown(false, true)).toBe(false);
  });
});

describe('畳む欄', () => {
  it('切：〈利用者さん〉は段階・特性・決まりごと・担当を畳み、名前（基本）・住所は畳まない', () => {
    const f = clientFolded(true);
    expect(f).toEqual(['stage', 'traits', 'rules', 'staffing']);
    expect(f).not.toContain('basic');
    expect(f).not.toContain('place');
  });
  it('切：〈スタッフ〉は自宅・特性・求めること・最終勤務日・相性・日ごとの勤務を畳み、名前（基本）・ふだんの勤務は畳まない', () => {
    const f = staffFolded(true);
    expect(f).toEqual(['home', 'traits', 'conds', 'lastDay', 'compat', 'overrides']);
    expect(f).not.toContain('basic');
    expect(f).not.toContain('hours');
  });
  it('入は何も畳まない', () => {
    expect(clientFolded(false)).toEqual([]);
    expect(staffFolded(false)).toEqual([]);
  });
  it('splitFolded は並びを変えずに2つに分ける', () => {
    const parts = [
      { part: 'a', node: 1 },
      { part: 'b', node: 2 },
      { part: 'c', node: 3 },
    ];
    expect(splitFolded(parts, ['b'])).toEqual({ shown: [1, 3], folded: [2] });
    expect(splitFolded(parts, [])).toEqual({ shown: [1, 2, 3], folded: [] });
  });
});

describe('タブ', () => {
  it('切は担当・相性のタブを出さない。入はそのまま', () => {
    expect(clientTabKeys(CLIENT_TABS, true)).toEqual(['schedule', 'basic', 'leaves']);
    expect(staffTabKeys(STAFF_TABS, true)).toEqual(['schedule', 'basic', 'hours']);
    expect(clientTabKeys(CLIENT_TABS, false)).toEqual([...CLIENT_TABS]);
    expect(staffTabKeys(STAFF_TABS, false)).toEqual([...STAFF_TABS]);
  });
});

describe('短い文', () => {
  it('住所の1行：住所が無ければ郵便番号、どちらも無ければ空', () => {
    expect(addressLine({ address: '東京都千代田区1-1', postalCode: '1000001' })).toBe('東京都千代田区1-1');
    expect(addressLine({ address: '', postalCode: '1000001' })).toBe('〒100-0001');
    expect(addressLine({ address: '', postalCode: '' })).toBe('');
  });
  it('一覧の住所の列：入は〒郵便番号を添え、切は住所だけ（無ければ郵便番号）', () => {
    const both = { address: '東京都千代田区1-1', postalCode: '1000001' };
    expect(addressCellText(both, true)).toBe('〒100-0001 東京都千代田区1-1');
    expect(addressCellText(both, false)).toBe('東京都千代田区1-1');
    expect(addressCellText({ address: '', postalCode: '1000001' }, true)).toBe('〒100-0001');
    expect(addressCellText({ address: '東京都千代田区1-1', postalCode: '' }, true)).toBe('東京都千代田区1-1');
    expect(addressCellText({ address: '', postalCode: '1000001' }, false)).toBe('〒100-0001');
    expect(addressCellText({ address: '', postalCode: '' }, true)).toBe('');
  });
  it('勤務日は曜日の順、勤務時間は始〜終', () => {
    expect(workDaysText({ workDays: [5, 1, 3] })).toBe('月水金');
    expect(shiftText({ shiftStart: '9:00', shiftEnd: '17:00' })).toBe('9:00〜17:00');
  });
  it('状態の列が無い（3列）ときだけ、休止中・休み中を名前のそばに印。くわしい列は列に出すので二重にしない', () => {
    expect(staffNameNote({ active: true }, staffColumns(false))).toBe('');
    expect(staffNameNote({ active: false }, staffColumns(false))).toBe('休止中');
    expect(staffNameNote({ active: false }, staffColumns(true))).toBe('');
    expect(clientNameNote(true, clientColumns(false))).toBe('休み中');
    expect(clientNameNote(false, clientColumns(false))).toBe('');
    expect(clientNameNote(true, clientColumns(true))).toBe('');
  });
  it('切の説明・新しい人の言い方・節の欄・タブ', () => {
    expect(peopleIntro('clients')).toMatch(/名前・住所・いつもの予定/);
    expect(peopleIntro('staff')).toMatch(/名前・勤務日・勤務時間/);
    expect(showStageNote(false)).toBe(false);
    expect(showStageNote(true)).toBe(true);
    expect(newClientShowsStage(true)).toBe(false);
    expect(newClientLead(true, '利用者さん')).not.toMatch(/段階/);
    expect(newClientLead(false, '利用者さん')).toMatch(/段階/);
    expect(newClientHint(true)).not.toMatch(/特性|担当/);
    expect(clientPartOf('conds')).toBe('staffing');
    expect(clientPartOf('new')).toBeNull();
    expect(editInFold(clientFolded(true), 'conds')).toBe(true);
    expect(editInFold(clientFolded(true), 'place')).toBe(false);
    expect(editInFold(clientFolded(false), 'stage')).toBe(false);
    expect(clientTabFor('staffing', true)).toBe('basic');
    expect(clientTabFor('staffing', false)).toBe('staffing');
    expect(clientTabFor('schedule', true)).toBe('schedule');
  });
  const pat = (clientId: string, from: string, to: string | null, weekdays: number[], t: string) => ({
    clientId,
    from,
    to,
    weekdays,
    everyWeeks: 1,
    repeat: 'weekly' as const,
    monthWeeks: [],
    dayTimes: [],
    windowKind: 'fixed' as const,
    earliestStart: t,
    latestStart: t,
  });
  it('いつもの予定：その人の終わっていない繰り返しを始まりの順に。無ければ空', () => {
    const ps = [
      pat('c1', '2026-05-01', null, [1, 4], '10:00'),
      pat('c1', '2026-01-01', null, [3], '09:00'),
      pat('c1', '2025-01-01', '2025-12-31', [2], '08:00'),
      pat('c2', '2026-01-01', null, [5], '11:00'),
    ];
    expect(usualPlanText(ps, 'c1', '2026-10-30')).toBe('水 09:00、月・木 10:00');
    expect(usualPlanText(ps, 'c3', '2026-10-30')).toBe('');
  });
});

describe('相性の画面の説明', () => {
  it('切は説明を出さない（点・条件の重みを言わない）。入は「点のしくみ」', () => {
    expect(compatHintLabel(true)).toBeNull();
    expect(compatHintLabel(false)).toBe('点のしくみ');
  });
});
