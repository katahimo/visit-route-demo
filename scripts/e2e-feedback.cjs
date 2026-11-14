// 画面へのご意見（PRD D449・D450。ADR-0114）を本物のブラウザで確かめる：
// 左下の「ご意見を書く」でその画面を撮り（見えている範囲・画面の大きさ）、ご意見を書いて残す。空のご意見は残せない。画像を外して残せる。
// 残したご意見は読み直しても残る（IndexedDB）。ご意見の画面で一覧・パスワード（8文字以上）・ファイルを作る・保存してメールを開く。
// 保存したファイルは中身が読めず、ブラウザで開いてパスワードを入れるとご意見と画像が出る（違うパスワードでは開かない）。
// 送ったご意見を消すと一覧が空になる。390px でボタンが下のタブに重ならず、ダイアログが画面に収まる。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-feedback.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { OUT_DIR, check, settle, runSteps, until } = require('./lib/env.cjs');
const { openContext, pagePerStep } = require('./lib/steps.cjs');
const { goTo } = require('./lib/ui.cjs');

const open = (page, hash, ready) => goTo(page, hash, { ready, timeout: 30000, h1: false, settleMs: 400 });
const PASSWORD = 'aikotoba-2026';

/** 「ご意見を書く」を押して、撮り終わってダイアログが出るまで待つ */
async function startFeedback(page) {
  await page.getByTestId('feedback-button').click();
  await page.getByTestId('feedback-dialog').waitFor({ timeout: 30000 });
}

/** ご意見を1件残す（withImage が偽なら画像を外す） */
async function leave(page, comment, withImage = true) {
  await startFeedback(page);
  if (!withImage) await page.getByTestId('feedback-with-image').uncheck();
  await page.getByTestId('feedback-comment').fill(comment);
  await page.getByTestId('feedback-save').click();
  await page.getByTestId('feedback-dialog').waitFor({ state: 'detached', timeout: 10000 });
}

// ---- 撮る・残す：月の予定を巻いてから押す。画像は画面の大きさ、ボタンとダイアログは写らない。空は残せない ----
async function capture(page) {
  await open(page, '/month', '.app-main h1');
  await page.evaluate(() => window.scrollTo(0, 200));
  check((await page.getByTestId('feedback-count').count()) === 0, '残す前：件数の印は出ない');
  await startFeedback(page);
  const shot = await page.getByTestId('feedback-shot').evaluate(async (img) => {
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight, jpeg: img.src.startsWith('data:image/jpeg;base64,') };
  });
  check(shot.jpeg && shot.w === 1280 && shot.h === 900, '撮った画像は JPEG で画面の大きさ', shot);
  await page.getByTestId('feedback-shot').screenshot({ path: path.join(OUT_DIR, 'feedback-shot.png') });
  await page.getByTestId('feedback-save').click();
  check(
    (await page.getByTestId('feedback-dialog').count()) === 1 &&
      /ご意見を入れてください/.test(await page.getByTestId('feedback-dialog').innerText()),
    '空のご意見は残せない',
  );
  await page.keyboard.press('Escape');
  check((await page.getByTestId('feedback-dialog').count()) === 0, 'Esc で捨てる');
  check((await page.getByTestId('feedback-count').count()) === 0, '捨てたら残らない');
  await leave(page, '月の予定：ここの数字の意味が分かりにくい');
  check(
    await until(
      async () =>
        (await page.locator('.toast-layer').allInnerTexts()).some((t) => t.includes('ご意見を残しました（1件）')),
      5000,
    ),
    '残したら知らせる',
  );
  check((await page.getByTestId('feedback-count').innerText()) === '1', '残したら件数の印 1');
  await open(page, '/data', '.app-main h1');
  await leave(page, 'データ：画像なしのご意見', false);
  await page.reload();
  await page.getByTestId('feedback-count').waitFor({ timeout: 30000 });
  check((await page.getByTestId('feedback-count').innerText()) === '2', '読み直しても残っている（2件）');
}

