// 機能の入り切り その2（PRD D211・D213〜D215）：ひな形の5通りごとに画面の中の入口（日の画面の欠勤・キャンセル・メール・点数の理由、
// 担当を組むの「AI で組む」・考え方（条件の重みへのリンク）・「案を比べる」・組むの子、〈利用者さん〉の欄の段階の選択・紹介元・担当できる人・休み・決まりごと・住所の検索・絞り込みのチップ、
// 〈利用者さん〉の画面の紹介元・決まりごと・休みのタブ、〈スタッフ〉の画面のメールアドレス・最終勤務日、月の「休みを追加」・印刷、空き状況の案内文、
// データの Excel、稼働の見込みの交通費の単価）。相性を切るときの独自の確認（件数と効き方。取り消すと変わらない）と、
// 相性×の組は AI で組むと担当にならず、切ると担当に入ること（別のタブで×を書き、担当を組むの日の範囲（#/arrange?date=）で AI で組んで反映する）。
// 切ったまま保存してもデータが残る（段階「契約」・担当できる人・〈スタッフ〉のメールアドレス・毎月のパターンの repeat と monthWeeks）。
// その1（メニュー・管理者設定・ひな形・切った機能の URL・行き止まり）は e2e-features.cjs。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-features2.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const path = require('node:path');
const { answerConfirms } = require('./lib/confirmDialog.cjs');
const { BASE, OUT_DIR, TODAY, STORAGE_KEY, check, runSteps, settle } = require('./lib/env.cjs');
const { planDays } = require('./lib/plan.cjs');
const { sharedPage, openPage } = require('./lib/steps.cjs');
const { toolCount } = require('./lib/ui.cjs');
const {
  same,
  TEMPLATE_ON,
  TEMPLATE_LABEL,
  asFeatures,
  arrangeKidsFor,
  open,
  storedFeatures,
  applyTemplate,
  writeFeaturesInOtherTab,
} = require('./lib/features.cjs');

/** 人の画面の「詳しく ▾」を開く（エキスパート機能が切のとき、段階・担当などは中。PRD D385。無ければ何もしない） */
async function openFold(page) {
  const fold = page.getByTestId('person-details');
  if ((await fold.count()) === 0 || (await fold.evaluate((e) => e.open))) return;
  await page.getByTestId('person-details-summary').click();
}

/** 担当・相性（入はタブ。切はタブが無く人の画面の基本情報の「詳しく」の中）の画面を開く。base は `/clients/ID` か `/staff/ID`、tab は staffing か compat */
async function openPart(page, base, tab) {
  await open(page, `${base}?tab=${tab}`, '[data-testid="person-view"]');
  if ((await page.getByTestId('person-tabs').locator(`[data-tab="${tab}"]`).count()) > 0) {
    await page.locator('[data-testid="person-sec"]').first().waitFor({ timeout: 30000 });
    return;
  }
  await open(page, `${base}?tab=basic`, '[data-testid="person-sec"]');
  await openFold(page);
}

/** 画面の中の入口を確かめるひな形の順（1つの段に入れると遅い CI で段の上限を超えるので、ひな形ごとに段を分ける） */
const INSIDE_TEMPLATES = ['oneOff', 'basic', 'laborContract', 'monthlyField', 'all'];

