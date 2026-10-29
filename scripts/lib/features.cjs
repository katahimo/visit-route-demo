// e2e の共通：機能の入り切り（e2e-features.cjs・e2e-features2.cjs。PRD D210〜D216。ADR-0028）の
// 機能の ID・ひな形ごとの入る機能・メニューと画面の名前・画面を開く・メニューとパレットを読む・ひな形を適用する部品
const { BASE, TODAY, STORAGE_KEY, settle } = require('./env.cjs');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 機能の ID（src/contracts/features.ts の FEATURE_IDS と同じ順） */
const FEATURE_IDS = [
  'patternMonthly',
  'clientLeave',
  'requestedOff',
  'monthPrint',
  'expert',
  'compare',
  'sudden',
  'vacancy',
  'vacancyNotice',
  'compat',
  'allowedStaff',
  'clientStage',
  'visitNotes',
  'offboard',
  'workload',
  'fare',
  'rules',
  'mail',
  'mapsLink',
  'geocode',
  'excel',
];
/** ひな形で入れる機能（ADR-0028 の表） */
const BASIC_ON = ['sudden', 'vacancy', 'compat', 'mapsLink', 'geocode'];
const TEMPLATE_ON = {
  basic: BASIC_ON,
  laborContract: [...BASIC_ON, 'clientStage', 'offboard', 'workload', 'fare'],
  monthlyField: [
    ...BASIC_ON,
    'patternMonthly',
    'clientLeave',
    'requestedOff',
    'monthPrint',
    'vacancyNotice',
    'allowedStaff',
    'visitNotes',
    'excel',
  ],
  all: FEATURE_IDS,
};
const TEMPLATE_LABEL = {
  basic: '基本',
  laborContract: '労務・契約管理',
  monthlyField: '月次予定・現場共有',
  all: 'すべて',
};
const asFeatures = (on) => Object.fromEntries(FEATURE_IDS.map((id) => [id, on.includes(id)]));

/** メニューの最上位（5項目。予定・予定を組む・設定は畳める子の項目を持つ。「人」は無い。PRD D349・D361。ADR-0067） */
const MENU = ['ホーム', '予定を組む', '予定', '空き状況', '設定'];
/** エキスパート機能が切のメニュー（「予定を組む」の代わりに「人」。ADR-0072） */
const MENU_NO_EXPERT = ['ホーム', '予定', '人', '空き状況', '設定'];
/** 予定を組むの子の項目の key（すべて入：基本情報・組み方の標準・担当を組む。作業の順。条件の重みは子に入れない。ADR-0067） */
const ARRANGE_KIDS = ['arrange:basics', 'arrange:clients', 'arrange:staff', 'arrange:standard', 'arrange:assign'];
/** 組み方の標準を登録したあとの予定を組むの子（基本情報・担当を組む。標準の組み直しは担当を組むの見出しの［標準の組み方を変える］から） */
const ARRANGE_KIDS_WITH_STANDARD = ['arrange:basics', 'arrange:clients', 'arrange:staff', 'arrange:assign'];
/** 基本情報のタブ（人のタブ。先頭に「予定と相性」。相性はどのひな形でも入。ADR-0067） */
const PEOPLE_KIDS = ['予定と相性', '利用者さん', 'スタッフ', '相性', '勤務時間（シフト）'];
/** すべて入の画面の一覧（パレットの画面。メニューから外した画面も1つずつ。PRD D273・D275） */
const ALL_SCREENS = [
  'ホーム',
  '月の予定',
  '週の予定',
  '日の予定',
  '条件の重み',
  '組み方の標準',
  '担当を組む',
  '空き状況',
  '予定と相性',
  '利用者さん一覧',
  'スタッフ一覧',
  '相性',
  '勤務時間（シフト）',
  '勤務の見込み',
  '訪問の種類',
  '特性の項目',
  '管理者設定',
  'データ',
];
/** ひな形ごとの、パレットの画面に出ない画面 */
const HIDDEN = {
  basic: ['勤務の見込み', '条件の重み', '組み方の標準', '特性の項目'],
  laborContract: ['条件の重み', '組み方の標準', '特性の項目'],
  monthlyField: ['勤務の見込み', '条件の重み', '組み方の標準', '特性の項目'],
  all: [],
};
const screensFor = (t) => ALL_SCREENS.filter((l) => !HIDDEN[t].includes(l));
/** 予定を組むの子の項目の key（子は機能の入り切りで変わらない。標準を登録したあとは担当を組むだけ。ADR-0066） */
const arrangeKidsFor = (t, hasStandard = false) =>
  TEMPLATE_ON[t].includes('expert') ? (hasStandard ? ARRANGE_KIDS_WITH_STANDARD : ARRANGE_KIDS) : [];
