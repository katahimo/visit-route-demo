// 決まった予定（PRD D382。ADR-0073 段3）を本物のブラウザで確かめる。初めて開いたときの入り切り「基本」（エキスパート機能は切）で、
// 1 切の日の画面：確定のボタン・「確定済み」「まだ伝えていない」の印が無い（初期データは伝えた記録なし）、
// 2 手で担当を直す（今日）と、その日が自動で決まった（伝えた）扱いになる（snapshots[今日]・at・今の担当）。印は出ない、
// 3 もう一度直すと訪問に「変更あり」の印と日の上の「変更あり N件」のチップ（伝えた記録は書き換えない）、
// 4 印を押すと連絡の一覧が開き（札は選ばない）、「連絡した」ボタンがある（メールを切っても出る）、
// 5 「連絡した」で今の担当・時刻が伝えた記録になり「変更あり」が消える（操作の行の［元に戻す］で戻る）、
// 6 週の予定の印を押すとその日の日の予定へ移り連絡の一覧が開く（URL の ?do=told・?date= は消える）、
// 7 月の予定：確定の段階（進み具合の帯の「確定」・右の欄の「確定していない日」・まとめて確定）が無く、ホームも無い（#/home は予定へ）、
// 8 エキスパート機能を入にすると今の確定（伝えた）の操作が出て、自動では伝えない（直しても snapshots は増えない）、
// 9 決まった日に訪問を足すと自動の組みが担当を付け、足した訪問は「変更あり」（伝えた記録は書き換えない）。月のマスの印からも日の予定の連絡の一覧へ移る。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-settled.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const { BASE, NOW, TODAY, STORAGE_KEY, check, launch, runSteps, settle, until, watchErrors } = require('./lib/env.cjs');
const { sharedPage } = require('./lib/steps.cjs');
const { skipTour } = require('./lib/tourSeen.cjs');
const { answerIfAsked } = require('./lib/firstRun.cjs');
const { answerConfirms } = require('./lib/confirmDialog.cjs');
const { pressTool } = require('./lib/ui.cjs');

const data = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
const dataWhen = async (page, ok) =>
  (await until(async () => {
    const d = await data(page);
    return ok(d) ? d : null;
  }, 15000)) ?? (await data(page));
const reBtn = (page) => page.getByTestId('plan-reassign');
const reList = (page) => page.getByTestId('plan-reassign-list');
const sheet = (page) => page.getByTestId('contact-sheet');

/** 初期データに戻して開く（初めて開いたときの入り切りは「基本」＝エキスパート機能は切） */
async function fresh(page, hash, ready) {
  await page.goto(`${BASE}#/home`);
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
  await page.goto(`${BASE}#${hash}`);
  await page.reload();
  // 保存データを消すと最初の2問が出る（デモ×定期＝「基本」）。答えたら行き先を開き直す
  if (await answerIfAsked(page, ready)) {
    await page.goto('about:blank');
    await page.goto(`${BASE}#${hash}`);
  }
  await page.locator(ready).first().waitFor({ timeout: 60000 });
  await settle(page, 400);
}

