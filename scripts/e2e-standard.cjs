// 組み方の標準（PRD D350〜D354・D359・D361〜D364。ADR-0063・ADR-0065〜ADR-0067）：#/standard を開くと予定を組むの段（基本情報・案をくらべる・
// 標準にする・担当を組む の4段。組み方の標準は 2 案をくらべる・3 標準にする（表で直す（下書き）と登録）を1段ずつ出し、［戻る］［次へ］で動く。
// 2 に条件の重みへの寄り道、2 の［戻る］は基本情報へ）・案をくらべる（カード・王冠・点・偏り・今の標準と違うマス）・表で見る（違うマスに「変更」）・
// 日で見る（日付と案のタブ・点・王冠・担当ごとの時間軸・地図・変わる訪問の印。読み取り専用）・この案から作る・ほかの画面へ移っても下書きと案が残る・
// マスを直す（範囲外の時刻は受け付けない・Esc で閉じてフォーカスはマス）・違う所の数・390px で横にはみ出さない・
// 標準にする（入れ替えるが既定・確認・完了の表示と週の予定へのリンク・点数の基準が案のプリセット）・登録後は今の標準と同じ。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-standard.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
const path = require('node:path');
const { BASE, OUT_DIR, STORAGE_KEY, check, hashOf, runSteps, settle } = require('./lib/env.cjs');
const { sharedPage } = require('./lib/steps.cjs');

/** 段の画面へ移る（段の見出しの下の段のリンク。今の段は押せないのでそのまま） */
async function goStep(page, key) {
  const link = page.locator(`[data-testid="arrange-steps"] li[data-step="${key}"] a`);
  if ((await link.count()) > 0) await link.click();
  await page.waitForFunction((k) => document.querySelector('[data-testid="standard-steps"]')?.dataset.step === k, key);
  await settle(page, 300);
}
/** 今の段の見出しにフォーカスがあるか（段が替わると見出しへ移る。ADR-0066・ADR-0067） */
const headFocused = (page) =>
  page.evaluate(() => document.activeElement === document.querySelector('[data-testid="standard-steps"] > li h2'));
/** 今の段（standard-steps の data-step） */
const stepNow = (page) => page.getByTestId('standard-steps').getAttribute('data-step');
/** ［次へ］を押して段を進める */
async function nextStep(page, key) {
  await page.getByTestId('standard-next').click();
  await page.waitForFunction((k) => document.querySelector('[data-testid="standard-steps"]')?.dataset.step === k, key);
  await settle(page, 300);
}

const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), STORAGE_KEY);

async function confirm(page) {
  await page.getByTestId('confirm-ok').click();
  await page.getByTestId('confirm-dialog').waitFor({ state: 'detached' });
  await settle(page, 300);
}
/** 「今の標準と違う所 N か所」の N */
async function diffCount(page) {
  const t = await page.getByTestId('standard-diff-count').innerText();
  return Number(/(\d+)/.exec(t)?.[1] ?? Number.NaN);
}
const changedCells = (page, table) =>
  page.locator(`[data-testid="${table}"] [data-testid="standard-cell"][data-changed="true"]`).count();

/** 選んだ案（2つ目のカード） */
const picked = { id: null, name: null };