/** 「人」の子の項目の key（エキスパート機能が切のとき。予定と相性・〈利用者さん〉一覧・〈スタッフ〉一覧。ADR-0072） */
const PEOPLE_MENU_KIDS = ['people:basics', 'people:clients', 'people:staff'];
/** 人の子（入のときは無い） */
const peopleKidsFor = (t) => (TEMPLATE_ON[t].includes('expert') ? [] : PEOPLE_MENU_KIDS);
/** 設定のタブ（ひな形ごと。特性の項目は rules を切ると出さない。条件の重み・組み方の標準は予定を組む。ADR-0063・ADR-0066） */
const SETTINGS_TABS = ['訪問の種類', '特性の項目', '管理者設定', 'データ'];
const settingsTabsFor = (t) => SETTINGS_TABS.filter((l) => !HIDDEN[t].includes(l));
/** メニューの最上位は空き状況を切ると減る */
const menuFor = (on) =>
  (on.includes('expert') ? MENU : MENU_NO_EXPERT).filter((l) => l !== '空き状況' || on.includes('vacancy'));
/** 予定の子の項目の key（今日の予定・◯月の予定・欠勤・キャンセル。欠勤・キャンセルは sudden を切ると出さない） */
const scheduleKidsFor = (on) =>
  ['today', 'month-view', 'absence'].filter((k) => k !== 'absence' || on.includes('sudden'));
/** 下のタブ（ホーム・予定・欠勤。「探す」「メニュー」はボタン。空き状況は下のタブに無い。PRD D336） */
const tabsFor = (on) => ['ホーム', '予定', '欠勤'].filter((l) => l !== '欠勤' || on.includes('sudden'));

/** 切った機能の URL（ひな形ごとに、ホームへ移るもの・移らないもの） */
const ROUTES = [
  { hash: '/compare', feature: 'compare' },
  { hash: '/workload', feature: 'workload' },
  { hash: '/standard', feature: 'expert' },
  { hash: '/rules', feature: 'rules' },
  { hash: '/items', feature: 'rules' },
  { hash: '/vacancy', feature: 'vacancy' },
  { hash: '/compat', feature: 'compat' },
  { hash: `/month/print?ym=${TODAY.slice(0, 7)}`, feature: 'monthPrint' },
  { hash: `/plan?date=${TODAY}&do=absence`, feature: 'sudden' },
];

/** 画面を新しく開く（about:blank を挟み、`?do=` を読み直す前に消さない） */
async function open(page, hash, ready = 'h1') {
  await page.goto('about:blank');
  await page.goto(`${BASE}#${hash}`);
  await page.locator(ready).first().waitFor({ timeout: 30000 });
  await page.locator('h1').filter({ hasText: /\S/ }).first().waitFor({ timeout: 30000 });
}
/** 保存したデータの入り切り */
const storedFeatures = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').org?.features ?? null, STORAGE_KEY);
/** メニューの最上位の項目（子の無い項目と、畳める親の行の項目） */
const TOP_LINKS =
  '.nav-groups > .nav-group > .nav-link, .nav-groups > .nav-group > .nav-parent > .nav-parent-row > .nav-link';
/**
 * 左のメニュー（見出し・最上位の項目名・親ごとの子の項目）。畳んでいる親は ▾ で開いてから子を読む
 * （子の中身を確かめるため。開け閉めは覚えるが、今の画面の親はいつも開くので以降の確かめには響かない）
 */
