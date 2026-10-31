// 最初の2問と案内ツアー（PRD D189〜D193・D379〜D381。ADR-0025・ADR-0045・ADR-0073）を本物のブラウザで確かめる：
// 最初の2問（初めて開く＝保存データも印「all」も無いと、案内ツアーは自動で出ず、1画面に2問と主ボタン「はじめる」だけ。答えるまでデータを書かない・
// 読み直してもまた2問・Tab は選んだ方だけ・矢印で選び直す）・デモ×定期（今の初期データ・利用者さん／スタッフ・「基本」・最初は月）・
// デモ×単発（架空の単発の予約が今日から2週間分・お客様／シッター・「単発のみ」・最初は週）・
// 自分のデータ（空のデータ＋3段の登録の案内：上に「1/3」・①②は「CSV・Excel を読み込む」（名簿の欄）と「1人ずつ入れる」（追加の画面）・③は予定へ・
// 空のデータで月・週・日・一覧・設定などが壊れない）・印「all」（scripts/lib/startFeatures.cjs）があれば2問を出さず今の初期データ＋すべて入・
// 設定の「最初の設定をやり直す」（確認の文は元に戻す Ctrl+Z の対象外・先に書き出す案内 → 2問へ戻る → 答えでデータを作り直す・控えが残る）、
// 案内ツアー（データの画面の「案内をもう一度見る」から開く：role="dialog"・aria-modal・見出しと本文・1 / 3・最初のフォーカスは「次へ」・
// 裏の inert とスクロールのロック・「戻る」は最初の枚で押せない・Tab と Shift+Tab が中で回る・開いている間は Ctrl+K でパレットを開かない・
// 3枚（ホーム・予定・欠勤。PRD D277）・予定の枚は3段の説明・最後の枚は主ボタン「今日の予定を開く」・「閉じる」（とばすは出さない。PRD D226）・
// Esc と「とばす」・閉じるとフォーカスが「案内をもう一度見る」へ・「今日の予定を開く」で今日の日の画面・390px で収まる・印刷で出さない）、
// データの画面のファイル選択（すべて同じ部品・日本語のボタン「ファイルを選ぶ」と未選択の文・ブラウザ標準の input は見えない・
// input はボタンと同じ大きさ・入力欄の名前（何を読み込むか＋ファイルを選ぶ）・Tab で届きフォーカスの枠・Space で選ぶ画面・控え（JSON）を選ぶと確認と
// ファイル名・取り消してもデータはそのまま・確定で読み込む・Excel の壊れたファイルは誤りの文・名簿は一覧へのリンク）、
// 月の画面の日ごとの一覧（390px ははじめ一覧で横にはみ出さず土曜も見える・今日の行が画面に入る・「今日へ」・切り替えは操作の欄より上・行の読み上げ・押すとその日の訪問の下から出る欄（日の予定へは移らない）→ 欄の「この日の日の予定を開く」でその日の日の画面・
// カレンダーへ切り替えると URL の ?layout=calendar・読み直しても同じ・戻すと ?layout=list（押したら必ず書く）・1400px ははじめカレンダー・
// ?layout=list で一覧・「休みを入れる」の行は押すと希望休を付け外し・印刷の画面は今のまま）、
// データを守る（PRD D227。ADR-0032）：初期状態に戻したあと「直前の状態に戻す」で戻る（確認の本文に控えの文・欄の文・もう一度戻せる）・
// 書き出すと「最後に書き出した日」が今日になる（download）・「古い案と記録を片づける」で古い記録が消え新しいものは残る・
// 保存していたデータが壊れていると起動時の知らせ（閉じられる）と「読めなかったデータを書き出す」（元の文字）・別のタブの変更の知らせ・控えの知らせ（トースト）。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-tour.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const fs = require('node:fs');
const path = require('node:path');
const { startAll } = require('./lib/startFeatures.cjs');
const { skipTour } = require('./lib/tourSeen.cjs');
const {
  launch,
  BASE,
  OUT_DIR,
  NOW,
  TODAY,
  STORAGE_KEY,
  check,
  hashOf,
  stored,
  pageErrors,
  runSteps,
  settle,
  until,
} = require('./lib/env.cjs');
const { guard } = require('./lib/steps.cjs');
const { visitsIn } = require('./lib/visits.cjs');
const { goTo, pressTool } = require('./lib/ui.cjs');

const YM = TODAY.slice(0, 7);

/** ページのエラー（終わりに失敗に数える。env.cjs の pageErrors） */
const errors = pageErrors;
const native = [];
const tour = (page) => page.getByTestId('tour');
const visible = (loc) => loc.isVisible().catch(() => false);
/** フォーカスがツアーのカードの中か */
const focusInTour = (page) => page.evaluate(() => !!document.activeElement?.closest('[data-testid="tour"]'));
const activeTestId = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');

/**
 * 新しいブラウザの文脈（localStorage は空）。human なら印を入れない（人が初めて開いたとき。最初の2問が出る。
 * start: 'all' なら印「all」だけ入れる＝2問を出さず今の初期データ＋すべて入）。そうでなければ skipTour（印「all」）
 */
async function newPage(b, { human, width = 1400, height = 1000, start }) {
  const ctx = await b.newContext({ viewport: { width, height } });
  if (!human) await skipTour(ctx);
  else if (start === 'all') await startAll(ctx);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  page.on('pageerror', (e) => {
    errors.push(String(e));
    console.log('ERR', String(e));
  });
  page.on('dialog', (d) => {
    if (d.type() === 'beforeunload') {
      d.accept();
      return;
    }
    native.push(`${d.type()}: ${d.message()}`);
    d.dismiss();
  });
  return { ctx, page };
}

// 画面を新しく開く（共通の手 goTo。待つ長さ・見出し・落ち着くまでの待ちはこの画面の e2e の既定）
const open = (page, hash, ready) => goTo(page, hash, { ready: ready, timeout: 30000, h1: false, settleMs: 0 });

// ---- 最初の2問（PRD D379〜D381。ADR-0073）----
const askingPage = (b, opts = {}) => newPage(b, { human: true, ...opts });
const answered = (page) => page.getByTestId('first-run').waitFor({ state: 'detached', timeout: 30000 });
const stored2 = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), STORAGE_KEY);
const FAIL_TEXT = /画面を表示できませんでした|画面を読み込めませんでした/;

/** 画面を開いて、見出しが出て、例外の画面にならないことを確かめる */
async function screenOk(page, hash, label) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#${hash}`);
  await page.locator('.app-main h1').first().waitFor({ timeout: 30000 });
  await settle(page, 200);
  const body = await page.locator('body').innerText();
  check(!FAIL_TEXT.test(body), `${label}：空のデータでも例外の画面にならない`, hash);
}

