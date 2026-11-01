// e2e の共通：画面へ行く・メニューを押す・操作の行のボタンを押す・「詳しく ▾」を開く（ADR-0074 段0）。
// エキスパート機能が入の画面は、段1〜5 でメニュー・操作の行・「詳しく ▾」が切（ADR-0073 段(4)）の作りに寄っていく
// （段1：入のメニューは 予定・〈利用者さん〉・〈スタッフ〉・組む・設定 の5つでホームは無い。#/home は予定へ移る）。
// そのたびに各 e2e の中を直さないよう、「どこにあるか」を知る所をこのファイルの1か所にする：
//   goTo(page, 行き先)          … URL で画面へ行く（メニューや帯を押す代わり。名前でも `/path?query` でもよい）
//   clickMenu(page, 行き先)     … 左のメニューの項目を名前（行き先の名前）で押す（畳んだ親の中なら開いてから押す）
//   pressTool(page, 操作, { where }) … 操作の行のボタンを名前で押す（既定は行に出ていても「その他 ▾」の中でも押せる。
//                                  where: 'row' は行にあるときだけ、'more' は「その他 ▾」の中だけ。位置を確かめるときに付ける）
//   openMore(page)              … 「その他 ▾」を開いて、中の一覧（locator）を返す
//   openDetails(page, testId)   … 「詳しく ▾」を開く（無い・もう開いているなら何もしない）
//   closeMore(page)             … 開いている「その他 ▾」を閉じる
//   toolCount(page, testId)     … 行と「その他 ▾」の中を合わせた、その testid の数（出る・出ないを位置によらず確かめる）
//   undoState(page)             … 「元に戻す」の状態（押せるか・説明）を「その他 ▾」を開いて読む
//   openScreenDetails(page)     … 画面の「詳しく ▾」（月・週・日）を開く（開いて読む e2e が着いたあとに呼ぶ）
//   accessibleInfo(page, locator) … AX ツリーでの名前と説明を読む（CDP。aria-describedby の textContent 集めでは見逃す文を確かめる）
//   reveal(page, testId)        … 要素が見えるまで（「詳しく ▾」を開いてでも）待つ。中を読む前に呼ぶ
// 段2：入の操作の行は「予定を入れる」＋「担当を組む」（月・週）／＋「確定（伝えた）」（日）の2つと「その他 ▾」。
// 欠勤・キャンセル・元に戻す・表示の切り替え・使い方・メールで送る・印刷などは「その他 ▾」の中（where: 'more'）。
// 畳んだ「詳しく ▾」は画面ごとに開け閉めを端末に覚える（開いて読み直すと開いたまま）。reveal・openDetails は開いてから読む
// 行き先・操作の名前は下の表に足す（画面が変わったら表だけ直す）。
const { BASE, settle } = require('./env.cjs');

/** 行き先の名前 → URL（`#` の後ろ）。表に無い名前は URL（`/` で始まる）としてそのまま使う */
const SCREENS = {
  月: '/month',
  週: '/week',
  日: '/plan',
  利用者さん: '/clients',
  スタッフ: '/staff',
  設定: '/settings',
  基本情報: '/basics',
  組む: '/arrange',
  担当を組む: '/arrange',
  組み方の標準: '/standard',
  空き状況: '/vacancy',
  欠勤: '/plan?do=absence',
};

/**
 * 行き先の名前 → 左のメニューの項目（data-key）の候補。前にあるものから探す（メニューの作りが変わったらここだけ直す。
 * 欠勤はメニューに無く、予定の操作の行から（pressTool）。空き状況は予定の次の項目（PRD D400。ADR-0078）。
 * 担当なしを組むは予定の上の要対応の帯の attention-band-arrange（PRD D403））
 */
const MENU_KEYS = {
  予定: ['schedule'],
  空き状況: ['vacancy'],
  利用者さん: ['clients'],
  スタッフ: ['staff'],
  設定: ['settings'],
  基本情報: ['arrange:basics'],
  組む: ['arrange'],
  担当を組む: ['arrange:assign'],
  組み方の標準: ['arrange:standard'],
};

