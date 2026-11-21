import { describe, expect, it } from 'vitest';
import { escReleases } from './selectRelease';

const base = { key: 'Escape', defaultPrevented: false, isComposing: false, targetTag: 'DIV', overlayOpen: false };

describe('escReleases（Esc で選択を外すか）', () => {
  it('Esc なら外す（フォーカスが無いとき・ボタンの上でも）', () => {
    expect(escReleases(base)).toBe(true);
    expect(escReleases({ ...base, targetTag: null })).toBe(true);
    expect(escReleases({ ...base, targetTag: 'button' })).toBe(true);
  });
  it('Esc 以外のキーでは外さない', () => {
    expect(escReleases({ ...base, key: 'Enter' })).toBe(false);
  });
  it('入力欄の中・IME の変換中・ほかが先に受けたとき・モーダルや右の欄が開いているときは外さない', () => {
    expect(escReleases({ ...base, targetTag: 'INPUT' })).toBe(false);
    expect(escReleases({ ...base, targetTag: 'textarea' })).toBe(false);
    expect(escReleases({ ...base, targetTag: 'SELECT' })).toBe(false);
    expect(escReleases({ ...base, isComposing: true })).toBe(false);
    expect(escReleases({ ...base, defaultPrevented: true })).toBe(false);
    expect(escReleases({ ...base, overlayOpen: true })).toBe(false);
  });
});
