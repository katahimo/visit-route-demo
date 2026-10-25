// 考え方ごとの案の帯の表示の純粋関数（PRD D357。ADR-0064）
import { describe, expect, it } from 'vitest';
import { adoptBody, changeNote, diffSign, pointText } from './choiceBandView';
import type { ProposalChange } from './monthBatch';

const change = (over: Partial<ProposalChange>): ProposalChange => ({
  visitId: 'v1',
  clientId: 'c1',
  at: 9 * 60 + 30,
  kind: 'staff',
  from: 's1',
  to: 's2',
  minutes: 0,
  ...over,
});

describe('choiceBandView', () => {
  it('pointText：採点できなければ —', () => {
    expect(pointText(null)).toBe('—');
    expect(pointText(82)).toBe('82点');
  });

  it('diffSign：正は＋・負は−・0 は±', () => {
    expect([diffSign(3), diffSign(-3), diffSign(0)]).toEqual(['+', '−', '±']);
  });

  it('changeNote：担当が変わる・時刻だけ変わる・変わらない', () => {
    const name = (id: string | null) => (id === null ? '担当なし' : `${id}さん`);
    expect(changeNote(change({ kind: 'staff', from: 's1' }), name)).toBe('担当が変わる（今：s1さん）');
    expect(changeNote(change({ kind: 'staff', from: null }), name)).toBe('担当が変わる（今：担当なし）');
    expect(changeNote(change({ kind: 'time', minutes: 30 }), name)).toBe('時刻が変わる（今：09:00）');
    expect(changeNote(undefined, name)).toBeUndefined();
  });

  it('adoptBody：違う所があるかで2行目が変わる', () => {
    const pv = (diff: number) => ({ weekday: 5, since: '2026-10-26', diff: Array(diff).fill({}) }) as never;
    const a = adoptBody({ name: '移動を短く' }, pv(2), '2026-10-23');
    expect(a.weekdayLabel).toBe('金');
    expect(a.body).toContain('今と違う所 2か所');
    expect(a.body).toContain('「移動を短く」の考え方で組みます');
    expect(adoptBody({ name: 'x' }, pv(0), '2026-10-23').body).toContain('今のままです（この案と同じ）');
  });
});