// 初めて開く：2問の画面（ツアーは自動で出ない・データはまだ書かない）→ デモ・定期で始める
async function firstRun(b) {
  const { ctx, page } = await askingPage(b);
  await page.goto(`${BASE}#/`);
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  check((await tour(page).count()) === 0, '初めて開いたとき：案内ツアーは自動で出ない（最初の2問に置き換えた）');
  check((await stored2(page)) === null, '2問に答えるまでデータを書かない');
  const text = await page.getByTestId('first-run').innerText();
  check(
    text.includes('デモで試す') &&
      text.includes('自分のデータで始める') &&
      text.includes('単発の予約が中心') &&
      text.includes('例：ベビーシッター') &&
      text.includes('定期の訪問が中心') &&
      text.includes('訪問介護・看護、家事代行の定期'),
    '2問：問1（デモで試す／自分のデータで始める）・問2（単発の予約が中心／定期の訪問が中心）の選択肢と例',
    text,
  );
  check((await page.getByTestId('first-run-cancel').count()) === 0, '初めて開いたときの2問に「やめる」は出ない');
  const primary = await page.getByTestId('first-run').locator('.btn-primary').allInnerTexts();
  check(primary.length === 1 && primary[0].trim() === 'はじめる', '主ボタンは「はじめる」の1つだけ', primary);
  check(
    (await page.getByTestId('first-run-start-demo').isChecked()) &&
      (await page.getByTestId('first-run-booking-regular').isChecked()),
    '初めに選んである：デモで試す・定期の訪問が中心',
  );
  // ラジオは標準の radio group：Tab は選んだ方だけ、矢印で選び直す
  const stops = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    stops.push(await activeTestId(page));
  }
  check(
    stops.includes('first-run-start-demo') &&
      !stops.includes('first-run-start-own') &&
      stops.includes('first-run-booking-regular') &&
      !stops.includes('first-run-booking-oneOff'),
    '2問：Tab は選んでいる方だけに止まる',
    stops,
  );
  await page.getByTestId('first-run-start-demo').focus();
  await page.keyboard.press('ArrowDown');
  check(await page.getByTestId('first-run-start-own').isChecked(), '2問：矢印で選び直す');
  await page.screenshot({ path: path.join(OUT_DIR, 'first-run.png') });
  // 読み直しても、答えるまではまた2問
  await page.reload();
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  check((await stored2(page)) === null, '読み直しても、答えるまではデータを書かず、また2問');
  // デモ・定期：今の初期データ。呼び名は利用者さん／スタッフ・ひな形は基本・最初は月の予定
  await page.getByTestId('first-run-start-demo').check();
  await page.getByTestId('first-run-booking-regular').check();
  await page.getByTestId('first-run-submit').click();
  await answered(page);
  await page.locator('.app-main h1').first().waitFor({ timeout: 30000 });
  await until(async () => (await stored2(page)) !== null, 10000);
  const d = await stored2(page);
  const f = d.org.features;
  check(/#\/month/.test(hashOf(page)), 'デモ・定期：最初に開く画面は月の予定', hashOf(page));
  check(
    d.org.terms.client === '利用者さん' && d.org.terms.staff === 'スタッフ',
    'デモ・定期：呼び名は利用者さん／スタッフ',
    d.org.terms,
  );
  check(
    f.patterns === true && f.expert === false && f.rules === false && f.compare === false && f.workload === false,
    'デモ・定期：ひな形は「基本」（エキスパート機能は切）',
    f,
  );
  check(
    d.clients.length === 20 && d.patterns.some((p) => p.usualStaffId) && d.visits.length === 0,
    'デモ・定期：今の初期データ（20人・繰り返しの担当あり）',
    { clients: d.clients.length, visits: d.visits.length },
  );
  check((await tour(page).count()) === 0, '2問のあともツアーは出ない');
  await page.reload();
  await page.locator('.app-main h1').first().waitFor({ timeout: 30000 });
  check((await page.getByTestId('first-run').count()) === 0, '答えたあとは、読み直しても2問を出さない');
  await ctx.close();
  // 印「all」（e2e の前準備）があれば2問を出さず、今までの初期データ＋すべて入で始める
  const a = await newPage(b, { human: true, start: 'all' });
  await a.page.goto(`${BASE}#/home`);
  await a.page.getByTestId('home-tasks').waitFor({ timeout: 30000 });
  const ad = await stored2(a.page);
  check(
    (await a.page.getByTestId('first-run').count()) === 0 &&
      Object.values(ad.org.features).length === 0 &&
      ad.clients.length === 20,
    '印「all」があれば2問を出さず、今までの初期データ＋すべて入（features は {}）で始める',
    ad.org.features,
  );
  await a.ctx.close();
}

