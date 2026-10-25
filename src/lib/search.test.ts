import { describe, expect, it } from 'vitest';
import {
  chooseAllLabel,
  countAmong,
  defaultStaffOf,
  matchClient,
  normalizeKana,
  pickerBase,
  pickerEmptyText,
  pickerKeyAction,
  pushRecent,
  searchClients,
  staffClientMap,
} from './search';

describe('normalizeKana', () => {
  it('カタカナをひらがなに、全角半角・大文字小文字・空白をそろえる', () => {
    expect(normalizeKana('トショカン フミ')).toBe('としょかんふみ');
    expect(normalizeKana('ﾄｼｮｶﾝ　ﾌﾐ')).toBe('としょかんふみ');
    expect(normalizeKana('ＡＢＣ abc')).toBe('abcabc');
    expect(normalizeKana('ヴァ')).toBe('ゔぁ');
    expect(normalizeKana('メモリアル')).toBe('めもりある');
    expect(normalizeKana('ー')).toBe('ー');
    expect(normalizeKana('')).toBe('');
  });
  it('濁点つきの半角カナも1字にそろう', () => {
    expect(normalizeKana('ｶﾞｸ')).toBe('がく');
  });
});

describe('ハイフン類と長音', () => {
  it('ハイフン・全角マイナス・ダッシュは長音にそろう', () => {
    for (const ch of ['-', '－', '‐', '−', '–', '—']) expect(normalizeKana(`さとう${ch}`)).toBe('さとうー');
    expect(matchClient({ displayName: 'ケーキ店', kana: 'けーきてん' }, 'け-き')).toBe(true);
  });
});

describe('chooseAllLabel', () => {
  it('足す人数で「あと N人を選ぶ」', () => {
    expect(chooseAllLabel(3)).toBe('あと3人を選ぶ');
    expect(chooseAllLabel(1)).toBe('あと1人を選ぶ');
  });
});

describe('matchClient', () => {
  const c = { displayName: '図書館 ふみ', kana: 'としょかん ふみ' };
  it('表示名・よみの部分一致（ひらがな・カタカナ・半角を問わない）', () => {
    expect(matchClient(c, '図書')).toBe(true);
    expect(matchClient(c, 'としょ')).toBe(true);
    expect(matchClient(c, 'トショ')).toBe(true);
    expect(matchClient(c, 'ｼｮｶﾝ')).toBe(true);
    expect(matchClient(c, 'かんふ')).toBe(true);
    expect(matchClient(c, 'フミ')).toBe(true);
    expect(matchClient(c, 'やぎ')).toBe(false);
  });
  it('空の検索はすべて当たる', () => {
    expect(matchClient(c, '')).toBe(true);
    expect(matchClient(c, '　 ')).toBe(true);
  });
  it('よみが空でも表示名で当たる', () => {
    expect(matchClient({ displayName: 'メモリアル あかり', kana: '' }, 'めもり')).toBe(true);
    expect(matchClient({ displayName: '城跡', kana: '' }, 'しろ')).toBe(false);
  });
});

describe('searchClients', () => {
  const xs = [
    { displayName: '泉図書館 いずみ', kana: 'いずみとしょかん いずみ' },
    { displayName: '図書館 ふみ', kana: 'としょかん ふみ' },
    { displayName: '若林図書館 わかば', kana: 'わかばやしとしょかん わかば' },
  ];
  it('先頭から一致する人を前に、上限を超えた分は数だけ', () => {
    const r = searchClients(xs, 'としょ', 2);
    expect(r.list.map((x) => x.displayName)).toEqual(['図書館 ふみ', '泉図書館 いずみ']);
    expect(r.rest).toBe(1);
  });
  it('空の検索は渡した順のまま', () => {
    expect(searchClients(xs, '', 10).list).toEqual(xs);
  });
});

describe('staffClientMap', () => {
  it('案の担当といつもの担当を合わせる（未知の訪問は飛ばす）', () => {
    const m = staffClientMap(
      [
        ['s1', 'c1'],
        ['s1', 'c2'],
        ['s2', undefined],
        ['s1', 'c1'],
      ],
      [{ id: 'c3' }, { id: 'c4' }],
      new Map([['c3', 's2']]),
    );
    expect([...(m.get('s1') ?? [])]).toEqual(['c1', 'c2']);
    expect([...(m.get('s2') ?? [])]).toEqual(['c3']);
    expect(m.has('s3')).toBe(false);
  });
});

describe('defaultStaffOf（月間の「〈スタッフ〉が担当する人」で先頭の人が0人になる件）', () => {
  const staff = [{ id: 's8' }, { id: 's1' }, { id: 's2' }];
  it('先頭の人に担当する人がいなければ、担当する人がいる最初の人を選ぶ', () => {
    const n: Record<string, number> = { s8: 0, s1: 6, s2: 4 };
    expect(defaultStaffOf(staff, (id) => n[id] ?? 0)).toBe('s1');
  });
  it('だれも担当する人がいなければ先頭。〈スタッフ〉がいなければ空', () => {
    expect(defaultStaffOf(staff, () => 0)).toBe('s8');
    expect(defaultStaffOf([], () => 1)).toBe('');
  });
});

