import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import type { Problem, SolveResult } from '../contracts/problem';
import { addDays } from '../domain/time';
import { compile } from '../matching';
import { findVisit, putVisits, visitsOn } from '../patterns';
import { createDemoData } from '../seed';
import { solve } from '../solver';
import {
  AUTO_ARRANGE_LABEL,
  autoBandText,
  autoDoneText,
  autoLeftOf,
  createAutoArrange,
  NO_LEFT,
} from './autoArrangeBatch';
import { dayBandIssues } from './bandIssues';

const TODAY = '2026-10-21';

/** 繰り返しの担当を外し、新しい繰り返し（毎日・c2・10:00・担当なし）を足したデモのデータ */
function start(): DemoData {
  const d = createDemoData(TODAY);
  const patterns = d.patterns.map((p) => ({ ...p, usualStaffId: null }));
  const np: Pattern = {
    ...patterns[0]!,
    id: 'pn',
    clientId: 'c2',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    windowKind: 'fixed',
    earliestStart: '10:00',
    latestStart: '10:00',
    from: TODAY,
    to: null,
  };
  return { ...d, patterns: [...patterns, np] };
}
const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(TODAY, i));
const job = (n: number, x: { writeUsual?: boolean; since?: DemoData | null; after?: DemoData | null } = {}) => ({
  targets: days(n).map((date) => ({ date, ids: [`${date}_pn`] })),
  writeUsual: x.writeUsual ?? false,
  rangeTo: addDays(TODAY, 60),
  today: TODAY,
  since: x.since ?? null,
  after: x.after ?? null,
});
const staffOf = (d: DemoData, date: string) => findVisit(d, `${date}_pn`)?.staffId ?? null;

/** Worker なしで解く（手で終わらせる） */
function fakeSolve() {
  const calls: { resolve: () => void }[] = [];
  const fn = (problem: Problem) => {
    let done: (r: SolveResult) => void = () => {};
    const promise = new Promise<SolveResult>((res) => {
      done = res;
    });
    const c = { resolve: () => done(solve(problem, { seed: 1, iterations: 2000 })) };
    calls.push(c);
    return { promise, stop: () => c.resolve() };
  };
  return { fn, calls };
}

