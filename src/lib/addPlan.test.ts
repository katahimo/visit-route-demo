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
  STALE_ERROR,
  toggleWeekday,
} from './addPlan';
import { applyTemplate } from './features';

describe('addPlanKind（入れ方は繰り返しを使うかで決まる）', () => {
  it('定期（基本・すべて）は定期、単発のみは単発', () => {
    expect(addPlanKind(applyTemplate('basic'))).toBe('recurring');
    expect(addPlanKind(applyTemplate('all'))).toBe('recurring');
    expect(addPlanKind(applyTemplate('oneOff'))).toBe('oneOff');
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
  it('定期：開始日は初めの日・曜日は初めの日の曜日・10:00・60分・毎週・種類なし', () => {
    // 2026-11-05 は木曜
    const f = addPlanPatternForm('2026-11-05', '2026-10-30');
    expect(f).toMatchObject({
      id: null,
      weekdays: [4],
      from: '2026-11-05',
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

describe('toggleWeekday・addPlanDone', () => {
  it('曜日は入れる・外す。日曜はじまりの順', () => {
    expect(toggleWeekday([4], 1)).toEqual([1, 4]);
    expect(toggleWeekday([1, 4], 4)).toEqual([1]);
  });
  it('知らせ：自動で組む依頼を出したときだけ書く', () => {
    expect(addPlanDone('月 10:00', true)).toBe('予定を入れました（月 10:00・担当を自動で組みます）');
    expect(addPlanDone('月 10:00', false)).toBe('予定を入れました（月 10:00）');
  });
});

describe('addPlanError・addPlanFieldOf', () => {
  const ok = { clientId: 'a', weekdays: [4], duration: 60 };
  it('よければ null。定期の曜日なしは曜日の欄、単発は曜日を見ない', () => {
    expect(addPlanError('recurring', ok, '利用者さん')).toBeNull();
    expect(addPlanError('recurring', { ...ok, weekdays: [] }, '利用者さん')).toMatchObject({ field: 'weekdays' });
    expect(addPlanError('oneOff', { ...ok, weekdays: [] }, 'お客様')).toBeNull();
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
  it('今ある仕組みの文から欄を結ぶ', () => {
    expect(addPlanFieldOf('開始（遅）は開始（早）以降にしてください')).toBe('start');
    expect(addPlanFieldOf('時刻を正しく入れてください')).toBe('start');
    expect(addPlanFieldOf('日付を入れてください')).toBe('date');
    expect(addPlanFieldOf('今日より前の日にはできません')).toBe('date');
    expect(addPlanFieldOf('入力を確かめてください')).toBeUndefined();
  });
});

describe('addPlanSaveError', () => {
  it('データが変わっていた（stale）なら入れ直しの文、そうでなければ今ある仕組みの文', () => {
    expect(addPlanSaveError('日付を入れてください', true)).toBe(STALE_ERROR);
    expect(addPlanSaveError('日付を入れてください', false)).toBe('日付を入れてください');
  });
});
