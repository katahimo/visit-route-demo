// 〈利用者さん〉の画面と繰り返しの欄のご意見の対応（PRD D459〜D463。ADR-0117）を本物のブラウザで確かめる：
// 繰り返しの欄で終わりの時刻を入れると所要（分）に映り、所要を変えると終わりが動き、開始より前の終わりは保存しない（D462）。
// 訪問の詳細の欄にも終わりの時刻。今日から直すと前の中身は「終わった繰り返し」に畳まれ、後の日から直すと今の行に
// 「M/Dまで（M/Dから変わります）」「M/Dから」の札（D459）。紹介元の相談員を入れて保存し、読むときに出る（D461）。
// 管理者設定で「〈利用者さん〉の特性」「時間の決め方」を切ると、特性の節・一覧の特性の列・時間の決め方の欄・時間の約束の欄が消える（D460・D463）
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-client-inputs.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const { TODAY, STORAGE_KEY, check, settle, until, stored, runSteps } = require('./lib/env.cjs');
const { openContext, pagePerStep } = require('./lib/steps.cjs');
const { goTo } = require('./lib/ui.cjs');

const open = (page, hash, ready) => goTo(page, hash, { ready, timeout: 30000, h1: false, settleMs: 400 });
/** 保存（localStorage へ書くのは少し後）を待って読む：ok(d) が真になるまで（最長5秒） */
const dataWhen = async (page, ok) =>
  (await until(async () => {
    const d = await stored(page);
    return ok(d) ? d : null;
  })) ?? (await stored(page));
/** d から n 日後 */
function addDays(d, n) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const toastText = (page) => page.locator('.toast-layer').innerText();

/** 機能の入り切りを書いて読み直す（patch の機能だけ変える） */
async function setFeatures(page, patch) {
  await page.evaluate(
    ([key, p]) => {
      const d = JSON.parse(localStorage.getItem(key));
      d.org.features = { ...d.org.features, ...p };
      localStorage.setItem(key, JSON.stringify(d));
    },
    [STORAGE_KEY, patch],
  );
  await page.reload();
  await settle(page, 400);
}

/** 人の画面の「詳しく ▾」を開く（無い・開いているなら何もしない） */
async function openFold(page) {
  const fold = page.getByTestId('person-details');
  if ((await fold.count()) === 0 || (await fold.evaluate((e) => e.open))) return;
  await page.getByTestId('person-details-summary').click();
}

/** 繰り返しの欄：終わりの時刻と所要（分）を相互に入れる（D462） */
async function endTime(page, dlg) {
  dlg.answer = true;
  await open(page, '/clients/c1', '[data-testid="patterns-section"]');
  const p0 = (await stored(page)).patterns.length;
  await page.getByTestId('pattern-add').click();
  const form = page.getByTestId('pattern-form');
  await form.waitFor();
  await form.getByTestId('pattern-weekdays').getByRole('button', { name: '水' }).click();
  await form.getByLabel('開始', { exact: true }).fill('07:00');
  await form.getByTestId('pattern-end').fill('08:30');
  check((await form.getByTestId('pattern-duration').inputValue()) === '90', '終わり 8:30 を入れると所要が 90分になる');
  await form.getByTestId('pattern-duration').fill('60');
  check((await form.getByTestId('pattern-end').inputValue()) === '08:00', '所要を 60分にすると終わりが 8:00 になる');
  await form.getByLabel('開始', { exact: true }).fill('07:30');
  check((await form.getByTestId('pattern-end').inputValue()) === '08:30', '開始を変えると所要を保って終わりが動く');
  await form.getByTestId('pattern-end').fill('07:00');
  check(
    (await form.innerText()).includes('終わりは開始より後の時刻にしてください'),
    '開始より前の終わりは欄の下に誤りを出す',
  );
  await form.getByTestId('pattern-save').click();
  await settle(page, 300);
  check(
    (await stored(page)).patterns.length === p0 && (await form.count()) === 1,
    '開始より前の終わりのままでは保存しない',
  );
  await form.getByTestId('pattern-end').fill('09:00');
  await form.getByTestId('pattern-save').click();
  const d = await dataWhen(page, (x) => x.patterns.length === p0 + 1);
  const added = d.patterns.find((p) => p.clientId === 'c1' && p.earliestStart === '07:30');
  check(
    added?.durationMinutes === 90,
    '終わり 9:00 で保存すると所要 90分の繰り返しになる（データは所要のまま）',
    added,
  );

  // 訪問の詳細の欄にも終わりの時刻（開始＋所要）
  // 足した繰り返しの回（今日以降）を開く
  await page.locator(`[data-testid="pcal-visit"][data-visit$="_${added?.id}"]`).first().click();
  const panel = page.getByTestId('visit-panel');
  await panel.waitFor();
  const start = await panel.getByTestId('vp-start').inputValue();
  const minutes = Number(await panel.getByTestId('vp-duration').inputValue());
  const [h, m] = start.split(':').map(Number);
  const end = h * 60 + m + minutes;
  const want = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  check((await panel.getByTestId('vp-end').inputValue()) === want, '訪問の詳細の欄に終わりの時刻（開始＋所要）', want);
  await page.keyboard.press('Escape');
}

