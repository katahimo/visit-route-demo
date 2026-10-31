// ホームは無い・要対応の帯（PRD D390・D391。ADR-0074 段1）を本物のブラウザで確かめる（エキスパート機能が入）：
// 起動（#/・#/home・知らない URL）で予定の画面（繰り返しを使うなら月）へ移りホームの画面は出ない・ほかの画面の URL（人の画面など）と
// 古い #/schedule は今までどおり、予定の上の帯（担当なし・重なり・休みの人のほか 組み方の標準が無い・基本情報が変わった（組み直す）・
// 未確定 N日。文の並び・数・押した先（並びの先頭の種類：標準が無い→組み方の標準、組み直し→担当を組む、未確定は1日だけならその日の日の予定・
// 2日以上なら月の右の欄）・無ければ出さない）、
// 初期データ（版2。保存した訪問は空で、今日からの日は繰り返しの担当のまま・まだ伝えていない）、月の画面の ?do=attention・?do=unconfirmed で右の欄、
// 月の「問題の無い日をまとめて確定」（PRD D223。N日・確認に日付と残す日・確定済みになり帯の未確定が減る・担当が休みの訪問のある日は外れ確認に日付が出る・
// 未連絡の変更のある日は外れる・0日なら押せず理由）、確定した日の「次の確定していない日へ」（PRD D224）、
// 訪問の無い人の欠勤は要対応に数えない、メニュー（1400px）の5つにホームが無い・「その他 ▾」に空き状況、
// スマホ（390×844）で下のタブ（予定・〈利用者さん〉・〈スタッフ〉・組む・探す・メニュー）・横にはみ出さない。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-home.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const path = require('node:path');
const { answerConfirms } = require('./lib/confirmDialog.cjs');
const { BASE, OUT_DIR, NOW, TODAY, STORAGE_KEY, check, hashOf, runSteps, settle, until } = require('./lib/env.cjs');
const { sharedPage, openPage } = require('./lib/steps.cjs');
const { goTo, pressTool } = require('./lib/ui.cjs');
const { visitsIn } = require('./lib/visits.cjs');

const YM = TODAY.slice(0, 7);
/** 帯の見る日（今日から翌月末）にかかる月 */
const NEXT_YM = (() => {
  const t = new Date(`${YM}-01T00:00:00Z`);
  t.setUTCDate(32);
  return t.toISOString().slice(0, 7);
})();
/** d から n 日後（YYYY-MM-DD） */
function addDays(d, n) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
/** 初期データに案が入る日（今日から7日。PRD D225） */
const SEED_DAYS = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i));
/**
 * 初期データの担当・まとめて確定を確かめる月：今月に初期データで組んだ日が3日以上あれば今月、無ければ（月末）翌月
 * （月末の日は今月の組んだ日が今日だけになり、問題のある日・未連絡の変更のある日・確定する日を作れないため）
 */
const SYM = SEED_DAYS.filter((d) => d.slice(0, 7) === YM).length >= 3 ? YM : SEED_DAYS[6].slice(0, 7);
const WD = ['日', '月', '火', '水', '木', '金', '土'];
/** 「10/22（木）」（アプリの lib/dateText の dateText と同じ） */
const dayLabel = (d) =>
  `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}（${WD[new Date(`${d}T00:00:00Z`).getUTCDay()]}）`;

/** 予定の画面（月）が出る目印 */
const READY = '[data-testid="sched-nav"]';
/**
 * 画面を新しく開く。同じ文書の中で hash を移すと、読み直す前に `?do=` が処理されて消えることがあるので、
 * いったん about:blank に移ってから開く（読み直しはしない）。固定の秒数で待たず、目印と見出しの文が出るのを待つ
 */
const open = (page, hash, ready = READY) => goTo(page, hash, { ready: ready, timeout: 30000, h1: true, settleMs: 0 });
/** 文が出るまで待つ（出なければ時間切れで続け、呼ぶ側の check で落とす） */
async function waitText(locator, text, timeout = 10000) {
  await locator
    .filter({ hasText: text })
    .first()
    .waitFor({ timeout })
    .catch(() => {});
}

/** 保存したデータを消して初期データから始める */
async function reset(page) {
  if (page.url() === 'about:blank') await page.goto(`${BASE}#/data`);
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
}
/** 保存したデータ */
const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);

// ---- 要対応の帯 ----

