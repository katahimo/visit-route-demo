// e2e の共通：最初の2問（PRD D379〜D381。ADR-0073）に答える。
// 初めて開いたとき（保存データも印「all」も無い。scripts/lib/startFeatures.cjs）は2問の画面が出る。
// 画面の data-testid：first-run（画面）・first-run-start-<demo|own>（問1）・first-run-booking-<oneOff|regular>（問2）・first-run-submit（はじめる）

/** 2問に答えて「はじめる」を押す（既定は 問1＝デモで試す・問2＝定期の訪問が中心。今までの初期データ＋「基本」のひな形と同じ） */
async function answerFirstRun(page, { start = 'demo', booking = 'regular' } = {}) {
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  await page.getByTestId(`first-run-start-${start}`).check();
  await page.getByTestId(`first-run-booking-${booking}`).check();
  await page.getByTestId('first-run-submit').click();
  await page.getByTestId('first-run').waitFor({ state: 'detached', timeout: 30000 });
}

/**
 * 2問が出たら答える（出なければ何もしない）。ready は2問のあとに出る画面の目印。
 * 答えたかを返す（答えたあとは最初の画面へ移っているので、行きたい画面があれば呼ぶ側で開き直す）
 */
async function answerIfAsked(page, ready, answer) {
  await page.locator(`[data-testid="first-run"], ${ready}`).first().waitFor({ timeout: 60000 });
  if (
    !(await page
      .getByTestId('first-run')
      .isVisible()
      .catch(() => false))
  )
    return false;
  await answerFirstRun(page, answer);
  return true;
}

module.exports = { answerFirstRun, answerIfAsked };
