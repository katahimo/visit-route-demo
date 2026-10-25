// 担当を組むの画面（#/arrange。ADR-0063）を本物のブラウザで確かめる：
// 見出しの下のタブ（担当を組む・組み方の標準）、範囲（月・週・日。既定は月で URL の ?ym=・?d=・?date= に書く）と
// 選んだ範囲の担当なし・要対応の件数、「AI で組む」で範囲の提案の帯が出て反映するまで訪問は変わらない・
// ［反映する］で担当が入り「元に戻す」で1手戻る・［捨てる］で何も変えない、考え方（プリセット）を選んで組むと帯にその名前、
// 組み方の標準がまだ無い日の範囲は考え方ごとの案（3つ）を並べ、［この案を標準にする］でその日に反映して標準を登録する（PRD D357）、
// 「案を比べる」で比較の画面（#/compare?date=）へ移り、比較の画面から担当を組むへ戻れる、スマホ（390px）で横にはみ出さない。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-arrange.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const path = require('node:path');
const { answerConfirms } = require('./lib/confirmDialog.cjs');
const { BASE, OUT_DIR, TODAY, STORAGE_KEY, check, hashOf, runSteps, settle } = require('./lib/env.cjs');
const { markStandard } = require('./lib/standard.cjs');
const { sharedPage, openPage } = require('./lib/steps.cjs');

const YM = TODAY.slice(0, 7);
/** 日付の曜日（0＝日曜。JST の日付として） */
const weekdayOf = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
/** その日の週の月曜 */
function mondayOf(d) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - ((weekdayOf(d) + 6) % 7));
  return t.toISOString().slice(0, 10);
}

async function open(page, hash, ready = '[data-testid="arrange-start"]') {
  await page.goto(`${BASE}#${hash}`);
  await page.reload();
  await page.locator(ready).first().waitFor({ timeout: 30000 });
  await settle(page, 300);
}
/** 保存したデータを書き換える（ホームはデータを書かないので、ホームで書き換えてから読み直す） */
async function editData(page, fn, arg) {
  await page.goto(`${BASE}#/home`);
  await page.reload();
  await page.locator('h1').waitFor();
  await page.evaluate(fn, arg);
  await page.reload();
  await page.locator('h1').waitFor();
}
/** 担当をすべて外す（繰り返しの担当・保存した訪問の担当・確定）。担当なしの日から始める */
async function clearPlans(page) {
  await editData(
    page,
    (key) => {
      const d = JSON.parse(localStorage.getItem(key));
      for (const p of d.patterns) p.usualStaffId = null;
      d.visits = d.visits.map((v) => ({ ...v, staffId: null, pinned: false }));
      d.snapshots = {};
      localStorage.setItem(key, JSON.stringify(d));
    },
    STORAGE_KEY,
  );
}
/** 保存した訪問のうち、その日の担当の入った件数（反映すると増える） */
const assignedOn = (page, date) =>
  page.evaluate(
    ({ k, d }) => JSON.parse(localStorage.getItem(k)).visits.filter((v) => v.date === d && v.staffId).length,
    { k: STORAGE_KEY, d: date },
  );
/** 標準が無い間の週・月に出る案内（「AI で組む」の欄の代わり） */
const NEED_STANDARD = '[data-testid="arrange-need-standard"]';
const rangeBand = (page) => page.locator('[data-testid="proposal-band"][data-kind="range"]');
const choiceBand = (page) => page.locator('[data-testid="proposal-band"][data-kind="choices"]');
/** 帯が出るまで待つ（組み終わるまで） */
const waitBand = (page) => rangeBand(page).waitFor({ timeout: 90000 });