// デモ・単発：架空の単発の予約（今日から2週間分・繰り返しなし）。お客様／シッター・単発のみ・最初は週の予定
async function firstRunOneOff(b) {
  const { ctx, page } = await askingPage(b);
  await page.goto(`${BASE}#/`);
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  await page.getByTestId('first-run-start-demo').check();
  await page.getByTestId('first-run-booking-oneOff').check();
  await page.getByTestId('first-run-submit').click();
  await answered(page);
  await page.locator('.app-main h1').first().waitFor({ timeout: 30000 });
  await until(async () => (await stored2(page)) !== null, 10000);
  const d = await stored2(page);
  check(/#\/week/.test(hashOf(page)), 'デモ・単発：最初に開く画面は週の予定', hashOf(page));
  check(
    d.org.terms.client === 'お客様' && d.org.terms.staff === 'シッター',
    'デモ・単発：呼び名はお客様／シッター',
    d.org.terms,
  );
  check(
    d.org.features.patterns === false && d.org.features.expert === false,
    'デモ・単発：ひな形は「単発のみ」（繰り返しを切・エキスパート機能は切）',
    d.org.features,
  );
  const days = new Set(d.visits.map((v) => v.date));
  check(
    d.patterns.length === 0 && d.visits.length >= 14 && days.size === 14 && d.visits.every((v) => v.pattern === null),
    'デモ・単発：今日から2週間分の単発の予約（繰り返しなし）',
    { patterns: d.patterns.length, visits: d.visits.length, days: days.size },
  );
  check(
    d.visits.every((v) => v.date >= TODAY) && d.visits.some((v) => v.date === TODAY),
    'デモ・単発：予約は今日から（今日の予約がある）',
    [...days].sort().slice(0, 2),
  );
  check(
    (await page.locator('.app-main').innerText()).includes('お客様') || d.clients.length > 0,
    'デモ・単発：週の予定が出る',
  );
  for (const [hash, label] of [
    [`/plan?date=${TODAY}`, '日の予定'],
    ['/month', '月の予定'],
    ['/clients', 'お客様の一覧'],
    ['/staff', 'シッターの一覧'],
  ])
    await screenOk(page, hash, `デモ・単発の${label}`);
  const heading = await page.locator('.app-main h1').first().innerText();
  check(heading.includes('シッター'), '単発：〈スタッフ〉の一覧の見出しは呼び名に従う（シッター）', heading);
  await ctx.close();
}

// 自分のデータで始める：空のデータ＋3段の登録の案内（1/3・①②は読み込む／1人ずつ・③は予定へ）。空の画面が壊れない
async function firstRunOwn(b) {
  const { ctx, page } = await askingPage(b);
  await page.goto(`${BASE}#/`);
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  await page.getByTestId('first-run-start-own').check();
  await page.getByTestId('first-run-booking-regular').check();
  await page.getByTestId('first-run-submit').click();
  await answered(page);
  await page.getByTestId('start-guide').waitFor({ timeout: 30000 });
  await until(async () => (await stored2(page)) !== null, 10000);
  const d = await stored2(page);
  check(
    d.clients.length === 0 && d.staff.length === 0 && d.visits.length === 0 && d.patterns.length === 0,
    '自分のデータ：空のデータ（人・訪問・繰り返しは無い）',
  );
  check(
    d.visitTypes.length > 0 && d.org.terms.client === '利用者さん' && d.org.features.patterns === true,
    '自分のデータ：訪問の種類と呼び名が入っている',
    d.visitTypes,
  );
  check(/#\/start/.test(hashOf(page)), '自分のデータ：最初は登録の案内', hashOf(page));
  const count = () => page.getByTestId('start-guide-count').innerText();
  const title = () => page.locator('.app-main h1').first().innerText();
  check(
    (await count()).trim() === '1/3' && (await title()).includes('① 利用者さんを入れる'),
    '案内 1/3：① 利用者さん',
    {
      count: await count(),
      title: await title(),
    },
  );
  check((await page.getByTestId('start-guide').locator('.btn-primary').count()) === 1, '案内：主ボタンは1つ');
  // ① 読み込む → 名簿の欄が開く
  check(!(await page.getByTestId('roster-card').isVisible()), '案内①：はじめは名簿の欄を閉じている');
  await page.getByTestId('start-guide-import').click();
  await page.getByTestId('roster-card').waitFor({ state: 'visible' });
  check(
    (await page.getByTestId('roster-card').innerText()).includes('利用者さんの名簿'),
    '案内①：「CSV・Excel を読み込む」で利用者さんの名簿の読み込み（今の名簿の欄）が開く',
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'start-guide-1.png') });
  // ① 1人ずつ → 追加の画面
  await page.getByTestId('start-guide-add').click();
  await page.waitForURL(/#\/clients\/new/);
  check(true, '案内①：「1人ずつ入れる」で利用者さんの追加の画面へ');
  await page.goBack();
  await page.getByTestId('start-guide').waitFor();
  // ② スタッフ
  await page.getByTestId('start-guide-next').click();
  await page.waitForURL(/step=2/);
  await page.getByTestId('start-guide-count').filter({ hasText: '2/3' }).waitFor();
  check((await count()).trim() === '2/3' && (await title()).includes('② スタッフを入れる'), '案内 2/3：② スタッフ');
  await page.getByTestId('start-guide-import').click();
  check(
    (await page.getByTestId('roster-card').innerText()).includes('スタッフの名簿'),
    '案内②：「CSV・Excel を読み込む」でスタッフの名簿の欄が開く',
  );
  await page.getByTestId('start-guide-add').click();
  await page.waitForURL(/#\/staff\/new/);
  check(true, '案内②：「1人ずつ入れる」でスタッフの追加の画面へ');
  await page.goBack();
  await page.getByTestId('start-guide').waitFor();
  // ③ 予定
  await page.getByTestId('start-guide-next').click();
  await page.waitForURL(/step=3/);
  await page.getByTestId('start-guide-count').filter({ hasText: '3/3' }).waitFor();
  const btns = await page.getByTestId('start-guide').locator('.btn-primary').allInnerTexts();
  check(
    (await count()).trim() === '3/3' && (await title()).includes('③ 予定を入れる') && btns.join() === '予定を入れる',
    '案内 3/3：③ 予定。主ボタンは「予定を入れる」',
    btns,
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'start-guide-3.png') });
  await page.getByTestId('start-guide-plan').click();
  await page.waitForURL(/#\/month/);
  check(true, '案内③：「予定を入れる」で予定の画面（定期は月）へ');
  // 空のデータで各画面が壊れない
  for (const [hash, label] of [
    ['/month', '月の予定'],
    ['/week', '週の予定'],
    [`/plan?date=${TODAY}`, '日の予定'],
    ['/home', 'ホーム'],
    ['/clients', '利用者さんの一覧'],
    ['/staff', 'スタッフの一覧'],
    ['/settings', '管理者設定'],
    ['/data', 'データ'],
    ['/types', '訪問の種類'],
    ['/vacancy', '空き状況'],
    ['/compat', '相性'],
    ['/availability', '勤務時間'],
    ['/start?step=2', '登録の案内'],
  ])
    await screenOk(page, hash, label);
  await page.goto('about:blank');
  await page.goto(`${BASE}#/clients`);
  await page.locator('.app-main h1').first().waitFor({ timeout: 30000 });
  check(
    (await page.locator('.app-main').innerText()).includes('いません'),
    '空の利用者さんの一覧に「当てはまる利用者さんがいません」の文が出る',
  );
  await ctx.close();
  // 単発で自分のデータ：呼び名はお客様／シッター・③は週の予定へ
  const o = await askingPage(b);
  await o.page.goto(`${BASE}#/`);
  await o.page.getByTestId('first-run').waitFor({ timeout: 30000 });
  await o.page.getByTestId('first-run-start-own').check();
  await o.page.getByTestId('first-run-booking-oneOff').check();
  await o.page.getByTestId('first-run-submit').click();
  await o.page.getByTestId('start-guide').waitFor({ timeout: 30000 });
  check(
    (await o.page.locator('.app-main h1').first().innerText()).includes('① お客様を入れる'),
    '自分のデータ・単発：案内の呼び名はお客様',
  );
  await o.page.goto('about:blank');
  await o.page.goto(`${BASE}#/start?step=3`);
  await o.page.getByTestId('start-guide-plan').click();
  await o.page.waitForURL(/#\/week/);
  check(true, '自分のデータ・単発：③の「予定を入れる」は週の予定へ');
  for (const [hash, label] of [
    ['/week', '週の予定'],
    ['/month', '月の予定'],
    [`/plan?date=${TODAY}`, '日の予定'],
    ['/clients', 'お客様の一覧'],
    ['/staff', 'シッターの一覧'],
  ])
    await screenOk(o.page, hash, `単発・${label}`);
  await o.ctx.close();
}

// 設定の「最初の設定をやり直す」：確認（元に戻すの対象外・先に書き出す案内）→ 2問へ戻る → 選んだ答えでデータを作り直す
async function firstRunRestart(b) {
  const { ctx, page } = await newPage(b, { human: false });
  await page.goto(`${BASE}#/settings`);
  await page.getByTestId('restart-first-run-button').waitFor({ timeout: 30000 });
  const before = await stored2(page);
  check(before.clients.length === 20, '前提：今の初期データ（20人）');
  // 取り消すとそのまま
  await page.getByTestId('restart-first-run-button').click();
  const body = await page.getByTestId('confirm-body').innerText();
  check(
    body.includes('Ctrl+Z') && body.includes('対象外') && body.includes('書き出して'),
    '確認の文：元に戻す（Ctrl+Z）の対象外なので、先にデータを書き出す案内',
    body,
  );
  await page.getByTestId('confirm-cancel').click();
  await settle(page, 300);
  check(
    (await page.getByTestId('first-run').count()) === 0 && (await stored2(page)).clients.length === 20,
    '取り消すと2問へ戻らず、データはそのまま',
  );
  // 2問へ戻る：答えるまではデータはそのまま・読み直すと元の画面
  await page.getByTestId('restart-first-run-button').click();
  await page.getByTestId('confirm-ok').click();
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  check((await stored2(page)).clients.length === 20, '2問へ戻っても、答えるまではデータを作り直さない');
  // 抜ける道：やり直しのときだけ従のボタン「やめる」（主ボタンは「はじめる」の1つのまま）。今のデータのまま戻る
  check(
    (await page.getByTestId('first-run-cancel').innerText()).trim() === 'やめる' &&
      (await page.getByTestId('first-run').locator('.btn-primary').count()) === 1,
    'やり直しの2問：従のボタン「やめる」があり、主ボタンは「はじめる」の1つ',
  );
  await page.getByTestId('first-run-cancel').click();
  await page.getByTestId('restart-first-run-button').waitFor({ timeout: 30000 });
  check(
    (await page.getByTestId('first-run').count()) === 0 && (await stored2(page)).clients.length === 20,
    '「やめる」で、今のデータのまま設定の画面へ戻る',
  );
  await page.getByTestId('restart-first-run-button').click();
  await page.getByTestId('confirm-ok').click();
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  await page.reload();
  await page.locator('.app-main h1').first().waitFor({ timeout: 30000 });
  check(
    (await page.getByTestId('first-run').count()) === 0,
    '2問のまま読み直すと、元のデータで開く（作り直していない）',
  );
  // もう一度：単発・自分のデータで作り直す
  await page.goto('about:blank');
  await page.goto(`${BASE}#/settings`);
  await page.getByTestId('restart-first-run-button').click();
  await page.getByTestId('confirm-ok').click();
  await page.getByTestId('first-run').waitFor({ timeout: 30000 });
  await page.getByTestId('first-run-start-own').check();
  await page.getByTestId('first-run-booking-oneOff').check();
  await page.getByTestId('first-run-submit').click();
  await page.getByTestId('start-guide').waitFor({ timeout: 30000 });
  await until(async () => (await stored2(page)).clients.length === 0, 10000);
  const after = await stored2(page);
  check(
    after.org.terms.client === 'お客様' && after.org.features.patterns === false && after.staff.length === 0,
    '選んだ答えでデータを作り直す（単発・自分のデータ：お客様／シッター・単発のみ・空）',
    after.org,
  );
  check(
    /#\/start/.test(hashOf(page)),
    'やり直したあとは選んだ答えの最初の画面（自分のデータ＝登録の案内）',
    hashOf(page),
  );
  // 1世代の控えが残り、データの画面の「直前の状態に戻す」で戻れる
  await page.goto('about:blank');
  await page.goto(`${BASE}#/data`);
  await page.getByTestId('tour-again').waitFor({ timeout: 30000 });
  check(
    (await page.getByRole('button', { name: /直前の状態に戻す/ }).count()) > 0,
    'やり直す前のデータは1世代の控えに残る（データの画面の「直前の状態に戻す」）',
  );
  await ctx.close();
}

// ---- 案内ツアー（初回には自動で出ない。データの画面の「案内をもう一度見る」から開く）----
/** データの画面からツアーを開く */
async function openTourFromData(page) {
  await open(page, '/data', '[data-testid="tour-again"]');
  await page.getByTestId('tour-again').click();
  await tour(page).waitFor();
}

async function tourDialog(b) {
  const { ctx, page } = await newPage(b, { human: false });
  await open(page, '/', '[data-testid="home-tasks"]');
  await settle(page, 500);
  check((await tour(page).count()) === 0, 'ツアーは自動で出ない（初回の2問に置き換えた）');
  await openTourFromData(page);
  const t = tour(page);
  const attrs = await t.evaluate((el) => ({
    role: el.getAttribute('role'),
    modal: el.getAttribute('aria-modal'),
    title: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent,
    body: document.getElementById(el.getAttribute('aria-describedby'))?.textContent,
  }));
  check(
    attrs.role === 'dialog' && attrs.modal === 'true' && /今日やること/.test(attrs.title) && attrs.body.length > 10,
    'ツアー：開くと出る（role=dialog・aria-modal・見出し・本文）',
    attrs,
  );
  check((await page.getByTestId('tour-count').innerText()).includes('1 / 3'), 'ツアー：1 / 3');
  check(
    (await page.getByTestId('tour-start').count()) === 0,
    'ツアー：「どこまで使いますか」は無い（最初の2問に置き換えた）',
  );
  check((await activeTestId(page)) === 'tour-next', 'ツアー：最初のフォーカスは「次へ」');
  check(await page.getByTestId('tour-back').isDisabled(), 'ツアー：最初の枚は「戻る」を押せない');
  const lock = await page.evaluate(() => ({
    inert: document.getElementById('root').inert,
    html: document.documentElement.style.overflow,
  }));
  check(lock.inert && lock.html === 'hidden', 'ツアー：裏は inert・巻かない', lock);
  // 中央のカード
  const box = await t.boundingBox();
  check(
    Math.abs(box.x + box.width / 2 - 700) < 4 && Math.abs(box.y + box.height / 2 - 500) < 40,
    'ツアー：画面の中央',
    box,
  );
  // Tab・Shift+Tab は中で回る
  let inside = true;
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    inside = inside && (await focusInTour(page));
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+Tab');
    inside = inside && (await focusInTour(page));
  }
  check(inside, 'ツアー：Tab・Shift+Tab は中で回る');
  // 開いている間は Ctrl+K でパレットを開かない
  await page.keyboard.press('Control+k');
  await settle(page, 200);
  check((await page.getByTestId('cmdk-wrap').count()) === 0, 'ツアー：開いている間は Ctrl+K で探す画面を開かない');
  // 次へ → 戻る
  await page.getByTestId('tour-next').click();
  check((await page.getByTestId('tour-count').innerText()).includes('2 / 3'), 'ツアー：次へで 2 / 3');
  check((await tour(page).getAttribute('data-step')) === 'plan', 'ツアー：2枚目は予定（月・週・日）');
  await page.getByTestId('tour-back').click();
  check((await page.getByTestId('tour-count').innerText()).includes('1 / 3'), 'ツアー：戻るで 1 / 3');
  check(
    (await activeTestId(page)) === 'tour-next',
    'ツアー：最初の枚へ戻って「戻る」が押せなくなるとフォーカスは「次へ」',
  );
  const keys = [];
  for (let i = 0; i < 2; i++) {
    keys.push(await tour(page).getAttribute('data-step'));
    if (i === 1) {
      // 予定の枚：3段の説明（PRD D226。組むのは「予定を組む」。ADR-0063）と［月｜週｜日］の切り替え
      const points = await page.getByTestId('tour-points').locator('li').allInnerTexts();
      check(
        (await page.getByTestId('tour-title').innerText()) === '予定を組んで、直して、確定します' &&
          (await page.getByTestId('tour-body').innerText()).includes('［月｜週｜日］') &&
          // 印「all」（すべて入。エキスパート機能も入）なので、組むのはメニューの「予定を組む」（ADR-0072）
          (await page.getByTestId('tour-body').innerText()).includes('「予定を組む」') &&
          points.length === 3 &&
          /^組む（AI）：/.test(points[0]) &&
          points[0].includes('メニューの「予定を組む」') &&
          /^ピン：/.test(points[1]) &&
          /^確定（伝えた）：/.test(points[2]),
        'ツアー：予定の枚は題名「予定を組んで、直して、確定します」・［月｜週｜日］と3段（組む（AI）→ ピン → 確定（伝えた））の説明',
        points,
      );
      const body = await tour(page).evaluate(
        (el) => document.getElementById(el.getAttribute('aria-describedby'))?.textContent ?? '',
      );
      check(
        /組む（AI）：/.test(body) && /確定（伝えた）：/.test(body),
        'ツアー：予定の枚の説明（aria-describedby）に3段も入る',
        body,
      );
    }
    await page.getByTestId('tour-next').click();
  }
  keys.push(await tour(page).getAttribute('data-step'));
  check(
    JSON.stringify(keys) === JSON.stringify(['home', 'plan', 'absence']),
    'ツアー：3枚（ホーム・予定・欠勤・キャンセル）。条件・探す（Ctrl+K）の枚は無い',
    keys,
  );
  const lastBtns = await page.locator('[data-testid="tour"] .tour-actions button').evaluateAll((els) =>
    els.map((e) => ({
      id: e.dataset.testid,
      text: e.textContent.trim(),
      primary: e.classList.contains('btn-primary'),
    })),
  );
  check(
    JSON.stringify(lastBtns.filter((x) => x.primary).map((x) => x.id)) === '["tour-today"]' &&
      lastBtns.find((x) => x.id === 'tour-today')?.text === '今日の予定を開く' &&
      !lastBtns.some((x) => x.id === 'tour-skip'),
    'ツアー：最後の枚の主ボタンは「今日の予定を開く」だけ（「とばす」は出さない）',
    lastBtns,
  );
  check((await page.getByTestId('tour-next').innerText()).trim() === '閉じる', 'ツアー：最後の枚のボタンは「閉じる」');
  check(
    (await activeTestId(page)) === 'tour-today',
    'ツアー：最後の枚に入るとフォーカスは主ボタン「今日の予定を開く」',
    await activeTestId(page),
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'tour-last.png') });
  await page.getByTestId('tour-next').click();
  await tour(page).waitFor({ state: 'detached' });
  const after = await page.evaluate(() => ({
    inert: document.getElementById('root').inert,
    html: document.documentElement.style.overflow,
  }));
  check(!after.inert && after.html === '', '「閉じる」で閉じ、裏の inert とロックを戻す', after);
  check((await activeTestId(page)) === 'tour-again', '閉じたらフォーカスは「案内をもう一度見る」へ');
  // Esc・とばす
  await page.getByTestId('tour-again').click();
  await tour(page).waitFor();
  await page.getByTestId('tour-next').click();
  await page.keyboard.press('Escape');
  await tour(page).waitFor({ state: 'detached' });
  check(/#\/data/.test(hashOf(page)), 'Esc で閉じても画面はそのまま', hashOf(page));
  await page.getByTestId('tour-again').click();
  await tour(page).waitFor();
  await page.getByTestId('tour-skip').click();
  await tour(page).waitFor({ state: 'detached' });
  check(true, '「とばす」で閉じる');
  await ctx.close();
}

