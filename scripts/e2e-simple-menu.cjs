// 「基本」のメニュー5つ・要対応の帯（PRD D400・D403。ADR-0073・ADR-0077・ADR-0078）を本物のブラウザで確かめる。
// 初めて開いたとき（デモ×定期＝「基本」のひな形＝エキスパート機能は切）で、
// 1 #/home・#/・知らない URL は予定（月）へ移る（ホームの画面は出ない）、
// 2 左のメニューは 予定・空き状況・〈利用者さん〉・〈スタッフ〉・設定 の5つ（見出し・子の項目なし。今の画面の印・押して移る）。コマンドパレットの画面にホームが無い、
// 3 予定（月・週・日）の上に要対応の帯（担当なし N件…。箱で、右に［担当なしを組む］（従のボタン。押したあとは e2e-basic-auto）と［見に行く ›］。
//   見に行くは重なり・休みの人の訪問を先に、無ければ担当なし。日の予定で今日を見たまま押しても変わる）。月・週・日のどれにも出る。訪問が無ければ出さない、
// 4 空き状況はメニューの項目（押すと空き状況・印は「空き状況」）。予定の「その他 ▾」（月・週・日）には空き状況・担当なしの訪問を組むが無い、
// 5 スマホ（390px）：下のタブは 予定・〈利用者さん〉・〈スタッフ〉・設定＋探す＋メニュー。引き出しは空き状況を足した5つ。帯（［担当なしを組む］・［見に行く ›］）・「その他 ▾」が収まる、
// 5b 例外だけ見せる（PRD D384）：月・週・日の操作の行は主ボタン1つ＋1つ（＋「その他 ▾」。元に戻す・表示の切り替え・使い方は「その他 ▾」の中）、
//    点数・理由・件数の内訳・凡例・進み具合は「詳しく」の中（閉じているときは見えない・開くと見える）、移動・待ちの分数の線と担当なしの理由の札は出ない、
//    訪問の札は時刻・名前の1行（順番の表示）、ピン・資格✗の印は出ない、「標準・提案・反映・ピン・プリセット」の言葉が月・週・日と「その他 ▾」「詳しく」に出ない、
// 5c 画面の上の説明は1行で、閉じたら読み直しても出ない（画面ごと。この端末に覚える）、
// 5e 人の画面は畳む・日の予定の地図はボタンで開く・月のマスの読み方（PRD D385・D384）：〈利用者さん〉の一覧は名前・住所・いつもの予定の3列、
//    〈スタッフ〉は名前・勤務日・勤務時間の3列。詳細は〈利用者さん〉＝名前・住所・予定（繰り返し）／〈スタッフ〉＝名前・勤務日・勤務時間を出し、
//    段階・特性・決まりごと・担当・相性（〈スタッフ〉は自宅・特性・求めること・日ごとの勤務ほか）は「詳しく ▾」の中（閉じていると見えない・開くと見える）。
//    日の予定の地図はふだん閉じ、「地図」のボタンで開く（1366px・390px）。月のマスの読み方は帯の3種類と「変更あり」に合わせ、条件に合わない・拘束超は言わない、
// 5f 「予定を入れる」と〈スタッフ〉・〈利用者さん〉のタブ（PRD D402）：月・週の主ボタンは「予定を入れる」（操作の行は2つまで。担当なしを組むは帯の［担当なしを組む］）、
//    押すと引き出し（定期＝〈利用者さん〉・曜日・くり返し・時刻・所要／単発＝〈利用者さん〉・日付・時刻・所要）で「入れる」→ 予定に出て担当が自動で付く。
//    〈スタッフ〉の一覧の上のタブ（一覧・勤務・相性）と〈利用者さん〉のタブ（一覧・相性）で行き来でき、メニューの印は〈スタッフ〉／〈利用者さん〉に付き、
//    相性・勤務の画面に禁句・点数が出ない。1366px・390px。幅は落ちても戻す、
// 6 エキスパート機能を入にすると帯に 組み方の標準が無い・未確定 N日 が足され［担当なしを組む］は出ない（入のメニュー・ホームが無いことは e2e-nav・e2e-home）。
// 6b 入の操作の行（主ボタン＋1つ＋「その他 ▾」）・「詳しく ▾」の見出しの数と開け閉めの覚え・説明1行。
// 6c 入の人の一覧（PRD D394）：〈スタッフ〉・〈利用者さん〉の一覧は見出しがメニューの名前で、切と同じ人のタブ（一覧・勤務・相性／一覧・相性）と3列で始まり、
//    表の上の「くわしい列」を入れると専門の列が足され、一覧ごとに端末に覚えて読み直しても同じ（外すと3列に戻る。切は切り替えが無い）。休止中は状態の列に重ねない。
//    相性は来た側のタブ・メニューの印。1366px・390px（予定を組むの4段・基本情報のタブは e2e-nav）。
// スクリーンショット：simple-band-go-day-1366（3）、simple-add-*（5f）・simple-clients-1366・simple-staff-1366・simple-plan-map-closed-1366 ほか（5e は simple-people-*・simple-plan-map-*）、simple-month-1366・simple-band-plan-1366・simple-menu-more-1366・simple-week-390・simple-tabs-390・simple-drawer-390
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-simple-menu.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const { BASE, STORAGE_KEY, check, runSteps, settle, until, shot } = require('./lib/env.cjs');
const { openPage, sharedPage } = require('./lib/steps.cjs');
const { freshAsked } = require('./lib/firstRun.cjs');
const { navUsr, pressTool, watchNavUsr } = require('./lib/ui.cjs');

const data = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
const hash = (page) => new URL(page.url()).hash;
const side = (page) => page.locator('.side-nav [data-testid="nav-link"]');
const texts = (loc) => loc.evaluateAll((els) => els.map((e) => e.textContent.trim().replace(/\s+/g, ' ')));

const fresh = freshAsked;

const NAV_READY = '[data-testid="sched-nav"]';

/** 準備：1366×768・初回は2問を出す（fresh で答える）。時計は NOW に止める */
const open = () => openPage({ viewport: { width: 1366, height: 768 }, start: 'ask' });

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

