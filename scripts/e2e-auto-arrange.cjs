// 自動の組み（PRD D372〜D378。ADR-0072 第2段）を本物のブラウザで確かめる。初めて開いたときの最初の2問に「デモで試す・定期」で答えて得る「基本」のひな形（エキスパート機能は切）で、
// 1 予定の日の「訪問を追加」で担当を選ばずに単発の訪問を足す → 知らせ「N件の担当を組みました」と［元に戻す］が出てその訪問に担当が付く（ピンは付けない）
//   → ［元に戻す］で担当なしに戻る（訪問は残る）、
// 2 予定の「その他 ▾」：担当なしの訪問があると「担当なしの訪問を組む N件」が出て、押すと組まれて件数が減る（ホームの［組む］の代わり。PRD D383。エキスパート機能が入なら出さない）、
// 3 〈利用者さん〉の画面で担当なしの繰り返しを足す → 自動で組まれ、繰り返しの担当（usualStaffId）が書かれて行に出る
//   （組んだ回は訪問として保存され、保存の直後に別の画面へ移っても組みは続く）、
// 4 ひな形「単発のみ」を当てると〈利用者さん〉の画面の予定のタブから繰り返しの欄が消える（その入り切りの全体は e2e-features・e2e-features2）。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-auto-arrange.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const { BASE, NOW, TODAY, STORAGE_KEY, check, launch, runSteps, settle, until, watchErrors } = require('./lib/env.cjs');
const { sharedPage } = require('./lib/steps.cjs');
const { skipTour } = require('./lib/tourSeen.cjs');
const { answerIfAsked } = require('./lib/firstRun.cjs');
const { answerConfirms } = require('./lib/confirmDialog.cjs');
const { findVisit, visitsIn } = require('./lib/visits.cjs');
const { applyTemplate } = require('./lib/features.cjs');

const data = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
/** 自動の組みは Worker で解いてから書く（並列の実行・遅い環境では数秒かかる）ので、ok(d) が真になるまで最長30秒待って読む */
const WAIT_MS = 30000;
const dataWhen = async (page, ok) =>
  (await until(async () => {
    const d = await data(page);
    return ok(d) ? d : null;
  }, WAIT_MS)) ?? (await data(page));
const panel = (page) => page.getByTestId('visit-panel');
const toast = (page) => page.locator('.toast-layer .toast-text');
/** 知らせの文が出るのを待って返す（出なければ空） */
const toastText = async (page, re) => {
  const ok = await until(async () =>
    re.test(
      (await toast(page)
        .first()
        .innerText()
        .catch(() => '')) || '',
    ),
  );
  return ok ? await toast(page).first().innerText() : '';
};

/**
 * 初期データに戻して開く（初めて開いたときの最初の2問に「デモで試す・定期」で答える＝今の初期データ＋「基本」のひな形。
 * 保存データを消して読み直すと2問が出るので、答えてから行き先を開き直す）
 */
