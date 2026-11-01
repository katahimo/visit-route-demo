// e2e の共通：初めて開いたとき（保存データが無い）に最初の2問（PRD D379。ADR-0073）を出さず、初期データ＋すべて入で始める。
// 文脈（browser.newContext）か page に渡す。どのページを開いても（読み直し・localStorage.clear() のあとも）
// アプリより先に印「all」（startFeatures.cjs）を入れるので、2問が確かめを止めない。
// 2問の画面そのものを確かめるとき（e2e-tour）は { start: 'ask' }（印を入れない。答えるのは scripts/lib/firstRun.cjs）
const { startAll } = require('./startFeatures.cjs');

/** newContext（または newPage）のすぐあとで呼ぶ。start：'all'＝2問を出さずすべて入（既定）・'ask'＝印を入れない（2問を出す） */
async function skipTour(target, { start = 'all' } = {}) {
  if (start === 'all') await startAll(target);
}

module.exports = { skipTour };