/** 2 左のメニューは5つ（空き状況を含む）・コマンドパレットの画面にホームが無い */
async function menu(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  const terms = (await data(page)).org.terms;
  const labels = await texts(side(page));
  check(
    JSON.stringify(labels) === JSON.stringify(['予定', '空き状況', terms.client, terms.staff, '設定']),
    '左のメニューは 予定・空き状況・〈利用者さん〉・〈スタッフ〉・設定 の5つ（呼び名は org.terms。PRD D400）',
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
  await go('空き状況', /^#\/vacancy/);
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
    'パレットに 月の予定・空き状況 はある（パレットは変わらない）',
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
  // 帯は1つのボタンではなく、箱（文・［担当なしを組む］・［見に行く ›］）。担当なしを組むは従のボタン（主ボタンは画面に1つ。PRD D403）
  check(
    (await bandEl.evaluate((el) => el.tagName)) !== 'BUTTON' && (await bandEl.locator('button').count()) === 2,
    '帯は箱で、中のボタンは2つ（担当なしを組む・見に行く）',
  );
  check(
    (await page.getByTestId('attention-band-arrange').count()) === 1 &&
      (await page.getByTestId('attention-band-go').count()) === 1,
    '帯に［担当なしを組む］と［見に行く ›］がある（切で組める担当なしがある）',
  );
  check((await bandEl.locator('.btn-primary').count()) === 0, '帯のボタンは主ボタン（.btn-primary）ではない');
  await watchNavUsr(page);
  await page.getByTestId('attention-band-go').click();
  await until(async () => /^#\/plan/.test(hash(page)));
  check(/^#\/plan/.test(hash(page)), '帯の［見に行く ›］を押すと日の予定へ移る', hash(page));
  const id = (await navUsr(page))?.visitId ?? null;
  check(!!id, '行き先の訪問の ID を渡している', id);
  // 日の予定が並びを出して受け取ったあとに消す（読み込みが遅いと少し後）
  const cleared = await until(async () => (await page.evaluate(() => history.state?.usr ?? null)) === null, 30000);
  check(!!cleared, '受けた state は履歴から消す（戻る・読み直しで開き直さない）');
  const el = page.locator(`[data-visit="${id}"]`).first();
  await el.waitFor({ timeout: 30000 });
  // 巻くのは滑らかに動く（動きを減らす設定でなければ）ので、止まるまで待つ
  const visible = () =>
    el.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    });
  const inView = await until(visible, 10000);
  check(!!inView, '開いた訪問が画面に見える所にある（巻かれている）', id);
  check((await page.getByTestId('attention-band').count()) === 1, '日の予定にも帯が出る', before);
  await shot(page, 'simple-band-plan-1366');
  await bandGoOnDay(page);
}

/** 日の予定で今日を見たまま［見に行く ›］を押すと画面が変わる（PRD D403。重なりがあればその訪問の日へ移って選び、担当なしだけなら欄を開く） */
async function bandGoOnDay(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/plan`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await page.getByTestId('attention-band-go').waitFor({ timeout: 60000 });
  await settle(page, 600);
  const usr = () => navUsr(page);
  const dateOf = () => page.locator('.date-switch select').inputValue();
  const was = { key: await page.evaluate(() => history.state?.key ?? null), date: await dateOf() };
  await watchNavUsr(page);
  await page.getByTestId('attention-band-go').click();
  await until(async () => (await usr())?.band === true);
  const st = await usr();
  check(st?.band === true && !!st.visitId, '日の予定で押すと state に { visitId, band: true } を渡す', st);
  check(/^#\/plan/.test(hash(page)), '日の予定で押しても日の予定', hash(page));
  const key = await page.evaluate(() => history.state?.key ?? null);
  check(key !== was.key, '日の予定で今日を見たまま押すと画面が変わる（移り直す）', { was, key });
  const el = page.locator(`[data-visit="${st.visitId}"]`).first();
  await el.waitFor({ timeout: 30000 });
  const panelOpen = await until(async () => (await page.getByTestId('visit-panel').count()) > 0, 5000);
  const picked = await el.evaluate((e) => e.classList.contains('is-picked'));
  const text = await page.getByTestId('attention-band-text').innerText();
  // 重なり・休みの人があれば、その訪問のある日へ移って選ばれる（担当なしの欄は開かない）。無ければ担当なしの訪問の欄を開く
  if (/重なり \d+件|休みの人 \d+件/.test(text)) {
    // 担当が休止中の訪問は担当の列に無く選べないので欄が開く（どちらかで画面が変わる）
    check(picked || !!panelOpen, '重なり・休みの人の訪問は、日の予定で選ばれる（選べなければ欄が開く）', {
      visitId: st.visitId,
      picked,
    });
    check((await dateOf()) !== was.date || picked || !!panelOpen, '今日を見たまま押しても画面が変わる', {
      was: was.date,
      date: await dateOf(),
    });
  } else {
    check(!!panelOpen, '担当なしだけなら、その訪問の欄（訪問の詳細）が開く', { visitId: st.visitId });
  }
  await shot(page, 'simple-band-go-day-1366');
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

/** 4 空き状況はメニューの項目（PRD D400。ADR-0078）：押すと空き状況・印も「空き状況」。予定の「その他 ▾」には空き状況・担当なしの訪問を組むが無い（月・週・日） */
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
    if ((await page.getByTestId(id).count()) > 0) {
      await page.getByTestId(id).click();
      await page.getByRole('menuitem').first().waitFor({ timeout: 10000 });
      if (to === '/month') await shot(page, 'simple-menu-more-1366');
      check(
        (await page.getByTestId('more-vacancy').count()) === 0 &&
          (await page.getByTestId('more-auto-arrange').count()) === 0 &&
          (await page.getByRole('menuitem', { name: /空き状況|担当なしの訪問を組む/ }).count()) === 0,
        `${to}：「その他 ▾」に空き状況・担当なしの訪問を組むは無い`,
      );
      await closeMore(page, to === '/plan' ? 'plan' : to.slice(1));
    } else check(true, `${to}：「その他 ▾」自体が無い（空き状況・担当なしの訪問を組むも無い）`);
    check((await page.getByTestId('toolbar-arrange').count()) === 0, `${to}：操作の行に toolbar-arrange は無い`);
    await side(page).filter({ hasText: '空き状況' }).first().click();
    await until(async () => /^#\/vacancy/.test(hash(page)));
    check(/^#\/vacancy/.test(hash(page)), `${to}：メニューの空き状況を押すと空き状況の画面`, hash(page));
    await until(async () => (await texts(page.locator('.side-nav [aria-current="page"]'))).join() === '空き状況');
    const cur = await texts(page.locator('.side-nav [aria-current="page"]'));
    check(JSON.stringify(cur) === JSON.stringify(['空き状況']), '空き状況の画面は「空き状況」に印', cur);
  }
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
    '下のタブは 予定・〈利用者さん〉・〈スタッフ〉・設定 と「探す」（空き状況は引き出しだけ。下のタブは変えない）',
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
  // 引き出しも5つ。移った先の画面（別のチャンク）が描き終わってから開く（描き直しで引き出しが閉じないように）。開かなければ1回だけ押し直す
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
    JSON.stringify(dl) === JSON.stringify(['予定', '空き状況', terms.client, terms.staff, '設定']),
    '引き出しも 予定・空き状況・〈利用者さん〉・〈スタッフ〉・設定 の5つ',
    dl,
  );
  await settle(page, 600);
  await shot(page, 'simple-drawer-390');
  await page.keyboard.press('Escape');
  // 帯と「その他 ▾」（週）
  await page.goto('about:blank');
  await page.goto(`${BASE}#/plan`);
  await page.getByTestId('attention-band').waitFor({ timeout: 60000 });
  // スマホの日の予定は主ボタンが無い（担当なしを組むは帯の［担当なしを組む］。PRD D403）
  await page.getByTestId('attention-band-arrange').waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId('toolbar-arrange').count()) === 0,
    'スマホの日の予定に toolbar-arrange（主ボタン）は無い',
  );
  check(
    (await page.getByTestId('attention-band-go').isVisible()) &&
      (await page.getByTestId('attention-band-arrange').isVisible()),
    'スマホの帯に［担当なしを組む］と［見に行く ›］が見える',
  );
  await shot(page, 'simple-plan-more-390');
  await page.setViewportSize({ width: 1366, height: 768 });
}

