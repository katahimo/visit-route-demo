// 設定のひな形をリンクで適用する（PRD D480〜D482・D484〜D487。ADR-0121・ADR-0122）と、更新前の控え（PRD D483・D485）と、
// 帰りの前は自宅に近い人の「勤務の終わりの◯分前から」（PRD D479）。
// ・`#/settings?apply=standard-start-no-shift` を開く → 3ステップの手順の画面（①データの控え ②変わる設定（今 → 適用後）③［適用］）。
//   控えをファイルに書き出すまで［適用］を押せない（理由を添える）。書き出すと押せ、機能5つが切・条件「帰りの前は自宅に近い人」が足される・
//   車の速さが 30km/h。〈利用者さん〉・〈スタッフ〉・予定は変わらない。URL から apply が消える
// ・Ctrl+Z と知らせの［元に戻す］で適用の前に戻る。全部同じなら「すでにこの設定です」で手順の画面を出さない
// ・［取り消す］では何も変えず、URL から apply が消える（読み直しても出さない）
// ・知らない ID は「見つかりません」を出して何もしない
// ・まだ見ていない更新があるとき：普通に開くと「デモを更新しました」の前に更新前の控えを1世代の控えとは別のキーに自動で残す（前からある
//   1世代の控えは上書きしない）。リンクで開くと更新の画面を出さず（見たことにする）、手順の①に自動の控えの時刻と［変わったことを見る］。
//   データの画面に2つの控えを別のカードで出し、「更新前の控え（◯月◯日の更新の前・◯時◯分）」の［この控えを書き出す］・［この控えに戻す］
//   （いまのデータは直前の状態の控えに回り、更新前の控えは残る）。容量不足なら理由を出し、データと1世代の控えはそのまま。
//   知らない ID のリンクでは見たことにせず、いつもの更新の画面を出す
// ・保存データが無い人がリンクを開くと、最初の2問のあとに手順の画面（作ったばかりなので書き出しは求めない）
// ・条件の重みの画面の帰りの前は自宅に近い人の行で「勤務の終わりの◯分前から」を直すとすぐ保存
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-settings-apply.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const { answerConfirms } = require('./lib/confirmDialog.cjs');
const { BASE, MOD, STORAGE_KEY, check, hashOf, runSteps, settle, stored, until, waitStored } = require('./lib/env.cjs');
const { answerFirstRun } = require('./lib/firstRun.cjs');
const { openPage, sharedPage } = require('./lib/steps.cjs');
const { goTo } = require('./lib/ui.cjs');

const SET_ID = 'standard-start-no-shift';
const SET_LABEL = 'ちょうどの時刻で組む・連絡を短く';
const OFF = ['shiftStart', 'clientTraits', 'timeWindow', 'clientContact', 'contactAddress'];
const HOME = '帰りの前は自宅に近い人';
/** store/start.ts の SEEN_RELEASE_KEY・store/persist.ts の PREV_KEY・store/releaseBackup.ts の RELEASE_PREV_KEY と同じ */
const SEEN_RELEASE_KEY = 'vrdemo:release:seen';
const PREV_KEY = 'vrdemo:data:prev';
const PREV_INFO_KEY = 'vrdemo:data:prev:info';
const RELEASE_PREV_KEY = 'vrdemo:data:release-prev';
const RELEASE_PREV_INFO_KEY = 'vrdemo:data:release-prev:info';

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

/** リンクを開いて手順の画面が出るまで待つ */
async function openLink(page) {
  await goTo(page, `/settings?apply=${SET_ID}`, { ready: '[data-testid="setting-steps"]', h1: false });
  return page.getByTestId('setting-steps');
}

/** ①で控えを書き出す（書き出したファイル名を返す） */
async function exportBackup(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('setting-steps-export').click()]);
  await page.getByTestId('setting-steps-export-result').filter({ hasText: '控えを書き出しました' }).waitFor();
  return dl.suggestedFilename();
}

