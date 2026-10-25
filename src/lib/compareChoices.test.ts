// 提案を比べる（compareChoices）の純粋関数：案の組み立て・A・B の選び方・条件の差・担当の並び
import { describe, expect, it } from 'vitest';
import type { ReassignInfo } from '../contracts/data';
import type { Client, Visit } from '../contracts/documents';
import type { Preset, Rule } from '../contracts/rules';
import { compile } from '../matching';
import { client, DATE, makeData, rule, staff, visit } from '../matching/fixtures';
import { visitsOn } from '../patterns';
import { applyPreset } from '../seed';
import {
  arrangeChoices,
  BEFORE_CHOICE,
  type CompareChoice,
  CURRENT_CHOICE,
  choiceKindText,
  choiceStale,
  compareChoices,
  comparePair,
  compareStaffIds,
  hundredDelta,
  infeasibleReasons,
  isArrangeChoice,
  movedLabel,
  pickSide,
  routeTotals,
  ruleDiffRows,
  visitLabelOf,
} from './compareChoices';
import { type BatchProposal, dayInputsOf, type ProposalDay } from './monthBatch';

const fixed = (id: string, c: string, at: string, over: Partial<Visit> = {}) =>
  visit(id, c, at, at, { windowKind: 'fixed', ...over });

/** s1 に v1（9:00）・v2（11:00）、v3 は担当なし */
function data() {
  return makeData({
    staff: [staff('s1', 38.26, 140.87), staff('s2', 38.262, 140.872)],
    clients: [client('c1', 38.261, 140.871), client('c2', 38.262, 140.871), client('c3', 38.263, 140.871)],
    visits: [
      fixed('v1', 'c1', '09:00', { staffId: 's1' }),
      fixed('v2', 'c2', '11:00', { staffId: 's1' }),
      fixed('v3', 'c3', '13:00'),
    ],
    rules: [rule('r-wait', 'wait', 3), rule('r-bal', 'balance', 2)],
  });
}

const preset: Preset = {
  id: 'p1',
  name: '待ちを重く',
  note: '',
  weights: {
    clientRequirement: { weight: 0, hard: true },
    clientPreference: { weight: 0, hard: false },
    staffRequirement: { weight: 0, hard: true },
    staffPreference: { weight: 0, hard: false },
    compatibility: { weight: 0, hard: false },
    continuity: { weight: 0, hard: false },
    balance: { weight: 5, hard: false },
    wait: { weight: 4, hard: false },
  },
};

function proposalDay(date: string, routes: Record<string, string[]> = { s2: ['v3'] }, d = data()): ProposalDay {
  return {
    date,
    problem: compile(d, DATE),
    visits: visitsOn(d, DATE),
    inputs: dayInputsOf(d, DATE),
    routes,
    diff: null,
    unassigned: 0,
  };
}

const batch = (over: Partial<BatchProposal> = {}): BatchProposal => ({
  id: 7,
  ym: '2026-10',
  label: '10月',
  source: 'month',
  rangeStart: null,
  days: [],
  stopped: false,
  ...over,
});

const choice = (id: string, over: Partial<CompareChoice> = {}): CompareChoice => ({
  id,
  title: id,
  kind: 'proposal',
  rules: [],
  routes: {},
  unassigned: [],
  ...over,
});

