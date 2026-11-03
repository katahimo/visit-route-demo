import { describe, expect, it } from 'vitest';
import { demoDataSchema } from '../contracts/data';
import { createInitialData } from '../seed/plans';
import { applyTemplate, isOn, matchTemplate } from './features';
import {
  bookingOfUse,
  createFirstRunData,
  FIRST_RUN_START_CHOICES,
  FIRST_RUN_USE_CHOICES,
  type FirstRunAnswer,
  firstRunLanding,
  firstRunSetup,
  restartConfirmBody,
} from './firstRun';
import { START_GUIDE_PATH } from './startGuide';

const TODAY = '2026-10-30';
const answers: FirstRunAnswer[] = [
  { start: 'demo', use: 'oneOff' },
  { start: 'demo', use: 'basic' },
  { start: 'demo', use: 'laborContract' },
  { start: 'demo', use: 'monthlyField' },
  { start: 'own', use: 'oneOff' },
  { start: 'own', use: 'basic' },
  { start: 'own', use: 'laborContract' },
  { start: 'own', use: 'monthlyField' },
];

describe('firstRunSetup（PRD D379：呼び名・ひな形・最初の画面）', () => {
  it('単発の予約＝お客様／シッター・ひな形「単発の予約」・週の予定', () => {
    const s = firstRunSetup('oneOff');
    expect(s.terms).toEqual({ client: 'お客様', staff: 'シッター' });
    expect(s.features).toEqual(applyTemplate('oneOff'));
    expect(matchTemplate(s.features)).toBe('oneOff');
    expect(isOn(s.features, 'patterns')).toBe(false);
    expect(s.firstPath).toBe('/week');
  });

  it('定期の訪問（基本）＝利用者さん／スタッフ・ひな形「基本」・月の予定', () => {
    const s = firstRunSetup('basic');
    expect(s.terms).toEqual({ client: '利用者さん', staff: 'スタッフ' });
    expect(s.features).toEqual(applyTemplate('basic'));
    expect(matchTemplate(s.features)).toBe('basic');
    expect(isOn(s.features, 'patterns')).toBe(true);
    expect(s.firstPath).toBe('/month');
  });

  it('定期＋勤務・契約・定期＋月の予定・現場共有：定期の呼び名・月の予定で、ひな形はその名前のもの', () => {
    for (const u of ['laborContract', 'monthlyField'] as const) {
      const s = firstRunSetup(u);
      expect(s.terms).toEqual({ client: '利用者さん', staff: 'スタッフ' });
      expect(matchTemplate(s.features)).toBe(u);
      expect(s.firstPath).toBe('/month');
      expect(bookingOfUse(u)).toBe('regular');
    }
  });

  it('どの使い方もエキスパート機能は切', () => {
    for (const c of FIRST_RUN_USE_CHOICES) expect(isOn(firstRunSetup(c.value).features, 'expert')).toBe(false);
  });

  it('問1は2つ、問2はひな形の並びの4つ（すべての機能を除く）で、名前はひな形の名前', () => {
    expect(FIRST_RUN_START_CHOICES.map((c) => c.value)).toEqual(['demo', 'own']);
    expect(FIRST_RUN_USE_CHOICES.map((c) => c.value)).toEqual(['oneOff', 'basic', 'laborContract', 'monthlyField']);
    expect(FIRST_RUN_USE_CHOICES.map((c) => c.label)).toEqual([
      '単発の予約',
      '定期の訪問（基本）',
      '定期＋勤務・契約',
      '定期＋月の予定・現場共有',
    ]);
    expect(FIRST_RUN_USE_CHOICES.find((c) => c.value === 'laborContract')?.description).toMatch(/^例：訪問介護/);
    expect(FIRST_RUN_USE_CHOICES.find((c) => c.value === 'monthlyField')?.description).toMatch(/^例：訪問看護/);
  });
});

describe('createFirstRunData（答え → データ）', () => {
  it('どの答えでも契約を通り、呼び名・入り切りが答えどおり', () => {
    for (const a of answers) {
      const d = createFirstRunData(a, TODAY);
      expect(() => demoDataSchema.parse(d)).not.toThrow();
      const s = firstRunSetup(a.use);
      expect(d.org.terms).toEqual(s.terms);
      expect(d.org.features).toEqual(s.features);
      expect(d.baseDate).toBe(TODAY);
    }
  });

  it('デモ・単発：架空の単発の予約（今日から2週間分。繰り返しなし）', () => {
    const d = createFirstRunData({ start: 'demo', use: 'oneOff' }, TODAY);
    expect(d.patterns).toEqual([]);
    expect(d.visits.length).toBeGreaterThan(14);
    expect(d.visits.every((v) => v.date >= TODAY && v.pattern === null)).toBe(true);
  });

  it('デモ・定期：今の初期データ（入り切りだけ基本のひな形）', () => {
    const d = createFirstRunData({ start: 'demo', use: 'basic' }, TODAY);
    expect(d).toEqual(createInitialData(TODAY, firstRunSetup('basic').features));
    expect(d.clients).toHaveLength(20);
  });

  it('自分のデータ：人・訪問・繰り返しの無い空のデータ（訪問の種類は入っている）', () => {
    for (const use of ['oneOff', 'basic', 'laborContract', 'monthlyField'] as const) {
      const d = createFirstRunData({ start: 'own', use }, TODAY);
      expect([d.clients, d.staff, d.visits, d.patterns, d.snapshots].map((x) => Object.keys(x).length)).toEqual([
        0, 0, 0, 0, 0,
      ]);
      expect(d.visitTypes.length).toBeGreaterThan(0);
    }
  });

  it('同じ答え・同じ日なら同じデータ', () => {
    for (const a of answers) expect(createFirstRunData(a, TODAY)).toEqual(createFirstRunData(a, TODAY));
  });
});

describe('firstRunLanding（最初に開く画面）', () => {
  it('デモ＝単発は週・定期は月。自分のデータ＝登録の案内', () => {
    expect(firstRunLanding({ start: 'demo', use: 'oneOff' })).toBe('/week');
    expect(firstRunLanding({ start: 'demo', use: 'basic' })).toBe('/month');
    expect(firstRunLanding({ start: 'own', use: 'oneOff' })).toBe(START_GUIDE_PATH);
    expect(firstRunLanding({ start: 'own', use: 'basic' })).toBe(START_GUIDE_PATH);
  });
});

describe('restartConfirmBody（始め方を選び直す）', () => {
  it('「元に戻す」で戻せないことと、先に控えを書き出す案内と、控えの文を含む', () => {
    const body = restartConfirmBody('控えの文。');
    expect(body).toContain('「元に戻す」でも戻せません');
    expect(body).toContain('書き出して');
    expect(body.endsWith('控えの文。')).toBe(true);
  });
});