/** 準備：初回は最初の2問に答える（「基本」のひな形＝エキスパート機能は切）。時計は NOW に止める */
async function open() {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await skipTour(ctx, { start: 'ask' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  watchErrors(page);
  const dlg = await answerConfirms(page);
  return { b, ctx, page, dlg };
}

/** 今日の最初の担当の列の最初の帯の訪問 ID */
const firstVisit = (page) =>
  page.locator('.route-col:not(.route-col-none) .tl-band').first().getAttribute('data-visit');

/** 訪問を別の担当へ移す（帯 → 詳細の「担当を変える」→ 押せる最初のほかの人）。移した先の人の ID を返す */
async function moveVisit(page, vid) {
  await page.locator(`.tl-band[data-visit="${vid}"] .tl-band-btn`).click();
  await reBtn(page).waitFor({ timeout: 5000 });
  await reBtn(page).click();
  await reList(page).waitFor();
  const item = reList(page).locator('[data-key^="to-"]:not([aria-disabled="true"])').first();
  const key = await item.getAttribute('data-key');
  await item.click();
  const staffId = key.replace(/^to-/, '');
  await dataWhen(page, (d) => d.visits.find((x) => x.id === vid)?.staffId === staffId);
  await settle(page, 400);
  return staffId;
}

/** 1 切の日の画面：確定の段階（確定のボタン・確定済み・まだ伝えていない）が無い */
async function plain(page) {
  await fresh(page, `/plan?date=${TODAY}`, '[data-testid="sched-nav"]');
  const d = await data(page);
  check(d.org.features.expert === false, '前提：初めて開くとエキスパート機能は切', d.org.features);
  check(!d.snapshots[TODAY], '前提：初期データに今日の伝えた記録は無い', Object.keys(d.snapshots));
  check((await page.getByTestId('adopt').count()) === 0, '確定（伝えた）のボタンを出さない');
  check((await page.getByTestId('confirm-state').count()) === 0, '「まだ伝えていない」「確定済み」の印を出さない');
  check((await page.getByTestId('plan-next-unconfirmed').count()) === 0, '「次の確定していない日へ」を出さない');
  check((await page.locator('[data-told-date]').count()) === 0, '決まる前は「変更あり」の印が無い');
}

/** 2 手で直すと、その日が自動で決まった（伝えた）扱いになる */
async function settle1(page) {
  const vid = await firstVisit(page);
  const staffId = await moveVisit(page, vid);
  const d = await dataWhen(page, (x) => !!x.snapshots[TODAY]);
  const snap = d.snapshots[TODAY];
  check(!!snap && snap.date === TODAY && snap.at > 0, '手で直すと今日の伝えた記録が自動で付く', snap);
  check(
    snap?.visits.find((x) => x.id === vid)?.staffId === staffId,
    '伝えた記録は今の担当（移した先）になっている',
    snap?.visits.find((x) => x.id === vid),
  );
  check((await page.getByTestId('confirm-state').count()) === 0, '決まった直後は「変更あり」の印も出ない');
  check((await page.locator('[data-told-date]').count()) === 0, '決まった直後は訪問の「変更あり」の印が無い');
  check((await page.getByTestId('adopt').count()) === 0, '決まっても確定のボタンは出ない');
  return { vid, snap };
}

/** 3〜5 もう一度直す → 変更あり → 印を押す → 連絡した → 消える → 元に戻す */
async function changed(page) {
  const vid = await firstVisit(page);
  const before = (await data(page)).snapshots[TODAY];
  const staffId = await moveVisit(page, vid);
  const d = await data(page);
  check(
    d.snapshots[TODAY].at === before.at && JSON.stringify(d.snapshots[TODAY].visits) === JSON.stringify(before.visits),
    '伝えた記録のある日は自動では書き換えない（直したあとも前の伝えた記録のまま）',
  );
  const chip = page.getByTestId('confirm-state');
  await chip.waitFor({ timeout: 10000 });
  check(/変更あり/.test(await chip.innerText()), '日の上に「変更あり N件」のチップ', await chip.innerText());
  const mark = page.locator(`.tl-band[data-visit="${vid}"] [data-told-date]`);
  await mark.waitFor({ timeout: 10000 });
  check(
    (await mark.innerText()).trim() === '変更あり' && (await mark.getAttribute('data-told-date')) === TODAY,
    '直した訪問に「変更あり」の印（その日の日付つき）',
    await mark.innerText(),
  );
  // 印を押すと連絡の一覧（札は選び直さない）
  const picked0 = await page.locator('.tl-band.is-picked').count();
  await page.getByTestId('schedule-toolbar').scrollIntoViewIfNeeded();
  await mark.click();
  await sheet(page).waitFor({ timeout: 10000 });
  check(true, '印を押すと連絡の一覧が開く');
  check(
    (await page.locator('.tl-band.is-picked').count()) === picked0,
    '印を押しても訪問の札の選択は変わらない',
    await page.locator('.tl-band.is-picked').count(),
  );
  const done = page.getByTestId('contacted');
  check((await done.count()) === 1, '連絡の一覧に「連絡した」ボタン（メール機能の入り切りに関係なく）');
  // 連絡した → 今の担当が伝えた記録になり、印が消える
  await done.click();
  const after = await dataWhen(page, (x) => x.snapshots[TODAY].at !== before.at);
  check(
    after.snapshots[TODAY].visits.find((x) => x.id === vid)?.staffId === staffId,
    '「連絡した」で今の担当が伝えた記録になる',
    after.snapshots[TODAY].visits.find((x) => x.id === vid),
  );
  await page.locator('[data-told-date]').first().waitFor({ state: 'detached', timeout: 10000 });
  check(
    (await page.getByTestId('confirm-state').count()) === 0 && (await page.locator('[data-told-date]').count()) === 0,
    '「連絡した」のあと「変更あり」の印・チップが消える',
  );
  check((await sheet(page).count()) === 0, '「連絡した」のあと連絡の一覧は閉じる');
  // 元に戻す（今の確定と同じ扱い）：伝えた記録が前に戻り、変更ありが戻る
  // 元に戻すは「その他 ▾」の中（エキスパート機能が切。PRD D384）
  await pressTool(page, 'more-undo', { where: 'more' });
  const undone = await dataWhen(page, (x) => x.snapshots[TODAY].at === before.at);
  check(undone.snapshots[TODAY].at === before.at, '操作の行の［元に戻す］で「連絡した」の前に戻る');
  await page.locator('[data-told-date]').first().waitFor({ timeout: 10000 });
  check(true, '元に戻すと「変更あり」の印が戻る');
}

/** 6 週の予定の印を押すと、その日の日の予定へ移り連絡の一覧が開く */
async function fromWeek(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/week`);
  // 1行の状態は「詳しく」の中（PRD D384）。開く
  await page.getByTestId('week-details-summary').click();
  await page.locator('[data-testid="week-status"]').first().waitFor({ timeout: 60000 });
  await settle(page, 600);
  const text = await page.getByTestId('week-status').innerText();
  check(
    /変更あり/.test(text) && !/確定済み|まだ伝えていない/.test(text),
    '週の1行の状態は「変更あり」と要対応だけ',
    text,
  );
  check((await page.getByTestId('week-next').count()) === 0, '週の主ボタン（まとめて確定）を出さない');
  const mark = page.locator('[data-told-date]').first();
  await mark.waitFor({ timeout: 10000 });
  const date = await mark.getAttribute('data-told-date');
  await mark.click();
  await sheet(page).waitFor({ timeout: 15000 });
  const hash = new URL(page.url()).hash;
  check(
    /^#\/plan/.test(hash) && !/do=told|date=/.test(hash),
    '印を押すと日の予定へ移り、URL の ?do=・?date= は消える',
    hash,
  );
  check(date === TODAY, '印の日付は直した今日', date);
  check((await page.getByTestId('contacted').count()) === 1, '週から移っても連絡の一覧に「連絡した」がある');
}

/** 7 月の予定：確定の段階が無い */
async function month(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  // 進み具合の帯は「詳しく」の中（PRD D384）。開く
  await page.getByTestId('month-details-summary').click();
  await page.getByTestId('progress-band').waitFor({ timeout: 60000 });
  await settle(page, 600);
  check((await page.getByTestId('band-confirm').count()) === 0, '月の帯に「確定 N/N日」を出さない');
  const next = await page.getByTestId('band-next').getAttribute('data-kind');
  check(next !== 'unconfirmed', '月の帯の次の一手に「確定していない日を見る」を出さない', next);
  // マスの「変更あり」の印を押すとその日の日の予定の連絡の一覧（マスは選ばず移る）
  const cellMark = page.locator(`[data-testid="month-day"][data-date="${TODAY}"] [data-told-date]`);
  await cellMark.waitFor({ timeout: 15000 });
  await cellMark.click();
  await sheet(page).waitFor({ timeout: 15000 });
  const mh = new URL(page.url()).hash;
  check(/^#\/plan/.test(mh) && !/do=told|date=/.test(mh), '月のマスの印を押すと日の予定へ移り連絡の一覧が開く', mh);
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month?do=unconfirmed`);
  await page.getByTestId('month-aside').waitFor({ timeout: 60000 });
  await settle(page, 400);
  check(
    (await page.getByTestId('month-unconfirmed').count()) === 0,
    '?do=unconfirmed でも確定していない日の欄は出ない（要対応へ）',
  );
  check((await page.getByRole('button', { name: /まとめて確定/ }).count()) === 0, '「まとめて確定」のボタンを出さない');
  // ホームは無い（切のとき。PRD D383）：#/home は予定へ移り、要対応の帯にも確定の話は出ない
  await page.goto('about:blank');
  await page.goto(`${BASE}#/home`);
  await page.getByTestId('sched-nav').waitFor({ timeout: 60000 });
  check(/^#\/(month|week)/.test(new URL(page.url()).hash), '#/home は予定の画面へ移る（ホームは無い）', page.url());
  check((await page.getByTestId('home-tasks').count()) === 0, 'ホームの「今日やること」は出ない');
  const band = page.getByTestId('attention-band');
  if ((await band.count()) > 0)
    check(!/確定|伝えて/.test(await band.innerText()), '要対応の帯に確定の話を出さない', await band.innerText());
}

/** 8 エキスパート機能が入なら今の確定（伝えた）の操作が出て、自動では伝えない */
async function expertOn(page) {
  await fresh(page, `/plan?date=${TODAY}`, '[data-testid="sched-nav"]');
  await page.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem(k));
    d.org.features = { ...d.org.features, expert: true };
    localStorage.setItem(k, JSON.stringify(d));
  }, STORAGE_KEY);
  await page.reload();
  await page.getByTestId('adopt').waitFor({ timeout: 60000 });
  check((await page.getByTestId('adopt').count()) === 1, 'expert 入：確定（伝えた）のボタンが出る');
  check(
    /まだ伝えていない/.test(await page.getByTestId('confirm-state').innerText()),
    'expert 入：「まだ伝えていない」の印が出る',
  );
  const vid = await firstVisit(page);
  await moveVisit(page, vid);
  const d = await data(page);
  check(!d.snapshots[TODAY], 'expert 入：手で直しても自動では伝えた記録を付けない', Object.keys(d.snapshots));
}