/** store の代わり（update はすぐ反映する） */
function hostOf(first: DemoData) {
  let data = first;
  const labels: (string | undefined)[] = [];
  return {
    host: {
      get: () => data,
      update: (fn: (d: DemoData) => DemoData, label?: string) => {
        data = fn(data);
        labels.push(label);
      },
    },
    data: () => data,
    set: (d: DemoData) => {
      data = d;
    },
    labels,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
/** n 回目の計算が始まるのを待って終わらせる */
async function finish(calls: { resolve: () => void }[], i: number) {
  for (let k = 0; k < 20 && !calls[i]; k++) await tick();
  expect(calls[i], `${i + 1}回目の計算`).toBeDefined();
  calls[i]!.resolve();
  await tick();
}

describe('createAutoArrange（自動の組みの入れ物。ADR-0072）', () => {
  it('つながっていない・対象が無いときは依頼を受けない', () => {
    const a = createAutoArrange(fakeSolve().fn);
    expect(a.request(job(2))).toBe(false);
    a.connect(hostOf(start()).host);
    expect(a.request({ targets: [], writeUsual: false, rangeTo: TODAY, today: TODAY, since: null, after: null })).toBe(
      false,
    );
    expect(a.running()).toBe(false);
  });

  it('1日ずつ解き、終わったら update 1回（1手）で担当を書き、書いた件数を知らせる', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const h = hostOf(start());
    a.connect(h.host);
    expect(a.request(job(3))).toBe(true);
    expect(a.running()).toBe(true);
    await finish(s.calls, 0);
    expect(a.run.get()).toMatchObject({ index: 1, total: 3, waiting: 0 });
    expect(h.labels).toEqual([]);
    await finish(s.calls, 1);
    await finish(s.calls, 2);
    await tick();
    expect(h.labels).toEqual([AUTO_ARRANGE_LABEL]);
    for (const x of days(3)) expect(staffOf(h.data(), x)).not.toBeNull();
    expect(a.done.get()).toMatchObject({ written: 3, appliedDays: 3, skippedDays: 0, error: null });
    expect(a.run.get()).toBeNull();
    expect(a.running()).toBe(false);
  });

  it('繰り返しの保存から来た依頼（writeUsual）は繰り返しの担当を書く', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const h = hostOf(start());
    a.connect(h.host);
    a.request(job(2, { writeUsual: true }));
    await finish(s.calls, 0);
    await finish(s.calls, 1);
    await tick();
    expect(h.data().patterns.find((p) => p.id === 'pn')!.usualStaffId).not.toBeNull();
  });

  it('計算中に次の依頼が来たら待たせ、今のを書いたあとに組む（順に。それぞれ1手）', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const h = hostOf(start());
    a.connect(h.host);
    a.request(job(1));
    a.request({
      targets: [{ date: addDays(TODAY, 5), ids: [`${addDays(TODAY, 5)}_pn`] }],
      writeUsual: false,
      rangeTo: TODAY,
      today: TODAY,
      since: null,
      after: null,
    });
    expect(a.run.get()!.waiting).toBe(1);
    await tick();
    expect(s.calls).toHaveLength(1);
    await finish(s.calls, 0);
    // 1つ目を書いてから、2つ目を組み始める
    expect(h.labels).toEqual([AUTO_ARRANGE_LABEL]);
    expect(staffOf(h.data(), TODAY)).not.toBeNull();
    await finish(s.calls, 1);
    await tick();
    expect(h.labels).toEqual([AUTO_ARRANGE_LABEL, AUTO_ARRANGE_LABEL]);
    expect(staffOf(h.data(), addDays(TODAY, 5))).not.toBeNull();
    expect(a.running()).toBe(false);
  });

  it('計算中に別の変更が入った日は書かない（担当なしのまま）', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const h = hostOf(start());
    a.connect(h.host);
    a.request(job(2));
    await finish(s.calls, 0);
    // 1日目を組んでいる間に、その日の〈利用者さん〉の休みが入る（その日の入力が変わる。休みの訪問は組み直しの対象にもならない）
    const d = h.data();
    h.set({ ...d, clientLeaves: [{ id: 'l1', clientId: 'c2', from: TODAY, to: TODAY, note: '' }] });
    await finish(s.calls, 1);
    await tick();
    expect(a.done.get()).toMatchObject({ written: 1, appliedDays: 1, skippedDays: 1 });
    expect(staffOf(h.data(), TODAY)).toBeNull();
    expect(staffOf(h.data(), addDays(TODAY, 1))).not.toBeNull();
  });

  it('計算中にほかの繰り返しが変わって飛ばした日は、条件を見直してあと1回だけ組み直す', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const h = hostOf(start());
    a.connect(h.host);
    a.request(job(2));
    await finish(s.calls, 0);
    // 計算中に、ほかの繰り返しが変わる（patterns の参照が替わる＝どの日も組み始めたときのままでなくなる）
    h.set({ ...h.data(), patterns: [...h.data().patterns] });
    await finish(s.calls, 1);
    await tick();
    expect(a.done.get()).toMatchObject({ written: 0, skippedDays: 2 });
    // 組み直し（2日分）
    await finish(s.calls, 2);
    await finish(s.calls, 3);
    await tick();
    expect(a.done.get()).toMatchObject({ written: 2, skippedDays: 0 });
    expect(s.calls).toHaveLength(4);
    for (const x of days(2)) expect(staffOf(h.data(), x)).not.toBeNull();
    expect(a.running()).toBe(false);
  });

  it('組んでいる間に元に戻されたら（store が保存の前に戻ったら）書かずに捨てる。知らせも出さない', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const after = start();
    const before = { ...after, patterns: after.patterns.slice(0, -1) };
    const h = hostOf(before);
    a.connect(h.host);
    a.request(job(2, { since: before, after }));
    await finish(s.calls, 0);
    expect(h.labels).toEqual([]);
    expect(s.calls).toHaveLength(1);
    expect(a.done.get()).toBeNull();
    expect(a.running()).toBe(false);
  });

  it('データを丸ごと差し替えたら（abort）待たせている依頼ごと捨て、書かない', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const h = hostOf(start());
    a.connect(h.host);
    a.request(job(2));
    a.request(job(1));
    await tick();
    a.abort();
    expect(a.run.get()).toBeNull();
    expect(a.running()).toBe(false);
    s.calls[0]!.resolve();
    await tick();
    await tick();
    expect(h.labels).toEqual([]);
    expect(a.done.get()).toBeNull();
    expect(s.calls).toHaveLength(1);
    // 捨てたあとの依頼は受ける
    expect(a.request(job(1))).toBe(true);
  });

  it('expert 切：何も書かなくても、仕事が終わったら要対応の無い対象の日を決まった扱いにする（同じ1手。ADR-0073）', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    // 初期データ（担当あり）の今日・明日から担当なしの回を取り消し、要対応の無い日にする。対象の訪問（pn）は無いので組まない
    const d0 = createDemoData(TODAY);
    const cancelled = days(2).flatMap((date) =>
      visitsOn(d0, date)
        .filter((v) => v.staffId === null || dayBandIssues(d0, date).has(v.id))
        .map((v) => ({ ...v, cancelled: true })),
    );
    const clean = { ...d0, visits: putVisits(d0.visits, cancelled) };
    for (const date of days(2)) expect(dayBandIssues(clean, date).size).toBe(0);
    const h = hostOf(clean);
    a.connect(h.host);
    a.request(job(2));
    await tick();
    await tick();
    expect(s.calls).toHaveLength(0);
    expect(h.labels).toEqual([AUTO_ARRANGE_LABEL]);
    expect(Object.keys(h.data().snapshots).filter((d) => d >= TODAY)).toEqual(days(2));
  });

  it('expert 切：組めずに担当なしが残る日は決まった扱いにしない（ADR-0089）', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const none = { ...start(), staff: start().staff.map((x) => ({ ...x, active: false })) };
    const h = hostOf(none);
    a.connect(h.host);
    a.request(job(2));
    await tick();
    await tick();
    expect(s.calls).toHaveLength(0);
    expect(h.labels).toEqual([]);
    expect(Object.keys(h.data().snapshots).filter((d) => d >= TODAY)).toEqual([]);
  });

  it('外すと捨てる。組めた担当が無ければ書かず、知らせは0件', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const none = { ...start(), staff: start().staff.map((x) => ({ ...x, active: false })) };
    const h = hostOf({ ...none, org: { ...none.org, features: { expert: true } } });
    const off = a.connect(h.host);
    a.request(job(1));
    await tick();
    await tick();
    // 担当できる人がいない日は計算せずに終わる
    expect(s.calls).toHaveLength(0);
    expect(h.labels).toEqual([]);
    expect(a.done.get()).toMatchObject({ written: 0 });
    a.request(job(1));
    off();
    expect(a.running()).toBe(false);
  });

  it('保存の直後（store がまだ前のデータ）は after を読んで組み、描かれたら store の data を読む', async () => {
    const s = fakeSolve();
    const a = createAutoArrange(s.fn);
    const after = start();
    const before = { ...after, patterns: after.patterns.slice(0, -1) };
    const h = hostOf(before);
    a.connect(h.host);
    a.request(job(1, { since: before, after }));
    await tick();
    // 前のデータには新しい繰り返しが無いが、after で問題を作って解き始める
    expect(s.calls).toHaveLength(1);
    // 描かれる（store の data が after になる）。書くのは今の data で確かめる
    h.set(after);
    await finish(s.calls, 0);
    await tick();
    expect(a.done.get()).toMatchObject({ written: 1, appliedDays: 1 });
    expect(staffOf(h.data(), TODAY)).not.toBeNull();
  });
});

