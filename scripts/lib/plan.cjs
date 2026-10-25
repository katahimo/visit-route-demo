// e2e の共通：今日からの日に、保存した担当の入った訪問を用意する。
// 初期データは今日からの日を繰り返しの担当のまま（保存した訪問は空）にするので、「保存した訪問（data.visits）に
// 今日以降の担当の入った訪問がある」前提の確認の前に呼ぶ。
// 担当を組む（#/arrange）で週ごとに「伝えていない日をすべて組み直す」→ AI で組む → ［反映する］（実際の画面と同じ手順）。
// 組み方の標準は組むために一時的に登録し、元が無ければ消して元に戻す（標準が無い前提の確認が後にあるので）。
const { BASE, STORAGE_KEY, TODAY, settle } = require('./env.cjs');
const { markStandard } = require('./standard.cjs');

/** 日付に n 日足す（YYYY-MM-DD） */
function addDays(d, n) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** 組み方の標準を消す（planDays が登録したものを戻す）。読み直して store に取り込む */
async function clearStandard(page) {
  await page.goto(`${BASE}#/home`);
  await page.reload();
  await page.locator('h1').waitFor();
  await page.evaluate((key) => {
    const d = JSON.parse(localStorage.getItem(key));
    delete d.standard;
    localStorage.setItem(key, JSON.stringify(d));
  }, STORAGE_KEY);
  await page.reload();
  await page.locator('h1').waitFor();
}

/**
 * 今日から days 日（既定7日）を含む週を AI で組んで反映し、訪問に担当を保存する（今日より前の日は組まない）。
 * 終わったらホーム（#/home）を開いた状態で返る。keepStandard を true にすると標準を残す
 * @param {import('playwright').Page} page
 * @param {{ days?: number, keepStandard?: boolean }} [opt]
 */
async function planDays(page, { days = 7, keepStandard = false } = {}) {
  const hadStandard = await page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw !== null && JSON.parse(raw).standard !== undefined;
  }, STORAGE_KEY);
  await markStandard(page);
  // 今日の週、その次の週…（今日から days 日が入るまで）。週の範囲は ?d= の日が属する週（今日より前の日は対象にならない）
  const last = addDays(TODAY, days - 1);
  for (let from = TODAY; from <= last; from = addDays(from, 7 - ((new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7))) {
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
  if (!keepStandard && !hadStandard) await clearStandard(page);
  else {
    await page.goto(`${BASE}#/home`);
    await page.locator('h1').waitFor();
  }
}

module.exports = { planDays };
