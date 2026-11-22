// 設定のひな形をリンクで適用する（PRD D480〜D482。ADR-0121）と、帰りの前は自宅に近い人の「勤務の終わりの◯分前から」（PRD D479）。
// ・`#/settings?apply=standard-start-no-shift` を開く → 独自の確認に変わる項目の一覧（今 → 適用後）→［適用］で機能5つが切・条件
//   「帰りの前は自宅に近い人」が足される・車の速さが 30km/h。〈利用者さん〉・〈スタッフ〉・予定は変わらない。URL から apply が消える
// ・Ctrl+Z と知らせの［元に戻す］で適用の前に戻る。全部同じなら「すでにこの設定です」で確認を出さない
// ・キャンセルでは何も変えず、URL から apply が消える（読み直しても確認を出さない）
// ・知らない ID は「見つかりません」を出して何もしない（確認を出さない）
// ・条件の重みの画面の帰りの前は自宅に近い人の行で「勤務の終わりの◯分前から」を直すとすぐ保存
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-settings-apply.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const { answerConfirms } = require('./lib/confirmDialog.cjs');
const { MOD, STORAGE_KEY, check, hashOf, runSteps, settle, stored, waitStored } = require('./lib/env.cjs');
const { openPage, sharedPage } = require('./lib/steps.cjs');
const { goTo } = require('./lib/ui.cjs');

const SET_ID = 'standard-start-no-shift';
const SET_LABEL = 'ちょうどの時刻で組む・連絡を短く';
const OFF = ['shiftStart', 'clientTraits', 'timeWindow', 'clientContact', 'contactAddress'];
const HOME = '帰りの前は自宅に近い人';

/** 設定が適用された形か */
const applied = (d) =>
  !!d &&
  OFF.every((id) => d.org.features[id] === false) &&
  d.rules.some((r) => r.type === 'homeNear') &&
  d.org.lineTravel.driveKmh === 30;
/** 適用の前の形か（初期データ・すべて入） */
const before = (d) =>
  !!d &&
  OFF.every((id) => d.org.features[id] !== false) &&
  !d.rules.some((r) => r.type === 'homeNear') &&
  d.org.lineTravel.driveKmh === 25;

/** 保存を消して初期データで始め、管理者設定を開く */
async function fresh(page) {
  await goTo(page, '/data');
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
  await goTo(page, '/settings');
  await waitStored(page, (d) => d !== null);
}

/** 知らせ（文の一部）が出るまで待つ */
const toastOf = (page, text) => page.locator('.toast').filter({ hasText: text });

async function applyAndUndo({ page, dlg }) {
  await fresh(page);
  const d0 = await stored(page);
  check(before(d0), '初期データは適用の前の形', JSON.stringify(d0?.org.features));
  dlg.answer = true;
  dlg.messages.length = 0;
  await goTo(page, `/settings?apply=${SET_ID}`);
  await toastOf(page, `設定のひな形「${SET_LABEL}」を適用しました`).waitFor({ timeout: 10000 });
  const msg = dlg.messages[0] ?? '';
  check(dlg.messages.length === 1, '確認は1回だけ', dlg.messages);
  check(msg.startsWith(`設定のひな形「${SET_LABEL}」を適用しますか？`), '確認の見出し', msg);
  for (const line of [
    '変わる項目（今 → 適用後）：',
    '・機能「開始時刻をずらして組む」：入 → 切',
    '・機能「時間の決め方（ちょうど・幅）」：入 → 切',
    `・条件「${HOME}」：なし → 足す（重み2・勤務の終わりの60分前から）`,
    '・移動時間の見積もり方の車の速さ：25km/h → 30km/h',
    '予定は変えません。切った機能のデータは消えません。',
  ])
    check(msg.includes(line), `確認の一覧：${line}`, msg);
  const d1 = await waitStored(page, applied).then(() => stored(page));
  check(applied(d1), '［適用］で機能5つが切・条件を足す・車の速さ 30km/h', JSON.stringify(d1.org.features));
  check(d1.rules.find((r) => r.type === 'homeNear')?.label === HOME, `足した条件の名前は「${HOME}」`);
  check(
    JSON.stringify(d1.clients) === JSON.stringify(d0.clients) &&
      JSON.stringify(d1.staff) === JSON.stringify(d0.staff) &&
      JSON.stringify(d1.visits) === JSON.stringify(d0.visits),
    '〈利用者さん〉・〈スタッフ〉・予定は変わらない',
  );
  check(!(await hashOf(page)).includes('apply='), 'URL から apply が消える', await hashOf(page));
  // Ctrl+Z で適用の前に戻る
  await page.locator('h1').click();
  await page.keyboard.press(`${MOD}+z`);
  check(await waitStored(page, before), 'Ctrl+Z で適用の前に戻る');
  // もう一度適用して、知らせの［元に戻す］で戻す
  await goTo(page, `/settings?apply=${SET_ID}`);
  const t = toastOf(page, '適用しました');
  await t.waitFor({ timeout: 10000 });
  check(await waitStored(page, applied), '2回目の適用');
  await t.getByTestId('toast-undo').click();
  check(await waitStored(page, before), '知らせの［元に戻す］で適用の前に戻る');
}

