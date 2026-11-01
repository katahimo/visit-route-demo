// 欠勤の振り直しの手順と、日の予定の振り直しの欄のための純粋関数：lib/planReassign
import { describe, expect, it } from 'vitest';
import type { DemoData, ReassignInfo } from '../contracts/data';
import type { Absence } from '../contracts/documents';
import { compile } from '../matching';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures.testkit';
import { reassign, targetsOf } from '../reassign';
import { absencesOn, baseOf, saveAbsence, withoutAbsencesOn } from './absences';
import {
  absenceBaseOf,
  absencePreviewOf,
  absentStaffOf,
  annealDisabledWhy,
  annealKeyOf,
  hasBase,
  planAOf,
  planAResultOf,
  planReassign,
  reassignFrom,
  reassignMarksOf,
  routesOfIds,
} from './planReassign';

const fixed = (id: string, c: string, at: string, over = {}) => visit(id, c, at, at, { windowKind: 'fixed', ...over });
const ab = (id: string, staffId: string, from: string | null = null, to: string | null = null): Absence => ({
  id,
  staffId,
  date: DATE,
  from,
  to,
  note: '',
});

/** s1 が2件・s2 が1件 */
function data(over: Partial<DemoData> = {}): DemoData {
  return makeData({
    staff: [staff('s1', 38.26, 140.87), staff('s2', 38.262, 140.872)],
    clients: [client('c1', 38.261, 140.871), client('c2', 38.262, 140.871), client('c3', 38.263, 140.871)],
    visits: [
      fixed('v1', 'c1', '09:00', { staffId: 's1' }),
      fixed('v2', 'c2', '11:00', { staffId: 's1' }),
      fixed('v3', 'c3', '14:00', { staffId: 's2' }),
    ],
    ...over,
  });
}

const info = (over: Partial<ReassignInfo> = {}): ReassignInfo => ({
  method: 'insert',
  baseRoutes: { s1: ['v1', 'v2'], s2: ['v3'] },
  basePins: {},
  absenceIds: ['a1'],
  ...over,
});

describe('planReassign（欠勤を足して振り直す手順）', () => {
  it('手で compile・baseOf・targetsOf・reassign を呼んだのと同じ結果', () => {
    const d0 = data();
    const a = ab('a1', 's1');
    const got = planReassign(d0, DATE, a);
    const d1 = saveAbsence(d0, a);
    const p = compile(d1, DATE);
    const base = baseOf(d1, DATE, p);
    const before = { problem: compile(withoutAbsencesOn(d1, DATE), DATE), routes: base.routes };
    const targets = targetsOf(p, before, ['s1']);
    expect(got.data).toEqual(d1);
    expect(got.problem).toEqual(p);
    expect(got.base).toEqual(base);
    expect(got.absences).toEqual(absencesOn(d1, DATE));
    expect(got.targets).toEqual(targets);
    expect(got.result).toEqual(reassign(p, base.routes, targets));
    expect(got.targets.map((x) => x.visitId).sort()).toEqual(['v1', 'v2']);
  });
  it('前半と後半に分けても同じ（見込みは前半で元の案の有無を見てから後半へ）', () => {
    const d0 = data();
    const a = ab('a1', 's1', '09:00', '12:00');
    const b = absenceBaseOf(d0, DATE, a);
    expect(hasBase(b)).toBe(true);
    expect({ ...b, ...reassignFrom(b, DATE) }).toEqual(planReassign(d0, DATE, a));
  });
  it('担当のある訪問が無い日は元の案が無い', () => {
    const d0 = data({ visits: [fixed('v1', 'c1', '09:00')] });
    expect(hasBase(absenceBaseOf(d0, DATE, ab('a1', 's1')))).toBe(false);
  });
});

describe('absencePreviewOf（欄の1段目の見込み。PRD D414）', () => {
  it('振り直す訪問・案A で入らない件数・担当が移る差を出す（データは書かない）', () => {
    const d0 = data();
    const a = ab('a1', 's1');
    const got = absencePreviewOf(d0, DATE, a);
    const plan = planReassign(d0, DATE, a);
    expect(got.hasBase).toBe(true);
    expect(got.targets).toEqual(plan.targets);
    expect(got.unplacedA).toBe(plan.result.unplaced.length);
    const moved = got.diff?.moved.map((m) => [m.visitId, m.from, m.to]) ?? [];
    expect(moved.map((m) => m[0]).sort()).toEqual(['v1', 'v2']);
    for (const m of moved) expect(m[1]).toBe('s1');
    expect(d0.absences).toEqual([]);
  });
  it('担当のある訪問が無い日は振り直せない（差は null）', () => {
    const d0 = data({ visits: [fixed('v1', 'c1', '09:00')] });
    expect(absencePreviewOf(d0, DATE, ab('a1', 's1'))).toEqual({
      targets: [],
      hasBase: false,
      unplacedA: 0,
      diff: null,
    });
  });
});