describe('知らせ・帯の文', () => {
  it('件数があれば「N件の担当を組みました」、無ければ〈スタッフ〉の呼び方で「組める…がいませんでした」', () => {
    const d = { written: 4, appliedDays: 2, skippedDays: 0, error: null, staffedOnly: false, left: NO_LEFT };
    expect(autoDoneText(d, 'スタッフ')).toBe('4件の担当を組みました');
    expect(autoDoneText({ ...d, written: 0 }, 'シッター')).toBe('組めるシッターがいませんでした。担当なしのまま');
    expect(autoDoneText({ ...d, skippedDays: 1 }, 'スタッフ')).toContain('変わった日は組んでいません');
    expect(autoDoneText({ ...d, error: '失敗' }, 'スタッフ')).toContain('失敗');
  });
  it('対象がすべて担当のある訪問（要対応の組み直しだけ）で何も書かなかったときは知らせない', () => {
    const d = { written: 0, appliedDays: 1, skippedDays: 0, error: null, staffedOnly: true, left: NO_LEFT };
    expect(autoDoneText(d, 'スタッフ')).toBeNull();
    expect(autoDoneText({ ...d, written: 2 }, 'スタッフ')).toBe('2件の担当を組みました');
  });
  it('担当なしのまま残った対象があれば、件数と組めない理由の内訳を添える（PRD D430）', () => {
    const d = { written: 66, appliedDays: 20, skippedDays: 0, error: null, staffedOnly: false };
    const left = { count: 11, why: '勤務時間外 6・勤務日外 5', first: { date: TODAY, visitId: 'v1' } };
    expect(autoDoneText({ ...d, left }, 'スタッフ')).toBe(
      '66件の担当を組みました。担当なしのまま 11件（勤務時間外 6・勤務日外 5）',
    );
    expect(autoDoneText({ ...d, written: 0, left }, 'シッター')).toBe(
      '組めるシッターがいませんでした。担当なしのまま 11件（勤務時間外 6・勤務日外 5）',
    );
  });
  it('autoLeftOf：組んだ日の対象のうち担当なしのまま残った訪問と理由の内訳・最初の1件', () => {
    // 22:00 の回は勤務（デモの〈スタッフ〉の勤務時間）の外で、だれも組めない
    const base = start();
    const d: DemoData = {
      ...base,
      patterns: base.patterns.map((p) =>
        p.id === 'pn' ? { ...p, earliestStart: '23:00', latestStart: '23:00', durationMinutes: 50 } : p,
      ),
    };
    const date = addDays(TODAY, 1);
    const problem = compile(d, date);
    const ids = [`${date}_pn`];
    const day = { date, visits: visitsOn(d, date), inputs: [], targetIds: ids, problem, routes: {} };
    const left = autoLeftOf(d, [day as never], [date], d.org.terms);
    expect(left.count).toBe(1);
    expect(left.why).toBe('勤務時間外 1');
    expect(left.first).toEqual({ date, visitId: `${date}_pn` });
    // 組まなかった日（飛ばした日）は数えない
    expect(autoLeftOf(d, [day as never], [], d.org.terms)).toEqual(NO_LEFT);
  });
  it('進み具合の帯の文', () => {
    expect(autoBandText({ index: 2, total: 10, waiting: 0 })).toBe('担当を自動で組んでいます 3/10日');
    expect(autoBandText({ index: 0, total: 1, waiting: 2 })).toContain('あと2件待ち');
  });
});
