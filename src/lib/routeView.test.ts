import { describe, expect, it } from 'vitest';
import { homeLegKey, NO_ROUTE_SEL, type RouteSelState, routeSelect, sameRouteSel } from './routeView';

/** v1・v2 は s1、v3 は s2（集まり a）。集まり b では v1 は s2 */
const owners: Record<string, Record<string, string>> = {
  a: { v1: 's1', v2: 's1', v3: 's2' },
  b: { v1: 's2', v2: 's1', v3: 's2' },
};
const ownerOf = (set: string, id: string) => owners[set]?.[id];
const go = (s: RouteSelState, ...as: Parameters<typeof routeSelect>[1][]) =>
  as.reduce((x, a) => routeSelect(x, a, ownerOf), s);
const v = (id: string, set = 'a') => ({ id, set });

describe('routeSelect（地図で選んだものの遷移）', () => {
  it('訪問を押すと選び、その人に地図を合わせる。もう一度押すと外す（担当の絞り込みは残す）', () => {
    const s = go(NO_ROUTE_SEL, { type: 'pick', sel: v('v1') });
    expect(s).toEqual({ focusStaff: 's1', focusLeg: null, picked: v('v1') });
    expect(go(s, { type: 'pick', sel: v('v1') })).toEqual({ focusStaff: 's1', focusLeg: null, picked: null });
    // 集まりが違えば別のもの（担当も集まりごと）
    expect(go(s, { type: 'pick', sel: v('v1', 'b') })).toEqual({
      focusStaff: 's2',
      focusLeg: null,
      picked: v('v1', 'b'),
    });
  });
  it('担当の分からない訪問は選ぶだけ（地図は合わせない）', () => {
    expect(go(NO_ROUTE_SEL, { type: 'pick', sel: v('zz') })).toEqual({ ...NO_ROUTE_SEL, picked: v('zz') });
  });
  it('区間を押すと強調し、その人のものでない選んだ訪問は外す', () => {
    const s = go(NO_ROUTE_SEL, { type: 'pick', sel: v('v3') }, { type: 'leg', sel: v('v2') });
    expect(s).toEqual({ focusStaff: 's1', focusLeg: v('v2'), picked: null });
    // 同じ人の訪問は残す
    const t = go(NO_ROUTE_SEL, { type: 'pick', sel: v('v1') }, { type: 'leg', sel: v('v2') });
    expect(t).toEqual({ focusStaff: 's1', focusLeg: v('v2'), picked: v('v1') });
    // もう一度押すと外す
    expect(go(t, { type: 'leg', sel: v('v2') })).toEqual({ focusStaff: 's1', focusLeg: null, picked: v('v1') });
  });
  it('自宅へ帰る区間の担当はキーの中の人', () => {
    const s = go(NO_ROUTE_SEL, { type: 'leg', sel: v(homeLegKey('s2')) });
    expect(s).toEqual({ focusStaff: 's2', focusLeg: v('home:s2'), picked: null });
    // その人のものでない区間は、別の人の訪問を選ぶと外す
    expect(go(s, { type: 'pick', sel: v('v1') })).toEqual({ focusStaff: 's1', focusLeg: null, picked: v('v1') });
  });
  it('見る担当を変える：その人のものでない区間・訪問は外す。全員に戻すと区間の強調だけ外す', () => {
    const s = go(NO_ROUTE_SEL, { type: 'pick', sel: v('v1') }, { type: 'leg', sel: v('v2') });
    expect(go(s, { type: 'focus', staffId: 's2' })).toEqual({ focusStaff: 's2', focusLeg: null, picked: null });
    expect(go(s, { type: 'focus', staffId: 's1' })).toBe(s);
    expect(go(s, { type: 'focus', staffId: null })).toEqual({ focusStaff: null, focusLeg: null, picked: v('v1') });
  });
  it('担当が変わった訪問：選んでいれば絞り込みを新しい担当に合わせ、ほかの選択を外す', () => {
    const s = go(NO_ROUTE_SEL, { type: 'pick', sel: v('v1') }, { type: 'leg', sel: v('v2') });
    expect(go(s, { type: 'follow', visitId: 'v1', to: 's2' })).toEqual({
      focusStaff: 's2',
      focusLeg: null,
      picked: v('v1'),
    });
    // 全員を見ているときは全員のまま
    const all = go(s, { type: 'focus', staffId: null });
    expect(go(all, { type: 'follow', visitId: 'v1', to: 's2' })).toEqual({
      focusStaff: null,
      focusLeg: null,
      picked: v('v1'),
    });
    // 未割当にしたら、その訪問の選択だけ外す
    expect(go(s, { type: 'follow', visitId: 'v2', to: null })).toEqual({
      focusStaff: 's1',
      focusLeg: null,
      picked: v('v1'),
    });
    // 選んでいない訪問なら変えない（同じ物）
    expect(go(s, { type: 'follow', visitId: 'v3', to: 's1' })).toBe(s);
  });
  it('reset ですべて外す。変わらない操作は同じ物を返す', () => {
    const s = go(NO_ROUTE_SEL, { type: 'pick', sel: v('v1') });
    expect(go(s, { type: 'reset' })).toBe(NO_ROUTE_SEL);
    expect(go(NO_ROUTE_SEL, { type: 'reset' })).toBe(NO_ROUTE_SEL);
    expect(go(NO_ROUTE_SEL, { type: 'focus', staffId: null })).toBe(NO_ROUTE_SEL);
  });
  it('sameRouteSel', () => {
    expect(sameRouteSel(null, v('v1'))).toBe(false);
    expect(sameRouteSel(v('v1'), v('v1'))).toBe(true);
    expect(sameRouteSel(v('v1', 'b'), v('v1'))).toBe(false);
  });
});
