import { describe, expect, it } from 'vitest';
import { demoDataSchema } from '../contracts/data';
import { DEFAULT_TERMS } from '../domain/terms';
import { createBlankData, ONE_OFF_VISIT_TYPES, OWN_ORG_NAME, REGULAR_VISIT_TYPES } from './blank';

const TODAY = '2026-10-30';

describe('createBlankData（PRD D381。空のデータ）', () => {
  it('人・訪問・繰り返しは無く、訪問の種類と呼び名だけ決まっていて、契約を通る', () => {
    const d = createBlankData(
      TODAY,
      { industry: 'sitter', terms: DEFAULT_TERMS.sitter, features: { expert: false } },
      ONE_OFF_VISIT_TYPES,
    );
    expect(() => demoDataSchema.parse(d)).not.toThrow();
    expect(d.staff).toEqual([]);
    expect(d.clients).toEqual([]);
    expect(d.visits).toEqual([]);
    expect(d.patterns).toEqual([]);
    expect(d.org.name).toBe(OWN_ORG_NAME);
    expect(d.org.terms).toEqual({ client: 'お客様', staff: 'シッター' });
    expect(d.org.features).toEqual({ expert: false });
    expect(d.visitTypes.map((t) => t.id)).toEqual(['oneoff']);
    expect(d.baseDate).toBe(TODAY);
  });

  it('定期の訪問の種類は今の初期データと同じ（介護・リハビリ）。元の定数を書き換えない', () => {
    const d = createBlankData(
      TODAY,
      { industry: 'nursing', terms: DEFAULT_TERMS.nursing, features: {} },
      REGULAR_VISIT_TYPES,
    );
    expect(d.visitTypes.map((t) => t.name)).toEqual(['介護', 'リハビリ']);
    d.visitTypes[0]!.requirements.length = 0;
    expect(REGULAR_VISIT_TYPES[0]!.requirements.length).toBeGreaterThan(0);
  });
});