// 最後の枚の「今日の予定を開く」（PRD D226）：閉じて今日の日の画面（選んでいる日付は今日）
async function tourToday(b) {
  const { ctx, page } = await newPage(b, { human: false });
  await openTourFromData(page);
  for (let i = 0; i < 2; i++) await page.getByTestId('tour-next').click();
  check(
    (await tour(page).getAttribute('data-step')) === 'absence',
    '「今日の予定を開く」：最後の枚（欠勤・キャンセル）まで進む',
  );
  // フォーカスは「今日の予定を開く」にあるので、Enter で押せる
  check((await activeTestId(page)) === 'tour-today', '「今日の予定を開く」：最後の枚ではフォーカスがこのボタン');
  await page.keyboard.press('Enter');
  await tour(page).waitFor({ state: 'detached' });
  await page.waitForURL(/#\/plan/);
  await page.locator('.date-switch select').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !/date=/.test(location.hash), null, { timeout: 5000 }).catch(() => {});
  const st = await page.evaluate(() => ({
    date: document.querySelector('.date-switch select')?.value,
    hash: decodeURIComponent(location.hash),
    inert: document.getElementById('root').inert,
  }));
  check(
    st.date === TODAY && st.hash === '#/plan' && !st.inert,
    '「今日の予定を開く」で閉じ、今日の日の予定（?date= は消える）',
    st,
  );
  // 初期データに今日の担当がある（PRD D225）ので、そのまま確定の手前まで見える
  // 案内をもう一度見るは印「all」（すべて入＝エキスパート機能が入）で開くので、確定の段階（まだ伝えていない）が出る
  await page.getByTestId('confirm-state').waitFor({ timeout: 30000 });
  check(
    /まだ伝えていない/.test(await page.getByTestId('confirm-state').innerText()),
    '「今日の予定を開く」：今日の担当が出ている（まだ伝えていない）',
  );
  await ctx.close();
}

