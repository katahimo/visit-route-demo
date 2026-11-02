// 相性の画面（PRD D113〜D117・D420。ADR-0022・ADR-0087）を本物のブラウザで確かめる：
// 列の見出しの名前が全部出る／画面の中の操作の数（マス・見出しはボタンにせず、表は Tab の止まり所1つ）・凡例は1行・絞り込みは1つに畳む／
// 表の中を矢印で動く／マスを押すと相性を選ぶ欄（今の相性に印・選ぶと入る・フォーカスはマスへ戻る・Esc で閉じる）／
// 吹き出しの開閉・キーボード・フォーカスの戻り・Tab で外へ出ると閉じる・中を巻ける・画面の端で切れない／
// 〈スタッフ〉・〈利用者さん〉の画面で開く（#/staff/:id・#/clients/:id）／列（?sf=）と行（?cf=）の絞り込みと再読込での復元・履歴を増やさない・
// 日本語の変換（IME）／0人の表示と「絞り込みを戻す」／最初に表の行が10行以上見える／
// 相性のチップを押したままマスの相性を変えても行が消えない（「表を並べ直す」で並べ直す）、絞り込みで見出しが消えたら吹き出しを閉じる／
// 性能：〈利用者さん〉300人×〈スタッフ〉60人で、選ぶ欄で相性を1回選んでから描き終わるまでの時間（目安 100ms 以下）。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-compat.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）。ほかに
//   PERF_MS_COMPAT … 相性を選んでから描き終わるまでの上限（ミリ秒。既定 100。ならし3回のあと9回の中央値で比べ、
//                    超えたら最大3回りまで測り直して一番よい回りの中央値を使う。PRD D253。無ければ PERF_MS）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const path = require('node:path');
const { BASE, OUT_DIR, perfMs, check, note, settle, runSteps } = require('./lib/env.cjs');
const { openContext, pagePerStep } = require('./lib/steps.cjs');

const PERF_MS = perfMs('PERF_MS_COMPAT', 100);
/** 速さの計測：ならしの回数・1回りの回数・回りの最大・回りの合間（PRD D253） */
const PERF_WARMUP = 3;
const PERF_SAMPLES = 9;
const PERF_ROUNDS = 3;
const PERF_ROUND_GAP_MS = 1000;

/** URL（値の中も encodeURIComponent しているので2回戻す） */
const urlOf = (page) => decodeURIComponent(decodeURIComponent(page.url()));
const countOf = async (loc) =>
  Number(((await loc.locator('.client-filter-count').textContent()) ?? '').replace(/\D/g, ''));

async function openCompat(page, query = '') {
  await page.goto(`${BASE}#/compat${query}`);
  await page.getByTestId('compat-filters').waitFor();
  await settle(page, 300);
}
/** 絞り込みの欄（列と行の2つを入れた1つの「絞り込み」）を開く（畳んであれば） */
async function openBox(page) {
  const box = page.getByTestId('compat-filters');
  if (!(await box.evaluate((el) => el.open))) await box.locator('summary').click();
}
const heads = (page) => page.getByTestId('compat-head-btn');
const rows = (page) => page.getByTestId('compat-client-btn');
const pop = (page) => page.getByTestId('compat-pop');
const choicePop = (page) => page.getByTestId('compat-choice-pop');
/** マスを押して、選ぶ欄で相性（2・1・0・−1・−2）を選ぶ */
async function pickLevel(page, cell, level) {
  await cell.click();
  await choicePop(page).waitFor();
  await choicePop(page).locator(`[data-level="${level}"]`).click();
  await choicePop(page).waitFor({ state: 'detached' });
}
const label = async (loc) => ((await loc.getAttribute('aria-label')) ?? '').replace(/の詳細$/, '');

