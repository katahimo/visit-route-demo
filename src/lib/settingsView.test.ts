import { describe, expect, it } from 'vitest';
import { applyTemplate, featureDef, withFeature } from './features';
import { currentTemplateName, featureRowText, mailStepsHeading } from './settingsView';

const terms = { client: '利用者さん', staff: 'スタッフ' };
const all = applyTemplate('all');

describe('featureRowText（スイッチの行の文）', () => {
  it('説明は1行（隠れるものは別に持つ）で、呼び方は terms に置き換える', () => {
    const t = featureRowText(featureDef('clientLeave'), all, { client: 'お客様', staff: 'スタッフ' });
    expect(t.label).toBe('お客様の休み');
    expect(t.description).not.toContain('切ると隠れるもの');
    expect(t.description).toContain('お客様');
    expect(t.hides.startsWith('切ると隠れるもの：')).toBe(true);
  });
  it('どの機能の説明も1文で、「切ると」を含まない（隠れるものは ⓘ の中）', () => {
    for (const id of ['expert', 'vacancy', 'patterns', 'excel'] as const) {
      const t = featureRowText(featureDef(id), all, terms);
      expect(t.description).not.toContain('切ると');
      expect(t.description.split('。').filter(Boolean)).toHaveLength(1);
    }
  });
  it('依存が無ければ注記なし。依存先が入なら「使えます」、切なら blocked で「入れると使えます」', () => {
    expect(featureRowText(featureDef('vacancy'), all, terms).requires).toBeNull();
    expect(featureRowText(featureDef('vacancyNotice'), all, terms).requires).toEqual({
      blocked: false,
      text: '「空き状況」が入っているときに使えます',
    });
    expect(featureRowText(featureDef('vacancyNotice'), withFeature(all, 'vacancy', false), terms).requires).toEqual({
      blocked: true,
      text: '「空き状況」を入れると使えます',
    });
  });
});

describe('currentTemplateName（ひな形の見出しの名前）', () => {
  it('同じひな形ならその名前、どれとも違えば「カスタム」', () => {
    expect(currentTemplateName(applyTemplate('basic'))).toEqual({ name: '基本', custom: false });
    expect(currentTemplateName(all)).toEqual({ name: 'すべて', custom: false });
    expect(currentTemplateName(withFeature(all, 'vacancy', false))).toEqual({ name: 'カスタム', custom: true });
  });
});

describe('mailStepsHeading', () => {
  it('手順の数', () => {
    expect(mailStepsHeading(4)).toBe('手順 4つ');
  });
});
