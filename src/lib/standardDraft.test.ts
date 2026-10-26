import { describe, expect, it } from 'vitest';
import { setStandardStep, standardStepOf, standardWork } from './standardDraft';

describe('standardStepOf（組み方の標準の段。ADR-0066）', () => {
  const draft = { table: {}, from: null };
  const registered = { since: '2026-11-02', at: 1 };
  it('選んだ段が無ければ、登録した直後は 3・下書きがあれば 2・無ければ 1', () => {
    expect(standardStepOf({ step: null, draft: null, registered: null })).toBe('proposals');
    expect(standardStepOf({ step: null, draft, registered: null })).toBe('draft');
    expect(standardStepOf({ step: null, draft: null, registered })).toBe('register');
  });
  it('選んだ段があればそれ', () => {
    expect(standardStepOf({ step: 'register', draft: null, registered: null })).toBe('register');
    expect(standardStepOf({ step: 'proposals', draft, registered })).toBe('proposals');
  });
  it('setStandardStep で入れ物の段を替える', () => {
    setStandardStep('draft');
    expect(standardWork.get().step).toBe('draft');
    setStandardStep('proposals');
    expect(standardStepOf(standardWork.get())).toBe('proposals');
  });
});