/** 手順の画面で書き出してから［適用］を押す */
async function exportAndApply(page) {
  await openLink(page);
  await exportBackup(page);
  await page.getByTestId('setting-steps-apply').click();
}

async function applyAndUndo({ page, dlg }) {
  await fresh(page);
  const d0 = await stored(page);
  check(before(d0), '初期データは適用の前の形', JSON.stringify(d0?.org.features));
  dlg.messages.length = 0;
  const steps = await openLink(page);
  check(
    (await page.getByTestId('setting-steps-title').innerText()) === `設定のひな形「${SET_LABEL}」を適用します`,
    '手順の見出し',
  );
  const body = await page.getByTestId('setting-steps-body').innerText();
  for (const line of [
    '変わる項目（今 → 適用後）：',
    '・機能「開始時刻をずらして組む」：入 → 切',
    '・機能「時間の決め方（ちょうど・幅）」：入 → 切',
    `・条件「${HOME}」：なし → 足す（重み2・勤務の終わりの60分前から）`,
    '・移動時間の見積もり方の車の速さ：25km/h → 30km/h',
    '予定は変えません。切った機能のデータは消えません。',
  ])
    check(body.includes(line), `②の一覧：${line}`, body);
  const text = await steps.innerText();
  for (const h of ['① データの控え', '② 変わる設定', '③ 適用する']) check(text.includes(h), `手順の段：${h}`, text);
  check(
    (await page.getByTestId('setting-steps-backup-lead').innerText()).includes('控えをファイルに書き出してください'),
    '①：控えの書き出しを求める',
  );
  check(await page.getByTestId('setting-steps-apply').isDisabled(), '書き出すまで［適用］を押せない');
  check(
    (await page.getByTestId('setting-steps-blocked').innerText()).includes('書き出すと［適用］を押せます'),
    '押せない理由を添える',
  );
  check((await page.getByTestId('first-run').count()) === 0, '更新の画面は出さない');
  const name = await exportBackup(page);
  check(/^staff-assign-demo-\d{4}-\d{2}-\d{2}\.json$/.test(name), '①の書き出しはデータの画面と同じファイル', name);
  check(await page.getByTestId('setting-steps-apply').isEnabled(), '書き出したら［適用］を押せる');
  await page.getByTestId('setting-steps-apply').click();
  await toastOf(page, `設定のひな形「${SET_LABEL}」を適用しました`).waitFor({ timeout: 10000 });
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
  check((await page.getByTestId('setting-steps').count()) === 0, '適用したら手順の画面を閉じる');
  check(dlg.messages.length === 0, '確認ダイアログは別に出さない', dlg.messages);
  // Ctrl+Z で適用の前に戻る
  await page.locator('h1').click();
  await page.keyboard.press(`${MOD}+z`);
  check(await waitStored(page, before), 'Ctrl+Z で適用の前に戻る');
  // もう一度適用して、知らせの［元に戻す］で戻す
  await exportAndApply(page);
  const t = toastOf(page, '適用しました');
  await t.waitFor({ timeout: 10000 });
  check(await waitStored(page, applied), '2回目の適用');
  await t.getByTestId('toast-undo').click();
  check(await waitStored(page, before), '知らせの［元に戻す］で適用の前に戻る');
}

async function alreadySame({ page }) {
  await fresh(page);
  await exportAndApply(page);
  await waitStored(page, applied);
  await settle(page, 300);
  await goTo(page, `/settings?apply=${SET_ID}`);
  await toastOf(page, 'すでにこの設定です').waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId('setting-steps').count()) === 0,
    '全部同じなら手順の画面を出さない（書き出しも求めない）',
  );
  check(!(await hashOf(page)).includes('apply='), 'URL から apply が消える（すでに同じ）');
}

