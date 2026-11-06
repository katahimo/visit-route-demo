import { describe, expect, it } from 'vitest';
import { place2AddressText, place2TermText } from './place2View';

describe('住所2 の文', () => {
  it('住所は郵便番号があれば〒を前に付ける', () => {
    expect(place2AddressText({ address: '架空市駅前2丁目', postalCode: '1000005' })).toBe('〒100-0005 架空市駅前2丁目');
    expect(place2AddressText({ address: '架空市駅前2丁目', postalCode: '' })).toBe('架空市駅前2丁目');
  });
  it('期間は年付きの日付。空の端は「から」「まで」、両方空は「いつも」', () => {
    expect(place2TermText({ from: '2026-08-01', to: '2026-08-30' })).toBe('2026/8/1（土）〜2026/8/30（日）');
    expect(place2TermText({ from: '2026-08-01', to: '' })).toBe('2026/8/1（土）から');
    expect(place2TermText({ from: '', to: '2026-08-30' })).toBe('2026/8/30（日）まで');
    expect(place2TermText({ from: '', to: '' })).toBe('いつも（期間なし）');
  });
});
