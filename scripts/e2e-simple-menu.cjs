// メニュー4つ・ホームの統合・要対応の帯（PRD D383。ADR-0073 段(4)の1）を本物のブラウザで確かめる。
// 初めて開いたとき（デモ×定期＝「基本」のひな形＝エキスパート機能は切）で、
// 1 #/home・#/・知らない URL は予定（月）へ移る（ホームの画面は出ない）、
// 2 左のメニューは 予定・〈利用者さん〉・〈スタッフ〉・設定 の4つ（見出し・子の項目なし。今の画面の印・押して移る）。コマンドパレットの画面にホームが無い、
// 3 予定（月・週・日）の上に要対応の帯（担当なし N件…。押すとその日の予定へ移って、その訪問を見える所へ）。月・週・日のどれにも出る。訪問が無ければ出さない、
// 4 予定の「その他 ▾」（月・週・日）から空き状況を開ける、
// 5 スマホ（390px）：下のタブは メニューの4つ＋探す＋メニュー。引き出しも4つ。帯・「その他 ▾」が収まる、
// 5b 例外だけ見せる（PRD D384）：月・週・日の操作の行は主ボタン1つ＋1つ（＋「その他 ▾」。元に戻す・表示の切り替え・使い方は「その他 ▾」の中）、
//    点数・理由・件数の内訳・凡例・進み具合は「詳しく」の中（閉じているときは見えない・開くと見える）、移動・待ちの分数の線と担当なしの理由の札は出ない、
//    訪問の札は時刻・名前の1行（順番の表示）、ピン・資格✗の印は出ない、「標準・提案・反映・ピン・プリセット」の言葉が月・週・日と「その他 ▾」「詳しく」に出ない、
// 5c 画面の上の説明は1行で、閉じたら読み直しても出ない（画面ごと。この端末に覚える）、
// 5e 人の画面は畳む・日の予定の地図はボタンで開く・月のマスの読み方（PRD D385・D384）：〈利用者さん〉の一覧は名前・住所・いつもの予定の3列、
//    〈スタッフ〉は名前・勤務日・勤務時間の3列。詳細は〈利用者さん〉＝名前・住所・予定（繰り返し）／〈スタッフ〉＝名前・勤務日・勤務時間を出し、
//    段階・特性・決まりごと・担当・相性（〈スタッフ〉は自宅・特性・求めること・日ごとの勤務ほか）は「詳しく ▾」の中（閉じていると見えない・開くと見える）。
//    日の予定の地図はふだん閉じ、「地図」のボタンで開く（1366px・390px）。月のマスの読み方は帯の3種類と「変更あり」に合わせ、条件に合わない・拘束超は言わない、
// 6 エキスパート機能を入にすると今のメニュー（ホーム・予定を組む・予定・空き状況・設定）・ホームの画面・帯は出ない。入では操作の行・説明・進み具合は今のまま。
// スクリーンショット：simple-clients-1366・simple-staff-1366・simple-plan-map-closed-1366 ほか（5e は simple-people-*・simple-plan-map-*）、simple-month-1366・simple-band-plan-1366・simple-menu-more-1366・simple-week-390・simple-tabs-390・simple-drawer-390
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
  // 月は主ボタンが「担当なしの訪問を組む N件」（「その他 ▾」には重ねない）。日は主ボタンが訪問を追加なので「その他 ▾」にある
  const arrange = page.getByTestId('toolbar-arrange');
  await arrange.waitFor({ timeout: 10000 });
  check(/担当なしの訪問を組む \d+件/.test(await arrange.innerText()), '月：主ボタンは「担当なしの訪問を組む N件」');
  await page.getByTestId('month-more').click();
  check((await page.getByTestId('more-auto-arrange').count()) === 0, '月：「その他 ▾」には組むを重ねない');
  await page.keyboard.press('Escape');
  await page.goto('about:blank');
  await page.goto(`${BASE}#/plan`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await page.getByTestId('plan-more').click();
  await page.getByTestId('more-auto-arrange').waitFor({ timeout: 10000 });
  check(
    /\d+件/.test(await page.getByTestId('more-auto-arrange').innerText()),
    '日：「その他 ▾」に「担当なしの訪問を組む N件」',
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
  // 引き出しも4つ。移った先の画面（別のチャンク）が描き終わってから開く（描き直しで引き出しが閉じないように）。開かなければ1回だけ押し直す
  await settle(page, 800);
  const drawer = page.getByRole('dialog', { name: 'メニュー' });
  await page.getByTestId('menu-btn').click();
  if (
    !(await drawer.waitFor({ timeout: 5000 }).then(
      () => true,
      () => false,
    ))
  ) {
    await page.getByTestId('menu-btn').click();
    await drawer.waitFor({ timeout: 10000 });
  }
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

const BANNED = /標準|提案|反映|ピン|プリセット/;
const TOOLBAR = '[data-testid="schedule-toolbar"]';
const INTRO_KEY = 'visit-route-demo:nav-open';

/** 操作の行のボタン（その他 ▾ のボタンは数えない）の名前 */
const toolbarButtons = (page) =>
  page.locator(`${TOOLBAR} > button.btn, ${TOOLBAR} > a.btn`).evaluateAll((els) =>
    els.map((e) => ({
      text: e.textContent.trim().replace(/\s+/g, ' '),
      primary: e.classList.contains('btn-primary'),
    })),
  );

/** 画面を開く（説明の覚えは消さない） */
async function open1(page, to) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#${to}`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await settle(page, 800);
}

/** 5b 例外だけ見せる：操作の行・「詳しく」・札・言葉（月・週・日） */
async function exceptions(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await fresh(page, '/month', NAV_READY, { start: 'demo' });
  for (const [to, zoom, primaryText, detailsId, hidden] of [
    [
      '/month',
      'month',
      /担当なしの訪問を組む/,
      'month-details',
      ['band-next', 'band-plans', 'month-summary', 'month-legend-fold'],
    ],
    ['/week', 'week', /担当なしの訪問を組む/, 'week-details', ['week-status']],
    ['/plan', 'plan', /訪問を追加/, 'day-details', ['plan-summary', 'plan-score']],
  ]) {
    await open1(page, to);
    const btns = await toolbarButtons(page);
    check(btns.length <= 2, `${to}：操作の行のボタンは2つまで（その他 ▾ を除く）`, btns);
    check(btns.length >= 1 && btns[0].primary && primaryText.test(btns[0].text), `${to}：1つ目が主ボタン`, btns);
    check(btns.filter((b) => b.primary).length === 1, `${to}：操作の行の主ボタンは1つ`, btns);
    check((await page.locator('main .btn-primary, .content .btn-primary').count()) <= 1, `${to}：画面の主ボタンは1つ`);
    check((await page.getByTestId('undo-btn').count()) === 0, `${to}：元に戻すは操作の行に出さない（その他 ▾ の中）`);
    const fold = page.getByTestId(detailsId);
    check((await fold.count()) === 1, `${to}：「詳しく」がある`);
    check(!(await fold.evaluate((e) => e.open)), `${to}：「詳しく」は初め閉じている`);
    for (const id of hidden) {
      const loc = page.getByTestId(id);
      check(
        (await loc.count()) === 0 || !(await loc.first().isVisible()),
        `${to}：閉じている間は ${id} が見えない（「詳しく」の中）`,
      );
    }
    // 「その他 ▾」に 元に戻す・表示の切り替えなど
    await page.getByTestId(`${zoom}-more`).click();
    const menu = await texts(page.getByRole('menuitem'));
    check(
      menu.some((t) => /^元に戻す/.test(t)),
      `${to}：「その他 ▾」に元に戻す`,
      menu,
    );
    if (to !== '/week')
      check(
        menu.some((t) => /で見る/.test(t)),
        `${to}：「その他 ▾」に表示の切り替え`,
        menu,
      );
    check(!BANNED.test(menu.join(' ')), `${to}：「その他 ▾」に禁句が出ない`, menu);
    if (to === '/month') await shot(page, 'simple-month-more-1366');
    await page.keyboard.press('Escape');
    // 禁句：開く前の画面全体
    const body = await page.locator('main, .content').first().innerText();
    check(!BANNED.test(body), `${to}：画面に 標準・提案・反映・ピン・プリセット が出ない`, body.match(BANNED)?.[0]);
    // 「詳しく」を開くと中身が見える
    await page.getByTestId(`${detailsId}-summary`).click();
    check(await fold.evaluate((e) => e.open), `${to}：「詳しく」を押すと開く`);
    await shot(page, `simple-${zoom}-details-1366`);
    const first = page.getByTestId(hidden[0]);
    if (await first.count()) check(await first.first().isVisible(), `${to}：開くと ${hidden[0]} が見える`);
    const inner = await fold.innerText();
    check(!BANNED.test(inner), `${to}：「詳しく」の中にも禁句が出ない`, inner.match(BANNED)?.[0]);
    if (to === '/plan') {
      check(/点数/.test(inner) && /移動/.test(inner), '日：「詳しく」の中に点数・移動の分数がある');
      check((await page.locator('.tl-leg, .tl-wait').count()) === 0, '日：時間軸に移動・待ちの分数の線が出ない');
      check((await page.getByTestId('unplaced-reason').count()) === 0, '日：担当なしの札に入れられない理由を出さない');
      check((await page.getByTestId('band-care').count()) === 0, '日：要対応の件数の内訳の帯を出さない');
      const marks = await page.locator('[data-testid="visit-marks"] [data-kind="pin"], [data-kind="unfit"]').count();
      check(marks === 0, '日：ピン・資格✗／限✗の印を出さない');
      check((await page.locator('.tl-band').count()) > 0, '日：時間軸に訪問の帯（時刻・名前）がある');
      const band = (await page.locator('.tl-band-btn').first().innerText()).trim().split('\n');
      check(band.length <= 2, '日：帯は時刻と名前だけ', band);
      // 順番の表示：札は時刻・名前の1行
      await page.getByTestId('plan-more').click();
      await page.getByTestId('plan-view-order').click();
      await settle(page, 600);
      const dir = await page
        .locator('.route-item.is-oneline .route-btn')
        .first()
        .evaluate((e) => getComputedStyle(e).flexDirection);
      check(dir === 'row', '日：順番の札は時刻・名前が1行（横並び）', dir);
      check((await page.locator('.leg-btn').count()) === 0, '日：順番の表示に移動・待ちの分数を出さない');
      await shot(page, 'simple-plan-order-1366');
      await page.getByTestId('plan-more').click();
      await page.getByTestId('plan-view-timeline').click();
    }
    if (to === '/week') check(!BANNED.test(await page.getByTestId('week-details').innerText()), '週：詳しくに禁句なし');
  }
  // 日の「一覧で見る」：ピン・条件に合わないの札と禁句が出ない
  await open1(page, '/plan');
  await page.getByTestId('plan-more').click();
  await page.getByTestId('plan-view-list').click();
  await settle(page, 600);
  check((await page.locator('.chip-pin, .chip-red').count()) === 0, '日（一覧）：ピン・条件に合わないの札を出さない');
  const listBody = await page.locator('main, .content').first().innerText();
  check(!BANNED.test(listBody), '日（一覧）：禁句が出ない', listBody.match(BANNED)?.[0]);
  await page.getByTestId('plan-more').click();
  await page.getByTestId('plan-view-timeline').click();
  // 訪問の札の詳細の「理由」は「詳しく」の中
  await page.locator('.tl-band-btn').first().click();
  await settle(page, 300);
  check((await page.getByTestId('visit-reason-details').count()) >= 1, '日：札の詳細の理由は「詳しく」の中');
  check(
    !(await page
      .getByTestId('visit-reason-details')
      .first()
      .evaluate((e) => e.open)),
    '日：札の詳細の理由は初め閉じている',
  );
  // 月のマス・右の欄：条件に合わない・拘束超・内訳を出さず、帯と数がそろう
  await open1(page, '/month');
  const cells = await page.locator('.month-cell').allInnerTexts();
  check(!cells.some((t) => /条件に合わない|拘束超/.test(t)), '月：マスに「条件に合わない」「拘束超」を出さない');
  const aside = await page.getByTestId('month-aside').innerText();
  check(
    !/条件に合わない|拘束|未連絡/.test(aside),
    '月：右の欄に条件に合わない・拘束・未連絡を出さない',
    aside.slice(0, 120),
  );
  check(!/要対応 \d+件（/.test(aside), '月：右の欄の要対応の行に内訳（括弧）を出さない');
  const care = await page
    .locator('[data-kind="care"]')
    .evaluateAll((els) => els.reduce((n, e) => n + Number(/要対応 (\d+)件/.exec(e.textContent)?.[1] ?? 0), 0));
  const bandText = await page.getByTestId('attention-band-text').innerText();
  const bandTotal = [...bandText.matchAll(/(\d+)件/g)].reduce((n, m) => n + Number(m[1]), 0);
  check(care > 0 && care <= bandTotal, '月：右の欄の要対応の合計は帯の件数（今日〜翌月末）を超えない', {
    care,
    bandTotal,
  });
  check((await page.getByTestId('month-attention-details').count()) === 1, '月：右の欄の内訳は「詳しく」の中');
  // 過去の週：要対応・印を出さず、1行の状態の無い「詳しく」は凡例だけ
  await page.goto('about:blank');
  await page.goto(`${BASE}#/week`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '前の週' }).click();
  await settle(page, 800);
  check((await page.getByTestId('week-status').count()) === 0, '過去の週：1行の状態（今日以降）は無い');
  const wd = page.getByTestId('week-details');
  check((await wd.count()) === 1, '過去の週：時間軸の凡例の「詳しく」はある');
  check((await wd.innerText()).indexOf('資格') < 0, '週：凡例に資格✗・限✗を出さない');
  check((await page.locator('[data-kind="issue"]').count()) === 0, '過去の週：要対応の印を出さない');
  // 「詳しく」は操作の行の下（週）
  check(
    await page.evaluate(
      () =>
        !!(
          document
            .querySelector('[data-testid="schedule-toolbar"]')
            .compareDocumentPosition(document.querySelector('[data-testid="week-details"]')) & 4
        ),
    ),
    '週：「詳しく」は操作の行より下',
  );
  // 担当なしの訪問を押す前でも、訪問の帯に要対応の印は担当なし（赤い枠）。週の帯：ピンの印は出ない
  await open1(page, '/week');
  check(
    (await page.locator('[data-kind="pin"], [data-kind="unfit"]').count()) === 0,
    '週：ピン・資格✗／限✗の印を出さない',
  );
  await shot(page, 'simple-week-1366');
}