async function tourMobilePrint(b) {
  const { ctx, page } = await newPage(b, { human: false, width: 390, height: 844 });
  await openTourFromData(page);
  for (let i = 0; i < 3; i++) {
    const box = await tour(page).boundingBox();
    const btns = await page
      .locator('[data-testid="tour"] button')
      .evaluateAll((els) =>
        els.map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, b: r.bottom })),
      );
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(
      box.x >= 0 &&
        box.x + box.width <= 390 &&
        box.y >= 0 &&
        box.y + box.height <= 844 &&
        btns.every((x) => x.l >= 0 && x.r <= 390 && x.b <= 844) &&
        sw <= 390,
      `390px：${i + 1}枚目のカードとボタンが画面に収まる`,
      { box, sw },
    );
    if (i === 0) await page.screenshot({ path: path.join(OUT_DIR, 'tour-390.png') });
    if (i === 2) await page.screenshot({ path: path.join(OUT_DIR, 'tour-last-390.png') });
    if (i < 2) await page.getByTestId('tour-next').click();
  }
  await page.emulateMedia({ media: 'print' });
  check(!(await visible(tour(page))), '印刷ではツアーを出さない');
  await page.emulateMedia({ media: 'screen' });
  // 最初の2問も 390px で収まる（人が初めて開く画面）
  await ctx.close();
  const h = await askingPage(b, { width: 390, height: 844 });
  await h.page.goto(`${BASE}#/`);
  await h.page.getByTestId('first-run').waitFor({ timeout: 30000 });
  const fb = await h.page.locator('[data-testid="first-run"] form').boundingBox();
  const fsw = await h.page.evaluate(() => document.documentElement.scrollWidth);
  check(fb.x >= 0 && fb.x + fb.width <= 390 && fsw <= 390, '390px：最初の2問の画面が横にはみ出さない', { fb, fsw });
  await h.page.screenshot({ path: path.join(OUT_DIR, 'first-run-390.png') });
  await h.ctx.close();
}

