import { describe, expect, it } from 'vitest';
import {
  ADD_VISIT_LABEL,
  arrangeWords,
  detailItems,
  exceptionsOnly,
  foldedParts,
  introKey,
  introShown,
  introText,
  mainTools,
  proposalWords,
  reassignWords,
  showLegs,
} from './exceptionView';

const all = { add: true, plan: true, arrange: true, absence: true, assign: true, confirm: true };

describe('exceptionsOnly', () => {
  it('エキスパート機能が切のときだけ（無い ID は入）', () => {
    expect(exceptionsOnly({ expert: false })).toBe(true);
    expect(exceptionsOnly({ expert: true })).toBe(false);
    expect(exceptionsOnly({})).toBe(false);
  });
});

describe('ADD_VISIT_LABEL（日の主ボタンと新規の欄の見出し）', () => {
  it('入切とも「予定を入れる」', () => {
    expect(ADD_VISIT_LABEL).toBe('予定を入れる');
  });
});

describe('mainTools（操作の行は主ボタン1つ＋最大1つ）', () => {
  it('日は 訪問を追加（主）＋欠勤・キャンセル。予定を入れる・組むは出さない（組むは「その他 ▾」）', () => {
    expect(mainTools('day', all)).toEqual({ primary: 'add', second: 'absence' });
  });
  it('日でスマホ（追加できない）は 担当なしを組む（主）＋欠勤・キャンセル', () => {
    expect(mainTools('day', { ...all, add: false })).toEqual({ primary: 'arrange', second: 'absence' });
  });
  it('週・月は 予定を入れる（主）＋欠勤・キャンセル。担当なしを組むは担当なしの有無によらず「その他 ▾」へ', () => {
    for (const z of ['week', 'month'] as const) {
      expect(mainTools(z, all)).toEqual({ primary: 'plan', second: 'absence' });
      expect(mainTools(z, { ...all, arrange: false })).toEqual({ primary: 'plan', second: 'absence' });
    }
  });
  it('欠勤・キャンセルを切っていれば出さない。何も無ければ両方 null', () => {
    expect(mainTools('month', { ...all, absence: false })).toEqual({ primary: 'plan', second: null });
    expect(mainTools('week', { ...all, add: false, plan: false, arrange: false, absence: false })).toEqual({
      primary: null,
      second: null,
    });
  });
});

describe('mainTools（入）', () => {
  it('月・週は 予定を入れる（主）＋担当を組む。欠勤・キャンセルは「その他 ▾」へ（行に出さない）', () => {
    for (const z of ['week', 'month'] as const) {
      expect(mainTools(z, all, true)).toEqual({ primary: 'plan', second: 'assign' });
      expect(mainTools(z, { ...all, assign: false }, true)).toEqual({ primary: 'plan', second: null });
    }
  });
  it('日は 予定を入れる（主）＋確定（伝えた）', () => {
    expect(mainTools('day', all, true)).toEqual({ primary: 'add', second: 'confirm' });
    expect(mainTools('day', { ...all, confirm: false }, true)).toEqual({ primary: 'add', second: null });
  });
  it('日でスマホ（追加できない）は 確定（伝えた）が主ボタン。担当なしを組むは入では出さない', () => {
    expect(mainTools('day', { ...all, add: false }, true)).toEqual({ primary: 'confirm', second: null });
    expect(mainTools('day', { ...all, add: false, confirm: false }, true)).toEqual({ primary: null, second: null });
  });
});

describe('foldedParts（詳しく：中身があるものだけ）', () => {
  it('入切とも畳む項目のうち中身があるものだけ。無ければ空（詳しくを出さない）', () => {
    expect(foldedParts('week', false, { status: true, legend: true })).toEqual(['status', 'legend']);
    expect(foldedParts('week', true, { status: true, legend: true })).toEqual(['status', 'legend']);
    expect(foldedParts('week', true, { status: false, legend: true })).toEqual(['legend']);
    expect(foldedParts('week', true, { status: false, legend: false })).toEqual([]);
    expect(foldedParts('month', true, { progress: true, summary: true, legend: true })).toEqual([
      'progress',
      'summary',
      'legend',
    ]);
  });
});

describe('reassignWords（振り直しの言葉）', () => {
  it('切は 反映・ピン・点数の行 を出さない。入は今のまま', () => {
    const w = reassignWords(true);
    const text = [w.current, w.applied, w.choose('案A'), w.none, w.resultTitle, w.hint].join('');
    for (const bad of ['反映', 'ピン', '標準', '提案', 'プリセット']) expect(text).not.toContain(bad);
    expect(w.pinNote).toBeUndefined();
    expect(w.scoreInTable).toBe(false);
    const x = reassignWords(false);
    expect(x.choose('案A')).toBe('案Aを反映する');
    expect(x.pinNote).toBe('ピン');
    expect(x.scoreInTable).toBe(true);
  });
});

describe('詳しく・説明・言葉', () => {
  it('入切とも画面ごとの部品を畳む。日の要対応の訪問の帯は入だけ', () => {
    for (const z of ['week', 'month'] as const) expect(detailItems(z, false)).toEqual(detailItems(z, true));
    expect(detailItems('day', false)).toEqual(['oneLine', 'dayLines', 'care']);
    expect(detailItems('day', true)).toEqual(['oneLine', 'dayLines']);
    expect(detailItems('month', true)).toEqual(['progress', 'summary', 'legend']);
    expect(detailItems('week', true)).toEqual(['status', 'legend']);
    expect(showLegs(true)).toBe(false);
    expect(showLegs(false)).toBe(true);
  });
  it('説明：入は今の文。切は閉じるまで出し、閉じたら（覚えていれば）出さない。画面ごと', () => {
    expect(introText('month', false, '今の文')).toBe('今の文');
    expect(introText('month', true, '今の文')).not.toContain('確定');
    expect(introShown({}, 'month')).toBe(true);
    expect(introShown({ [introKey('month')]: false }, 'month')).toBe(false);
    expect(introShown({ [introKey('month')]: false }, 'week')).toBe(true);
  });
  it('提案の帯の言葉：切は 標準・提案・反映・ピン・プリセット を使わない', () => {
    const w = proposalWords(true);
    const text = [
      w.aria,
      w.title('11月', 3),
      w.apply,
      w.discard,
      w.detailsLabel(2),
      w.applied('11月', 3, 1),
      w.stale(1),
      w.staleOne,
    ].join('');
    for (const bad of ['標準', '提案', '反映', 'ピン', 'プリセット']) expect(text).not.toContain(bad);
    expect(proposalWords(false).apply).toBe('反映する');
  });
});

describe('arrangeWords（担当を組むの画面の言葉。ADR-0074 段1）', () => {
  it('切は 標準・提案・反映・ピン・プリセット を使わず、proposalWords と同じ言い方（案・この案にする）', () => {
    const w = arrangeWords(true);
    const text = w.lead + w.note('繰り返しの担当');
    for (const bad of ['標準', '提案', '反映', 'ピン', 'プリセット']) expect(text).not.toContain(bad);
    expect(text).toContain(proposalWords(true).apply);
    expect(text).toContain('繰り返しの担当');
  });
  it('入は今のまま（提案・反映・ピン）', () => {
    const w = arrangeWords(false);
    expect(w.lead).toContain('提案を見て反映します');
    expect(w.note('組み方の標準の担当')).toContain('ピンの訪問（手で替えた訪問・組み方の標準の担当）');
    expect(w.note('x')).toContain('「反映する」');
  });
});
