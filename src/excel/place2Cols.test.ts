// 住所2 なしの書き方の判定（isNoPlace2Text）
import { describe, expect, it } from 'vitest';
import { isNoPlace2Text } from './place2Cols';

describe('isNoPlace2Text', () => {
  it('空・「なし」など・線1つは住所2 なし', () => {
    const none = [
      '',
      '  ',
      'なし',
      '無し',
      'ナシ',
      'ﾅｼ',
      '無',
      '特になし',
      '同上',
      'なし。',
      ' な し ',
      '-',
      'ー',
      '－',
      '―',
    ];
    for (const t of none) {
      expect(isNoPlace2Text(t), t).toBe(true);
    }
  });
  it('住所は住所2 なしにしない（「なし」を含む地名も）', () => {
    for (const t of ['架空市駅前2丁目', '高梨', 'なし町1-2', '梨木']) {
      expect(isNoPlace2Text(t), t).toBe(false);
    }
  });
});