/** 5c 画面の上の説明：1行・初回だけ・閉じたら覚える（画面ごと） */
async function intro(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate((k) => localStorage.removeItem(k), INTRO_KEY);
  for (const to of ['/month', '/week', '/plan']) {
    await open1(page, to);
    const el = page.getByTestId('page-intro');
    check((await el.count()) === 1, `${to}：初回は説明が出る`);
    const h = await el.evaluate((e) => e.getBoundingClientRect().height);
    check(h < 40, `${to}：説明は1行`, h);
    if (to === '/month') await shot(page, 'simple-month-intro-1366');
  }
  // 月で閉じる → 読み直しても月は出ない。週・日はまだ出る
  await open1(page, '/month');
  await page.getByTestId('page-intro-close').click();
  check((await page.getByTestId('page-intro').count()) === 0, '月：閉じると消える');
  await page.reload();
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await settle(page, 500);
  check((await page.getByTestId('page-intro').count()) === 0, '月：読み直しても出ない（端末に覚える）');
  await open1(page, '/week');
  check((await page.getByTestId('page-intro').count()) === 1, '週：月で閉じても、週の説明は出る（画面ごと）');
  await page.evaluate((k) => localStorage.removeItem(k), INTRO_KEY);
}

/** 5d スマホ（390px）：操作の行・「詳しく」・「その他 ▾」 */
async function mobileExceptions(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [to, zoom] of [
    ['/month', 'month'],
    ['/week', 'week'],
    ['/plan', 'plan'],
  ]) {
    await open1(page, to);
    const btns = await toolbarButtons(page);
    check(btns.length <= 2, `${to}（390px）：操作の行のボタンは2つまで`, btns);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!overflow, `${to}（390px）：横にはみ出さない`);
    await page.getByTestId(`${zoom}-more`).click();
    await settle(page, 300);
    await shot(page, `simple-${zoom}-more-390`);
    await page.keyboard.press('Escape');
    const fold = page.locator('[data-testid$="-details"]').first();
    if (await fold.count()) {
      await page.locator('[data-testid$="-details-summary"]').first().click();
      await settle(page, 300);
      await shot(page, `simple-${zoom}-details-390`);
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

/** 6b 入：操作の行・説明・進み具合は今のまま */
async function expertSame(page) {
  await page.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem(k));
    d.org.features = { ...d.org.features, expert: true };
    localStorage.setItem(k, JSON.stringify(d));
  }, STORAGE_KEY);
  await open1(page, '/month');
  check((await page.getByTestId('progress-band').count()) === 1, '入：月の進み具合の帯は上にある');
  check((await page.getByTestId('month-details').count()) === 0, '入：「詳しく」は出ない');
  check((await page.getByTestId('undo-btn').count()) === 1, '入：元に戻すは操作の行にある');
  check((await page.getByTestId('page-intro').count()) === 0, '入：説明に閉じるボタンは無い（今のまま）');
  check((await page.locator('.page-lead').count()) === 1, '入：説明は今のまま出る');
  await open1(page, '/plan');
  check((await page.getByTestId('plan-summary').count()) === 1, '入：日の「今の担当」の1行は上にある');
  check((await page.getByTestId('plan-help-btn').count()) === 1, '入：使い方は操作の行にある');
  check((await page.locator('.tl-leg').count()) > 0, '入：時間軸に移動の分数の線がある');
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