const steps = sharedPage({
  steps: [
    [
      'open-and-tabs',
      async (page) => {
        // 初期データ（標準を登録していない）
        await page.goto(`${BASE}#/home`);
        await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
        await page.goto(`${BASE}#/standard`);
        await page.reload();
        await page.getByTestId('standard-steps').waitFor({ timeout: 30000 });
        await settle(page, 300);
        check(hashOf(page).startsWith('#/standard'), '#/standard を開く', hashOf(page));
        const nav = page.getByTestId('arrange-steps');
        check(
          (await nav.count()) === 1 && (await page.getByTestId('arrange-tabs').count()) === 0,
          '予定を組むの段がある（タブは無い）',
        );
        const order = await nav.locator('li').evaluateAll((els) => els.map((el) => el.getAttribute('data-step')));
        check(
          order.join(',') === 'basics,proposals,register,arrange',
          '予定を組むの段は 基本情報・案をくらべる・標準にする・担当を組む の順（ADR-0067）',
          order,
        );
        const cur = nav.locator('span.arrange-step[aria-current="step"]');
        check(
          (await cur.count()) === 1 && (await cur.innerText()).includes('案をくらべる'),
          '下書きが無い・登録していないので今の段は「案をくらべる」（2）',
          (await cur.count()) ? await cur.innerText() : '',
        );
        check(
          (await nav.locator('a.arrange-step').count()) === 3,
          '今の段以外は a のリンク（3つ）',
          await nav.locator('a.arrange-step').count(),
        );
        check((await stepNow(page)) === 'proposals', '段の入れ物の data-step は proposals');
        check(
          (await page.getByTestId('standard-steps').locator(':scope > li').count()) === 1 &&
            (await page.locator('[data-testid="standard-steps"] [data-step="proposals"]').count()) === 1,
          '段は1つだけ出す（標準にするは出さない）',
        );
        check(
          (await page.locator('[data-testid="standard-steps"] h2').innerText()).trim() === '2. 案をくらべる',
          '段の見出しは「2. 案をくらべる」',
        );
        const back = page.getByTestId('standard-back');
        check(
          (await back.innerText()).trim() === '戻る：基本情報' && (await back.getAttribute('href')) === '#/basics',
          '2 の［戻る］は基本情報へのリンク（文字「戻る：基本情報」）',
        );
        check(
          (await page.getByTestId('standard-next').innerText()).includes('次へ：標準にする'),
          '2 に［次へ：標準にする］がある',
        );
        check(
          (await page.locator('[data-testid="standard-rules-link"] a').count()) === 1,
          '2 に条件の重みへのリンク（rules が入のとき）',
        );
        // 下書きも登録も無いときの 3 は、下書きの欄（今の標準から作る）と登録の案内だけ
        await goStep(page, 'register');
        check(
          (await page.locator('[data-testid="standard-steps"] h2').innerText()).trim() === '3. 標準にする',
          '段の見出しは「3. 標準にする」',
        );
        const parts = await page
          .locator('[data-testid="standard-steps"] [data-step="register"] > section[data-step-part]')
          .evaluateAll((els) => els.map((el) => `${el.dataset.stepPart}:${el.querySelector('h3')?.textContent}`));
        check(
          parts.join('|') === 'draft:表で直す（下書き）|register:標準にする',
          '3 は下書きの表（表で直す（下書き））と登録（標準にする）が並ぶ',
          parts,
        );
        check(
          (await page.getByTestId('standard-from-current').count()) === 1 &&
            (await page.getByTestId('standard-register-empty').count()) === 1 &&
            (await page.getByTestId('standard-register').count()) === 0,
          '下書きも登録も無い「標準にする」の段には［今の標準から作る］と案内だけ（標準にするボタンは出さない）',
        );
        check(
          (await page.locator('.standard-page .btn-primary').count()) === 0,
          '下書きも登録も無い 3 では主ボタンを出さない（［次へ：担当を組む］も塗らない）',
        );
        check(await headFocused(page), '段を移ると、その段の見出しにフォーカス');
        check((await page.getByTestId('standard-back').innerText()).trim() === '戻る', '3 に［戻る］（2 へ）');
        await goStep(page, 'proposals');
        check(
          (await page.getByTestId('standard-now').innerText()).includes('まだ標準を登録していません'),
          '今の標準：まだ登録していない',
        );
        const period = await page.getByTestId('standard-period').innerText();
        check(/\d+\/\d+〜\d+\/\d+（\d週/.test(period), '案を作る期間の文（M/D〜M/D（N週。理由））', period);
        check((await page.getByTestId('standard-card').count()) >= 3, 'プリセットごとのカード（3つ以上）');
        check((await page.getByTestId('standard-table').count()) === 0, 'はじめは下書きが無い');
        check(
          (await page.getByTestId('standard-from-current').count()) === 0,
          '［今の標準から作る］は「3. 標準にする」の段にある（2 には出さない）',
        );
        check(
          (await page.locator('.btn-primary').count()) === 1 &&
            (await page.getByTestId('standard-run').getAttribute('class')).includes('btn-primary'),
          '主ボタンは「案を作る」の1つ',
        );
      },
    ],
    [
      'run-proposals',
      async (page) => {
        const run = page.getByTestId('standard-run');
        check(/^\d+つの考え方で案を作る$/.test((await run.innerText()).trim()), '主ボタン「N つの考え方で案を作る」');
        await run.click();
        await page.getByTestId('standard-progress').waitFor({ timeout: 10000 });
        const cards = await page.getByTestId('standard-card').count();
        await page.waitForFunction(
          (n) =>
            document.querySelectorAll('[data-testid="standard-use"]').length === n &&
            !document.querySelector('[data-testid="standard-progress"]'),
          cards,
          { timeout: 5 * 60 * 1000 },
        );
        await settle(page, 300);
        check((await page.getByTestId('standard-crown').count()) === 1, '王冠は1つ（いちばん点の高いカード）');
        const pts = await page.getByTestId('standard-points').allInnerTexts();
        check(pts.length === cards && pts.every((p) => /^\d+$/.test(p.trim())), 'どのカードにも点', pts);
        check((await page.getByTestId('standard-spread').count()) === cards, 'どのカードにも件数の偏り');
        const diffs = await page.getByTestId('standard-card-diff').allInnerTexts();
        check(
          diffs.length === cards && diffs.every((t) => /^\d+マス（担当 \d+・時刻だけ \d+）$/.test(t.trim())),
          'どのカードにも今の標準と違うマスの数',
          diffs,
        );
        const d = await stored(page);
        check(!d?.standard, '案を作っても標準・予定は書かない', d?.standard);
        await page.screenshot({ path: path.join(OUT_DIR, 'standard-cards.png'), fullPage: true });
        // 案ができても下書きが無いうちは 2 のまま（次へも主ボタンにしない）
        check((await stepNow(page)) === 'proposals', '案を作っても段は 2（案をくらべる）のまま');
      },
    ],
    [
      'view-table',
      async (page) => {
        const card = page.getByTestId('standard-card').first();
        const n = Number(/(\d+)/.exec(await card.getByTestId('standard-card-diff').innerText())?.[1]);
        const view = card.getByTestId('standard-view');
        await view.click();
        await page.getByTestId('standard-view-table').waitFor();
        check((await view.getAttribute('aria-expanded')) === 'true', '［表で見る］は aria-expanded=true');
        const changed = page.locator('[data-testid="standard-view-table"] [data-changed="true"]');
        check((await changed.count()) === n, '表の違うマスの数はカードの数と同じ', {
          card: n,
          got: await changed.count(),
        });
        if (n > 0) check((await changed.first().innerText()).includes('変更'), '違うマスに「変更」の文字');
        check(
          (await page.locator('[data-testid="standard-view-table"] button').count()) === 0,
          '案の表は読み取り専用（押せるマスが無い）',
        );
        await view.click();
        await settle(page, 200);
        check((await page.getByTestId('standard-view-table').count()) === 0, 'もう一度押すと閉じる');
      },
    ],
    [
      'day-view',
      async (page) => {
        const view = page.getByTestId('standard-day-view');
        const cards = await page.getByTestId('standard-card').count();
        check((await view.count()) === 1, '案を作ると「日で見る」の欄が出る');
        const dates = view.getByTestId('standard-day-tabs').locator('[role="tab"]');
        const nDates = await dates.count();
        check(nDates >= 1, '日付のタブ（期間の訪問のある日）', nDates);
        check(
          (await dates.first().getAttribute('aria-selected')) === 'true' &&
            /^\d+\/\d+（.）$/.test((await dates.first().innerText()).trim()),
          '既定は最初の日（「M/D（曜）」）',
          await dates.first().innerText(),
        );
        // 標準を登録する前は「今の標準」のタブも担当が変わる件数も出さず、案どうしだけをくらべる（ADR-0065）
        check(
          (await view.getByTestId('standard-day-current').count()) === 0 &&
            (await view.getByTestId('standard-day-lead').innerText()).includes('標準はまだ登録していない'),
          '登録前は「今の標準」のタブが無く、案どうしをくらべる旨の文',
        );
        const choices = view.getByTestId('standard-day-choice');
        check((await choices.count()) === cards, '案のタブはカードの数だけ', await choices.count());
        check(
          !(await view.getByTestId('standard-day-tabs').locator('..').innerText()).includes('担当が変わる'),
          '登録前は案のタブに担当が変わる件数を出さない',
        );
        const pts = await view.getByTestId('choice-points').allInnerTexts();
        check(pts.length === cards && pts.every((t) => /^\d+点$/.test(t.trim())), 'タブごとに点（100点満点）', pts);
        check((await view.getByTestId('standard-day-crown').count()) === 1, 'いちばん点の高い案のタブに王冠');
        check(
          (await view.getByTestId('route-timeline').count()) === 1 &&
            (await view.getByTestId('standard-day-map').count()) === 1,
          '選んだ案を担当ごとの時間軸と地図で見る',
        );
        // カードの［日で見る］で、その案のタブで開く
        const second = page.getByTestId('standard-card').nth(1);
        const id = await second.getAttribute('data-preset');
        await second.getByTestId('standard-day').click();
        await settle(page, 400);
        check(
          (await view
            .locator(`[data-testid="standard-day-choice"][data-preset="${id}"]`)
            .getAttribute('aria-selected')) === 'true',
          '［日で見る］でその案のタブを開く',
        );
        check((await view.getByTestId('choice-mark').count()) === 0, '登録前は変わる訪問の印が無い');
        // 時間軸の訪問を押すと地図をその担当に絞る
        await view.locator('[data-testid="route-timeline"] [data-visit]').first().click();
        check(
          (await view.getByTestId('standard-day-map').getByRole('button', { name: '全員のルートを見る' }).count()) ===
            1,
          '時間軸の訪問を押すと地図をその担当に絞る（全員のルートを見るで戻せる）',
        );
        await page.screenshot({ path: path.join(OUT_DIR, 'standard-day-view.png'), fullPage: true });
        // 日付を替える
        if (nDates > 1) {
          await dates.nth(1).click();
          await settle(page, 300);
          check((await dates.nth(1).getAttribute('aria-selected')) === 'true', '日付のタブで日を替える');
        }
        check(
          (await view.locator('[data-testid="route-timeline"] [draggable="true"]').count()) === 0,
          '札は動かさない',
        );
        const d = await stored(page);
        check(!d?.standard, '日で見ても標準・予定は書かない', d?.standard);
      },
    ],
    [
      'use-proposal',
      async (page) => {
        const card = page.getByTestId('standard-card').nth(1);
        picked.id = await card.getAttribute('data-preset');
        picked.name = (await card.locator('h3').innerText()).trim();
        const n = Number(/(\d+)/.exec(await card.getByTestId('standard-card-diff').innerText())?.[1]);
        await card.getByTestId('standard-use').click();
        await page.getByTestId('standard-table').waitFor();
        await settle(page, 300);
        check((await stepNow(page)) === 'register', '［この案から作る］で「標準にする」の段へ移る');
        check(await headFocused(page), '［この案から作る］のあと、「3. 標準にする」の見出しにフォーカス');
        check(
          (await page.getByTestId('standard-card').count()) === 0 &&
            (await page.getByTestId('standard-run').count()) === 0,
          '「標準にする」の段には案のカードを出さない',
        );
        check(
          (await page.getByTestId('standard-back').innerText()).trim() === '戻る' &&
            (await page.getByTestId('standard-next').innerText()).includes('次へ：担当を組む'),
          '3 に［戻る］と［次へ：担当を組む］',
        );
        const partOrder = await page
          .locator('[data-testid="standard-steps"] [data-step="register"] > section[data-step-part]')
          .evaluateAll((els) => els.map((el) => el.dataset.stepPart));
        check(partOrder.join(',') === 'draft,register', '下書きがあれば 下書きの表 → 登録 の順', partOrder);
        check(
          (await page.getByTestId('standard-draft-from').innerText()).includes(picked.name),
          '下書きは選んだ案から作った',
          await page.getByTestId('standard-draft-from').innerText(),
        );
        check((await diffCount(page)) === n, '違う所の数は案のカードと同じ', { card: n, got: await diffCount(page) });
        check((await changedCells(page, 'standard-table')) === n, '下書きの違うマスの数');
        check(
          (await page.locator('.btn-primary').count()) === 1 &&
            (await page.getByTestId('standard-register').getAttribute('class')).includes('btn-primary'),
          '主ボタンは画面に1つ（この表を標準にする）',
        );
        // 下書きがあるときの［この案から作る］は確認してから置き換える（2 の段へ戻って押す）
        await page.getByTestId('standard-back').click();
        await page.getByTestId('standard-card').first().waitFor();
        check((await stepNow(page)) === 'proposals', '［戻る］で 2 に戻る');
        await settle(page, 200);
        check(await headFocused(page), '［戻る］のあと、「2. 案をくらべる」の見出しにフォーカス');
        await page.getByTestId('standard-card').first().getByTestId('standard-use').click();
        await page.getByTestId('confirm-dialog').waitFor();
        check((await page.getByTestId('confirm-title').innerText()).includes('置き換えますか'), '置き換える前に確認');
        await page.getByTestId('confirm-cancel').click();
        await page.getByTestId('confirm-dialog').waitFor({ state: 'detached' });
        await nextStep(page, 'register');
        check(
          (await page.getByTestId('standard-draft-from').innerText()).includes(picked.name),
          '取り消すと下書きはそのまま',
        );
      },
    ],
    [
      'keep-across-pages',
      async (page) => {
        const before = await diffCount(page);
        await page.goto(`${BASE}#/home`);
        await page.locator('h1').first().waitFor();
        await settle(page, 300);
        await page.goto(`${BASE}#/standard`);
        await page.getByTestId('standard-steps').waitFor();
        await settle(page, 300);
        check(
          (await stepNow(page)) === 'register',
          'ほかの画面へ移って戻っても段は「標準にする」のまま（下書きがあれば開くのは標準にする。読み直すと戻る）',
        );
        check((await page.getByTestId('standard-table').count()) === 1, 'ほかの画面へ移って戻っても下書きが残る');
        check((await diffCount(page)) === before, '下書きの違う所の数も同じ');
        await goStep(page, 'proposals');
        check(
          (await page.getByTestId('standard-use').count()) === (await page.getByTestId('standard-card').count()) &&
            (await page.getByTestId('standard-card').count()) >= 3,
          '案も残る（2 の段で見る）',
        );
        await goStep(page, 'register');
      },
    ],
    [
      'edit-cell',
      async (page) => {
        const cell = page.locator('[data-testid="standard-table"] [data-testid="standard-cell"]').first();
        const pid = await cell.getAttribute('data-pattern');
        const wd = await cell.getAttribute('data-weekday');
        const sel = `[data-testid="standard-table"] [data-testid="standard-cell"][data-pattern="${pid}"][data-weekday="${wd}"]`;
        const btn = page.locator(`${sel} button`);
        await btn.click();
        const editor = page.getByTestId('standard-editor');
        await editor.waitFor();
        check(
          await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'standard-editor-staff'),
          '欄を開くとフォーカスは担当',
        );
        // 今と違う担当を選ぶ
        const staffSel = page.getByTestId('standard-editor-staff');
        const now = await staffSel.inputValue();
        const values = await staffSel.locator('option').evaluateAll((os) => os.map((o) => o.value));
        check(values.includes(''), '担当の選びに「担当なし」がある');
        const next = values.find((v) => v !== now && v !== '') ?? '';
        await staffSel.selectOption(next);
        const nextName = (await staffSel.locator(`option[value="${next}"]`).innerText()).trim();
        // 時間の約束の外は受け付けない
        await page.getByTestId('standard-editor-start').fill('23:50');
        await page.getByTestId('standard-editor-ok').click();
        await settle(page, 200);
        check((await page.getByTestId('standard-editor-error').count()) === 1, '範囲外の時刻は文を出す');
        check((await editor.count()) === 1, '範囲外の時刻では閉じない');
        await page.getByTestId('standard-editor-start').fill('');
        await page.getByTestId('standard-editor-ok').click();
        await editor.waitFor({ state: 'detached' });
        await settle(page, 200);
        check((await page.locator(sel).innerText()).includes(nextName), '決めるとマスが選んだ担当になる', {
          want: nextName,
          got: await page.locator(sel).innerText(),
        });
        check(
          await page.evaluate((s) => document.activeElement === document.querySelector(`${s} button`), sel),
          '閉じるとフォーカスはマス',
        );
        check(
          (await diffCount(page)) === (await changedCells(page, 'standard-table')),
          '違う所の数は色の付いたマスの数と同じ',
          { count: await diffCount(page), cells: await changedCells(page, 'standard-table') },
        );
        const changed = page.locator('[data-testid="standard-table"] [data-changed="true"]');
        if ((await changed.count()) > 0)
          check((await changed.first().innerText()).includes('変更'), '違うマスに「変更」の文字');
        // Esc で閉じる（何も変えない）
        const before = await diffCount(page);
        await btn.click();
        await editor.waitFor();
        await page.keyboard.press('Escape');
        await editor.waitFor({ state: 'detached' });
        await settle(page, 200);
        check(
          await page.evaluate((s) => document.activeElement === document.querySelector(`${s} button`), sel),
          'Esc で閉じてフォーカスはマス',
        );
        check((await diffCount(page)) === before, 'Esc では変えない');
      },
    ],
    [
      'narrow',
      async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await settle(page, 400);
        const w = await page.evaluate(() => document.documentElement.scrollWidth);
        check(w <= 391, '390px で画面が横にはみ出さない（表は中で巻く）', w);
        await page.screenshot({ path: path.join(OUT_DIR, 'standard-draft-390.png'), fullPage: true });
        await page.setViewportSize({ width: 1400, height: 1000 });
        await settle(page, 300);
      },
    ],
    [
      'register',
      async (page) => {
        check(
          (await page
            .locator('[data-step="register"] [data-step-part="register"] [data-testid="standard-register"]')
            .count()) === 1 &&
            (await page
              .locator('[data-step="register"] [data-step-part="draft"] [data-testid="standard-table"]')
              .count()) === 1,
          '「3. 標準にする」の段に下書きの表と［この表を標準にする］が並ぶ',
        );
        if ((await diffCount(page)) === 0) {
          // 違う所が無ければ1マス替える
          await page.locator('[data-testid="standard-table"] [data-testid="standard-cell"] button').first().click();
          const s = page.getByTestId('standard-editor-staff');
          const now = await s.inputValue();
          await s.selectOption(now === '' ? { index: 0 } : '');
          await page.getByTestId('standard-editor-ok').click();
          await settle(page, 200);
        }
        check((await page.getByTestId('standard-since').count()) === 1, '3 に「いつから」の欄');
        check(
          (await page.getByTestId('standard-next').innerText()).includes('次へ：担当を組む') &&
            (await page.getByTestId('standard-next').getAttribute('href')) === '#/arrange',
          '3 の［次へ：担当を組む］は担当を組むへのリンク',
        );
        check(
          (await page.locator('.btn-primary').count()) === 1 &&
            (await page.getByTestId('standard-register').getAttribute('class')).includes('btn-primary'),
          '3 の主ボタンは「この表を標準にする」の1つ',
        );
        if ((await page.getByTestId('standard-temp-choice').count()) > 0) {
          check(await page.getByTestId('standard-temp-drop').isChecked(), '既定は「標準どおりに入れ替える」');
          const txt = await page.getByTestId('standard-temp-choice').innerText();
          check(
            txt.includes('その予定を消して、新しい標準の担当・時刻にします') &&
              txt.includes('その予定は今の担当のまま固定（ピン）します'),
            '選びに何が起きるかの文',
          );
        }
        await page.getByTestId('standard-register').click();
        await page.getByTestId('confirm-dialog').waitFor();
        check((await page.getByTestId('confirm-title').innerText()).includes('標準にしますか'), '登録の前に確認');
        check(
          (await page.getByTestId('confirm-dialog').innerText()).includes(`「${picked.name}」`),
          '確認に標準の考え方を書く',
        );
        await confirm(page);
        const d = await stored(page);
        check(!!d?.standard, '登録の記録（standard）が残る', d?.standard);
        check(d?.scorePresetId === picked.id, '点数の基準（標準の考え方）が案のプリセットになる', {
          want: picked.id,
          got: d?.scorePresetId,
        });
        const done = page.getByTestId('standard-done');
        check(
          (await done.count()) === 1 && /\d+\/\d+ から毎週この表のとおりに並びます/.test(await done.innerText()),
          '完了の表示「M/D から毎週この表のとおりに並びます」',
        );
        const href = await page.getByTestId('standard-week-link').getAttribute('href');
        check(/#\/week\?d=\d{4}-\d{2}-\d{2}$/.test(href ?? ''), '［週の予定で見る］は週の予定へ', href);
        check((await page.getByTestId('standard-table').count()) === 0, '登録したら下書きを捨てる');
        check((await stepNow(page)) === 'register', '登録したあとも「標準にする」の段で完了を見せる');
        const afterParts = await page
          .locator('[data-testid="standard-steps"] [data-step="register"] > section[data-step-part]')
          .evaluateAll((els) => els.map((el) => el.dataset.stepPart));
        check(afterParts.join(',') === 'register,draft', '登録した直後は登録の部分（完了の表示）が先', afterParts);
        check((await page.getByTestId('toast-undo').count()) === 1, 'トーストに［元に戻す］');
        check(
          (await page.getByTestId('standard-now').innerText()).startsWith('標準：'),
          '今の標準の1行が出る',
          await page.getByTestId('standard-now').innerText(),
        );
        await page.screenshot({ path: path.join(OUT_DIR, 'standard-registered.png'), fullPage: true });
      },
    ],
    [
      'same-after-register',
      async (page) => {
        check(
          (await page.getByTestId('standard-register-empty').count()) === 0,
          '登録した直後は「下書きがありません」を出さない（完了の表示）',
        );
        await page.getByTestId('standard-from-current').click();
        await page.getByTestId('standard-table').waitFor();
        await settle(page, 300);
        check((await diffCount(page)) === 0, '登録したあと今の標準から作ると違う所0');
        check(await page.getByTestId('standard-register').isDisabled(), '違う所0なら標準にするを押せない');
        check((await page.getByTestId('standard-same').count()) === 1, '「今の標準と同じです」');
      },
    ],
    [
      'day-view-after-register',
      async (page) => {
        await goStep(page, 'proposals');
        // 登録で繰り返しが変わっても、日で見るは案を作ったときの問題・標準で見る（全部担当なしの比べ方にならない。ADR-0065）
        const view = page.getByTestId('standard-day-view');
        check((await view.count()) === 1, '登録したあとも日で見るは残る');
        check((await view.getByTestId('standard-day-stale').count()) === 1, '案を作り直す案内の1行');
        const unassigned = await view.getByTestId('choice-unassigned').count();
        const bands = await view.locator('[data-testid="route-timeline"] [data-visit]').count();
        check(bands > 0, '登録したあとも時間軸に訪問の帯が出る（担当が付いたまま）', { bands, unassigned });
        // 登録したあとに案を作り直すと、「今の標準」のタブと担当が変わる件数が出て、変わる訪問に印
        await page.getByTestId('standard-run').click();
        await page.getByTestId('standard-progress').waitFor({ timeout: 10000 });
        const cards = await page.getByTestId('standard-card').count();
        await page.waitForFunction(
          (n) =>
            document.querySelectorAll('[data-testid="standard-use"]').length === n &&
            !document.querySelector('[data-testid="standard-progress"]'),
          cards,
          { timeout: 5 * 60 * 1000 },
        );
        await settle(page, 300);
        check((await view.getByTestId('standard-day-stale').count()) === 0, '作り直すと案内の1行は消える');
        check((await view.getByTestId('standard-day-current').count()) === 1, '登録後は案のタブに「今の標準」がある');
        const pts = await view.getByTestId('choice-points').allInnerTexts();
        check(pts.length === cards + 1, '登録後は今の標準にも点', pts);
        const choices = view.getByTestId('standard-day-choice');
        const moved = await choices.evaluateAll((els) =>
          els.map((el) => /担当が変わる (\d+)件/.exec(el.textContent ?? '')?.[1] ?? null),
        );
        check(
          moved.every((n) => n !== null),
          '登録後は案のタブに担当が変わる件数',
          moved,
        );
        const k = moved.findIndex((n) => Number(n) > 0);
        if (k >= 0) {
          await choices.nth(k).click();
          await settle(page, 300);
          check((await view.getByTestId('choice-mark').count()) > 0, '今の標準から変わる訪問に印（代・±分）');
          check((await view.locator('.reassign-moves-box').count()) === 1, '変わる訪問の一覧（畳む）');
        }
        await view.getByTestId('standard-day-current').click();
        await settle(page, 300);
        check((await view.getByTestId('choice-mark').count()) === 0, '今の標準のタブには変わる訪問の印が無い');
      },
    ],
    [
      'arrange-after-register',
      async (page) => {
        // 登録したあとの担当を組むも予定を組むの段（基本情報・担当を組む の2つ）を出し、［標準の組み方を変える］で組み方の標準へ戻れる（ADR-0067）
        await goStep(page, 'register');
        // 下書きを1つ持って出る（案を作り直すと下書きが無くなることがあるので、無ければ今の標準から作る）
        if ((await page.getByTestId('standard-table').count()) === 0) {
          await page.getByTestId('standard-from-current').click();
          await page.getByTestId('standard-table').waitFor();
        }
        await page.getByTestId('standard-next').click();
        await page.waitForURL(/#\/arrange/, { timeout: 10000 });
        await page.getByTestId('arrange-change-standard').waitFor({ timeout: 30000 });
        const arrangeSteps = await page
          .locator('[data-testid="arrange-steps"] li')
          .evaluateAll((els) => els.map((el) => el.dataset.step));
        check(
          arrangeSteps.join(',') === 'basics,arrange',
          '登録したあとの担当を組むの段は 基本情報・担当を組む の2つ',
          arrangeSteps,
        );
        check(
          (await page.getByTestId('arrange-change-standard').getAttribute('href')) === '#/standard',
          '担当を組むに［標準の組み方を変える］（#/standard へ）',
        );
        // ［標準の組み方を変える］は下書きの有る無しにかかわらず 2（案をくらべる）から開く
        await page.getByTestId('arrange-change-standard').click();
        await page.waitForURL(/#\/standard/, { timeout: 10000 });
        await page.getByTestId('standard-steps').waitFor({ timeout: 30000 });
        check(
          (await stepNow(page)) === 'proposals',
          '［標準の組み方を変える］で組み方の標準の 2（案をくらべる）が開く（下書きが残っていても）',
          await stepNow(page),
        );
        check(
          (await page.getByTestId('arrange-steps').locator('li').count()) === 4,
          '組み方の標準は標準があっても予定を組むの 4 段を出す',
        );
      },
    ],
    [
      'basics-after-register',
      async (page) => {
        // 基本情報の段：標準を登録したあとに基本情報（#/basics の表の時刻）を直すと、担当を組むに組み直しの知らせ（ADR-0067）
        await page.goto(`${BASE}#/basics`);
        await page.getByTestId('basics-table').waitFor({ timeout: 30000 });
        check(
          (await page.locator('h1').innerText()).trim() === '予定と相性' &&
            (await page.getByTestId('basics-row').count()) > 0,
          '基本情報（#/basics）に予定と相性の表',
        );
        check(
          (await page.evaluate(() => localStorage.getItem('vrdemo:arrange:basis'))) !== null,
          '標準を登録すると基本情報の鍵を vrdemo:arrange:basis に覚える',
        );
        await page.goto(`${BASE}#/arrange`);
        await page.getByTestId('arrange-change-standard').waitFor({ timeout: 30000 });
        check(
          (await page.getByTestId('arrange-basis-changed').count()) === 0,
          '登録した直後は組み直しの知らせを出さない',
        );
        await page.goto(`${BASE}#/basics`);
        await page.getByTestId('basics-table').waitFor({ timeout: 30000 });
        await page.getByTestId('basics-time').first().click();
        await page.getByTestId('basics-editor-early').fill('05:00');
        await page.getByTestId('basics-editor-ok').click();
        await page.getByTestId('basics-editor').waitFor({ state: 'detached', timeout: 10000 });
        // 基本情報の次へは担当を組むへ（標準がある）
        await page.getByTestId('basics-next').click();
        await page.waitForURL(/#\/arrange/, { timeout: 10000 });
        await page.getByTestId('arrange-basis-changed').waitFor({ timeout: 30000 });
        check(
          (await page.getByTestId('arrange-basis-redo').count()) === 1,
          '基本情報を直すと担当を組むに「変わりました」の知らせと［組み直す］',
        );
      },
    ],
  ],
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