async function alreadySame({ page, dlg }) {
  await fresh(page);
  dlg.answer = true;
  await goTo(page, `/settings?apply=${SET_ID}`);
  await waitStored(page, applied);
  await settle(page, 300);
  dlg.messages.length = 0;
  await goTo(page, `/settings?apply=${SET_ID}`);
  await toastOf(page, 'すでにこの設定です').waitFor({ timeout: 10000 });
  check(dlg.messages.length === 0, '全部同じなら確認を出さない', dlg.messages);
  check(!(await hashOf(page)).includes('apply='), 'URL から apply が消える（すでに同じ）');
}

async function cancelKeeps({ page, dlg }) {
  await fresh(page);
  const d0 = await stored(page);
  dlg.answer = false;
  dlg.messages.length = 0;
  await goTo(page, `/settings?apply=${SET_ID}`);
  await page.waitForFunction(() => !location.hash.includes('apply='), null, { timeout: 10000 });
  check(dlg.messages.length === 1, 'キャンセル：確認は出る', dlg.messages);
  await settle(page, 300);
  check(JSON.stringify(await stored(page)) === JSON.stringify(d0), 'キャンセルでは何も変えない');
  // 読み直しても確認を出さない（URL から消えた）
  await page.reload();
  await page.locator('h1').first().waitFor();
  await settle(page, 300);
  check(dlg.messages.length === 1, 'キャンセルのあと読み直しても確認は出ない', dlg.messages);
  dlg.answer = true;
}

async function unknownId({ page, dlg }) {
  await fresh(page);
  const d0 = await stored(page);
  dlg.messages.length = 0;
  await goTo(page, '/settings?apply=no-such-set');
  await toastOf(page, '設定のひな形「no-such-set」が見つかりません').waitFor({ timeout: 10000 });
  await settle(page, 300);
  check(dlg.messages.length === 0, '知らない ID：確認を出さない', dlg.messages);
  check(JSON.stringify(await stored(page)) === JSON.stringify(d0), '知らない ID：何も変えない');
  check(!(await hashOf(page)).includes('apply='), '知らない ID：URL から apply が消える');
}

async function beforeEndField({ page, dlg }) {
  await fresh(page);
  dlg.answer = true;
  await goTo(page, `/settings?apply=${SET_ID}`);
  await waitStored(page, applied);
  await goTo(page, '/rules', { ready: '[data-testid="rule-before-end-input"]' });
  const input = page.getByTestId('rule-before-end-input');
  check(
    (await input.inputValue()) === '60',
    '条件の重みの行に「勤務の終わりの 60 分前から」',
    await input.inputValue(),
  );
  await input.fill('90');
  await input.press('Enter');
  check(
    await waitStored(page, (d) => d.rules.find((r) => r.type === 'homeNear')?.beforeEndMin === 90),
    '「勤務の終わりの◯分前から」を直すとすぐ保存',
  );
  await input.fill('abc');
  check(
    (await page.getByTestId('rule-before-end').innerText()).includes('整数で入れてください'),
    '整数でなければ誤りを出す',
  );
  await input.blur();
  await settle(page, 300);
  check((await stored(page)).rules.find((r) => r.type === 'homeNear')?.beforeEndMin === 90, '整数でなければ書かない');
}

const steps = sharedPage({
  open: async () => {
    const s = await openPage();
    s.dlg = await answerConfirms(s.page);
    return s;
  },
  call: (fn, s) => fn(s),
  steps: [
    ['リンクで適用して元に戻す', applyAndUndo],
    ['全部同じならすでにこの設定', alreadySame],
    ['キャンセルでは何も変えない', cancelKeeps],
    ['知らない ID は見つかりません', unknownId],
    ['勤務の終わりの何分前から', beforeEndField],
  ],
  after: async (s) => {
    check(s.dlg.native.length === 0, 'ネイティブのダイアログを出さない', s.dlg.native);
    await s.b?.close();
  },
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
