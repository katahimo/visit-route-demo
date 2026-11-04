import { describe, expect, it } from 'vitest';
import { TOUR_TODAY_LABEL, tourCountText, tourMove, tourNextLabel, tourSteps } from './tour';

const terms = { staff: 'スタッフ', client: '利用者さん' };

describe('tourSteps（PRD D277）', () => {
  it('2枚：予定で作って確定 → 欠勤・キャンセル（ホーム・条件の重み・探すの枚は無い）', () => {
    const s = tourSteps(terms);
    expect(s.map((x) => x.key)).toEqual(['plan', 'absence']);
    for (const x of s) {
      expect(x.title).not.toBe('');
      expect(x.body).not.toBe('');
      expect(x.where).not.toBe('');
    }
    expect(JSON.stringify(s)).not.toContain('Ctrl+K');
    expect(JSON.stringify(s)).not.toContain('条件の重み');
    expect(JSON.stringify(s)).not.toContain('ホーム');
  });
  it('エキスパート機能が切なら、「組む」のメニューを案内せず、帯の「要対応を組む」で組むと書く。入はメニューの「組む」と帯の種類を書く（ADR-0072・ADR-0074）', () => {
    const plan = tourSteps(terms, { expert: false })[0]!;
    expect(plan.body).not.toContain('「組む」');
    expect(plan.points!.join('')).not.toContain('メニューの「組む」');
    expect(plan.points!.join('')).toContain('赤い帯の「要対応を組む」');
    const on = tourSteps(terms, {})[0]!;
    expect(on.body).toContain('「組む」の「担当を組む」で');
    expect(on.body).toContain('未確定の日');
    expect(on.points![0]).toContain('メニューの「組む」の「担当を組む」');
    expect(JSON.stringify(on)).not.toContain('予定を組む');
  });
  it('呼び方を入れる（直書きしない）', () => {
    const s = tourSteps({ staff: 'ヘルパー', client: 'お客様' });
    expect(s[1]!.body).toContain('ヘルパーの急な欠勤');
    expect(s[1]!.body).toContain('お客様の当日キャンセル');
    expect(s[0]!.points!.join('')).toContain('ヘルパーに伝えたら');
    expect(JSON.stringify(s)).not.toContain('利用者さん');
    expect(JSON.stringify(tourSteps(terms))).not.toContain('ヘルパー');
  });
  it('予定の枚は3段（組む（AI）→ ピン → 確定（伝えた））を順に並べ、［月｜週｜日］で切り替えると書く', () => {
    const plan = tourSteps(terms)[0]!;
    expect(plan.key).toBe('plan');
    expect(plan.title).toBe('予定を組んで、直して、確定します');
    expect(plan.body).toContain('［月｜週｜日］');
    expect(plan.points).toHaveLength(3);
    expect(plan.points![0]).toMatch(/^組む（AI）：/);
    expect(plan.points![1]).toMatch(/^ピン：/);
    expect(plan.points![2]).toMatch(/^確定（伝えた）：/);
  });
  it('場所の文はメニュー・下のタブの名前（予定）と、予定の操作の行の欠勤・キャンセル（ADR-0045・ADR-0074）', () => {
    const s = tourSteps(terms);
    expect(s[0]!.where).toBe('メニューの「予定」（スマホは下のタブの「予定」）');
    expect(s[1]!.where).toBe('日の予定の「欠勤・キャンセルを登録」');
  });
  it('エキスパート機能が切ならホームの枚を出さず、帯・日の予定の欠勤を案内する（PRD D400・D403）', () => {
    const s = tourSteps(terms, { expert: false });
    expect(s.map((x) => x.key)).toEqual(['plan', 'absence']);
    expect(s[0]!.body).toContain('赤い帯');
    expect(s[0]!.body).toContain('帯の「要対応を組む」');
    expect(s[0]!.points![2]).toMatch(/^決まったあと：/);
    expect(s[1]!.where).toBe('日の予定の「欠勤・キャンセルを登録」');
    expect(JSON.stringify(s)).not.toContain('ホーム');
    expect(tourSteps(terms, { expert: false, sudden: false }).map((x) => x.key)).toEqual(['plan']);
  });
  it('欠勤・キャンセルを切ると1枚（PRD D213）', () => {
    expect(tourSteps(terms, { sudden: false }).map((x) => x.key)).toEqual(['plan']);
  });
});

describe('tourMove', () => {
  it('次へ・戻る・とばす', () => {
    expect(tourMove(0, 5, 'next')).toBe(1);
    expect(tourMove(3, 5, 'next')).toBe(4);
    expect(tourMove(2, 5, 'back')).toBe(1);
    expect(tourMove(2, 5, 'skip')).toBeNull();
  });
  it('最初の「戻る」は動かず、最後の「次へ」は閉じる', () => {
    expect(tourMove(0, 5, 'back')).toBe(0);
    expect(tourMove(4, 5, 'next')).toBeNull();
  });
  it('範囲の外・0枚', () => {
    expect(tourMove(9, 5, 'back')).toBe(3);
    expect(tourMove(-1, 5, 'next')).toBe(1);
    expect(tourMove(0, 0, 'next')).toBeNull();
  });
  it('ボタンの文と何枚目か', () => {
    expect(tourNextLabel(0, 3)).toBe('次へ');
    expect(tourNextLabel(2, 3)).toBe('閉じる');
    expect(TOUR_TODAY_LABEL).toBe('今日の予定を開く');
    expect(tourCountText(1, 3)).toBe('2 / 3');
  });
});