/** 9 決まった日に担当なしの訪問を足すと、自動の組みが担当を付ける（伝えた内容は書き換えず、足した訪問は「変更あり」） */
async function addToSettled(page) {
  await fresh(page, `/plan?date=${TODAY}`, '[data-testid="sched-nav"]');
  await moveVisit(page, await firstVisit(page));
  const d0 = await dataWhen(page, (x) => !!x.snapshots[TODAY]);
  const n0 = d0.visits.length;
  await page.getByTestId('plan-visit-add').click();
  await page.getByTestId('visit-panel').waitFor();
  await page.getByTestId('visit-panel').getByTestId('vp-start').fill('10:00');
  await settle(page, 400);
  await page.getByTestId('vp-save').click();
  await page.getByTestId('visit-panel').waitFor({ state: 'detached', timeout: 10000 });
  const d1 = await dataWhen(page, (x) => x.visits.length === n0 + 1 && x.visits.at(-1).staffId !== null);
  const v = d1.visits.at(-1);
  check(v.staffId !== null && v.date === TODAY, '決まった日に足した訪問にも自動で担当が付く', v);
  check(d1.snapshots[TODAY].at === d0.snapshots[TODAY].at, '伝えた記録は書き換えない');
  await page.locator(`.tl-band[data-visit="${v.id}"] [data-told-date]`).waitFor({ timeout: 10000 });
  check(true, '足した訪問は「変更あり」（伝える必要がある）');
}

const steps = sharedPage({
  open,
  steps: [
    ['1 切の日の画面に確定の段階が無い', plain],
    ['2 手で直すと自動で決まる', settle1],
    ['3〜5 変更あり・印・連絡した・元に戻す', changed],
    ['6 週の印から日の予定の連絡の一覧へ', fromWeek],
    ['7 月に確定の段階が無く、ホームも無い', month],
    ['8 expert 入は今の確定の操作', expertOn],
    ['9 決まった日に足した訪問も自動で組まれる', addToSettled],
  ],
  call: (fn, s) => fn(s.page, s.dlg),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