describe('arrangeChoices', () => {
  const rules = data().rules;

  it('batch が null なら空', () => {
    expect(arrangeChoices(null, DATE, [preset], rules, new Set())).toEqual([]);
  });

  it('考え方ごとの案：その日の分だけ、プリセットの重みを当てて並べる', () => {
    const b = batch({
      choices: [
        { presetId: 'p1', name: '待ちを重く', days: [proposalDay(DATE)] },
        { presetId: 'p2', name: 'ほかの日だけ', days: [proposalDay('2026-10-13')] },
      ],
    });
    const out = arrangeChoices(b, DATE, [preset], rules, new Set());
    expect(out).toHaveLength(1);
    const c = out[0]!;
    expect(c).toMatchObject({
      id: 'arrange-7-p1',
      title: '「待ちを重く」の案（担当を組む）',
      kind: 'proposal',
      routes: { s2: ['v3'] },
      unassigned: [],
    });
    expect(c.rules).toEqual(applyPreset(rules, preset));
    expect(c.rules.find((r) => r.type === 'wait')?.weight).toBe(4);
    expect(c.day).toBe(b.choices![0]!.days[0]);
    expect(c.visits).toBe(b.choices![0]!.days[0]!.visits);
    expect(isArrangeChoice(c)).toBe(true);
  });

  it('プリセットが見つからなければ条件はそのまま', () => {
    const b = batch({ choices: [{ presetId: 'zzz', name: '消えた考え方', days: [proposalDay(DATE)] }] });
    expect(arrangeChoices(b, DATE, [preset], rules, new Set())[0]?.rules).toBe(rules);
  });

  it('範囲の提案：その日があれば1件（条件はそのまま）。ほかの日だけなら空', () => {
    const b = batch({ days: [proposalDay(DATE), proposalDay('2026-10-13')] });
    const out = arrangeChoices(b, DATE, [preset], rules, new Set());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'arrange-7-range', title: '10月の提案（担当を組む）', kind: 'proposal' });
    expect(out[0]?.rules).toBe(rules);
    expect(arrangeChoices(b, '2026-10-20', [preset], rules, new Set())).toEqual([]);
  });

  it('hidden の ID は外す', () => {
    const b = batch({ days: [proposalDay(DATE)] });
    expect(arrangeChoices(b, DATE, [], rules, new Set(['arrange-7-range']))).toEqual([]);
    const withChoices = batch({
      choices: [
        { presetId: 'p1', name: 'A', days: [proposalDay(DATE)] },
        { presetId: 'p2', name: 'B', days: [proposalDay(DATE)] },
      ],
    });
    const out = arrangeChoices(withChoices, DATE, [preset], rules, new Set(['arrange-7-p1']));
    expect(out.map((c) => c.id)).toEqual(['arrange-7-p2']);
  });

  it('isArrangeChoice：頭が arrange- の ID だけ', () => {
    expect(isArrangeChoice({ id: 'arrange-1-range' })).toBe(true);
    expect(isArrangeChoice({ id: CURRENT_CHOICE })).toBe(false);
  });
});

describe('compareChoices', () => {
  const d = data();
  const problem = compile(d, DATE);
  const visits = visitsOn(d, DATE);
  const base = { visits, reassign: null, rules: d.rules, fromArrange: [], made: [] };

  it('problem が null・訪問0件なら空', () => {
    expect(compareChoices({ ...base, problem: null })).toEqual([]);
    const empty = makeData({ staff: d.staff, clients: d.clients });
    expect(compareChoices({ ...base, problem: compile(empty, DATE), visits: [] })).toEqual([]);
  });

  it('今の担当だけ：訪問の担当から並びと担当なしを読む', () => {
    const out = compareChoices({ ...base, problem });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: CURRENT_CHOICE,
      title: '今の担当',
      kind: 'current',
      routes: { s1: ['v1', 'v2'] },
      unassigned: ['v3'],
    });
  });

  it('reassign があれば欠勤前が先頭。置いていない訪問は担当なし', () => {
    const reassign: ReassignInfo = {
      method: 'insert',
      baseRoutes: { s2: ['v1'] },
      basePins: {},
      absenceIds: [],
    };
    const out = compareChoices({ ...base, problem, reassign });
    expect(out.map((c) => c.id)).toEqual([BEFORE_CHOICE, CURRENT_CHOICE]);
    expect(out[0]).toMatchObject({
      title: '欠勤前（振り直す前の担当）',
      kind: 'before',
      routes: { s2: ['v1'] },
      unassigned: ['v2', 'v3'],
    });
  });

  it('担当を組むの案は担当なしを今の問題で数え直し、made は最後に並べる', () => {
    const arrange = choice('arrange-7-range', { routes: { s2: ['v3'] }, unassigned: [] });
    const made = choice('made-1');
    const out = compareChoices({ ...base, problem, fromArrange: [arrange], made: [made] });
    expect(out.map((c) => c.id)).toEqual([CURRENT_CHOICE, 'arrange-7-range', 'made-1']);
    expect(out[1]?.unassigned).toEqual(['v1', 'v2']);
    expect(out[2]).toBe(made);
    expect(arrange.unassigned).toEqual([]); // 渡した案は書き換えない
  });
});

