// 機能の入り切り その1（PRD D210〜D213・D216。ADR-0028）を本物のブラウザで確かめる：
// すべて入（初期データ。e2e は初回もすべて入に固定。PRD D276）でメニューの最後に「設定」（タブに管理者設定・データ）、管理者設定の画面（見出し・説明・ひな形の5つ・
// 「いまの設定」とカスタムの印・22のスイッチの role=switch・aria-checked・名前・説明）。
// ひな形の5通り（基本・月次予定・現場共有・すべては管理者設定で適用する（独自の確認ダイアログに入る機能・切れる機能、取り消すと変わらない）、
// 労務・契約管理は別のタブで localStorage を書き換えて作る）ごとに、メニューの項目（入は 予定・空き状況・〈利用者さん〉・〈スタッフ〉・組む・設定 の6項目で、空き状況の機能を切ると空き状況が消える（欠勤・キャンセルの入り切りでは変わらない）。
// 子は組むだけ：基本情報・組み方の標準・担当を組む。ADR-0063・ADR-0067・ADR-0074）・設定のタブ・下のタブ・パレットの画面と操作・ホームのいつでもの入口・
// 切った機能の URL（`?do=` も）を開くと予定の画面へ移り（replace）、その上に閉じられる知らせと管理者設定へのリンク、
// スイッチ（押すとすぐ保存・トースト・依存先が切なら押せず理由）、390px で横にはみ出さない、印刷で知らせ・メニューを出さない。
// 末尾の /・大文字の URL（#/vacancy/・#/Vacancy・#/month/print/）も予定の画面へ移す、390px で空き状況を切っても下のタブ6つが全幅を等分、
// 稼働の見込み・欠勤・キャンセル・月の印刷・提案を比べるを切ると、月の要対応の行・月のボタン・日の画面の拘束の帯・担当を組むの「案を比べる」・
// 稼働時間の右の欄にそこへ移るリンク・ボタンが無い（日の予定に「AI で組む ▾」は無い。ADR-0063）。
// 希望休のまとめ入力を切っても月の「担当が休み」の印は出す、欠勤・キャンセルを切ると稼働時間の凡例で登録の場所を出さない。
// エキスパート機能が切のひな形（単発のみ・基本・労務・契約管理・月次予定・現場共有）は、メニューが5つ（予定・空き状況・〈利用者さん〉・〈スタッフ〉・設定。子なし。下のタブは 予定・空き状況・〈利用者さん〉・〈スタッフ〉＋探す・メニュー。ADR-0080）・下のタブは6つ・ホームは無く予定の画面へ移る（ADR-0073。PRD D400。詳しくは e2e-simple-menu）。
// その2（画面の中の入口・相性を切る・切ったまま保存してもデータが残る）は e2e-features2.cjs（並列に走らせるため2本）。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-features.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const path = require('node:path');
const { answerConfirms } = require('./lib/confirmDialog.cjs');
const { BASE, OUT_DIR, TODAY, STORAGE_KEY, check, hashOf, runSteps, settle } = require('./lib/env.cjs');
const { planDays } = require('./lib/plan.cjs');
const { markStandard } = require('./lib/standard.cjs');
const { sharedPage, openPage } = require('./lib/steps.cjs');
const {
  same,
  FEATURE_IDS,
  TEMPLATE_ON,
  TEMPLATE_LABEL,
  asFeatures,
  MENU,
  withoutVacancy,
  ARRANGE_KIDS,
  arrangeKidsFor,
  peopleKidsFor,
  BASICS_TABS,
  screensFor,
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
  menu,
  basicsTabs,
  peopleTabs,
  CLIENT_TABS,
  STAFF_TABS,
  paletteItems,
  paletteSearch,
  applyTemplate,
  writeFeaturesInOtherTab,
} = require('./lib/features.cjs');
const { accessibleInfo, clickMenu, openDetails, reveal, toolCount } = require('./lib/ui.cjs');