async function namesAndLayout(page) {
  await openCompat(page);
  const info = await page.$$eval('[data-testid="compat-head-btn"]', (bs) =>
    bs.map((b) => ({
      name: b
        .getAttribute('aria-label')
        .replace(/の詳細$/, '')
        .replace(/\s+/g, ''),
      lines: [...b.querySelectorAll('.compat-head-line')].map((l) => ({
        t: l.textContent,
        cut: l.scrollWidth > l.clientWidth + 1,
      })),
      width: Math.round(b.closest('th').getBoundingClientRect().width),
    })),
  );
  check(info.length > 0, '列の見出しがある', info.length);
  check(
    info.every((h) => h.lines.map((l) => l.t).join('') === h.name && h.lines.every((l) => !l.cut)),
    '名前が切れずに全部出る（2行）',
    info.map((h) => h.lines.map((l) => l.t).join('/')).join('、'),
  );
  check(
    Math.max(...info.map((h) => h.width)) <= 80,
    '列の幅は今と同じくらい',
    `${Math.max(...info.map((h) => h.width))}px`,
  );
  // 畳んだ欄の要約と、最初に見える行の数
  check(
    !(await page.getByTestId('compat-filters').evaluate((el) => el.open)),
    'URL に絞り込みが無ければ欄は畳んである',
  );
  check(
    (await page.getByTestId('compat-filter-summary').textContent()) === '絞り込みなし',
    '要約に今の状態',
    await page.getByTestId('compat-filter-summary').textContent(),
  );
  // 操作の数（PRD D420）：マス・見出し・名前はボタンにしない。表は Tab の止まり所1つ。凡例は1行、休止中の注記は出さない
  const ops = await page.evaluate(() => {
    const main = document.querySelector('main');
    const folded = (e) => {
      const d = e.closest('details:not([open])');
      return !!d && !d.querySelector(':scope > summary')?.contains(e);
    };
    const table = document.querySelector('[data-testid="compat-table"]');
    return {
      buttonsInTable: table.querySelectorAll('button').length,
      tableStops: [...table.querySelectorAll('[tabindex]')].filter((e) => e.tabIndex >= 0).length,
      shown: [...main.querySelectorAll('button, summary, a[href], input, select')].filter((e) => !folded(e)).length,
      role: table.getAttribute('role'),
      legendLines: document.querySelectorAll('[data-testid="compat-legend"] .compat-legend-line').length,
      pauseNote: main.innerText.includes('は出していません'),
    };
  });
  check(
    ops.buttonsInTable === 0 && ops.tableStops === 1 && ops.role === 'grid',
    '表にボタンが無く、Tab の止まり所は1つ（grid）',
    ops,
  );
  check(ops.shown <= 6, '表の外の見えている操作は6つ以下（タブ・絞り込み・説明）', ops);
  check(ops.legendLines === 1 && !ops.pauseNote, '凡例は1行・休止中の注記は出さない', ops);
  const visible = await page.$$eval(
    '[data-testid="compat-client-btn"]',
    (bs) => bs.filter((b) => b.getBoundingClientRect().bottom <= window.innerHeight).length,
  );
  check(visible >= 10, '1280×900 で最初に表の行が10行以上見える', `${visible}行`);
  await page.screenshot({ path: path.join(OUT_DIR, 'compat-first.png') });
  // 見出しの行と1列目は止まる
  await page.locator('.compat-scroll').evaluate((el) => {
    el.scrollTop = 200;
    el.scrollLeft = 100;
  });
  await settle(page, 100);
  const stick = await page.evaluate(() => {
    const sc = document.querySelector('.compat-scroll').getBoundingClientRect();
    const th = document.querySelector('.compat-table thead th.compat-head').getBoundingClientRect();
    const first = document.querySelector('.compat-table tbody th').getBoundingClientRect();
    return { headTop: Math.round(th.top - sc.top), firstLeft: Math.round(first.left - sc.left) };
  });
  check(stick.headTop <= 3 && stick.firstLeft <= 3, '見出しの行と1列目が止まる', stick);
}