// ---- 範囲：既定は月、月・週・日を選ぶと URL に書く ----
async function range(page) {
  await editData(page, (key) => localStorage.removeItem(key), STORAGE_KEY);
  await open(page, '/arrange', NEED_STANDARD);
  check((await page.locator('h1').innerText()) === '担当を組む', '見出し「担当を組む」');
  const tabs = page.getByTestId('arrange-tabs');
  check(
    (await tabs.count()) === 1 && /組み方の標準/.test(await tabs.innerText()),
    '見出しの下に予定を組むのタブ（担当を組む・組み方の標準）',
  );
  const on = await page.locator('[data-testid="arrange-scope"] button[aria-pressed="true"]').getAttribute('data-scope');
  check(on === 'month', '範囲の既定は月', on);
  const ym = await page.getByTestId('arrange-month').inputValue();
  check(/^\d{4}-\d{2}$/.test(ym) && ym >= YM, '月の既定は今月か来月', ym);
  check(
    /担当なしの訪問 \d+件（\d+日）・要対応 \d+件/.test(await page.getByTestId('arrange-counts').innerText()),
    '選んだ範囲の担当なし・要対応の件数',
    await page.getByTestId('arrange-counts').innerText(),
  );
  await page.locator('[data-testid="arrange-scope"] [data-scope="week"]').click();
  await page.waitForFunction(() => /[?&]d=/.test(location.hash));
  const wk = /d=(\d{4}-\d{2}-\d{2})/.exec(hashOf(page))?.[1] ?? '';
  check(wk !== '' && weekdayOf(wk) === 1, '週を選ぶと ?d= に週の月曜', hashOf(page));
  check(/〜.*の週/.test(await page.getByTestId('arrange-range-label').innerText()), '週の呼び名（M/D〜M/Dの週）');
  await page.locator('[data-testid="arrange-scope"] [data-scope="day"]').click();
  await page.waitForFunction(() => /[?&]date=/.test(location.hash));
  check(/^#\/arrange\?date=\d{4}-\d{2}-\d{2}$/.test(hashOf(page)), '日を選ぶと ?date=', hashOf(page));
  await open(page, `/arrange?d=${TODAY}`, NEED_STANDARD);
  check(
    (await page.locator('[data-testid="arrange-scope"] button[aria-pressed="true"]').getAttribute('data-scope')) ===
      'week' && (await page.getByTestId('arrange-date').inputValue()) === mondayOf(TODAY),
    'URL の ?d= で週を開く（その日の週の月曜）',
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'arrange-1400.png') });
}