async function insideEntries(t, page, dlg, ctx) {
  const on = (id) => TEMPLATE_ON[t].includes(id);
  const label = TEMPLATE_LABEL[t];
  await open(page, '/data');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await open(page, '/data');
  await writeFeaturesInOtherTab(ctx, asFeatures(TEMPLATE_ON[t]));
  const data = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
  check(same(data.org.features, asFeatures(TEMPLATE_ON[t])), `${label}：入り切りを書いた`);
  const count = (id) => page.getByTestId(id).count();

  // 日の画面（今日）
  await open(page, `/plan?date=${TODAY}`, '.date-switch select');
  await page.getByTestId('plan-summary').waitFor({ state: 'attached', timeout: 60000 });
  await settle(page, 500);
  check(
    (await toolCount(page, 'sudden-open')) === (on('sudden') ? 1 : 0),
    `${label}：日の予定の「欠勤・キャンセルを登録」`,
  );
  check(
    (await page.locator('.absence-btn').count()) > 0 === on('sudden'),
    `${label}：列の見出しの「この人の欠勤を登録」`,
  );
  // メールで送るは操作の行の「その他 ▾」の中（PRD D306・D402・D419）。メールは入り切りせずいつも出す（ADR-0106）
  check((await toolCount(page, 'day-mail')) === 1, `${label}：日の予定の「その他 ▾」の「メールで送る」（いつも出す）`);
  if (!on('rules')) check((await count('plan-reason')) === 0, `${label}：点数の横の理由を出さない`);
  check((await count('plan-menu')) === 0, `${label}：日の予定に「AI で組む ▾」は無い`);
  // 担当を組む（週の範囲）：AI で組む・考え方（点数の基準。選ぶ欄は無い）・案を比べる（ADR-0063・ADR-0065）
  await open(page, `/arrange?d=${TODAY}`, '[data-testid="arrange-start"]');
  check((await count('arrange-start')) === 1, `${label}：担当を組むの「AI で組む」`);
  check(
    (await count('arrange-basis')) === 1 && (await count('arrange-preset')) === 0,
    `${label}：担当を組むは「考え方：〈点数の基準〉」だけ（選ぶ欄は無い）`,
  );
  check((await count('arrange-compare-open')) === (on('compare') ? 1 : 0), `${label}：担当を組むの「案を比べる」`);
  // 考え方の横の「替えるのは条件の重み」のリンクはエキスパート機能が入のときだけ（ADR-0100）
  const basisLink = page.getByTestId('arrange-basis').locator('a[href="#/rules"]');
  check(
    (await basisLink.count()) === (on('expert') ? 1 : 0),
    `${label}：担当を組むの「（替えるのは条件の重み）」のリンク（エキスパート機能が入のときだけ）`,
    await page.getByTestId('arrange-basis').innerText(),
  );
  // 組むの子は条件の重み・担当を組む（エキスパート機能が入のときだけ。ADR-0100）
  const kids = await page
    .locator('.side-nav [data-parent="arrange"] > .nav-sub > .nav-link.nav-child')
    .evaluateAll((els) => els.map((e) => e.dataset.key));
  check(same(kids, arrangeKidsFor(t)), `${label}：組むの子は条件の重み・担当を組む（切なら組むは無い）`, kids);

  // 〈利用者さん〉：その人の画面の節（PRD D308）
  const client = data.clients.find((c) => c.referrer.name) ?? data.clients[0];
  const cid = encodeURIComponent(client.id);
  const csec = (name) => page.locator(`[data-testid="person-sec"][data-section="${name}"]`);
  await open(page, `/clients/${cid}`, '[data-testid="person-view"]');
  check((await count('schedule-leaves')) === 1, `${label}：予定のタブの休み（事実なので残す）`);
  // 繰り返しの欄は機能 patterns を切ると隠す（単発のみ。今ある繰り返しの回は予定に残る。ADR-0072）
  check((await count('patterns-section')) === (on('patterns') ? 1 : 0), `${label}：予定のタブの繰り返しの欄`);
  check(
    (await page.getByTestId('person-tabs').locator('[data-tab="leaves"]').count()) === (on('clientLeave') ? 1 : 0),
    `${label}：休みのタブ`,
  );
  await open(page, `/clients/${cid}?tab=basic`, '[data-testid="person-sec"]');
  await openFold(page);
  const viewText = await page.getByTestId('person-view').innerText();
  check(viewText.includes('紹介元') === on('clientStage'), `${label}：基本情報の紹介元`);
  check(viewText.includes('訪問先の決まりごと') === on('visitNotes'), `${label}：基本情報の決まりごと`);
  await csec('stage').getByTestId('sec-edit').click();
  await page.getByTestId('client-stage-select').waitFor({ timeout: 5000 });
  const stages = await page.getByTestId('client-stage-select').locator('option').allInnerTexts();
  check(
    same(stages, on('clientStage') ? ['相談受付', '顔合わせ', '契約', '利用中', '終了'] : ['利用中', '終了']),
    `${label}：段階の選択`,
    stages,
  );
  check((await count('client-referrer-name')) === (on('clientStage') ? 1 : 0), `${label}：紹介元の欄`);
  await csec('stage').getByTestId('sec-cancel').click();
  if (on('visitNotes')) {
    await csec('rules').getByTestId('sec-edit').click();
    check((await count('visit-rules-form')) === 1, `${label}：決まりごとの欄`);
    await csec('rules').getByTestId('sec-cancel').click();
  } else check((await csec('rules').count()) === 0, `${label}：決まりごとの節が無い`);
  await csec('place').getByTestId('sec-edit').click();
  await page.getByTestId('client-postal').waitFor({ timeout: 5000 });
  check((await count('client-postal-search')) === (on('geocode') ? 1 : 0), `${label}：住所を探す`);
  check((await count('client-postal')) === 1, `${label}：郵便番号の欄は残る`);
  await csec('place').getByTestId('sec-cancel').click();
  await openPart(page, `/clients/${cid}`, 'staffing');
  check(
    (await page.getByTestId('person-view').innerText()).includes('担当できる人') === on('allowedStaff'),
    `${label}：担当の節の担当できる人`,
  );
  await csec('staffing').getByTestId('sec-edit').click();
  check(
    (await csec('staffing').getByText('担当できる人を限る').count()) === (on('allowedStaff') ? 1 : 0),
    `${label}：担当できる人の欄`,
  );
  await csec('staffing').getByTestId('sec-cancel').click();
  if (on('clientLeave')) {
    await open(page, `/clients/${cid}?tab=leaves`, '[data-testid="person-view"]');
    check((await count('leaves-section')) === 1, `${label}：休みの欄`);
  }
  await open(page, '/clients', '[data-testid="client-row"]');
  const chips = await page
    .getByTestId('clients-cf-chip')
    .evaluateAll((els) => els.map((el) => el.dataset.chip).filter(Boolean));
  check(chips.includes('leave') === on('clientLeave'), `${label}：絞り込みのチップ「休み」`, chips);
  check(chips.includes('limited') === on('allowedStaff'), `${label}：絞り込みのチップ「担当を限る」`, chips);

  // 〈スタッフ〉：その人の画面の節
  const staff = data.staff[0];
  const sid = encodeURIComponent(staff.id);
  await open(page, `/staff/${sid}?tab=basic`, '[data-testid="person-sec"]');
  await openFold(page);
  const staffView = await page.getByTestId('person-view').innerText();
  check(staffView.includes('メールアドレス'), `${label}：〈スタッフ〉の基本情報のメールアドレス（いつも出す）`);
  check((await csec('lastDay').count()) === (on('offboard') ? 1 : 0), `${label}：最終勤務日の節`);
  await csec('basic').getByTestId('sec-edit').click();
  check((await count('staff-email')) === 1, `${label}：〈スタッフ〉のメールアドレスの欄（いつも出す）`);
  await csec('basic').getByTestId('sec-cancel').click();
  await openPart(page, `/staff/${sid}`, 'compat');
  check(
    (await page.getByTestId('person-view').innerText()).includes('◎ 選ばれやすい') === on('compat'),
    `${label}：〈スタッフ〉の相性`,
  );

  // 月：〈スタッフ〉を選ぶと「休みを追加」
  await open(
    page,
    `/month?ym=${TODAY.slice(0, 7)}&staff=${encodeURIComponent(staff.id)}`,
    '[data-testid="month-focus"]',
  );
  await settle(page, 300);
  check((await count('month-off-toggle')) === (on('requestedOff') ? 1 : 0), `${label}：月の「休みを追加」`);
  // 印刷は「その他 ▾」の中（PRD D327）
  await page.getByTestId('month-more').click();
  await page.getByTestId('month-more-list').waitFor({ timeout: 5000 });
  check((await count('month-print')) === (on('monthPrint') ? 1 : 0), `${label}：月の「その他 ▾」の印刷`);
  await page.keyboard.press('Escape');

  // 空き状況の案内文
  if (on('vacancy')) {
    await open(page, '/vacancy', '[data-testid="vacancy-step-next"]');
    check((await count('notice-card')) === (on('vacancyNotice') ? 1 : 0), `${label}：空き状況の案内文の欄`);
  }
  // データの Excel
  await open(page, '/data');
  check((await count('excel-card')) === 1, `${label}：データの Excel の欄（いつも出す）`);
  // 稼働の見込みの交通費の単価
  if (on('workload')) {
    await open(page, '/workload');
    check((await count('work-fare')) === (on('fare') ? 1 : 0), `${label}：交通費の単価の欄`);
  }
  if (t === 'basic') {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, `/plan?date=${TODAY}`, '.date-switch select');
    await page.getByTestId('plan-summary').waitFor({ state: 'attached', timeout: 60000 });
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    check(w <= 390, '390px・基本：日の予定が横にはみ出さない', w);
    await page.screenshot({ path: path.join(OUT_DIR, 'inside-basic-mobile.png') });
    await page.setViewportSize({ width: 1400, height: 1000 });
  }
  if (t === INSIDE_TEMPLATES.at(-1)) await applyTemplate(page, dlg, 'all');
}

