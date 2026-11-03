// 担当なしの訪問の組めない理由（PRD D430。ADR-0098）：型ごと・複合・遠方
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { compile } from '../matching';
import { client, DATE, makeData, rule, staff, visit } from '../matching/fixtures.testkit';
import { clientTravelHref, staffPageHref } from './hardLinks';
import { countKinds, reasonBreakdown, unassignedReasonOf, unassignedReasons } from './unassignedReason';

const SENDAI = { lat: 38.26, lng: 140.87 };
const NEAR = { lat: 38.27, lng: 140.88 };
const TOKYO = { lat: 35.68, lng: 139.76 };
/** 土曜 */
const SAT = '2026-10-17';
const T = { client: '利用者さん', staff: 'ヘルパー' };

const st = (id: string, over: Parameters<typeof staff>[3] = {}) => staff(id, SENDAI.lat, SENDAI.lng, over);
const near = (id = 'c1', over: Parameters<typeof client>[3] = {}) => client(id, NEAR.lat, NEAR.lng, over);

/** その日の問題で、routes（無ければ全員担当なし）の訪問 v1 の理由 */
function why(d: DemoData, routes: Record<string, string[]> = {}, date = DATE, id = 'v1') {
  const p = compile(d, date);
  const r = unassignedReasonOf(p, routes, id, T);
  if (!r) throw new Error('理由がない');
  return r;
}