// ---- 標準が無い間の週・月：案内の文と［日の範囲へ］だけ（「AI で組む」の欄は出さない。ADR-0064） ----
async function needStandard(page) {
  await editData(page, (key) => localStorage.removeItem(key), STORAGE_KEY);
  for (const [label, hash] of [
    ['月', `/arrange?ym=${YM}`],
    ['月（クエリ無し）', '/arrange'],
    ['週', `/arrange?d=${TODAY}`],
  ]) {
    await open(page, hash, NEED_STANDARD);
    check((await page.getByTestId('arrange-need-standard').count()) === 1, `標準が無い${label}：案内の文を出す`);
    check((await page.getByTestId('arrange-to-day').count()) === 1, `標準が無い${label}：日の範囲へ移るボタンを出す`);
    const hidden = [];
    for (const id of ['arrange-start', 'arrange-mode-care', 'arrange-mode-all', 'arrange-preset', 'arrange-count']) {
      if ((await page.getByTestId(id).count()) > 0) hidden.push(id);
    }
    check(hidden.length === 0, `標準が無い${label}：「AI で組む」の欄を出さない`, hidden);
  }
  check(
    /^\d+\/\d+を考え方ごとの案で組む$/.test((await page.getByTestId('arrange-to-day').innerText()).trim()),
    '案内のボタン「M/Dを考え方ごとの案で組む」',
    await page.getByTestId('arrange-to-day').innerText(),
  );
  await page.getByTestId('arrange-to-day').click();
  await page.waitForFunction(() => /[?&]date=/.test(location.hash));
  check(/^#\/arrange\?date=\d{4}-\d{2}-\d{2}$/.test(hashOf(page)), '［日の範囲へ］で ?date= になる', hashOf(page));
  await page.getByTestId('arrange-start').waitFor({ timeout: 30000 });
  check(
    (await choiceBand(page).count()) === 0 && (await page.getByTestId('arrange-need-standard').count()) === 0,
    '日の範囲では案内を出さず「AI で組む」（考え方ごとの案）に変わる',
  );
}

// ---- 標準が無い日の範囲：考え方ごとの案 → この案を標準にする → 元に戻す（PRD D357） ----
async function choices(page, { dlg }) {
  await clearPlans(page);
  await open(page, `/arrange?date=${TODAY}`);
  check(
    (await page.getByTestId('arrange-choices-note').count()) === 1,
    '標準が無い日の範囲：考え方ごとの案を組むと書く',
  );
  check((await page.getByTestId('arrange-preset').count()) === 0, '考え方ごとの案のときは考え方の選ぶ欄を出さない');
  check(/つの案を組む/.test(await page.getByTestId('arrange-start').innerText()), 'ボタン「3つの案を組む」');
  await page.getByTestId('arrange-start').click();
  await choiceBand(page).waitFor({ timeout: 150000 });
  const cards = choiceBand(page).getByTestId('choice-card');
  check((await cards.count()) === 3, '考え方ごとの案のタブが3つ（初期データのプリセットの数）', await cards.count());
  const pts = await choiceBand(page).getByTestId('choice-points').allInnerTexts();
  check(pts.length === 3 && pts.every((t) => /^\d+点$/.test(t)), '案ごとに点（100点満点）', pts);
  check(
    (await choiceBand(page).getByTestId('route-timeline').count()) === 1 &&
      (await choiceBand(page).getByTestId('choice-current').count()) === 1,
    '選んだ案を今日の予定と同じ時間軸で見る（今の担当のタブもある）',
  );
  // 地図も予定の画面と同じに出て、時間軸の訪問を押すとその担当のルートに絞る
  check((await choiceBand(page).getByTestId('choice-map').count()) === 1, '案の地図が出る');
  await choiceBand(page).locator('[data-testid="route-timeline"] [data-visit]').first().click();
  check(
    (await choiceBand(page).getByTestId('choice-map').getByRole('button', { name: '全員のルートを見る' }).count()) ===
      1,
    '時間軸の訪問を押すと地図をその担当に絞る（全員のルートを見るで戻せる）',
  );
  check((await assignedOn(page, TODAY)) === 0, '案が出ても、選ぶまで訪問は変わらない');
  check((await choiceBand(page).getByTestId('proposal-change').count()) > 0, '変わる訪問（誰の訪問が誰へ）の一覧');
  await page.screenshot({ path: path.join(OUT_DIR, 'arrange-choices.png') });
  // 案を比べる（その日）にも考え方ごとの案が出る（ADR-0064）
  await page.goto(`${BASE}#/compare?date=${TODAY}`);
  await page.getByTestId('compare-apply').first().waitFor({ timeout: 30000 });
  const inCompare = await page.getByTestId('compare-apply').count();
  check(inCompare === 3, '案を比べるにも考え方ごとの案が並ぶ', inCompare);
  // 予定（日）では案を重ねず、1行の知らせと「担当を組むで見る」だけ
  await page.goto(`${BASE}#/plan?date=${TODAY}`);
  await page.locator('[data-testid="proposal-band"][data-kind="choices-note"]').waitFor({ timeout: 30000 });
  check(
    (await page.getByTestId('choice-card').count()) === 0 && (await page.getByTestId('choice-open').count()) === 1,
    '予定（日）では案を重ねず、1行の知らせと「担当を組むで見る」',
  );
  await page.getByTestId('choice-open').click();
  await choiceBand(page).waitFor({ timeout: 10000 });
  const preset = await cards.nth(1).getAttribute('data-preset');
  const n = dlg.messages.length;
  await cards.nth(1).click();
  await choiceBand(page).getByTestId('choice-adopt').click();
  await choiceBand(page).waitFor({ state: 'detached', timeout: 10000 });
  check(
    /組み方の標準にしますか/.test(dlg.messages[n] ?? ''),
    '［この案を標準にする］は何が起きるかを確かめる',
    dlg.messages[n],
  );
  await page.waitForFunction(
    ({ k }) => JSON.parse(localStorage.getItem(k)).standard !== undefined,
    { k: STORAGE_KEY },
    { timeout: 10000 },
  );
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
  check(
    saved.standard?.presetId === preset && saved.scorePresetId === preset,
    '選んだ案の考え方が標準の考え方（点数の基準）になる',
    { standard: saved.standard, scorePresetId: saved.scorePresetId, preset },
  );
  check((await page.getByTestId('arrange-choices-note').count()) === 0, '標準を登録したら日の範囲もふだんの提案に戻る');
  // 全体の「元に戻す」で1手戻る（反映と標準の登録をまとめて）
  await page.getByTestId('undo-btn').click();
  await page.waitForFunction(
    ({ k }) => JSON.parse(localStorage.getItem(k)).standard === undefined,
    { k: STORAGE_KEY },
    { timeout: 10000 },
  );
  check((await assignedOn(page, TODAY)) === 0, '「元に戻す」で案を選ぶ前に戻る（標準も消える）');
}

// ---- 考え方ごとの案はすべてのプリセット（最大6つ）：プリセットを1つ足すとカードが4枚（ADR-0064） ----
async function choicesAll(page) {
  await clearPlans(page);
  await editData(
    page,
    (key) => {
      const d = JSON.parse(localStorage.getItem(key));
      d.presets.push({ ...d.presets[0], id: 'extra', name: '追加の考え方' });
      localStorage.setItem(key, JSON.stringify(d));
    },
    STORAGE_KEY,
  );
  await open(page, `/arrange?date=${TODAY}`);
  const n = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).presets.length, STORAGE_KEY);
  check(n === 4, '用意：プリセットが4つ', n);
  check(/4つの案を組む/.test(await page.getByTestId('arrange-start').innerText()), 'ボタン「4つの案を組む」');
  await page.getByTestId('arrange-start').click();
  await choiceBand(page).waitFor({ timeout: 200000 });
  const cards = choiceBand(page).getByTestId('choice-card');
  check((await cards.count()) === 4, 'プリセットの数だけ（4枚）カードが並ぶ', await cards.count());
  check(
    (await choiceBand(page).locator('[data-testid="choice-card"][data-preset="extra"]').count()) === 1,
    '足したプリセットのカードがある',
  );
  check((await assignedOn(page, TODAY)) === 0, '案が出ても、選ぶまで訪問は変わらない');
}