describe('振り直しの欄のための関数', () => {
  const p = compile(data(), DATE);
  it('routesOfIds：問題の〈スタッフ〉の順・問題の訪問だけ・空の列は除く', () => {
    expect(routesOfIds(p, { s2: ['v3', 'x'], s1: [], zz: ['v1'] })).toEqual({ s2: ['v3'] });
    expect(Object.keys(routesOfIds(p, { s2: ['v3'], s1: ['v1'] }))).toEqual(['s1', 's2']);
  });
  it('planAOf：案A の列（無ければ、反映したのが案A のとき今の並び）を問題の訪問だけにする', () => {
    const routes = { s1: ['v1'], s2: ['v3', 'v2'] };
    expect(planAOf(info({ insertRoutes: { s2: ['v1', 'gone'] } }), p, routes)).toEqual({ s2: ['v1'] });
    expect(planAOf(info(), p, routes)).toEqual(routes);
    expect(planAOf(info({ method: 'anneal' }), p, routes)).toBeNull();
  });
  it('planAResultOf：担当のある訪問はピン、列に無い訪問は担当なし', () => {
    expect(planAResultOf(p, { s2: ['v3', 'v1'] })).toEqual({
      routes: { s2: ['v3', 'v1'] },
      placed: [],
      unplaced: [],
      unassigned: ['v2'],
      pins: { v3: 's2', v1: 's2' },
    });
  });
  it('annealKeyOf：振り直しが同じなら同じキー', () => {
    expect(annealKeyOf(DATE, null)).toBeNull();
    expect(annealKeyOf(DATE, info())).toBe(annealKeyOf(DATE, info({ method: 'anneal', stayWeight: 3 })));
    expect(annealKeyOf(DATE, info())).not.toBe(annealKeyOf(DATE, info({ absenceIds: ['a2'] })));
  });
  it('reassignMarksOf：代行・開始の変化・変わる人・入らない', () => {
    const m = reassignMarksOf({
      moved: [
        { visitId: 'v1', from: 's1', to: 's2' },
        { visitId: 'v2', from: 's1', to: null },
      ],
      shifted: [{ visitId: 'v3', minutes: 15 }],
      unplaced: ['v2'],
      changedStaff: ['s1', 's2'],
      travelDelta: 0,
    });
    expect([...m.substitute]).toEqual([['v1', 's1']]);
    expect([...m.shifted]).toEqual([['v3', 15]]);
    expect([...m.changed]).toEqual(['s1', 's2']);
    expect([...m.emphasize]).toEqual(['v1']);
    expect([...m.unplaced]).toEqual(['v2']);
    expect(reassignMarksOf(null).substitute.size).toBe(0);
  });
  it('absentStaffOf：振り直しに使った、その日のまだある欠勤の人', () => {
    const absences = [ab('a1', 's1'), { ...ab('a2', 's2'), date: '2000-01-01' }, ab('a3', 's2')];
    expect([...absentStaffOf(info({ absenceIds: ['a1', 'a2'] }), absences, DATE)]).toEqual(['s1']);
    expect(absentStaffOf(null, absences, DATE).size).toBe(0);
  });
  it('annealDisabledWhy：作れない理由を順に', () => {
    const ok = { info: info(), cancelled: false, planA: {}, otherRunning: false };
    expect(annealDisabledWhy(ok)).toBeNull();
    expect(annealDisabledWhy({ ...ok, info: null })).toBe('振り直しがありません');
    expect(annealDisabledWhy({ ...ok, cancelled: true })).toBe('欠勤が取り消されているので作れません');
    expect(annealDisabledWhy({ ...ok, planA: null })).toBe('案A がありません');
    expect(annealDisabledWhy({ ...ok, otherRunning: true })).toBe('計算中は押せません');
  });
});
