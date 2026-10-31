import { describe, expect, it } from 'vitest';
import type { Client, Staff } from '../contracts/documents';
import { FEATURE_IDS, type FeatureId, type Features } from '../contracts/features';
import { createDemoData } from '../seed';
import { attentionBand } from './attentionBand';
import { paletteActions } from './commandPalette';
import {
  applyTemplate,
  FEATURE_GROUPS,
  FEATURES,
  featureDef,
  featureLabel,
  featureOfHref,
  featureOfLocation,
  fillTerms,
  isFeatureOffState,
  isHrefOn,
  isOn,
  matchTemplate,
  TEMPLATE_IDS,
  TEMPLATES,
  type TemplateId,
  templateDiff,
  turnOffImpact,
  withFeature,
} from './features';
import { attentionTarget, dayHref, linkIfOn, suddenHref, unassignedHref, workloadHref } from './links';
import type { Attention, DayStatus } from './month';
import { bottomTabs, menuSections, screenSections, settingsTabs } from './nav';
import { tourSteps } from './tour';

const terms = { client: '利用者さん', staff: 'スタッフ' };
const TODAY = '2026-10-21';

/** 土台の画面（切れない。PRD D210）：ホーム・月の予定・週の予定・日の予定・〈利用者さん〉一覧・〈スタッフ〉一覧・勤務時間（シフト）・訪問の種類・データ・管理者設定 */
const BASE_PATHS = new Set([
  '/home',
  '/month',
  '/week',
  '/plan',
  '/basics',
  '/clients',
  '/staff',
  '/availability',
  '/arrange',
  '/types',
  '/data',
  '/settings',
]);
const pathOf = (href: string) => href.split('?')[0]!;
/** 行き先が土台か表のどれかの機能に属するか */
const belongs = (href: string) => featureOfHref(href) !== null || BASE_PATHS.has(pathOf(href));

/** ADR-0028 の「ひな形」の表（入れる機能） */
const TABLE: Record<TemplateId, FeatureId[]> = {
  oneOff: ['sudden', 'vacancy', 'compat', 'mapsLink', 'geocode'],
  basic: ['patterns', 'sudden', 'vacancy', 'compat', 'mapsLink', 'geocode'],
  laborContract: [
    'patterns',
    'sudden',
    'vacancy',
    'compat',
    'clientStage',
    'offboard',
    'workload',
    'fare',
    'mapsLink',
    'geocode',
  ],
  monthlyField: [
    'patterns',
    'patternMonthly',
    'clientLeave',
    'requestedOff',
    'monthPrint',
    'sudden',
    'vacancy',
    'vacancyNotice',
    'compat',
    'allowedStaff',
    'visitNotes',
    'mapsLink',
    'geocode',
    'excel',
  ],
  all: [...FEATURE_IDS],
};

describe('機能の表（ADR-0028 の機能の一覧）', () => {
  it('22の機能が契約の ID と同じ順に1つずつ。グループは決まった6つのどれか（管理者設定のスイッチの並び）', () => {
    expect(FEATURE_GROUPS).toEqual(['予定', '当日・問い合わせ', '人', 'AI の条件', '連絡', 'データ']);
    expect(featureDef('compat').group).toBe('AI の条件');
    expect(featureDef('allowedStaff').group).toBe('AI の条件');
    expect(featureDef('rules').group).toBe('AI の条件');
    expect(featureDef('vacancy').group).toBe('当日・問い合わせ');
    expect(FEATURES.map((f) => f.id)).toEqual([...FEATURE_IDS]);
    expect(FEATURES).toHaveLength(22);
    for (const f of FEATURES) {
      expect(FEATURE_GROUPS).toContain(f.group);
      expect(f.label).not.toBe('');
      expect(f.description).not.toBe('');
      expect(f.hides).not.toBe('');
    }
  });
  it('依存は 第N曜日 → 繰り返し、案を比べる・条件の重み → エキスパート機能、空き枠の案内文 → 空き状況、交通費 → 勤務の見込み だけ', () => {
    expect(FEATURES.filter((f) => f.requires).map((f) => [f.id, f.requires])).toEqual([
      ['patternMonthly', 'patterns'],
      ['compare', 'expert'],
      ['vacancyNotice', 'vacancy'],
      ['fare', 'workload'],
      ['rules', 'expert'],
    ]);
  });
  it('名前の呼び方は terms から', () => {
    expect(featureLabel('clientLeave', terms)).toBe('利用者さんの休み');
    expect(featureLabel('clientLeave', { client: 'お客様', staff: 'シッター' })).toBe('お客様の休み');
    expect(fillTerms('{staff}と{client}', { client: 'お客様', staff: 'シッター' })).toBe('シッターとお客様');
    expect(featureDef('compare').label).toBe('提案を比べる');
  });
});

