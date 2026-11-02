// デモで始めたとき（PRD D322・D409）：初期データ → 要対応の帯の［担当なしを組む］と同じ自動の組みのあと、
// 帯に重なり・休みの人が残らず、伝えたあとに変わった日（未連絡の変更）も無い。焼きなましを回すので plans.test.ts と分ける
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Problem, SolveOptions } from '../contracts/problem';
import { addDays } from '../domain/time';
import { bandDays, exceptionStatus } from '../lib/attentionBand';
import { autoRange, unassignedTargets } from '../lib/autoArrange';
import { createAutoArrange } from '../lib/autoArrangeBatch';
import { dayStatus } from '../lib/month';
import { findVisit } from '../patterns';
import { solve } from '../solver';
import { createDemoData } from './index';
import { createInitialData } from './plans';

/** Worker なしで、渡された設定（autoSolveOptions）のまま解く */
const solveNow = (problem: Problem, options: SolveOptions) => ({
  promise: Promise.resolve(solve(problem, options)),
  stop: () => {},
});

/** 帯が見る日の状態（例外だけ見せる＝エキスパート機能が切の数え方） */
const statuses = (d: DemoData, today: string) => bandDays(today).map((date) => exceptionStatus(dayStatus(d, date)));

/** 重なり（late）・休みの人（off）の訪問 */
const overlapsOrOff = (d: DemoData, today: string) =>
  statuses(d, today).flatMap((s) =>
    [...s.issues].filter(([, list]) => list.some((x) => x.kind === 'late' || x.kind === 'off')).map(([id]) => id),
  );

/** デモを作った直後の自動の組み（store の startArrange → requestUnassignedArrange と同じ依頼）を回したデータ */
async function demoStart(today: string): Promise<DemoData> {
  let data = createInitialData(today);
  const a = createAutoArrange(solveNow);
  a.connect({
    get: () => data,
    update: (fn) => {
      data = fn(data);
    },
  });
  const range = autoRange(today);
  const targets = unassignedTargets(data, today, range);
  expect(a.request({ targets, writeUsual: false, rangeTo: range.to, since: null, after: null, today })).toBe(true);
  for (let k = 0; k < 200 && a.running(); k++) await new Promise((r) => setTimeout(r, 0));
  expect(a.running()).toBe(false);
  return data;
}

describe('デモで始めたとき（PRD D322・D409）', () => {
  it('繰り返しの担当がその日に担当できない回（s1 の時間休の日の c16 13:00）は、この回だけ担当なしで保存する', () => {
    const today = '2026-11-02';
    const data = createInitialData(today);
    const base = createDemoData(today);
    expect(data.patterns).toEqual(base.patterns);
    expect(data.patterns.find((p) => p.id === 'c16')?.usualStaffId).toBe('s1');
    expect(data.visits.map((v) => v.id).sort()).toEqual(['2026-11-02_c16', '2026-11-12_c16']);
    for (const v of data.visits) {
      expect(v).toMatchObject({ staffId: null, start: null, pinned: false, cancelled: false });
      expect(v.pattern).toEqual({ id: 'c16', date: v.date, edited: false });
    }
    // 時間休でない日の回は繰り返しの担当のまま
    expect(findVisit(data, '2026-11-05_c16')?.staffId).toBe('s1');
    expect(overlapsOrOff(data, today)).toEqual([]);
  });

  it.each(['2026-11-02', '2026-11-04', '2026-10-21', '2027-03-15'])(
    '今日が %s：自動の組みのあと、帯に重なり・休みの人が無く、変更ありの日も無い',
    async (today) => {
      const data = await demoStart(today);
      expect(overlapsOrOff(data, today)).toEqual([]);
      expect(
        statuses(data, today)
          .filter((s) => s.state === 'changed')
          .map((s) => s.date),
      ).toEqual([]);
      // 担当なしにした回は自動の組みで埋まる
      for (let i = 0; i < 14; i++) {
        const v = findVisit(data, `${addDays(today, i)}_c16`);
        if (v && !v.cancelled) expect(v.staffId).not.toBeNull();
      }
    },
    60_000,
  );
});