describe('型ごとの理由・案内・リンク', () => {
  it('勤務日外：勤務する曜日に入っていない（土曜）。曜日を足す・その日だけの勤務を足す', () => {
    const d = makeData({
      staff: [st('s1'), st('s2')],
      clients: [near()],
      visits: [visit('v1', 'c1', '10:00', '10:00', { date: SAT })],
    });
    const r = why(d, {}, SAT);
    expect(r.kind).toBe('dayOff');
    expect(r.label).toBe('勤務日外');
    expect(r.summary).toBe('勤務日外 2人');
    expect(r.guide).toContain('土曜');
    expect(r.guide).toContain('勤務する曜日に土曜を足す');
    expect(r.links.map((l) => l.to)).toEqual(['/staff', '/availability']);
  });

  it('勤務日外：全員が勤務日外のときだけ「どの〈スタッフ〉の勤務日でもありません」と言い切る', () => {
    const d = makeData({
      staff: [st('s1'), st('s2')],
      clients: [near()],
      visits: [visit('v1', 'c1', '10:00', '10:00', { date: SAT })],
    });
    expect(why(d, {}, SAT).guide).toContain('土曜はどのヘルパーの勤務日でもありません');
  });

  it('勤務日外：その日に勤務する人がいれば、その人はほかの理由で入れないと言い、勤務日外の人の名前を添える', () => {
    const d = makeData({
      staff: [st('s1'), st('s2'), st('s3', { workDays: [6], shiftStart: '13:00', shiftEnd: '18:00' })],
      clients: [near()],
      visits: [visit('v1', 'c1', '10:00', '10:00', { date: SAT, windowKind: 'fixed' })],
    });
    const r = why(d, {}, SAT);
    expect(r.kind).toBe('dayOff');
    expect(r.summary).toBe('勤務日外 2人・勤務時間外 1人');
    expect(r.guide).not.toContain('どのヘルパーの勤務日でもありません');
    expect(r.guide).toContain('土曜に勤務するヘルパーは 1人いますが、ほかの理由で入れません');
    expect(r.guide).toContain('勤務日外のヘルパー（s1・s2）の勤務する曜日に土曜を足す');
  });

  it('勤務時間外：勤務 9:00〜18:00 に訪問 17:00〜20:00 は収まらない。終わりを 20:00 以降に', () => {
    const d = makeData({
      staff: [st('s1', { shiftStart: '09:00', shiftEnd: '18:00' })],
      clients: [near()],
      visits: [visit('v1', 'c1', '17:00', '17:00', { windowKind: 'fixed', durationMinutes: 180 })],
    });
    const r = why(d);
    expect(r.kind).toBe('hours');
    expect(r.summary).toBe('勤務時間外 1人');
    expect(r.guide).toContain('9:00〜18:00');
    expect(r.guide).toContain('17:00〜20:00');
    expect(r.guide).toContain('勤務の終わりを 20:00 以降に');
    // 1人なら、その人の画面
    expect(r.links[0]!.to).toBe(staffPageHref('s1'));
    expect(r.links[1]!.to).toBe('/availability');
  });

  it('勤務時間外：始まりが遅いときは始まりを早める案内', () => {
    const d = makeData({
      staff: [st('s1', { shiftStart: '10:00', shiftEnd: '18:00' })],
      clients: [near()],
      visits: [visit('v1', 'c1', '07:00', '07:00', { windowKind: 'fixed' })],
    });
    expect(why(d).guide).toContain('勤務の始まりを 7:00 以前に');
  });

  it('欠勤：入れる人が欠勤（終日）', () => {
    const d = makeData({
      staff: [st('s1')],
      clients: [near()],
      visits: [visit('v1', 'c1', '10:00', '10:00')],
      absences: [{ id: 'a1', staffId: 's1', date: DATE, from: null, to: null, note: '' }],
    });
    const r = why(d);
    expect(r.kind).toBe('absent');
    expect(r.guide).toContain('s1');
    expect(r.links.map((l) => l.to)).toEqual(['/availability']);
  });

  it('最終勤務日の後', () => {
    const d = makeData({
      staff: [st('s1', { lastDay: '2026-10-01' })],
      clients: [near()],
      visits: [visit('v1', 'c1', '10:00', '10:00')],
    });
    const r = why(d);
    expect(r.kind).toBe('afterLast');
    expect(r.links[0]!.to).toBe(staffPageHref('s1'));
  });

  it('利用中の〈スタッフ〉がいない（全員休止）', () => {
    const d = makeData({
      staff: [st('s1', { active: false })],
      clients: [near()],
      visits: [visit('v1', 'c1', '10:00', '10:00')],
    });
    const r = why(d);
    expect(r.kind).toBe('noStaff');
    expect(r.summary).toBe('働ける人がいない');
    expect(r.links[0]!.to).toBe('/staff');
  });

  it('担当できる人の限定：限った人が欠勤で、ほかの人は限定で外れる（多いほう）', () => {
    const d = makeData({
      staff: [st('s1'), st('s2'), st('s3')],
      clients: [near('c1', { allowedStaffIds: ['s1'] })],
      visits: [visit('v1', 'c1', '10:00', '10:00')],
      absences: [{ id: 'a1', staffId: 's1', date: DATE, from: null, to: null, note: '' }],
    });
    const r = why(d);
    expect(r.kind).toBe('allowedStaff');
    expect(r.summary).toBe('担当できる人の限定 2人・欠勤 1人');
    expect(r.guide).toContain('（s1）');
    expect(r.links[0]!.to).toBe('/clients/c1?edit=staffing');
  });

  it('必須の条件：資格に合う人がいない。〈利用者さん〉の条件・〈スタッフ〉の項目へ', () => {
    const d = makeData({
      staff: [st('s1', { traits: { license: ['なし'] } }), st('s2', { traits: { license: ['なし'] } })],
      clients: [near('c1', { requirements: [{ itemId: 'license', op: 'hasAny', value: ['看護師'] }] })],
      rules: [rule('req', 'clientRequirement', 0, true)],
      visits: [visit('v1', 'c1', '10:00', '10:00')],
    });
    const r = why(d);
    expect(r.kind).toBe('requirement');
    expect(r.summary).toBe('必須の条件 2人');
    expect(r.guide).toMatch(/必須の条件（必要条件：資格.*看護師.*）に合うヘルパーがいません/);
    expect(r.links.map((l) => l.to)).toEqual(['/clients/c1?edit=conds', '/staff']);
  });

  it('必須の条件のある人が、さらに勤務日外でも、人の型は必須の条件（直しても入れない型を先に）', () => {
    const d = makeData({
      staff: [st('s1', { traits: { license: ['なし'] } })],
      clients: [near('c1', { requirements: [{ itemId: 'license', op: 'hasAny', value: ['看護師'] }] })],
      rules: [rule('req', 'clientRequirement', 0, true)],
      visits: [visit('v1', 'c1', '10:00', '10:00', { date: SAT })],
    });
    expect(why(d, {}, SAT).summary).toBe('必須の条件 1人');
  });

  it('相性×', () => {
    const d = makeData({
      staff: [st('s1')],
      clients: [near()],
      compat: { c1: { s1: -2 } },
      visits: [visit('v1', 'c1', '10:00', '10:00')],
    });
    const r = why(d);
    expect(r.kind).toBe('compat');
    expect(r.links[0]!.to).toBe('/compat');
  });

  it('重なり：入れる人はその時間に別の訪問が入っている', () => {
    const d = makeData({
      staff: [st('s1')],
      clients: [near('c1'), near('c2')],
      visits: [visit('v1', 'c1', '10:00', '10:00'), visit('v2', 'c2', '10:00', '10:00')],
    });
    const r = why(d, { s1: ['v2'] });
    expect(r.kind).toBe('overlap');
    expect(r.summary).toBe('重なり 1人');
    expect(r.guide).toContain('時間をずらす');
  });

  it('入れられる人がいれば、ほかの型より先に「入れられる人あり」', () => {
    const d = makeData({
      staff: [st('s1'), st('s2', { workDays: [6] })],
      clients: [near()],
      visits: [visit('v1', 'c1', '10:00', '10:00')],
    });
    const r = why(d);
    expect(r.kind).toBe('placeable');
    expect(r.summary).toBe('入れられる人あり 1人・勤務日外 1人');
    expect(r.guide).toContain('担当を替える');
  });

  it('時間の約束の幅が正しくない（訪問そのもの）', () => {
    const d = makeData({
      staff: [st('s1')],
      clients: [near()],
      visits: [visit('v1', 'c1', '12:00', '10:00')],
    });
    expect(why(d).kind).toBe('badWindow');
  });

  it('列に入っている訪問は理由を出さない', () => {
    const d = makeData({ staff: [st('s1')], clients: [near()], visits: [visit('v1', 'c1', '10:00', '10:00')] });
    expect(unassignedReasonOf(compile(d, DATE), { s1: ['v1'] }, 'v1', T)).toBeNull();
  });
});

