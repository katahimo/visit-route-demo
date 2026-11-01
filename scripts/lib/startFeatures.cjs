// e2e の共通：初めて開いたとき（保存データが無い）に最初の2問を出さず、今の初期データ＋機能すべて入で始める（PRD D379。ADR-0045・ADR-0073）。
// アプリは保存データが無いと最初の2問を出すが、多くの e2e は今の初期データ（定期）・全部の機能が入っている前提で書いている。
// 文脈（browser.newContext）か page に渡す。どのページを開いても（読み直し・localStorage.clear() のあとも）アプリより先に印を入れる。
// skipTour（tourSeen.cjs）が既定でいっしょに呼ぶ。2問を確かめるとき（e2e-tour）は skipTour(ctx, { start: 'ask' }) か、どちらも呼ばない

/** store/start.ts の FEATURES_START_KEY・FEATURES_START_ALL と同じ */
const FEATURES_START_KEY = 'vrdemo:features:start';
const FEATURES_START_ALL = 'all';

/** newContext（または newPage）のすぐあとで呼ぶ */
async function startAll(target) {
  await target.addInitScript(
    ([k, v]) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        // about:blank などでは localStorage が使えない
      }
    },
    [FEATURES_START_KEY, FEATURES_START_ALL],
  );
}

module.exports = { startAll, FEATURES_START_KEY, FEATURES_START_ALL };
