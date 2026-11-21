// 同行の組（2人体制・研修同行。PRD D474・D475。ADR-0120）の問題：開始をそろえる・同じ人は回れない・研修同行は人の条件を見ない・続く訪問にしない
import { describe, expect, it } from 'vitest';
import { score } from '../evaluate';
import { solve } from '../solver';
import { compile } from './compile';
import { client, DATE, makeData, rule, staff, visit } from './fixtures.testkit';
import { scheduleRoute } from './timing';

function pairDay(accompany: 'pair' | 'trainee' | undefined, allowed: string[] = ['s1']) {
  return makeData({
    staff: [staff('s1', 38.26, 140.87), staff('s2', 38.261, 140.871)],
    clients: [client('c1', 38.265, 140.875, { allowedStaffIds: allowed })],
    visits: [
      visit('main', 'c1', '09:00', '10:00'),
      visit('copy', 'c1', '09:00', '10:00', accompany ? { accompany } : {}),
      visit('next', 'c1', '10:00', '10:00', { windowKind: 'fixed' }),
    ],
    rules: [rule('sc', 'sameClient', 2), rule('wait', 'wait', 1)],
  });
}

const at = (p: ReturnType<typeof compile>, id: string) => p.visits.findIndex((v) => v.id === id);

describe('同行の組の問題', () => {
  it('組の訪問は幅があっても開始（早）にそろえ、companion を付ける。印の無い2件は今までどおり', () => {
    const p = compile(pairDay('pair'), DATE);
    const main = p.visits[at(p, 'main')]!;
    const copy = p.visits[at(p, 'copy')]!;
    expect([main.latest, copy.latest]).toEqual([main.earliest, copy.earliest]);
    expect([main.companion, copy.companion]).toEqual(['group', 'group']);
    const plain = compile(pairDay(undefined), DATE);
    expect(plain.visits[at(plain, 'main')]!.latest).toBe(10 * 60);
    expect(plain.visits.some((v) => v.companion)).toBe(false);
  });
  it('同じ人は組の2件を回れない（strict で不可）', () => {
    const p = compile(pairDay('pair', []), DATE);
    expect(scheduleRoute(p, 0, [at(p, 'main'), at(p, 'copy')], 'strict')).toBeNull();
  });
  it('組の訪問は続く訪問（sameClient）の組にしない。印の無い2件は今までどおり組になる', () => {
    expect(compile(pairDay('pair'), DATE).chain).toBeUndefined();
    expect(compile(pairDay(undefined), DATE).chain).toBeDefined();
  });
  it('2人体制の2人目は人の条件を見る（担当を限る s1 だけ）。研修同行の分は見ない（s2 も可）', () => {
    const pair = compile(pairDay('pair'), DATE);
    expect(pair.allowed[at(pair, 'copy')]).toEqual([true, false]);
    const tr = compile(pairDay('trainee'), DATE);
    const tc = at(tr, 'copy');
    expect(tr.visits[tc]!.companion).toBe('trainee');
    expect(tr.allowed[tc]).toEqual([true, true]);
    expect(tr.reasons[tc]!.flat().some((r) => r.ruleId === 'allowedStaff')).toBe(false);
  });
  it('AI は組の2件を別の人に入れ、solver と evaluate の合計点は一致する', () => {
    const p = compile(pairDay('pair', []), DATE);
    const r = solve(p, { seed: 1, iterations: 3000 });
    const who = (id: string) => Object.keys(r.routes).find((s) => r.routes[s]!.includes(id));
    expect(who('main')).toBeDefined();
    expect(who('copy')).toBeDefined();
    expect(who('main')).not.toBe(who('copy'));
    expect(score(p, r.routes).total).toBeCloseTo(r.score, 6);
  });
});