/**
 * 画面へ行く（about:blank を挟み、`?do=`・`?id=` を読み直す前に消さない）。行き先は名前（SCREENS）か `/path?query`。
 * ready は待つ要素（既定は見出し）、timeout は待つ長さ、h1 は見出しの文字が出るまで待つか、settleMs は着いたあと落ち着くまで待つ長さ
 */
async function goTo(page, dest, { ready = 'h1', timeout = 30000, h1 = true, settleMs = 0 } = {}) {
  const hash = Object.hasOwn(SCREENS, dest) ? SCREENS[dest] : dest;
  await page.goto('about:blank');
  await page.goto(`${BASE}#${hash}`);
  await page.locator(ready).first().waitFor({ timeout });
  if (h1) await page.locator('h1').filter({ hasText: /\S/ }).first().waitFor({ timeout });
  if (settleMs > 0) await settle(page, settleMs);
}

/** 左のメニューの項目を押す。`scope` は広い画面なら `.side-nav`、スマホは開いた引き出し */
async function clickMenu(page, dest, scope = '.side-nav') {
  const keys = Object.hasOwn(MENU_KEYS, dest) ? MENU_KEYS[dest] : undefined;
  if (!keys)
    throw new Error(`clickMenu：メニューの名前に無い行き先「${dest}」（scripts/lib/ui.cjs の MENU_KEYS に足す）`);
  const side = page.locator(scope);
  await side.getByTestId('nav-link').first().waitFor({ timeout: 15000 });
  for (const key of keys) {
    // 子の項目の key は `親:名前` の形のこともあるので、末尾が合うものも見る
    const link = side.locator(`[data-testid="nav-link"]:is([data-key="${key}"], [data-key$=":${key}"])`).first();
    if ((await link.count()) === 0) continue;
    if (!(await link.isVisible())) {
      // 畳んだ親の中：目当ての項目の親の ▾ だけ開く
      await side
        .locator('.nav-parent', { has: link })
        .getByTestId('nav-toggle')
        .and(side.locator('[aria-expanded="false"]'))
        .click();
    }
    await link.click();
    return key;
  }
  throw new Error(`clickMenu：メニューに「${dest}」が無い（試した key：${keys.join('・')}）`);
}

/** 「その他 ▾」のボタンの testid（月・週・日） */
const MORE_IDS = ['month-more', 'week-more', 'plan-more'];

/** いま出ている「その他 ▾」のボタンの testid（無ければ null）。画面が出るまで少し待つ（行のボタンか「その他 ▾」が出たら見る） */
async function moreId(page) {
  await page
    .locator('[data-testid="schedule-toolbar"], [data-testid$="-more"]')
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  for (const id of MORE_IDS) if (await page.getByTestId(id).isVisible()) return id;
  return null;
}

/** 「その他 ▾」を開き、中の一覧（locator）を返す。開いているならそのまま */
async function openMore(page) {
  const id = await moreId(page);
  if (!id) throw new Error('openMore：「その他 ▾」が出ていない');
  const btn = page.getByTestId(id);
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  const list = page.getByTestId(`${id}-list`);
  await list.waitFor({ timeout: 10000 });
  return list;
}

/** 開いている「その他 ▾」を閉じる（ボタンをもう一度押す。閉じているなら何もしない） */
async function closeMore(page) {
  const id = await moreId(page);
  if (!id) return;
  const btn = page.getByTestId(id);
  if ((await btn.getAttribute('aria-expanded')) === 'true') await btn.click();
}

/**
 * 操作の名前 → 行に出ているときのボタン（id）・「その他 ▾」の中の項目（menuId・text）。
 * 表に無い名前は testid として扱う（行に出ていれば押す。なければ「その他 ▾」の中の同じ testid の項目）
 */