async function popover(page) {
  await openCompat(page);
  const btn = heads(page).first();
  await btn.click();
  await pop(page).waitFor();
  const id = await pop(page).getAttribute('id');
  check(
    (await btn.getAttribute('aria-expanded')) === 'true' && (await btn.getAttribute('aria-controls')) === id,
    'aria-expanded・aria-controls',
  );
  check(
    (await pop(page).getAttribute('role')) === 'dialog' && (await pop(page).getAttribute('aria-labelledby')) !== null,
    'role=dialog と名前',
  );
  const text = await pop(page).textContent();
  check(
    ['移動手段', '稼働時間', '相性', '◎', 'いつもの担当', 'の画面で開く'].every((w) => text.includes(w)),
    '〈スタッフ〉の中身',
  );
  check(await pop(page).evaluate((el) => el.contains(document.activeElement)), '開いたらフォーカスが吹き出しへ');
  await page.keyboard.press('Escape');
  await pop(page).waitFor({ state: 'detached' });
  check(await btn.evaluate((el) => document.activeElement === el), 'Esc で閉じてフォーカスがボタンへ');
  await page.keyboard.press('Enter');
  await pop(page).waitFor();
  await btn.click();
  await pop(page).waitFor({ state: 'detached' });
  check(await btn.evaluate((el) => document.activeElement === el), 'もう一度押すと閉じてフォーカスがボタンへ');
  await page.keyboard.press(' ');
  await pop(page).waitFor();
  await page.mouse.click(5, 5);
  await pop(page).waitFor({ state: 'detached' });
  check(true, '外を押すと閉じる');
  // Tab で外へ出ると閉じる
  await btn.click();
  await pop(page).waitFor();
  for (let i = 0; i < 5 && (await pop(page).count()) > 0; i++) await page.keyboard.press('Tab');
  check(
    (await pop(page).count()) === 0 && (await btn.evaluate((el) => document.activeElement === el)),
    'Tab で外へ出ると閉じてフォーカスがボタンへ',
  );

  // 中を巻ける（低い画面）・画面の端で切れない（狭い画面）
  await page.setViewportSize({ width: 480, height: 360 });
  const last = heads(page).last();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await pop(page).waitFor();
  const box = await pop(page).boundingBox();
  check(box.x >= 0 && box.x + box.width <= 480 && box.y >= 0 && box.y + box.height <= 360, '画面の中に出る', box);
  const canScroll = await pop(page).evaluate((el) => el.scrollHeight > el.clientHeight);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  await settle(page, 400);
  const top = await pop(page).evaluate((el) => el.scrollTop);
  check(canScroll && top > 0, '吹き出しの中を巻ける（戻らない）', { canScroll, scrollTop: top });
  await page.screenshot({ path: path.join(OUT_DIR, 'compat-pop-scroll.png') });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 900 });

  // 〈利用者さん〉の吹き出し
  const cbtn = rows(page).first();
  await cbtn.click();
  await pop(page).waitFor();
  const ctext = await pop(page).textContent();
  check(
    ['段階', '地区', '必要条件', '希望', '担当できる人', 'いつもの担当'].every((w) => ctext.includes(w)),
    '〈利用者さん〉の中身',
  );
  await page.keyboard.press('Escape');
}