describe('エキスパート機能（ADR-0072）', () => {
  it('切ると 案を比べる・条件の重み・組み方の標準・特性の項目の URL へ移れない（担当を組むは土台のまま）', () => {
    const off: Features = { expert: false };
    for (const h of ['/standard', '/compare?date=2026-10-12', '/rules#presets', '/items'])
      expect(isHrefOn(off, h)).toBe(false);
    expect(isHrefOn(off, '/arrange?ym=2026-10')).toBe(true);
    expect(isOn({ expert: false, compare: true, rules: true }, 'compare')).toBe(false);
    expect(isOn({ expert: false, rules: true }, 'rules')).toBe(false);
    expect(isHrefOn({}, '/standard')).toBe(true);
  });
  it('ひな形：すべてだけ入。基本・労務・月次は切（matchTemplate も見分ける）', () => {
    expect(isOn(applyTemplate('all'), 'expert')).toBe(true);
    for (const id of ['basic', 'laborContract', 'monthlyField'] as const) {
      expect(isOn(applyTemplate(id), 'expert')).toBe(false);
      expect(matchTemplate(applyTemplate(id))).toBe(id);
    }
    expect(matchTemplate({})).toBe('all');
    expect(matchTemplate({ expert: false })).toBe('custom');
  });
});

describe('isOn（依存を見る）', () => {
  it('無い ID は入。{} はすべて入', () => {
    for (const id of FEATURE_IDS) expect(isOn({}, id)).toBe(true);
  });
  it('切ったものは切', () => {
    expect(isOn({ compat: false }, 'compat')).toBe(false);
    expect(isOn({ compat: true }, 'compat')).toBe(true);
  });
  it('空き状況を切ると空き枠の案内文も切、勤務の見込みを切ると交通費も切（スイッチが入でも）', () => {
    expect(isOn({ vacancy: false, vacancyNotice: true }, 'vacancyNotice')).toBe(false);
    expect(isOn({ workload: false }, 'fare')).toBe(false);
    expect(isOn({ workload: true, fare: true }, 'fare')).toBe(true);
    expect(isOn({ fare: false }, 'workload')).toBe(true);
  });
  it('withFeature はその機能だけ明示して書く', () => {
    const f: Features = { compat: false };
    expect(withFeature(f, 'mail', false)).toEqual({ compat: false, mail: false });
    expect(withFeature(f, 'compat', true)).toEqual({ compat: true });
    expect(f).toEqual({ compat: false });
  });
});

