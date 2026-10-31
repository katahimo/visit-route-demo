import { describe, expect, it } from 'vitest';
import { applyTemplate, withFeature } from './features';
import { peopleMatch, peopleSideOf, peopleTabs, peopleTabsLabel, rememberedSide } from './peopleTabs';

const basic = applyTemplate('basic');

describe('peopleTabs', () => {
  it('〈スタッフ〉は 一覧・勤務・相性、〈利用者さん〉は 一覧・相性', () => {
    expect(peopleTabs('staff', basic).map((t) => [t.label, t.to])).toEqual([
      ['一覧', '/staff'],
      ['勤務', '/availability'],
      ['相性', '/compat'],
    ]);
    expect(peopleTabs('clients', basic).map((t) => [t.label, t.to])).toEqual([
      ['一覧', '/clients'],
      ['相性', '/compat'],
    ]);
  });
  it('勤務のタブは勤務時間（シフト）と勤務の見込みの2画面に印が付く', () => {
    expect(peopleTabs('staff', basic).find((t) => t.label === '勤務')?.match).toEqual(['/availability', '/workload']);
  });
  it('切った機能の画面へのタブは出さない', () => {
    const off = withFeature(basic, 'compat', false);
    expect(peopleTabs('clients', off).map((t) => t.label)).toEqual(['一覧']);
    expect(peopleTabs('staff', off).some((t) => t.to === '/compat')).toBe(false);
  });
  it('タブのナビの名前は呼び名から', () => {
    expect(peopleTabsLabel('staff', { client: '利用者さん', staff: 'スタッフ' })).toBe('スタッフの画面の切り替え');
    expect(peopleTabsLabel('clients', { client: 'お客様', staff: 'シッター' })).toBe('お客様の画面の切り替え');
  });
});

describe('どちらの側か', () => {
  it('専用の画面はその側。相性は覚えた側（無ければ〈利用者さん〉）。ほかの画面は無し', () => {
    expect(peopleSideOf('/clients', 'staff')).toBe('clients');
    expect(peopleSideOf('/availability', undefined)).toBe('staff');
    expect(peopleSideOf('/workload', undefined)).toBe('staff');
    expect(peopleSideOf('/compat', 'staff')).toBe('staff');
    expect(peopleSideOf('/compat', undefined)).toBe('clients');
    expect(peopleSideOf('/basics', 'staff')).toBeNull();
    expect(peopleSideOf('/month', 'staff')).toBeNull();
  });
  it('覚えるのは専用の画面だけ（相性・ほかの画面では変えない）', () => {
    expect(rememberedSide('/staff', undefined)).toBe('staff');
    expect(rememberedSide('/clients', 'staff')).toBe('clients');
    expect(rememberedSide('/compat', 'staff')).toBe('staff');
    expect(rememberedSide('/month', 'staff')).toBe('staff');
  });
  it('メニューの印：相性は覚えた側の1つにだけ付く', () => {
    expect(peopleMatch('clients', undefined, true)).toEqual(['/clients', '/basics', '/compat']);
    expect(peopleMatch('staff', undefined, true)).toEqual(['/staff', '/availability', '/workload']);
    expect(peopleMatch('staff', 'staff', true)).toEqual(['/staff', '/availability', '/workload', '/compat']);
    expect(peopleMatch('clients', 'staff', true)).toEqual(['/clients', '/basics']);
    // 入は予定と相性を「組む」の基本情報に付けるので〈利用者さん〉に含めない
    expect(peopleMatch('clients', undefined, false)).toEqual(['/clients', '/compat']);
  });
});