// ---- すべて入（初期データ）：メニューと管理者設定の画面 ----
async function allOn(page) {
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await open(page, '/month', '[data-testid="sched-nav"]');
  const m = await menu(page);
  check(m.labels.at(-1) === '設定', 'すべて入：メニューの最後は「設定」', m.labels);
  check(
    same(m.labels, MENU),
    'すべて入：メニューの最上位は 予定・空き状況・〈利用者さん〉・〈スタッフ〉・組む・設定 の6項目（ホームは無い）',
    m.labels,
  );
  check(
    same(m.schedule, scheduleKidsFor(FEATURE_IDS)) &&
      same(m.arrange, ARRANGE_KIDS) &&
      same(m.settings, settingsKidsFor('all')),
    'すべて入：子の項目は組む（基本情報・組み方の標準・担当を組む）だけ。予定・設定に子は無い',
    m,
  );
  check(
    same(await storedFeatures(page), {}),
    '初期データの入り切りは {}（e2e は初回もすべて入に固定）',
    await storedFeatures(page),
  );

  await clickMenu(page, '設定');
  await page.getByTestId('settings-tabs').waitFor();
  await page.getByTestId('settings-tabs').getByRole('link', { name: '管理者設定' }).click();
  await page.waitForURL(/#\/settings/);
  await page.getByTestId('feature-templates').waitFor();
  check((await page.locator('h1').innerText()) === '管理者設定', '管理者設定：見出し');
  check(
    (await page.locator('.page-lead').innerText()).includes('切った機能のデータは消えません'),
    '管理者設定：説明の文',
  );
  check(
    (await page.locator('.side-nav [aria-current="page"]').count()) === 1 &&
      (await page.locator('.side-nav [aria-current="page"]').getAttribute('data-key')) === 'settings' &&
      (await page.getByTestId('settings-tabs').locator('[aria-current="page"]').innerText()).trim() === '管理者設定',
    '管理者設定：メニューの今の画面の印は「設定」（子は無い）、設定のタブは「管理者設定」',
  );
  // 設定の見せ方（PRD D395。ADR-0074）：ひな形は今のものの名前だけ出して畳み、スイッチの行は名前と1行の説明（隠れるものは ⓘ）
  check(
    (await page.getByTestId('feature-template-current').innerText()).trim() === 'いま：すべての機能' &&
      (await page.getByRole('img', { name: '今のひな形：すべての機能' }).count()) === 1,
    'ひな形：見出しの横に「いま：すべての機能」だけ出す（読み上げは「今のひな形：すべての機能」）',
  );
  check(
    (await page.getByTestId('feature-templates-fold').getAttribute('open')) === null &&
      !(await page.getByTestId('feature-template').first().isVisible()),
    'ひな形の5つは閉じて始める（「詳しく ▾」の中）',
  );
  await openDetails(page, 'feature-templates-fold');
  check(await page.getByTestId('feature-template').first().isVisible(), 'ひな形の「詳しく ▾」を開くと5つが見える');
  const vacRow = page.locator('[data-feature="vacancy"]');
  const rowText = await vacRow.innerText();
  check(
    rowText.includes('空き') &&
      !rowText.includes('切ると隠れるもの') &&
      (await vacRow.locator('details.hint').count()) === 1,
    'スイッチの行は名前と1行の説明（切ると隠れるものは ⓘ の中）',
    rowText,
  );
  const textHeight = () => vacRow.locator('.feature-text').evaluate((el) => el.getBoundingClientRect().height);
  check((await textHeight()) < 80, 'スイッチの行は短い（名前・説明1行・ⓘ）', await textHeight());
  const summary = vacRow.locator('details.hint > summary');
  check(
    (await summary.innerText()).trim() === '説明' && (await summary.getAttribute('aria-label')) === '空き状況の説明',
    'ⓘ のラベルは「説明」（読み上げは「空き状況の説明」）',
  );
  // スクロールで動かないよう、説明の行の上端からの距離で比べる
  const sumTop = () =>
    summary.evaluate((el) => el.getBoundingClientRect().top - el.closest('li').getBoundingClientRect().top);
  const top0 = await sumTop();
  await summary.click();
  check(
    (await vacRow.innerText()).includes('切ると隠れるもの：') && Math.abs((await sumTop()) - top0) < 1,
    'ⓘ を開くと「切ると隠れるもの」が出る（情報は消えず、ⓘ は動かない）',
  );
  await summary.click();
  const noticeRow = page.locator('[data-feature="vacancyNotice"]');
  const closedText = await noticeRow.innerText();
  await noticeRow.locator('details.hint > summary').click();
  check(
    !closedText.includes('入っているときに使えます') &&
      (await noticeRow.locator('.hint-body').innerText()).includes('「空き状況」が入っているときに使えます'),
    '依存の注記（依存先が入）は ⓘ の中',
  );
  await noticeRow.locator('details.hint > summary').click();
  const tmpl = await page.getByTestId('feature-template').evaluateAll((els) => els.map((el) => el.dataset.template));
  check(same(tmpl, ['oneOff', 'basic', 'laborContract', 'monthlyField', 'all']), 'ひな形の5つの並び', tmpl);
  const now = await page
    .locator('[data-testid="feature-template"]:has([data-testid="feature-template-now"])')
    .evaluateAll((els) => els.map((el) => el.dataset.template));
  check(same(now, ['all']), '「いまの設定」は すべて', now);
  check((await page.getByTestId('feature-custom').count()) === 0, 'すべて入ではカスタムの印を出さない');
  const sw = await page
    .getByRole('switch')
    .evaluateAll((els) =>
      els.map((el) => ({ checked: el.getAttribute('aria-checked'), disabled: el.getAttribute('aria-disabled') })),
    );
  check(sw.length === 22 && sw.every((s) => s.checked === 'true' && s.disabled === null), 'スイッチは22・すべて入', sw);
  // スイッチは1枚のカード（feature-switches）の中にグループ（ADR-0092）。各グループ見出しに「N / M 入」
  const groups = await page.getByTestId('feature-switches').getByTestId('feature-group').count();
  const counts = await page.getByTestId('feature-group-count').allInnerTexts();
  check(
    groups === 7 && (await page.getByTestId('feature-group').count()) === 7 && counts.length === 7,
    '管理者設定のスイッチは1枚のカードの中にグループ7つ',
    { groups, counts },
  );
  check(
    counts.every((t) => /^(\d+) \/ \1 入$/.test(t.replace(/\s+/g, ' ').trim())),
    'すべて入では各グループの見出しが「M / M 入」',
    counts,
  );
  const vac = page.getByRole('switch', { name: '空き状況', exact: true });
  check((await vac.count()) === 1, 'スイッチの名前（読み上げ）：「空き状況」');
  // ⓘ を閉じたまま、AX ツリーでの説明（読み上げ）に説明と隠れるものが入る（閉じた <details> の中は入らないので、外の写しを指す）
  const { description: desc } = await accessibleInfo(page, vac);
  check(
    desc.includes('切ると隠れるもの：') && desc.includes('空き'),
    'スイッチの説明（AX ツリー）に説明と隠れるもの（ⓘ を閉じたまま）',
    desc,
  );
  const notice = page.getByRole('switch', { name: '空き枠の案内文' });
  const noticeInfo = await accessibleInfo(page, notice);
  check(
    noticeInfo.description.includes('切ると隠れるもの：') &&
      noticeInfo.description.includes('「空き状況」が入っているときに使えます'),
    '依存のある機能は依存の注記も読む（ⓘ を閉じたまま。AX ツリー）',
    noticeInfo.description,
  );
  const leave = await page.locator('[data-feature="clientLeave"] strong').innerText();
  check(leave === '利用者さんの休み', '機能の名前の呼び方は org.terms', leave);
  await page.screenshot({ path: path.join(OUT_DIR, 'settings-all.png'), fullPage: true });
}

// ---- スイッチ：押すとすぐ保存・トースト・依存・カスタム・切った URL ----
async function switches(page) {
  await open(page, '/settings', '[data-testid="feature-templates"]');
  const vac = page.getByRole('switch', { name: '空き状況', exact: true });
  await vac.click();
  await page.locator('.toast').filter({ hasText: '空き状況を切りました' }).waitFor({ timeout: 5000 });
  check(true, 'トースト「空き状況を切りました」');
  check((await vac.getAttribute('aria-checked')) === 'false', '押すと aria-checked が false');
  check(await vac.evaluate((el) => document.activeElement === el), '押したあともフォーカスはスイッチ');
  await settle(page, 500);
  check((await storedFeatures(page)).vacancy === false, 'すぐ保存（org.features.vacancy＝false）');
  const notice = page.getByRole('switch', { name: '空き枠の案内文' });
  check(
    (await notice.getAttribute('aria-checked')) === 'false' && (await notice.getAttribute('aria-disabled')) === 'true',
    '依存先が切：空き枠の案内文は切で押せない（aria-disabled）',
  );
  const reason = await page.locator('[data-feature="vacancyNotice"] .feature-req').innerText();
  check(reason === '「空き状況」を入れると使えます', '押せない理由', reason);
  check(
    (await page.locator('[data-feature="vacancyNotice"] .feature-text > .feature-req').isVisible()) === true,
    '押せない理由は行に出す（ⓘ を開かなくても読める）',
  );
  // aria-disabled（フォーカスは残す）なので、押すと何もしないことを確かめる
  await notice.click({ force: true });
  await settle(page, 300);
  check((await storedFeatures(page)).vacancyNotice === undefined, '押せないスイッチを押しても書かない');
  check(
    (await page.getByTestId('feature-custom').count()) === 1 &&
      (await page.getByTestId('feature-custom').innerText()).trim() === 'いま：カスタム' &&
      (await page.getByRole('img', { name: '今のひな形：カスタム' }).count()) === 1,
    'どのひな形とも違えば「いま：カスタム」（読み上げは「今のひな形：カスタム」）',
  );
  check((await page.getByTestId('feature-template-now').count()) === 0, 'カスタムでは「いまの設定」を出さない');
  const tabs = await page.getByTestId('bottom-tab').allInnerTexts();
  check(!tabs.includes('空き状況'), '下のタブから空き状況が消える（DOM）', tabs);
  const m = await menu(page);
  check(
    same(m.labels, withoutVacancy(MENU)),
    '空き状況を切るとメニューから「空き状況」が消える（残りは 予定・〈利用者さん〉・〈スタッフ〉・組む・設定 の5項目。PRD D401）',
    m,
  );

  // 切った機能の URL → 予定の画面へ（replace）・知らせ・管理者設定へのリンク
  await open(page, '/staff');
  await page.goto(`${BASE}#/vacancy`);
  await page.getByTestId('feature-off-notice').waitFor({ timeout: 10000 });
  check(/^#\/month/.test(hashOf(page)), '切った機能の URL（#/vacancy）は予定の画面（月）へ', hashOf(page));
  const text = await page.getByTestId('feature-off-notice').innerText();
  check(text.includes('この機能は管理者設定で切っています') && text.includes('空き状況'), '知らせの文', text);
  await page.goBack();
  await settle(page, 400);
  check(hashOf(page) === '#/staff', '移すのは replace（戻るで切った URL に戻らない）', hashOf(page));
  await page.goto(`${BASE}#/vacancy`);
  await page.getByTestId('feature-off-notice').waitFor({ timeout: 10000 });
  await page.getByTestId('feature-off-settings').click();
  await page.waitForURL(/#\/settings/);
  check(true, '知らせのリンクで管理者設定へ');
  await page.goto(`${BASE}#/vacancy`);
  await page.getByTestId('feature-off-notice').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '知らせを閉じる' }).click();
  await settle(page, 300);
  check((await page.getByTestId('feature-off-notice').count()) === 0, '知らせは閉じられる');
  check(/^#\/month/.test(hashOf(page)), '閉じても URL は予定の画面のまま', hashOf(page));

  // 入れ直すと戻る（データは消えない）
  await open(page, '/settings', '[data-testid="feature-templates"]');
  await page.getByRole('switch', { name: '空き状況', exact: true }).click();
  await page.locator('.toast').filter({ hasText: '空き状況を入れました' }).waitFor({ timeout: 5000 });
  check(
    (await page.getByRole('switch', { name: '空き枠の案内文' }).getAttribute('aria-checked')) === 'true',
    '空き状況を入れ直すと案内文も使える',
  );
  check((await page.getByTestId('feature-custom').count()) === 0, '入れ直すと すべて に戻る（カスタムを出さない）');
}

/** ひな形ごとの確かめ（メニュー・下のタブ・パレット・起動の画面・切った URL） */
async function checkTemplate(page, t) {
  const on = TEMPLATE_ON[t];
  const label = TEMPLATE_LABEL[t];
  const expert = on.includes('expert');
  await openHome(page, on);
  // 起動の画面（予定）の入口：欠勤・キャンセルを登録は sudden、メニューの空き状況は vacancy に合う（ホームの入口の代わり。PRD D401）
  await settle(page, 300);
  check(
    (await toolCount(page, 'sudden-open')) === (on.includes('sudden') ? 1 : 0),
    `${label}：起動の画面の「欠勤・キャンセルを登録」は欠勤・キャンセルの入り切りに合う`,
  );
  check(
    (await page.locator('.side-nav [data-testid="nav-link"][data-key="vacancy"]').count()) ===
      (on.includes('vacancy') ? 1 : 0),
    `${label}：メニューの空き状況は空き状況の入り切りに合う`,
  );
  const m = await menu(page);
  check(
    same(m.labels, menuFor(on)),
    `${label}：メニューの最上位の項目（エキスパート機能の入り切りだけで変わる。空き状況・欠勤では変わらない）`,
    m.labels,
  );
  check(
    same(m.schedule, scheduleKidsFor(on)) &&
      same(m.arrange, arrangeKidsFor(t)) &&
      same(m.people, peopleKidsFor(t)) &&
      same(m.settings, settingsKidsFor(t)),
    `${label}：メニューの子の項目（組むだけ：基本情報・組み方の標準・担当を組む。予定・設定に子は無い）`,
    m,
  );
  const tabs = await page.getByTestId('bottom-tab').allInnerTexts();
  check(same(tabs, tabsFor(on)), `${label}：下のタブ`, tabs);
  if (expert) {
    // 基本情報（予定と相性）のタブ：予定と相性・相性・勤務時間（シフト）。〈利用者さん〉・〈スタッフ〉は人のタブの画面（PRD D394）
    const bt = await basicsTabs(page);
    check(same(bt, BASICS_TABS), `${label}：基本情報のタブ（予定と相性・相性・勤務時間（シフト））`, bt);
  }
  // 〈利用者さん〉・〈スタッフ〉の小さいタブは入切とも同じ（予定と相性は出さない。PRD D394）
  const ct = await peopleTabs(page, '/clients');
  const st = await peopleTabs(page, '/staff');
  check(
    same(ct, CLIENT_TABS) && same(st, STAFF_TABS),
    `${label}：小さいタブ（利用者さん＝一覧・相性、スタッフ＝一覧・勤務・相性）`,
    {
      ct,
      st,
    },
  );
  await openHome(page, on);
  const pal = await paletteItems(page);
  check(same(pal.screens, screensFor(t)), `${label}：パレットの画面`, pal.screens);
  check(
    pal.actions.includes('欠勤・キャンセルを登録') === on.includes('sudden') &&
      pal.actions.includes('問い合わせに答える') === on.includes('vacancy'),
    `${label}：パレットの操作`,
    pal.actions,
  );
  // ホームは無く、起動の画面は予定（月・週。PRD D401）
  check(
    hashOf(page).startsWith(homeHashFor(on)),
    `${label}：ホームは無く予定の画面（${homeHashFor(on)}）が開く`,
    hashOf(page),
  );
  check((await page.getByTestId('home-tasks').count()) === 0, `${label}：ホームの「今日やること」は出ない`);
  const settingsFound = await paletteSearch(page, 'かんりしゃせってい');
  check(settingsFound.includes('管理者設定'), `${label}：パレットで「かんりしゃせってい」→ 管理者設定`, settingsFound);
  for (const r of ROUTES) {
    await page.goto('about:blank');
    await page.goto(`${BASE}#${r.hash}`);
    await page.locator('h1').filter({ hasText: /\S/ }).first().waitFor({ timeout: 30000 });
    await settle(page, 200);
    const h = hashOf(page);
    const off = !on.includes(r.feature);
    const hasNotice = (await page.getByTestId('feature-off-notice').count()) === 1;
    // 移る先：入切とも予定の画面（月・週）
    const home = homeHashFor(on);
    if (off) check(h.startsWith(home) && hasNotice, `${label}：切った ${r.hash} は予定の画面へ移し知らせる`, h);
    else check(h.startsWith(`#${r.hash.split('?')[0]}`) && !hasNotice, `${label}：入っている ${r.hash} は開ける`, h);
  }
  // 管理者設定と土台の画面は切れない
  for (const h of ['/settings', '/data', '/types', '/availability']) {
    await open(page, h);
    check(hashOf(page) === `#${h}`, `${label}：${h} は開ける（切れない）`, hashOf(page));
  }
  const s = await open(page, '/settings', '[data-testid="feature-templates"]').then(() =>
    page
      .locator('[data-testid="feature-template"]:has([data-testid="feature-template-now"])')
      .evaluateAll((els) => els.map((el) => el.dataset.template)),
  );
  check(same(s, [t]), `${label}：管理者設定の「いまの設定」`, s);
  const shownName = (await page.getByTestId('feature-template-current').innerText()).trim();
  check(shownName === `いま：${TEMPLATE_LABEL[t]}`, `${label}：見出しの横に「いま：〈今のひな形の名前〉」`, shownName);
  check(
    (await page.getByRole('img', { name: `今のひな形：${TEMPLATE_LABEL[t]}` }).count()) === 1,
    `${label}：読み上げは「今のひな形：〈名前〉」`,
  );
  const stabs = (await page.getByTestId('settings-tabs').locator('a').allInnerTexts()).map((x) => x.trim());
  check(same(stabs, settingsTabsFor(t)), `${label}：設定のタブ`, stabs);
  // スイッチの並びは機能のグループ順（lib/features の FEATURE_GROUPS）なので、行の data-feature で ID に引き反映する
  const byId = Object.fromEntries(
    await page
      .getByTestId('feature-row')
      .evaluateAll((els) =>
        els.map((el) => [el.dataset.feature, el.querySelector('[role="switch"]')?.getAttribute('aria-checked')]),
      ),
  );
  const checked = FEATURE_IDS.map((id) => byId[id]);
  check(
    same(
      checked,
      FEATURE_IDS.map((id) => String(on.includes(id))),
    ),
    `${label}：スイッチの入り切りが表どおり`,
    checked,
  );
}

// ---- ひな形の5通り ----
async function templates(page, dlg, ctx) {
  // すべて入から始める（スイッチの確かめで {vacancy: true} などが残っていても すべて と同じ）
  await open(page, '/settings', '[data-testid="feature-templates"]');
  const before = await storedFeatures(page);
  // 取り消すと変わらない
  const msg0 = await applyTemplate(page, dlg, 'basic', false);
  check(
    msg0.length === 1 && msg0[0].includes('ひな形「定期の訪問（基本）」を適用しますか？'),
    '適用する前に独自の確認（見出し）',
    msg0,
  );
  check(
    msg0[0]?.includes('入る機能：なし') && msg0[0]?.includes('切れる機能：') && msg0[0]?.includes('提案を比べる'),
    '確認の本文に入る機能・切れる機能の名前',
    msg0,
  );
  check(same(await storedFeatures(page), before), '取り消すと入り切りは変わらない', await storedFeatures(page));

  // 基本（管理者設定で適用する）
  await applyTemplate(page, dlg, 'basic');
  await page
    .locator('.toast')
    .filter({ hasText: 'ひな形「定期の訪問（基本）」を適用しました' })
    .waitFor({ timeout: 5000 });
  check(same(await storedFeatures(page), asFeatures(TEMPLATE_ON.basic)), '基本：全22の ID を明示して書く');
  await checkTemplate(page, 'basic');
  await page.screenshot({ path: path.join(OUT_DIR, 'settings-basic.png'), fullPage: true });

  // 労務・契約管理（別のタブで localStorage を書き換える）
  await writeFeaturesInOtherTab(ctx, asFeatures(TEMPLATE_ON.laborContract));
  await checkTemplate(page, 'laborContract');

  // 月次予定・現場共有（管理者設定で適用する。確認に入る機能・切れる機能）
  const msg = await applyTemplate(page, dlg, 'monthlyField');
  check(
    msg[0]?.includes('入る機能：') &&
      msg[0]?.includes('月の予定の印刷') &&
      msg[0]?.includes('切れる機能：') &&
      msg[0]?.includes('勤務の見込み'),
    '月次予定・現場共有：確認に入る機能・切れる機能',
    msg,
  );
  await checkTemplate(page, 'monthlyField');

  // すべて
  await applyTemplate(page, dlg, 'all');
  await checkTemplate(page, 'all');
}

// ---- 390px・印刷 ----
async function mobile(page, dlg) {
  await applyTemplate(page, dlg, 'basic');
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/settings', '[data-testid="feature-templates"]');
  const w1 = await page.evaluate(() => document.documentElement.scrollWidth);
  check(w1 <= 390, '390px：管理者設定が横にはみ出さない', w1);
  const hMobile = await page
    .locator('[data-feature="vacancy"] .feature-text')
    .evaluate((el) => el.getBoundingClientRect().height);
  check(hMobile < 110, '390px：スイッチの行は短い（名前・説明が折り返しても2行・ⓘ）', hMobile);
  const name = await page.getByTestId('screen-name').innerText();
  check(name.replace(/\s/g, '') === '設定・管理者設定', '390px：上の帯の名前', name);
  await page.screenshot({ path: path.join(OUT_DIR, 'settings-mobile.png'), fullPage: true });
  await page.goto('about:blank');
  await page.goto(`${BASE}#/compare`);
  await page.getByTestId('feature-off-notice').waitFor({ timeout: 10000 });
  const w2 = await page.evaluate(() => document.documentElement.scrollWidth);
  check(w2 <= 390, '390px：切った機能の知らせが横にはみ出さない', w2);
  const tabs = await page.getByTestId('bottom-tabs').locator('.bottom-tab').allInnerTexts();
  // 基本はエキスパート機能が切：予定・空き状況・〈利用者さん〉・〈スタッフ〉と探す・メニュー（ADR-0080）
  check(
    same(
      tabs.map((x) => x.trim()),
      [...tabsFor(TEMPLATE_ON.basic), '探す', 'メニュー'],
    ),
    '390px：基本は下のタブ6つ（予定・空き状況・利用者さん・スタッフ・探す・メニュー）',
    tabs,
  );
  await page.getByTestId('menu-btn').click();
  const drawer = await menu(page, '.nav-drawer');
  check(
    same(drawer.labels, menuFor(TEMPLATE_ON.basic)) &&
      same(drawer.schedule, scheduleKidsFor(TEMPLATE_ON.basic)) &&
      same(drawer.arrange, arrangeKidsFor('basic')) &&
      same(drawer.people, peopleKidsFor('basic')) &&
      same(drawer.settings, settingsKidsFor('basic')),
    '390px：引き出しもメニューと同じ項目（最上位と子）',
    drawer,
  );
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(OUT_DIR, 'notice-mobile.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  check(!(await page.getByTestId('feature-off-notice').isVisible()), '印刷：知らせを出さない');
  check(!(await page.getByTestId('bottom-tabs').isVisible()), '印刷：下のタブを出さない');
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await open(page, '/settings', '[data-testid="feature-templates"]');
  await openDetails(page, 'feature-templates-fold');
  check(
    await page.getByTestId('feature-template-apply').first().isVisible(),
    '印刷の前：ひな形を開くと「適用」が見える',
  );
  await page.emulateMedia({ media: 'print' });
  check(!(await page.getByTestId('feature-template-apply').first().isVisible()), '印刷：ひな形の「適用」を出さない');
  await page.emulateMedia({ media: 'screen' });
  await applyTemplate(page, dlg, 'all');
}

// ---- 切った URL のすり抜け（末尾の /・大文字）と、390px で空き状況を切ったときの下のタブ ----
async function pathVariants(page, dlg, ctx) {
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await open(page, '/month', '[data-testid="sched-nav"]');
  await writeFeaturesInOtherTab(ctx, { vacancy: false, monthPrint: false });
  for (const h of ['/vacancy/', '/Vacancy', '/VACANCY//', '/month/print/', `/Month/Print?ym=${TODAY.slice(0, 7)}`]) {
    await page.goto('about:blank');
    await page.goto(`${BASE}#${h}`);
    await page.locator('h1').filter({ hasText: /\S/ }).first().waitFor({ timeout: 30000 });
    await settle(page, 200);
    const hasNotice = (await page.getByTestId('feature-off-notice').count()) === 1;
    check(/^#\/month/.test(hashOf(page)) && hasNotice, `切った機能の ${h} も予定の画面へ移し知らせる`, hashOf(page));
  }
  // 390px：空き状況を切っても下のタブは6つ（予定・〈利用者さん〉・〈スタッフ〉・組む・探す・メニュー。入の下のタブに空き状況は無い。PRD D401）で、全幅を等分する
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/month', '[data-testid="sched-nav"]');
  const boxes = await page
    .getByTestId('bottom-tabs')
    .locator('.bottom-tab')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, w: r.width })));
  const vw = await page.evaluate(() => document.documentElement.clientWidth);
  const total = boxes.reduce((a, b) => a + b.w, 0);
  check(
    boxes.length === 6,
    '390px・空き状況を切る：下のタブは6つ（予定・利用者さん・スタッフ・組む・探す・メニュー）',
    boxes.length,
  );
  check(
    boxes.length === 6 &&
      Math.abs(boxes[0].x) <= 1 &&
      Math.abs(boxes[5].x + boxes[5].w - vw) <= 1 &&
      Math.abs(total - vw) <= 2 &&
      boxes.every((b) => Math.abs(b.w - vw / 6) <= 1),
    '390px・空き状況を切る：6つが全幅を等分する',
    { vw, boxes },
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'tabs-4-mobile.png') });
  await page.setViewportSize({ width: 1400, height: 1000 });
  // 欠勤・キャンセルと空き状況の両方を切ると「当日・問い合わせ」は見出しごと消える（PRD D326。片方なら残るのは allOn で確かめる）
  await writeFeaturesInOtherTab(ctx, { sudden: false, vacancy: false });
  await open(page, '/month', '[data-testid="sched-nav"]');
  const m = await menu(page);
  check(
    same(m.labels, withoutVacancy(MENU)) && same(m.schedule, []) && m.titles.length === 0,
    '欠勤・キャンセルと空き状況を切るとメニューは 予定・〈利用者さん〉・〈スタッフ〉・組む・設定 の5項目（空き状況は消える。見出しは無い）',
    m,
  );
  await applyTemplate(page, dlg, 'all');
}