describe('遠方・位置なし（ADR-0093・ADR-0096）', () => {
  const tokyo = (over: { travelMinutes?: number; farTrip?: boolean } = {}) =>
    client('far', TOKYO.lat, TOKYO.lng, { place: { address: '', ...TOKYO, postalCode: '', ...over } });

  it('移動が間に合わない（東京）：移動時間・遠方を設定へ（場所の節の移動時間の欄）。具体例を入れる', () => {
    const d = makeData({
      staff: [st('s1')],
      clients: [tokyo()],
      visits: [visit('v1', 'far', '09:00', '09:00', { windowKind: 'fixed' })],
    });
    const r = why(d);
    expect(r.kind).toBe('travel');
    expect(r.label).toBe('移動が間に合わない');
    expect(r.guide).toContain('移動時間（片道・分）');
    expect(r.guide).toContain('東京へ新幹線で行くなら 片道 120〜180分');
    expect(r.links).toEqual([{ to: clientTravelHref('far'), label: '移動時間・遠方を設定' }]);
    expect(r.links[0]!.to).toBe('/clients/far?tab=basic&edit=place&focus=travel');
  });

  it('移動が間に合わない：移動時間を入れ済みなら、その分数と、勤務の開始を早める・遠方（出張）に印を付ける案内', () => {
    const d = makeData({
      staff: [st('s1')],
      clients: [tokyo({ travelMinutes: 150 })],
      visits: [visit('v1', 'far', '09:00', '09:00', { windowKind: 'fixed' })],
    });
    const r = unassignedReasonOf(compile(d, DATE), {}, 'v1', T, d.clients)!;
    expect(r.kind).toBe('travel');
    expect(r.guide).toContain('移動時間（片道 150分）では、勤務の開始に家を出ても間に合いません');
    expect(r.guide).toContain('遠方（出張）に印を付けると');
    expect(r.guide).not.toContain('距離から見積もった');
  });

  it('遠方（出張）の日：その人の列にほかの訪問がある', () => {
    const d = makeData({
      staff: [st('s1')],
      clients: [tokyo({ travelMinutes: 60, farTrip: true }), near('c2')],
      visits: [visit('v1', 'far', '14:00', '14:00'), visit('v2', 'c2', '09:00', '09:00')],
    });
    const r = why(d, { s1: ['v2'] });
    expect(r.kind).toBe('farTrip');
    expect(r.links[0]!.to).toBe(clientTravelHref('far'));
  });

  it('位置なし：見込みの30分では間に合わない。緯度・経度を入れる', () => {
    const d = makeData({
      staff: [st('s1')],
      clients: [client('c1', 0, 0, { place: { address: '', lat: null, lng: null, postalCode: '' } })],
      visits: [visit('v1', 'c1', '08:10', '08:10', { windowKind: 'fixed' })],
    });
    const r = why(d);
    expect(r.kind).toBe('noPlace');
    expect(r.guide).toContain('30分');
    expect(r.links[0]!.to).toBe('/clients/c1?edit=place');
  });
});