async function menu(page, root = '.side-nav') {
  const side = page.locator(root);
  for (const t of await side.locator('[data-testid="nav-toggle"][aria-expanded="false"]').all()) await t.click();
  const kids = {};
  for (const p of await side.locator('.nav-parent').all()) {
    const key = await p.getAttribute('data-parent');
    const links = p.locator('.nav-sub > .nav-link.nav-child');
    const keys = await links.evaluateAll((els) => els.map((el) => el.dataset.key));
    const names = await links.evaluateAll((els) => els.map((el) => el.querySelector(':scope > span').textContent));
    kids[key] = keys.map((k, i) => ({ key: k, label: names[i] }));
  }
  return {
    titles: await side.locator('.nav-group-title').allInnerTexts(),
    labels: await side
      .locator(TOP_LINKS)
      .evaluateAll((els) => els.map((el) => el.querySelector(':scope > span:not(.nav-badge)')?.textContent ?? '')),
    schedule: (kids.schedule ?? []).map((k) => k.key),
    arrange: (kids.arrange ?? []).map((k) => k.key),
    people: (kids.people ?? []).map((k) => k.key),
    settings: (kids.settings ?? []).map((k) => k.label),
  };
}
/** 基本情報のタブ（#/basics を開いて読む。タブの名前の並び） */
async function basicsTabs(page) {
  await open(page, '/basics', '[data-testid="people-tabs"]');
  return (await page.getByTestId('people-tabs').locator('a').allInnerTexts()).map((x) => x.trim());
}
/** パレットの候補（打つ前＝操作と画面） */
async function paletteItems(page) {
  await page.getByTestId('cmdk-open').click();
  await page.getByTestId('cmdk').waitFor();
  const items = await page
    .getByTestId('cmdk-option')
    .evaluateAll((els) =>
      els.map((el) => ({ kind: el.dataset.kind, label: el.querySelector('.cmdk-option-label').textContent })),
    );
  await page.keyboard.press('Escape');
  await page.getByTestId('cmdk').waitFor({ state: 'detached' });
  return {
    screens: items.filter((i) => i.kind === 'screen').map((i) => i.label),
    actions: items.filter((i) => i.kind === 'action').map((i) => i.label),
  };
}
/** パレットで打って絞り込んだ候補の名前 */
async function paletteSearch(page, text) {
  await page.getByTestId('cmdk-open').click();
  await page.getByTestId('cmdk-input').pressSequentially(text, { delay: 20 });
  await settle(page, 150);
  const labels = await page.locator('[data-testid="cmdk-option"] .cmdk-option-label').allInnerTexts();
  await page.keyboard.press('Escape');
  await page.getByTestId('cmdk').waitFor({ state: 'detached' });
  return labels;
}
/** 管理者設定でひな形を適用する（確認に答える） */
async function applyTemplate(page, dlg, id, answer = true) {
  await open(page, '/settings', '[data-testid="feature-templates"]');
  dlg.messages.length = 0;
  dlg.answer = answer;
  await page.locator(`[data-template="${id}"] [data-testid="feature-template-apply"]`).click();
  await settle(page, 400);
  dlg.answer = true;
  return dlg.messages.slice();
}
/** 機能の入り切りを別のタブで書き換える（アプリの外の書き換え。読み直して確かめる） */
async function writeFeaturesInOtherTab(ctx, features) {
  const other = await ctx.newPage();
  await other.goto(`${BASE}#/data`);
  await other.locator('h1').first().waitFor({ timeout: 30000 });
  await other.evaluate(
    ([key, f]) => {
      const d = JSON.parse(localStorage.getItem(key));
      d.org.features = f;
      localStorage.setItem(key, JSON.stringify(d));
    },
    [STORAGE_KEY, features],
  );
  await other.close();
}

module.exports = {
  same,
  FEATURE_IDS,
  BASIC_ON,
  TEMPLATE_ON,
  TEMPLATE_LABEL,
  asFeatures,
  MENU,
  ARRANGE_KIDS,
  ARRANGE_KIDS_WITH_STANDARD,
  arrangeKidsFor,
  peopleKidsFor,
  PEOPLE_KIDS,
  ALL_SCREENS,
  HIDDEN,
  screensFor,
  SETTINGS_TABS,
  settingsTabsFor,
  menuFor,
  scheduleKidsFor,
  tabsFor,
  ROUTES,
  open,
  storedFeatures,
  TOP_LINKS,
  menu,
  basicsTabs,
  paletteItems,
  paletteSearch,
  applyTemplate,
  writeFeaturesInOtherTab,
};