/** 画面ごとの欄（節）の data-section の並び。「詳しく」の外／中 */
const sections = (loc) =>
  loc.locator('[data-testid="person-sec"]').evaluateAll((els) => els.map((e) => e.dataset.section));

/** 人の画面（?tab=…）を開いて、出す欄と「詳しく」の中の欄を確かめる。shown は外に見える欄、folded は「詳しく」の中の欄（の一部） */
async function peopleDetail(page, { label, base, tab, shown, folded, absentTab, brief, shot: name }) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#${base}${tab ? `?tab=${tab}` : ''}`);
  await page.getByTestId('person-view').waitFor({ timeout: 60000 });
  await settle(page, 600);
  const tabs = await page
    .locator('[data-testid="person-tabs"] [data-tab]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')));
  check(!tabs.includes(absentTab), `${label}：${absentTab} のタブは出さない（中身は「詳しく」の中）`, tabs);
  if (brief) {
    const t = await page.getByTestId('person-brief').innerText();
    check(brief.test(t), `${label}：見出しに住所・いつもの予定を出す`, t);
  }
  const fold = page.getByTestId('person-details');
  check((await fold.count()) === 1, `${label}：「詳しく」がある`);
  check(!(await fold.evaluate((e) => e.open)), `${label}：「詳しく」は初め閉じている`);
  const outer = await sections(
    page.locator(
      '[data-testid="person-view"] > .person-sections, [data-testid="person-view"] > .stack > .person-sections',
    ),
  );
  for (const k of shown) check(outer.includes(k), `${label}：「${k}」の欄は外に出ている`, outer);
  const inner = await sections(fold);
  for (const k of folded) check(inner.includes(k), `${label}：「${k}」の欄は「詳しく」の中`, inner);
  for (const k of folded) check(!outer.includes(k), `${label}：「${k}」の欄は外に出ない`, outer);
  const first = fold.locator(`[data-section="${folded[0]}"]`);
  check(!(await first.isVisible()), `${label}：閉じている間は「${folded[0]}」が見えない`);
  const body = await page.getByTestId('person-view').innerText();
  check(!BANNED.test(body), `${label}：禁句が出ない`, body.match(BANNED)?.[0]);
  await shot(page, `simple-people-${name}-closed-${page.viewportSize().width}`);
  await page.getByTestId('person-details-summary').click();
  check(await fold.evaluate((e) => e.open), `${label}：「詳しく」を押すと開く`);
  check(await first.isVisible(), `${label}：開くと「${folded[0]}」が見える`);
  await shot(page, `simple-people-${name}-open-${page.viewportSize().width}`);
}

