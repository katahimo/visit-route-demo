import { describe, expect, it } from 'vitest';
import { applyTemplate } from './features';
import {
  startGuideCount,
  startGuideHref,
  startGuideIndex,
  startGuideNeighbors,
  startGuidePlanPath,
  startGuideSteps,
} from './startGuide';

const terms = { client: '利用者さん', staff: 'スタッフ' };

describe('startGuideSteps（PRD D381：3段の登録の案内）', () => {
  it('①〈利用者さん〉②〈スタッフ〉③予定（呼び名は terms から引く）', () => {
    const s = startGuideSteps(terms);
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.title)).toEqual(['① 利用者さんを入れる', '② スタッフを入れる', '③ 予定を入れる']);
    expect(startGuideSteps({ client: 'お客様', staff: 'シッター' })[0]?.title).toBe('① お客様を入れる');
  });

  it('①②は名簿の読み込みと1人ずつの追加の行き先を持ち、③は予定の段', () => {
    const [a, b, c] = startGuideSteps(terms);
    expect(a).toMatchObject({ kind: 'roster', person: 'client', addTo: '/clients/new' });
    expect(b).toMatchObject({ kind: 'roster', person: 'staff', addTo: '/staff/new' });
    expect(c?.kind).toBe('plan');
  });
});

describe('段の番号・「1/3」・前後・行き先', () => {
  it('番号は 1〜3（読めない値は 1）', () => {
    expect([null, '1', '2', '3', '4', 'x'].map(startGuideIndex)).toEqual([1, 1, 2, 3, 1, 1]);
  });
  it('「1/3」', () => {
    expect([1, 2, 3].map(startGuideCount)).toEqual(['1/3', '2/3', '3/3']);
  });
  it('前・次', () => {
    expect(startGuideNeighbors(1)).toEqual({ prev: null, next: 2 });
    expect(startGuideNeighbors(2)).toEqual({ prev: 1, next: 3 });
    expect(startGuideNeighbors(3)).toEqual({ prev: 2, next: null });
  });
  it('パス', () => {
    expect(startGuideHref(1)).toBe('/start');
    expect(startGuideHref(3)).toBe('/start?step=3');
  });
});

describe('startGuidePlanPath（③の行き先）', () => {
  it('繰り返しを使う（定期）なら月、使わない（単発）なら週', () => {
    expect(startGuidePlanPath(applyTemplate('basic'))).toBe('/month');
    expect(startGuidePlanPath(applyTemplate('oneOff'))).toBe('/week');
    expect(startGuidePlanPath({})).toBe('/month');
  });
});