/** 帯の文（出ていなければ null。計算が終わる前に出る途中の数は呼ぶ側で待つ） */
async function bandText(page) {
  const el = page.getByTestId('attention-band-text');
  return (await el.count()) === 0 ? null : ((await el.innerText()).trim() ?? null);
}
/** 帯の「未確定 N日」の N（無ければ 0） */
async function bandUnconfirmed(page) {
  const m = /未確定 (\d+)日/.exec((await bandText(page)) ?? '');
  return m ? Number(m[1]) : 0;
}
/** 帯が出る（または出ないと分かる）まで少し待つ。出ていれば true */
async function bandShown(page, ms = 8000) {
  return !!(await until(async () => (await page.getByTestId('attention-band').count()) > 0, ms));
}

/** 起動・ホーム・知らない URL は予定の画面へ（ホームの画面は出ない。PRD D390） */
async function start(page) {
  await reset(page);
  await open(page, '/');
  check(/^#\/month/.test(hashOf(page)), '起動（#/）で予定の画面（月。繰り返しを使う）へ', hashOf(page));
  await open(page, '/home');
  check(/^#\/month/.test(hashOf(page)), '#/home も予定の画面へ（ホームは無い）', hashOf(page));
  check((await page.getByTestId('home-tasks').count()) === 0, 'ホームの「今日やること」は出ない');
  await open(page, '/nowhere');
  check(/^#\/month/.test(hashOf(page)), '知らない URL も予定の画面へ', hashOf(page));
  await open(page, '/staff/s1', '[data-testid="person-view"]');
  check(hashOf(page).startsWith('#/staff/s1'), 'ほかの画面の URL（人の画面）はそのまま', hashOf(page));
  await open(page, '/schedule', '.app-header');
  check(hashOf(page).startsWith('#/plan'), '古い #/schedule は今までどおり日の予定へ', hashOf(page));
}

/** 別のタブで localStorage のデータを読み、node の中で書き換えて書き戻す（fn の戻り値を返す） */
async function editInOtherTab(page, fn) {
  const other = await page.context().newPage();
  await other.goto(`${BASE}#/data`);
  const data = await other.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
  const out = fn(data);
  await other.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: STORAGE_KEY, v: JSON.stringify(data) });
  await other.close();
  return out;
}

/** 訪問を持たず・標準も無い（帯は「組み方の標準が無い」だけ）データにする */
const emptyData = (data) => {
  data.visits = data.visits.map((v) => ({ ...v, cancelled: true }));
  data.patterns = [];
  data.snapshots = {};
  data.absences = [];
  delete data.standard;
};

/**
 * 帯の種類と押した先（PRD D391）。初期データ：担当なし（訪問）が先頭で、そこから日の予定でその訪問へ。
 * 訪問を空にすると「組み方の標準が無い」だけになり、押すと組み方の標準へ。標準を登録すると帯は消える。
 * 組み直しの知らせ（基本情報が最後に組んだあとに変わった）は標準があるときだけで、押すと担当を組む。
 * 未確定は日数で数え、1日だけならその日の日の予定、2日以上なら月の右の欄
 */
async function band(page) {
  await reset(page);
  await open(page, `/month?ym=${YM}`);
  check(await bandShown(page, 30000), '初期データ：予定の上に要対応の帯が出る');
  const first = await until(async () => /担当なし \d+件/.test((await bandText(page)) ?? ''), 60000);
  const text = (await bandText(page)) ?? '';
  check(!!first, '帯に「担当なし N件」（訪問の種類が先頭）', text);
  check(
    /組み方の標準が無い/.test(text) && /未確定 \d+日/.test(text),
    '標準が無い初期データ：「組み方の標準が無い」と「未確定 N日」も出る',
    text,
  );
  const order = ['担当なし', '重なり', '休みの人', '組み方の標準が無い', '基本情報が変わった', '未確定'];
  const at = order.map((k) => text.indexOf(k)).filter((i) => i >= 0);
  check(
    at.every((i, n) => n === 0 || at[n - 1] < i),
    '文の並び：訪問の種類 → 標準が無い／組み直し → 未確定',
    text,
  );
  check(
    (await page.getByTestId('attention-band').count()) === 1,
    '帯は1本（月の上）。週・日の予定にも同じ帯',
    await page.getByTestId('attention-band').count(),
  );
  for (const to of ['/week', '/plan']) {
    await open(page, to);
    check(await bandShown(page, 30000), `${to}：要対応の帯が出る`);
  }
  await page.screenshot({ path: path.join(OUT_DIR, 'band-first-1366.png') });
  // 押す → 日の予定でその訪問（担当なし）を選ぶ
  await open(page, `/month?ym=${YM}`);
  await page.getByTestId('attention-band').waitFor({ timeout: 30000 });
  await until(async () => /担当なし \d+件/.test((await bandText(page)) ?? ''), 60000);
  await page.getByTestId('attention-band').click();
  await page.waitForURL(/#\/plan/);
  await page.getByTestId('confirm-state').waitFor({ timeout: 60000 });
  check(/^#\/plan/.test(hashOf(page)), '帯を押す（先頭が担当なし）と日の予定へ', hashOf(page));

  // 訪問が無く標準も無い：「組み方の標準が無い」だけ → 組み方の標準へ
  await editInOtherTab(page, emptyData);
  await open(page, `/month?ym=${YM}`);
  check(await bandShown(page, 30000), '訪問が無くても標準が無ければ帯が出る');
  check((await bandText(page)) === '組み方の標準が無い', '帯は「組み方の標準が無い」だけ', await bandText(page));
  await page.getByTestId('attention-band').click();
  await page.waitForURL(/#\/standard/);
  check(hashOf(page) === '#/standard', '「組み方の標準が無い」を押すと組み方の標準へ', hashOf(page));

  // 標準を登録すると帯は消える（訪問も無い）
  await editInOtherTab(page, (d) => {
    emptyData(d);
    d.standard = { at: 1, presetId: d.scorePresetId ?? 'balance', from: d.baseDate, weeks: 1 };
  });
  await open(page, `/month?ym=${YM}`);
  await settle(page, 1500);
  check((await page.getByTestId('attention-band').count()) === 0, '標準があり何も無ければ帯は出ない');

  // 組み直しの知らせ：標準があり、最後に組んだ基本情報の鍵が今と違う → 「基本情報が変わった（組み直す）」→ 担当を組む（組む月）
  await page.evaluate(() => localStorage.setItem('vrdemo:arrange:basis', 'e2e-old-basis'));
  await open(page, `/month?ym=${YM}`);
  check(await bandShown(page, 30000), '組み直しの知らせで帯が出る');
  check(
    (await bandText(page)) === '基本情報が変わった（組み直す）',
    '帯は「基本情報が変わった（組み直す）」だけ',
    await bandText(page),
  );
  await page.getByTestId('attention-band').click();
  await page.waitForURL(/#\/arrange/);
  check(/^#\/arrange\?ym=\d{4}-\d{2}$/.test(hashOf(page)), '押すと担当を組む（組む月）へ', hashOf(page));
  // 標準が無い間は組み直しを知らせない（PRD D363）
  await editInOtherTab(page, (d) => emptyData(d));
  await open(page, `/month?ym=${YM}`);
  await bandShown(page, 30000);
  check((await bandText(page)) === '組み方の標準が無い', '標準が無い間は組み直しを知らせない', await bandText(page));
  await page.evaluate(() => localStorage.removeItem('vrdemo:arrange:basis'));
}

/** 初期データの未確定：帯の日数＝月の画面の今日以降の確定していない日（今月と翌月）。押すと月の右の欄 */
async function unconfirmed(page) {
  await reset(page);
  const p = await page.context().newPage();
  await p.clock.setFixedTime(NOW);
  try {
    await p.setViewportSize({ width: 1440, height: 1000 });
    let want = 0;
    for (const ym of [YM, NEXT_YM]) {
      const st = await cellStates(p, ym);
      want += Object.entries(st).filter(([d, s]) => d >= TODAY && s !== 'told' && s !== 'empty').length;
    }
    await open(p, `/month?ym=${YM}`);
    await p.getByTestId('attention-band').waitFor({ timeout: 30000 });
    const got = await until(async () => (await bandUnconfirmed(p)) === want, 60000);
    check(want >= 1 && !!got, '帯の「未確定 N日」＝月の画面の今日以降の確定していない日の数（今月＋翌月）', {
      band: await bandUnconfirmed(p),
      month: want,
    });
  } finally {
    await p.close();
  }
}

/** その月の日のマスの状態（日付 → data-state） */
async function cellStates(page, ym = YM) {
  await open(page, `/month?ym=${ym}&layout=calendar`, '[data-testid="month-day"]');
  await page.locator('[data-testid="month-aside"]').waitFor();
  return page
    .locator('[data-testid="month-day"]')
    .evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.date, e.dataset.state])));
}

/** データで、その日に担当のある〈スタッフ〉（保存した訪問の担当と、その曜日の繰り返しの担当） */
function busyStaff(data, d) {
  const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
  const busy = new Set();
  for (const v of data.visits) if (v.date === d && !v.cancelled && v.staffId) busy.add(v.staffId);
  for (const p of data.patterns)
    if (p.usualStaffId && p.weekdays.includes(wd) && p.from <= d && (!p.to || p.to >= d)) busy.add(p.usualStaffId);
  return busy;
}

/** 帯の今の「未確定 N日」を、月の画面の確定していない日数（今月と翌月）と同じになるまで待って返す */
async function bandUnconfirmedLike(p, states) {
  const want = Object.entries(states).filter(([d, s]) => d >= TODAY && s !== 'told' && s !== 'empty').length;
  await until(async () => (await bandUnconfirmed(p)) === want, 60000);
  return { band: await bandUnconfirmed(p), want };
}

/**
 * 初期データの担当（PRD D225）・問題の無い日をまとめて確定（D223）・次の確定していない日へ（D224）。
 * 確認ダイアログを開いたまま見るので、自動で答えない別のページで確かめる（同じ文脈なので localStorage は同じ）
 */
async function seedPlans(page) {
  await reset(page);
  const p = await page.context().newPage();
  await p.clock.setFixedTime(NOW);
  const native = [];
  p.on('dialog', (d) => {
    native.push(d.message());
    d.dismiss();
  });
  try {
    await p.setViewportSize({ width: 1440, height: 1000 });
    // 確かめる月（SYM）：ふだんは今月、月末は翌月
    const inMonth = SEED_DAYS.filter((d) => d.slice(0, 7) === SYM);
    const states = await cellStates(p, SYM);
    check(
      inMonth.length > 0 && inMonth.every((d) => states[d] === 'none' || states[d] === 'empty'),
      '初めて開くと今日から7日分（今月の分）の日のマスは「まだ伝えていない」（確定はしない）',
      inMonth.map((d) => `${d}:${states[d]}`),
    );
    const d0 = await stored(p);
    const info = {
      version: d0.version,
      snapshots: Object.keys(d0.snapshots).filter((x) => x >= TODAY).length,
      past: Object.keys(d0.snapshots).filter((x) => x < TODAY).length,
      saved: d0.visits.filter((v) => SEED_DAYS.includes(v.date) && !v.cancelled).length,
      visitsAll: d0.visits.length,
      usual: d0.patterns.filter((x) => x.usualStaffId).length,
      patterns: d0.patterns.length,
      old: ['aiPlans', 'manualPlans', 'aiRuns'].filter((x) => x in d0),
    };
    check(
      info.version === 3 &&
        info.snapshots === 0 &&
        info.past > 0 &&
        info.old.length === 0 &&
        info.saved === 0 &&
        info.visitsAll === 0 &&
        info.usual >= info.patterns * 0.5,
      '初期データ（版2）：保存した訪問は空（AI で組まない）で、今日からは繰り返しの担当のまま（計算した回）。過去の日は伝えた状態・今日からは伝えていない',
      info,
    );
    await p.screenshot({ path: path.join(OUT_DIR, 'month-first-run-1440.png'), fullPage: true });
    // 帯の未確定は今日以降の確定していない日（今月と翌月）
    const allStates = { ...(await cellStates(p, NEXT_YM)) };
    for (const [d, s] of Object.entries(await cellStates(p, YM))) allStates[d] = s;
    await open(p, `/month?ym=${SYM}`);
    const n0 = await bandUnconfirmedLike(p, allStates);
    check(n0.band === n0.want && n0.want >= 1, '初めて開いた帯の未確定＝月の今日以降の確定していない日数', n0);

    // 別のタブで、今日の次の日の担当1人を終日の欠勤にする（担当が休みの訪問＝要対応）。
    // もう1日（今月の最後の日）は伝えた内容を今と違うものにする（未連絡の変更あり）
    const bad = inMonth.find((d) => d > TODAY && states[d] !== 'empty') ?? inMonth[0];
    const rest = inMonth.filter((d) => d !== bad && d !== TODAY && states[d] !== 'empty');
    const changed = rest.length >= 2 ? rest[rest.length - 1] : null;
    const sid = await editInOtherTab(p, (data) => {
      const s = [...busyStaff(data, bad)][0];
      data.absences = [
        ...data.absences,
        { id: 'e2e-home-absent', staffId: s, date: bad, from: null, to: null, note: '' },
      ];
      // 伝えた内容に訪問が1件も無い（今の担当はどれも「入る」＝未連絡の変更あり）
      if (changed) data.snapshots[changed] = { date: changed, at: 1, visits: [] };
      return s;
    });
    check(!!sid, '欠勤にする担当のいる日がある', { bad, sid });
    const good = inMonth.filter((d) => d !== bad && d !== changed && states[d] !== 'empty');

    // 要対応がある：帯の先頭は「休みの人」を含む訪問の種類
    await open(p, `/month?ym=${SYM}`);
    await p.getByTestId('attention-band').waitFor({ timeout: 30000 });
    const withOff = await until(async () => /休みの人 \d+件/.test((await bandText(p)) ?? ''), 60000);
    check(!!withOff, '担当が休みの訪問があると帯に「休みの人 N件」', await bandText(p));

    // 月の右の欄の「確定していない日」：問題の無い日をまとめて確定（N日）。要対応の訪問のある日は数えない
    await open(p, `/month?ym=${SYM}&do=unconfirmed`, '[data-testid="month-unconfirmed"]');
    const btn = p.getByTestId('month-confirm-bulk');
    await btn.waitFor({ timeout: 10000 });
    await settle(p, 500);
    const targets = Number(await btn.getAttribute('data-count'));
    const now = await p
      .locator('[data-testid="month-day"]')
      .evaluateAll((els) =>
        Object.fromEntries(els.map((e) => [e.dataset.date, e.closest('td')?.classList.contains('is-care') ?? false])),
      );
    // 初期データでも担当の決まらない訪問のある日（要対応）はまとめて確定に入らない
    const okDays = good.filter((d) => !now[d]);
    check(
      targets === okDays.length && (await btn.innerText()).includes(`問題の無い日をまとめて確定（${targets}日）`),
      'まとめて確定：問題の無い日の数（担当が休みの訪問のある日・未連絡の変更のある日は数えない）',
      { targets, okDays, good, care: now },
    );
    if (targets > 0) {
      await btn.click();
      const dlg = p.getByTestId('confirm-dialog');
      await dlg.waitFor({ timeout: 5000 });
      const title = await p.getByTestId('confirm-title').innerText();
      const body = await p.getByTestId('confirm-body').innerText();
      check(
        title === `問題の無い ${targets}日を確定しますか？` &&
          okDays.every((d) => body.includes(dayLabel(d))) &&
          body.includes(`計 ${targets}日`),
        'まとめて確定の確認：見出しと日付（「10/22（木）・… 計 N日」）',
        { title, body },
      );
      check(
        body.includes(dayLabel(bad)) && /問題のある \d+日は残します/.test(body),
        'まとめて確定の確認：問題のある日は残し、日付を出す',
        body,
      );
      check(
        changed === null || body.includes('未連絡の変更のある 1日も残します'),
        'まとめて確定の確認：未連絡の変更のある日は残す',
        { changed, body },
      );
      check(
        (await p.evaluate(() => document.activeElement?.dataset.testid)) === 'confirm-cancel',
        'まとめて確定の確認：最初のフォーカスは取り消し（独自の確認）',
      );
      await settle(p, 400);
      await p.screenshot({ path: path.join(OUT_DIR, 'month-confirm-dialog.png') });
      // 取り消すと何も変わらない
      await p.getByTestId('confirm-cancel').click();
      await dlg.waitFor({ state: 'detached' });
      check(
        (await p.evaluate(
          ({ k, today }) => Object.keys(JSON.parse(localStorage.getItem(k)).snapshots).filter((x) => x >= today).length,
          { k: STORAGE_KEY, today: TODAY },
        )) === (changed ? 1 : 0),
        'まとめて確定の確認を取り消すと何も確定しない',
      );
      await btn.click();
      await p.getByTestId('confirm-ok').click();
      await p
        .locator('.toast')
        .filter({ hasText: `${targets}日を確定しました` })
        .waitFor({ timeout: 5000 });
      check(true, `知らせ「${targets}日を確定しました」`);
      await settle(p, 500);
      const after = await p
        .locator('[data-testid="month-day"]')
        .evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.date, e.dataset.state])));
      check(
        okDays.every((d) => after[d] === 'told') && after[bad] === 'none' && (!changed || after[changed] === 'changed'),
        'まとめて確定：問題の無い日は確定済み、問題のある日はまだ伝えていない・未連絡の変更のある日はそのまま',
        { good: okDays.map((d) => after[d]), bad: after[bad], changed: changed && after[changed] },
      );
      check(
        (await btn.isDisabled()) &&
          /問題の無い日がありません/.test(await p.getByTestId('month-confirm-why').innerText()),
        'まとめて確定：0日になると押せず、理由を見せる',
        await p
          .getByTestId('month-confirm-why')
          .innerText()
          .catch(() => ''),
      );
      // 帯の未確定が N日減る
      await open(p, `/month?ym=${SYM}`);
      await p.getByTestId('attention-band').waitFor({ timeout: 30000 });
      const reached = await until(async () => (await bandUnconfirmed(p)) === n0.want - targets, 60000);
      check(!!reached, 'まとめて確定のあと、帯の未確定が N日減る', {
        before: n0.want,
        after: await bandUnconfirmed(p),
        targets,
      });

      // 確定した日の「次の確定していない日へ」（PRD D224）：その日より後の最初の確定していない日へ
      const from = okDays[0];
      await open(p, `/plan?date=${from}`, '[data-testid="confirm-state"]');
      const next = p.getByTestId('plan-next-unconfirmed');
      await next.waitFor({ timeout: 15000 });
      const want = Object.keys(after)
        .filter((d) => d > from && d >= TODAY && after[d] !== 'told' && after[d] !== 'empty')
        .sort()[0];
      check(
        (await p.getByTestId('confirm-state').innerText()).includes('確定済み') &&
          (await next.getAttribute('data-date')) === want &&
          (await next.innerText()).includes(`次の確定していない日へ（${dayLabel(want).replace(/（.）$/, '')}）`),
        '確定済みの日に「次の確定していない日へ（M/D）」',
        { date: await next.getAttribute('data-date'), want, text: await next.innerText() },
      );
      await next.click();
      await p.waitForFunction((d) => document.querySelector('.date-switch select')?.value === d, want, {
        timeout: 10000,
      });
      check(true, '「次の確定していない日へ」でその日が開く');
      await p.screenshot({ path: path.join(OUT_DIR, 'plan-next-unconfirmed.png') });
    }
    check(native.length === 0, 'まとめて確定でブラウザのダイアログを出さない', native);
  } finally {
    await p.close();
  }
}