/** 直した繰り返しの見え方（D459）：今日から直すと前の中身は畳み、後の日から直すと札で見分ける */
async function splitList(page, dlg) {
  dlg.answer = true;
  await open(page, '/clients/c1', '[data-testid="patterns-section"]');
  const before = await stored(page);
  const orig = before.patterns.find((p) => p.clientId === 'c1' && p.from < TODAY && (p.to === null || p.to >= TODAY));
  check(!!orig, '前提：c1 に今日より前から続く繰り返しがある');
  if (!orig) return;
  const endedCount = async () =>
    (await page.getByTestId('pattern-ended').count()) === 0 ? 0 : await page.getByTestId('pattern-ended-row').count();
  const ended0 = await endedCount();

  // 後の日（1週間後）から直す：前は今の一覧に「M/Dまで（M/Dから変わります）」、後ろは「M/Dから」
  const since = addDays(TODAY, 7);
  const form = page.getByTestId('pattern-form');
  await page.locator(`[data-testid="pattern-row"][data-pattern="${orig.id}"]`).getByTestId('pattern-edit').click();
  await form.waitFor();
  await form.getByLabel('いつから変えますか').fill(since);
  await form.getByTestId('pattern-duration').fill(String(orig.durationMinutes + 15));
  await form.getByTestId('pattern-save').click();
  let d = await dataWhen(page, (x) => x.patterns.length === before.patterns.length + 1);
  const next = d.patterns.find((p) => p.clientId === 'c1' && p.from === since);
  check(!!next, '後の日から直すと、その日からの繰り返しに分かれる');
  check((await toastText(page)).includes(`${md(since)}から変わります`), '直したあとの知らせで、その日から変わると言う');
  const phase = async (id) =>
    (await page.locator(`[data-testid="pattern-row"][data-pattern="${id}"] [data-testid="pattern-phase"]`).count()) ===
    0
      ? ''
      : await page
          .locator(`[data-testid="pattern-row"][data-pattern="${id}"] [data-testid="pattern-phase"]`)
          .innerText();
  check(
    (await phase(orig.id)) === `${md(addDays(since, -1))}まで（${md(since)}から変わります）`,
    '前の中身の行に「M/Dまで（M/Dから変わります）」の札',
    await phase(orig.id),
  );
  check((await phase(next?.id)) === `${md(since)}から`, '後ろの行に「M/Dから」の札', await phase(next?.id));

  // 今日から直す：前の中身は「終わった繰り返し」に畳まれ、今の一覧に残らない
  const before2 = d;
  await page.locator(`[data-testid="pattern-row"][data-pattern="${orig.id}"]`).getByTestId('pattern-edit').click();
  await form.waitFor();
  await form.getByTestId('pattern-duration').fill(String(orig.durationMinutes + 30));
  await form.getByTestId('pattern-save').click();
  d = await dataWhen(page, (x) => x.patterns.length === before2.patterns.length + 1);
  await settle(page, 300);
  check(
    (await page.locator(`[data-testid="pattern-row"][data-pattern="${orig.id}"]`).count()) === 0 &&
      (await endedCount()) === ended0 + 1,
    '今日から直すと、前の中身は今の一覧から外れ「終わった繰り返し」に1件増える（消さない）',
  );
  check(
    d.patterns.some((p) => p.id === orig.id && p.to === addDays(TODAY, -1)),
    '前の中身は昨日で終わる繰り返しとして残る（今日より前の回の記録）',
  );
  check(
    (await toastText(page)).includes('「終わった繰り返し」に残します'),
    '直したあとの知らせで、前の中身の行き先を言う',
  );
}