/** 一覧の列 */
async function peopleList(page, { label, to, table, heads, row }) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#${to}`);
  await page.locator(row).first().waitFor({ timeout: 60000 });
  await settle(page, 500);
  const ths = (await texts(page.locator(`[data-testid="${table}"] thead th`))).filter((t) => t);
  check(JSON.stringify(ths) === JSON.stringify(heads), `${label}：一覧の列は ${heads.join('・')} の3列だけ`, ths);
  const cells = await page.locator(row).first().locator('td').count();
  check(cells === heads.length + 1, `${label}：行のセルは3列＋開く`, cells);
  const body = await page.locator('main, .content').first().innerText();
  check(!BANNED.test(body), `${label}：一覧に禁句が出ない`, body.match(BANNED)?.[0]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, `${label}：横にはみ出さない`);
  await shot(page, `simple-people-${to.slice(1)}-list-${page.viewportSize().width}`);
}

/** 5e 切：人の画面は畳む・日の予定の地図はボタンで開く・月のマスの読み方（幅ごとに回す。落ちても幅は restoreWidth が戻す） */
async function people(page) {
  await fresh(page, '/clients', '[data-testid="client-row"]', { start: 'demo' });
  const terms = (await data(page)).org.terms;
  const cid = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).clients[0].id, STORAGE_KEY);
  const sid = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).staff[0].id, STORAGE_KEY);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    const w = `${width}px`;
    await peopleList(page, {
      label: `${terms.client}一覧（${w}）`,
      to: '/clients',
      table: 'narrow-clients',
      heads: ['名前', '住所', 'いつもの予定'],
      row: '[data-testid="client-row"]',
    });
    await peopleList(page, {
      label: `${terms.staff}一覧（${w}）`,
      to: '/staff',
      table: 'narrow-staff',
      heads: ['名前', '勤務日', '勤務時間'],
      row: '[data-testid="staff-row"]',
    });
    await peopleDetail(page, {
      label: `${terms.client}の画面（${w}）`,
      base: `/clients/${cid}`,
      tab: 'basic',
      shown: ['basic', 'place'],
      folded: ['stage', 'traits', 'staffing', 'conds'],
      absentTab: 'staffing',
      brief: /\S/,
      shot: 'client',
    });
    await peopleDetail(page, {
      label: `${terms.staff}の基本情報（${w}）`,
      base: `/staff/${sid}`,
      tab: 'basic',
      shown: ['basic'],
      folded: ['home', 'traits', 'conds', 'compat'],
      absentTab: 'compat',
      shot: 'staff',
    });
    await peopleDetail(page, {
      label: `${terms.staff}の勤務時間（${w}）`,
      base: `/staff/${sid}`,
      tab: 'hours',
      shown: ['hours'],
      folded: ['overrides'],
      absentTab: 'compat',
      shot: 'staff-hours',
    });
    await planMap(page, w);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await monthTip(page);
}