// ---- AI で組む → 提案の帯 → 反映 → 元に戻す ----
async function runApply(page) {
  await clearPlans(page);
  await markStandard(page);
  await open(page, `/arrange?date=${TODAY}`);
  const unassigned = Number(await page.getByTestId('arrange-unassigned').getAttribute('data-count'));
  check(unassigned > 0, '担当を外した日：担当なしの訪問の件数が出る', unassigned);
  check(/組む日：1日/.test(await page.getByTestId('arrange-count').innerText()), '日の範囲：組む日は1日');
  await page.getByTestId('arrange-start').click();
  await waitBand(page);
  check((await assignedOn(page, TODAY)) === 0, '提案が出ても、反映するまで訪問は変わらない');
  const moved = Number(await rangeBand(page).getByTestId('proposal-moved').innerText());
  check(moved > 0, '提案の帯：担当が変わる件数', moved);
  await page.screenshot({ path: path.join(OUT_DIR, 'arrange-proposal.png') });
  await rangeBand(page).getByTestId('proposal-apply').click();
  await rangeBand(page).waitFor({ state: 'detached', timeout: 10000 });
  await page.locator('.toast').filter({ hasText: '提案を反映しました' }).first().waitFor({ timeout: 10000 });
  await page.waitForFunction(
    ({ k, d }) => JSON.parse(localStorage.getItem(k)).visits.some((v) => v.date === d && v.staffId),
    { k: STORAGE_KEY, d: TODAY },
    { timeout: 10000 },
  );
  check((await assignedOn(page, TODAY)) > 0, '［反映する］で訪問に担当が入る');
  check(
    Number(await page.getByTestId('arrange-unassigned').getAttribute('data-count')) < unassigned,
    '反映すると範囲の担当なしが減る',
  );
  // 全体の「元に戻す」で1手戻る
  await page.getByTestId('undo-btn').click();
  await page.waitForFunction(
    ({ k, d }) => !JSON.parse(localStorage.getItem(k)).visits.some((v) => v.date === d && v.staffId),
    { k: STORAGE_KEY, d: TODAY },
    { timeout: 10000 },
  );
  check((await assignedOn(page, TODAY)) === 0, '「元に戻す」で反映の前に戻る');
}