/** 表の中を矢印で動く・マスを押すと相性を選ぶ欄（PRD D420） */
async function gridAndChoice(page) {
  await openCompat(page);
  const cells = page.getByTestId('compat-cell');
  // Tab で表に入ると最初のマス、矢印で動く（止まり所は1つのまま）
  // 絞り込みの要約から Tab で進み、表に入るまで（間に説明の「点のしくみ」がある）
  await page.getByTestId('compat-filters').locator('summary').focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => !!document.activeElement?.closest('[data-testid="compat-table"]'))) break;
  }
  const at = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      const tr = el?.closest('tr');
      return {
        kind: el?.getAttribute('data-kind'),
        row: tr?.parentElement?.tagName === 'THEAD' ? -1 : tr?.sectionRowIndex,
        col: el?.cellIndex - 1,
        stops: [...document.querySelectorAll('[data-testid="compat-table"] [tabindex="0"]')].length,
      };
    });
  check(
    JSON.stringify(await at()) === JSON.stringify({ kind: 'cell', row: 0, col: 0, stops: 1 }),
    'Tab で最初のマス',
    await at(),
  );
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  check(
    JSON.stringify(await at()) === JSON.stringify({ kind: 'cell', row: 1, col: 1, stops: 1 }),
    '矢印で動く',
    await at(),
  );
  await page.keyboard.press('Home');
  check((await at()).kind === 'client', 'Home で行の名前', await at());
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  check(
    JSON.stringify(await at()) === JSON.stringify({ kind: 'staff', row: -1, col: 0, stops: 1 }),
    '上で列の見出し（角には入らない）',
    await at(),
  );
  await page.keyboard.press('ArrowDown');
  // Enter で選ぶ欄。今の相性に印、フォーカスはその選択肢
  const cell = cells.nth(
    await page.evaluate(() => {
      const all = [...document.querySelectorAll('[data-testid="compat-cell"]')];
      return all.indexOf(document.activeElement);
    }),
  );
  const before = (await cell.textContent()) ?? '';
  await page.keyboard.press('Enter');
  await choicePop(page).waitFor();
  const st = await choicePop(page).evaluate((el) => ({
    role: el.getAttribute('role'),
    title: el.querySelector('h3')?.textContent ?? '',
    n: el.querySelectorAll('[data-testid="compat-choice"]').length,
    pressed: [...el.querySelectorAll('[aria-pressed="true"]')].map((b) => b.getAttribute('data-level')),
    focus: document.activeElement?.getAttribute('aria-pressed'),
  }));
  check(
    st.role === 'dialog' && st.n === 5 && st.pressed.length === 1 && st.focus === 'true' && st.title.includes(' × '),
    '選ぶ欄：5段・今の相性に印・フォーカスはその段・見出しは「〈利用者さん〉 × 〈スタッフ〉」',
    st,
  );
  await page.keyboard.press('Escape');
  await choicePop(page).waitFor({ state: 'detached' });
  check(await cell.evaluate((el) => document.activeElement === el), 'Esc で閉じてフォーカスがマスへ');
  // 選ぶと入って閉じる（× を選ぶ → 元に戻す）
  await page.keyboard.press(' ');
  await choicePop(page).waitFor();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await choicePop(page).waitFor({ state: 'detached' });
  await settle(page, 200);
  check(
    (await cell.textContent()) === '×' && /担当にしない/.test((await cell.getAttribute('aria-label')) ?? ''),
    'End と Enter で × を選ぶとマスが × になる',
    await cell.textContent(),
  );
  check(await cell.evaluate((el) => document.activeElement === el), '選んだあとフォーカスがマスへ');
  const back = { '◎': 2, '○': 1, '': 0, '△': -1, '×': -2 }[before] ?? 0;
  await pickLevel(page, cell, back);
  check((await cell.textContent()) === before, '押して選ぶと元の相性に戻る', before);
  // もう一度押すと閉じる
  await cell.click();
  await choicePop(page).waitFor();
  await cell.click();
  await choicePop(page).waitFor({ state: 'detached' });
  check(true, 'マスをもう一度押すと選ぶ欄が閉じる');
}

async function openById(page) {
  for (const [kind, sel, to] of [
    ['client', 'compat-client-btn', '#/clients'],
    ['staff', 'compat-head-btn', '#/staff'],
  ]) {
    await openCompat(page);
    const b = page.getByTestId(sel).first();
    const name = await label(b);
    const id = await b.getAttribute('data-id');
    await b.click();
    await pop(page).getByTestId('compat-pop-link').click();
    await settle(page, 400);
    // 開くのはその人の画面（`#/clients/:id`。PRD D308）。見出し（h1）の名前は完全一致、画面の data-id は押した人
    const head = ((await page.locator('h1').first().textContent()) ?? '').trim();
    const view = page.getByTestId('person-view');
    const opened = head === name && (await view.count()) === 1 && (await view.getAttribute('data-id')) === id;
    check(
      urlOf(page).includes(`${to}/${id}`) && !urlOf(page).includes('id=') && opened,
      `${kind}：吹き出しのリンクで ${name} の画面（${to}/:id）が開く`,
      { head, url: urlOf(page) },
    );
  }
  // いない ID は何もしない
  await page.goto(`${BASE}#/staff?id=nobody`);
  await settle(page, 300);
  check(
    !urlOf(page).includes('id=') && (await page.getByTestId('person-view').count()) === 0,
    'いない ID は人の画面を開かない（URL から id を消す）',
  );
}

