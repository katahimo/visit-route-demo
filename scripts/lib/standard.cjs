// e2e の共通：組み方の標準を登録したデータにする（ADR-0065）。
// 標準が無い間は担当を組む（#/arrange）で範囲にかかわらず「AI で組む」を出さないので、arrange-start などを使う確認の前に呼ぶ。
// データの書き換えはデータの画面（#/data）で行い、読み直して store に取り込む（データの画面は開くだけではデータを書かない）。
const { BASE, STORAGE_KEY } = require('./env.cjs');

/** 保存したデータに組み方の標準を入れて読み直す（考え方は今の点数の基準、期間は基準日から1週） */
async function markStandard(page) {
  await page.goto(`${BASE}#/data`);
  await page.reload();
  await page.locator('h1').waitFor();
  await page.evaluate((key) => {
    const d = JSON.parse(localStorage.getItem(key));
    d.standard = { at: 1, presetId: d.scorePresetId, from: d.baseDate, weeks: 1 };
    localStorage.setItem(key, JSON.stringify(d));
  }, STORAGE_KEY);
  await page.reload();
  await page.locator('h1').waitFor();
}

module.exports = { markStandard };
