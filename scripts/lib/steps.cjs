// e2e の共通：段（steps）の型（ADR-0029・ADR-0041）。
// スクリプトは `module.exports = { steps }`（[段の名前, 関数] の並び）を出し、
// 単独の実行では `if (require.main === module) runSteps(steps)`、包み（e2e/legacy.spec.ts）では段ごとに test.step で回す。
// 段の中身（guard の中）で投げたら、段の名前の確かめ（NG）とスクリーンショットにして続ける。
// 準備（ブラウザ・文脈を開く）・段ごとの文脈を開く所・後始末で投げたら、そこで止める（test は落ちる。単独なら終了コード1）
const { launch, NOW, check, failShot, recentChecks, watchErrors, withTimeout } = require('./env.cjs');
const { skipTour } = require('./tourSeen.cjs');
const { answerConfirms, watchNative } = require('./confirmDialog.cjs');

/**
 * 1つの段の上限（ミリ秒。E2E_STEP_TIMEOUT_MS で変える）。ページが固まると Playwright の待ちが自分の時間切れでも
 * 戻らないことがあるので、段を時間切れの NG にして次の段へ進む
 */
const STEP_LIMIT_MS = Number(process.env.E2E_STEP_TIMEOUT_MS || 3 * 60 * 1000);

/** 投げたときの理由（1行目だけ） */
const firstLine = (e) => String(e).split('\n')[0];
/** 投げたときの理由（message） */
const message = (e) => String(e?.message || e);

/** 段の時間切れの印（guard が返す） */
const TIMED_OUT = 'timeout';
const STEP_TIMEOUT_TEXT = `段が ${STEP_LIMIT_MS / 1000}秒で終わらない`;

/**
 * fn を包み、投げたら check(false, label, info(e)) とスクリーンショット（page() があれば <名前>-fail-<shot>.png）にする。
 * 時間切れなら TIMED_OUT を返す（呼ぶ側で文脈を閉じる。固まったページで次の段を走らせない）
 */
function guard(fn, { label, info = message, page, shot = label }) {
  return async (...args) => {
    // 時間切れのあとも裏で動き続ける段の失敗は、拾わずに捨てる（test の外の未処理の失敗にしない）
    const run = Promise.resolve().then(() => fn(...args));
    run.catch(() => {});
    try {
      await withTimeout(run, STEP_LIMIT_MS, STEP_TIMEOUT_TEXT);
      return undefined;
    } catch (e) {
      const timedOut = String(e?.message || e).includes(STEP_TIMEOUT_TEXT);
      const p = page?.();
      // 時間切れは、直前に通った確かめと開いているページの URL を添える（CI の記録だけでどこで止まったか分かるように。
      // url() はページの中を待たないので、固まったページでも読める）
      const where = timedOut
        ? `  直前の確かめ：${recentChecks.slice(0, 2).join(' ／ ') || 'なし'}  開いているページ：${
            p
              ? p
                  .context()
                  .pages()
                  .map((x) => x.url())
                  .join(' , ')
              : '不明'
          }`
        : '';
      check(false, label, `${info(e)}${where}`);
      if (p && !timedOut) await withTimeout(failShot(p, shot), 10 * 1000, 'スクリーンショット').catch(() => {});
      return timedOut ? TIMED_OUT : undefined;
    }
  };
}

/** 文脈を閉じる（固まったページでも 30秒で先へ） */
const closeContext = (ctx) => (ctx ? withTimeout(ctx.close(), 30 * 1000, '文脈を閉じる').catch(() => {}) : undefined);

/**
 * ブラウザ・文脈・ページを開く（多くのスクリプトの準備）：最初の2問を出さない扱い（PRD D379。start は skipTour へ）・
 * ページの時計を NOW に止める・ページのエラーを集める（env.cjs の pageErrors）
 */
async function openPage({
  viewport = { width: 1400, height: 1000 },
  context = {},
  clock = true,
  logErrors = true,
  start = 'all',
} = {}) {
  const b = await launch();
  const ctx = await b.newContext({ viewport, ...context });
  await skipTour(ctx, { start });
  await blockGeocode(ctx);
  const page = await ctx.newPage();
  if (clock) await page.clock.setFixedTime(NOW);
  watchErrors(page, { log: logErrors });
  return { b, ctx, page };
}

/** 地図のタイル（国土地理院・OpenStreetMap）は外へ取りに行かない */
const blockTiles = (ctx) =>
  ctx.route(/cyberjapandata|tile\.openstreetmap/, (r) => r.fulfill({ status: 204, body: '' }));