async function filters(page) {
  await openCompat(page);
  const hist0 = await page.evaluate(() => history.length);
  const cols0 = await heads(page).count();
  const rows0 = await rows(page).count();
  await openBox(page);
  const chip = page.getByTestId('compat-sf-chip').filter({ hasText: '性別：女性' });
  const n = await countOf(chip);
  await chip.click();
  await settle(page);
  check((await heads(page).count()) === n && n < cols0, '特性のチップで列を絞る', `${cols0} → ${n}`);
  check(
    (await page.locator('[data-testid="compat-sf-chip"][aria-disabled="true"]').count()) > 0,
    '0人のチップは押せない',
  );
  const sfIn = page.getByTestId('compat-sf-input');
  const first = (await label(heads(page).first())).split(/\s/)[0];
  await sfIn.fill(first);
  await settle(page, 500);
  check((await heads(page).count()) === 1, '名前で探す');
  const ng = page.locator('[data-testid="compat-cf-chip"][data-chip="ng"]');
  const ngN = await countOf(ng);
  await ng.click();
  await settle(page);
  check((await rows(page).count()) === ngN && ngN < rows0, '× がある人で行を絞る', `${rows0} → ${ngN}`);
  check(
    urlOf(page).includes(`sf=q:${first}`) && urlOf(page).includes('x:ng'),
    'URL に ?sf= と ?cf= を書く',
    urlOf(page),
  );
  check(
    (await page.getByTestId('compat-filter-summary').textContent()).includes(`${ngN}人／${rows0}人`),
    '要約に絞った行の人数',
    await page.getByTestId('compat-filter-summary').textContent(),
  );
  const hist1 = await page.evaluate(() => history.length);
  await page.reload();
  await page.getByTestId('compat-filters').waitFor();
  await settle(page, 300);
  check((await heads(page).count()) === 1 && (await rows(page).count()) === ngN, '再読込で絞り込みが戻る');
  check(await page.getByTestId('compat-filters').evaluate((el) => el.open), 'URL に絞り込みがあれば欄を開いておく');
  check(
    (await ng.getAttribute('aria-pressed')) === 'true' && (await sfIn.inputValue()) === first,
    'チップ・検索の文字が戻る',
  );
  check(hist1 === hist0, '絞り込みで履歴を増やさない', `${hist0} → ${hist1}`);
  await ng.click();
  await settle(page);
  const pend = page.locator('[data-testid="compat-cf-chip"][data-chip="pending"]');
  const pN = await countOf(pend);
  await pend.click();
  await settle(page);
  check((await rows(page).count()) === pN, 'まだ相性が入っていない組がある人', `${pN}人`);
  await pend.click();
  await settle(page);
  await page.getByTestId('compat-cf-city').first().click();
  await settle(page);
  check((await rows(page).count()) < rows0, '地区で行を絞る');
  check((await page.getByTestId('compat-cf-ended').count()) === 0, '「終了の人も出す」は出さない');
  // 0人
  await sfIn.fill('存在しない名前');
  await settle(page, 500);
  const empty = page.getByTestId('compat-empty');
  check(
    (await empty.textContent()).includes('当てはまる') && (await page.getByTestId('compat-table').count()) === 0,
    '0人なら表の代わりに知らせる',
    await empty.textContent(),
  );
  await page.getByTestId('compat-empty-sf-reset').click();
  await settle(page);
  check((await heads(page).count()) === cols0 && (await sfIn.inputValue()) === '', '「絞り込みを戻す」で列が戻る');
  await page.getByTestId('compat-cf-reset').click();
  await settle(page);
  check((await rows(page).count()) === rows0 && !urlOf(page).includes('cf='), '行の絞り込みを戻す');
  // 日本語の変換
  const cdp = await page.context().newCDPSession(page);
  await sfIn.click();
  const before = urlOf(page);
  await cdp.send('Input.imeSetComposition', { text: 'し', selectionStart: 1, selectionEnd: 1 });
  await settle(page, 400);
  await cdp.send('Input.imeSetComposition', { text: 'しや', selectionStart: 2, selectionEnd: 2 });
  await settle(page, 400);
  check(urlOf(page) === before && (await sfIn.inputValue()) === 'しや', '変換中は URL に書かず、文字も残る');
  await cdp.send('Input.insertText', { text: '市役所' });
  await settle(page, 500);
  check(urlOf(page).includes('q:市役所'), '確定で URL に書く');
  // 知らないチップ・終了の人も出すは URL から捨てる
  await openCompat(page, '?sf=chip:nope&cf=chip:;ended:1;x:zzz');
  check(!urlOf(page).includes('sf=') && !urlOf(page).includes('cf='), '捨てたチップは URL を書き直す', urlOf(page));
}