/**
 * 切ったまま保存してもデータが残る（ADR-0028。データは消さない）：段階が「契約」の〈利用者さん〉の段階・担当できる人、
 * 〈スタッフ〉のメールアドレス、毎月のパターンの繰り返し方（repeat）と第何週（monthWeeks）
 */
async function keepData(page, dlg, ctx) {
  await open(page, '/data');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await open(page, '/data');
  const other = await ctx.newPage();
  await other.goto(`${BASE}#/data`);
  await other.locator('h1').first().waitFor({ timeout: 30000 });
  const ids = await other.evaluate((k) => {
    const data = JSON.parse(localStorage.getItem(k));
    const withPattern = data.clients.find((c) => data.patterns.some((p) => p.clientId === c.id)) ?? data.clients[0];
    const s0 = data.staff.find((s) => s.active);
    const c = withPattern;
    c.stage = 'contract';
    c.active = false;
    c.tentative = false;
    c.allowedStaffIds = [s0.id];
    s0.email = 'keep@example.com';
    const p = data.patterns.find((x) => x.clientId === c.id);
    if (p) {
      p.repeat = 'monthly';
      p.everyWeeks = 1;
      p.monthWeeks = [1, 3];
      p.dayTimes = [];
    }
    // mail は前の版で切れた機能（ADR-0106 でなくした）。古いデータに残っていても読んで捨て、メールの欄を出す
    data.org.features = { clientStage: false, allowedStaff: false, mail: false, patternMonthly: false };
    localStorage.setItem(k, JSON.stringify(data));
    return {
      client: c.id,
      staff: s0.id,
      pattern: p?.id ?? null,
      others: data.patterns.filter((x) => x.clientId === c.id && x.id !== p?.id).map((x) => x.id),
    };
  }, STORAGE_KEY);
  await other.close();
  await settle(page, 300);
  const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);

  // 〈利用者さん〉：段階・担当できる人の欄が無いまま保存する（節ごとに保存）
  const sec = (name) => page.locator(`[data-testid="person-sec"][data-section="${name}"]`);
  await open(page, `/clients/${encodeURIComponent(ids.client)}?tab=basic`, '[data-testid="person-sec"]');
  await openFold(page);
  await sec('stage').getByTestId('sec-edit').click();
  await page.getByTestId('client-stage-select').waitFor({ timeout: 5000 });
  check(
    (await page.getByTestId('client-stage-select').inputValue()) === 'contract',
    '段階・紹介元を切っても、契約の人の選択は今の段階のまま',
  );
  await sec('stage').getByTestId('sec-save').click();
  await sec('stage').getByTestId('sec-edit').waitFor({ timeout: 5000 });
  await openPart(page, `/clients/${encodeURIComponent(ids.client)}`, 'staffing');
  await sec('staffing').getByTestId('sec-edit').click();
  await sec('staffing').getByTestId('sec-save').click();
  await sec('staffing').getByTestId('sec-edit').waitFor({ timeout: 5000 });
  await settle(page, 300);
  let data = await stored();
  const c = data.clients.find((x) => x.id === ids.client);
  check(c.stage === 'contract', '切ったまま保存しても段階（契約）が残る', c.stage);
  check(same(c.allowedStaffIds, [ids.staff]), '切ったまま保存しても担当できる人が残る', c.allowedStaffIds);

  // 毎月のパターン：曜日ごと・第N週を切ったまま直す（予定のタブの繰り返し）
  if (ids.pattern) {
    await open(page, `/clients/${encodeURIComponent(ids.client)}`, '[data-testid="patterns-section"]');
    await page
      .locator(`[data-testid="pattern-row"][data-pattern="${ids.pattern}"]`)
      .getByTestId('pattern-edit')
      .click();
    await page.getByTestId('pattern-form').waitFor({ timeout: 5000 });
    check(
      (await page.getByTestId('pattern-monthly-off').count()) === 1,
      '切った毎月のパターン：管理者設定で切っていますの注記',
    );
    check(
      (await page.getByTestId('pattern-repeat').isDisabled()) &&
        (await page.getByTestId('pattern-month-weeks').locator('button').first().isDisabled()),
      '切った毎月のパターン：繰り返し方と第何週は読むだけ',
    );
    await page.getByTestId('pattern-save').click();
    await settle(page, 600);
    data = await stored();
    const mine = data.patterns.filter((p) => p.clientId === ids.client && !ids.others.includes(p.id));
    check(
      mine.length > 0 && mine.every((p) => p.repeat === 'monthly' && same(p.monthWeeks, [1, 3])),
      '切ったまま直しても毎月のパターンの repeat・monthWeeks が残る',
      mine.map((p) => [p.repeat, p.monthWeeks]),
    );
  }

  // 〈スタッフ〉：古いデータの mail: false が残っていても、メールアドレスの欄を出す（ADR-0106）
  await open(page, `/staff/${encodeURIComponent(ids.staff)}?tab=basic`, '[data-testid="person-sec"]');
  await sec('basic').getByTestId('sec-edit').click();
  await sec('basic').locator('input').first().waitFor({ timeout: 5000 });
  check(
    (await page.getByTestId('staff-email').count()) === 1,
    '古いデータに mail: false があってもメールアドレスの欄を出す',
  );
  await sec('basic').getByTestId('sec-save').click();
  await sec('basic').getByTestId('sec-edit').waitFor({ timeout: 5000 });
  await settle(page, 300);
  data = await stored();
  const s = data.staff.find((x) => x.id === ids.staff);
  check(s.email === 'keep@example.com', '保存しても〈スタッフ〉のメールアドレスが残る', s.email);
  await applyTemplate(page, dlg, 'all');
}