/** 日の予定の地図：ふだん閉じ、「地図」のボタンで開く（PC もスマホと同じ形） */
async function planMap(page, w) {
  await open1(page, '/plan');
  await page.getByTestId('attention-band').waitFor({ timeout: 60000 });
  check((await page.getByTestId('plan-map').count()) === 0, `日の予定（${w}）：地図は閉じている（ページに置かない）`);
  const fab = page.locator('.map-dock-fab');
  await fab.waitFor({ timeout: 10000 });
  check(/地図/.test(await fab.innerText()), `日の予定（${w}）：「地図」のボタンがある`);
  check((await page.locator('section.map-dock').count()) === 0, `日の予定（${w}）：ボタンを押すまで地図は出ない`);
  await shot(page, `simple-plan-map-closed-${page.viewportSize().width}`);
  await fab.click();
  const dock = page.locator('section.map-dock');
  await dock.waitFor({ timeout: 10000 });
  await settle(page, 1200);
  check(await dock.isVisible(), `日の予定（${w}）：「地図」を押すと地図が開く`);
  check((await dock.getByLabel('ページの地図へ移る').count()) === 0, `日の予定（${w}）：ページの地図へ移る矢印は無い`);
  await shot(page, `simple-plan-map-open-${page.viewportSize().width}`);
  await dock.getByLabel('地図を閉じる').click();
  await fab.waitFor({ timeout: 10000 });
  check(true, `日の予定（${w}）：閉じると「地図」のボタンに戻る`);
}