// ---- 考え方（プリセット）を選んで組む・捨てる ----
async function preset(page) {
  await markStandard(page);
  await open(page, `/arrange?date=${TODAY}`);
  const select = page.getByTestId('arrange-preset');
  const options = await select.locator('option').allInnerTexts();
  check(options.length >= 2 && /^点数の基準/.test(options[0]), '考え方の選ぶ欄（既定は点数の基準）', options);
  if (options.length < 2) return;
  const value = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(value);
  const name = options[1];
  await page.getByTestId('arrange-start').click();
  await waitBand(page);
  const title = await rangeBand(page).innerText();
  check(title.includes(name), '選んだ考え方の名前が提案の帯に出る', { name, title: title.split('\n')[0] });
  await rangeBand(page).getByTestId('proposal-discard').click();
  await rangeBand(page).waitFor({ state: 'detached', timeout: 10000 });
  check((await assignedOn(page, TODAY)) === 0, '［捨てる］で訪問は変わらない');
}

// ---- 案を比べるへ移る・戻る ----
async function compare(page) {
  await markStandard(page);
  await open(page, `/arrange?ym=${YM}`);
  const date = await page.getByTestId('arrange-compare-date').inputValue();
  await page.getByTestId('arrange-compare-open').click();
  await page.waitForURL(/#\/compare/, { timeout: 10000 });
  check(hashOf(page) === `#/compare?date=${date}`, '「案を比べる」で比較の画面（その日）へ', hashOf(page));
  await page.locator('h1').filter({ hasText: '提案を比べる' }).waitFor({ timeout: 30000 });
  check((await page.getByTestId('arrange-tabs').count()) === 1, '比較の画面にも予定を組むのタブ');
  await page.getByTestId('compare-back').click();
  await page.waitForURL(/#\/arrange/, { timeout: 10000 });
  check(hashOf(page) === `#/arrange?date=${date}`, '比較の画面から担当を組む（その日）へ戻る', hashOf(page));
}

// ---- スマホ（390px）：横にはみ出さない ----
async function mobile(page) {
  await markStandard(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, `/arrange?ym=${YM}`);
  const w = await page.evaluate(() => {
    // はみ出したときに、どの要素かを添える（フォントで幅が変わるので CI だけで起きることがある）
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.right > 391 && getComputedStyle(el).position !== 'fixed';
      })
      .slice(0, 5)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 30)}[${el.getAttribute('data-testid') ?? ''}]`);
    return { width: document.documentElement.scrollWidth, wide };
  });
  check(w.width <= 390, '390px：横にはみ出さない', w);
  await page.screenshot({ path: path.join(OUT_DIR, 'arrange-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1400, height: 1000 });
}

const steps = sharedPage({
  open: async () => {
    const s = await openPage();
    // 確認は独自のダイアログで受ける（ネイティブのダイアログが出たら失敗。PRD D146）
    return { ...s, dlg: await answerConfirms(s.page) };
  },
  call: (fn, s) => fn(s.page, s),
  steps: [
    ['range', range],
    ['need-standard', needStandard],
    ['choices', choices],
    ['choices-all', choicesAll],
    ['run-apply', runApply],
    ['preset', preset],
    ['compare', compare],
    ['mobile', mobile],
  ],
  after: ({ dlg }) => check(dlg.native.length === 0, 'ブラウザのダイアログを出さない', dlg.native),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