/** 「10/21」の形（月の要対応の日付の文） */
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// ---- 切った機能（稼働の見込み・欠勤・キャンセルなど）の画面へ移るリンク・ボタンを、画面の中から出さない ----
async function deadEnds(page, dlg, ctx) {
  // 用意（e2e-links の prepare と同じ）：今日より後の日に、担当なしの訪問・担当が休みの訪問・拘束の上限超えを作る
  await open(page, '/plan', '.date-switch select');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await page.locator('.date-switch select').waitFor({ timeout: 30000 });
  // 初期データは今日からの日を繰り返しの担当のままにするので、保存した担当の入った訪問を用意する（2回目からは写し）
  await planDays(page, { cache: true });
  await open(page, '/plan', '.date-switch select');
  const options = await page.locator('.date-switch select option').evaluateAll((os) => os.map((o) => o.value));
  const second = options.find((d) => d > TODAY) ?? '';
  check(second !== '', '用意：今日より後の日がある', second);
  const ym = second.slice(0, 7);
  // 別のタブで書く（storage の知らせでこのタブのデータも入れ替わる）
  const other = await ctx.newPage();
  await other.goto(`${BASE}#/data`);
  await other.locator('h1').first().waitFor({ timeout: 30000 });
  const absent = await other.evaluate(
    ({ k, d }) => {
      const data = JSON.parse(localStorage.getItem(k));
      // 担当は訪問に持つ。保存したその日の訪問の担当
      const mine = data.visits.filter((v) => v.date === d && !v.cancelled && v.staffId);
      const staffWith = [...new Set(mine.map((v) => v.staffId))];
      const a = staffWith[0];
      const v0 = mine.find((v) => v.staffId === a);
      v0.staffId = null;
      v0.pinned = false;
      const absentId = staffWith[1];
      data.absences = [
        ...data.absences.filter((x) => !(x.staffId === absentId && x.date === d)),
        { id: `e2e-features-${absentId}`, staffId: absentId, date: d, from: null, to: null, note: '' },
      ];
      data.org.spanLimitHours = 1;
      // 稼働の見込み・欠勤・キャンセル・月の印刷・提案を比べるを切る
      // 希望休のまとめ入力も切る（「担当が休み」の印は事実なので残る）
      data.org.features = { workload: false, sudden: false, monthPrint: false, compare: false, requestedOff: false };
      localStorage.setItem(k, JSON.stringify(data));
      return absentId;
    },
    { k: STORAGE_KEY, d: second },
  );
  await other.close();
  await settle(page, 300);

  // 月の要対応：担当が休み・拘束の上限の行は、欠勤・キャンセルの欄・稼働の見込みでなく日の画面へ
  await open(page, `/month?ym=${ym}&do=attention`, '[data-testid="month-attention"]');
  await page.locator('.month-attention-btn').first().waitFor({ timeout: 30000 });
  const rows = await page
    .locator('.month-attention-btn')
    .evaluateAll((els) => els.map((el) => ({ cls: el.className, to: el.dataset.to ?? '', text: el.textContent })));
  check(rows.length > 0, '月の要対応の行がある', rows.length);
  check(
    rows.every((r) => !r.to.includes('/workload') && !r.to.includes('do=absence')),
    '月の要対応：切った機能（勤務の見込み・欠勤・キャンセル）への行き先が無い',
    rows.map((r) => r.to),
  );
  {
    const r = rows.find((x) => x.cls.includes('is-overSpan') && x.text.includes(md(second)));
    check(
      !!r && r.to === '/plan' && r.text.includes('（日の予定で開く）'),
      '月の要対応：拘束の上限の行は日の予定へ（「（日の予定で開く）」）',
      r,
    );
    const c = rows.find((x) => x.cls.includes('is-care') && x.text.includes(md(second)));
    check(!!c && c.to.startsWith('/plan'), '月の要対応：要対応の訪問の行は日の予定へ', c);
  }
  check(
    (await page.locator(`[data-testid="month-day"][data-date="${second}"] [data-testid="month-issue"]`).count()) > 0,
    '月：希望休のまとめ入力を切っても「担当が休み」の印は出す（担当が休みの訪問の事実）',
  );
  await page.getByTestId('month-more').click();
  await page.getByTestId('month-more-list').waitFor();
  check((await page.getByTestId('month-workload').count()) === 0, '月：「その他 ▾」に勤務の見込みを出さない');
  check((await page.getByTestId('month-print').count()) === 0, '月：「その他 ▾」に印刷を出さない');
  await page.keyboard.press('Escape');
  const r = rows.find((x) => x.cls.includes('is-overSpan') && x.text.includes(md(second)));
  if (r) {
    await page
      .locator('.month-attention-btn.is-overSpan')
      .filter({ hasText: md(second) })
      .first()
      .click();
    await page.waitForURL(/#\/plan/, { timeout: 10000 });
    check(
      !/workload/.test(hashOf(page)) && !(await page.getByTestId('feature-off-notice').count()),
      '拘束の上限の行を押すと日の予定',
      hashOf(page),
    );
  }

  // 日の画面：稼働の見込みを切ると拘束の上限の帯ごと出さない（その2。リンク・ボタンも無い）
  await open(page, `/plan?date=${second}`, '.date-switch select');
  await reveal(page, 'plan-summary', { timeout: 60000 });
  await settle(page, 500);
  check(
    (await page.getByTestId('band-over-span').count()) === 0 &&
      (await page.getByTestId('over-span-link').count()) === 0 &&
      (await page.locator('.app-main a[href*="workload"]').count()) === 0,
    '日の予定：勤務の見込みを切ると拘束の上限の帯と勤務の見込みへのリンクを出さない',
  );
  check(
    (await page.getByTestId('plan-menu').count()) === 0,
    '日の予定：「AI で組む ▾」は無い（AI で組むのは担当を組む。ADR-0063）',
  );
  // 担当を組む：提案を比べるを切ると「案を比べる」の欄を出さない（AI で組むは残る。標準が無い間は組めないので先に登録。ADR-0065）
  await markStandard(page);
  await open(page, `/arrange?date=${second}`, '[data-testid="arrange-start"]');
  check(
    (await page.getByTestId('arrange-compare').count()) === 0 &&
      (await page.getByTestId('arrange-compare-open').count()) === 0 &&
      (await page.getByTestId('arrange-start').count()) === 1,
    '担当を組む：提案を比べるを切ると「案を比べる」を出さない（「AI で組む」は残る）',
  );

  // 稼働時間の右の欄：欠勤・キャンセルの欄へのリンクが無い
  const data = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
  const name = data.staff.find((s) => s.id === absent)?.name ?? '';
  await open(page, '/availability', '.avail-table');
  const legend = await page.locator('.app-main').innerText();
  check(
    legend.includes('急な欠勤') && !legend.includes('急な欠勤（日の予定で登録）') && !legend.includes('予定の画面'),
    '勤務時間（シフト）の凡例：欠勤・キャンセルを切ると「（日の予定で登録）」を出さない',
  );
  const heads = await page.locator('.avail-table thead th').allInnerTexts();
  const col = heads.findIndex((t) => t.replace(/\s+/g, '').startsWith(md(second)));
  check(col > 0, '稼働時間の表にその日の列がある', col);
  await page
    .locator('.avail-table tbody tr')
    .filter({ has: page.locator('th.avail-name', { hasText: name }) })
    .locator('td')
    .nth(col - 1)
    .locator('button')
    .click();
  await page.locator('.drawer').waitFor({ timeout: 5000 });
  await settle(page, 200);
  check(
    (await page.getByTestId('availability-absence-link').count()) === 0 &&
      (await page.locator('.drawer a[href*="do=absence"]').count()) === 0,
    '稼働時間の右の欄：欠勤・キャンセルの欄へのリンクを出さない',
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'dead-ends-availability.png') });
  await applyTemplate(page, dlg, 'all');
  // 入に戻すと凡例に登録の場所（新しい画面名「日の予定」）が出る（PRD D230）
  await open(page, '/availability', '.avail-table');
  check(
    (await page.locator('.app-main').innerText()).includes('急な欠勤（日の予定で登録）'),
    '勤務時間（シフト）の凡例：欠勤・キャンセルが入なら「急な欠勤（日の予定で登録）」',
  );
}

/** ひな形ごとの、画面の中の入口（その2。ADR-0028 の「切ると隠れるもの」） */

const steps = sharedPage({
  open: async () => {
    const s = await openPage();
    // 確認は独自のダイアログで受ける（ネイティブのダイアログが出たら失敗。PRD D146）
    const dlg = await answerConfirms(s.page);
    await s.page.goto(`${BASE}#/data`);
    return { ...s, dlg };
  },
  call: (fn, s) => fn(s.page, s.dlg, s.ctx),
  steps: [
    ['all-on', allOn],
    ['switches', switches],
    ['templates', templates],
    ['mobile', mobile],
    ['path-variants', pathVariants],
    ['dead-ends', deadEnds],
  ],
  after: ({ dlg }) => check(dlg.native.length === 0, 'ブラウザのダイアログを出さない', dlg.native),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