describe('countAmong', () => {
  it('候補にいる人だけ数える（休止中で候補にいない人は数えない）', () => {
    expect(countAmong(new Set(['c1', 'c2', 'c9']), [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }])).toBe(2);
  });
});

describe('pickerBase', () => {
  const clients = [{ id: 'a', tentative: false }, { id: 'b', tentative: true }, { id: 'c' }];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const src = { period: new Set(['a', 'c']), staffSet: new Set(['b']), recent: ['c', 'x', 'a'], byId };
  it('近道なしは全員', () => {
    expect(pickerBase(null, clients, src)).toEqual(clients);
  });
  it('期間・担当・最近・仮押さえで絞る', () => {
    expect(pickerBase('period', clients, src).map((c) => c.id)).toEqual(['a', 'c']);
    expect(pickerBase('staff', clients, src).map((c) => c.id)).toEqual(['b']);
    expect(pickerBase('recent', clients, src).map((c) => c.id)).toEqual(['c', 'a']);
    expect(pickerBase('tentative', clients, src).map((c) => c.id)).toEqual(['b']);
  });
  it('期間を渡さない・担当が無いときの扱い', () => {
    expect(pickerBase('period', clients, { ...src, period: undefined })).toEqual(clients);
    expect(pickerBase('staff', clients, { ...src, staffSet: null })).toEqual([]);
  });
});

describe('pickerEmptyText', () => {
  it('近道で絞って0人なら理由を返す', () => {
    expect(pickerEmptyText('', 'recent', {})).toBe('まだ選んだ人がいません');
    expect(pickerEmptyText('', 'staff', { staffName: '佐藤' })).toBe('佐藤さんが担当する人はいません');
    expect(pickerEmptyText('', 'period', { periodLabel: 'この週' })).toBe('この週に訪問がある人はいません');
  });
  it('文字を打っているとき・情報が無いときは「見つかりません」', () => {
    expect(pickerEmptyText('あ', 'recent', {})).toBe('見つかりません');
    expect(pickerEmptyText('', 'staff', {})).toBe('見つかりません');
    expect(pickerEmptyText('', null, {})).toBe('見つかりません');
  });
});

describe('pushRecent', () => {
  it('先頭に足し、重複は新しい方へ寄せ、上限で切る', () => {
    expect(pushRecent(['a', 'b'], ['c'], 10)).toEqual(['c', 'a', 'b']);
    expect(pushRecent(['a', 'b', 'c'], ['b'], 10)).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b'], ['c', 'd'], 3)).toEqual(['c', 'd', 'a']);
  });
});

describe('pickerKeyAction', () => {
  const st = { open: true, optionCount: 3, hasActive: true, hasQuery: false, multiple: false, hasSelected: false };
  const k = (key: string, state = st, composing = false) => pickerKeyAction({ key, composing }, state);
  it('変換中は何もしない', () => {
    expect(k('Enter', st, true)).toEqual({ type: 'none' });
  });
  it('↓↑：閉じていれば開く、候補が無ければ何もしない、あれば移る', () => {
    expect(k('ArrowDown', { ...st, open: false })).toEqual({ type: 'open', prevent: true });
    expect(k('ArrowUp', { ...st, optionCount: 0 })).toEqual({ type: 'none' });
    expect(k('ArrowDown')).toEqual({ type: 'move', step: 1, prevent: true });
    expect(k('ArrowUp')).toEqual({ type: 'move', step: -1, prevent: true });
  });
  it('Enter：開いていて指す候補があるときだけ選ぶ', () => {
    expect(k('Enter')).toEqual({ type: 'choose', prevent: true });
    expect(k('Enter', { ...st, open: false })).toEqual({ type: 'none' });
    expect(k('Enter', { ...st, hasActive: false })).toEqual({ type: 'none' });
  });
  it('Esc：開いていれば閉じ、閉じていて文字があれば消す', () => {
    expect(k('Escape')).toEqual({ type: 'close', prevent: true });
    expect(k('Escape', { ...st, open: false, hasQuery: true })).toEqual({ type: 'clearQuery', prevent: true });
    expect(k('Escape', { ...st, open: false })).toEqual({ type: 'none' });
  });
  it('Backspace：文字が空で複数のとき最後の人を外す（既定の動きは止めない）', () => {
    const multi = { ...st, multiple: true, hasSelected: true };
    expect(k('Backspace', multi)).toEqual({ type: 'unselectLast', prevent: false });
    expect(k('Backspace', { ...multi, hasQuery: true })).toEqual({ type: 'none' });
    expect(k('Backspace', st)).toEqual({ type: 'none' });
  });
});
