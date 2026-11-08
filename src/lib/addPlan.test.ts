import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import {
  addPlanClients,
  addPlanDate,
  addPlanDone,
  addPlanError,
  addPlanFieldOf,
  addPlanKind,
  addPlanPatternForm,
  addPlanSaveError,
  addPlanVisitDraft,
  FROM_ERROR,
  planAddLabel,
  STALE_ERROR,
} from './addPlan';
import { applyTemplate } from './features';

describe('addPlanKind（入れ方は繰り返しを使うかで決まる）', () => {
  it('定期（基本・すべて）は定期、単発のみは単発', () => {
    expect(addPlanKind(applyTemplate('basic'))).toBe('recurring');
    expect(addPlanKind(applyTemplate('all'))).toBe('recurring');
    expect(addPlanKind(applyTemplate('oneOff'))).toBe('oneOff');
  });
});

describe('planAddLabel（月・週の主ボタンの言葉）', () => {
  it('繰り返しを使う（定期）は「定期の予定を追加」、使わない（単発）は「予約を追加」', () => {
    expect(planAddLabel(applyTemplate('basic'))).toBe('定期の予定を追加');
    expect(planAddLabel(applyTemplate('all'))).toBe('定期の予定を追加');
    expect(planAddLabel(applyTemplate('oneOff'))).toBe('予約を追加');
  });
});

describe('addPlanClients・addPlanDate', () => {
  it('選べるのは利用中の人だけ', () => {
    const d = {
      clients: [
        { id: 'a', active: true },
        { id: 'b', active: false },
      ],
    } as unknown as DemoData;
    expect(addPlanClients(d).map((c) => c.id)).toEqual(['a']);
  });
  it('初めの日は今見ている日。今日より前なら今日', () => {
    expect(addPlanDate('2026-11-05', '2026-10-30')).toBe('2026-11-05');
    expect(addPlanDate('2026-10-01', '2026-10-30')).toBe('2026-10-30');
  });
});

describe('初めの欄', () => {
  it('定期：開始日は今日・曜日は初めの日の曜日・10:00・60分・毎週・種類なし', () => {
    // 2026-11-05 は木曜
    const f = addPlanPatternForm('2026-11-05', '2026-10-30');
    expect(f).toMatchObject({
      id: null,
      weekdays: [4],
      from: '2026-10-30',
      repeat: 'weekly',
      monthWeeks: [],
      earliestStart: '10:00',
      durationMinutes: '60',
      everyWeeks: 1,
      typeId: '',
    });
  });
  it('単発：初めの日・10:00（ちょうど）・60分', () => {
    const d = { clients: [{ id: 'a', active: true }] } as unknown as DemoData;
    expect(addPlanVisitDraft(d, '2026-11-05', 'a')).toMatchObject({
      clientId: 'a',
      date: '2026-11-05',
      earliestStart: '10:00',
      latestStart: '10:00',
      durationMinutes: 60,
      windowKind: 'fixed',
    });
  });
});

describe('addPlanDone', () => {
  it('知らせ：自動で組む依頼を出したときだけ書く', () => {
    expect(addPlanDone('月 10:00', true)).toBe('予定を入れました（月 10:00・担当を自動で組みます）');
    expect(addPlanDone('月 10:00', false)).toBe('予定を入れました（月 10:00）');
  });
});

describe('addPlanError・addPlanFieldOf', () => {
  const TODAY = '2026-11-02';
  const form = { weekdays: [4], repeat: 'weekly' as const, monthWeeks: [], from: TODAY };
  const ok = { clientId: 'a', duration: 60, form, today: TODAY };
  const withForm = (f: Partial<typeof form> | { repeat: 'monthly'; monthWeeks: number[] }) => ({
    ...ok,
    form: { ...form, ...f },
  });
  it('よければ null。定期の曜日なしは曜日の欄、単発は曜日を見ない', () => {
    expect(addPlanError('recurring', ok, '利用者さん')).toBeNull();
    expect(addPlanError('recurring', withForm({ weekdays: [] }), '利用者さん')).toMatchObject({ field: 'weekdays' });
    expect(addPlanError('oneOff', withForm({ weekdays: [] }), 'お客様')).toBeNull();
  });
  it('毎月は第N を1つ以上（無ければ第N の欄）', () => {
    expect(addPlanError('recurring', withForm({ repeat: 'monthly', monthWeeks: [] }), 'x')).toEqual({
      text: '第何週かを1つ以上選んでください',
      field: 'monthWeeks',
    });
    expect(addPlanError('recurring', withForm({ repeat: 'monthly', monthWeeks: [3, 4] }), 'x')).toBeNull();
  });
  it('開始日は今日以降の日付（今日より前・空・ありえない日は開始日の欄）。単発は見ない', () => {
    expect(addPlanError('recurring', withForm({ from: '2026-12-01' }), 'x')).toBeNull();
    for (const from of ['2026-11-01', '', '2026-02-30'])
      expect(addPlanError('recurring', withForm({ from }), 'x')).toEqual({ text: FROM_ERROR, field: 'from' });
    expect(addPlanError('oneOff', withForm({ from: '2026-11-01' }), 'x')).toBeNull();
  });
  it('〈利用者さん〉未選択は呼び名つき。所要の誤りの文は定期・単発で同じ', () => {
    expect(addPlanError('oneOff', { ...ok, clientId: '' }, 'お客様')).toEqual({
      text: 'お客様を選んでください',
      field: 'client',
    });
    const a = addPlanError('recurring', { ...ok, duration: 0 }, 'x');
    const b = addPlanError('oneOff', { ...ok, duration: Number.NaN }, 'x');
    expect(a).toEqual(b);
    expect(a?.field).toBe('duration');
    expect(addPlanError('oneOff', { ...ok, duration: 721 }, 'x')?.field).toBe('duration');
  });
  it('今ある仕組みの文から欄を結ぶ（日付の誤りは定期なら開始日、単発なら日付）', () => {
    expect(addPlanFieldOf('開始（遅）は開始（早）以降にしてください', 'recurring')).toBe('start');
    expect(addPlanFieldOf('時刻を正しく入れてください', 'oneOff')).toBe('start');
    expect(addPlanFieldOf('日付を入れてください', 'oneOff')).toBe('date');
    expect(addPlanFieldOf('今日より前の日にはできません', 'oneOff')).toBe('date');
    expect(addPlanFieldOf('日付を正しく入れてください', 'recurring')).toBe('from');
    expect(addPlanFieldOf(FROM_ERROR, 'recurring')).toBe('from');
    expect(addPlanFieldOf('入力を確かめてください', 'recurring')).toBeUndefined();
  });
});

describe('addPlanSaveError', () => {
  it('データが変わっていた（stale）なら入れ直しの文、そうでなければ今ある仕組みの文', () => {
    expect(addPlanSaveError('日付を入れてください', true)).toBe(STALE_ERROR);
    expect(addPlanSaveError('日付を入れてください', false)).toBe('日付を入れてください');
  });
});