describe('featureOfLocation（URL に要る機能）', () => {
  it('機能の画面', () => {
    expect(featureOfLocation('/vacancy', '')).toBe('vacancy');
    expect(featureOfLocation('/compare', '')).toBe('compare');
    expect(featureOfLocation('/workload', '?ym=2026-10&staff=s1')).toBe('workload');
    expect(featureOfLocation('/compat', '?id=c1')).toBe('compat');
    expect(featureOfLocation('/rules', '')).toBe('rules');
    expect(featureOfLocation('/items', '')).toBe('rules');
    expect(featureOfLocation('/month/print', '?ym=2026-10')).toBe('monthPrint');
  });
  it('?do= の入口：欠勤・キャンセルは sudden', () => {
    expect(featureOfLocation('/plan', `?date=${TODAY}&do=absence`)).toBe('sudden');
    expect(featureOfLocation('/plan', '?do=absence&staff=s1')).toBe('sudden');
    expect(featureOfHref(suddenHref(TODAY, 's1'))).toBe('sudden');
  });
  it('土台の画面・土台の操作は null', () => {
    for (const p of BASE_PATHS) expect(featureOfLocation(p, '')).toBeNull();
    expect(featureOfLocation('/plan', `?date=${TODAY}&do=unassigned`)).toBeNull();
    expect(featureOfLocation('/month', '?ym=2026-10&do=batch')).toBeNull();
    expect(featureOfLocation('/month', '?do=absence')).toBeNull();
    expect(featureOfLocation('/clients', '?id=c1')).toBeNull();
  });
  it('大文字小文字・末尾の / を区別しない（#/Vacancy・#/vacancy/・#/month/print/ でガードをすり抜けない）', () => {
    expect(featureOfLocation('/vacancy/', '')).toBe('vacancy');
    expect(featureOfLocation('/Vacancy', '')).toBe('vacancy');
    expect(featureOfLocation('/VACANCY//', '')).toBe('vacancy');
    expect(featureOfLocation('/month/print/', '?ym=2026-10')).toBe('monthPrint');
    expect(featureOfLocation('/Month/Print', '')).toBe('monthPrint');
    expect(featureOfLocation('/plan/', `?date=${TODAY}&do=absence`)).toBe('sudden');
    expect(featureOfHref('/Workload/?ym=2026-10')).toBe('workload');
    expect(featureOfLocation('/', '')).toBeNull();
    expect(featureOfLocation('/Month/', '')).toBeNull();
  });
  it('featureOfHref は # から後を見ない（/rules#presets は rules）', () => {
    expect(featureOfHref('/rules#presets')).toBe('rules');
    expect(featureOfHref('/plan?do=absence#x')).toBe('sudden');
    expect(isHrefOn({ rules: false }, '/rules#presets')).toBe(false);
  });
  it('isHrefOn：土台はいつも、機能はその入り切りで', () => {
    expect(isHrefOn({ vacancy: false }, '/vacancy')).toBe(false);
    expect(isHrefOn({ vacancy: false }, '/home')).toBe(true);
    expect(isHrefOn({}, '/vacancy')).toBe(true);
  });
  it('ルートの state（ホームの知らせ）', () => {
    expect(isFeatureOffState({ featureOff: 'vacancy' })).toBe(true);
    expect(isFeatureOffState({ featureOff: 'nope' })).toBe(false);
    expect(isFeatureOffState(null)).toBe(false);
    expect(isFeatureOffState('vacancy')).toBe(false);
  });
});