// ---- データの画面のファイル選択 ----
async function filePick(b) {
  const { ctx, page } = await newPage(b, { human: false });
  // 選ぶ画面（filechooser）の受け口は先に付けておく。受け口を付けたときにブラウザへ横取りを頼む知らせは待たずに送られるので、
  // 押す直前に waitForEvent を付けるだけでは、横取りが入る前に Space が届いて取りこぼすことがある
  page.on('filechooser', () => {});
  await open(page, '/data', '[data-testid="backup-file"]');
  const counts = await page.evaluate(() => ({
    all: document.querySelectorAll('input[type="file"]').length,
    pick: document.querySelectorAll('.file-pick input[type="file"]').length,
  }));
  check(
    counts.all === 3 && counts.pick === 3,
    'ファイル選択は控え（JSON）・Excel・予約の CSV（ADR-0075）の3つで、どれも同じ部品',
    counts,
  );
  const shape = await page.evaluate(() =>
    [...document.querySelectorAll('.file-pick')].map((el) => {
      const input = el.querySelector('input[type="file"]');
      const r = input.getBoundingClientRect();
      return {
        btn: el.querySelector('label.file-pick-btn')?.textContent.trim(),
        name: el.querySelector('.file-pick-name')?.textContent.trim(),
        input: { w: Math.round(r.width), h: Math.round(r.height) },
        btnBox: (() => {
          const b = el.querySelector('label.file-pick-btn').getBoundingClientRect();
          return { w: Math.round(b.width), h: Math.round(b.height) };
        })(),
        opacity: getComputedStyle(input).opacity,
        display: getComputedStyle(input).display,
        label: (input.getAttribute('aria-labelledby') ?? '')
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent.trim())
          .join(' '),
        desc: document.getElementById(input.getAttribute('aria-describedby'))?.textContent.trim(),
      };
    }),
  );
  check(
    shape.every((s) => s.btn === 'ファイルを選ぶ' && s.name === 'ファイルを選んでいません'),
    '日本語のボタン「ファイルを選ぶ」と未選択の文',
    shape,
  );
  check(
    shape.every(
      (s) => s.input.w === s.btnBox.w && s.input.h === s.btnBox.h && s.opacity === '0' && s.display !== 'none',
    ),
    'ブラウザ標準の input（Choose File）は見えないまま、見た目のボタンと同じ大きさで残す（VoiceOver で触れる）',
    shape.map((x) => [x.input, x.btnBox]),
  );
  check(
    shape[0].label === '読み込む控え（JSON） ファイルを選ぶ' && shape[0].desc === 'ファイルを選んでいません',
    '入力欄の名前は「何を読み込むか＋ファイルを選ぶ」、説明は選んだファイルの文',
    shape[0],
  );
  check(/読み込む Excel/.test(shape[1].label), 'Excel の入力欄の名前', shape[1].label);
  check(/読み込む予約の CSV/.test(shape[2].label), '予約の CSV の入力欄の名前', shape[2].label);
  check(
    (await page.getByRole('button', { name: '読み込む控え（JSON） ファイルを選ぶ', exact: true }).count()) === 1,
    '読み上げの木で入力欄が名前付きのボタン（「読み込む控え（JSON） ファイルを選ぶ」）',
  );
  // キーボード：「ファイルに書き出す」から Tab で入力欄へ・枠が見える・Space で選ぶ画面
  await page.getByRole('button', { name: 'ファイルに書き出す' }).focus();
  await page.keyboard.press('Tab');
  check((await activeTestId(page)) === 'backup-file-input', 'Tab で控えの入力欄に届く');
  const outline = await page
    .locator('[data-testid="backup-file"] label.file-pick-btn')
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  check(outline === 'solid', 'フォーカスしているときはボタンの見た目に枠', outline);
  // Space で選ぶ画面（filechooser）。待ち受けは押す前に始める
  const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await page.keyboard.press('Space');
  const chosen = await chooser;
  check(chosen !== null, 'Space でファイルを選ぶ画面が開く');
  // 控え（JSON）を選ぶ：確認 → 取り消すでデータはそのまま、文はファイル名
  const json = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  const before = json;
  await page
    .getByTestId('backup-file-input')
    .setInputFiles({ name: 'ひかえ.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.getByTestId('confirm-dialog').waitFor();
  const title = await page.getByTestId('confirm-title').innerText();
  check(title.includes('「ひかえ.json」'), '選ぶと確認（ファイル名入り）', title);
  await page.getByTestId('confirm-cancel').click();
  await settle(page, 400);
  check(
    (await page.getByTestId('backup-file-name').innerText()) === '選んだファイル：ひかえ.json',
    '選んだファイル名を出す',
  );
  check((await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)) === before, '取り消すとデータはそのまま');
  // 同じファイルをもう一度選べる（input の値は空に戻す）→ 確定で読み込む
  check((await page.getByTestId('backup-file-input').inputValue()) === '', '選んだあと input の値は空に戻す');
  await page
    .getByTestId('backup-file-input')
    .setInputFiles({ name: 'ひかえ.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.getByTestId('confirm-ok').click();
  await page.locator('.toast').filter({ hasText: '読み込みました' }).waitFor({ timeout: 5000 });
  check(true, '同じファイルをもう一度選んで確定すると読み込む');
  // Excel：壊れたファイルは誤りの文（データはそのまま）
  await page
    .getByTestId('excel-file-input')
    .setInputFiles({ name: 'こわれた.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('not a book') });
  await page.locator('.error').filter({ hasText: '読み込めませんでした' }).first().waitFor({ timeout: 10000 });
  check(
    (await page.getByTestId('excel-file-name').innerText()) === '選んだファイル：こわれた.xlsx',
    'Excel：選んだファイル名と誤りの文',
  );
  // 名簿は各一覧の「Excel・CSV」へ案内する（ADR-0068）
  check(
    (await page.locator('[data-testid="excel-file"] .file-pick-caption').innerText()) === '読み込む Excel（全体）' &&
      (await page.getByTestId('excel-roster-note').getByRole('link').count()) === 2,
    'Excel：全体だけを読み、名簿は一覧へのリンク',
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'data-file-pick.png'), fullPage: true });
  // 390px：横にはみ出さない
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page, 300);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const bb = await page.locator('[data-testid="backup-file"] label.file-pick-btn').boundingBox();
  check(sw <= 390 && bb.x >= 0 && bb.x + bb.width <= 390, '390px：ファイル選択が収まる', { sw, bb });
  await ctx.close();
}

// ---- 月の画面の日ごとの一覧 ----
async function monthList(b) {
  const { ctx, page } = await newPage(b, { human: false, width: 390, height: 844 });
  await open(page, `/month?ym=${YM}`, '[data-testid="month-layout"]');
  await page.locator('[data-testid="month-list-day"]').first().waitFor({ timeout: 30000 });
  check(
    (await page.getByTestId('month-grid').count()) === 0,
    '390px：はじめは日ごとの一覧（カレンダーの表を出さない）',
  );
  const pressed = await page
    .locator('[data-testid="month-layout"] button')
    .evaluateAll((els) => els.map((e) => `${e.dataset.layout}:${e.getAttribute('aria-pressed')}`));
  check(pressed.join(',') === 'calendar:false,list:true', '切り替えの aria-pressed', pressed);
  const rows = page.getByTestId('month-list-day');
  const n = await rows.count();
  const last = new Date(Date.UTC(Number(YM.slice(0, 4)), Number(YM.slice(5, 7)), 0)).getUTCDate();
  check(n === last, `一覧は月の日数（${last}日）の行`, n);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const widths = await rows.evaluateAll(
    (els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.left < 0 || r.right > 390).length,
  );
  check(sw <= 390 && widths === 0, '390px：一覧は横にはみ出さない', { sw, widths });
  const sat = await rows.filter({ hasText: '（土）' }).count();
  check(sat >= 4, '390px：土曜の行も見える', sat);
  // 今日の行が画面に入る（上の帯・下のタブに隠れない。今月で行き先が無いとき）
  const inView = async (loc) => {
    const r = await loc.boundingBox();
    const head = await page.locator('.app-header').boundingBox();
    const tb = await page.getByTestId('bottom-tabs').boundingBox();
    return {
      ok: r.y >= head.y + head.height - 1 && r.y + r.height <= tb.y + 1,
      r: r.y,
      head: head.y + head.height,
      tabs: tb.y,
    };
  };
  const today = rows.filter({ has: page.locator('.month-today') });
  await settle(page, 400);
  const v1 = await inView(today);
  check(v1.ok, '390px：開くと今日の行が画面に入る（上の帯・下のタブに隠れない）', v1);
  // 「今日へ」：上へ巻いてから押すと、今日の行へ巻いてフォーカス
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 200);
  await page.getByTestId('month-list-today').click();
  // 巻く動き（smooth）は DOM を変えないので、今日の行が画面に入るまで待つ
  await until(async () => (await inView(today)).ok, 5000);
  const v2 = await inView(today);
  const focused = await today.evaluate((el) => document.activeElement === el);
  check(v2.ok && focused, '「今日へ」で今日の行へ巻いてフォーカス', { ...v2, focused });
  // 切り替えは操作の欄（月の見出しのカード）より上
  // 2つの位置は同じ瞬間に測る（巻く動きの途中に別々に測ると、間に巻いた分だけずれる）
  const pos = await page.evaluate(() => ({
    layout: document.querySelector('[data-testid="month-layout"]').getBoundingClientRect().y,
    head: document.querySelector('.month-head').getBoundingClientRect().y,
  }));
  check(pos.layout < pos.head, '切り替えは操作の欄より上', pos);
  // 行の読み上げ：日付・件数・状態
  const label = await today.getAttribute('aria-label');
  check(
    /今日/.test(label) &&
      /(訪問 \d+件|訪問なし)/.test(label) &&
      /(まだ伝えていない|確定済み|未連絡の変更あり|訪問なし)/.test(label),
    '行の読み上げ（日付・今日・件数・状態）',
    label,
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'month-list-390.png') });
  // カレンダーへ切り替え：URL に ?layout=calendar、読み直しても同じ
  await page.locator('[data-testid="month-layout"] button[data-layout="calendar"]').click();
  await page.getByTestId('month-grid').waitFor();
  check(/layout=calendar/.test(hashOf(page)), 'カレンダーへ切り替えると URL に ?layout=calendar', hashOf(page));
  await page.reload();
  await page.getByTestId('month-grid').waitFor({ timeout: 30000 });
  check((await page.getByTestId('month-list').count()) === 0, '読み直してもカレンダーのまま');
  await page.locator('[data-testid="month-layout"] button[data-layout="list"]').click();
  await page.getByTestId('month-list').waitFor();
  check(/layout=list/.test(hashOf(page)), '一覧へ戻すと URL に ?layout=list（押したら幅の既定でも書く）', hashOf(page));
  // 行を押すとその日の訪問の下から出る欄（スマホ。PRD D343）、欄の「この日の日の予定を開く」でその日の日の画面
  const target = await rows.nth(Math.min(n - 1, 20)).getAttribute('data-date');
  await page.locator(`[data-testid="month-list-day"][data-date="${target}"]`).click();
  const sheet = page.getByTestId('month-day-sheet');
  await sheet.waitFor({ timeout: 10000 });
  check(
    (await sheet.getAttribute('data-date')) === target,
    '行を押すとその日の訪問の下から出る欄（日の予定へは移らない）',
    {
      date: await sheet.getAttribute('data-date'),
      hash: hashOf(page),
    },
  );
  await page.getByTestId('month-day-visits-plan').click();
  await page.waitForURL(/#\/plan/);
  const sel = await page.locator('.date-switch select').inputValue();
  check(sel === target, '欄の「この日の日の予定を開く」でその日の「日の予定」', { sel, target });
  // 「休みを入れる」：〈スタッフ〉を選んで、勤務日の行を押すと希望休を付け外し。
  // 希望休を入れられる行（data-off="open"）がある〈スタッフ〉を探す。今月に1つも無ければ（月末で残りの日に働く人がいない）翌月で
  const nextYm = (() => {
    const [y, m] = YM.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  })();
  const openRow = page.locator('[data-testid="month-list-day"][data-off="open"]').first();
  let found = false;
  for (const ym of [YM, nextYm]) {
    await open(page, `/month?ym=${ym}`, '[data-testid="month-list"]');
    // 表示の選択は「その他 ▾」の「表示を選ぶ」で開く（PRD D278）
    await pressTool(page, 'month-more-pickers', { where: 'more' });
    await page.getByTestId('month-focus').waitFor();
    const staffOpts = await page
      .locator('[data-testid="month-focus"] option')
      .evaluateAll((els) => els.map((e) => e.value).filter((v) => v.startsWith('staff:')));
    for (const [i, v] of staffOpts.entries()) {
      await page.getByTestId('month-focus').selectOption(v);
      if (i === 0) await page.getByTestId('month-off-toggle').click();
      await page.locator('[data-testid="month-list-day"][data-off]').first().waitFor({ timeout: 10000 });
      if ((await openRow.count()) > 0) {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  check(found, '「休みを入れる」：希望休を入れられる行のある〈スタッフ〉がいる（今月に無ければ翌月）');
  await openRow.waitFor({ timeout: 10000 });
  const offDate = await openRow.getAttribute('data-date');
  await openRow.click();
  const row = page.locator(`[data-testid="month-list-day"][data-date="${offDate}"]`);
  await settle(page, 400);
  check(
    (await row.getAttribute('data-off')) === 'requested' && (await row.getAttribute('aria-pressed')) === 'true',
    '「休みを入れる」：行を押すと希望休（マスと同じ動き）',
  );
  await row.click();
  await settle(page, 400);
  check((await row.getAttribute('data-off')) === 'open', '「休みを入れる」：もう一度押すと外す');
  check(/#\/month/.test(hashOf(page)), '「休みを入れる」の間は日の予定へ移らない');
  // 広い画面：はじめカレンダー、?layout=list で一覧
  await page.setViewportSize({ width: 1400, height: 1000 });
  await open(page, `/month?ym=${YM}`, '[data-testid="month-grid"]');
  check((await page.getByTestId('month-list').count()) === 0, '1400px：はじめはカレンダー');
  await open(page, `/month?ym=${YM}&layout=list`, '[data-testid="month-list"]');
  check((await page.getByTestId('month-grid').count()) === 0, '1400px：?layout=list で一覧');
  // 月の印刷の画面は今のまま（カレンダーの表）
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}#/month/print?ym=${YM}`);
  await page.locator('.mprint').first().waitFor({ timeout: 30000 });
  check(
    (await page.getByTestId('month-list').count()) === 0 && (await page.locator('.mprint table').count()) > 0,
    '月の印刷の画面は今のまま（一覧にしない）',
  );
  await open(page, `/month?ym=${YM}`, '[data-testid="month-layout"]');
  await page.emulateMedia({ media: 'print' });
  check(!(await visible(page.getByTestId('month-layout'))), '印刷では切り替えを出さない');
  await page.emulateMedia({ media: 'screen' });
  await ctx.close();
}

// ---- データを守る（PRD D227。ADR-0032）----
const PREV_KEY = 'vrdemo:data:prev';
const BACKUP_LAST_KEY = 'vrdemo:backup:last';
/** 日付を n か月ずらした月の d 日（YYYY-MM-DD） */
function monthsAgo(n, d) {
  const [y, m] = TODAY.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 - n, d));
  return t.toISOString().slice(0, 10);
}
/** 伝えた内容（形だけ。古い日付の片づけの確かめ用） */
const fakeSnap = (date) => ({ date, at: Date.parse(`${date}T09:00:00+09:00`), visits: [] });

/** 同じタブで localStorage のデータを書き換えて読み直す（storage イベントは出ない） */
async function writeData(page, fn, arg) {
  await page.evaluate(
    ({ k, src, a }) => {
      const d = JSON.parse(localStorage.getItem(k));
      // e2e の中だけ：関数の本文を文字で渡して作る
      const next = new Function(`return (${src})`)()(d, a);
      localStorage.setItem(k, JSON.stringify(next));
    },
    { k: STORAGE_KEY, src: fn.toString(), a: arg },
  );
  await page.reload();
}

async function dataProtect(b) {
  const { ctx, page } = await newPage(b, { human: false });
  await open(page, '/data', '[data-testid="tour-again"]');
  await settle(page, 600);
  // 控えはまだ無い・最後に書き出した日もまだ
  check((await page.getByTestId('data-prev-card').count()) === 0, '控えが無いうちは「直前の状態に戻す」を出さない');
  check(
    (await page.getByTestId('data-last-export').innerText()).includes('まだ書き出していません'),
    '最後に書き出した日：まだ書き出していません',
  );
  // いまのデータに印（乱数の種）を付けてから、初期状態に戻す
  await writeData(page, (d) => ({ ...d, seed: 424242 }));
  await page.getByTestId('tour-again').waitFor();
  await settle(page, 400);
  await page.getByRole('button', { name: 'デモの初期状態に戻す' }).click();
  await page.getByTestId('confirm-dialog').waitFor();
  const body = await page.getByTestId('confirm-body').innerText();
  check(
    /控えとして1つだけ残し/.test(body) && /直前の状態に戻す/.test(body),
    '初期状態に戻す：確認の本文に控えの文',
    body,
  );
  // 取り消すと控えは前の世代のまま（無い）
  await page.getByTestId('confirm-cancel').click();
  await settle(page, 300);
  check((await page.getByTestId('data-prev-card').count()) === 0, '取り消すと控えは残らない（前の世代に戻す）');
  check((await stored(page)).seed === 424242, '取り消すとデータはそのまま');
  await page.getByRole('button', { name: 'デモの初期状態に戻す' }).click();
  await page.getByTestId('confirm-ok').click();
  await page.locator('.toast').filter({ hasText: '初期状態に戻しました' }).waitFor();
  await settle(page, 500);
  check((await stored(page)).seed !== 424242, '初期状態に戻した（印が消えた）');
  const prevText = await page.getByTestId('data-prev-text').innerText();
  check(
    /^\d{1,2}\/\d{1,2} \d{2}:\d{2} の『初期状態に戻す』の前の状態に戻せます$/.test(prevText),
    '「直前の状態に戻す」の欄の文',
    prevText,
  );
  check(await page.evaluate((k) => localStorage.getItem(k) !== null, PREV_KEY), '控えは別のキー（vrdemo:data:prev）');
  await page.getByTestId('data-prev-restore').click();
  await page.getByTestId('confirm-dialog').waitFor();
  check(/前の状態に戻せます/.test(await page.getByTestId('confirm-body').innerText()), '直前の状態に戻す：確認つき');
  await page.getByTestId('confirm-ok').click();
  await page.locator('.toast').filter({ hasText: '直前の状態に戻しました' }).waitFor();
  await settle(page, 500);
  check((await stored(page)).seed === 424242, '直前の状態に戻すと、初期状態に戻す前のデータになる');
  check(
    /『直前の状態に戻す』の前の状態に戻せます/.test(await page.getByTestId('data-prev-text').innerText()),
    '戻したあとは、戻す前のデータが控えに残る（もう一度戻せる）',
  );
  // 書き出すと「最後に書き出した日」が今日になる
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ファイルに書き出す' }).click();
  const file = await dl;
  check(/\.json$/.test(file.suggestedFilename()), '控えを書き出す（download）', file.suggestedFilename());
  await settle(page, 300);
  const last = await page.getByTestId('data-last-export').innerText();
  const md = `${Number(TODAY.slice(5, 7))}/${Number(TODAY.slice(8, 10))}`;
  check(last.includes(`${md}（今日）`), '書き出すと最後に書き出した日が今日', last);
  check(
    (await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), BACKUP_LAST_KEY))?.date === TODAY,
    '最後に書き出した日は別のキー（vrdemo:backup:last）',
  );
  await page.reload();
  await page.getByTestId('data-last-export').waitFor();
  check(
    (await page.getByTestId('data-last-export').innerText()).includes('（今日）'),
    '読み直しても最後に書き出した日が残る',
  );
  // 古い訪問の記録を片づける：既定は3か月前の月より前。古い確定した内容だけ消え、新しいものは残る
  const old1 = monthsAgo(5, 10);
  const old2 = monthsAgo(4, 3);
  const recent = monthsAgo(1, 12);
  await writeData(
    page,
    (d, a) => ({
      ...d,
      snapshots: { ...d.snapshots, [a.old1]: a.s1, [a.old2]: a.s2, [a.recent]: a.s3 },
    }),
    { old1, old2, recent, s1: fakeSnap(old1), s2: fakeSnap(old2), s3: fakeSnap(recent) },
  );
  await page.getByTestId('data-tidy-card').waitFor();
  await settle(page, 400);
  const sel = await page.getByTestId('data-tidy-month').inputValue();
  check(sel === monthsAgo(3, 1).slice(0, 7), '片づけ：既定は3か月前の月', sel);
  const pv = await page.getByTestId('data-tidy-preview').innerText();
  check(/2日分の訪問 0件・確定した内容 2日分/.test(pv), '片づけ：件数と空く見込み', pv);
  await page.getByTestId('data-tidy-run').click();
  await page.getByTestId('confirm-dialog').waitFor();
  check(/確定した内容 2日分を消します/.test(await page.getByTestId('confirm-body').innerText()), '片づけ：確認つき');
  await page.getByTestId('confirm-ok').click();
  await page.locator('.toast').filter({ hasText: '訪問の記録を消しました' }).waitFor();
  await settle(page, 600);
  const after = await stored(page);
  check(
    !after.snapshots[old1] && !after.snapshots[old2],
    '片づけ：選んだ月より前の確定した内容が消える',
    Object.keys(after.snapshots),
  );
  check(!!after.snapshots[recent], '片づけ：新しい確定した内容は残る');
  check(after.seed === 424242, '片づけ：ほかのデータはそのまま');
  check(await page.getByTestId('data-tidy-run').isDisabled(), '片づけ：消せるものが無ければ押せない');
  await page.screenshot({ path: path.join(OUT_DIR, 'data-protect.png'), fullPage: true });
  // 別のタブで変わったら知らせる
  const other = await ctx.newPage();
  await other.clock.setFixedTime(NOW);
  await other.goto(`${BASE}#/home`);
  await other.locator('h1').waitFor();
  await other.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem(k));
    localStorage.setItem(k, JSON.stringify({ ...d, seed: 515151 }));
  }, STORAGE_KEY);
  await page.locator('.toast').filter({ hasText: '別のタブで変わったので読み直しました' }).waitFor({ timeout: 5000 });
  check(true, '別のタブで変わると「別のタブで変わったので読み直しました」');
  await other.close();
  await ctx.close();
}