/** 相性のチップを押したままマスの相性を変えても行が消えない。絞り込みで見出しが消えたら吹き出しを閉じる */
async function regressions(page) {
  await openCompat(page, '?cf=chip:;x:ng');
  const n0 = await rows(page).count();
  const row0 = page.locator('tbody tr').first();
  const who = await label(rows(page).first());
  // その行の × をすべて ◎ にする（× がある人の絞り込みからは外れるが、行は消さない）
  for (let i = 0; i < 10; i++) {
    const x = row0.locator('[data-testid="compat-cell"]', { hasText: '×' }).first();
    if ((await x.count()) === 0) break;
    await pickLevel(page, x, 2);
  }
  await settle(page);
  check(
    (await rows(page).count()) === n0 && (await label(rows(page).first())) === who,
    'マスの相性を変えても行が消えない',
    `${n0}行`,
  );
  const resort = page.getByTestId('compat-resort');
  check(
    (await resort.count()) === 1 && !(await resort.evaluate((el) => el.classList.contains('btn-primary'))),
    '「表を並べ直す」が出る（主ボタンではない）',
  );
  await resort.click();
  await settle(page);
  check(
    (await rows(page).count()) <= n0 && (await resort.count()) === 0,
    '並べ直す',
    `${n0} → ${await rows(page).count()}`,
  );

  await openCompat(page);
  await openBox(page);
  const b = heads(page).first();
  const name = await label(b);
  await b.click();
  await pop(page).waitFor();
  await page.getByTestId('compat-sf-input').fill('存在しない名前');
  await settle(page, 500);
  check((await pop(page).count()) === 0, '絞り込みで見出しが消えたら吹き出しを閉じる');
  await page.getByTestId('compat-sf-input').fill('');
  await settle(page, 500);
  const again = heads(page)
    .filter({ has: page.locator('.compat-head-name') })
    .first();
  check(
    (await label(again)) === name && (await again.getAttribute('aria-expanded')) === 'false',
    '見出しが戻っても開いたままにならない',
  );
}