const TOOLS = {
  元に戻す: { id: 'undo-btn', menuId: 'more-undo' },
  欠勤: { id: 'sudden-open', text: /欠勤・キャンセル/ },
  勤務の見込み: { id: 'month-workload', text: /勤務の見込み/ },
  印刷: { id: 'month-print', text: /印刷/ },
  表示を選ぶ: { text: /表示/ },
  // 月・週の主ボタン（引き出し）。日の主ボタンは plan-visit-add（同じ言葉）
  予定を入れる: { id: 'toolbar-add-plan', text: /予定を入れる/ },
  // 入の操作の行の2つ目：月・週は「担当を組む」（担当を組むの画面へ）、日は「確定（伝えた）」（段2。D402）
  担当を組む: { id: 'toolbar-assign', text: /担当を組む/ },
  確定: { id: 'adopt', text: /確定/ },
  使い方: { id: 'plan-more-help', text: /使い方/ },
  メールで送る: { text: /予定をメールで送る/ },
};

/**
 * 操作を探す。where：'any'（既定）＝行に出ているボタン、無ければ「その他 ▾」の中の項目／'row'＝行にあるときだけ／'more'＝「その他 ▾」の中だけ。
 * 見つからなければ null（「その他 ▾」を開いて探したときは、見つからなければ閉じる）
 */
async function findTool(page, name, where = 'any') {
  const t = Object.hasOwn(TOOLS, name) ? TOOLS[name] : { id: name };
  if (where !== 'more' && t.id) {
    // 開いていない「その他 ▾」の中の項目は描かれないので、見えていれば行のボタン
    await moreId(page);
    const direct = page.getByTestId(t.id).first();
    if ((await direct.count()) > 0 && (await direct.isVisible())) return direct;
  }
  if (where === 'row' || (await moreId(page)) === null) return null;
  const list = await openMore(page);
  const item = t.menuId
    ? list.getByTestId(t.menuId)
    : t.id && (await list.getByTestId(t.id).count()) > 0
      ? list.getByTestId(t.id)
      : t.text
        ? list.getByRole('menuitem', { name: t.text })
        : null;
  if (item && (await item.count()) > 0) return item.first();
  await closeMore(page);
  return null;
}

/** 操作の行のボタンを名前で押す（where は findTool と同じ。位置を確かめる所は 'row'・'more' を付ける） */
async function pressTool(page, name, { where = 'any' } = {}) {
  const item = await findTool(page, name, where);
  if (!item) {
    const at = { any: '行にも「その他 ▾」の中にも', row: '行に', more: '「その他 ▾」の中に' }[where];
    throw new Error(`pressTool：操作「${name}」が${at}無い`);
  }
  await item.click();
}

/**
 * 操作の行のボタン・「その他 ▾」の項目のうち、その testid の要素の数（行に出ているもの＋「その他 ▾」の中のもの。開いて数え、閉じる）。
 * 入り切りで「出る・出ない」を確かめる所で、位置（行か「その他 ▾」か）によらず数える
 */
async function toolCount(page, testId) {
  await moreId(page);
  const inRow = await page.getByTestId(testId).count();
  if ((await moreId(page)) === null) return inRow;
  const list = await openMore(page);
  const inMore = await list.getByTestId(testId).count();
  await closeMore(page);
  return inRow + inMore;
}

/**
 * 「元に戻す」の今の状態（操作の行の「その他 ▾」の項目。段2）：disabled＝戻せる手が無い、text＝項目の名前と説明（「「手の名前」を戻します」）。
 * 「その他 ▾」を開いて読み、閉じる（押さない）。人の予定表・担当を組むの画面は「元に戻す」のボタンの title を読む
 */
async function undoState(page) {
  // 人の予定表・担当を組むの画面は「元に戻す」が操作の行のボタンのまま（title に手の名前）
  const btn = page.getByTestId('undo-btn');
  if ((await btn.count()) > 0)
    return {
      disabled: (await btn.getAttribute('aria-disabled')) === 'true',
      text: (await btn.getAttribute('title')) ?? '',
      title: (await btn.getAttribute('title')) ?? '',
    };
  // 読むだけなので、いまフォーカスのある要素（札など）へフォーカスを戻す（このあとのキー操作・フォーカスの確かめを乱さない）
  const prev = await page.evaluateHandle(() => document.activeElement);
  const list = await openMore(page);
  const item = list.getByTestId('more-undo');
  const state = {
    disabled: (await item.getAttribute('aria-disabled')) === 'true',
    text: (await item.innerText()).replace(/\s+/g, ' ').trim(),
    title: (await item.getAttribute('title')) ?? '',
  };
  await closeMore(page);
  await prev.evaluate((el) => {
    if (el && el !== document.body && el.isConnected) el.focus({ preventScroll: true });
  });
  await prev.dispose();
  return state;
}

