import { describe, expect, it } from 'vitest';
import type { VisitType } from '../contracts/documents';
import type { Band, WeekDay } from './week';
import {
  allowedStaffText,
  clientItemText,
  clockSpan,
  dayHeadOf,
  diffText,
  initialOf,
  itemStateText,
  pressText,
  selectionOf,
  staffCellBands,
  staffCellTexts,
  timelineBandFilter,
  timelineClientMaxText,
  timelineNoneText,
  visitAriaLabel,
  visitDaysOf,
  visitTitle,
  weekOptionsOf,
} from './weekScreen';

const band = (x: Partial<Band> & { visitId: string }): Band => ({
  date: '2026-10-20',
  staffId: 's1',
  start: 540,
  end: 600,
  source: 'plan',
  ...x,
});
const day = (date: string, bands: Band[]): WeekDay => ({ date, problem: null, bands }) as unknown as WeekDay;
const terms = { staff: 'スタッフ', client: '利用者さん' };

describe('selectionOf（URL の選んだ人）', () => {
  it('無ければ全員（null）・空なら []・空の要素は外す', () => {
    expect(selectionOf(null)).toBeNull();
    expect(selectionOf('')).toEqual([]);
    expect(selectionOf('s1,,s2')).toEqual(['s1', 's2']);
  });
});

describe('文の小さな関数', () => {
  it('頭文字・時刻の範囲・平均との差・上限の文', () => {
    expect(initialOf(' 山田 花子')).toBe('山');
    expect(initialOf('')).toBe('？');
    expect(clockSpan(540, 600)).toBe('9:00〜10:00');
    expect(diffText(2)).toBe('+2件');
    expect(diffText(-1)).toBe('−1件');
    expect(diffText(0)).toBe('±0件');
    expect(timelineClientMaxText('利用者さん')).toBe(
      '時間軸は8人まで。表（利用者さん×曜日）なら絞り込んだ全員を見られます',
    );
  });
  it('訪問の状態の文', () => {
    expect(itemStateText({ cancelled: true, sameDay: true })).toBe('当日キャンセル');
    expect(itemStateText({ cancelled: true })).toBe('取り消し');
    expect(itemStateText({ leave: true })).toBe('休みのため無し');
    expect(itemStateText({})).toBeNull();
  });
  it('帯・札の読み上げと title', () => {
    expect(pressText(false)).toBe('（押すと訪問の詳細）');
    expect(visitAriaLabel(540, '山田さん', '要対応', true)).toBe('9:00 山田さん・要対応（選択中）（押すと訪問の詳細）');
    expect(visitAriaLabel(540, 'A・B', undefined, false)).toBe('9:00 A・B（押すと訪問の詳細）');
    expect(visitTitle(540, 600, '山田', '要対応')).toBe('9:00〜10:00 山田（要対応）');
    expect(visitTitle(540, 600, '山田', undefined)).toBe('9:00〜10:00 山田');
    expect(clientItemText({ start: 540, end: 600 }, '身体', '佐藤', '代')).toBe('9:00〜10:00 身体・佐藤・代');
    expect(clientItemText({ start: 540, end: 600 }, undefined, 'なし', undefined)).toBe('9:00〜10:00 なし');
  });
});