/** 月の予定の要対応の欄（行の日付と種類・帯の要対応の数・その日のマス） */
async function monthAttention(page, ym, date) {
  await open(page, `/month?ym=${ym}&layout=calendar&do=attention`, '[data-testid="month-aside"]');
  await page.getByTestId('progress-band').locator('[data-testid="band-attention"]').waitFor({ timeout: 30000 });
  await settle(page, 300);
  const rows = await page
    .locator('[data-testid="month-attention"] .month-attention-btn')
    .evaluateAll((els) => els.map((e) => `${e.dataset.date}:${e.dataset.kind}`));
  const band = Number(await page.getByTestId('band-attention').getAttribute('data-count'));
  const cell = page.locator(`[data-testid="month-day"][data-date="${date}"]`);
  return {
    rows,
    band,
    state: await cell.getAttribute('data-state'),
    care: await cell.evaluate((el) => el.closest('td').classList.contains('is-care')),
    absent: (await cell.locator('[data-testid="month-absent"]').count()) === 1,
  };
}

/**
 * 欠勤があっても、その人に訪問が無ければ要対応に数えない（版2：要対応は訪問ごと。ADR-0053）：担当の無い〈スタッフ〉の欠勤を
 * 別のタブで足し、マスに「欠」は出るが、要対応の帯・進み具合の帯・月の要対応の欄の数は変わらないことを確かめる
 */