async function brokenData(b) {
  // 保存していたデータが壊れている：起動時に知らせと「読めなかったデータを書き出す」
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await skipTour(ctx);
  await ctx.addInitScript((k) => {
    if (sessionStorage.getItem('e2e-broken')) return;
    sessionStorage.setItem('e2e-broken', '1');
    localStorage.setItem(k, '{こわれた');
  }, STORAGE_KEY);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  page.on('pageerror', (e) => {
    errors.push(String(e));
    console.log('ERR', String(e));
  });
  await page.goto(`${BASE}#/home`);
  const notice = page.getByTestId('data-broken-notice');
  await notice.waitFor({ timeout: 30000 });
  check(
    /保存していたデータを読めなかったため、初期データで開きました/.test(await notice.innerText()),
    '壊れたデータ：起動時に知らせる',
  );
  await page.emulateMedia({ media: 'print' });
  check(!(await notice.isVisible()), '印刷では知らせを出さない');
  await page.emulateMedia({ media: 'screen' });
  const dl = page.waitForEvent('download');
  await page.getByTestId('data-broken-download').click();
  const file = await dl;
  const text = fs.readFileSync(await file.path(), 'utf8');
  check(text === '{こわれた', '「読めなかったデータを書き出す」は元の文字のまま', text);
  await page.screenshot({ path: path.join(OUT_DIR, 'data-broken.png') });
  await page.getByTestId('data-broken-close').click();
  await settle(page, 300);
  check((await notice.count()) === 0, '閉じると消える');
  check(await page.evaluate(() => document.activeElement?.tagName === 'H1'), '閉じるとフォーカスは画面の見出し');
  // 退避できたので初期データを書いた：読み直しても知らせは出ない（1回だけ）。元の文字は退避先に残る
  await page.reload();
  await page.locator('h1').waitFor();
  await settle(page, 500);
  check((await notice.count()) === 0, '退避して初期データを書いたので、読み直すと知らせは出ない（1回だけ）');
  check(
    (await page.evaluate(() => localStorage.getItem('vrdemo:data:broken'))) === '{こわれた',
    '元の文字は vrdemo:data:broken に残る',
  );
  await ctx.close();
}