describe('weekOptionsOf（週を選ぶ欄。PRD D347）', () => {
  it('データの日付と今の週の月曜を重ねずに日付の順で', () => {
    const r = weekOptionsOf(['2026-10-21', '2026-10-22', '2026-10-28'], '2026-10-12');
    expect(r.map((o) => o.value)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
    expect(r[1]!.text).toBe('10/19（月）〜10/25（日）');
  });
});

describe('dayHeadOf・visitDaysOf（日の見出しの件数・空の画面）', () => {
  it('休みの帯を除いて数え、担当なしを足す', () => {
    const d = day('2026-10-20', [
      band({ visitId: 'v1' }),
      band({ visitId: 'v2', staffId: null }),
      band({ visitId: 'v3', staffId: null, leave: true }),
    ]);
    expect(dayHeadOf(d)).toEqual({ unassigned: 1, countText: '2件・担当なし1' });
    expect(visitDaysOf([d, day('2026-10-21', [band({ visitId: 'v4', leave: true })])])).toEqual(['2026-10-20']);
  });
});

describe('timelineBandFilter（時間軸に出す帯）', () => {
  const clientOf = (id: string) => ({ v1: 'c1', v2: 'c2' })[id];
  it('〈スタッフ〉：全員なら担当なしも、選んだら選んだ人だけ', () => {
    const all = timelineBandFilter({ by: 'staff', staffSel: null, clientIds: [], clientOf });
    expect(all(band({ visitId: 'v1', staffId: null }))).toBe(true);
    const some = timelineBandFilter({ by: 'staff', staffSel: ['s2'], clientIds: [], clientOf });
    expect(some(band({ visitId: 'v1', staffId: 's2' }))).toBe(true);
    expect(some(band({ visitId: 'v1', staffId: 's1' }))).toBe(false);
    expect(some(band({ visitId: 'v1', staffId: null }))).toBe(false);
  });
  it('〈利用者さん〉：選んだ人の訪問の帯だけ', () => {
    const f = timelineBandFilter({ by: 'client', staffSel: null, clientIds: ['c1'], clientOf });
    expect(f(band({ visitId: 'v1' }))).toBe(true);
    expect(f(band({ visitId: 'v2' }))).toBe(false);
    expect(f(band({ visitId: 'v9' }))).toBe(false);
  });
});

describe('timelineNoneText（だれも選んでいないときの文）', () => {
  const base = { by: 'client' as const, staffSel: null, picked: 0, shown: 0, weekChips: 3 };
  it('〈利用者さん〉', () => {
    expect(timelineNoneText({ ...base, shown: 1, picked: 1 }, terms)).toBeNull();
    expect(timelineNoneText(base, terms)).toMatch(/^利用者さんを選んでいません/);
    expect(timelineNoneText({ ...base, weekChips: 0 }, terms)).toMatch(/^この週に訪問がある利用者さんはいません/);
  });
  it('〈スタッフ〉', () => {
    expect(timelineNoneText({ ...base, by: 'staff' }, terms)).toBeNull();
    expect(timelineNoneText({ ...base, by: 'staff', staffSel: ['s1'] }, terms)).toBeNull();
    expect(timelineNoneText({ ...base, by: 'staff', staffSel: [] }, terms)).toBe(
      'スタッフをだれも選んでいません。上のチップで選ぶか「全員」を押してください。',
    );
  });
});

describe('allowedStaffText（ドラッグ中の担当できる人）', () => {
  const staff = [
    { id: 's1', name: '佐藤' },
    { id: 's2', name: '鈴木' },
  ];
  it('ドラッグしていない・いない・いる', () => {
    expect(allowedStaffText(null, staff, 'スタッフ')).toBe('ドラッグ中は、ここに担当できるスタッフを出します');
    expect(allowedStaffText(new Set(), staff, 'スタッフ')).toBe('担当できるスタッフ：いません');
    expect(allowedStaffText(new Set(['s2', 's1']), staff, 'スタッフ')).toBe('担当できるスタッフ：佐藤・鈴木');
  });
});

describe('staffCellBands（〈スタッフ〉×曜日の表のマスの訪問）', () => {
  it('担当・日ごとに時刻の順。休み・担当なしは除く', () => {
    const m = staffCellBands([
      day('2026-10-20', [
        band({ visitId: 'v2', start: 600 }),
        band({ visitId: 'v1', start: 540 }),
        band({ visitId: 'v3', staffId: null }),
        band({ visitId: 'v4', leave: true }),
      ]),
    ]);
    expect([...m.keys()]).toEqual(['s1|2026-10-20']);
    expect(m.get('s1|2026-10-20')!.map((b) => b.visitId)).toEqual(['v1', 'v2']);
  });
});

describe('staffCellTexts（表のマスの文。PRD D76）', () => {
  const types = [{ id: 't1', name: '身体' }] as VisitType[];
  const cell = { off: false, count: 3, hours: 6, travel: 40, types: [{ typeId: 't1', count: 2 }] };
  it('内訳と休み', () => {
    expect(staffCellTexts(cell, types).detail).toBe('訪問 3件・稼働 6時間・移動 40分・身体 2件');
    expect(staffCellTexts({ ...cell, types: [{ typeId: 'x', count: 1 }] }, types).detail).toBe(
      '訪問 3件・稼働 6時間・移動 40分・種類なし 1件',
    );
    expect(staffCellTexts({ ...cell, off: true }, types)).toEqual({
      offText: '休み（訪問 3件）',
      detail: '休み（訪問 3件）',
    });
    expect(staffCellTexts({ ...cell, off: true, count: 0 }, types).offText).toBe('休み');
  });
});