// ---- 送る：ご意見の画面の一覧・パスワード・ファイルを作る・保存してメールを開く・ファイルを開く・送ったご意見を消す ----
async function send(page) {
  await open(page, '/staff', '.app-main h1');
  await leave(page, 'スタッフ：<b>並び順</b>を変えたい');
  await leave(page, '2件目：画像なし', false);
  await startFeedback(page);
  await page.getByTestId('feedback-list-link').click();
  await page.getByTestId('feedback-list').waitFor({ timeout: 30000 });
  check((await page.getByTestId('feedback-button').count()) === 0, 'ご意見の画面では「ご意見を書く」を出さない');
  check((await page.getByTestId('feedback-item').count()) === 2, '一覧に2件');
  check((await page.locator('[data-testid="feedback-item"] img').count()) === 1, '画像つきは1件');
  await page.getByTestId('feedback-password').fill('short');
  await page.getByTestId('feedback-make').click();
  check(
    /8文字以上/.test(await page.getByTestId('feedback-send').innerText()) &&
      (await page.getByTestId('feedback-file').count()) === 0,
    '短いパスワードではファイルを作らない',
  );
  await page.getByTestId('feedback-password').fill(PASSWORD);
  await page.getByTestId('feedback-make').click();
  await page.getByTestId('feedback-file').waitFor({ timeout: 30000 });
  check((await page.getByTestId('feedback-remove-sent').count()) === 0, '送る前は「送ったご意見を消す」を出さない');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('feedback-save-mail').click()]);
  check(/^staff-assign-feedback-\d{4}-\d{2}-\d{2}\.html$/.test(download.suggestedFilename()), 'ファイルを保存する');
  const file = path.join(OUT_DIR, 'feedback-sealed.html');
  await download.saveAs(file);
  const sealed = fs.readFileSync(file, 'utf8');
  check(
    !sealed.includes('並び順') && !sealed.includes(PASSWORD),
    '保存したファイルにご意見もパスワードも素では入らない',
  );
  // 保存したファイルをブラウザで開く：違うパスワードでは開かず、合えばご意見と画像が出る
  const viewer = await page.context().newPage();
  await viewer.goto(pathToFileURL(file).href);
  await viewer.locator('#pw').fill('chigau-password');
  await viewer.locator('button').click();
  await viewer.locator('#msg').filter({ hasText: 'パスワードが違います' }).waitFor({ timeout: 30000 });
  await viewer.locator('#pw').fill(PASSWORD);
  await viewer.locator('button').click();
  await viewer.locator('section').first().waitFor({ timeout: 30000 });
  const body = await viewer.locator('body').innerText();
  check(
    body.includes('スタッフ：<b>並び順</b>を変えたい') && body.includes('2件目：画像なし'),
    '開くとご意見が出る（タグにしない）',
  );
  check((await viewer.locator('img').count()) === 1 && body.includes('（画像なし）'), '開くと画像が出る');
  await viewer.close();
  // 送ったご意見を消す
  await page.getByTestId('feedback-remove-sent').click();
  await page.getByTestId('confirm-ok').click();
  await until(async () => (await page.getByTestId('feedback-item').count()) === 0, 10000);
  check((await page.getByTestId('feedback-send').count()) === 0, '消したら送る欄も出さない（空の案内）');
}

// ---- 390px：ボタンは下のタブの上・画面の中。ダイアログは画面に収まる ----
async function narrow(page) {
  await page.setViewportSize({ width: 390, height: 780 });
  await open(page, '/month', '.app-main h1');
  const box = await page.getByTestId('feedback-button').boundingBox();
  const tabs = await page.locator('.bottom-tabs').boundingBox();
  check(box && tabs && box.y + box.height <= tabs.y && box.x >= 0, '390px：ボタンは下のタブの上', { box, tabs });
  check(
    (await page.getByTestId('feedback-button').getAttribute('aria-label')) === 'ご意見を書く',
    '390px：名前は aria-label で読める',
  );
  await startFeedback(page);
  await settle(page, 300);
  const d = await page.getByTestId('feedback-dialog').boundingBox();
  check(
    d && d.x >= 0 && d.x + d.width <= 390 && d.y >= 0 && d.y + d.height <= 780,
    '390px：ダイアログが画面に収まる',
    d,
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'feedback-dialog-390.png') });
  await page.getByTestId('feedback-cancel').click();
}

const steps = pagePerStep({
  open: (browser) => openContext(browser, { viewport: { width: 1280, height: 900 }, confirms: false }),
  steps: [capture, send, narrow],
  label: (name) => `${name}：途中で止まった`,
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
