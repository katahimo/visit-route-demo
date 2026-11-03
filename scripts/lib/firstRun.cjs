// e2e の共通：最初の2問（PRD D379〜D381。ADR-0073）に答える。
// 初めて開いたとき（保存データも印「all」も無い。scripts/lib/startFeatures.cjs）は2問の画面が出る。
// 画面の data-testid：first-run（画面）・first-run-start-<demo|own>（問1）・first-run-use-<oneOff|basic|laborContract|monthlyField>（問2：使い方）・first-run-submit（はじめる）
const { BASE, STORAGE_KEY, settle, until } = require('./env.cjs');
const { openPage } = require('./steps.cjs');
const { answerConfirms } = require('./confirmDialog.cjs');

/** 自動の組みの終わりの知らせ（lib/autoArrangeBatch の autoDoneText） */
const ARRANGED_RE = /件の担当を組みました|担当なしのまま|自動で組めませんでした/;

/**
 * デモを作った直後の1回の組み（PRD D409。ADR-0079）が終わるまで待つ（終わりの知らせが出るまで。最長 ms）。
 * 組みは画面の中で続くので、終わる前に読み直す・移ると組まれない。知らせの文を返す（出なければ空）。
 * 組む担当なしが無いデモ（単発のデモは担当つきで作る）は依頼が出ず知らせも出ないので、組んでいる間の帯（auto-band。
 * 組み始めて 600ms で出る）も要対応の帯の［要対応を組む］も3秒続けて無ければ、組むものが無いとして空を返す
 */
async function waitStartArranged(page, ms = 180000) {
  const toastText = async () =>
    (await page.locator('.toast-layer .toast-text').allInnerTexts()).find((t) => ARRANGED_RE.test(t));
  let idleSince = null;
  const text = await until(
    async () => {
      const t = await toastText();
      if (t) return t;
      const busy =
        (await page.getByTestId('auto-band').count()) > 0 ||
        (await page.getByTestId('attention-band-arrange').count()) > 0;
      if (busy) idleSince = null;
      else idleSince ??= Date.now();
      return idleSince !== null && Date.now() - idleSince >= 3000 ? 'idle' : undefined;
    },
    ms,
    100,
  );
  return text && text !== 'idle' ? text : '';
}

/**
 * 2問に答えて「はじめる」を押す（既定は 問1＝デモで試す・問2＝使い方の基本。今の初期データ＋「定期の訪問（基本）」のひな形）。
 * デモなら、作った直後の1回の組みが終わるまで待つ（waitStartArranged）。arranged が false なら、終わりの知らせの［元に戻す］で
 * 組む前（初期データの担当なしが残る）に戻す（要対応の帯の［要対応を組む］や、空いている人への自動の組みを確かめるとき）
 */
async function answerFirstRun(page, { start = 'demo', use = 'basic', arranged = true } = {}) {
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  await page.getByTestId(`first-run-start-${start}`).check();
  await page.getByTestId(`first-run-use-${use}`).check();
  await page.getByTestId('first-run-submit').click();
  await page.getByTestId('first-run').waitFor({ state: 'detached', timeout: 30000 });
  if (start !== 'demo') return;
  const text = await waitStartArranged(page);
  if (arranged || !/件の担当を組みました/.test(text)) return;
  await page.getByTestId('toast-undo').first().click();
  await until(
    async () => (await page.locator('.toast-layer .toast-text').allInnerTexts()).some((t) => /^元に戻しました/.test(t)),
    10000,
  );
  // 戻したデータの保存（300ms 間引き）を待つ
  await settle(page, 600);
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

/**
 * 保存データを消して初期データから開く（2問が出るので answer で答える。既定はデモ×定期＝「基本」のひな形＝エキスパート機能は切）。
 * 答えたら最初の画面へ移るので、行き先（to）を開き直して ready を待つ
 */
async function freshAsked(page, to, ready, answer) {
  await page.goto(`${BASE}#/data`);
  await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
  await page.goto(`${BASE}#${to}`);
  await page.reload();
  if (await answerIfAsked(page, ready, answer)) {
    await page.goto('about:blank');
    await page.goto(`${BASE}#${to}`);
  }
  await page.locator(ready).first().waitFor({ timeout: 60000 });
  await settle(page, 400);
}

/** 準備（sharedPage の open）：2問を出す文脈で開く（印「all」を入れない）。時計は NOW に止め、確認は独自のダイアログで受ける */
async function openAsked({ viewport = { width: 1400, height: 1000 } } = {}) {
  const s = await openPage({ viewport, start: 'ask' });
  return { ...s, dlg: await answerConfirms(s.page) };
}

module.exports = { ARRANGED_RE, answerFirstRun, answerIfAsked, freshAsked, openAsked, waitStartArranged };