/**
 * 担当を組む（#/arrange?date=。日の範囲）で「AI で組む」の提案を出して反映する（提案は反映するまで担当を変えない。
 * ADR-0053・ADR-0063）。担当の入った訪問も組み直すので、組む日は「伝えていない日をすべて組み直す」
 */
async function proposeAndApply(page, date) {
  await open(page, `/arrange?date=${date}`, '[data-testid="arrange-start"]');
  if ((await page.getByTestId('arrange-mode-all').count()) > 0) await page.getByTestId('arrange-mode-all').check();
  await page.getByTestId('arrange-start').click();
  const band = page.locator('[data-testid="proposal-band"]');
  const apply = band.getByTestId('proposal-apply');
  await apply.waitFor({ timeout: 150000 });
  await apply.click();
  await band.waitFor({ state: 'detached', timeout: 10000 });
  await settle(page, 600);
}

/** 相性を切るときの確認（D215）・相性×の組は AI で組むと担当にならず、切ると担当に入る */
async function turnOffCompat(page, dlg, ctx) {
  await open(page, '/plan', '.date-switch select');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await page.locator('.date-switch select').waitFor({ timeout: 30000 });
  // 初期データは今日からの日を繰り返しの担当のままにするので、保存した担当の入った訪問を用意する（2回目からは写し）
  await planDays(page, { cache: true });
  await open(page, '/plan', '.date-switch select');
  const options = await page.locator('.date-switch select option').evaluateAll((os) => os.map((o) => o.value));
  const second = options.find((d) => d > TODAY) ?? '';
  // 別のタブで、その日の担当のある訪問1件の〈利用者さん〉を全員と相性×にする（相性が入なら、組むとその訪問は担当にならない）
  const other = await ctx.newPage();
  await other.goto(`${BASE}#/data`);
  await other.locator('h1').first().waitFor({ timeout: 30000 });
  const pair = await other.evaluate(
    ({ k, d }) => {
      const data = JSON.parse(localStorage.getItem(k));
      const v = data.visits.find((x) => x.date === d && !x.cancelled && x.staffId);
      v.pinned = false;
      data.compat[v.clientId] = Object.fromEntries(data.staff.map((s) => [s.id, -2]));
      localStorage.setItem(k, JSON.stringify(data));
      return { sid: v.staffId, vid: v.id, cid: v.clientId };
    },
    { k: STORAGE_KEY, d: second },
  );
  await other.close();
  const assignedOf = (vid) =>
    page.evaluate(
      ({ k, v }) => JSON.parse(localStorage.getItem(k) ?? '{}').visits.find((x) => x.id === v)?.staffId ?? null,
      { k: STORAGE_KEY, v: vid },
    );
  await proposeAndApply(page, second);
  check(
    (await assignedOf(pair.vid)) === null,
    '相性が入：全員と×の訪問は AI で組むと担当に入らない',
    await assignedOf(pair.vid),
  );

  // 管理者設定で相性を切る：独自の確認（件数と効き方）。取り消すと変わらない
  await open(page, '/settings', '[data-testid="feature-templates"]');
  dlg.messages.length = 0;
  dlg.answer = false;
  await page.getByRole('switch', { name: '相性', exact: true }).click();
  await settle(page, 400);
  dlg.answer = true;
  check(
    dlg.messages.length === 1 &&
      dlg.messages[0].includes('相性を切りますか？') &&
      /相性 \d+組は計算から外れます/.test(dlg.messages[0]),
    '相性を切る前に独自の確認（件数と効き方）',
    dlg.messages,
  );
  check((await storedFeatures(page)).compat === undefined, '確認を取り消すと切らない');
  dlg.messages.length = 0;
  await page.getByRole('switch', { name: '相性', exact: true }).click();
  await page.locator('.toast').filter({ hasText: '相性を切りました' }).waitFor({ timeout: 5000 });
  await settle(page, 500);
  check((await storedFeatures(page)).compat === false, '確認すると切る（org.features.compat＝false）');
  // データの無い機能は確認なしで切れる
  dlg.messages.length = 0;
  await page.getByRole('switch', { name: '月の予定の印刷', exact: true }).click();
  await page.locator('.toast').filter({ hasText: '月の予定の印刷を切りました' }).waitFor({ timeout: 5000 });
  check(dlg.messages.length === 0, 'データの無い機能は確認なしで切る', dlg.messages);

  // 相性を切ったので、もう一度 AI で組むと×の組にも担当が入る
  await proposeAndApply(page, second);
  const after = await assignedOf(pair.vid);
  check(typeof after === 'string', '相性を切ると、AI で組んだとき全員と×の訪問にも担当が入る', after);
  await applyTemplate(page, dlg, 'all');
}

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
    ...INSIDE_TEMPLATES.map((t) => [`inside-entries-${t}`, (page, dlg, ctx) => insideEntries(t, page, dlg, ctx)]),
    ['turn-off-compat', turnOffCompat],
    ['keep-data', keepData],
  ],
  after: ({ dlg }) => check(dlg.native.length === 0, 'ブラウザのダイアログを出さない', dlg.native),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