/** 性能：300人×60人で、選ぶ欄で相性を選んでから描き終わるまで（中央値。マスを押して欄が開くまでは注記） */
async function perf(page) {
  await openCompat(page);
  await page.evaluate(() => {
    const key = 'vrdemo:data:v1';
    const d = JSON.parse(localStorage.getItem(key));
    const baseC = d.clients.filter((c) => c.active);
    const baseS = d.staff.filter((s) => s.active);
    const clients = [];
    for (let i = 0; clients.length < 300; i++) {
      const c = baseC[i % baseC.length];
      clients.push({
        ...c,
        id: `pc${i}`,
        displayName: `${c.displayName}${i}`,
        usualStaffId: null,
        allowedStaffIds: [],
      });
    }
    const staff = [];
    for (let i = 0; staff.length < 60; i++) {
      const s = baseS[i % baseS.length];
      staff.push({ ...s, id: `ps${i}`, name: `${s.name}${i}`, email: '' });
    }
    const compat = {};
    clients.forEach((c, i) => {
      compat[c.id] = {};
      staff.forEach((s, j) => {
        const l = [2, 1, 0, -1, -2][(i * 7 + j * 3) % 5];
        if (l !== 0) compat[c.id][s.id] = l;
      });
    });
    localStorage.setItem(
      key,
      JSON.stringify({ ...d, clients: [...d.clients, ...clients], staff: [...d.staff, ...staff], compat }),
    );
  });
  await page.reload();
  await page.getByTestId('compat-table').waitFor();
  // 速さの計測の前に、読み込み直後の仕事（先読み・GC）が引くのを待つ。計測の条件なので固定の待ちのまま（ADR-0041）
  await page.waitForTimeout(1500);
  const size = { rows: await rows(page).count(), cols: await heads(page).count() };
  // 1回ぶんの計測：マスを押して選ぶ欄を開き（開くまでも測る）、相性を選んでから次の描画が終わるまで（ms）。
  // 押す前に1フレーム置き、前の回の描画を持ち込まない。選ぶ相性は回ごとに替える
  const openTimes = [];
  const clickTimes = (from, n) =>
    page
      .evaluate(
        async ([from, n]) => {
          const out = [];
          const opens = [];
          const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
          const cells = document.querySelectorAll('tbody tr:nth-child(5) [data-testid="compat-cell"]');
          for (let i = 0; i < n; i++) {
            await frame();
            const o0 = performance.now();
            cells[(from + i) % cells.length].click();
            await frame();
            opens.push(Math.round(performance.now() - o0));
            const level = [2, 1, 0, -1, -2][(from + i) % 5];
            const b = document.querySelector(`[data-testid="compat-choice-pop"] [data-level="${level}"]`);
            const t0 = performance.now();
            b.click();
            await frame();
            out.push(Math.round(performance.now() - t0));
          }
          return { out, opens };
        },
        [from, n],
      )
      .then((r) => {
        openTimes.push(...r.opens);
        return r.out;
      });
  const medianOf = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  // ならし：最初の数回は JIT・GC の立ち上がりで遅いので数えない
  const warmup = await clickTimes(0, PERF_WARMUP);
  // 1回り PERF_SAMPLES 回の中央値。上限を超えたら少し置いてもう1回り（最大 PERF_ROUNDS 回り）。
  // 一番よい回りの中央値で比べる：ほかの処理と CPU を取り合った回り（負荷）を外し、遅くなったコード（どの回りも遅い）は落とす（PRD D253）。
  // 1回り目が上限の2倍を超えたら、負荷の揺れでは説明できないので回りを足さずに落とす。回りを足して通ったら注記に残す（ぎりぎりを見逃さない）
  const rounds = [];
  for (let r = 0; r < PERF_ROUNDS; r++) {
    if (r > 0) await page.waitForTimeout(PERF_ROUND_GAP_MS);
    const times = await clickTimes(PERF_WARMUP + r * PERF_SAMPLES, PERF_SAMPLES);
    rounds.push({ median: medianOf(times), times });
    const m = rounds.at(-1).median;
    if (m <= PERF_MS) {
      if (r > 0)
        note(
          `相性の速さ：${r + 1}回り目で通過（各回りの中央値 ${rounds.map((x) => x.median).join('・')}ms、上限 ${PERF_MS}ms）`,
        );
      break;
    }
    if (r === 0 && m > 2 * PERF_MS) break;
  }
  const median = Math.min(...rounds.map((x) => x.median));
  const times = rounds.map((x) => x.times);
  check(size.rows >= 300 && size.cols >= 60, '300人×60人の表', size);
  check(median <= PERF_MS, `相性を1回選んで描き終わるまで（中央値 ${PERF_MS}ms 以下）`, { median, times, warmup });
  note(`相性の速さ：マスを押して選ぶ欄が開くまでの中央値 ${medianOf(openTimes)}ms`);
}

const steps = pagePerStep({
  // 速さは時計を止めない文脈で測る（setFixedTime は requestAnimationFrame・performance.now も差し替える）
  open: (browser, step) => openContext(browser, { clock: step !== perf }),
  steps: [namesAndLayout, popover, gridAndChoice, openById, filters, regressions, perf],
  label: (name) => `${name} が止まった`,
  after: (name, { dlg }) => check(dlg.native.length === 0, `${name}：ブラウザのダイアログを出さない`, dlg.native),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