async function backupRemind(b) {
  // 確定した日があり、2週間以上書き出していなければ起動時に1回トースト（1日1回）
  const { ctx, page } = await newPage(b, { human: false });
  await open(page, '/home', 'h1');
  // 今日の訪問（保存した訪問は空なので、計算した繰り返しの回）
  const first = visitsIn(
    await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY),
    TODAY,
    TODAY,
  ).find((x) => !x.cancelled);
  await page.evaluate(
    ({ k, last, today, v }) => {
      const d = JSON.parse(localStorage.getItem(k));
      d.snapshots = {
        ...d.snapshots,
        [today]: {
          date: today,
          at: 1,
          visits: [{ id: v.id, clientId: v.clientId, staffId: d.staff[0].id, start: null }],
        },
      };
      localStorage.setItem(k, JSON.stringify(d));
      localStorage.setItem(last, JSON.stringify({ date: '2026-01-01', kind: 'json' }));
      localStorage.removeItem('vrdemo:backup:reminded');
    },
    { k: STORAGE_KEY, last: BACKUP_LAST_KEY, today: TODAY, v: first },
  );
  await page.reload();
  await page
    .locator('.toast')
    .filter({ hasText: '控え（バックアップ）を2週間以上書き出していません' })
    .waitFor({ timeout: 5000 });
  check(true, '控えの知らせ：確定した日があり2週間以上書き出していなければトースト');
  await page.reload();
  await page.locator('h1').waitFor();
  await settle(page, 800);
  check(
    (await page.locator('.toast').filter({ hasText: '控え（バックアップ）' }).count()) === 0,
    '控えの知らせ：1日1回まで',
  );
  await ctx.close();
}

let b = null;
const steps = [
  [
    '準備',
    async () => {
      b = await launch();
    },
  ],
  ...[
    ['first-run', firstRun],
    ['first-run-one-off', firstRunOneOff],
    ['first-run-own', firstRunOwn],
    ['first-run-restart', firstRunRestart],
    ['tour-dialog', tourDialog],
    ['tour-today', tourToday],
    ['tour-mobile-print', tourMobilePrint],
    ['file-pick', filePick],
    ['month-list', monthList],
    ['data-protect', dataProtect],
    ['broken-data', brokenData],
    ['backup-remind', backupRemind],
  ].map(([name, fn]) => [name, guard(() => fn(b), { label: name })]),
  ['後始末', () => check(native.length === 0, 'ブラウザのダイアログを出さない', native)],
];

module.exports = { steps };
if (require.main === module) runSteps(steps);
