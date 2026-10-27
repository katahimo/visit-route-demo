// 〈スタッフ〉の画面の節の編集と保存（PRD D299・D308〜D310。ADR-0014・ADR-0050）
import { describe, expect, it } from 'vitest';
import { client, makeData, staff } from '../matching/fixtures.testkit';
import {
  blankStaff,
  checkStaffFields,
  pauseTargets,
  STAFF_SECTIONS,
  savedStaffData,
  staffOverrides,
  withStaff,
} from './staffEdit';

const all = [staff('s1', 35, 139, { name: '山田 花' }), staff('s2', 35, 139, { name: '佐藤 一' })];
const ALL_KEYS = Object.keys(blankStaff()) as (keyof ReturnType<typeof blankStaff>)[];

describe('blankStaff（新しい人の既定）', () => {
  it('月〜金 9:00〜18:00・利用中・空の名前で、id は毎回新しい', () => {
    const a = blankStaff();
    expect(a).toMatchObject({
      name: '',
      workDays: [1, 2, 3, 4, 5],
      shiftStart: '09:00',
      shiftEnd: '18:00',
      active: true,
    });
    expect(a.id).toMatch(/^s-/);
    expect(blankStaff().id).not.toBe(a.id);
  });
});

describe('checkStaffFields（保存の前の検査）', () => {
  it('同じ名前の人がいれば名前の誤り（自分は除く）', () => {
    const base = { ...blankStaff(), name: ' 山田 花 ' };
    expect(checkStaffFields(all, base, ALL_KEYS, 'ヘルパー')).toEqual({
      ok: false,
      error: { text: '「山田 花」と同じ名前のヘルパーがいます。名前を変えてください', field: 'name' },
    });
    expect(checkStaffFields(all, { ...all[0] }, ALL_KEYS, 'ヘルパー').ok).toBe(true);
  });

  it('メールアドレスは整え、形でなければ誤り', () => {
    const r = checkStaffFields(all, { ...all[0], email: ' mailto:ａ@example.com ' }, STAFF_SECTIONS.basic, 'ヘルパー');
    expect(r).toEqual({ ok: true, email: 'a@example.com', icon: '' });
    const bad = checkStaffFields(all, { ...all[0], email: 'abc' }, STAFF_SECTIONS.basic, 'ヘルパー');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.field).toBe('email');
  });

  it('アイコンは前後の空白を落とし、長すぎれば誤り', () => {
    const r = checkStaffFields(all, { ...all[0], icon: ' 花 ' }, STAFF_SECTIONS.basic, 'ヘルパー');
    expect(r).toEqual({ ok: true, email: '', icon: '花' });
    const bad = checkStaffFields(all, { ...all[0], icon: '花花花' }, STAFF_SECTIONS.basic, 'ヘルパー');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.field).toBe('icon');
  });

  it('直している節の項目だけ検査する（ほかの節の古い値で止めない）', () => {
    const base = { ...all[0], name: '佐藤 一', email: 'abc', icon: '花花花' };
    expect(checkStaffFields(all, base, STAFF_SECTIONS.hours, 'ヘルパー')).toEqual({
      ok: true,
      email: 'abc',
      icon: '花花花',
    });
  });
});

describe('withStaff・savedStaffData（保存したデータ）', () => {
  it('同じ id は置き換え、無ければ最後に足す', () => {
    const s1 = { ...all[0], name: '山田 花子' };
    expect(withStaff(all, s1).map((x) => x.name)).toEqual(['山田 花子', '佐藤 一']);
    const s3 = staff('s3', 35, 139);
    expect(withStaff(all, s3).map((x) => x.id)).toEqual(['s1', 's2', 's3']);
  });

  it('休止なら〈利用者さん〉の「担当できる人」から外す。利用中なら〈利用者さん〉はそのまま', () => {
    const d = makeData({
      staff: all,
      clients: [client('c1', 35, 139, { allowedStaffIds: ['s1', 's2'] }), client('c2', 35, 139)],
    });
    const paused = savedStaffData(d, { ...all[0], active: false });
    expect(paused.staff[0].active).toBe(false);
    expect(paused.clients[0].allowedStaffIds).toEqual(['s2']);
    expect(paused.clients[1]).toBe(d.clients[1]);
    expect(savedStaffData(d, all[0]).clients).toBe(d.clients);
  });
});

describe('pauseTargets（休止で「担当できる人」から外す〈利用者さん〉）', () => {
  const d = makeData({
    staff: [...all, staff('s3', 35, 139, { active: false })],
    clients: [
      client('c1', 35, 139, { allowedStaffIds: ['s1', 's2'] }),
      client('c2', 35, 139, { allowedStaffIds: ['s1', 's3'] }),
      client('c3', 35, 139, { allowedStaffIds: ['s2'] }),
    ],
  });

  it('外す人と、利用中のほかの人が残らない人', () => {
    const r = pauseTargets(d, { ...all[0], active: false });
    expect(r.limited.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(r.emptied.map((c) => c.id)).toEqual(['c2']);
  });

  it('利用中なら空', () => {
    expect(pauseTargets(d, all[0])).toEqual({ limited: [], emptied: [] });
  });
});

describe('staffOverrides（日ごとに変えた勤務）', () => {
  it('その人の今日からを日付の順に', () => {
    const av = [
      { staffId: 's1', date: '2026-10-20', slots: [] },
      { staffId: 's2', date: '2026-10-15', slots: [] },
      { staffId: 's1', date: '2026-10-01', slots: [] },
      { staffId: 's1', date: '2026-10-12', slots: [] },
    ];
    expect(staffOverrides(av, 's1', '2026-10-12').map((a) => a.date)).toEqual(['2026-10-12', '2026-10-20']);
  });
});