async function handledAbsence(page) {
  await reset(page);
  const day = SEED_DAYS[1];
  const ym = day.slice(0, 7);
  const before = await monthAttention(page, ym, day);
  const bandBefore = await bandText(page);
  check(before.band === before.rows.length, '進み具合の帯と月の要対応の欄が同じ数（欠勤の前）', {
    band: before.band,
    rows: before.rows.length,
  });
  const setup = await editInOtherTab(page, (data) => {
    const busy = busyStaff(data, day);
    const free = data.staff.find((s) => !busy.has(s.id));
    if (!free) return { ok: false, why: '担当の無い人がいない' };
    // その日に勤務がある人の欠勤にする（マスの「欠」は勤務のある人の欠勤に出す）
    data.availability = [
      ...data.availability.filter((a) => !(a.staffId === free.id && a.date === day)),
      { staffId: free.id, date: day, slots: [{ start: '09:00', end: '17:00' }] },
    ];
    data.absences = [...data.absences, { id: 'e2e-free', staffId: free.id, date: day, from: null, to: null, note: '' }];
    return { ok: true, name: free.name };
  });
  check(setup.ok, '要対応の数え方：前提（担当の無い人の欠勤）', setup);
  const after = await monthAttention(page, ym, day);
  check(
    after.absent && JSON.stringify(after.rows) === JSON.stringify(before.rows) && after.care === before.care,
    '訪問の無い人の欠勤：マスに「欠」は出るが、要対応には数えない',
    { before, after },
  );
  check(after.band === after.rows.length, '進み具合の帯と月の要対応の欄が同じ数（欠勤のあと）', {
    band: after.band,
    rows: after.rows.length,
  });
  // 要対応の帯の文（担当なし・重なり・休みの人の数）も変わらない
  await open(page, `/month?ym=${ym}`);
  await page.getByTestId('attention-band').waitFor({ timeout: 30000 });
  const same = await until(async () => {
    const t = await bandText(page);
    return t !== null && t.replace(/未確定 \d+日/, '') === (bandBefore ?? '').replace(/未確定 \d+日/, '');
  }, 60000);
  check(!!same, '訪問の無い人の欠勤：要対応の帯の数も変わらない', { before: bandBefore, after: await bandText(page) });
  await page.screenshot({ path: path.join(OUT_DIR, 'month-free-absence.png') });
}

