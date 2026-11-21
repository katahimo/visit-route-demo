// 同行（2人体制・研修同行。PRD D473〜D477。ADR-0120）：コピーで足す・確かめ・一言
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import { companionsOf } from '../domain/companion';
import { client, DATE, makeData, staff } from '../matching/fixtures.testkit';
import { findVisit, putVisits } from '../patterns';
import { accompanyOf, companionError, companionText, companionTexts, copyRequest } from './companion';
import { draftOf } from './visitDraft';
import { applyVisitEdit } from './visitOps';

const IDS = { visit: 'vnew', patterns: ['np1', 'np2'] as const };

/** 月曜 9:00 の繰り返し（担当 s1）と3人の〈スタッフ〉。c1 は担当を s1・s2 に限る */
function data(): DemoData {
  const p: Pattern = {
    id: 'p1',
    clientId: 'c1',
    typeId: null,
    weekdays: [1],
    everyWeeks: 1,
    repeat: 'weekly',
    monthWeeks: [],
    dayTimes: [],
    windowKind: 'fixed',
    earliestStart: '09:00',
    latestStart: '09:00',
    durationMinutes: 60,
    from: DATE,
    to: null,
    usualStaffId: null,
    note: '',
  };
  const d = makeData({
    staff: [staff('s1', 38.26, 140.87), staff('s2', 38.27, 140.86), staff('s3', 38.27, 140.87)],
    clients: [client('c1', 38.27, 140.88, { allowedStaffIds: ['s1', 's2'] })],
    patterns: [p],
  });
  const v = findVisit(d, `${DATE}_p1`)!;
  return { ...d, visits: putVisits(d.visits, [{ ...v, staffId: 's1', pinned: true }]) };
}

const base = (d: DemoData) => findVisit(d, `${DATE}_p1`)!;

describe('コピーで同行を足す（applyVisitEdit の新しい訪問）', () => {
  it('2人体制：同じ日時の単発の訪問を足し、選んだ人にピンで入れる。元の訪問と組になる', () => {
    const d = data();
    const draft = { ...draftOf(base(d)), accompany: 'pair' as const };
    const r = applyVisitEdit(d, { visitId: null, draft, staff: 's2', scope: 'once' }, DATE, IDS);
    if (!r.ok) throw new Error(r.error);
    const nv = findVisit(r.data, 'vnew')!;
    expect(nv).toMatchObject({ accompany: 'pair', staffId: 's2', pinned: true, pattern: null, earliestStart: '09:00' });
    expect(companionsOf([base(r.data), nv]).get('vnew')?.partners).toEqual([`${DATE}_p1`]);
  });
  it('2人体制は担当を選ばなくてもよい（AI が選ぶ）', () => {
    const d = data();
    const draft = { ...draftOf(base(d)), accompany: 'pair' as const };
    const r = applyVisitEdit(d, { visitId: null, draft, scope: 'once' }, DATE, IDS);
    expect(r.ok && findVisit(r.data, 'vnew')?.staffId).toBe(null);
  });
  it('研修同行は人を選ぶ。担当を限っていても選べる（人の条件を見ない）', () => {
    const d = data();
    const draft = { ...draftOf(base(d)), accompany: 'trainee' as const };
    const none = applyVisitEdit(d, { visitId: null, draft, scope: 'once' }, DATE, IDS);
    expect(none).toMatchObject({ ok: false, error: '研修同行は、同行するヘルパーを選んでください' });
    const r = applyVisitEdit(d, { visitId: null, draft, staff: 's3', scope: 'once' }, DATE, IDS);
    if (!r.ok) throw new Error(r.error);
    expect(findVisit(r.data, 'vnew')).toMatchObject({ accompany: 'trainee', staffId: 's3' });
  });
  it('同行は元の訪問と同じ開始でないと足さない。ふつうのコピーは別の時刻にできる', () => {
    const d = data();
    const moved = { ...draftOf(base(d)), earliestStart: '13:00', latestStart: '13:00' };
    const bad = applyVisitEdit(d, { visitId: null, draft: { ...moved, accompany: 'pair' }, scope: 'once' }, DATE, IDS);
    expect(bad).toMatchObject({ ok: false, field: 'earliestStart' });
    const ok = applyVisitEdit(d, { visitId: null, draft: moved, scope: 'once' }, DATE, IDS);
    expect(ok.ok && findVisit(ok.data, 'vnew')?.accompany).toBeUndefined();
  });
  it('同行の訪問のメモを直しても同行は残る', () => {
    const d = data();
    const draft = { ...draftOf(base(d)), accompany: 'pair' as const };
    const r = applyVisitEdit(d, { visitId: null, draft, staff: 's2', scope: 'once' }, DATE, IDS);
    if (!r.ok) throw new Error(r.error);
    const nv = findVisit(r.data, 'vnew')!;
    const e = applyVisitEdit(
      r.data,
      { visitId: 'vnew', draft: { ...draftOf(nv), note: 'x' }, scope: 'once' },
      DATE,
      IDS,
    );
    expect(e.ok && findVisit(e.data, 'vnew')).toMatchObject({ accompany: 'pair', note: 'x' });
  });
});