async function fresh(page, hash, ready) {
  await page.goto(`${BASE}#/data`);
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
  await page.goto(`${BASE}#${hash}`);
  await page.reload();
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

/** 1 単発の訪問を足す → 組まれる → 元に戻す */
async function single(page) {
  await fresh(page, `/plan?date=${TODAY}`, '[data-testid="plan-summary"]');
  const d0 = await data(page);
  check(d0.org.features.expert === false, '前提：初めて開くとエキスパート機能は切', d0.org.features);
  const n0 = d0.visits.length;
  await page.getByTestId('plan-visit-add').click();
  await panel(page).waitFor();
  await panel(page).getByTestId('vp-start').fill('10:00');
  await settle(page, 400);
  check(
    (await panel(page).getByTestId('vp-staff-keep').isChecked()) === true,
    '新規の欄の担当は「変えない」のまま（担当を選ばない）',
  );
  await page.getByTestId('vp-save').click();
  await panel(page).waitFor({ state: 'detached', timeout: 10000 });
  const text = await toastText(page, /件の担当を組みました/);
  check(/^\d+件の担当を組みました/.test(text) && !/^0件/.test(text), '知らせ「N件の担当を組みました」', text);
  check((await page.getByTestId('toast-undo').count()) === 1, '知らせに［元に戻す］がある');
  const d1 = await dataWhen(page, (x) => x.visits.length === n0 + 1 && x.visits.at(-1).staffId !== null);
  const v = d1.visits.at(-1);
  check(d1.visits.length === n0 + 1 && v.earliestStart === '10:00', '訪問が1件増えた', v);
  check(v.staffId !== null && v.pinned === false, '足した訪問に担当が付く（ピンは付けない）', v);
  // 元に戻す：担当なしへ（訪問は残る）
  await page.getByTestId('toast-undo').click();
  const d2 = await dataWhen(page, (x) => x.visits.find((y) => y.id === v.id)?.staffId === null);
  const back = d2.visits.find((y) => y.id === v.id);
  check(!!back && back.staffId === null, '［元に戻す］で担当なしに戻る（訪問は残る）', back);
  check(d2.visits.length === n0 + 1, '元に戻しても足した訪問は消えない', d2.visits.length);
}

/** 2 予定の「その他 ▾」：担当なしの訪問を組む（ホームの［組む］の代わり。PRD D383。1 のあとの状態から続ける） */
async function moreArrange(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.getByTestId('sched-nav').waitFor({ timeout: 60000 });
  await settle(page, 500);
  const item = page.getByTestId('more-auto-arrange');
  // 「その他 ▾」を開いて、項目の「N件」を読む（閉じる）
  const countOf = async () => {
    await page.getByTestId('month-more').click();
    await item.waitFor({ timeout: 30000 });
    const n = Number(/(\d+)件/.exec(await item.innerText().catch(() => ''))?.[1] ?? 0);
    return n;
  };
  const n0 = await countOf();
  // 初期データにも担当なしの繰り返しの回があるので、件数は「足した1件を含む N件」（N は2以上）
  check(n0 >= 2, '「その他 ▾」に「担当なしの訪問を組む N件」（元に戻した1件を含む）', n0);
  const before = await data(page);
  const target = before.visits.find((y) => y.staffId === null && !y.pinned && y.earliestStart === '10:00');
  check(!!target, '前提：元に戻した担当なしの訪問が残っている', before.visits.length);
  await item.click();
  const text = await toastText(page, /件の担当を組みました/);
  check(/^\d+件の担当を組みました/.test(text), '「担当なしの訪問を組む」を押すと知らせ「N件の担当を組みました」', text);
  const after = await dataWhen(page, (x) => x.visits.find((y) => y.id === target.id)?.staffId);
  const v = after.visits.find((y) => y.id === target.id);
  check(!!v?.staffId && v.pinned === false, '足した訪問に担当が付く（ピンは付けない）', v);
  check(hashOfPage(page).startsWith('#/month'), '月の予定のまま（画面を移らない）');
  // 組んだ分だけ減る（組めない日の訪問は担当なしのまま残るので、項目は残ってもよい。0件なら項目が消える）
  await page.keyboard.press('Escape').catch(() => {});
  await settle(page, 500);
  const n1 = await until(async () => {
    if ((await page.getByTestId('month-more').count()) === 0) return null;
    await page.getByTestId('month-more').click();
    const there = (await item.count()) > 0;
    const n = there ? Number(/(\d+)件/.exec(await item.innerText())?.[1] ?? 0) : 0;
    await page.keyboard.press('Escape');
    return n < n0 ? { n } : null;
  });
  check(n1 !== null && n1 !== undefined && n1.n < n0, '組んだあとは「担当なし」の件数が減る（0件なら項目が消える）', {
    n0,
    n1,
  });
}
const hashOfPage = (page) => new URL(page.url()).hash;

/** 3 〈利用者さん〉の画面で担当なしの繰り返しを足す → 自動で組まれ、繰り返しの担当が書かれる */
async function pattern(page) {
  await fresh(page, '/clients/c1', '[data-testid="pcal"]');
  const d0 = await data(page);
  const p0 = d0.patterns.filter((p) => p.clientId === 'c1').length;
  const staffName = (d, id) => d.staff.find((s) => s.id === id)?.displayName ?? d.staff.find((s) => s.id === id)?.name;
  await page.getByTestId('pattern-add').click();
  const form = page.getByTestId('pattern-form');
  await form.waitFor();
  await form.getByTestId('pattern-weekdays').getByRole('button', { name: '木' }).click();
  await form.getByLabel('開始', { exact: true }).fill('17:00');
  const staffSel = form.getByTestId('pattern-staff');
  const usual0 = await staffSel
    .locator('select')
    .inputValue()
    .catch(() => '');
  check(usual0 === '' || usual0 === 'none', '前提：いつもの担当は選ばない（担当なし）', usual0);
  await form.getByTestId('pattern-save').click();
  const d1 = await dataWhen(page, (x) => {
    const p = x.patterns.find((y) => y.clientId === 'c1' && y.earliestStart === '17:00');
    return !!p && p.usualStaffId !== null;
  });
  const added = d1.patterns.find((p) => p.clientId === 'c1' && p.earliestStart === '17:00');
  check(d1.patterns.filter((p) => p.clientId === 'c1').length === p0 + 1, '繰り返しが1件増えた');
  check(!!added && added.usualStaffId !== null, '自動で組まれ、繰り返しの担当（usualStaffId）が書かれる', added);
  const text = await toastText(page, /件の担当を組みました/);
  check(/^\d+件の担当を組みました/.test(text), '知らせ「N件の担当を組みました」', text);
  // 画面の表示：行の「いつもの担当」と、カレンダーの回
  const row = page.locator(`[data-testid="pattern-row"][data-pattern="${added.id}"]`);
  await row.waitFor();
  const name = staffName(d1, added.usualStaffId);
  const rowText = await row.innerText();
  check(!!name && rowText.includes(name), '繰り返しの行の「いつもの担当」に組んだ人が出る', { name, rowText });
  // 範囲（今日〜翌月末）の回に担当が付き（組めない日は担当なしのまま）、担当は繰り返しの担当に寄る
  const month = new Date(`${TODAY}T00:00:00Z`);
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
  const rows = visitsIn(d1, TODAY, end).filter((y) => y.pattern?.id === added.id);
  check(
    rows.length > 0 && rows.some((y) => y.staffId === added.usualStaffId),
    '今日〜翌月末の回に担当が付く',
    rows.length,
  );
  check(!!findVisit(d1, rows[0]?.id ?? ''), '回の訪問が見つかる（前提）');
}

/** 4 ひな形「単発のみ」を当てると繰り返しの欄が消える */
async function oneOff(page, dlg) {
  await fresh(page, '/clients/c1', '[data-testid="pcal"]');
  check((await page.getByTestId('patterns-section').count()) === 1, '前提：初めは繰り返しの欄が出る（基本）');
  await applyTemplate(page, dlg, 'oneOff');
  const d = await dataWhen(page, (x) => x.org.features.patterns === false);
  check(
    d.org.features.patterns === false && d.org.features.expert === false,
    '単発のみ：繰り返しの機能が切',
    d.org.features,
  );
  await page.goto('about:blank');
  await page.goto(`${BASE}#/clients/c1`);
  await page.getByTestId('pcal').waitFor({ timeout: 60000 });
  await settle(page, 400);
  check((await page.getByTestId('patterns-section').count()) === 0, '単発のみ：予定のタブから繰り返しの欄が消える');
  check((await page.getByTestId('pattern-add').count()) === 0, '単発のみ：「繰り返しを足す」も出ない');
}

const steps = sharedPage({
  open,
  steps: [
    ['1 単発の訪問を足すと担当が組まれ、元に戻せる', single],
    ['2 予定の「その他 ▾」の「担当なしの訪問を組む」', moreArrange],
    ['3 繰り返しを足すと組まれ、繰り返しの担当が書かれる', pattern],
    ['4 ひな形「単発のみ」で繰り返しの欄が消える', oneOff],
  ],
  call: (fn, s) => fn(s.page, s.dlg),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