/** 「その他 ▾」を閉じる（Esc。開いている間に画面が組み直されてフォーカスが外れていたら、ボタンを押し直して閉じる） */
async function closeMore(page, zoom) {
  await page.keyboard.press('Escape');
  await settle(page, 200);
  if ((await page.getByRole('menuitem').count()) > 0) await page.getByTestId(`${zoom}-more`).click();
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

/** 日の主ボタンを押すと新規の訪問の欄が開き、その見出しも主ボタンと同じ言葉（入切とも「予定を入れる」。PRD D402） */
async function dayAddOpens(page, label) {
  const btn = page.getByTestId('plan-visit-add');
  check((await btn.innerText()).trim() === label, `日の主ボタンの文字は「${label}」`);
  await btn.click();
  const panel = page.getByTestId('visit-panel');
  await panel.waitFor({ timeout: 10000 });
  check((await panel.getAttribute('data-new')) === 'true', `「${label}」で新規の訪問の欄（中身は今のまま）`);
  check(
    (await page.getByRole('dialog').getByRole('heading', { level: 2 }).first().innerText()).trim() === label,
    `欄の見出しも「${label}」`,
  );
  await shot(page, `simple-day-add-${page.viewportSize().width}`);
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
}

/** 5b 例外だけ見せる：操作の行・「詳しく」・札・言葉（月・週・日） */
async function exceptions(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await fresh(page, '/month', NAV_READY, { start: 'demo' });
  // 開け閉め・説明の覚えは前の段から持ち越さない（閉じて始まる確かめのため）
  await page.evaluate((k) => localStorage.removeItem(k), INTRO_KEY);
  for (const [to, zoom, primaryText, detailsId, hidden] of [
    [
      '/month',
      'month',
      /予定を入れる/,
      'month-details',
      ['band-next', 'band-plans', 'month-summary', 'month-legend-fold'],
    ],
    ['/week', 'week', /予定を入れる/, 'week-details', ['week-status']],
    ['/plan', 'plan', /^予定を入れる$/, 'day-details', ['plan-summary', 'plan-score']],
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
    if (to === '/plan') await dayAddOpens(page, '予定を入れる');
    await closeMore(page, zoom);
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
      await pressTool(page, 'plan-view-order', { where: 'more' });
      await settle(page, 600);
      const dir = await page
        .locator('.route-item.is-oneline .route-btn')
        .first()
        .evaluate((e) => getComputedStyle(e).flexDirection);
      check(dir === 'row', '日：順番の札は時刻・名前が1行（横並び）', dir);
      check((await page.locator('.leg-btn').count()) === 0, '日：順番の表示に移動・待ちの分数を出さない');
      await shot(page, 'simple-plan-order-1366');
      await pressTool(page, 'plan-view-timeline', { where: 'more' });
    }
    if (to === '/week') check(!BANNED.test(await page.getByTestId('week-details').innerText()), '週：詳しくに禁句なし');
  }
  // 開け閉めは画面ごとに端末に覚える（切も入と同じ部品）：開いた月・週・日は読み直しても開いたまま、閉じて読み直すと閉じる
  for (const [to, id] of [
    ['/month', 'month-details'],
    ['/week', 'week-details'],
    ['/plan', 'day-details'],
  ]) {
    await open1(page, to);
    check(
      await page.getByTestId(id).evaluate((e) => e.open),
      `${to}：開いた「詳しく」は読み直しても開いたまま（端末に覚える）`,
    );
  }
  await open1(page, '/month');
  await page.getByTestId('month-details-summary').click();
  await page.reload();
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await settle(page, 600);
  check(!(await page.getByTestId('month-details').evaluate((e) => e.open)), '/month：閉じて読み直すと閉じたまま');
  check(
    (await page.evaluate(() => !!document.querySelector('[data-testid="month-details-heading"]'))) === false,
    '切：見出しに数を出さない',
  );
  await page.getByTestId('month-details-summary').click();
  // 日の「一覧で見る」：ピン・条件に合わないの札と禁句が出ない
  await open1(page, '/plan');
  await pressTool(page, 'plan-view-list', { where: 'more' });
  await settle(page, 600);
  check((await page.locator('.chip-pin, .chip-red').count()) === 0, '日（一覧）：ピン・条件に合わないの札を出さない');
  const listBody = await page.locator('main, .content').first().innerText();
  check(!BANNED.test(listBody), '日（一覧）：禁句が出ない', listBody.match(BANNED)?.[0]);
  await pressTool(page, 'plan-view-timeline', { where: 'more' });
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
    await shot(page, `simple-${zoom}-toolbar-390`);
    await page.getByTestId(`${zoom}-more`).click();
    await settle(page, 300);
    await shot(page, `simple-${zoom}-more-390`);
    await page.keyboard.press('Escape');
    const fold = page.locator('[data-testid$="-details"]').first();
    if (await fold.count()) {
      // 開け閉めは覚えるので、開いていなければ開く（閉じてしまわない）
      if (!(await fold.evaluate((e) => e.open)))
        await page.locator('[data-testid$="-details-summary"]').first().click();
      await settle(page, 300);
      await shot(page, `simple-${zoom}-details-390`);
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

/** 「詳しく」の中身（testid）→ 見出しの数の文の形（入。PRD D393） */
const EXPERT_HEADING = {
  'month-details': /^担当 \d+\/\d+日・確定 \d+\/\d+日$/,
  'day-details': /^点数 \d+・移動 \d+分/,
};

/** 6b 入（PRD D402・D393）：操作の行は主ボタン＋1つ＋「その他 ▾」、進み具合・件数・今の担当の1行は「詳しく ▾」（閉じて始まり、見出しに数）、説明は1行で初回だけ */
async function expertSame(page) {
  await page.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem(k));
    d.org.features = { ...d.org.features, expert: true };
    localStorage.setItem(k, JSON.stringify(d));
  }, STORAGE_KEY);
  await page.evaluate((k) => localStorage.removeItem(k), INTRO_KEY);
  for (const [to, zoom, want, detailsId, hidden] of [
    ['/month', 'month', ['予定を入れる', '担当を組む'], 'month-details', 'progress-band'],
    ['/week', 'week', ['予定を入れる', '担当を組む'], 'week-details', 'week-status'],
    ['/plan', 'plan', ['予定を入れる', '確定（伝えた）'], 'day-details', 'plan-summary'],
  ]) {
    await open1(page, to);
    const btns = await toolbarButtons(page);
    check(
      JSON.stringify(btns.map((b) => b.text)) === JSON.stringify(want),
      `入 ${to}：操作の行は ${want.join('＋')} の2つ（その他 ▾ を除く）`,
      btns,
    );
    check(btns[0].primary, `入 ${to}：1つ目（予定を入れる）が主ボタン`, btns);
    check((await page.getByTestId('undo-btn').count()) === 0, `入 ${to}：元に戻すは操作の行に出さない`);
    check(
      (await page.getByTestId('plan-help-btn').count()) === 0,
      `入 ${to}：使い方・表示の切り替えのボタンは行に無い`,
    );
    const list = await (async () => {
      await page.getByTestId(`${zoom}-more`).click();
      const t = await texts(page.getByRole('menuitem'));
      await closeMore(page, zoom);
      return t;
    })();
    check(
      list.some((t) => /^欠勤・キャンセルを登録/.test(t)) && list.some((t) => /^元に戻す/.test(t)),
      `入 ${to}：「その他 ▾」に 欠勤・キャンセルを登録 と 元に戻す`,
      list,
    );
    const fold = page.getByTestId(detailsId);
    check((await fold.count()) === 1, `入 ${to}：「詳しく」がある`);
    check(!(await fold.evaluate((e) => e.open)), `入 ${to}：「詳しく」は初め閉じている`);
    const target = page.getByTestId(hidden);
    check(
      (await target.count()) === 0 || !(await target.first().isVisible()),
      `入 ${to}：閉じている間は ${hidden} が見えない`,
    );
    const heading = (await page.getByTestId(`${detailsId}-heading`).innerText()).trim();
    const form = EXPERT_HEADING[detailsId];
    check(!form || form.test(heading), `入 ${to}：「詳しく」の見出しに数（${heading}）`, heading);
    if (to === '/week') check(/未確定 \d+日/.test(heading), '入 /week：見出しに「未確定 N日」', heading);
    check(
      (await page.getByTestId('page-intro').count()) === 1,
      `入 ${to}：説明は1行で初回だけ出る（閉じるボタンあり）`,
    );
  }
  // 開け閉めは画面ごとに端末に覚える：月を開いて読み直すと開いたまま、週・日は閉じたまま。閉じて読み直すと閉じる
  await open1(page, '/month');
  await page.getByTestId('month-details-summary').click();
  check(await page.getByTestId('month-details').evaluate((e) => e.open), '入 月：「詳しく」を押すと開く');
  check(await page.getByTestId('progress-band').first().isVisible(), '入 月：開くと進み具合の帯が見える');
  await page.reload();
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await settle(page, 600);
  check(
    await page.getByTestId('month-details').evaluate((e) => e.open),
    '入 月：読み直しても開いたまま（端末に覚える）',
  );
  await open1(page, '/week');
  check(
    !(await page.getByTestId('week-details').evaluate((e) => e.open)),
    '入 週：月を開いても週は閉じたまま（画面ごと）',
  );
  await open1(page, '/plan');
  check(
    !(await page.getByTestId('day-details').evaluate((e) => e.open)),
    '入 日：月を開いても日は閉じたまま（画面ごと）',
  );
  await open1(page, '/month');
  await page.getByTestId('month-details-summary').click();
  await page.reload();
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await settle(page, 600);
  check(!(await page.getByTestId('month-details').evaluate((e) => e.open)), '入 月：閉じて読み直すと閉じたまま');
  // 日：開くと今の担当の1行（点数・移動）と要対応の訪問の帯が見える。時間軸の移動の線は残る
  await open1(page, '/plan');
  await page.getByTestId('day-details-summary').click();
  check(await page.getByTestId('plan-summary').isVisible(), '入 日：開くと「今の担当」の1行が見える');
  check((await page.locator('.tl-leg').count()) > 0, '入 日：時間軸に移動の分数の線が残る');
  const careBand = page.getByTestId('band-care');
  check(
    (await careBand.count()) === 0 || (await careBand.evaluate((e) => !!e.closest('[data-testid="day-details"]'))),
    '入 日：「要対応の訪問 N件」の帯は「詳しく」の中',
  );
  await shot(page, 'simple-day-expert-details-1366');
  await open1(page, '/plan');
  await dayAddOpens(page, '予定を入れる');
  await page.evaluate((k) => localStorage.removeItem(k), INTRO_KEY);
  await open1(page, '/plan');
}

