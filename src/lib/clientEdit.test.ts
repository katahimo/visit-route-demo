import { describe, expect, it } from 'vitest';
import type { Pattern } from '../contracts/documents';
import { client, DATE, makeData, staff } from '../matching/fixtures';
import {
  CLIENT_SECTION_TAB,
  CLIENT_SECTIONS,
  clientSaveDraft,
  clientSectionDirty,
  limitOfClient,
  newClientEdit,
  openClientEdit,
  saveClientData,
} from './clientEdit';

const terms = { client: '利用者', staff: 'スタッフ' };
const s1 = staff('s1', 35, 139);
const s2 = staff('s2', 35, 139, { active: false });
const people = [s1, s2];

describe('節と保存する項目', () => {
  it('どの節もタブを持つ', () => {
    for (const k of Object.keys(CLIENT_SECTIONS))
      expect(CLIENT_SECTION_TAB[k as keyof typeof CLIENT_SECTIONS]).toBeTruthy();
  });
});

describe('limitOfClient・openClientEdit', () => {
  it('利用中の人が入っていれば限る（休止中の人だけなら限らない）', () => {
    expect(limitOfClient(client('c1', 35, 139, { allowedStaffIds: ['s1'] }), people)).toBe(true);
    expect(limitOfClient(client('c1', 35, 139, { allowedStaffIds: ['s2'] }), people)).toBe(false);
  });
  it('保存した中身の写しで開く', () => {
    const c = client('c1', 35, 139, { allowedStaffIds: ['s1'] });
    const e = openClientEdit('basic', c, people);
    expect(e).toMatchObject({ key: 'basic', limit: true, openedLimit: true });
    expect(e.form).toEqual(c);
    expect(e.form).not.toBe(c);
    expect(e.opened).not.toBe(e.form);
  });
});

describe('clientSectionDirty', () => {
  const saved = client('c1', 35, 139, { allowedStaffIds: ['s2'] });
  it('節の項目だけを比べる', () => {
    const e = openClientEdit('basic', saved, people);
    expect(clientSectionDirty(e, saved, people)).toBe(false);
    expect(clientSectionDirty({ ...e, form: { ...e.form, note: 'x' } }, saved, people)).toBe(true);
    // ほかの節の項目は見ない
    expect(clientSectionDirty({ ...e, form: { ...e.form, keyNote: 'x' } }, saved, people)).toBe(false);
  });
  it('担当は保存のときと同じ値にそろえて比べる（休止中の人は数えない）', () => {
    const e = openClientEdit('staffing', saved, people);
    expect(clientSectionDirty(e, saved, people)).toBe(false);
    expect(clientSectionDirty({ ...e, limit: true, form: { ...e.form, allowedStaffIds: ['s1'] } }, saved, people)).toBe(
      true,
    );
  });
  it('直していなければ変更なし・保存した人がいなければ変更あり・新しい人は開いたときと比べる', () => {
    expect(clientSectionDirty(null, saved, people)).toBe(false);
    expect(clientSectionDirty(openClientEdit('basic', saved, people), undefined, people)).toBe(true);
    const n = newClientEdit(client('c9', 35, 139));
    expect(clientSectionDirty(n, undefined, people)).toBe(false);
    expect(clientSectionDirty({ ...n, form: { ...n.form, displayName: '山田' } }, undefined, people)).toBe(true);
  });
});

describe('clientSaveDraft', () => {
  const saved = client('c1', 35, 139, { displayName: '山田', note: '前' });
  const draftOf = (e: ReturnType<typeof openClientEdit>, clients = [saved]) =>
    clientSaveDraft({ edit: e, saved, staff: people, allowedOn: true, clients, terms });
  it('節の項目だけを保存した中身に重ねる', () => {
    const e = openClientEdit('basic', saved, people);
    const r = draftOf({ ...e, form: { ...e.form, note: '後', keyNote: '古い入力' } });
    expect(r.ok && r.draft.note).toBe('後');
    expect(r.ok && r.draft.keyNote).toBe('');
  });
  it('担当を限るのに利用中の人がいなければ誤り。限るなら休止中の人を外す', () => {
    const e = openClientEdit('staffing', saved, people);
    expect(draftOf({ ...e, limit: true, form: { ...e.form, allowedStaffIds: ['s2'] } })).toEqual({
      ok: false,
      error: { text: '担当できるスタッフを1人以上選ぶか、「担当できる人を限る」を外してください' },
    });
    const r = draftOf({ ...e, limit: true, form: { ...e.form, allowedStaffIds: ['s1', 's2'] } });
    expect(r.ok && r.draft.allowedStaffIds).toEqual(['s1']);
    const off = draftOf({ ...e, limit: false, form: { ...e.form, allowedStaffIds: ['s1'] } });
    expect(off.ok && off.draft.allowedStaffIds).toEqual([]);
  });
  it('郵便番号は7桁に直し、直せなければ誤り', () => {
    const e = openClientEdit('place', saved, people);
    const ok = draftOf({ ...e, form: { ...e.form, place: { ...e.form.place, postalCode: '123-4567' } } });
    expect(ok.ok && ok.draft.place.postalCode).toBe('1234567');
    const bad = draftOf({ ...e, form: { ...e.form, place: { ...e.form.place, postalCode: '12' } } });
    expect(bad.ok).toBe(false);
  });
  it('紹介元のメールの形が違えば誤り（field は referrer）', () => {
    const e = openClientEdit('stage', saved, people);
    const r = draftOf({ ...e, form: { ...e.form, referrer: { ...e.form.referrer, email: 'abc' } } });
    expect(!r.ok && r.error.field).toBe('referrer');
  });
  it('同じ名前は誤り（名前を直している節だけ）', () => {
    const other = client('c2', 35, 139, { displayName: '佐藤' });
    const e = openClientEdit('basic', saved, people);
    const r = draftOf({ ...e, form: { ...e.form, displayName: '佐藤' } }, [saved, other]);
    expect(!r.ok && r.error).toEqual({
      text: '「佐藤」と同じ名前の利用者がいます。名前を変えてください',
      field: 'displayName',
    });
  });
});

describe('saveClientData', () => {
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
    from: '2026-01-05',
    to: null,
    usualStaffId: null,
    note: '',
  };
  it('いなければ足し、いれば置き換える', () => {
    const d = makeData({ clients: [client('c1', 35, 139)] });
    const c2 = client('c2', 35, 139);
    expect(saveClientData(d, c2, false, DATE).clients.map((c) => c.id)).toEqual(['c1', 'c2']);
    const c1 = client('c1', 35, 139, { note: '新' });
    expect(saveClientData(d, c1, false, DATE).clients[0]!.note).toBe('新');
  });
  it('終了にしたら続いている繰り返しを昨日で終わらせる', () => {
    const d = makeData({ clients: [client('c1', 35, 139)], patterns: [p] });
    const out = saveClientData(d, client('c1', 35, 139, { stage: 'ended', active: false }), true, DATE);
    expect(out.patterns[0]!.to).toBe('2026-10-11');
    expect(saveClientData(d, client('c1', 35, 139), false, DATE).patterns[0]!.to).toBeNull();
  });
});