async function cancelKeeps({ page }) {
  await fresh(page);
  const d0 = await stored(page);
  await openLink(page);
  await page.getByTestId('setting-steps-cancel').click();
  await page.waitForFunction(() => !location.hash.includes('apply='), null, { timeout: 10000 });
  await settle(page, 300);
  check((await page.getByTestId('setting-steps').count()) === 0, '［取り消す］で閉じる');
  check(JSON.stringify(await stored(page)) === JSON.stringify(d0), '［取り消す］では何も変えない');
  // 読み直しても出さない（URL から消えた）
  await page.reload();
  await page.locator('h1').first().waitFor();
  await settle(page, 300);
  check((await page.getByTestId('setting-steps').count()) === 0, '取り消したあと読み直しても出さない');
}

async function unknownId({ page }) {
  await fresh(page);
  const d0 = await stored(page);
  await goTo(page, '/settings?apply=no-such-set');
  await toastOf(page, '設定のひな形「no-such-set」が見つかりません').waitFor({ timeout: 10000 });
  await settle(page, 300);
  check((await page.getByTestId('setting-steps').count()) === 0, '知らない ID：手順の画面を出さない');
  check(JSON.stringify(await stored(page)) === JSON.stringify(d0), '知らない ID：何も変えない');
  check(!(await hashOf(page)).includes('apply='), '知らない ID：URL から apply が消える');
}

async function beforeEndField({ page }) {
  await fresh(page);
  await exportAndApply(page);
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

/** 2問を出す文脈（印「all」なし）で開く。確認には答える */
async function askingPage() {
  const s = await openPage({ start: 'ask' });
  s.dlg = await answerConfirms(s.page);
  return s;
}

/** 目印の事業所名を入れ、設定を適用の前の形にして、見た更新の印を古くする（次に開くと更新を知らせる） */
const markOld = (page) =>
  page.evaluate(
    ([k, sk]) => {
      const d = JSON.parse(localStorage.getItem(k));
      d.org.name = '更新前の事業所';
      d.org.features = {};
      d.rules = d.rules.filter((r) => r.type !== 'homeNear');
      d.org.lineTravel.driveKmh = 25;
      localStorage.setItem(k, JSON.stringify(d));
      localStorage.setItem(sk, '2000-01-01');
    },
    [STORAGE_KEY, SEEN_RELEASE_KEY],
  );
const releaseInfo = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), RELEASE_PREV_INFO_KEY);
/** 1世代の控え（前からある控え）を目印のデータで置く（うっかり初期状態に戻す前の本物のデータの代わり） */
const putOldPrevious = (page) =>
  page.evaluate(
    ([k, pk, ik]) => {
      const d = JSON.parse(localStorage.getItem(k));
      d.org.name = '本物の事業所';
      localStorage.setItem(pk, JSON.stringify(d));
      localStorage.setItem(ik, JSON.stringify({ at: 1000, reason: '初期状態に戻す' }));
    },
    [STORAGE_KEY, PREV_KEY, PREV_INFO_KEY],
  );
const prevName = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.org?.name ?? null, PREV_KEY);