/** 一覧の列の見出し（見出しの行の文字。操作の列は空） */
const heads = async (page, table) => (await texts(page.locator(`[data-testid="${table}"] thead th`))).filter((t) => t);

/** くわしい列のチェック（無ければ null） */
const columnsToggle = (page) => page.getByTestId('people-columns-toggle');

/** 覚えた「くわしい列」の値（端末に覚える navOpen の鍵 columns:<一覧>） */
const columnsMemory = (page, list) =>
  page.evaluate(([k, l]) => JSON.parse(localStorage.getItem(k) ?? '{}')[`columns:${l}`] ?? null, [INTRO_KEY, list]);

/** 入の一覧：3列で始め、「くわしい列」の切り替えで専門の列が足され、覚えて読み直しても同じ（一覧ごと。PRD D394） */
async function expertList(page, w, { to, list, table, row, simple, extra, heading, postal }) {
  await openTo(page, to);
  await page.locator(row).first().waitFor({ timeout: 60000 });
  check(
    (await page.locator('h1').innerText()).trim() === heading,
    `入 ${list}（${w}）：見出しはメニューの名前「${heading}」`,
  );
  const toggle = columnsToggle(page);
  check((await toggle.count()) === 1, `入 ${list}（${w}）：表の上に「くわしい列」の切り替えがある`);
  check(!(await toggle.isChecked()), `入 ${list}（${w}）：はじめは入っていない`);
  check(
    JSON.stringify(await heads(page, table)) === JSON.stringify(simple),
    `入 ${list}（${w}）：列は ${simple.join('・')} の3列で始まる`,
    await heads(page, table),
  );
  check(
    (await page.locator(row).first().locator('td').count()) === simple.length + 1,
    `入 ${list}（${w}）：行のセルは3列＋開く`,
  );
  check(
    !/状態」の印/.test(await page.locator('main, .content').first().textContent()),
    `入 ${list}（${w}）：状態の列が無い間は「状態」の印の説明を出さない`,
  );
  check(
    (await texts(page.locator('[data-testid="people-tabs"] [data-tab]'))).every((t) => t !== '予定と相性') &&
      (await page.getByTestId('arrange-steps').count()) === 0,
    `入 ${list}（${w}）：基本情報のタブ・予定を組むの段は出さない`,
  );
  if (postal) {
    // 住所の列に〒郵便番号を添える（データに郵便番号のある人がいるとき）
    const withPostal = await page.evaluate(
      ([k]) => JSON.parse(localStorage.getItem(k)).clients.filter((c) => c.place.postalCode).length,
      [STORAGE_KEY],
    );
    if (withPostal > 0) {
      const addr = await texts(page.locator(`[data-testid="${postal}"]`));
      check(
        addr.some((t) => /〒\d{3}-\d{4}/.test(t)),
        `入 ${list}（${w}）：住所の列に〒郵便番号が出る`,
        addr.slice(0, 3),
      );
    }
  }
  await shot(page, `expert-${list}-list-${page.viewportSize().width}`);
  // 入れると専門の列が足され、覚える
  await toggle.check();
  await until(async () => (await heads(page, table)).length === simple.length + extra.length, 5000, 100);
  check(
    JSON.stringify(await heads(page, table)) === JSON.stringify([...simple, ...extra]),
    `入 ${list}（${w}）：「くわしい列」を入れると ${extra.join('・')} が足される`,
    await heads(page, table),
  );
  check(
    (await page.locator(row).first().locator('td').count()) === simple.length + extra.length + 1,
    `入 ${list}（${w}）：行のセルが増える`,
  );
  check((await columnsMemory(page, list)) === true, `入 ${list}（${w}）：入れたことを端末に覚える（columns:${list}）`);
  await shot(page, `expert-${list}-list-columns-${page.viewportSize().width}`);
  await page.goto('about:blank');
  await page.goto(`${BASE}#${to}`);
  await page.locator(row).first().waitFor({ timeout: 60000 });
  await settle(page, 400);
  check(await columnsToggle(page).isChecked(), `入 ${list}（${w}）：読み直しても入ったまま`);
  check(
    (await heads(page, table)).length === simple.length + extra.length,
    `入 ${list}（${w}）：読み直しても専門の列が出る`,
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, `入 ${list}（${w}）：くわしい列を入れても画面の幅ははみ出さない（表の中で巻く）`);
}

