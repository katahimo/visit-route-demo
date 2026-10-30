// メニュー4つ・ホームの統合・要対応の帯（PRD D383。ADR-0073 段(4)の1）を本物のブラウザで確かめる。
// 初めて開いたとき（デモ×定期＝「基本」のひな形＝エキスパート機能は切）で、
// 1 #/home・#/・知らない URL は予定（月）へ移る（ホームの画面は出ない）、
// 2 左のメニューは 予定・〈利用者さん〉・〈スタッフ〉・設定 の4つ（見出し・子の項目なし。今の画面の印・押して移る）。コマンドパレットの画面にホームが無い、
// 3 予定（月・週・日）の上に要対応の帯（担当なし N件…。押すとその日の予定へ移って、その訪問を見える所へ）。月・週・日のどれにも出る。訪問が無ければ出さない、
// 4 予定の「その他 ▾」（月・週・日）から空き状況を開ける、
// 5 スマホ（390px）：下のタブは メニューの4つ＋探す＋メニュー。引き出しも4つ。帯・「その他 ▾」が収まる、
// 6 エキスパート機能を入にすると今のメニュー（ホーム・予定を組む・予定・空き状況・設定）・ホームの画面・帯は出ない。
// スクリーンショット：simple-month-1366・simple-band-plan-1366・simple-menu-more-1366・simple-week-390・simple-tabs-390・simple-drawer-390
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-simple-menu.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const path = require('node:path');
const {
  BASE,
  NOW,
  OUT_DIR,
  STORAGE_KEY,
  check,
  launch,
  runSteps,
  settle,
  until,
  watchErrors,
} = require('./lib/env.cjs');
const { sharedPage } = require('./lib/steps.cjs');
const { skipTour } = require('./lib/tourSeen.cjs');
const { answerIfAsked } = require('./lib/firstRun.cjs');

const data = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
const hash = (page) => new URL(page.url()).hash;
const shot = (page, name) => page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
const side = (page) => page.locator('.side-nav [data-testid="nav-link"]');
const texts = (loc) => loc.evaluateAll((els) => els.map((e) => e.textContent.trim().replace(/\s+/g, ' ')));

/** 初期データに戻して開く（初めて開いたときの2問に「デモで試す・定期」で答える＝「基本」＝エキスパート機能は切）。start は 'demo'|'own' */
async function fresh(page, to, ready, answer) {
  await page.goto(`${BASE}#/data`);
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
  await page.goto(`${BASE}#${to}`);
  await page.reload();
  if (await answerIfAsked(page, ready, answer)) {
    await page.goto('about:blank');
    await page.goto(`${BASE}#${to}`);
  }
  await page.locator(ready).first().waitFor({ timeout: 60000 });
  await settle(page, 400);
}

const NAV_READY = '[data-testid="sched-nav"]';