async function releaseBackup() {
  const { b, page } = await askingPage();
  try {
    await page.goto(`${BASE}#/`);
    await answerFirstRun(page, { start: 'own' });
    await settle(page, 600);
    await putOldPrevious(page);
    await markOld(page);
    // 普通に開く：「デモを更新しました」の前に更新前の控えを残す（1世代の控えとは別のキー）
    await page.goto('about:blank');
    await page.goto(`${BASE}#/data`);
    await page.getByTestId('first-run').waitFor({ timeout: 30000 });
    const info = await releaseInfo(page);
    check(!!info?.release && info.release !== '2000-01-01', '普通に開いても更新前の控えを残す（更新の id つき）', info);
    check((await prevName(page)) === '本物の事業所', '開いただけでは前からある1世代の控えを上書きしない');
    check(
      /更新前の控えを自動で残しました（\d+時\d{2}分）/.test(
        await page.getByTestId('first-run-release-backup').innerText(),
      ),
      '「デモを更新しました」に自動の控えの時刻',
    );
    await page.getByTestId('first-run-submit').click();
    await page.getByTestId('first-run').waitFor({ state: 'detached', timeout: 30000 });
    const card = page.getByTestId('data-release-prev-card');
    await card.waitFor({ timeout: 10000 });
    check(
      /更新前の控え（\d+月\d+日の更新の前・\d+時\d{2}分）/.test(await card.innerText()),
      'データの画面に更新前の控え',
    );
    check(
      (await page.getByTestId('data-prev-text').innerText()).includes('『初期状態に戻す』'),
      'データの画面に直前の状態の控えも別のカードで出す',
    );
    // もう一度古くして、リンクで開く：更新の画面は出さず手順の画面だけ
    await markOld(page);
    await page.goto('about:blank');
    await page.goto(`${BASE}#/settings?apply=${SET_ID}`);
    await page.getByTestId('setting-steps').waitFor({ timeout: 30000 });
    check((await page.getByTestId('first-run').count()) === 0, 'リンク：「デモを更新しました」は出さない');
    check(
      await until(
        async () => (await page.evaluate((k) => localStorage.getItem(k), SEEN_RELEASE_KEY)) !== '2000-01-01',
        5000,
      ),
      'リンク：更新は見たことにする',
    );
    check(
      /更新前の控えを自動で残しました（\d+時\d{2}分）/.test(
        await page.getByTestId('setting-steps-backup-lead').innerText(),
      ),
      'リンク：①に自動の控えの時刻',
    );
    const rel = page.getByTestId('setting-steps-release');
    check(
      (await rel.isVisible()) && !(await rel.evaluate((e) => e.open)),
      'リンク：［変わったことを見る］は畳んで出す',
    );
    await page.getByTestId('setting-steps-release-summary').click();
    check(await rel.evaluate((e) => e.open), 'リンク：［変わったことを見る］で更新の一覧を開ける');
    check(await page.getByTestId('setting-steps-apply').isDisabled(), 'リンク：書き出すまで［適用］を押せない');
    await exportBackup(page);
    await page.getByTestId('setting-steps-apply').click();
    check(await waitStored(page, applied), 'リンク：書き出したら適用できる');
    check((await stored(page)).org.name === '更新前の事業所', 'リンク：データはそのまま（設定だけ変わる）');
    // データの画面：書き出し・この控えに戻す
    await goTo(page, '/data', { ready: '[data-testid="data-release-prev-card"]' });
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('data-release-prev-export').click(),
    ]);
    check(/-release\.json$/.test(dl.suggestedFilename()), '更新前の控えをファイルに書き出せる', dl.suggestedFilename());
    await page.getByTestId('data-release-prev-restore').click();
    await toastOf(page, '更新前の控えに戻しました').waitFor({ timeout: 10000 });
    check(await waitStored(page, before), '［この控えに戻す］で更新の前（適用の前）のデータに戻る');
    check(
      (await page.getByTestId('data-prev-text').innerText()).includes('『更新前の控えに戻す』'),
      '戻す前のデータは直前の状態の控えに回る（もう一度戻せる）',
    );
    check((await page.getByTestId('data-release-prev-card').count()) === 1, '更新前の控えは戻したあとも残る');
  } finally {
    await b.close();
  }
}

