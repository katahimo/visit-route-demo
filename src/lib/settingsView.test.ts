import { describe, expect, it } from 'vitest';
import { applyTemplate, FEATURES, featureDef, matchTemplate, templateDef, withFeature } from './features';
import {
  currentTemplateName,
  featureRowText,
  groupOnCountText,
  mailStepsHeading,
  templateCardText,
} from './settingsView';

const terms = { client: '利用者さん', staff: 'スタッフ' };
const all = applyTemplate('all');

describe('templateCardText（ひな形の一覧の1つ。ADR-0092）', () => {
  it('例は「例：」付き、説明は呼び方を入れ、基本との差を行にする', () => {
    const t = templateCardText(templateDef('laborContract'), terms);
    expect(t.example).toBe('例：訪問介護・移動支援');
    expect(t.description).toContain('スタッフの拘束');
    expect(t.description).not.toContain('{staff}');
    expect(t.delta).toEqual(['基本に足す：段階・紹介元・勤務の見込み・交通費']);
  });
  it('単発の予約は外す行だけ、基本・すべての機能は差の行が無い', () => {
    expect(templateCardText(templateDef('oneOff'), terms).delta).toEqual([
      '基本から外す：繰り返し（定期パターン）・毎月の第N曜日・曜日ごとの時刻・訪問先の決まりごと',
    ]);
    expect(templateCardText(templateDef('basic'), terms)).toEqual({
      example: null,
      description: templateDef('basic').description,
      delta: [],
    });
    expect(templateCardText(templateDef('all'), terms).delta).toEqual([]);
  });
  it('グループの入っている数', () => {
    expect(groupOnCountText(2, 4)).toBe('2 / 4 入');
  });
});

describe('featureRowText（スイッチの行の文）', () => {
  it('説明は1行（隠れるものは別に持つ）で、呼び方は terms に置き換える', () => {
    const t = featureRowText(featureDef('clientLeave'), all, { client: 'お客様', staff: 'スタッフ' });
    expect(t.label).toBe('お客様の休み');
    expect(t.description).not.toContain('切ると隠れるもの');
    expect(t.description).toContain('お客様');
    expect(t.hides.startsWith('切ると隠れるもの：')).toBe(true);
  });
  it('どの機能の説明も1文で、「切ると」を含まない（隠れるものは ⓘ の中）', () => {
    for (const f of FEATURES) {
      const t = featureRowText(f, all, terms);
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
    expect(currentTemplateName(matchTemplate(applyTemplate('basic')))).toEqual({
      name: '定期の訪問（基本）',
      custom: false,
    });
    expect(currentTemplateName(matchTemplate(all))).toEqual({ name: 'すべての機能', custom: false });
    expect(currentTemplateName(matchTemplate(withFeature(all, 'vacancy', false)))).toEqual({
      name: 'カスタム',
      custom: true,
    });
  });
});

describe('mailStepsHeading', () => {
  it('手順の数', () => {
    expect(mailStepsHeading(4)).toBe('手順 4つ');
  });
});
