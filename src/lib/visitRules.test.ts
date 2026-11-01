// 訪問先の決まりごと（PRD D66）の項目と行
import { describe, expect, it } from 'vitest';
import { client } from '../matching/fixtures.testkit';
import { hasVisitRules, VISIT_RULES, visitRuleLines } from './visitRules';

describe('lib/visitRules', () => {
  it('項目は D66 の並び（入り方・鍵・駐車場・注意）', () => {
    expect(VISIT_RULES.map((r) => r.label)).toEqual(['入り方', '鍵', '駐車場', '注意']);
  });

  it('決まりごとの行は入っている項目だけを D66 の並びで、改行は空白に。鍵は includeKeys のときだけ', () => {
    const c = client('c1', 38.26, 140.87, {
      entryNote: '',
      keyNote: 'ポストの\nキーボックス',
      parkingNote: '  ',
      cautionNote: '段差',
    });
    expect(visitRuleLines(c)).toEqual([
      { label: '鍵', text: 'ポストの キーボックス' },
      { label: '注意', text: '段差' },
    ]);
    expect(visitRuleLines(c, false)).toEqual([{ label: '注意', text: '段差' }]);
    expect(visitRuleLines(null)).toEqual([]);
  });

  it('決まりごとがあるか（空白だけは無いとみなす）', () => {
    expect(hasVisitRules(client('c1', 38.26, 140.87, { cautionNote: '段差' }))).toBe(true);
    expect(hasVisitRules(client('c1', 38.26, 140.87, { parkingNote: ' ' }))).toBe(false);
    expect(hasVisitRules(null)).toBe(false);
  });
});