/** 入の一覧を戻す（次の幅・次の確かめに残さない） */
async function expertListOff(page, to, row, list) {
  await openTo(page, to);
  await page.locator(row).first().waitFor({ timeout: 60000 });
  await columnsToggle(page).uncheck();
  await until(async () => (await columnsMemory(page, list)) === false, 5000, 100);
}

/** 6c 入：〈利用者さん〉・〈スタッフ〉の一覧は切と同じタブと3列、「くわしい列」で専門の列（覚える。一覧ごと。PRD D394。4段と基本情報のタブは e2e-nav） */
async function expertPeople(page) {
  const terms = (await data(page)).org.terms;
  const offName = await page.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem(k));
    d.staff[0].active = false;
    localStorage.setItem(k, JSON.stringify(d));
    return d.staff[0].name;
  }, STORAGE_KEY);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    const w = `${width}px`;
    await expertList(page, w, {
      to: '/staff',
      list: 'staff',
      table: 'narrow-staff',
      row: '[data-testid="staff-row"]',
      heading: terms.staff,
      simple: ['名前', '勤務日', '勤務時間'],
      extra: ['特性', `${terms.client}に求めること`, '自宅の位置', '状態'],
    });
    // 一覧ごとに覚える：〈スタッフ〉を入れても〈利用者さん〉は入っていない
    check(
      (await columnsMemory(page, 'staff')) === true && (await columnsMemory(page, 'clients')) !== true,
      `入（${w}）：〈スタッフ〉の覚えは〈利用者さん〉とは別（〈利用者さん〉は覚えが無い）`,
    );
    // 休止中：状態の列が無い間は名前のそばに、くわしい列を入れると状態の列だけに（二重に出さない）
    const row = page.getByTestId('staff-row').filter({ hasText: offName }).first();
    check((await row.getByText('休止中').count()) === 1, `入 staff（${w}）：休止中は1つだけ（状態の列に）`);
    check(
      (await row.locator('td').first().getByText('休止中').count()) === 0,
      `入 staff（${w}）：くわしい列を入れると名前のセルに休止中を重ねない`,
    );
    await expertList(page, w, {
      to: '/clients',
      list: 'clients',
      table: 'narrow-clients',
      row: '[data-testid="client-row"]',
      heading: terms.client,
      simple: ['名前', '住所', 'いつもの予定'],
      postal: 'client-address',
      extra: ['位置', '特性', `${terms.staff}に求めること`, 'いつもの担当', '状態'],
    });
    check(
      /状態」の印/.test(await page.locator('main, .content').first().textContent()),
      `入 clients（${w}）：くわしい列を入れると「状態」の印の説明を出す（狭い画面は畳んだ絞り込みの中）`,
    );
    // タブ：切と同じ（〈スタッフ〉＝一覧・勤務・相性、〈利用者さん〉＝一覧・相性）。移った先にも同じタブ・メニューの印
    for (const [to, names, side] of [
      ['/staff', ['一覧', '勤務', '相性'], terms.staff],
      ['/clients', ['一覧', '相性'], terms.client],
    ]) {
      await openTo(page, to);
      const st = await peopleTabState(page);
      check(
        JSON.stringify(st.names) === JSON.stringify(names),
        `入 ${to}（${w}）：タブは ${names.join('・')}`,
        st.names,
      );
      check(JSON.stringify(st.menu) === JSON.stringify([side]), `入 ${to}（${w}）：メニューは「${side}」に印`, st.menu);
    }
    await page.locator('[data-testid="people-tabs"] [data-tab="compat"]').click();
    await until(async () => /^#\/compat/.test(hash(page)));
    await settle(page, 500);
    const cst = await peopleTabState(page);
    check(
      JSON.stringify(cst.names) === JSON.stringify(['一覧', '相性']) &&
        JSON.stringify(cst.on) === JSON.stringify(['相性']) &&
        JSON.stringify(cst.menu) === JSON.stringify([terms.client]),
      `入 相性（${w}）：来た側（${terms.client}）のタブと印`,
      cst,
    );
    await shot(page, `expert-compat-${page.viewportSize().width}`);
    await expertListOff(page, '/staff', '[data-testid="staff-row"]', 'staff');
    await expertListOff(page, '/clients', '[data-testid="client-row"]', 'clients');
    await openTo(page, '/clients');
    check(
      JSON.stringify(await heads(page, 'narrow-clients')) === JSON.stringify(['名前', '住所', 'いつもの予定']),
      `入 clients（${w}）：切り替えを外すと3列に戻る`,
    );
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

/**
 * 6 エキスパート機能を入にすると、帯に入だけの種類（組み方の標準が無い・未確定 N日）が足され［担当なしを組む］は出ない（PRD D404）。
 * 入のメニュー（6つ・子は組むだけ）・ホームが無いこと・下のタブと引き出しは e2e-nav・e2e-home・e2e-mobile が見る
 */
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
  await page.goto(`${BASE}#/month`);
  await page.locator(NAV_READY).waitFor({ timeout: 60000 });
  await settle(page, 600);
  await page.getByTestId('attention-band').waitFor({ timeout: 60000 });
  const bandText = await page.getByTestId('attention-band-text').innerText();
  check(
    /担当なし \d+件/.test(bandText) && /組み方の標準が無い/.test(bandText) && /未確定 \d+日/.test(bandText),
    'expert 入：要対応の帯に 担当なし・組み方の標準が無い・未確定 N日 が出る',
    bandText,
  );
  check(
    (await page.getByTestId('attention-band-arrange').count()) === 0 &&
      (await page.getByTestId('attention-band-go').count()) === 1,
    'expert 入：帯に［担当なしを組む］は出ない（「担当を組む」の画面で組む）。［見に行く ›］はある',
  );
  if ((await page.getByTestId('month-more').count()) > 0) {
    await page.getByTestId('month-more').click();
    check(
      (await page.getByTestId('more-vacancy').count()) === 0 &&
        (await page.getByTestId('more-auto-arrange').count()) === 0,
      'expert 入：「その他 ▾」に空き状況・担当なしの訪問を組むは無い（空き状況はメニュー）',
    );
    await page.keyboard.press('Escape');
  }
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
  const tabs = await texts(page.locator('[data-testid="people-tabs"] [data-tab]'));
  check(!tabs.includes('予定と相性'), `${label}：基本情報のタブ（予定と相性）は出さない（小さいタブは 5f）`, tabs);
  check(
    (await columnsToggle(page).count()) === 0,
    `${label}：「くわしい列」の切り替えは入だけ（切は出さない。PRD D394）`,
  );
  check(!/状態」の印/.test(body), `${label}：状態の列が無いので「状態」の印の説明を出さない`);
  const intro = await page
    .getByTestId('page-intro')
    .innerText()
    .catch(() => '');
  check(
    intro.includes(heads.join('・')) || intro.includes(heads.slice(0, 3).join('・')),
    `${label}：説明は名前・住所…の1行（初回だけ）`,
    intro,
  );
  const sn = page.getByTestId('screen-name');
  if (await sn.isVisible()) {
    const t = (await sn.innerText()).trim();
    check(!/^人・/.test(t), `${label}：上の帯の画面名に「人・」が付かない`, t);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, `${label}：横にはみ出さない`);
  await shot(page, `simple-people-${to.slice(1)}-list-${page.viewportSize().width}`);
}