/** 準備：1366×768・初回は2問に答える。時計は NOW に止める */
async function open() {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await skipTour(ctx, { start: 'ask' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  watchErrors(page);
  return { b, ctx, page };
}

/** 1 #/home・#/・知らない URL は予定へ（ホームの画面は出ない） */
async function redirects(page) {
  await fresh(page, '/home', NAV_READY);
  const d = await data(page);
  check(d.org.features.expert === false, '前提：初めて開くとエキスパート機能は切', d.org.features);
  check(/^#\/month/.test(hash(page)), '#/home は予定（月）へ移る', hash(page));
  check((await page.getByTestId('home-tasks').count()) === 0, 'ホームの画面（今日やること）は出ない');
  for (const to of ['/', '/zzz-unknown']) {
    await page.goto('about:blank');
    await page.goto(`${BASE}#${to}`);
    await page.locator(NAV_READY).waitFor({ timeout: 60000 });
    check(/^#\/month/.test(hash(page)), `#${to} も予定（月）へ移る`, hash(page));
  }
  // 切った機能の URL（担当を組むの後ろの組み方の標準は expert 切で開けない）も予定へ移して知らせる
  await page.goto('about:blank');
  await page.goto(`${BASE}#/standard`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  check(/^#\/month/.test(hash(page)), '切った機能の URL も予定（月）へ移る', hash(page));
  check((await page.getByTestId('feature-off-notice').count()) === 1, '移った先の予定の上で、切った機能の知らせを出す');
}

/** 2 左のメニューは4つ・コマンドパレットの画面にホームが無い */
async function menu(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  const terms = (await data(page)).org.terms;
  const labels = await texts(side(page));
  check(
    JSON.stringify(labels) === JSON.stringify(['予定', terms.client, terms.staff, '設定']),
    '左のメニューは 予定・〈利用者さん〉・〈スタッフ〉・設定 の4つ（呼び名は org.terms）',
    labels,
  );
  check((await page.locator('.side-nav [data-testid="nav-toggle"]').count()) === 0, '畳む子の項目は無い');
  check((await page.locator('.side-nav .nav-group-title').count()) === 0, 'グループの見出しは無い');
  const cur = await texts(page.locator('.side-nav [aria-current="page"]'));
  check(JSON.stringify(cur) === JSON.stringify(['予定']), '月の予定では「予定」に印', cur);
  await shot(page, 'simple-month-1366');
  const go = async (label, re) => {
    await side(page).filter({ hasText: label }).first().click();
    await until(async () => re.test(hash(page)));
    check(re.test(hash(page)), `「${label}」を押すと ${re} へ移る`, hash(page));
    const cur = page.locator('.side-nav [aria-current="page"]');
    await until(async () => (await texts(cur)).join() === label);
    const on = await texts(cur);
    check(on.length === 1 && on[0] === label, `「${label}」に印`, on);
  };
  await go(terms.client, /^#\/clients/);
  await go(terms.staff, /^#\/staff/);
  await go('設定', /^#\/types/);
  await go('予定', /^#\/(month|week|plan)/);
  // 〈利用者さん〉の画面は〈利用者さん〉に印
  await page.goto('about:blank');
  await page.goto(`${BASE}#/clients`);
  await page.locator('[data-testid="client-row"], .side-nav').first().waitFor({ timeout: 60000 });
  // パレット：画面の一覧にホームが無く、空き状況・月の予定はある
  await page.keyboard.press('Control+k');
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 10000 });
  const opts = await texts(dlg.getByRole('option'));
  check(!opts.some((t) => /^ホーム/.test(t)), 'パレットの画面の一覧にホームが無い', opts);
  check(
    opts.some((t) => /^空き状況/.test(t)) && opts.some((t) => /^月の予定/.test(t)),
    'パレットに 月の予定・空き状況 はある',
    opts,
  );
  await page.keyboard.press('Control+k');
  await dlg.waitFor({ state: 'detached', timeout: 10000 });
}

/** 3 予定の上の要対応の帯：月・週・日に出る。押すとその訪問のある日の予定へ */
async function band(page) {
  const bandEl = page.getByTestId('attention-band');
  for (const [to, ready] of [
    ['/month', NAV_READY],
    ['/week', NAV_READY],
    ['/plan', NAV_READY],
  ]) {
    await page.goto('about:blank');
    await page.goto(`${BASE}#${to}`);
    await page.locator(ready).waitFor({ timeout: 60000 });
    await bandEl.waitFor({ timeout: 60000 });
    const t = await bandEl.innerText();
    check(/担当なし \d+件/.test(t), `${to}：帯に「担当なし N件」（初期データに担当なしの繰り返しの回がある）`, t);
    check(/^要対応/.test(t), `${to}：帯は「要対応 …」で始まる`, t);
    check((await bandEl.count()) === 1, `${to}：帯は1本`);
    check(
      (await bandEl.evaluate((el, nav) => el.compareDocumentPosition(document.querySelector(nav)) & 2, NAV_READY)) !==
        0,
      `${to}：帯は上のナビの行より下`,
    );
  }
  // 月の予定で押す → 日の予定
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await bandEl.waitFor({ timeout: 60000 });
  await shot(page, 'simple-band-month-1366');
  const before = await bandEl.innerText();
  await bandEl.click();
  await until(async () => /^#\/plan/.test(hash(page)));
  check(/^#\/plan/.test(hash(page)), '帯を押すと日の予定へ移る', hash(page));
  const id = await page.evaluate(() => history.state?.usr?.visitId ?? null);
  check(!!id, '行き先の訪問の ID を渡している', id);
  const el = page.locator(`[data-visit="${id}"]`).first();
  await el.waitFor({ timeout: 30000 });
  await settle(page, 600);
  const inView = await el.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  });
  check(inView, '開いた訪問が画面に見える所にある（巻かれている）', id);
  check((await page.getByTestId('attention-band').count()) === 1, '日の予定にも帯が出る', before);
  await shot(page, 'simple-band-plan-1366');
  // 日の予定の中で押しても（同じ画面のまま）その訪問へ
  await page.getByTestId('attention-band').click();
  await settle(page, 400);
  check(/^#\/plan/.test(hash(page)), '日の予定で押しても日の予定のまま', hash(page));
}

/** 3b 訪問が無ければ帯を出さない（自分のデータで始めた空のデータ） */
async function noBand(page) {
  await fresh(page, '/month', NAV_READY, { start: 'own' });
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await settle(page, 600);
  check((await page.getByTestId('attention-band').count()) === 0, '訪問が無ければ帯を出さない');
}

/** 4 予定の「その他 ▾」から空き状況を開ける（月・週・日） */
async function more(page) {
  await fresh(page, '/month', NAV_READY, { start: 'demo' });
  for (const [to, id] of [
    ['/month', 'month-more'],
    ['/week', 'week-more'],
    ['/plan', 'plan-more'],
  ]) {
    await page.goto('about:blank');
    await page.goto(`${BASE}#${to}`);
    await page.locator(NAV_READY).waitFor({ timeout: 60000 });
    await page.getByTestId(id).click();
    const item = page.getByTestId('more-vacancy');
    await item.waitFor({ timeout: 10000 });
    check(true, `${to}：「その他 ▾」に空き状況がある`);
    if (to === '/month') await shot(page, 'simple-menu-more-1366');
    await item.click();
    await until(async () => /^#\/vacancy/.test(hash(page)));
    check(/^#\/vacancy/.test(hash(page)), `${to}：空き状況を押すと空き状況の画面`, hash(page));
    const cur = await texts(page.locator('.side-nav [aria-current="page"]'));
    check(JSON.stringify(cur) === JSON.stringify(['予定']), '空き状況の画面は「予定」に印', cur);
  }
  // 担当なしの訪問を組む項目（その他 ▾。ホームの［組む］の代わり）
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await page.getByTestId('month-more').click();
  await page.getByTestId('more-auto-arrange').waitFor({ timeout: 10000 });
  check(
    /\d+件/.test(await page.getByTestId('more-auto-arrange').innerText()),
    '「その他 ▾」に「担当なしの訪問を組む N件」',
  );
  await page.keyboard.press('Escape');
}

/** 5 スマホ（390px）：下のタブ・引き出し・帯・その他 */
async function mobile(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('about:blank');
  await page.goto(`${BASE}#/week`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await page.getByTestId('attention-band').waitFor({ timeout: 60000 });
  await settle(page, 500);
  const terms = (await data(page)).org.terms;
  const tabs = page.getByTestId('bottom-tabs');
  const keys = await tabs.locator('[data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')));
  check(
    JSON.stringify(keys) === JSON.stringify(['schedule', 'clients', 'staff', 'settings', 'search']),
    '下のタブは メニューの4つと「探す」',
    keys,
  );
  const labels = await texts(tabs.locator('[data-tab]'));
  check(
    JSON.stringify(labels) === JSON.stringify(['予定', terms.client, terms.staff, '設定', '探す']),
    '下のタブの名前',
    labels,
  );
  check((await page.getByTestId('menu-btn').count()) === 1, '「メニュー」のボタンも残る');
  const box = await tabs.boundingBox();
  check(box.x >= 0 && box.x + box.width <= 390 + 1, '下のタブが画面の幅に収まる', box);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, '横にはみ出さない（帯・ナビの行）');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'simple-week-390');
  await shot(page, 'simple-tabs-390');
  const on = await texts(tabs.locator('[aria-current="page"]'));
  check(JSON.stringify(on) === JSON.stringify(['予定']), '週の予定では「予定」のタブに印', on);
  // 下のタブの〈スタッフ〉
  await tabs.locator('[data-tab="staff"]').click();
  await until(async () => /^#\/staff/.test(hash(page)));
  check(/^#\/staff/.test(hash(page)), '〈スタッフ〉のタブで一覧へ', hash(page));
  // 引き出しも4つ
  await page.getByTestId('menu-btn').click();
  const drawer = page.getByRole('dialog', { name: 'メニュー' });
  await drawer.waitFor({ timeout: 10000 });
  const dl = await texts(drawer.locator('[data-testid="nav-link"]'));
  check(
    JSON.stringify(dl) === JSON.stringify(['予定', terms.client, terms.staff, '設定']),
    '引き出しも 予定・〈利用者さん〉・〈スタッフ〉・設定 の4つ',
    dl,
  );
  await settle(page, 600);
  await shot(page, 'simple-drawer-390');
  await page.keyboard.press('Escape');
  // 帯と「その他 ▾」（週）
  await page.goto('about:blank');
  await page.goto(`${BASE}#/plan`);
  await page.getByTestId('attention-band').waitFor({ timeout: 60000 });
  await page.getByTestId('plan-more').click();
  await page.getByTestId('more-vacancy').waitFor({ timeout: 10000 });
  check(true, 'スマホの日の予定の「その他 ▾」に空き状況がある');
  await shot(page, 'simple-plan-more-390');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1366, height: 768 });
}

/** 6 エキスパート機能を入にすると今のメニュー・ホーム。帯は出ない */
async function expertOn(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await page.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem(k));
    d.org.features = { ...d.org.features, expert: true };
    localStorage.setItem(k, JSON.stringify(d));
  }, STORAGE_KEY);
  await page.goto('about:blank');
  await page.goto(`${BASE}#/home`);
  await page.getByTestId('home-tasks').waitFor({ timeout: 60000 });
  check(/^#\/home/.test(hash(page)), 'expert 入：#/home はホームのまま', hash(page));
  const labels = await texts(page.locator('.side-nav .nav-group > a, .side-nav .nav-parent-row > a'));
  check(
    JSON.stringify(labels) === JSON.stringify(['ホーム', '予定を組む', '予定', '空き状況', '設定']),
    'expert 入：今のメニュー（5項目）',
    labels,
  );
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await settle(page, 600);
  check((await page.getByTestId('attention-band').count()) === 0, 'expert 入：要対応の帯は出さない');
  await page
    .getByTestId('month-more')
    .click()
    .catch(() => {});
  check(
    (await page.getByTestId('more-vacancy').count()) === 0,
    'expert 入：「その他 ▾」に空き状況は足さない（メニューにある）',
  );
  await page.goto('about:blank');
  await page.goto(`${BASE}#/zzz-unknown`);
  await page.getByTestId('home-tasks').waitFor({ timeout: 60000 });
  check(/^#\/home/.test(hash(page)), 'expert 入：知らない URL はホームへ', hash(page));
}

const steps = sharedPage({
  open,
  steps: [
    ['1 切：#/home・#/・知らない URL は予定へ', redirects],
    ['2 切：メニューは4つ・パレットにホームが無い', menu],
    ['3 切：予定の上の要対応の帯（押すとその訪問へ）', band],
    ['3b 切：訪問が無ければ帯を出さない', noBand],
    ['4 切：予定の「その他 ▾」から空き状況', more],
    ['5 切：スマホの下のタブ・引き出し・帯', mobile],
    ['6 入：今のメニュー・ホーム・帯なし', expertOn],
  ],
  call: (fn, s) => fn(s.page),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
