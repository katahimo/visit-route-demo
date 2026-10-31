import { describe, expect, it } from 'vitest';
import { dayHeading, monthHeading, weekHeading } from './detailsHeading';

describe('monthHeading（月の「詳しく」の見出し）', () => {
  it('担当と確定の日数を出す。確定の段階が無ければ担当だけ', () => {
    expect(monthHeading({ days: 27, planned: 3, confirmed: 1 }, true)).toBe('担当 3/27日・確定 1/27日');
    expect(monthHeading({ days: 27, planned: 3, confirmed: 1 }, false)).toBe('担当 3/27日');
  });
  it('今日以降に訪問のある日が無ければ空', () => {
    expect(monthHeading({ days: 0, planned: 0, confirmed: 0 }, true)).toBe('');
  });
});

describe('weekHeading（週の「詳しく」の見出し）', () => {
  it('未確定（まだ伝えていない＋未連絡の変更）と要対応', () => {
    expect(weekHeading(5, { changed: 1, notYet: 4, care: 2 }, true)).toBe('未確定 5日・要対応 2件');
    expect(weekHeading(5, { changed: 0, notYet: 0, care: 0 }, true)).toBe('未確定 0日');
  });
  it('確定の段階が無ければ変更ありの日と要対応だけ', () => {
    expect(weekHeading(5, { changed: 2, notYet: 3, care: 0 }, false)).toBe('変更あり 2日');
    expect(weekHeading(5, { changed: 0, notYet: 3, care: 0 }, false)).toBe('');
  });
  it('今日以降に訪問が無ければ空', () => {
    expect(weekHeading(0, { changed: 0, notYet: 0, care: 0 }, true)).toBe('');
  });
});

describe('dayHeading（日の「詳しく」の見出し）', () => {
  it('点数・移動を出し、入らない・守れない条件は 0 なら出さない', () => {
    expect(dayHeading({ hundred: 85, travelMinutes: 120.4, dropped: 0, hard: 0 })).toBe('点数 85・移動 120分');
    expect(dayHeading({ hundred: 60, travelMinutes: 30, dropped: 2, hard: 1 })).toBe(
      '点数 60・移動 30分・入らない 2・守れない条件 1',
    );
  });
  it('点数の物差しが無ければ点数は出さない', () => {
    expect(dayHeading({ hundred: null, travelMinutes: 0, dropped: 0, hard: 0 })).toBe('移動 0分');
  });
});
