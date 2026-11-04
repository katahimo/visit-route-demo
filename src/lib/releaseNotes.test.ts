import { describe, expect, it } from 'vitest';
import { compareRelease, LATEST_RELEASE, notesSince, RELEASE_NOTES, type ReleaseNote } from './releaseNotes';

const notes: ReleaseNote[] = [
  { id: '2026-12-01', items: ['c'] },
  { id: '2026-11-10-2', items: ['b2'] },
  { id: '2026-11-10', items: ['b'] },
  { id: '2026-11-04', items: ['a'] },
];

describe('notesSince（PRD D437：まだ見ていない更新）', () => {
  it('前に見た更新より新しいものを新しい順に返す（同じ日の2回目も新しい）', () => {
    expect(notesSince('2026-11-04', notes).map((n) => n.id)).toEqual(['2026-12-01', '2026-11-10-2', '2026-11-10']);
    expect(notesSince('2026-11-10', notes).map((n) => n.id)).toEqual(['2026-12-01', '2026-11-10-2']);
  });
  it('今の版を見ていれば空（別のタブで先に新しい版を開いた＝もっと新しい id でも空）', () => {
    expect(notesSince('2026-12-01', notes)).toEqual([]);
    expect(notesSince('2027-01-01', notes)).toEqual([]);
  });
  it('印が無い（印の前から使っている人）なら先頭の1件だけ', () => {
    expect(notesSince(null, notes).map((n) => n.id)).toEqual(['2026-12-01']);
  });
});

describe('compareRelease（id の新旧）', () => {
  it('日付で比べ、同じ日は番号で比べる（-10 は -2 より新しい。番号なしは1回目）', () => {
    expect(compareRelease('2026-11-10-10', '2026-11-10-2')).toBeGreaterThan(0);
    expect(compareRelease('2026-11-10-2', '2026-11-10')).toBeGreaterThan(0);
    expect(compareRelease('2026-11-10', '2026-11-10')).toBe(0);
    expect(compareRelease('2026-11-09-9', '2026-11-10')).toBeLessThan(0);
  });
  it('同じ日の10回目も、まだ見ていない更新に入る', () => {
    const n = [{ id: '2026-11-10-10', items: ['x'] }, ...notes.slice(1)];
    expect(notesSince('2026-11-10-2', n).map((x) => x.id)).toEqual(['2026-11-10-10']);
  });
});

describe('RELEASE_NOTES', () => {
  it('新しい順で id は重ならず、日付の形。今の版は先頭', () => {
    const ids = RELEASE_NOTES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => compareRelease(b, a))).toEqual(ids);
    for (const id of ids) expect(id).toMatch(/^\d{4}-\d{2}-\d{2}(-\d+)?$/);
    expect(LATEST_RELEASE).toBe(ids[0]);
    for (const n of RELEASE_NOTES) expect(n.items.length).toBeGreaterThan(0);
  });
});
