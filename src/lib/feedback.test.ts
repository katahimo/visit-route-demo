import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '../contracts/feedback';
import {
  feedbackAtText,
  feedbackFileName,
  feedbackMail,
  feedbackProblem,
  feedbackReportHtml,
  passwordProblem,
  sizeText,
} from './feedback';
import { mailtoHref } from './mailto';

const item = (patch: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id: 'fb-1',
  at: Date.UTC(2026, 10, 12, 5, 3),
  path: '#/month?m=2026-11',
  screen: '月の予定',
  comment: '1行目\n<b>2行目</b>',
  image: 'data:image/jpeg;base64,AAAA',
  width: 1280,
  height: 800,
  version: 'abc123',
  userAgent: 'UA "x"',
  ...patch,
});

describe('意見の入力の確かめ', () => {
  it('空白だけの意見は残せない', () => {
    expect(feedbackProblem('  \n')).toBe('意見を入れてください');
    expect(feedbackProblem('ここが分かりにくい')).toBeNull();
  });
  it('パスワードは8文字以上', () => {
    expect(passwordProblem('1234567')).toContain('8文字以上');
    expect(passwordProblem('12345678')).toBeNull();
  });
});

describe('意見の表示', () => {
  it('時刻は日本時間', () => {
    expect(feedbackAtText(item().at)).toBe('2026-11-12 14:03');
  });
  it('ファイルの名前と大きさ', () => {
    expect(feedbackFileName('2026-11-12')).toBe('staff-assign-feedback-2026-11-12.html');
    expect(sizeText(10)).toBe('1KB');
    expect(sizeText(300 * 1024)).toBe('300KB');
    expect(sizeText(2.5 * 1024 * 1024)).toBe('2.5MB');
  });
});

describe('feedbackReportHtml（意見をまとめた報告）', () => {
  const html = feedbackReportHtml([item(), item({ id: 'fb-2', image: null, screen: '' })], {
    org: '事業所<A>',
    at: item().at,
  });
  it('件数・画面の名前・時刻・版・画像が入る', () => {
    expect(html).toContain('意見（2件）');
    expect(html).toContain('<h2>1. 月の予定</h2>');
    expect(html).toContain('2026-11-12 14:03');
    expect(html).toContain('版 abc123');
    expect(html).toContain('<img src="data:image/jpeg;base64,AAAA"');
  });
  it('入力した文字はタグにしない', () => {
    expect(html).toContain('1行目\n&lt;b&gt;2行目&lt;/b&gt;');
    expect(html).toContain('事業所&lt;A&gt;');
    expect(html).toContain('UA &quot;x&quot;');
  });
  it('画像が無い・画面の名前が無いときは、画像なしと URL を出す', () => {
    expect(html).toContain('（画像なし）');
    expect(html).toContain('<h2>2. #/month?m=2026-11</h2>');
  });
  it('data URL の形でない画像は出さない', () => {
    const bad = feedbackReportHtml([item({ image: 'x" onerror="alert(1)' })], { org: '', at: 0 });
    expect(bad).not.toContain('onerror');
    expect(bad).toContain('（画像なし）');
  });
});

describe('feedbackMail（送るメール）', () => {
  it('宛先は入れず、添付の案内を書き、パスワードは書かない', () => {
    const m = feedbackMail(3, 'staff-assign-feedback-2026-11-12.html');
    expect(m.to).toEqual([]);
    expect(m.subject).toBe('アプリへの意見（3件）');
    expect(m.body).toContain('staff-assign-feedback-2026-11-12.html');
    expect(m.body).toContain('このメールには書かず');
    expect(mailtoHref(m).startsWith('mailto:?subject=')).toBe(true);
  });
});