/** 紹介元の相談員を入れて保存し、読むときに出る（D461） */
async function referrerPerson(page, dlg) {
  dlg.answer = true;
  await open(page, '/clients/c1', '[data-testid="person-view"]');
  await setFeatures(page, { clientStage: true });
  await open(page, '/clients/c1?tab=basic', '[data-testid="person-sec"]');
  await openFold(page);
  const sec = page.locator('[data-testid="person-sec"][data-section="stage"]');
  await sec.getByTestId('sec-edit').click();
  await page.getByTestId('client-referrer-person').fill(' 青葉（架空） ');
  await sec.getByTestId('sec-save').click();
  await sec.getByTestId('sec-edit').waitFor({ timeout: 5000 });
  const d = await dataWhen(page, (x) => x.clients.find((c) => c.id === 'c1')?.referrer.person === '青葉（架空）');
  check(
    d.clients.find((c) => c.id === 'c1')?.referrer.person === '青葉（架空）',
    '紹介元の相談員を入れて保存すると、前後の空白を落として残る',
  );
  const text = await sec.innerText();
  check(text.includes('相談員') && text.includes('青葉（架空）'), '段階と紹介元の節に「相談員」で出る');
}

/** 管理者設定で特性・時間の決め方を切ると欄が消える（D460・D463） */
async function toggles(page, dlg) {
  dlg.answer = true;
  await open(page, '/clients/c1?tab=basic', '[data-testid="person-sec"]');
  await openFold(page);
  const traits = page.locator('[data-testid="person-sec"][data-section="traits"]');
  check((await traits.count()) === 1, '既定（入）では特性の節が出る');

  // 管理者設定のスイッチで特性を切る（入れた特性があるので確認が出る）
  await open(page, '/settings', '[data-testid="feature-switches"]');
  dlg.messages.length = 0;
  await page.locator('[data-feature="clientTraits"] [data-testid="feature-switch"]').click();
  let d = await dataWhen(page, (x) => x.org.features.clientTraits === false);
  check(d.org.features.clientTraits === false, '管理者設定で「〈利用者さん〉の特性」を切れる');
  check(
    dlg.messages.some((m) => m.includes('特性') && m.includes('残り')),
    '入れた特性があるときは、残って効き続けると確かめる',
    dlg.messages,
  );
  await page.locator('[data-feature="timeWindow"] [data-testid="feature-switch"]').click();
  d = await dataWhen(page, (x) => x.org.features.timeWindow === false);
  check(d.org.features.timeWindow === false, '管理者設定で「時間の決め方」を切れる');

  await open(page, '/clients/c1?tab=basic', '[data-testid="person-sec"]');
  await openFold(page);
  check((await traits.count()) === 0, '特性を切ると〈利用者さん〉の画面の特性の節が出ない');
  check(
    (await stored(page)).clients.some((c) => Object.keys(c.traits).length > 0),
    '特性を切っても入れた特性は消さない',
  );

  // 繰り返しの欄：時間の決め方を出さず、ちょうどで入れる
  await open(page, '/clients/c1', '[data-testid="patterns-section"]');
  await page.getByTestId('pattern-add').click();
  const form = page.getByTestId('pattern-form');
  await form.waitFor();
  check((await form.getByTestId('pattern-window').count()) === 0, '時間の決め方を切ると繰り返しの欄に出ない');
  check((await form.getByTestId('pattern-end').count()) === 1, '終わりの時刻の欄は出る');
  await form.getByTestId('pattern-cancel').click();
  // 訪問の詳細の欄：時間の約束を出さない（ちょうどの訪問）
  const d2 = await stored(page);
  const fixedPattern = d2.patterns.find((p) => p.clientId === 'c1' && p.windowKind === 'fixed');
  const fixedVisit = fixedPattern
    ? page.locator(`[data-testid="pcal-visit"][data-visit$="_${fixedPattern.id}"]`).first()
    : null;
  if (fixedVisit && (await fixedVisit.count()) === 1) {
    await fixedVisit.click();
    const panel = page.getByTestId('visit-panel');
    await panel.waitFor();
    check(
      (await panel.getByTestId('vp-window').count()) === 0,
      '時間の決め方を切ると訪問の詳細の欄の時間の約束が出ない',
    );
    await page.keyboard.press('Escape');
  }
  // 幅の繰り返し・訪問を直す欄：「ちょうど」に変えても時間の決め方の欄は消えない（開いたときの値で出す）
  // 初期データに幅の繰り返しが無いので、c1 の続いている繰り返しを1つ幅（開始（早）から30分）にして読み直す
  const base = d2.patterns.find((p) => p.clientId === 'c1' && p.to === null && p.dayTimes.length === 0);
  check(!!base, 'c1 に続いている繰り返しがある');
  if (!base) return;
  const [h, m] = base.earliestStart.split(':').map(Number);
  const late = `${String(h + (m + 30 >= 60 ? 1 : 0)).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`;
  const winPattern = { ...base, windowKind: 'window', latestStart: late };
  const withWindow = { ...d2, patterns: d2.patterns.map((p) => (p.id === base.id ? winPattern : p)) };
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify(withWindow)]);
  await page.reload();
  await open(page, `/clients/${winPattern.clientId}`, '[data-testid="patterns-section"]');
  await page
    .locator(`[data-testid="pattern-row"][data-pattern="${winPattern.id}"]`)
    .getByTestId('pattern-edit')
    .click();
  const wform = page.getByTestId('pattern-form');
  await wform.waitFor();
  await wform.getByTestId('pattern-window').selectOption('fixed');
  check(
    (await wform.getByTestId('pattern-window').count()) === 1,
    '時間の決め方を切っても、幅の繰り返しをちょうどに変えた途端に欄が消えない（戻せる）',
  );
  await wform.getByTestId('pattern-window').selectOption('window');
  await wform.getByTestId('pattern-cancel').click();
  // 今日以降の回（今日より前の回は日時を直せない）
  const ids = await page
    .locator(`[data-testid="pcal-visit"][data-visit$="_${winPattern.id}"]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-visit')));
  const futureId = ids.find((id) => id && id.slice(0, 10) >= TODAY);
  const winVisit = page.locator(`[data-testid="pcal-visit"][data-visit="${futureId}"]`).first();
  check(!!futureId, '幅にした繰り返しの今日以降の回が〈利用者さん〉の予定に出る', ids);
  if (futureId) {
    await winVisit.click();
    const panel = page.getByTestId('visit-panel');
    await panel.waitFor();
    check((await panel.getByTestId('vp-window').count()) === 1, '幅の訪問の詳細の欄には時間の約束が出る');
    await panel.getByTestId('vp-window').selectOption('fixed');
    check(
      (await panel.getByTestId('vp-window').count()) === 1,
      '時間の決め方を切っても、幅の訪問をちょうどに変えた途端に時間の約束の欄が消えない',
    );
    await panel.getByTestId('vp-window').selectOption('window');
    await page.keyboard.press('Escape');
  }
}

const steps = pagePerStep({
  open: (browser) => openContext(browser, { viewport: { width: 1440, height: 900 } }),
  call: (fn, s) => fn(s.page, s.dlg),
  steps: [endTime, splitList, referrerPerson, toggles],
  label: (name) => `${name}：途中で止まった`,
  after: (name, { dlg }) => check(dlg.native.length === 0, `${name}：ブラウザのダイアログを出さない`, dlg.native),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
