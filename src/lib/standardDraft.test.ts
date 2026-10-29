import { afterEach, describe, expect, it } from 'vitest';
import { clearStandardWork, setDraft, setStandardStep, standardStepOf, standardWork } from './standardDraft';

describe('standardStepOf（組み方の標準の段。ADR-0066・ADR-0067）', () => {
  const initial = standardWork.get();
  afterEach(() => standardWork.set(() => initial));
  const draft = { table: {}, from: null };
  const registered = { since: '2026-11-02', at: 1 };
  it('選んだ段が無ければ、登録した直後は 3・下書きがあれば 2・無ければ 1', () => {
    expect(standardStepOf({ step: null, draft: null, registered: null })).toBe('proposals');
    expect(standardStepOf({ step: null, draft, registered: null })).toBe('register');
    expect(standardStepOf({ step: null, draft: null, registered })).toBe('register');
  });
  it('選んだ段があればそれ', () => {
    expect(standardStepOf({ step: 'register', draft: null, registered: null })).toBe('register');
    expect(standardStepOf({ step: 'proposals', draft, registered })).toBe('proposals');
  });
  it('setStandardStep で入れ物の段を替える', () => {
    setStandardStep('register');
    expect(standardWork.get().step).toBe('register');
    setStandardStep('proposals');
    expect(standardStepOf(standardWork.get())).toBe('proposals');
  });
});

describe('clearStandardWork（データを丸ごと差し替えたとき）', () => {
  const initial = standardWork.get();
  afterEach(() => standardWork.set(() => initial));
  it('前のデータの下書き・段・完了の表示・案を捨てる（初期状態に戻したあとに古い下書きで違う所0にしない）', () => {
    setDraft({ table: { p1: { 1: { staffId: 's1', start: '09:00' } } }, from: 'balance' }, 'old-key');
    standardWork.set((w) => ({
      ...w,
      step: 'register',
      registered: { since: '2026-11-02', at: 1 },
      proposalsOf: { period: { from: '2026-11-02', to: '2026-11-08', weeks: 1 }, key: 'old-key' },
    }));
    clearStandardWork();
    const w = standardWork.get();
    expect(w.draft).toBeNull();
    expect(w.draftKey).toBeNull();
    expect(w.registered).toBeNull();
    expect(w.proposals).toEqual([]);
    expect(w.proposalsOf).toBeNull();
    expect(standardStepOf(w)).toBe('proposals');
  });
});
