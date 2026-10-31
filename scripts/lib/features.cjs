// e2e の共通：機能の入り切り（e2e-features.cjs・e2e-features2.cjs。PRD D210〜D216。ADR-0028）の
// 機能の ID・ひな形ごとの入る機能・メニューと画面の名前・画面を開く・メニューとパレットを読む・ひな形を適用する部品
const { BASE, TODAY, STORAGE_KEY, settle } = require('./env.cjs');
const { goTo, openDetails } = require('./ui.cjs');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 機能の ID（src/contracts/features.ts の FEATURE_IDS と同じ順） */
const FEATURE_IDS = [
  'patterns',
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
const BASIC_ON = ['patterns', 'sudden', 'vacancy', 'compat', 'mapsLink', 'geocode'];
const TEMPLATE_ON = {
  oneOff: BASIC_ON.filter((id) => id !== 'patterns'),
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
  oneOff: '単発のみ',
  basic: '基本',
  laborContract: '労務・契約管理',
  monthlyField: '月次予定・現場共有',
  all: 'すべて',
};
const asFeatures = (on) => Object.fromEntries(FEATURE_IDS.map((id) => [id, on.includes(id)]));

/** エキスパート機能が入のメニューの最上位（5つ。子の項目を持つのは「組む」だけ。ホーム・空き状況は無い。PRD D390。ADR-0074 段1） */
const MENU = ['予定', '利用者さん', 'スタッフ', '組む', '設定'];
/** エキスパート機能が切のメニュー（4つ：予定・〈利用者さん〉・〈スタッフ〉・設定。子の項目なし。呼び名は初期データの利用者さん・スタッフ。ADR-0073。PRD D383） */
const MENU_NO_EXPERT = ['予定', '利用者さん', 'スタッフ', '設定'];
/** 組むの子の項目の key（すべて入：基本情報・組み方の標準・担当を組む。作業の順。条件の重みは子に入れない。〈利用者さん〉・〈スタッフ〉は上の段。ADR-0067・ADR-0074） */
const ARRANGE_KIDS = ['arrange:basics', 'arrange:standard', 'arrange:assign'];
/** 組み方の標準を登録したあとの組むの子（基本情報・担当を組む。標準の組み直しは担当を組むの見出しの［標準の組み方を変える］から） */
const ARRANGE_KIDS_WITH_STANDARD = ['arrange:basics', 'arrange:assign'];
/** 基本情報（予定と相性）のタブ（入のとき。〈利用者さん〉・〈スタッフ〉は人のタブの画面なので入れない。相性はどのひな形でも入。ADR-0067・ADR-0074 段3） */
const BASICS_TABS = ['予定と相性', '相性', '勤務時間（シフト）'];
/** エキスパート機能が入の画面の一覧（パレットの画面。ホームは無い。人の1グループ（〈利用者さん〉・〈スタッフ〉は呼び名そのまま・相性・勤務）と、組むの先頭に予定と相性。PRD D273・D275・D390・D394） */
const EXPERT_SCREENS = [
  '月の予定',
  '週の予定',
  '日の予定',
  '空き状況',
  '利用者さん',
  'スタッフ',
  '相性',
  '勤務時間（シフト）',
  '勤務の見込み',
  '予定と相性',
  '条件の重み',
  '組み方の標準',
  '担当を組む',
  '訪問の種類',
  '特性の項目',
  '管理者設定',
  'データ',
];
/** エキスパート機能が切の画面の一覧（ホームは無い。担当を組む・空き状況は予定のグループ。ADR-0073） */
const ALL_SCREENS = [
  '月の予定',
  '週の予定',
  '日の予定',
  '条件の重み',
  '組み方の標準',
  '担当を組む',
  '空き状況',
  '予定と相性',
  '利用者さん',
  'スタッフ',
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
/** パレットの画面（ホームは無い。ADR-0073・ADR-0074） */
const screensFor = (t) =>
  (TEMPLATE_ON[t].includes('expert') ? EXPERT_SCREENS : ALL_SCREENS).filter((l) => !HIDDEN[t].includes(l));
/** 組むの子の項目の key（子は機能の入り切りで変わらない。標準を登録したあとは担当を組むだけ。ADR-0066） */
const arrangeKidsFor = (t, hasStandard = false) =>
  TEMPLATE_ON[t].includes('expert') ? (hasStandard ? ARRANGE_KIDS_WITH_STANDARD : ARRANGE_KIDS) : [];
/** 「人」の子の項目（メニュー4つにしたので、入でも切でも無い。ADR-0073） */
const peopleKidsFor = () => [];
/** 設定のタブ（ひな形ごと。特性の項目は rules を切ると出さない。条件の重み・組み方の標準は予定を組む。ADR-0063・ADR-0066） */
const SETTINGS_TABS = ['訪問の種類', '特性の項目', '管理者設定', 'データ'];
const settingsTabsFor = (t) => SETTINGS_TABS.filter((l) => !HIDDEN[t].includes(l));
/** メニューの最上位（入は5つ・切は4つ。空き状況・欠勤の入り切りでは変わらない。ADR-0074） */
const menuFor = (on) => (on.includes('expert') ? MENU : MENU_NO_EXPERT);
/** 予定の子の項目（無い：子を持つのは入の「組む」だけ） */
const scheduleKidsFor = () => [];
/** 設定の子の項目（無い：設定のタブは画面の上に出る） */
const settingsKidsFor = () => [];
/** 下のタブ（「探す」「メニュー」はボタン。入は 予定・〈利用者さん〉・〈スタッフ〉・組む、切は メニューの4つ。PRD D390） */
const tabsFor = (on) => (on.includes('expert') ? ['予定', '利用者さん', 'スタッフ', '組む'] : MENU_NO_EXPERT);
/** 起動・#/home の URL の行き先（入切とも予定の画面：繰り返しを使うなら月、使わないなら週。ADR-0073・ADR-0074） */
const homeHashFor = (on) => (on.includes('patterns') ? '#/month' : '#/week');
/** 起動の画面を開く（予定の上のナビの行を待つ） */
const openHome = (page, on) => open(page, homeHashFor(on).slice(1), '[data-testid="sched-nav"]');

/** 切った機能の URL（ひな形ごとに、予定の画面へ移るもの・移らないもの） */
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

/** 画面を新しく開く（共通の手 goTo） */
const open = (page, hash, ready = 'h1') => goTo(page, hash, { ready });
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
/** 〈利用者さん〉・〈スタッフ〉の小さいタブ（入切とも。to の一覧を開いて読む。タブの名前の並び。PRD D394） */
async function peopleTabs(page, to) {
  await open(page, to, '[data-testid="people-tabs"]');
  return (await page.getByTestId('people-tabs').locator('a').allInnerTexts()).map((x) => x.trim());
}
/** 小さいタブ（入切とも）：〈利用者さん〉＝一覧・相性、〈スタッフ〉＝一覧・勤務・相性（相性はどのひな形でも入。勤務時間（シフト）は土台） */
const CLIENT_TABS = ['一覧', '相性'];
const STAFF_TABS = ['一覧', '勤務', '相性'];
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
  // ひな形の5つは畳んである（PRD D395）。開いてから押す
  await openDetails(page, 'feature-templates-fold');
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
  BASICS_TABS,
  ALL_SCREENS,
  EXPERT_SCREENS,
  HIDDEN,
  screensFor,
  SETTINGS_TABS,
  settingsTabsFor,
  settingsKidsFor,
  homeHashFor,
  openHome,
  menuFor,
  scheduleKidsFor,
  tabsFor,
  ROUTES,
  open,
  storedFeatures,
  TOP_LINKS,
  menu,
  basicsTabs,
  peopleTabs,
  CLIENT_TABS,
  STAFF_TABS,
  paletteItems,
  paletteSearch,
  applyTemplate,
  writeFeaturesInOtherTab,
};