/**
 * 郵便番号・住所の検索（郵便番号検索・国土地理院）も外へ出さず「見つからない」を返す（名簿を読み込むと自動で探すので。
 * PRD D427）。偽の応答で確かめるスクリプト（e2e-address）はページの page.route が先に当たる
 */
const blockGeocode = (ctx) =>
  ctx.route(/zipcloud\.ibsnet\.co\.jp|msearch\.gsi\.go\.jp/, (r) => {
    const url = new URL(r.request().url());
    const body = JSON.stringify(
      url.hostname.startsWith('zipcloud') ? { status: 200, message: null, results: null } : [],
    );
    const cb = url.searchParams.get('callback');
    return r
      .fulfill({
        status: 200,
        contentType: cb ? 'text/javascript' : 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: cb ? `${cb}(${body})` : body,
      })
      .catch(() => {});
  });

/**
 * pagePerStep の段ごとの文脈とページを開く：最初の2問を出さない扱い・地図のタイルを取りに行かない・ページの時計を NOW に止める・
 * ページのエラーを pageErrors に集める。確認は独自のダイアログで受け（dlg。answerConfirms）、confirms: false なら
 * 答えずにネイティブのダイアログだけ記録する（dlg.native）
 */
async function openContext(
  b,
  { viewport = { width: 1280, height: 900 }, context = {}, clock = true, confirms = true } = {},
) {
  const ctx = await b.newContext({ viewport, ...context });
  await skipTour(ctx);
  await blockTiles(ctx);
  await blockGeocode(ctx);
  const page = await ctx.newPage();
  if (clock) await page.clock.setFixedTime(NOW);
  watchErrors(page);
  const dlg = confirms ? await answerConfirms(page) : { native: watchNative(page) };
  return { ctx, page, dlg };
}

/**
 * 1つのページを段で使い回す型。
 *   open  … 準備（既定 openPage()）。返したもの s が段に渡る（s.page は必須）
 *   steps … [名前, fn] の並び。call(fn, s) で呼ぶ（既定 fn(s.page)）。投げたら check(false, 名前, info(理由))
 *   after … 全部の段のあとの確かめ（s を受ける）
 */
function sharedPage({ open = () => openPage(), steps, after, call = (fn, s) => fn(s.page), info = message }) {
  const s = {};
  return [
    [
      '準備',
      async () => {
        Object.assign(s, await open());
      },
    ],
    ...steps.map(([name, fn]) => [
      name,
      async () => {
        // 前の段が時間切れなら、固まったページで走らせない（文脈はもう閉じた）
        if (s.timedOut) {
          check(false, `${name}：前の段（${s.timedOut}）が時間切れで走らせない`);
          return;
        }
        if ((await guard(() => call(fn, s), { label: name, info, page: () => s.page })()) === TIMED_OUT) {
          s.timedOut = name;
          await closeContext(s.ctx);
        }
      },
    ]),
    ...(after ? [['後始末', () => after(s)]] : []),
  ];
}

/**
 * 段ごとに新しい文脈とページを開く型（段の名前は関数の名前）。
 *   open(b, fn) … 文脈とページを開く（fn はこれから走らせる段）。{ ctx, page, ... } を返す（段のあとで ctx を閉じる）
 *   steps       … 関数の並び。call(fn, s) で呼ぶ（既定 fn(s.page)）
 *   label(name) … 投げたときの確かめの名前（理由は1行目だけ）
 *   after(name, s) … 段ごとの最後の確かめ
 *   end         … 全部の段のあとの確かめ
 */
function pagePerStep({ open, steps, label, after, end, call = (fn, s) => fn(s.page) }) {
  let b = null;
  return [
    [
      '準備',
      async () => {
        b = await launch();
      },
    ],
    ...steps.map((fn) => [
      fn.name,
      async () => {
        const s = await open(b, fn);
        await guard(() => call(fn, s), { label: label(fn.name), info: firstLine, page: () => s.page, shot: fn.name })();
        await after?.(fn.name, s);
        // 固まったページでも閉じて先へ進む（次の段は新しい文脈）
        await closeContext(s.ctx);
      },
    ]),
    ...(end ? [['後始末', end]] : []),
  ];
}

module.exports = {
  guard,
  closeContext,
  firstLine,
  message,
  blockTiles,
  openPage,
  openContext,
  sharedPage,
  pagePerStep,
};