/** 「詳しく ▾」を開く（testId の無い・もう開いている場合は何もしない）。開いたら true */
async function openDetails(page, testId = 'day-details') {
  const fold = page.getByTestId(testId);
  if ((await fold.count()) === 0 || (await fold.getAttribute('open')) !== null) return false;
  await page.getByTestId(`${testId}-summary`).click();
  return true;
}

/**
 * 画面ごとの「詳しく ▾」（月・週・日）を開く（出ていなければ何もしない）。開け閉めは端末に覚える（PRD D393）ので、
 * 一度開けばその画面は開いて始まる。中の点数・凡例・進み具合を続けて何か所も読む e2e が、画面へ着いたあとに1回呼ぶ
 */
async function openScreenDetails(page) {
  await page
    .locator('[data-testid="month-details"], [data-testid="week-details"], [data-testid="day-details"]')
    .first()
    .waitFor({ state: 'attached', timeout: 3000 })
    .catch(() => {});
  for (const id of ['month-details', 'week-details', 'day-details']) await openDetails(page, id);
}

/**
 * 要素が見えるまで待つ。畳んだ「詳しく ▾」の中にあって見えないときは、その要素を含む閉じた「詳しく ▾」だけを開いてから待つ
 * （中の点数・移動・凡例などを読む前に呼ぶ。もとから見えるなら何も開かない）
 */
async function reveal(page, testId, { timeout = 60000 } = {}) {
  const el = page.getByTestId(testId).first();
  await el.waitFor({ state: 'attached', timeout });
  if (!(await el.isVisible())) {
    for (const s of await el
      .locator('xpath=ancestor::details[contains(@class,"details-fold") and not(@open)]/summary')
      .all())
      await s.click();
  }
  await el.waitFor({ state: 'visible', timeout: 10000 });
  return el;
}

/**
 * ブラウザの AX ツリー（読み上げが使うもの）での名前と説明を読む（CDP の Accessibility.getPartialAXTree）。
 * aria-describedby が指す要素の textContent を集めるやり方は、閉じた <details> の中のように読み上げに入らない文を見逃す
 */
async function accessibleInfo(page, locator) {
  await locator.evaluate((el) => el.setAttribute('data-ax-probe', '1'));
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-ax-probe="1"]' });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const n = nodes[0];
    return { name: n.name?.value ?? '', description: n.description?.value ?? '' };
  } finally {
    await locator.evaluate((el) => el.removeAttribute('data-ax-probe'));
    await cdp.detach();
  }
}

/**
 * 画面を移るときに渡した state（React Router の history.state.usr）を覚える。日の予定は受けた要対応の帯の state を履歴から消す
 * （戻る・読み直しで欄を開き直さない。PRD D403）ので、移った直後の history.state では読めない。押す前に呼び、移ったあと navUsr で読む
 */
async function watchNavUsr(page) {
  await page.evaluate(() => {
    window.__navUsr = null;
    if (window.__navUsrWatched) return;
    window.__navUsrWatched = true;
    for (const name of ['pushState', 'replaceState']) {
      const orig = history[name].bind(history);
      history[name] = (state, ...rest) => {
        if (state?.usr) window.__navUsr = state.usr;
        return orig(state, ...rest);
      };
    }
  });
}

/** watchNavUsr のあとに移ったときの state（無ければ null） */
const navUsr = (page) => page.evaluate(() => window.__navUsr ?? null);

module.exports = {
  accessibleInfo,
  watchNavUsr,
  navUsr,
  SCREENS,
  MENU_KEYS,
  TOOLS,
  goTo,
  clickMenu,
  moreId,
  openMore,
  findTool,
  closeMore,
  pressTool,
  openDetails,
  openScreenDetails,
  reveal,
  undoState,
  toolCount,
};
