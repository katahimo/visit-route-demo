import { describe, expect, it } from 'vitest';
import type { ToldState } from './dayPlan';
import {
  CHANGED_WORD,
  changedFlagText,
  changesText,
  dayStateText,
  headerToldChip,
  showConfirmStep,
  showContactedButton,
  shownDayState,
} from './settledView';

const STATES: ToldState[] = ['none', 'told', 'changed'];
const WORDS: Record<ToldState, string> = { none: 'まだ', told: '済み', changed: '未連絡' };

describe('確定の段階を出すか（expert）', () => {
  it('expert が入（既定は入）のときだけ出す。切では出さない', () => {
    expect(showConfirmStep({})).toBe(true);
    expect(showConfirmStep({ expert: true })).toBe(true);
    expect(showConfirmStep({ expert: false })).toBe(false);
  });
});

describe('expert 入は今のとおり', () => {
  it('状態・言葉・チップ・連絡したボタン', () => {
    for (const s of STATES) {
      expect(shownDayState(s, true)).toBe(s);
      expect(dayStateText(s, true, WORDS)).toBe(WORDS[s]);
      expect(headerToldChip(s, true)).toBe(s);
      expect(showContactedButton(s, true)).toBe(false);
    }
  });
});

describe('expert 切は「変更あり」だけ見せる', () => {
  it('まだ伝えていない・確定済みは出さず、変更ありは残す', () => {
    expect(shownDayState('none', false)).toBe('none');
    expect(shownDayState('told', false)).toBe('none');
    expect(shownDayState('changed', false)).toBe('changed');
    expect(dayStateText('none', false, WORDS)).toBe('');
    expect(dayStateText('told', false, WORDS)).toBe('');
    expect(dayStateText('changed', false, WORDS)).toBe(CHANGED_WORD);
    expect(headerToldChip('none', false)).toBeNull();
    expect(headerToldChip('told', false)).toBeNull();
    expect(headerToldChip('changed', false)).toBe('changed');
  });
  it('「連絡した」は未連絡の変更があるときだけ', () => {
    expect(showContactedButton('changed', false)).toBe(true);
    expect(showContactedButton('told', false)).toBe(false);
    expect(showContactedButton('none', false)).toBe(false);
  });
});

describe('changesText', () => {
  it('入は未連絡の変更、切は変更あり', () => {
    expect(changesText(2, true)).toBe('未連絡の変更 2件');
    expect(changesText(2, false)).toBe('変更あり 2件');
  });
});

describe('changedFlagText', () => {
  it('月のマスの札：入は「未連絡 N」、切は「変更あり N」', () => {
    expect(changedFlagText(2, true)).toBe('未連絡 2');
    expect(changedFlagText(2, false)).toBe('変更あり 2');
  });
});