/** 5e 切：人の画面は畳む・日の予定の地図はボタンで開く・月のマスの読み方（幅ごとに回す。落ちても幅は restoreWidth が戻す） */
async function people(page) {
  await fresh(page, '/clients', '[data-testid="client-row"]', { start: 'demo' });
  const terms = (await data(page)).org.terms;
  await page.evaluate((k) => localStorage.removeItem(k), INTRO_KEY);
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
  const focused = (name) => page.evaluate((n) => document.activeElement?.getAttribute('aria-label') === n, name);
  check(await focused('地図を閉じる'), `日の予定（${w}）：開いたら閉じるボタンへフォーカス`);
  check(
    (await dock.getByLabel('地図を閉じる').getAttribute('aria-expanded')) === 'true',
    `日の予定（${w}）：閉じるボタンに aria-expanded=true`,
  );
  check((await dock.getByLabel('ページの地図へ移る').count()) === 0, `日の予定（${w}）：ページの地図へ移る矢印は無い`);
  await shot(page, `simple-plan-map-open-${page.viewportSize().width}`);
  // 訪問の帯を選ぶと担当に絞られる：地図の見出しの「全員のルートを見る」で解ける（ページに地図が無いのでここに出す）
  await dock.getByLabel('地図を閉じる').click();
  await fab.waitFor({ timeout: 10000 });
  check(await focused('地図を開く'), `日の予定（${w}）：閉じたら「地図」のボタンへフォーカス`);
  check(
    (await fab.getAttribute('aria-expanded')) === 'false',
    `日の予定（${w}）：「地図」のボタンに aria-expanded=false`,
  );
  const band = page.locator('.tl-band-btn');
  if ((await band.count()) === 0) return;
  await band.first().click();
  await settle(page, 600);
  const clear = page.getByTestId('dock-clear-focus');
  if (await clear.count()) {
    await clear.click();
    await settle(page, 300);
    check((await clear.count()) === 0, `日の予定（${w}）：「全員のルートを見る」で絞りが解ける`);
  } else check(true, `日の予定（${w}）：訪問の選びでは担当に絞らない（全員のルートのまま）`);
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

const SCORE = /点数|\d+\s*点/;

/** 操作の行を確かめる：1つ目が主ボタン「予定を入れる」・2つ目が欠勤・キャンセル・合わせて2つまで・組むは帯の［担当なしを組む］ */
async function addToolbar(page, to, zoom, w) {
  await open1(page, to);
  const btns = await toolbarButtons(page);
  check(btns.length === 2, `${zoom}（${w}）：操作の行のボタンは2つ（その他 ▾ を除く）`, btns);
  check(btns[0]?.primary && btns[0].text === '予定を入れる', `${zoom}（${w}）：1つ目は主ボタン「予定を入れる」`, btns);
  check(
    btns[1]?.text === '欠勤・キャンセルを登録' && !btns[1].primary,
    `${zoom}（${w}）：2つ目は欠勤・キャンセル`,
    btns,
  );
  check(
    (await page.getByTestId('toolbar-arrange').count()) === 0,
    `${zoom}（${w}）：担当なしの訪問を組むは操作の行に無い`,
  );
  check(
    (await page.locator('main .btn-primary, .content .btn-primary').count()) === 1,
    `${zoom}（${w}）：主ボタンは1つ`,
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, `${zoom}（${w}）：横にはみ出さない`);
  await page.getByTestId(`${zoom}-more`).click();
  check(
    (await page.getByTestId('more-auto-arrange').count()) === 0,
    `${zoom}（${w}）：「その他 ▾」に担当なしの訪問を組むは無い（帯の［担当なしを組む］で組む）`,
  );
  await closeMore(page, zoom);
  await shot(page, `simple-add-${zoom}-toolbar-${page.viewportSize().width}`);
}

/** 「予定を入れる」を押して引き出しを開く（開いたら欄の中身を返す） */
async function openAdd(page, kind, label) {
  await page.getByTestId('toolbar-add-plan').click();
  const box = page.getByTestId('add-plan');
  await box.waitFor({ timeout: 10000 });
  check((await box.getAttribute('data-kind')) === kind, `${label}：入れ方は ${kind}`);
  return box;
}

/** 定期：月で押す → 〈利用者さん〉・曜日・くり返し・時刻・所要 → 入れる → 繰り返しが増え、予定に担当付きで出る */
async function addRecurring(page, w) {
  await addToolbar(page, '/month', 'month', w);
  const terms = (await data(page)).org.terms;
  const d0 = await data(page);
  const box = await openAdd(page, 'recurring', `定期（${w}）`);
  const labels = await texts(box.locator('label, legend'));
  check(
    [terms.client, '曜日', 'くり返し', '時刻'].every((t) => labels.some((x) => x.startsWith(t))),
    `定期（${w}）：欄は 〈利用者さん〉・曜日・くり返し・時刻`,
    labels,
  );
  check((await box.getByTestId('add-plan-date').count()) === 0, `定期（${w}）：日付の欄は無い`);
  const body = await page.locator('aside, [role="dialog"]').last().innerText();
  check(!BANNED.test(body), `定期（${w}）：引き出しに禁句が出ない`, body.match(BANNED)?.[0]);
  await settle(page, 700);
  await shot(page, `simple-add-drawer-recurring-${page.viewportSize().width}`);
  // 〈利用者さん〉の2人目・金曜・13:15・隔週
  const client = await box.getByTestId('add-plan-client').locator('option').nth(1).getAttribute('value');
  await box.getByTestId('add-plan-client').selectOption(client);
  const days = box.getByTestId('add-plan-weekdays').locator('button');
  for (let i = 0; i < 7; i++)
    if ((await days.nth(i).getAttribute('aria-pressed')) === 'true') await days.nth(i).click();
  // 誤りの経路：曜日なし → 曜日の欄に誤り・フォーカス、所要0 → 所要の欄に誤り・フォーカス（データは増えない）
  const focusedTestId = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  await box.getByTestId('add-plan-duration').fill('0');
  await page.getByTestId('add-plan-save').click();
  await until(async () => (await focusedTestId()) === 'add-plan-weekdays');
  check(
    (await box.getByTestId('add-plan-weekdays').getAttribute('aria-invalid')) === 'true' &&
      /曜日を1つ以上/.test(await box.locator('[role="alert"]').innerText()),
    `定期（${w}）：曜日なしは曜日の欄に誤り（aria-invalid）`,
  );
  check((await focusedTestId()) === 'add-plan-weekdays', `定期（${w}）：誤った曜日の欄へフォーカス`);
  await days.nth(5).click();
  await page.getByTestId('add-plan-save').click();
  await until(async () => (await focusedTestId()) === 'add-plan-duration');
  const durText = await box.locator('[role="alert"]').innerText();
  check(
    (await box.getByTestId('add-plan-duration').getAttribute('aria-invalid')) === 'true' &&
      durText === '所要は5〜720分で入れてください',
    `定期（${w}）：所要0は所要の欄に誤り（aria-invalid）`,
    durText,
  );
  check((await focusedTestId()) === 'add-plan-duration', `定期（${w}）：誤った所要の欄へフォーカス`);
  check((await data(page)).patterns.length === d0.patterns.length, `定期（${w}）：誤りのときは増えない`);
  await box.getByTestId('add-plan-duration').fill('60');
  await box.getByTestId('add-plan-start').fill('13:15');
  await box.getByTestId('add-plan-repeat').selectOption('2');
  await page.getByTestId('add-plan-save').click();
  await box.waitFor({ state: 'detached', timeout: 10000 });
  // 知らせは、入れたあとの自動の組みの知らせ「N件の担当を組みました」に替わる（訪問の追加と同じ。組みは Worker で解くので遅れて出る）
  const toasts = await until(async () => {
    const t = await texts(page.locator('.toast-layer .toast-text'));
    return t.some((x) => /^予定を入れました|^\d+件の担当を組みました/.test(x)) ? t : null;
  }, 30000);
  check(!!toasts, `定期（${w}）：知らせが出る`, toasts);
  const d1 = await until(async () => {
    const x = await data(page);
    return x.patterns.length === d0.patterns.length + 1 ? x : null;
  }, 15000);
  const p = d1?.patterns.at(-1);
  check(
    !!p &&
      p.clientId === client &&
      JSON.stringify(p.weekdays) === '[5]' &&
      p.earliestStart === '13:15' &&
      p.everyWeeks === 2,
    `定期（${w}）：選んだ〈利用者さん〉・金曜・13:15・隔週の繰り返しが増えた`,
    p,
  );
  check(
    await page.getByTestId('toolbar-add-plan').evaluate((e) => e === document.activeElement),
    `定期（${w}）：閉じたら「予定を入れる」へフォーカスが戻る`,
  );
  // 予定に出る：今日から先の金曜で、その〈利用者さん〉の13:15の訪問に担当が付く（自動の組み。ピンは付けない）
  const d2 = await until(async () => {
    const x = await data(page);
    const hit = x.visits.filter((v) => v.pattern?.id === p.id && v.staffId);
    return hit.length > 0 ? x : null;
  }, 30000);
  const hit = d2?.visits.filter((v) => v.pattern?.id === p.id && v.staffId) ?? [];
  check(
    hit.length > 0 && hit.every((v) => v.pinned === false),
    `定期（${w}）：入れた繰り返しの回に担当が自動で付く`,
    hit.length,
  );
  const cname = d1.clients.find((c) => c.id === client).displayName;
  await open1(page, `/plan?date=${hit[0].date}`);
  const planText = await page.locator('main, .content').first().innerText();
  check(planText.includes(cname) && planText.includes('13:15'), `定期（${w}）：その日の予定に ${cname} 13:15 が出る`);
}

/** 単発：週で押す → 〈利用者さん〉・日付・時刻・所要 → 入れる → 訪問が1件増え、予定に出る */
async function addOneOff(page, w) {
  await fresh(page, '/week', NAV_READY, { start: 'demo', booking: 'oneOff' });
  const d0 = await data(page);
  check(d0.org.features.patterns === false, '前提：単発の答えは繰り返しを使わない');
  await addToolbar(page, '/week', 'week', w);
  const box = await openAdd(page, 'oneOff', `単発（${w}）`);
  const labels = await texts(box.locator('label'));
  check(
    [d0.org.terms.client, '日付', '時刻', '所要'].every((t) => labels.some((x) => x.startsWith(t))),
    `単発（${w}）：欄は 〈利用者さん〉・日付・時刻・所要`,
    labels,
  );
  check((await box.getByTestId('add-plan-weekdays').count()) === 0, `単発（${w}）：曜日の欄は無い`);
  await settle(page, 700);
  await shot(page, `simple-add-drawer-oneoff-${page.viewportSize().width}`);
  const client = await box.getByTestId('add-plan-client').locator('option').nth(1).getAttribute('value');
  await box.getByTestId('add-plan-client').selectOption(client);
  const date = await box.getByTestId('add-plan-date').inputValue();
  await box.getByTestId('add-plan-duration').fill('0');
  await page.getByTestId('add-plan-save').click();
  await until(async () =>
    page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'add-plan-duration'),
  );
  check(
    (await box.locator('[role="alert"]').innerText()) === '所要は5〜720分で入れてください',
    `単発（${w}）：所要の誤りの文は定期と同じ`,
  );
  await box.getByTestId('add-plan-start').fill('14:20');
  await box.getByTestId('add-plan-duration').fill('90');
  await page.getByTestId('add-plan-save').click();
  await box.waitFor({ state: 'detached', timeout: 10000 });
  const d1 = await until(async () => {
    const x = await data(page);
    return x.visits.length === d0.visits.length + 1 ? x : null;
  }, 15000);
  const v = d1?.visits.at(-1);
  check(
    !!v && v.clientId === client && v.date === date && v.earliestStart === '14:20' && v.durationMinutes === 90,
    `単発（${w}）：選んだ〈利用者さん〉・日付・14:20・90分の訪問が1件増えた`,
    v,
  );
  const d2 = await until(async () => {
    const x = await data(page);
    return x.visits.find((y) => y.id === v?.id)?.staffId ? x : null;
  }, 30000);
  check(!!d2, `単発（${w}）：担当が自動で付く`);
  const cname = d1.clients.find((c) => c.id === client).displayName;
  await open1(page, `/plan?date=${date}`);
  const planText = await page.locator('main, .content').first().innerText();
  check(planText.includes(cname) && planText.includes('14:20'), `単発（${w}）：その日の予定に ${cname} 14:20 が出る`);
  // 入れる前に閉じる：やめる
  await open1(page, '/week');
  await openAdd(page, 'oneOff', `単発（${w}）`);
  await page.getByTestId('add-plan-close').click();
  check((await page.getByTestId('add-plan').count()) === 0, `単発（${w}）：「やめる」で閉じる`);
  check((await data(page)).visits.length === d1.visits.length, `単発（${w}）：やめたらデータは変わらない`);
}

