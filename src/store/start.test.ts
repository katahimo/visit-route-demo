// デモを作った直後に担当なしを組むか（PRD D409。ADR-0079）
import { describe, expect, it } from 'vitest';
import { arrangesAfterStart } from './start';

describe('arrangesAfterStart', () => {
  it('「デモで試す」で始めたとき・初期状態に戻したときは組む', () => {
    expect(arrangesAfterStart({ kind: 'answer', start: 'demo' }, false)).toBe(true);
    expect(arrangesAfterStart({ kind: 'reset' }, false)).toBe(true);
  });
  it('「自分のデータで始める」は組まない', () => {
    expect(arrangesAfterStart({ kind: 'answer', start: 'own' }, false)).toBe(false);
  });
  it('印「all」があれば組まない', () => {
    expect(arrangesAfterStart({ kind: 'answer', start: 'demo' }, true)).toBe(false);
    expect(arrangesAfterStart({ kind: 'reset' }, true)).toBe(false);
  });
});