describe('copyRequest', () => {
  it('元の訪問の中身で新しい訪問の欄を開く。日付は今日より前なら今日、同行は持ち越さない', () => {
    const d = data();
    const v = { ...base(d), accompany: 'pair' as const, note: 'メモ' };
    const r = copyRequest(v, DATE);
    expect(r).toMatchObject({ copyOf: v.id, newVisit: { date: DATE, clientId: 'c1', start: '09:00' } });
    expect(r.draft).toMatchObject({ date: DATE, note: 'メモ', durationMinutes: 60 });
    expect(r.draft.accompany).toBeUndefined();
    expect(copyRequest(v, '2026-10-20').draft.date).toBe('2026-10-20');
  });
});

describe('文', () => {
  it('accompanyOf・companionError', () => {
    expect([accompanyOf('pair'), accompanyOf('trainee'), accompanyOf('')]).toEqual(['pair', 'trainee', undefined]);
    const d = data();
    expect(companionError(d, { ...base(d), accompany: undefined }, undefined)).toBeNull();
  });
  it('2人体制は「佐藤さんと」、研修同行は元の訪問が「〜さんが同行」・研修の人が「〜さんに同行」', () => {
    expect(companionText({ role: 'group', kind: 'pair', partners: ['b'] }, ['佐藤'])).toBe('2人体制（佐藤さんと）');
    expect(companionText({ role: 'group', kind: 'pair', partners: ['b'] }, [null])).toBe('2人体制（担当なしと）');
    expect(companionText({ role: 'group', kind: 'trainee', partners: ['t'] }, ['新井'])).toBe(
      '研修同行（新井さんが同行）',
    );
    expect(companionText({ role: 'trainee', kind: 'trainee', partners: ['a'] }, ['小幡'])).toBe(
      '研修同行（小幡さんに同行）',
    );
  });
  it('companionTexts：組の訪問だけ、担当の名前で', () => {
    const v = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      date: DATE,
      clientId: 'c1',
      earliestStart: '09:00',
      cancelled: false,
      ...over,
    });
    const staffOf: Record<string, string | null> = { a: 's1', b: 's2', x: 's3' };
    const m = companionTexts(
      [v('a'), v('b', { accompany: 'pair' }), v('x', { clientId: 'c2' })],
      (id) => staffOf[id] ?? null,
      (s) => ({ s1: '小幡', s2: '佐藤' })[s] ?? s,
    );
    expect(m.get('a')).toEqual({ short: '2人', text: '2人体制（佐藤さんと）' });
    expect(m.get('b')?.text).toBe('2人体制（小幡さんと）');
    expect(m.has('x')).toBe(false);
  });
});
