// 勤務の見込みの画面の表示のための計算（PRD D72。ADR-0015）
import { describe, expect, it } from 'vitest';
import { type WorkDay, type WorkStat, workTotals } from './workload';
import {
  axisMarks,
  emptyStat,
  fareInputError,
  limitInputError,
  pickedDaysOf,
  spanNum,
  statTitle,
  sumWork,
  workAxis,
} from './workloadView';

const stat = (staffId: string, over: Partial<WorkStat> = {}): WorkStat => ({ ...emptyStat(staffId), ...over });

const days: WorkDay[] = [
  {
    date: '2026-11-02',
    source: 'confirmed',
    stats: [stat('s1', { start: 540, end: 720 }), stat('s2', { start: 600, end: 900 })],
  },
  { date: '2026-11-03', source: null, stats: [] },
  { date: '2026-11-04', source: 'plan', stats: [stat('s1', { start: 390, end: 1230 })] },
];

describe('sumWork（月の合計を足す）', () => {
  it('渡した人の合計だけを足す', () => {
    const totals = workTotals(days);
    expect(sumWork(totals, [{ id: 's1' }, { id: 's2' }], (t) => t.days)).toBe(3);
    expect(sumWork(totals, [{ id: 's1' }], (t) => t.days)).toBe(2);
    expect(sumWork(totals, [], (t) => t.days)).toBe(0);
  });
});

describe('pickedDaysOf（選んだ人の日ごと）', () => {
  it('見込みのある日だけを日付の順に返す', () => {
    const r = pickedDaysOf(days, 's1');
    expect(r.map((x) => x.day.date)).toEqual(['2026-11-02', '2026-11-04']);
    expect(r[0].stat.start).toBe(540);
  });

  it('人がいなければ空', () => {
    expect(pickedDaysOf(days, undefined)).toEqual([]);
    expect(pickedDaysOf(days, 's9')).toEqual([]);
  });
});

describe('workAxis・axisMarks（時間軸）', () => {
  it('はみ出さなければ 7:00〜20:00', () => {
    expect(workAxis(pickedDaysOf(days, 's2'))).toEqual({ start: 420, end: 1200 });
    expect(workAxis([])).toEqual({ start: 420, end: 1200 });
  });

  it('はみ出す日があれば時間の区切りまで広げる', () => {
    expect(workAxis(pickedDaysOf(days, 's1'))).toEqual({ start: 360, end: 1260 });
  });

  it('目盛りは2時間ごと（範囲の中の偶数時）', () => {
    expect(axisMarks({ start: 420, end: 1200 })).toEqual([480, 600, 720, 840, 960, 1080, 1200]);
    expect(axisMarks({ start: 360, end: 1260 })).toEqual([360, 480, 600, 720, 840, 960, 1080, 1200]);
  });
});

describe('spanNum・statTitle（マスの数字と説明）', () => {
  it('拘束を時間の小数1桁で', () => {
    expect(spanNum(stat('s1', { span: 450 }))).toBe('7.5');
    expect(spanNum(stat('s1', { span: 500 }))).toBe('8.3');
    expect(spanNum(stat('s1', { span: 0 }))).toBe('0.0');
  });

  it('説明に時刻・内訳・件数、上限を超えればその旨', () => {
    const x = stat('s1', { start: 540, end: 1020, span: 480, visit: 300, travel: 60, wait: 120, count: 4 });
    const t = statTitle('山田', '2026-11-02', x);
    expect(t).toContain('山田さん 11/2：');
    expect(t).toContain('出勤〜退勤（拘束） 8:00（訪問 5:00・移動 1:00・空き時間（待ち） 2:00）・訪問 4件');
    expect(t).not.toContain('上限を超える');
    expect(statTitle('山田', '2026-11-02', { ...x, over: true })).toMatch(/・出勤〜退勤（拘束）が上限を超える$/);
  });
});

describe('fareInputError・limitInputError（設定の入力の検査）', () => {
  it('交通費の単価は 0〜1000 の数', () => {
    expect(fareInputError('0')).toBeNull();
    expect(fareInputError('1000')).toBeNull();
    expect(fareInputError('12.5')).toBeNull();
    for (const bad of ['', ' ', '-1', '1001', 'abc']) expect(fareInputError(bad)).toBe('0〜1000 の数にしてください');
  });

  it('拘束の上限は 0〜24 の 0.5刻み', () => {
    expect(limitInputError('0')).toBeNull();
    expect(limitInputError('8.5')).toBeNull();
    expect(limitInputError('24')).toBeNull();
    for (const bad of ['', '-0.5', '24.5', '8.3', 'x'])
      expect(limitInputError(bad)).toBe('0〜24 の 0.5刻みにしてください');
  });
});