describe('複合と内訳', () => {
  it('人ごとに理由が違えば、多い順に人数を添え、主な理由の案内', () => {
    const d = makeData({
      staff: [
        st('s1', { shiftEnd: '15:00' }),
        st('s2', { shiftEnd: '15:00' }),
        st('s3', { workDays: [2, 3, 4, 5, 6] }),
      ],
      clients: [near()],
      visits: [visit('v1', 'c1', '17:00', '17:00', { windowKind: 'fixed' })],
    });
    const r = why(d);
    expect(r.kind).toBe('hours');
    expect(r.summary).toBe('勤務時間外 2人・勤務日外 1人');
    expect(r.counts.map((c) => c.n)).toEqual([2, 1]);
    expect(r.guide).toContain('8:00〜15:00');
    expect(r.links[0]!.to).toBe('/staff');
  });

  it('その日の担当なしの訪問をまとめて、主な型の内訳（帯・知らせ）', () => {
    const d = makeData({
      staff: [st('s1', { shiftEnd: '15:00' })],
      clients: [near('c1'), near('c2'), near('c3')],
      visits: [
        visit('v1', 'c1', '17:00', '17:00', { windowKind: 'fixed' }),
        visit('v2', 'c2', '19:00', '19:00', { windowKind: 'fixed' }),
        visit('v3', 'c3', '10:00', '10:00'),
      ],
      absences: [],
    });
    const p = compile(d, DATE);
    const all = unassignedReasons(p, {}, T);
    expect([...all.keys()].sort()).toEqual(['v1', 'v2', 'v3']);
    expect(reasonBreakdown(all.values())).toBe('勤務時間外 2・入れられる人あり 1');
    const only = unassignedReasons(p, {}, T, { ids: new Set(['v3']) });
    expect([...only.keys()]).toEqual(['v3']);
  });

  it('countKinds：同じ数なら型の順', () => {
    expect(countKinds(['dayOff', 'hours']).map((c) => c.kind)).toEqual(['hours', 'dayOff']);
  });
});