/** 予定以外の画面を開く（見出しが出るまで待つ） */
async function openTo(page, to) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#${to}`);
  await page.locator('.app-main h1, main h1').first().waitFor({ timeout: 60000 });
  await settle(page, 600);
}

/** 今の画面の小さいタブ（名前・印）とメニューの印 */
async function peopleTabState(page) {
  const tabs = await page
    .locator('[data-testid="people-tabs"] [data-tab]')
    .evaluateAll((els) =>
      els.map((e) => ({ text: e.textContent.trim(), on: e.getAttribute('aria-current') === 'page' })),
    );
  const menu = await texts(page.locator('.side-nav [aria-current="page"]'));
  return { names: tabs.map((t) => t.text), on: tabs.filter((t) => t.on).map((t) => t.text), menu };
}

/** タブを押して移る（移った先で印・同じタブ・メニューの印・禁句と点数が出ないことを確かめる） */
async function tabGo(page, label, to, expect) {
  await page
    .locator('[data-testid="people-tabs"] [data-tab]')
    .filter({ hasText: new RegExp(`^${expect.tab}$`) })
    .click();
  await until(async () => new RegExp(`^#${to}`).test(hash(page)));
  await settle(page, 500);
  const st = await peopleTabState(page);
  check(new RegExp(`^#${to}`).test(hash(page)), `${label}：「${expect.tab}」のタブで ${to} へ移る`, hash(page));
  check(JSON.stringify(st.names) === JSON.stringify(expect.names), `${label}：移った先にも同じタブ`, st.names);
  check(JSON.stringify(st.on) === JSON.stringify([expect.tab]), `${label}：移った先で「${expect.tab}」に印`, st.on);
  check(
    JSON.stringify(st.menu) === JSON.stringify([expect.menu]),
    `${label}：メニューは「${expect.menu}」に印`,
    st.menu,
  );
  const body = await page.locator('main, .content').first().innerText();
  check(!BANNED.test(body), `${label}：${to} に禁句が出ない`, body.match(BANNED)?.[0]);
  check(!SCORE.test(body), `${label}：${to} に点数が出ない`, body.match(SCORE)?.[0]);
  // 畳んだ説明の中（textContent）にも、点・条件の重み（切では出さない画面）の話が無い
  const hidden = await page.locator('main, .content').first().textContent();
  check(
    !/点のしくみ|条件の重み/.test(hidden) && !BANNED.test(hidden),
    `${label}：${to} の畳んだ説明にも点・重み・禁句が無い`,
    hidden.match(/点のしくみ|条件の重み|標準|提案|反映|ピン|プリセット/)?.[0],
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, `${label}：${to} は横にはみ出さない`);
  await shot(page, `simple-tabs-${expect.side}-${to.slice(1)}-${page.viewportSize().width}`);
}