describe('ひな形（ADR-0028 の表）', () => {
  it('5つが 単発のみ・基本・労務・契約管理・月次予定・現場共有・すべて の順', () => {
    expect(TEMPLATES.map((t) => [t.id, t.label])).toEqual([
      ['oneOff', '単発のみ'],
      ['basic', '基本'],
      ['laborContract', '労務・契約管理'],
      ['monthlyField', '月次予定・現場共有'],
      ['all', 'すべて'],
    ]);
    for (const t of TEMPLATES) expect(t.description).not.toBe('');
  });
  it.each(TEMPLATE_IDS)('%s を適用すると表どおりの入り切り（全22の ID を明示）で、matchTemplate がそれを返す', (id) => {
    const f = applyTemplate(id);
    expect(Object.keys(f).sort()).toEqual([...FEATURE_IDS].sort());
    const on = FEATURE_IDS.filter((x) => f[x]);
    expect(on.sort()).toEqual([...TABLE[id]].sort());
    expect(matchTemplate(f)).toBe(id);
  });
  it('「条件の重みとプリセット」「案を比べる」「メール」は すべて 以外で切', () => {
    for (const id of ['basic', 'laborContract', 'monthlyField'] as const) {
      const f = applyTemplate(id);
      expect([f.rules, f.compare, f.mail]).toEqual([false, false, false]);
    }
  });
  it('単発のみ：基本から繰り返しだけを外した入り切り（第N曜日も依存で使えない）。基本・労務・月次・すべては繰り返しが入', () => {
    const f = applyTemplate('oneOff');
    expect(f.patterns).toBe(false);
    expect(f.expert).toBe(false);
    expect(isOn(f, 'patternMonthly')).toBe(false);
    expect(FEATURE_IDS.filter((x) => f[x] && !applyTemplate('basic')[x])).toEqual([]);
    for (const id of ['basic', 'laborContract', 'monthlyField', 'all'] as const) {
      expect(applyTemplate(id).patterns).toBe(true);
    }
    expect(matchTemplate(f)).toBe('oneOff');
    expect(matchTemplate({ ...applyTemplate('basic'), patterns: false })).toBe('oneOff');
    expect(matchTemplate({ ...f, patterns: true })).toBe('basic');
  });
  it('繰り返しだけ切ると 単発のみ、{}（無い ID）は繰り返しが入。第N曜日を入のままにしても依存で切れた扱い', () => {
    expect(isOn({}, 'patterns')).toBe(true);
    expect(isOn({ patterns: false, patternMonthly: true }, 'patternMonthly')).toBe(false);
  });
  it('{}（無い古いデータ・初期データ）は すべて', () => {
    expect(matchTemplate({})).toBe('all');
    expect(matchTemplate({ compat: true })).toBe('all');
  });
  it('1つ直すと custom', () => {
    expect(matchTemplate({ compat: false })).toBe('custom');
    expect(matchTemplate(withFeature(applyTemplate('basic'), 'mail', true))).toBe('custom');
    expect(matchTemplate(withFeature(applyTemplate('laborContract'), 'fare', false))).toBe('custom');
  });
  it('使えるか（依存を見る）で比べる：依存先が切なら、依存する機能のスイッチが入でもひな形と同じ', () => {
    // 基本（勤務の見込み・空き状況の案内文は切）に、交通費だけ入れても勤務の見込みが切なので使えない＝基本のまま
    expect(matchTemplate(withFeature(applyTemplate('basic'), 'fare', true))).toBe('basic');
    // 月次予定・現場共有から空き状況を切ると案内文も使えない。基本との差は残るので custom
    expect(matchTemplate(withFeature(applyTemplate('monthlyField'), 'vacancy', false))).toBe('custom');
    // すべてから勤務の見込みを切った（交通費のスイッチは入のまま）ものは、どのひな形とも違う
    expect(matchTemplate({ workload: false })).toBe('custom');
  });
  it('templateDiff：入る機能・切れる機能（表の順）', () => {
    expect(templateDiff({}, 'all')).toEqual({ on: [], off: [] });
    expect(templateDiff(applyTemplate('basic'), 'oneOff')).toEqual({ on: [], off: ['patterns'] });
    expect(templateDiff(applyTemplate('oneOff'), 'basic')).toEqual({ on: ['patterns'], off: [] });
    expect(templateDiff({}, 'basic')).toEqual({
      on: [],
      off: FEATURE_IDS.filter((x) => !TABLE.basic.includes(x)),
    });
    expect(templateDiff(applyTemplate('basic'), 'laborContract')).toEqual({
      on: ['clientStage', 'offboard', 'workload', 'fare'],
      off: [],
    });
    expect(templateDiff(applyTemplate('laborContract'), 'monthlyField')).toEqual({
      on: [
        'patternMonthly',
        'clientLeave',
        'requestedOff',
        'monthPrint',
        'vacancyNotice',
        'allowedStaff',
        'visitNotes',
        'excel',
      ],
      off: ['clientStage', 'offboard', 'workload', 'fare'],
    });
  });
  it('templateDiff は使えるか（依存）で比べる：空き状況が切なら案内文は入っていない扱い', () => {
    const f: Features = { ...applyTemplate('monthlyField'), vacancy: false };
    expect(templateDiff(f, 'monthlyField')).toEqual({ on: ['vacancy', 'vacancyNotice'], off: [] });
  });
});

