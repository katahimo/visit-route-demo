import { describe, expect, it } from 'vitest';
import type { VisitDraft } from './visitOps';
import { keptText, savedText, startPatch, windowShown } from './visitPanelText';

const draft = (over: Partial<VisitDraft>): VisitDraft => ({
  clientId: 'c1',
  typeId: null,
  date: '2026-10-12',
  windowKind: 'window',
  earliestStart: '09:00',
  latestStart: '10:00',
  durationMinutes: 60,
  note: '',
  ...over,
});

describe('windowShown', () => {
  it('幅があれば「早〜遅 の間に開始」、決まっていれば開始だけ', () => {
    expect(windowShown({ windowKind: 'window', earliestStart: '09:00', latestStart: '10:00' })).toBe(
      '09:00〜10:00 の間に開始',
    );
    expect(windowShown({ windowKind: 'fixed', earliestStart: '09:00', latestStart: '09:00' })).toBe('09:00');
  });
});

describe('startPatch', () => {
  it('幅を保って最も遅い開始もずらす', () => {
    expect(startPatch(draft({}), '09:30')).toEqual({ earliestStart: '09:30', latestStart: '10:30' });
  });
  it('開始が決まっている回は最も遅い開始を開始にそろえる', () => {
    expect(startPatch(draft({ windowKind: 'fixed' }), '11:00')).toEqual({
      earliestStart: '11:00',
      latestStart: '11:00',
    });
  });
  it('23:59 で止める・時刻の形でなければ開始だけ', () => {
    expect(startPatch(draft({}), '23:30')).toEqual({ earliestStart: '23:30', latestStart: '23:59' });
    expect(startPatch(draft({}), '')).toEqual({ earliestStart: '' });
  });
});

describe('keptText', () => {
  it('無ければ空、5回以上は4回まで書いて「など」', () => {
    expect(keptText([])).toBe('');
    expect(keptText(['2026-10-12'])).toContain('1回（');
    expect(keptText(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'])).toContain(' など）');
  });
});

describe('savedText', () => {
  it('追加・保存と、割り当てられなかった回を書く', () => {
    expect(savedText(true, '10/12 09:00', '', [])).toBe('訪問を追加しました（10/12 09:00）');
    const t = savedText(false, '10/12 09:00', '・これ以降', [{ visitId: 'v', date: '2026-10-19', why: '休み' }]);
    expect(
      t.startsWith('訪問を保存しました（10/12 09:00・これ以降）。担当を割り当てられなかった回が 1件あります（'),
    ).toBe(true);
    expect(t.endsWith(' 休み）')).toBe(true);
  });
});