/** 更新を知らせるときに、知らない ID のリンクで開くと、いつもの更新の画面を出す（見たことにしない） */
async function unknownIdRelease() {
  const { b, page } = await askingPage();
  try {
    await page.goto(`${BASE}#/`);
    await answerFirstRun(page, { start: 'own' });
    await settle(page, 600);
    await markOld(page);
    await page.goto('about:blank');
    await page.goto(`${BASE}#/settings?apply=no-such-set`);
    await page.getByTestId('first-run').waitFor({ timeout: 30000 });
    check(true, '知らない ID：いつもの「デモを更新しました」を出す');
    check(
      (await page.evaluate((k) => localStorage.getItem(k), SEEN_RELEASE_KEY)) === '2000-01-01',
      '知らない ID：更新は見たことにしない（選ぶまで）',
    );
    check(
      (await page.getByTestId('first-run-release-backup').innerText()).includes('自動で残しました'),
      '知らない ID：更新前の控えの知らせも出す',
    );
    await page.getByTestId('first-run-submit').click();
    await toastOf(page, '設定のひな形「no-such-set」が見つかりません').waitFor({ timeout: 10000 });
    check((await page.getByTestId('setting-steps').count()) === 0, '知らない ID：手順の画面は出さない');
  } finally {
    await b.close();
  }
}

/** 更新前の控えを書けない（容量不足）とき：データ・1世代の控えはそのまま、理由を出す */
async function releaseQuota() {
  const { b, page } = await askingPage();
  try {
    await page.goto(`${BASE}#/`);
    await answerFirstRun(page, { start: 'own' });
    await settle(page, 600);
    await putOldPrevious(page);
    await markOld(page);
    const d0 = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    // 更新前の控えのキーにだけ書けない（容量超過）
    await page.addInitScript((k) => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === k) throw new DOMException('full', 'QuotaExceededError');
        return set.call(this, key, value);
      };
    }, RELEASE_PREV_KEY);
    await page.goto('about:blank');
    await page.goto(`${BASE}#/data`);
    await page.getByTestId('first-run').waitFor({ timeout: 30000 });
    check(
      (await page.getByTestId('first-run-release-backup').innerText()).includes('残せませんでした（容量不足）'),
      '容量不足：残せなかった理由を出す',
    );
    check((await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)) === d0, '容量不足：データはそのまま');
    check((await prevName(page)) === '本物の事業所', '容量不足：前からある1世代の控えは消さない');
    await page.getByTestId('first-run-submit').click();
    await page.getByTestId('data-prev-card').waitFor({ timeout: 10000 });
    check((await page.getByTestId('data-release-prev-card').count()) === 0, '容量不足：更新前の控えのカードは出さない');
  } finally {
    await b.close();
  }
}

async function noDataLink() {
  const { b, page } = await askingPage();
  try {
    await page.goto(`${BASE}#/settings?apply=${SET_ID}`);
    await page.getByTestId('first-run').waitFor({ timeout: 30000 });
    check((await page.getByTestId('setting-steps').count()) === 0, 'データの無い人：先に最初の2問');
    await page.getByTestId('first-run-start-own').check();
    await page.getByTestId('first-run-use-basic').check();
    await page.getByTestId('first-run-submit').click();
    await page.getByTestId('setting-steps').waitFor({ timeout: 30000 });
    check(
      (await page.getByTestId('setting-steps-backup-lead').innerText()).includes('作ったばかり'),
      'データの無い人：作ったばかりなので控えは求めない',
    );
    check(await page.getByTestId('setting-steps-apply').isEnabled(), 'データの無い人：すぐ［適用］を押せる');
    await page.getByTestId('setting-steps-apply').click();
    check(await waitStored(page, applied), 'データの無い人：2問のあとに適用できる');
  } finally {
    await b.close();
  }
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
    ['取り消しでは何も変えない', cancelKeeps],
    ['知らない ID は見つかりません', unknownId],
    ['勤務の終わりの何分前から', beforeEndField],
    ['更新前の控えとリンク', () => releaseBackup()],
    ['更新を知らせるときの知らない ID', () => unknownIdRelease()],
    ['更新前の控えの容量不足', () => releaseQuota()],
    ['データの無い人のリンク', () => noDataLink()],
  ],
  after: async (s) => {
    check(s.dlg.native.length === 0, 'ネイティブのダイアログを出さない', s.dlg.native);
    await s.b?.close();
  },
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