describe('menuSections（ひな形ごとの項目。PRD D213・D275）', () => {
  const labels = (f: Features) => menuSections(terms, TODAY, f).flatMap((g) => g.items.map((i) => i.label));
  const titles = (f: Features) => menuSections(terms, TODAY, f).map((g) => g.title ?? null);
  const screens = (f: Features) => screenSections(terms, f).flatMap((g) => g.items.map((i) => i.label));
  it('すべて：5項目（{} と同じ。人の項目は上の段、基本情報は組むの子。PRD D390。ADR-0067・ADR-0074）', () => {
    expect(labels(applyTemplate('all'))).toEqual(labels({}));
    expect(labels({})).toHaveLength(5);
  });
  it('エキスパート機能が切のメニューは 予定・〈利用者さん〉・〈スタッフ〉・設定 の4つ、入は「組む」が増えて5つ（ホームは無い。PRD D383・D390。ADR-0073・ADR-0074）', () => {
    expect(labels({ expert: false })).toEqual(['予定', '利用者さん', 'スタッフ', '設定']);
    expect(labels({})).toEqual(['予定', '利用者さん', 'スタッフ', '組む', '設定']);
  });
  it('「組む」の子は機能の入り切りで変わらない項目だけ（基本情報・組み方の標準・担当を組む）。欠勤・空き状況を切っても子は同じ', () => {
    const kids = (f: Features) =>
      menuSections(terms, TODAY, f)
        .flatMap((g) => g.items)
        .find((i) => i.key === 'arrange')
        ?.children?.map((i) => i.key);
    expect(kids({})).toEqual(['arrange:basics', 'arrange:standard', 'arrange:assign']);
    expect(kids({ sudden: false, vacancy: false })).toEqual(['arrange:basics', 'arrange:standard', 'arrange:assign']);
  });
  it('基本は4項目（エキスパート機能が切）。画面の一覧は勤務の見込み・条件の重み・特性の項目が無い（案を比べるはいつも無い）', () => {
    // 基本はエキスパート機能が切：メニューは4つ・ホームは無い。組み方の標準は出ず、担当を組むだけ残る（空き状況は予定のグループ）
    expect(labels(applyTemplate('basic'))).toEqual(['予定', '利用者さん', 'スタッフ', '設定']);
    expect(screens(applyTemplate('basic'))).toEqual([
      '月の予定',
      '週の予定',
      '日の予定',
      '担当を組む',
      '空き状況',
      '予定と相性',
      '利用者さん',
      'スタッフ',
      '相性',
      '勤務時間（シフト）',
      '訪問の種類',
      '管理者設定',
      'データ',
    ]);
  });
  it('労務・契約管理：画面の一覧に勤務の見込みが戻る。案を比べる・条件の重みは無い', () => {
    const l = screens(applyTemplate('laborContract'));
    expect(l).toContain('勤務の見込み');
    expect(l).not.toContain('案を比べる');
    expect(l).not.toContain('条件の重み');
  });
  it('月次予定・現場共有：勤務の見込みは無い', () => {
    expect(screens(applyTemplate('monthlyField'))).not.toContain('勤務の見込み');
  });
  it('見出しは無い。欠勤・キャンセルと空き状況を切っても項目は変わらない', () => {
    expect(titles({})).toEqual([null]);
    // 空き状況・欠勤・キャンセルはメニューに無く、予定の操作の行にある（切っても項目は変わらない）
    expect(labels({ sudden: false, vacancy: false })).toEqual(['予定', '利用者さん', 'スタッフ', '組む', '設定']);
  });
  it('「設定」のタブは切った機能を出さない（基本は特性の項目が無い。条件の重みは予定を組む。ADR-0065）', () => {
    expect(settingsTabs({}).map((t) => t.to)).toEqual(['/types', '/items', '/settings', '/data']);
    expect(settingsTabs(applyTemplate('basic')).map((t) => t.to)).toEqual(['/types', '/settings', '/data']);
    expect(settingsTabs({ rules: false }).map((t) => t.to)).toEqual(['/types', '/settings', '/data']);
  });
  it('相性を切ると「人」のタブ・画面の一覧の相性が消える（設定のタブには元からない）', () => {
    expect(screens({ compat: false })).not.toContain('相性');
    expect(screens({})).toContain('相性');
  });
  it('下のタブは 予定・〈利用者さん〉・〈スタッフ〉・組む。空き状況・欠勤を切っても変わらない（PRD D336・D390）', () => {
    const keys = (f: Features) => bottomTabs(menuSections(terms, TODAY, f), f).map((t) => t.key);
    expect(keys({})).toEqual(['schedule', 'clients', 'staff', 'arrange']);
    expect(keys({ vacancy: false, sudden: false })).toEqual(['schedule', 'clients', 'staff', 'arrange']);
    // 組む（エキスパート機能）を切ると、メニューの4つ（設定まで）
    expect(keys({ expert: false })).toEqual(['schedule', 'clients', 'staff', 'settings']);
  });
});

