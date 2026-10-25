// 写した元：katahimo-dev/visit-route-poc @ a46e7db web/src/features/admin/schedule/model.test.ts

import { describe, expect, it } from 'vitest';
import type { Visit } from '../contracts/documents';
import { timesOf } from './scheduleModel';

const visit = (id: string, earliestStart: string, extra: Partial<Visit> = {}): Visit & { id: string } => ({
  id,
  date: '2026-10-12',
  clientId: `c-${id}`,
  windowKind: 'fixed',
  earliestStart,
  latestStart: earliestStart,
  durationMinutes: 60,
  staffId: null,
  start: null,
  pinned: false,
  cancelled: false,
  note: '',
  typeId: null,
  pattern: null,
  cancelKind: null,
  ...extra,
});
const mapOf = (vs: (Visit & { id: string })[]) => new Map(vs.map((v) => [v.id, v]));

describe('timesOf', () => {
  it('時間の固定された訪問が重なれば、両方を重なりにする', () => {
    const vs = [visit('a', '09:00', { durationMinutes: 90 }), visit('b', '10:00'), visit('c', '13:00')];
    const t = timesOf(['a', 'b', 'c'], mapOf(vs));
    expect(t.get('a')).toEqual({ start: 540, end: 630, overlap: true });
    expect(t.get('b')).toEqual({ start: 630, end: 690, overlap: true });
    expect(t.get('c')?.overlap).toBe(false);
  });
  it('開始に幅があり、前が終わってから始めて間に合うなら重なりではない', () => {
    const vs = [
      visit('a', '09:00', { durationMinutes: 90 }),
      visit('b', '10:00', { windowKind: 'window', latestStart: '11:00' }),
    ];
    const t = timesOf(['a', 'b'], mapOf(vs));
    expect(t.get('b')).toEqual({ start: 630, end: 690, overlap: false });
    expect(t.get('a')?.overlap).toBe(false);
  });
});

describe('timesOf：稼働時間帯に寄せる', () => {
  const slots = [
    { start: '10:00', end: '12:00' },
    { start: '14:00', end: '18:00' },
  ];
  it('幅のある訪問は、時間帯の中で入れる最も早い時刻に始める（時間外にしない）', () => {
    const late = visit('a', '09:00', { windowKind: 'window', latestStart: '11:00' });
    expect(timesOf(['a'], mapOf([late]), slots).get('a')).toMatchObject({ start: 600, end: 660 });
    const overLunch = visit('b', '11:30', { windowKind: 'window', latestStart: '14:30' });
    expect(timesOf(['b'], mapOf([overLunch]), slots).get('b')).toMatchObject({ start: 840, end: 900 });
  });
  it('幅の中で収まらなければ、そのままの時刻（時間外として知らせる）', () => {
    const fixed = visit('c', '09:00');
    expect(timesOf(['c'], mapOf([fixed]), slots).get('c')).toMatchObject({ start: 540, end: 600 });
  });
});