/** 〈スタッフ〉・〈利用者さん〉の一覧の上の小さいタブ：一覧・勤務・相性で行き来でき、メニューの印は〈スタッフ〉／〈利用者さん〉 */
async function peopleTabs(page, w) {
  const terms = (await data(page)).org.terms;
  const staffTabs = ['一覧', '勤務', '相性'];
  await openTo(page, '/staff');
  const first = await peopleTabState(page);
  check(
    JSON.stringify(first.names) === JSON.stringify(staffTabs),
    `${terms.staff}一覧（${w}）：タブは 一覧・勤務・相性`,
    first.names,
  );
  check(JSON.stringify(first.on) === JSON.stringify(['一覧']), `${terms.staff}一覧（${w}）：「一覧」に印`, first.on);
  const aria = await page.locator('[data-testid="people-tabs"]').getAttribute('aria-label');
  check(aria === `${terms.staff}の画面の切り替え`, `${terms.staff}一覧（${w}）：タブの名前は呼び名から`, aria);
  const under = await page.evaluate(() => {
    const h = document.querySelector('.app-main h1, main h1');
    const t = document.querySelector('[data-testid="people-tabs"]');
    return !!h && !!t && !!(h.compareDocumentPosition(t) & 4);
  });
  check(under, `${terms.staff}一覧（${w}）：タブは見出しの下`);
  await shot(page, `simple-tabs-staff-list-${page.viewportSize().width}`);
  const s = { names: staffTabs, menu: terms.staff, side: 'staff' };
  await tabGo(page, `${terms.staff}の`, '/availability', { ...s, tab: '勤務' });
  await tabGo(page, `${terms.staff}の`, '/compat', { ...s, tab: '相性' });
  await tabGo(page, `${terms.staff}の`, '/staff', { ...s, tab: '一覧' });
  // 勤務の見込み（#/workload。「基本」では機能が切）の印は、タブの match（lib/peopleTabs）と menu の match が同じ画面に当てる（単体テスト）
  // 〈利用者さん〉：一覧・相性。相性の画面ではこちらから来た側のタブ・印
  const c = { names: ['一覧', '相性'], menu: terms.client, side: 'clients' };
  await openTo(page, '/clients');
  const cs = await peopleTabState(page);
  check(
    JSON.stringify(cs.names) === JSON.stringify(c.names),
    `${terms.client}一覧（${w}）：タブは 一覧・相性`,
    cs.names,
  );
  await shot(page, `simple-tabs-clients-list-${page.viewportSize().width}`);
  await tabGo(page, `${terms.client}の`, '/compat', { ...c, tab: '相性' });
  await tabGo(page, `${terms.client}の`, '/clients', { ...c, tab: '一覧' });
  // 予定と相性（#/basics）など旧画面のタブは出さない
  await openTo(page, '/basics');
  check((await page.getByTestId('people-tabs').count()) === 0, `予定と相性（${w}）：旧画面のタブは出さない`);
}

/** 5f 切：「予定を入れる」（定期・単発）と〈スタッフ〉・〈利用者さん〉のタブ（幅ごとに回す。落ちても幅は restoreWidth が戻す） */
async function addAndTabs(page) {
  await fresh(page, '/month', NAV_READY, { start: 'demo' });
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    const w = `${width}px`;
    if (width === 1366) await addRecurring(page, w);
    else {
      await fresh(page, '/month', NAV_READY, { start: 'demo' });
      await addRecurring(page, w);
    }
    await addOneOff(page, w);
    await fresh(page, '/staff', '[data-testid="staff-row"]', { start: 'demo' });
    await peopleTabs(page, w);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
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
    ['2 切：メニューは5つ（空き状況を含む）・パレットにホームが無い', menu],
    ['3 切：予定の上の要対応の帯（見に行く・担当なしを組む）', band],
    ['3b 切：訪問が無ければ帯を出さない', noBand],
    ['4 切：空き状況はメニューの項目（「その他 ▾」には無い）', more],
    ['5 切：スマホの下のタブ・引き出し・帯', restoreWidth(mobile)],
    ['5b 切：例外だけ見せる（操作の行・詳しく・札・言葉）', exceptions],
    ['5c 切：画面の上の説明は1行・閉じたら出ない', intro],
    ['5d 切：スマホの操作の行・詳しく', restoreWidth(mobileExceptions)],
    ['5e 切：人の画面は畳む・地図はボタンで開く・マスの読み方', restoreWidth(people)],
    ['5f 切：「予定を入れる」（定期・単発）・〈スタッフ〉〈利用者さん〉のタブ', restoreWidth(addAndTabs)],
    ['6 入：メニュー6つ・ホームなし・帯の入の種類', expertOn],
    ['6b 入：操作の行（2つ＋その他）・「詳しく」の見出しの数と開け閉めの覚え・説明1行', expertSame],
    ['6c 入：人の一覧は3列＋「くわしい列」（覚える）・人のタブ・4段は組む画面だけ', restoreWidth(expertPeople)],
  ],
  call: (fn, s) => fn(s.page),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