async function monthDo(page) {
  await open(page, `/month?ym=${YM}&do=attention`, '[data-testid="month-aside"]');
  await waitText(page.locator('.month-aside-title'), '要対応');
  await page
    .waitForFunction(() => document.activeElement?.dataset.testid === 'month-aside', null, { timeout: 5000 })
    .catch(() => {});
  check(
    hashOf(page) === `#/month?ym=${YM}` &&
      (await page.locator('.month-aside-title').first().innerText()).includes('要対応') &&
      (await page.evaluate(() => document.activeElement?.dataset.testid)) === 'month-aside',
    '月の予定 ?do=attention：右の欄の要対応へ（フォーカス）、?do= は消える',
    hashOf(page),
  );
  await open(page, `/month?ym=${YM}&staff=s1&do=unconfirmed`, '[data-testid="month-aside"]');
  await waitText(page.locator('.month-aside-title'), '確定していない日');
  check(
    hashOf(page) === `#/month?ym=${YM}` &&
      (await page.locator('.month-aside-title').first().innerText()).includes('確定していない日'),
    '月の予定 ?do=unconfirmed：全体の表示にして確定していない日へ',
    hashOf(page),
  );
  // 帯の「未確定」：標準があり、担当の入った訪問が離れた2日にだけある（要対応は無い）→ 帯は「未確定 2日」だけ。押すと月の右の欄の確定していない日。
  // 1日だけなら日の予定のその日へ
  const days = await editInOtherTab(page, (d) => {
    const picked = [];
    for (const day of SEED_DAYS.slice(1)) {
      const v = visitsIn(d, day, day).find((x) => x.staffId);
      if (v && picked.length < 2) picked.push(v);
    }
    emptyData(d);
    d.standard = { at: 1, presetId: d.scorePresetId ?? 'balance', from: d.baseDate, weeks: 1 };
    d.visits = picked.map((v) => ({ ...v, pattern: undefined }));
    return picked.map((v) => v.date);
  });
  check(days.length === 2, '前提：担当の入った訪問が2日ある', days);
  await open(page, `/month?ym=${days[0].slice(0, 7)}`);
  await bandShown(page, 30000);
  const only = await until(async () => (await bandText(page)) === '未確定 2日', 60000);
  check(!!only, '帯は「未確定 2日」だけ（要対応は無い）', await bandText(page));
  await page.getByTestId('attention-band').click();
  await page.getByTestId('month-unconfirmed').waitFor({ timeout: 30000 });
  check(
    hashOf(page) === `#/month?ym=${days[0].slice(0, 7)}` &&
      (await page.locator('.month-aside-title').first().innerText()).includes('確定していない日'),
    '「未確定 2日」を押すと月の右の欄の確定していない日へ（?do= は消える）',
    hashOf(page),
  );
  await editInOtherTab(page, (d) => {
    d.visits = d.visits.filter((v) => v.date === days[0]);
  });
  await open(page, `/month?ym=${days[0].slice(0, 7)}`);
  await until(async () => (await bandText(page)) === '未確定 1日', 60000);
  await page.getByTestId('attention-band').click();
  await page.waitForURL(/#\/plan/);
  await page.getByTestId('confirm-state').waitFor({ timeout: 60000 });
  check(
    (await page.locator('.date-switch select').inputValue()) === days[0],
    '「未確定 1日」だけなら日の予定のその日へ',
    await page.locator('.date-switch select').inputValue(),
  );
}

/** メニュー（1400px）：5つにホームが無い。「その他 ▾」に空き状況、欠勤・キャンセルは操作の行から */
async function wide(page) {
  await reset(page);
  await page.setViewportSize({ width: 1400, height: 1000 });
  await open(page, `/month?ym=${YM}`);
  const labels = await page.locator('.side-nav [data-testid="nav-link"]').allInnerTexts();
  check(
    !labels.some((l) => l.includes('ホーム')) && labels[0].trim() === '予定',
    '広い画面：メニューの先頭は「予定」でホームは無い',
    labels,
  );
  check(
    (await page.locator('.side-nav [aria-current="page"]').first().innerText()).trim() === '予定',
    '広い画面：月の予定では「予定」に印',
  );
  await pressTool(page, '空き状況', { where: 'more' });
  await page.waitForURL(/#\/vacancy/);
  check(hashOf(page) === '#/vacancy', '予定の「その他 ▾」の「空き状況」で空き状況へ', hashOf(page));
  check(
    (await page.locator('.side-nav [aria-current="page"]').first().innerText()).trim() === '予定',
    '空き状況の画面では「予定」に印',
  );
  await open(page, `/month?ym=${YM}`);
  await pressTool(page, '欠勤', { where: 'row' });
  await page.waitForURL(/#\/plan/);
  await page.locator('.date-switch select').waitFor();
  check((await page.locator('.date-switch select').inputValue()) === TODAY, '欠勤・キャンセルを登録 → 今日の日の予定');
  await page.screenshot({ path: path.join(OUT_DIR, 'menu-wide.png'), fullPage: true });
}

/** スマホ：下のタブ（予定・〈利用者さん〉・〈スタッフ〉・組む・探す・メニュー）・#/home は予定へ・横にはみ出さない */
async function mobile(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/home');
  check(/^#\/month/.test(hashOf(page)), 'スマホ：#/home は予定の画面へ', hashOf(page));
  const terms = (await stored(page)).org.terms;
  const labels = await page.locator('.bottom-tabs .bottom-tab').allInnerTexts();
  check(
    JSON.stringify(labels.map((l) => l.trim())) ===
      JSON.stringify(['予定', terms.client, terms.staff, '組む', '探す', 'メニュー']),
    'スマホ：下のタブは 予定・〈利用者さん〉・〈スタッフ〉・組む・探す・メニュー',
    labels,
  );
  const active = await page.locator('.bottom-tab.active[aria-current="page"]').allInnerTexts();
  check(JSON.stringify(active) === '["予定"]', 'スマホ：予定のタブが active', active);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  check(scrollW <= 390, 'スマホ：横にはみ出さない', scrollW);
  await page.screenshot({ path: path.join(OUT_DIR, 'month-mobile.png') });
  await page.setViewportSize({ width: 1366, height: 768 });
}

const steps = sharedPage({
  open: async () => {
    const s = await openPage();
    // 確認は独自のダイアログで受ける（ネイティブのダイアログが出たら失敗。PRD D146）
    return { ...s, dlg: await answerConfirms(s.page) };
  },
  steps: [
    ['start', start],
    ['band', band],
    ['unconfirmed', unconfirmed],
    ['seed-plans', seedPlans],
    ['handled-absence', handledAbsence],
    ['month-do', monthDo],
    ['wide', wide],
    ['mobile', mobile],
  ],
  after: ({ dlg }) => check(dlg.native.length === 0, 'ブラウザのダイアログを出さない', dlg.native),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