/** 状態（既定は訪問3件・確定済み・問題なし） */
function st(date: string, x: Partial<DayStatus> = {}): DayStatus {
  return {
    date,
    count: 3,
    state: 'told',
    unassigned: 0,
    issues: new Map(),
    care: 0,
    changes: 0,
    absence: false,
    overSpan: [],
    needsCare: false,
    ...x,
  };
}
describe('表の整合（メニュー・パレット・要対応の帯・ツアー・links の行き先が、土台か表のどれかに属する）', () => {
  it('メニューの項目', () => {
    for (const g of menuSections(terms, TODAY, {})) for (const i of g.items) expect(belongs(i.to), i.to).toBe(true);
    for (const g of screenSections(terms, {})) for (const i of g.items) expect(belongs(i.to), i.to).toBe(true);
  });
  it('パレットの操作', () => {
    for (const a of paletteActions(TODAY)) expect(belongs(a.to), a.to).toBe(true);
  });
  it('要対応の帯の移る先（訪問・未確定・組み直し・標準が無い）', () => {
    const visit = st(TODAY, { issues: new Map([['v1', [{ kind: 'unassigned' as const, label: '担当なし' }]]]) });
    const open = { hasStandard: true, basisChanged: true, planYm: '2026-10', isOn: () => true };
    const gos = [
      attentionBand([visit], TODAY, undefined, open)?.go,
      attentionBand([st(TODAY, { state: 'none' }), st('2026-10-22', { state: 'none' })], TODAY, undefined, open)?.go,
      attentionBand([], TODAY, undefined, open)?.go,
      attentionBand([], TODAY, undefined, { ...open, hasStandard: false })?.go,
    ];
    expect(gos.every((g) => g !== undefined)).toBe(true);
    for (const g of gos) expect(belongs(g!.to), g!.to).toBe(true);
  });
  it('ツアーの枚の機能は表のどれか（無ければ土台）', () => {
    for (const s of tourSteps(terms)) if (s.feature) expect(FEATURE_IDS).toContain(s.feature);
  });
  it('links の行き先', () => {
    for (const h of [
      suddenHref(TODAY),
      suddenHref(TODAY, 's1'),
      dayHref(TODAY),
      unassignedHref(TODAY),
      workloadHref('2026-10'),
    ])
      expect(belongs(h), h).toBe(true);
  });
});

describe('切った機能の入口を出さない（PRD D213）', () => {
  it('パレット：欠勤・キャンセルを登録・問い合わせに答える', () => {
    const ids = (f: Features) => paletteActions(TODAY, { features: f }).map((a) => a.id);
    expect(ids({})).toContain('action:absence');
    expect(ids({ sudden: false })).not.toContain('action:absence');
    expect(ids({ vacancy: false })).not.toContain('action:vacancy');
    // expert 切（基本）は確定の段階の「確定していない日を見る」だけ出さない（ADR-0073）
    expect(ids(applyTemplate('basic'))).toEqual(ids({}).filter((id) => id !== 'action:unconfirmed'));
  });
  it('ツアー：欠勤・キャンセルの枚を出さず、枚数が減る（ホームの枚は無い。基本はすべてと同じ2枚）', () => {
    expect(tourSteps(terms, {}).map((s) => s.key)).toEqual(['plan', 'absence']);
    expect(tourSteps(terms, applyTemplate('basic')).map((s) => s.key)).toEqual(['plan', 'absence']);
    expect(tourSteps(terms, { sudden: false }).map((s) => s.key)).toEqual(['plan']);
  });
  it('links：切った機能なら null、土台はそのまま', () => {
    expect(linkIfOn({}, suddenHref(TODAY))).toBe(suddenHref(TODAY));
    expect(linkIfOn({ sudden: false }, suddenHref(TODAY, 's1'))).toBeNull();
    expect(linkIfOn({ workload: false }, workloadHref('2026-10', 's1'))).toBeNull();
    expect(linkIfOn({ workload: false, sudden: false }, unassignedHref(TODAY))).toBe(unassignedHref(TODAY));
    expect(linkIfOn(applyTemplate('basic'), dayHref(TODAY))).toBe(dayHref(TODAY));
  });
  it('月の要対応の行き先：切った機能なら、その日の日の画面', () => {
    const at = (kind: Attention['kind']): Attention => ({ date: TODAY, kind, count: 1, names: [], staffIds: ['s1'] });
    const day = { to: '/plan', date: TODAY, note: '（日の予定で開く）' };
    expect(attentionTarget(at('overSpan'), { workload: false })).toEqual(day);
    expect(attentionTarget(at('changed'), { sudden: false })).toEqual(day);
    expect(attentionTarget(at('overSpan'), {}).to).toBe('/workload?ym=2026-10&staff=s1');
    expect(attentionTarget({ ...at('care'), names: ['担当なし 1'] }, applyTemplate('basic')).to).toBe(
      unassignedHref(TODAY),
    );
  });
});

