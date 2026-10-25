// 繰り返しを 直す・消す・終わらせる 前の確認の文（ADR-0052）
import { describe, expect, it } from 'vitest';
import { patternEndConfirm, patternRemoveConfirm, patternSplitConfirm } from './patternConfirm';

describe('patternSplitConfirm', () => {
  it('件数が0なら担当を組んだ回・確定した日の行を出さない', () => {
    const o = patternSplitConfirm('2026-10-12', 0, 0);
    expect(o.title).toBe('繰り返しを10/12から変えますか？');
    expect(o.body).toBe(
      '10/12からの回は新しい繰り返しのとおりになります（担当は繰り返しの担当）。\nこの回だけ変えた訪問・取り消した訪問はそのままです。',
    );
    expect(o.confirmLabel).toBe('変える');
  });

  it('件数があれば行を足す', () => {
    const o = patternSplitConfirm('2026-10-12', 2, 3);
    expect(o.body).toContain('\n担当を組んだ回 2件も繰り返しのとおりに戻ります。');
    expect(o.body).toContain('\n確定した日 3日の訪問は「未連絡の変更」になります。');
  });
});

describe('patternRemoveConfirm', () => {
  it('赤い確定ボタンで、確定した日があれば行を足す', () => {
    expect(patternRemoveConfirm(0)).toMatchObject({ confirmLabel: '訪問ごと消す', tone: 'danger' });
    expect(patternRemoveConfirm(0).body).not.toContain('未連絡の変更');
    expect(patternRemoveConfirm(1).body).toContain('\n確定した日 1日の訪問は「未連絡の変更」になります。');
    expect(patternRemoveConfirm(1).body?.endsWith('\nやめるだけなら「終わらせる」を使います。')).toBe(true);
  });
});

describe('patternEndConfirm', () => {
  it('担当を組んだ回・確定した日があれば足す', () => {
    expect(patternEndConfirm('2026-10-31', 0, 0)).toEqual({
      title: '繰り返しを10/31で終わらせますか？',
      body: '10/31より後の回は無くなります。\nこの回だけ変えた訪問・取り消した訪問はそのままです。',
      confirmLabel: '終わらせる',
    });
    expect(patternEndConfirm('2026-10-31', 2, 1).body).toBe(
      '10/31より後の回は無くなります（担当を組んだ回 2件も消します）。\n確定した日 1日の訪問は「未連絡の変更」になります。\nこの回だけ変えた訪問・取り消した訪問はそのままです。',
    );
  });
});