describe('comparePair', () => {
  const list = [choice(BEFORE_CHOICE), choice(CURRENT_CHOICE), choice('x'), choice('y')];

  it('既定は A＝今の担当、B＝最後の案', () => {
    const { A, B } = comparePair(list, { a: null, b: null });
    expect(A?.id).toBe(CURRENT_CHOICE);
    expect(B?.id).toBe('y');
  });

  it('選んだ ID があればそれを使う。見つからない ID は既定に戻る', () => {
    expect(comparePair(list, { a: 'x', b: BEFORE_CHOICE })).toMatchObject({ A: { id: 'x' }, B: { id: BEFORE_CHOICE } });
    expect(comparePair(list, { a: 'ない', b: 'ない' })).toMatchObject({ A: { id: CURRENT_CHOICE }, B: { id: 'y' } });
  });

  it('A が最後の案なら B は A 以外の最後。案が無ければ両方 undefined', () => {
    expect(comparePair(list, { a: 'y', b: null }).B?.id).toBe('x');
    expect(comparePair([], { a: null, b: null })).toEqual({ A: undefined, B: undefined });
  });
});

describe('pickSide', () => {
  const pair = { A: choice('a1'), B: choice('b1') };

  it('同じ案を選んだら null（変えない）', () => {
    expect(pickSide({ a: null, b: null }, pair, 'a', 'a1')).toBeNull();
    expect(pickSide({ a: null, b: null }, pair, 'b', 'b1')).toBeNull();
  });

  it('もう一方と同じ案を選んだら入れ替える', () => {
    expect(pickSide({ a: null, b: null }, pair, 'a', 'b1')).toEqual({ a: 'b1', b: 'a1' });
    expect(pickSide({ a: null, b: null }, pair, 'b', 'a1')).toEqual({ a: 'b1', b: 'a1' });
  });

  it('それ以外はその側だけ変え、もう一方は今並べている案に固定する', () => {
    expect(pickSide({ a: null, b: null }, pair, 'a', 'z')).toEqual({ a: 'z', b: 'b1' });
    expect(pickSide({ a: null, b: null }, pair, 'b', 'z')).toEqual({ a: 'a1', b: 'z' });
    expect(pickSide({ a: 'a1', b: 'b9' }, pair, 'a', 'z')).toEqual({ a: 'z', b: 'b9' });
  });

  it('並べる案が無いときは null で補う', () => {
    expect(pickSide({ a: null, b: null }, { A: undefined, B: undefined }, 'a', 'z')).toEqual({ a: 'z', b: null });
  });
});

