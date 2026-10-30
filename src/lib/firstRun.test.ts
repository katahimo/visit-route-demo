import { describe, expect, it } from 'vitest';
import { demoDataSchema } from '../contracts/data';
import { createInitialData } from '../seed/plans';
import { isOn, matchTemplate } from './features';
import {
  createFirstRunData,
  FIRST_RUN_BOOKING_CHOICES,
  FIRST_RUN_START_CHOICES,
  type FirstRunAnswer,
  firstRunLanding,
  firstRunSetup,
  restartConfirmBody,
} from './firstRun';
import { START_GUIDE_PATH } from './startGuide';

const TODAY = '2026-10-30';
const answers: FirstRunAnswer[] = [
  { start: 'demo', booking: 'oneOff' },
  { start: 'demo', booking: 'regular' },
  { start: 'own', booking: 'oneOff' },
  { start: 'own', booking: 'regular' },
];

describe('firstRunSetup（PRD D379：呼び名・ひな形・最初の画面）', () => {
  it('単発＝お客様／シッター・「単発のみ」・週の予定', () => {
    const s = firstRunSetup('oneOff');
    expect(s.terms).toEqual({ client: 'お客様', staff: 'シッター' });
    expect(s.template).toBe('oneOff');
    expect(matchTemplate(s.features)).toBe('oneOff');
    expect(isOn(s.features, 'patterns')).toBe(false);
    expect(s.firstPath).toBe('/week');
  });

  it('定期＝利用者さん／スタッフ・「基本」・月の予定', () => {
    const s = firstRunSetup('regular');
    expect(s.terms).toEqual({ client: '利用者さん', staff: 'スタッフ' });
    expect(s.template).toBe('basic');
    expect(matchTemplate(s.features)).toBe('basic');
    expect(isOn(s.features, 'patterns')).toBe(true);
    expect(s.firstPath).toBe('/month');
  });

  it('どちらもエキスパート機能は切', () => {
    for (const b of ['oneOff', 'regular'] as const) expect(isOn(firstRunSetup(b).features, 'expert')).toBe(false);
  });

  it('選択肢は問1・問2とも2つ', () => {
    expect(FIRST_RUN_START_CHOICES.map((c) => c.value)).toEqual(['demo', 'own']);
    expect(FIRST_RUN_BOOKING_CHOICES.map((c) => c.value)).toEqual(['oneOff', 'regular']);
  });
});

describe('createFirstRunData（答え → データ）', () => {
  it('どの答えでも契約を通り、呼び名・入り切りが答えどおり', () => {
    for (const a of answers) {
      const d = createFirstRunData(a, TODAY);
      expect(() => demoDataSchema.parse(d)).not.toThrow();
      const s = firstRunSetup(a.booking);
      expect(d.org.terms).toEqual(s.terms);
      expect(d.org.features).toEqual(s.features);
      expect(d.baseDate).toBe(TODAY);
    }
  });

  it('デモ・単発：架空の単発の予約（今日から2週間分。繰り返しなし）', () => {
    const d = createFirstRunData({ start: 'demo', booking: 'oneOff' }, TODAY);
    expect(d.patterns).toEqual([]);
    expect(d.visits.length).toBeGreaterThan(14);
    expect(d.visits.every((v) => v.date >= TODAY && v.pattern === null)).toBe(true);
  });

  it('デモ・定期：今の初期データ（入り切りだけ基本のひな形）', () => {
    const d = createFirstRunData({ start: 'demo', booking: 'regular' }, TODAY);
    expect(d).toEqual(createInitialData(TODAY, firstRunSetup('regular').features));
    expect(d.clients).toHaveLength(20);
  });

  it('自分のデータ：人・訪問・繰り返しの無い空のデータ（訪問の種類は入っている）', () => {
    for (const booking of ['oneOff', 'regular'] as const) {
      const d = createFirstRunData({ start: 'own', booking }, TODAY);
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
    expect(firstRunLanding({ start: 'demo', booking: 'oneOff' })).toBe('/week');
    expect(firstRunLanding({ start: 'demo', booking: 'regular' })).toBe('/month');
    expect(firstRunLanding({ start: 'own', booking: 'oneOff' })).toBe(START_GUIDE_PATH);
    expect(firstRunLanding({ start: 'own', booking: 'regular' })).toBe(START_GUIDE_PATH);
  });
});

describe('restartConfirmBody（最初の設定をやり直す）', () => {
  it('元に戻す（Ctrl+Z）の対象外で、先にデータを書き出す案内と、控えの文を含む', () => {
    const body = restartConfirmBody('控えの文。');
    expect(body).toContain('「元に戻す」（Ctrl+Z）の対象外');
    expect(body).toContain('書き出して');
    expect(body.endsWith('控えの文。')).toBe(true);
  });
});
