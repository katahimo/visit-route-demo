// 担当を組むの画面（#/arrange。ADR-0063・ADR-0065）を本物のブラウザで確かめる：
// 見出しの下の予定を組むのタブ（条件の重み・組み方の標準・担当を組む の作業の順）、範囲（月・週・日。既定は月で URL の
// ?ym=・?d=・?date= に書く）と選んだ範囲の担当なし・要対応の件数、組み方の標準が無い間は範囲にかかわらず「AI で組む」の欄を出さず
// ［組み方の標準を決める］で #/standard へ（PRD D356）、標準があれば月・週・日とも「AI で組む」と「考え方：〈点数の基準〉」
// （考え方の選ぶ欄は無い）、「AI で組む」で範囲の提案の帯が出て反映するまで訪問は変わらない・［反映する］で担当が入り
// 「元に戻す」で1手戻る・［捨てる］で何も変えない、「案を比べる」で比較の画面（#/compare?date=）へ移り、比較の画面から
// 担当を組むへ戻れる、スマホ（390px）で横にはみ出さない。
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
/** 標準が無い間に出る案内（「AI で組む」の欄の代わり） */
const NEED_STANDARD = '[data-testid="arrange-need-standard"]';
const rangeBand = (page) => page.locator('[data-testid="proposal-band"][data-kind="range"]');
/** 帯が出るまで待つ（組み終わるまで） */
const waitBand = (page) => rangeBand(page).waitFor({ timeout: 90000 });

// ---- 範囲：既定は月、月・週・日を選ぶと URL に書く ----
async function range(page) {
  await editData(page, (key) => localStorage.removeItem(key), STORAGE_KEY);
  await open(page, '/arrange', NEED_STANDARD);
  check((await page.locator('h1').innerText()) === '担当を組む', '見出し「担当を組む」');
  const tabs = await page
    .locator('[data-testid="arrange-tabs"] [data-tab]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-tab')));
  check(
    tabs.join(',') === 'rules,standard,arrange',
    '見出しの下に予定を組むのタブ（条件の重み・組み方の標準・担当を組む の順。ADR-0065）',
    tabs,
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

// ---- 標準が無い間：範囲にかかわらず案内の文と［組み方の標準を決める］だけ（「AI で組む」の欄は出さない。ADR-0065） ----
async function needStandard(page) {
  await editData(page, (key) => localStorage.removeItem(key), STORAGE_KEY);
  for (const [label, hash] of [
    ['月', `/arrange?ym=${YM}`],
    ['月（クエリ無し）', '/arrange'],
    ['週', `/arrange?d=${TODAY}`],
    ['日', `/arrange?date=${TODAY}`],
  ]) {
    await open(page, hash, NEED_STANDARD);
    check(
      /先に「組み方の標準」で、考え方ごとの案をくらべて標準の週を決めてください/.test(
        await page.getByTestId('arrange-need-standard').innerText(),
      ),
      `標準が無い${label}：案内の文を出す`,
    );
    check(
      (await page.getByTestId('arrange-to-standard').innerText()).trim() === '組み方の標準を決める',
      `標準が無い${label}：［組み方の標準を決める］を出す`,
    );
    const hidden = [];
    for (const id of ['arrange-start', 'arrange-mode-care', 'arrange-mode-all', 'arrange-basis', 'arrange-count']) {
      if ((await page.getByTestId(id).count()) > 0) hidden.push(id);
    }
    check(hidden.length === 0, `標準が無い${label}：「AI で組む」の欄を出さない`, hidden);
  }
  await page.getByTestId('arrange-to-standard').click();
  await page.waitForURL(/#\/standard/, { timeout: 10000 });
  check(hashOf(page) === '#/standard', '［組み方の標準を決める］で組み方の標準の画面へ', hashOf(page));
  await page.locator('h1').filter({ hasText: '組み方の標準' }).waitFor({ timeout: 30000 });
}

// ---- 標準があれば月・週・日とも「AI で組む」と「考え方：〈点数の基準〉」（選ぶ欄は無い。ADR-0065） ----
async function basis(page) {
  await editData(page, (key) => localStorage.removeItem(key), STORAGE_KEY);
  await markStandard(page);
  const name = await page.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem(k));
    return d.presets.find((p) => p.id === d.scorePresetId)?.name ?? '';
  }, STORAGE_KEY);
  for (const [label, hash] of [
    ['月', `/arrange?ym=${YM}`],
    ['週', `/arrange?d=${TODAY}`],
    ['日', `/arrange?date=${TODAY}`],
  ]) {
    await open(page, hash);
    check((await page.getByTestId('arrange-need-standard').count()) === 0, `標準がある${label}：案内を出さない`);
    const text = (await page.getByTestId('arrange-basis').innerText()).trim();
    check(name !== '' && text.startsWith(`考え方：${name}`), `標準がある${label}：「考え方：〈点数の基準〉」`, {
      name,
      text,
    });
    check((await page.getByTestId('arrange-preset').count()) === 0, `標準がある${label}：考え方の選ぶ欄は無い`);
  }
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

// ---- 組んで捨てる：帯の題は範囲の名前だけ（考え方の名前を付けない）、［捨てる］で何も変えない ----
async function discard(page) {
  await clearPlans(page);
  await markStandard(page);
  await open(page, `/arrange?date=${TODAY}`);
  await page.getByTestId('arrange-start').click();
  await waitBand(page);
  const title = (await rangeBand(page).innerText()).split('\n')[0];
  check(/^提案（\d+\/\d+・1日分）/.test(title), '提案の帯の題は「提案（M/D・1日分）」', title);
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
    ['basis', basis],
    ['run-apply', runApply],
    ['discard', discard],
    ['compare', compare],
    ['mobile', mobile],
  ],
  after: ({ dlg }) => check(dlg.native.length === 0, 'ブラウザのダイアログを出さない', dlg.native),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
