// e2e の共通：今日からの日に、保存した担当の入った訪問を用意する。
// 初期データは今日からの日を繰り返しの担当のまま（保存した訪問は空）にするので、「保存した訪問（data.visits）に
// 今日以降の担当の入った訪問がある」前提の確認の前に呼ぶ。
// 担当を組む（#/arrange）で週ごとに「伝えていない日をすべて組み直す」→ AI で組む → ［反映する］（実際の画面と同じ手順）。
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { BASE, STORAGE_KEY, TODAY, settle } = require('./env.cjs');

/** 日付に n 日足す（YYYY-MM-DD） */
function addDays(d, n) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** cache 用：初期データから組んだ結果（データの JSON）。キーは今日・日数 */
const cached = new Map();
/**
 * cache 用のファイルの置き場所（e2e/legacy.spec.ts が test-results の下を渡す。実行のたびに消える）。
 * 同じ実行のほかのスクリプト・worker とも結果を分け合う。空なら同じプロセスの中だけ
 */
const CACHE_DIR = process.env.E2E_PLAN_CACHE_DIR || '';

/** 配信しているビルドの印（読み込んでいるスクリプトの名前。vite は中身のハッシュを名前に入れる） */
const buildOf = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('script[src]')]
      .map((s) => s.getAttribute('src'))
      .sort()
      .join(','),
  );
/** cache のファイルの道（今日・日数・ビルドで分ける） */
const cacheFile = (key, build) =>
  path.join(CACHE_DIR, `plan-${crypto.createHash('sha1').update(`${key}|${build}`).digest('hex').slice(0, 16)}.json`);
function readCache(key, build) {
  if (cached.has(key)) return cached.get(key);
  if (!CACHE_DIR) return undefined;
  try {
    return fs.readFileSync(cacheFile(key, build), 'utf8');
  } catch {
    return undefined;
  }
}
function writeCache(key, build, value) {
  cached.set(key, value);
  if (!CACHE_DIR) return;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // 同時に書く worker があっても、読む側が書きかけを読まないように別の名前で書いてから移す
  const file = cacheFile(key, build);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, value);
  fs.renameSync(tmp, file);
}

/** ほかの worker が同じ結果を組んでいる間、待つ長さの上限（組み終わらなければ自分で組む） */
const LOCK_WAIT_MS = 150 * 1000;

/**
 * 同じ実行のほかの worker が同じ結果を組んでいるなら、組み終わるまで待って結果を返す（同時に何本も AI で組んで遅くしない）。
 * 誰も組んでいなければ印（.lock）を置いて undefined を返し、自分で組む（終わったら release で印を外す）
 */
async function claimOrWait(key, build) {
  const lock = `${cacheFile(key, build)}.lock`;
  const release = () => fs.rmSync(lock, { force: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
    return { release };
  } catch {
    // ほかの worker が組んでいる
  }
  const end = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < end) {
    const v = readCache(key, build);
    if (v !== undefined) return { value: v };
    // 組んでいた worker が失敗して印を外した：自分で組む
    if (!fs.existsSync(lock)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { release: () => {} };
}

/** 担当を組む（#/arrange）で今日からの週を AI で組んで反映する（planDays の中身） */
async function arrangeDays(page, days) {
  // 今日の週、その次の週…（今日から days 日が入るまで）。週の範囲は ?d= の日が属する週（今日より前の日は対象にならない）
  const last = addDays(TODAY, days - 1);
  for (
    let from = TODAY;
    from <= last;
    from = addDays(from, 7 - ((new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7))
  ) {
    await page.goto(`${BASE}#/arrange?d=${from}`);
    await page.reload();
    await page.getByTestId('arrange-start').waitFor({ timeout: 30000 });
    await settle(page, 300);
    await page.getByTestId('arrange-mode-all').check();
    await page.getByTestId('arrange-start').click();
    const band = page.locator('[data-testid="proposal-band"][data-kind="range"]');
    await band.waitFor({ timeout: 150000 });
    await band.getByTestId('proposal-apply').click();
    await band.waitFor({ state: 'detached', timeout: 10000 });
    await settle(page, 300);
  }
  await page.goto(`${BASE}#/data`);
  await page.locator('h1').waitFor();
}

/** 結果のデータを書き込んで読み直す（cache の写しを使うとき） */
async function writeData(page, json) {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, json]);
  await page.reload();
  await page.locator('h1').waitFor();
}

/**
 * 今日から days 日（既定7日）を含む週を AI で組んで反映し、訪問に担当を保存する（今日より前の日は組まない）。
 * 終わったらデータの画面（#/data）を開いた状態で返る
 * @param {import('playwright').Page} page
 * cache を true にすると、2回目からは1回目の結果のデータをそのまま書き込む（速い）。同じプロセスの中と、
 * E2E_PLAN_CACHE_DIR があれば同じ実行のほかのスクリプトとも分け合う（同じビルド・同じ今日のときだけ。
 * ほかの worker が組んでいる最中なら、組み終わるのを待つ）。
 * 使えるのは「初期データ（localStorage を消した直後・新しい文脈）から組む」ときだけ。画面の手順そのものは e2e-arrange が確かめる
 * @param {{ days?: number, cache?: boolean }} [opt]
 */
async function planDays(page, { days = 7, cache = false } = {}) {
  const key = `${TODAY}:${days}`;
  // 最初の文書が about:blank でも localStorage を読めるように、先にデータの画面を開く
  await page.goto(`${BASE}#/data`);
  await page.locator('h1').waitFor();
  if (!cache) {
    await arrangeDays(page, days);
    return;
  }
  const build = await buildOf(page);
  let hit = readCache(key, build);
  let release = () => {};
  if (hit === undefined && CACHE_DIR) ({ value: hit, release = release } = await claimOrWait(key, build));
  if (hit !== undefined) {
    await writeData(page, hit);
    return;
  }
  try {
    await arrangeDays(page, days);
    writeCache(key, build, await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY));
  } finally {
    release();
  }
}

module.exports = { planDays };