describe('turnOffImpact（切るときに残る・外れるデータ。PRD D215）', () => {
  const TODAY_I = '2026-11-05';
  const d0 = createDemoData('2026-11-02');
  // 利用中・休止の区別をはっきりさせる（先頭3人の〈利用者さん〉は利用中、4人目は終了。〈スタッフ〉は先頭2人が利用中、3人目は休止）
  const d = {
    ...d0,
    clients: d0.clients.map((c, i) =>
      i === 3 ? { ...c, active: false, stage: 'ended' as const } : { ...c, active: true },
    ),
    staff: d0.staff.map((x, i) => (i === 2 ? { ...x, active: false } : { ...x, active: true })),
  };
  const [c0, c1, c2, c3] = d.clients as [Client, Client, Client, Client];
  const [s0, s1, s2] = d.staff as [Staff, Staff, Staff];
  const data = {
    ...d,
    compat: {
      // 利用中×利用中の値のある組だけ数える（0・休止の〈スタッフ〉・終了の〈利用者さん〉は数えない）
      [c0.id]: { [s0.id]: -2 as const, [s1.id]: 0 as const, [s2.id]: 2 as const },
      [c1.id]: { [s0.id]: 2 as const },
      [c3.id]: { [s0.id]: -2 as const },
    },
    clients: d.clients.map((c) =>
      c.id === c0.id || c.id === c1.id
        ? { ...c, allowedStaffIds: [s0.id] }
        : // 休止の人だけに限った人・終了の人は計算に効かない
          c.id === c2.id || c.id === c3.id
          ? { ...c, allowedStaffIds: [s2.id] }
          : c,
    ),
    clientLeaves: [
      { id: 'l1', clientId: c0.id, from: '2026-11-03', to: '2026-11-05', note: '入院' },
      { id: 'l2', clientId: c1.id, from: '2026-11-10', to: '2026-11-10', note: '' },
      { id: 'l3', clientId: c1.id, from: '2026-11-01', to: '2026-11-04', note: '終わった休み' },
    ],
    absences: [
      { id: 'a1', staffId: s0.id, date: '2026-11-05', from: null, to: null, note: '希望休' },
      { id: 'a0', staffId: s0.id, date: '2026-11-04', from: null, to: null, note: '希望休' },
      { id: 'a2', staffId: s1.id, date: '2026-11-06', from: null, to: null, note: '病院' },
      { id: 'a3', staffId: s1.id, date: '2026-11-07', from: '09:00', to: '12:00', note: '' },
      { id: 'a4', staffId: s1.id, date: '2026-11-01', from: null, to: null, note: '過ぎた欠勤' },
    ],
  };
  it('相性は利用中の〈利用者さん〉×休止でない〈スタッフ〉の値のある組、担当を限るは計算で効く人で「計算から外れます」', () => {
    expect(turnOffImpact(data, 'compat', TODAY_I)).toEqual({ count: 2, text: '相性 2組は計算から外れます' });
    expect(turnOffImpact(data, 'allowedStaff', TODAY_I)).toEqual({
      count: 2,
      text: `担当を限る 2人（${d.org.terms.client}）は計算から外れます`,
    });
  });
  it('事実（休み・希望休・欠勤）は今日以降に掛かるものだけを「残り、計算に効き続けます」。呼び方を使う', () => {
    expect(turnOffImpact(data, 'clientLeave', TODAY_I)).toEqual({
      count: 2,
      text: `${d.org.terms.client}の休み 2件は残り、計算に効き続けます`,
    });
    expect(turnOffImpact(data, 'requestedOff', TODAY_I)).toEqual({
      count: 1,
      text: '希望休 1件は残り、計算に効き続けます',
    });
    expect(turnOffImpact(data, 'sudden', TODAY_I)).toEqual({ count: 2, text: '欠勤 2件は残り、計算に効き続けます' });
    // 今日が過ぎれば数えない
    expect(turnOffImpact(data, 'clientLeave', '2026-11-11')).toBeNull();
    expect(turnOffImpact(data, 'sudden', '2026-11-08')).toBeNull();
  });
  it('空き状況は仮押さえの〈利用者さん〉の件数で「予定に入り続けます」', () => {
    const held = { ...data, clients: data.clients.map((c, i) => (i < 2 ? { ...c, tentative: true } : c)) };
    expect(turnOffImpact(held, 'vacancy', TODAY_I)).toEqual({
      count: 2,
      text: `仮押さえ 2人（${d.org.terms.client}）は残り、予定に入り続けます`,
    });
    expect(turnOffImpact(data, 'vacancy', TODAY_I)).toBeNull();
  });
  it('呼び方を変えたデータでは、その呼び方で出す', () => {
    const renamed = {
      ...data,
      org: { ...data.org, terms: { ...data.org.terms, client: 'お客様', staff: 'シッター' } },
    };
    expect(turnOffImpact(renamed, 'allowedStaff', TODAY_I)?.text).toBe('担当を限る 2人（お客様）は計算から外れます');
    expect(turnOffImpact(renamed, 'clientLeave', TODAY_I)?.text).toBe('お客様の休み 2件は残り、計算に効き続けます');
    const held = { ...renamed, clients: renamed.clients.map((c, i) => (i === 0 ? { ...c, tentative: true } : c)) };
    expect(turnOffImpact(held, 'vacancy', TODAY_I)?.text).toBe('仮押さえ 1人（お客様）は残り、予定に入り続けます');
    const off = { ...renamed, staff: renamed.staff.map((x, i) => (i === 0 ? { ...x, lastDay: '2026-12-01' } : x)) };
    expect(turnOffImpact(off, 'offboard', TODAY_I)?.text).toBe('最終勤務日 1人（シッター）は残り、計算に効き続けます');
  });
  it('繰り返し：今ある定期パターンの数を「残り、予定に出続けます」で出す（無ければ null）', () => {
    const p = d.patterns[0]!;
    const two = {
      ...data,
      patterns: [
        { ...p, id: 'p1' },
        { ...p, id: 'p2' },
      ],
    };
    expect(turnOffImpact(two, 'patterns', TODAY_I)).toEqual({ count: 2, text: '繰り返し 2件は残り、予定に出続けます' });
    expect(turnOffImpact({ ...data, patterns: [] }, 'patterns', TODAY_I)).toBeNull();
  });
  it('定期パターンは毎月・曜日ごとの時刻を使うものだけ数える', () => {
    const p = d.patterns[0]!;
    const withMonthly = {
      ...data,
      patterns: [
        { ...p, id: 'p1', repeat: 'monthly' as const, monthWeeks: [1] },
        { ...p, id: 'p2', repeat: 'weekly' as const, monthWeeks: [], dayTimes: [] },
      ],
    };
    expect(turnOffImpact(withMonthly, 'patternMonthly', TODAY_I)).toEqual({
      count: 1,
      text: '定期パターンの毎月・曜日ごとの時刻 1件は残り、訪問は今どおり作られます',
    });
  });
  it('データが無い・数えない機能は null（確認を出さない）', () => {
    const empty = { ...data, compat: {}, clientLeaves: [], absences: [] };
    expect(turnOffImpact(empty, 'compat', TODAY_I)).toBeNull();
    expect(turnOffImpact(empty, 'clientLeave', TODAY_I)).toBeNull();
    expect(turnOffImpact(empty, 'requestedOff', TODAY_I)).toBeNull();
    expect(turnOffImpact(empty, 'sudden', TODAY_I)).toBeNull();
    expect(turnOffImpact(data, 'monthPrint', TODAY_I)).toBeNull();
    expect(turnOffImpact(data, 'compare', TODAY_I)).toBeNull();
  });
});