describe('choiceStale', () => {
  const d = data();
  const visits = visitsOn(d, DATE);

  it('訪問も day も持たない案は古くならない', () => {
    expect(choiceStale(choice('x'), visits, d)).toBe(false);
  });

  it('作ったときの訪問と同じなら古くない。件数・中身が違えば古い', () => {
    expect(choiceStale(choice('x', { visits }), visits, d)).toBe(false);
    expect(choiceStale(choice('x', { visits: visits.slice(1) }), visits, d)).toBe(true);
    const changed = visits.map((v, i) => (i === 0 ? { ...v, staffId: 's2' } : v));
    expect(choiceStale(choice('x', { visits: changed }), visits, d)).toBe(true);
  });

  it('担当を組むの案は proposalDayFresh で確かめる（入力が変われば古い）', () => {
    const day = proposalDay(DATE, { s2: ['v3'] }, d);
    expect(choiceStale(choice('x', { day }), visits, d)).toBe(false);
    const d2 = { ...d, rules: [...d.rules, rule('r-new', 'wait', 1)] };
    expect(choiceStale(choice('x', { day }), visits, d2)).toBe(true);
  });
});

describe('choiceKindText', () => {
  it('種類ごとの文', () => {
    expect(choiceKindText('current')).toBe('保存している担当');
    expect(choiceKindText('before')).toBe('振り直す前');
    expect(choiceKindText('proposal')).toBe('提案（保存しない）');
  });
});

describe('ruleDiffRows', () => {
  const r = (id: string, type: Rule['type'], weight: number, label = id, hard = false): Rule => ({
    id,
    type,
    label,
    weight,
    hard,
  });

  it('A の順、次に B だけの条件。重みの文を並べる', () => {
    const a = { rules: [r('w', 'wait', 3, '待ち'), r('c', 'compatibility', 2, '相性')] };
    const b = { rules: [r('n', 'balance', 1, '均等'), r('w', 'wait', 5, '待ち')] };
    expect(ruleDiffRows(a, b)).toEqual([
      { id: 'w', label: '待ち', a: '重み3', b: '重み5' },
      { id: 'c', label: '相性', a: '重み2', b: '（なし）' },
      { id: 'n', label: '均等', a: '（なし）', b: '重み1' },
    ]);
  });

  it('重み0は無効、必須にできる型の hard は必須、balance の必須は重みも付く', () => {
    const a = { rules: [r('w', 'wait', 0, '待ち'), r('q', 'clientRequirement', 0, '必要', true)] };
    const b = {
      rules: [
        r('w', 'wait', 0, '待ち'),
        r('q', 'clientRequirement', 0, '必要', true),
        r('b', 'balance', 2, '均等', true),
      ],
    };
    const rows = ruleDiffRows(a, b);
    expect(rows.find((x) => x.id === 'w')).toMatchObject({ a: '無効', b: '無効' });
    expect(rows.find((x) => x.id === 'q')).toMatchObject({ a: '必須', b: '必須' });
    expect(rows.find((x) => x.id === 'b')).toMatchObject({ a: '（なし）', b: '必須・重み2' });
  });

  it('条件が無ければ空', () => {
    expect(ruleDiffRows({ rules: [] }, { rules: [] })).toEqual([]);
  });
});

describe('compareStaffIds', () => {
  const order = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];

  it('訪問のある人だけを、人の並び順で（並びに無い人は後ろへ）', () => {
    expect(compareStaffIds({ s3: ['v1'], s1: [] }, { s2: ['v2'], zz: ['v3'] }, order)).toEqual(['s2', 's3', 'zz']);
  });

  it('A・B の両方にいる人は1回だけ。どちらも空なら空', () => {
    expect(compareStaffIds({ s1: ['v1'] }, { s1: ['v2'] }, order)).toEqual(['s1']);
    expect(compareStaffIds({ s1: [] }, {}, order)).toEqual([]);
  });
});

describe('infeasibleReasons', () => {
  it('problem が null なら空', () => {
    expect(infeasibleReasons(null).size).toBe(0);
  });

  it('どの担当も可にならない訪問の理由を訪問の ID で引ける', () => {
    const d = data();
    d.availability = [
      { staffId: 's1', date: DATE, slots: [] },
      { staffId: 's2', date: DATE, slots: [] },
    ];
    const p = compile(d, DATE);
    const m = infeasibleReasons(p);
    expect([...m.keys()].sort()).toEqual(['v1', 'v2', 'v3']);
    expect(m.get('v1')?.length).toBeGreaterThan(0);
  });

  it('全員が受けられる日は空', () => {
    expect(infeasibleReasons(compile(data(), DATE)).size).toBe(0);
  });
});