/** 月のマスの「このマスの読み方」：切は帯の3種類と「変更あり」。条件に合わない・拘束超は言わない */
async function monthTip(page) {
  await open1(page, '/month');
  const cell = page.locator('.month-cell.is-care [data-tip]').first();
  await cell.waitFor({ timeout: 30000 });
  await cell.hover();
  const tip = page.getByTestId('month-cell-tip');
  await tip.waitFor({ timeout: 10000 });
  const t = await tip.innerText();
  check(/担当なし・重なり・休みの人/.test(t), '月のマスの読み方：要対応は 担当なし・重なり・休みの人', t);
  check(!/条件に合わない|拘束/.test(t), '月のマスの読み方：条件に合わない・拘束超は言わない', t);
  check(!BANNED.test(t), '月のマスの読み方：禁句が出ない', t.match(BANNED)?.[0]);
  await shot(page, 'simple-month-tip-1366');
  await page.mouse.move(0, 0);
}

/** 途中で落ちても幅を戻す（スマホの段が落ちて、あとの段が 390px のまま走らないように） */
const restoreWidth = (fn) => async (page) => {
  try {
    await fn(page);
  } finally {
    await page.setViewportSize({ width: 1366, height: 768 });
  }
};

const steps = sharedPage({
  open,
  steps: [
    ['1 切：#/home・#/・知らない URL は予定へ', redirects],
    ['2 切：メニューは4つ・パレットにホームが無い', menu],
    ['3 切：予定の上の要対応の帯（押すとその訪問へ）', band],
    ['3b 切：訪問が無ければ帯を出さない', noBand],
    ['4 切：予定の「その他 ▾」から空き状況', more],
    ['5 切：スマホの下のタブ・引き出し・帯', restoreWidth(mobile)],
    ['5b 切：例外だけ見せる（操作の行・詳しく・札・言葉）', exceptions],
    ['5c 切：画面の上の説明は1行・閉じたら出ない', intro],
    ['5d 切：スマホの操作の行・詳しく', restoreWidth(mobileExceptions)],
    ['5e 切：人の画面は畳む・地図はボタンで開く・マスの読み方', restoreWidth(people)],
    ['6 入：今のメニュー・ホーム・帯なし', expertOn],
    ['6b 入：操作の行・説明・進み具合は今のまま', expertSame],
  ],
  call: (fn, s) => fn(s.page),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
