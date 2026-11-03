// 〈利用者さん〉の移動時間（片道・分）と遠方（出張）の入れ方・読み方・文（PRD D429。ADR-0096）
import { describe, expect, it } from 'vitest';
import { clientPlaceSchema } from '../contracts/documents';
import { client, makeData } from '../matching/fixtures.testkit';
import { clientSaveDraft, newClientEdit, openClientEdit } from './clientEdit';
import { leaveHomeText, travelMinutesError, travelMinutesInput, travelNote, withTravel } from './clientTravel';
import { travelReasonOf } from './travelReasons';

const place = { address: '東京都', lat: 35.68, lng: 139.76, postalCode: '' };

describe('withTravel', () => {
  it('入れる・消す（無い・false は項目ごと消す）', () => {
    expect(withTravel(place, 180, true)).toEqual({ ...place, travelMinutes: 180, farTrip: true });
    const set = withTravel(place, 180, true);
    const cleared = withTravel(set, null, false);
    expect(cleared).toEqual(place);
    expect('travelMinutes' in cleared).toBe(false);
    expect('farTrip' in cleared).toBe(false);
  });
});

describe('契約（clientPlaceSchema）', () => {
  it('無い古いデータも読める。1〜720 の整数だけ', () => {
    expect(clientPlaceSchema.parse(place)).toEqual(place);
    expect(clientPlaceSchema.parse({ ...place, travelMinutes: 720, farTrip: true }).travelMinutes).toBe(720);
    expect(clientPlaceSchema.safeParse({ ...place, travelMinutes: 0 }).success).toBe(false);
    expect(clientPlaceSchema.safeParse({ ...place, travelMinutes: 721 }).success).toBe(false);
    expect(clientPlaceSchema.safeParse({ ...place, travelMinutes: 1.5 }).success).toBe(false);
  });
});

describe('travelMinutesInput・travelMinutesError', () => {
  it('空は null、全角も読む、数でなければ NaN', () => {
    expect(travelMinutesInput('  ')).toBeNull();
    expect(travelMinutesInput('１８０')).toBe(180);
    expect(travelMinutesInput('1.5')).toBe(1.5);
    expect(travelMinutesInput('三時間')).toBeNaN();
  });
  it('1〜720 の整数と無しはよい。ほかは文', () => {
    expect(travelMinutesError(undefined)).toBeNull();
    expect(travelMinutesError(1)).toBeNull();
    expect(travelMinutesError(720)).toBeNull();
    for (const n of [0, 721, 1.5, Number.NaN]) expect(travelMinutesError(n)).toContain('1〜720の整数');
  });
});

describe('travelNote・leaveHomeText', () => {
  it('短い文（無ければ空）', () => {
    expect(travelNote({})).toBe('');
    expect(travelNote({ travelMinutes: 180 })).toBe('移動 片道180分');
    expect(travelNote({ travelMinutes: 180, farTrip: true })).toBe('遠方（出張）・移動 片道180分');
    expect(travelNote({ farTrip: true })).toBe('遠方（出張）');
  });
  it('家を出る目安は遠方で移動時間があるときだけ（開始−移動。0時より前は前日）', () => {
    expect(leaveHomeText({ travelMinutes: 180, farTrip: true }, 10 * 60)).toBe('家を出る目安 7:00');
    expect(leaveHomeText({ travelMinutes: 180, farTrip: true }, 60)).toBe('家を出る目安 前日22:00');
    expect(leaveHomeText({ travelMinutes: 180 }, 600)).toBe('');
    expect(leaveHomeText({ farTrip: true }, 600)).toBe('');
    expect(leaveHomeText({ travelMinutes: 180, farTrip: true }, null)).toBe('');
  });
});

describe('〈利用者さん〉の場所の節の保存（clientSaveDraft）', () => {
  const terms = { client: '利用者さん', staff: 'ヘルパー' };
  it('移動時間が正しくなければ止める（欄は travelMinutes）。正しければ残す', () => {
    const c = client('c1', 38.2, 140.8);
    const d = makeData({ clients: [c] });
    const edit = openClientEdit('place', c, []);
    const bad = { ...edit, form: { ...edit.form, place: withTravel(edit.form.place, 0, true) } };
    const r = clientSaveDraft({ edit: bad, saved: c, staff: [], allowedOn: true, clients: d.clients, terms });
    expect(r).toMatchObject({ ok: false, error: { field: 'travelMinutes' } });
    const good = { ...edit, form: { ...edit.form, place: withTravel(edit.form.place, 180, true) } };
    const g = clientSaveDraft({ edit: good, saved: c, staff: [], allowedOn: true, clients: d.clients, terms });
    expect(g.ok && g.draft.place).toMatchObject({ travelMinutes: 180, farTrip: true });
    // 新しい人も同じ検査
    const n = newClientEdit({ ...c, id: 'c2', displayName: 'c2', place: withTravel(c.place, 9999, false) });
    expect(
      clientSaveDraft({ edit: n, saved: undefined, staff: [], allowedOn: true, clients: d.clients, terms }).ok,
    ).toBe(false);
  });
});

describe('移動・遠方の理由のキーと案内（lib/travelReasons）', () => {
  const terms = { client: '利用者さん', staff: 'ヘルパー' };
  it('ruleId か文の言葉で見分け、直し方の案内を返す', () => {
    expect(
      travelReasonOf({ ruleId: 'travelTooFar', label: 's1：移動が間に合わない（片道 約900分）' }, terms)?.key,
    ).toBe('travelTooFar');
    expect(travelReasonOf({ label: '遠方（出張）の日はほかの訪問を入れません' }, terms)?.key).toBe('farTrip');
    expect(travelReasonOf({ label: '休み' }, terms)).toBeNull();
    expect(travelReasonOf({ ruleId: 'travelTooFar', label: '' }, terms)?.hint).toContain('利用者さんの画面');
    expect(travelReasonOf({ ruleId: 'farTrip', label: '' }, terms)?.hint).toContain('ヘルパーにほかの訪問を入れません');
  });

  it('移動が間に合わない案内は、移動時間・遠方（出張）の入れ方で分ける', () => {
    const r = { ruleId: 'travelTooFar', label: '' };
    expect(travelReasonOf(r, terms)?.hint).toContain('距離から見積もった移動では');
    expect(travelReasonOf(r, terms, {})?.hint).toContain('距離から見積もった移動では');
    const manual = travelReasonOf(r, terms, { travelMinutes: 150 })?.hint ?? '';
    expect(manual).toContain('移動時間（片道 150分）では、勤務の開始に家を出ても間に合いません');
    expect(manual).toContain('ヘルパーの勤務の開始を早めるか');
    expect(manual).toContain('遠方（出張）に印を付けると、家を出る時刻を勤務の開始に縛りません');
    const far = travelReasonOf(r, terms, { travelMinutes: 150, farTrip: true })?.hint ?? '';
    expect(far).toContain('移動時間（片道 150分）を見ても');
    expect(far).not.toContain('遠方（出張）に印を付ける');
  });
});