describe('hundredDelta', () => {
  const scale = { lowerBound: 100, visits: 10, lowerAssign: 0, lowerTravel: 100, lowerDropped: 0 };

  it('どちらかの採点か物差しが無ければ null', () => {
    expect(hundredDelta(null, { total: 100 }, scale)).toBeNull();
    expect(hundredDelta({ total: 100 }, null, scale)).toBeNull();
    expect(hundredDelta({ total: 100 }, { total: 100 }, null)).toBeNull();
    expect(hundredDelta({ total: 100 }, { total: 100 }, undefined)).toBeNull();
  });

  it('点数の A・B と差（B−A）', () => {
    // 100 − (費用 − 下限) / 訪問数
    expect(hundredDelta({ total: 150 }, { total: 120 }, scale)).toEqual({ a: 95, b: 98, d: 3 });
    expect(hundredDelta({ total: 100 }, { total: 150 }, scale)).toEqual({ a: 100, b: 95, d: -5 });
  });
});

describe('visitLabelOf', () => {
  const v = visit('v1', 'c1', '09:00', '09:30');
  const label = visitLabelOf(
    new Map([['v1', v]]),
    new Map<string, Client>([['c1', client('c1', 0, 0, { displayName: '山田' })]]),
  );

  it('開始の早い時刻と〈利用者さん〉の名前', () => {
    expect(label('v1')).toBe('09:00 山田');
  });

  it('訪問が無ければ時刻なしで「（不明）」', () => {
    expect(label('zzz')).toBe(' （不明）');
  });

  it('〈利用者さん〉が無ければ「（不明）」', () => {
    const l = visitLabelOf(new Map([['v1', v]]), new Map());
    expect(l('v1')).toBe('09:00 （不明）');
  });
});

describe('routeTotals', () => {
  const p = compile(data(), DATE);

  it('problem が null・人が問題に無ければ null', () => {
    expect(routeTotals(null, 's1', ['v1'])).toBeNull();
    expect(routeTotals(p, 'ない', ['v1'])).toBeNull();
  });

  it('ルートの移動・待ちを返す（問題に無い訪問は読み飛ばす）', () => {
    const t = routeTotals(p, 's1', ['v1', 'v2', 'ない']);
    expect(t).not.toBeNull();
    expect(t!.stops).toHaveLength(2);
    expect(t!.travelMinutes).toBeGreaterThan(0);
    expect(t!.waitMinutes).toBeGreaterThanOrEqual(0);
  });

  it('訪問が空でも計算できる（移動・待ちは0）', () => {
    expect(routeTotals(p, 's1', [])).toMatchObject({ travelMinutes: 0, waitMinutes: 0, stops: [] });
  });
});

describe('movedLabel', () => {
  const name = (id: string) => `名前:${id}`;

  it('もう一方でも同じ担当なら null', () => {
    expect(movedLabel('s1', 's1', 'a', name)).toBeNull();
    expect(movedLabel('s1', 's1', 'b', name)).toBeNull();
  });

  it('別の担当なら A 側は「→ Bでは」、B 側は「← Aでは」', () => {
    expect(movedLabel('s2', 's1', 'a', name)).toBe('→ Bでは 名前:s2');
    expect(movedLabel('s2', 's1', 'b', name)).toBe('← Aでは 名前:s2');
  });

  it('もう一方で担当なし（undefined）なら「担当なし」', () => {
    expect(movedLabel(undefined, 's1', 'a', name)).toBe('→ Bでは 担当なし');
    expect(movedLabel(undefined, 's1', 'b', name)).toBe('← Aでは 担当なし');
  });
});
