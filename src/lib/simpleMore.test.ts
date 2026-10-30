import { describe, expect, it } from 'vitest';
import { simpleMoreKinds } from './simpleMore';

describe('simpleMoreKinds（予定の「その他 ▾」に足す項目。PRD D383）', () => {
  it('エキスパート機能が入（{} も）なら足さない', () => {
    expect(simpleMoreKinds({}, 5)).toEqual([]);
    expect(simpleMoreKinds({ expert: true }, 5)).toEqual([]);
  });
  it('切なら 担当なしの訪問を組む → 空き状況 の順', () => {
    expect(simpleMoreKinds({ expert: false }, 3)).toEqual(['auto-arrange', 'vacancy']);
  });
  it('担当なしが0件なら「組む」は出さない', () => {
    expect(simpleMoreKinds({ expert: false }, 0)).toEqual(['vacancy']);
  });
  it('空き状況を切ると出さない', () => {
    expect(simpleMoreKinds({ expert: false, vacancy: false }, 2)).toEqual(['auto-arrange']);
    expect(simpleMoreKinds({ expert: false, vacancy: false }, 0)).toEqual([]);
  });
});
