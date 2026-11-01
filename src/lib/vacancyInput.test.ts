import { describe, expect, it } from 'vitest';
import type { WishBand } from './vacancyBands';
import { defaultVacancyInput, loadVacancyInput, saveVacancyInput, VACANCY_INPUT_KEY } from './vacancyInput';

const TODAY = '2026-10-21';

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    raw: m,
  };
}

describe('空き状況の入力を覚える（PRD D258）', () => {
  it('無ければ既定（開始日は今日）', () => {
    const s = memory();
    expect(loadVacancyInput(TODAY, null, s)).toEqual(defaultVacancyInput(TODAY));
    expect(loadVacancyInput(TODAY, null, null)).toEqual(defaultVacancyInput(TODAY));
  });

  it('覚えた入力を読み直す（往復）', () => {
    const s = memory();
    const v = {
      ...defaultVacancyInput(TODAY),
      typeId: 'vt-1',
      duration: '90',
      requirements: [{ itemId: 'gender', op: 'is' as const, value: 'female' }],
      place: { address: '仙台市', lat: 38.26, lng: 140.87, postalCode: '980-0811', pinnedAddress: '仙台市' },
      weeks: 2,
      from: '2026-10-25',
      wishDays: [2, 4],
      wishFrom: '10:00',
      wishTo: '12:00',
      wishBands: ['am', 'eve'] as WishBand[],
      perWeek: 2,
      noticePeriod: 'fourWeeks' as const,
      noticeTypeId: 'vt-2',
    };
    saveVacancyInput(v, s);
    expect(s.raw.has(VACANCY_INPUT_KEY)).toBe(true);
    const back = loadVacancyInput(TODAY, null, s);
    expect(back.requirements).toEqual(v.requirements);
    expect(back.typeId).toBe('vt-1');
    expect(back.place).toEqual(v.place);
    expect(back.wishDays).toEqual([2, 4]);
    expect(back.wishBands).toEqual(['am', 'eve']);
    expect(back.noticePeriod).toBe('fourWeeks');
    expect(back.from).toBe('2026-10-25');
    // 消えた種類は捨てる
    const gone = loadVacancyInput(TODAY, new Set(['vt-2']), s);
    expect(gone.typeId).toBe('');
    expect(gone.noticeTypeId).toBe('vt-2');
  });

  it('読めない項目だけ既定にする・壊れた文字は既定・開始日が今日より前なら今日', () => {
    const s = memory();
    s.setItem(VACANCY_INPUT_KEY, JSON.stringify({ duration: '45', weeks: 99, wishFrom: '25:00', from: '2026-10-01' }));
    const v = loadVacancyInput(TODAY, null, s);
    expect(v.duration).toBe('45');
    expect(v.weeks).toBe(defaultVacancyInput(TODAY).weeks);
    expect(v.wishFrom).toBe('08:00');
    expect(v.from).toBe(TODAY);
    s.setItem(VACANCY_INPUT_KEY, '{壊れた');
    expect(loadVacancyInput(TODAY, null, s)).toEqual(defaultVacancyInput(TODAY));
  });

  it('既定の開始の幅は時間帯のチップの全体（8:00〜、所要 60分を足して 20:00 に収まる 19:00 開始まで。PRD D411）', () => {
    const d = defaultVacancyInput(TODAY);
    expect([d.duration, d.wishFrom, d.wishTo]).toEqual(['60', '08:00', '19:00']);
  });

  it('前の既定（9:00〜17:00）で覚えた開始の幅はそのまま読む', () => {
    const s = memory();
    s.setItem(VACANCY_INPUT_KEY, JSON.stringify({ ...defaultVacancyInput(TODAY), wishFrom: '09:00', wishTo: '17:00' }));
    const v = loadVacancyInput(TODAY, null, s);
    expect([v.wishFrom, v.wishTo]).toEqual(['09:00', '17:00']);
  });

  it('時間帯のチップを足す前の入力も読める（時間帯は指定なし）・知らない時間帯は既定', () => {
    const s = memory();
    const { wishBands: _, ...old } = { ...defaultVacancyInput(TODAY), duration: '90', wishFrom: '10:00' };
    s.setItem(VACANCY_INPUT_KEY, JSON.stringify(old));
    const v = loadVacancyInput(TODAY, null, s);
    expect(v.wishBands).toEqual([]);
    expect(v.duration).toBe('90');
    expect(v.wishFrom).toBe('10:00');
    s.setItem(VACANCY_INPUT_KEY, JSON.stringify({ ...old, wishBands: ['night'] }));
    expect(loadVacancyInput(TODAY, null, s).wishBands).toEqual([]);
  });

  it('書けなくても例外を出さない', () => {
    const bad = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => saveVacancyInput(defaultVacancyInput(TODAY), bad)).not.toThrow();
  });
});
