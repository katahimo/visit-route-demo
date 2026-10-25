// 日の予定の表示のための純粋関数：lib/planView
import { describe, expect, it } from 'vitest';
import type { Absence } from '../contracts/documents';
import type { ContactVisit } from '../contracts/reassign';
import { NONE } from '../domain/scheduleModel';
import { compile } from '../matching';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures';
import { hardLabelsOf, planColumns, toldMarksOf } from './planView';

describe('planColumns（列に出す人）', () => {
  const data = makeData({
    staff: [staff('s1', 38.26, 140.87), staff('s2', 38.262, 140.872), staff('s3', 38.262, 140.872)],
    clients: [client('c1', 38.261, 140.871)],
    visits: [visit('v1', 'c1', '09:00', '09:00')],
  });
  const p = compile(data, DATE);
  const off = { ...p, staff: p.staff.map((s) => (s.id === 's2' ? { ...s, slots: [] } : s)) };
  const absence: Absence = { id: 'a1', staffId: 's2', date: DATE, from: null, to: null, note: '' };
  it('働く人を名前の順に。働かない人は出さない', () => {
    expect(planColumns(off, {}, ['s3', 's2', 's1'], new Map())).toEqual(['s3', 's1']);
  });
  it('欠勤で稼働時間帯が無くなった人（もともと働く日）は出す', () => {
    const slots = new Map([['s2', { absence, baseSlots: [{ start: '09:00', end: '17:00' }] }]]);
    expect(planColumns(off, {}, ['s1', 's2', 's3'], slots)).toEqual(['s1', 's2', 's3']);
    const noBase = new Map([['s2', { absence, baseSlots: [] }]]);
    expect(planColumns(off, {}, ['s1', 's2', 's3'], noBase)).toEqual(['s1', 's3']);
  });
  it('訪問の担当の人は働かなくても出し、名前の並びにいない担当は後ろに（担当なしの印は除く）', () => {
    expect(planColumns(off, { s2: ['v1'], zz: ['v2'], [NONE]: ['v3'], s3: [] }, ['s1', 's2', 's3'], new Map())).toEqual(
      ['s1', 's2', 's3', 'zz'],
    );
    expect(planColumns(null, { s2: ['v1'] }, ['s1', 's2'], new Map())).toEqual(['s2']);
  });
});

describe('hardLabelsOf（要対応の印）', () => {
  it('担当なしを除いた文の一覧。無い訪問は入れない', () => {
    const issues = new Map([
      [
        'v1',
        [
          { kind: 'unassigned' as const, label: '担当なし' },
          { kind: 'late' as const, label: '間に合わない' },
        ],
      ],
      ['v2', [{ kind: 'unassigned' as const, label: '担当なし' }]],
    ]);
    expect([...hardLabelsOf(issues)]).toEqual([['v1', ['間に合わない']]]);
  });
});

describe('toldMarksOf（未連絡の変更の印）', () => {
  const cv = (visitId: string, over: Partial<ContactVisit> = {}): ContactVisit => ({
    visitId,
    clientId: 'c1',
    fromStaffId: 's1',
    toStaffId: 's2',
    fromStart: 540,
    toStart: 570,
    ...over,
  });
  it('担当の変化・時刻の変化の文（担当なしは「なし」）', () => {
    const got = toldMarksOf(
      { staffChanged: [cv('v1'), cv('v2', { toStaffId: null })], timeChanged: [cv('v3')], staff: [] },
      (id) => `名${id}`,
    );
    expect([...got]).toEqual([
      ['v1', '担当 名s1→名s2'],
      ['v2', '担当 名s1→なし'],
      ['v3', '時刻 9:00→9:30'],
    ]);
    expect(toldMarksOf(null, (id) => id).size).toBe(0);
  });
});
