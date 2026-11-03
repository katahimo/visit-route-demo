// 「基本」（初めて開いたときの最初の2問に「デモで試す・定期」で答えたひな形。エキスパート機能は切）で予定が自動で決まること
// （自動の組み PRD D372〜D378・決まった予定 PRD D382。ADR-0072・ADR-0073）を本物のブラウザで確かめる：
// 自動の組み
//  1 日の予定の「予定を入れる」で担当を選ばずに単発の訪問を足す → 知らせ「N件の担当を組みました」と［元に戻す］が出てその訪問に担当が付く（ピンは付けない）
//    → ［元に戻す］で担当なしに戻る（訪問は残る）
//  2 予定の上の要対応の帯の従のボタン［要対応を組む］：押すと組まれて件数が減る（エキスパート機能が入なら出さない）
//  2b 間に合わない（時間休で時間の約束に間に合わない）訪問が帯に「間に合わない N件」と出て、［要対応を組む］で別の人に組み直され、帯から消える（ADR-0089）
//  3 〈利用者さん〉の画面で担当なしの繰り返しを足す → 自動で組まれ、繰り返しの担当（usualStaffId）が書かれて行に出る
//    （組んだ回は訪問として保存され、保存の直後に別の画面へ移っても組みは続く）
//  4 ひな形「単発のみ」を当てると〈利用者さん〉の画面の予定のタブから繰り返しの欄が消える（入り切りの全体は e2e-features・e2e-features2）
// 決まった予定
//  5 日の画面：確定のボタン・「確定済み」「まだ伝えていない」の印が無い（初期データは伝えた記録なし）
//  5b 要対応（担当なし）が残る日は、手で直しても伝えた記録を付けず、もう一度直しても「変更あり」が出ない（ADR-0089）
//  6 要対応の無い日（今日の担当なし・要対応の回を取り消して作る）で手で担当を直すと、その日が自動で決まった（伝えた）扱いになる
//    （snapshots[今日]・at・今の担当）。印は出ない
//  7 もう一度直すと訪問に「変更あり」の印と日の上の「変更あり N件」のチップ（伝えた記録は書き換えない）。印を押すと連絡の一覧が開き
//    （札は選ばない）、「連絡した」で今の担当・時刻が伝えた記録になり「変更あり」が消える（操作の行の［元に戻す］で戻る）
//  8 週の予定の印を押すとその日の日の予定へ移り連絡の一覧が開く（URL の ?do=told・?date= は消える）
//  9 月の予定：確定の段階（進み具合の帯の「確定」・右の欄の「確定していない日」・まとめて確定）が無い。マスに「変更あり」の印は出さず、
//   押した日の右の欄の行の印から連絡の一覧へ（PRD D410）。?do=unconfirmed は最初の要対応の日の予定へ移る（切は要対応の一覧が無い）
// 10 エキスパート機能を入にすると確定（伝えた）の操作が出て、自動では伝えない（直しても snapshots は増えない）
// 11 決まった日に訪問を足すと自動の組みが担当を付け、足した訪問は「変更あり」（伝えた記録は書き換えない）
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-basic-auto.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const { BASE, TODAY, STORAGE_KEY, check, hashOf, runSteps, settle, until } = require('./lib/env.cjs');
const { sharedPage } = require('./lib/steps.cjs');
const { freshAsked, openAsked } = require('./lib/firstRun.cjs');
const { findVisit, visitsIn } = require('./lib/visits.cjs');
const { applyTemplate } = require('./lib/features.cjs');
const { pressTool } = require('./lib/ui.cjs');

/**
 * 2問の答え：デモ×定期で、作った直後の1回の組み（PRD D409）は知らせの［元に戻す］で戻して始める
 * （初期データの担当なし・伝えた記録の無い日から、自動の組みと決まった予定を確かめる。最初の組みそのものは e2e-tour）
 */
const UNARRANGED = { arranged: false };
const data = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
/** 自動の組みは Worker で解いてから書く（並列の実行・遅い環境では数秒かかる）ので、ok(d) が真になるまで最長30秒待って読む */
const dataWhen = async (page, ok) =>
  (await until(async () => {
    const d = await data(page);
    return ok(d) ? d : null;
  }, 30000)) ?? (await data(page));
const panel = (page) => page.getByTestId('visit-panel');
const toast = (page) => page.locator('.toast-layer .toast-text');
/** 知らせの文が出るのを待って返す（出なければ空）。ms は待つ長さ（帯の［要対応を組む］・保存のあとの組みは今日〜翌月末を見るので長く待つ） */
const toastText = async (page, re, ms) => {
  const ok = await until(
    async () =>
      re.test(
        (await toast(page)
          .first()
          .innerText()
          .catch(() => '')) || '',
      ),
    ms,
  );
  return ok ? await toast(page).first().innerText() : '';
};
const reBtn = (page) => page.getByTestId('plan-reassign');
const reList = (page) => page.getByTestId('plan-reassign-list');
const sheet = (page) => page.getByTestId('contact-sheet');

/** 1 単発の訪問を足す → 組まれる → 元に戻す */
async function single(page) {
  await freshAsked(page, `/plan?date=${TODAY}`, '[data-testid="sched-nav"]', UNARRANGED);
  const d0 = await data(page);
  check(d0.org.features.expert === false, '前提：初めて開くとエキスパート機能は切', d0.org.features);
  const n0 = d0.visits.length;
  await page.getByTestId('plan-visit-add').click();
  await panel(page).waitFor();
  await panel(page).getByTestId('vp-start').fill('10:00');
  await settle(page, 400);
  check(
    (await panel(page).getByTestId('vp-staff-keep').isChecked()) === true,
    '新規の欄の担当は「変えない」のまま（担当を選ばない）',
  );
  const ids0 = new Set(d0.visits.map((x) => x.id));
  /** 足した訪問（保存のあとの組みは要対応の回も保存した回にするので、増えた ID のうち 10:00 の単発） */
  const addedOf = (d) => d.visits.find((x) => !ids0.has(x.id) && !x.pattern && x.earliestStart === '10:00');
  await page.getByTestId('vp-save').click();
  await panel(page).waitFor({ state: 'detached', timeout: 10000 });
  const text = await toastText(page, /件の担当を組みました/, 60000);
  check(/^\d+件の担当を組みました/.test(text) && !/^0件/.test(text), '知らせ「N件の担当を組みました」', text);
  check((await page.getByTestId('toast-undo').count()) === 1, '知らせに［元に戻す］がある');
  const d1 = await dataWhen(page, (x) => addedOf(x)?.staffId);
  const v = addedOf(d1);
  check(!!v && d1.visits.filter((x) => !ids0.has(x.id) && !x.pattern).length === 1, '単発の訪問が1件増えた', v);
  check(v.staffId !== null && v.pinned === false, '足した訪問に担当が付く（ピンは付けない）', v);
  // 元に戻す：担当なしへ（訪問は残る）
  await page.getByTestId('toast-undo').click();
  const d2 = await dataWhen(page, (x) => x.visits.find((y) => y.id === v.id)?.staffId === null);
  const back = d2.visits.find((y) => y.id === v.id);
  check(!!back && back.staffId === null, '［元に戻す］で担当なしに戻る（訪問は残る）', back);
  check(d2.visits.length >= n0 + 1 && !!back, '元に戻しても足した訪問は消えない', d2.visits.length);
}

/** 2 要対応の帯の［要対応を組む］：担当なしの訪問を組む（PRD D403。1 のあとの状態から続ける） */
async function bandArrange(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.getByTestId('sched-nav').waitFor({ timeout: 60000 });
  await settle(page, 500);
  // ［要対応を組む］は予定の上の帯の従のボタン（組める要対応が0件なら出ない。操作の行・「その他 ▾」に無いことは e2e-simple-menu）
  const btn = page.getByTestId('attention-band-arrange');
  /** 帯の「担当なし N件」の N（帯が無い・担当なしが無ければ 0） */
  const countOf = async () => {
    const t = (await page.getByTestId('attention-band-text').count())
      ? await page.getByTestId('attention-band-text').innerText()
      : '';
    return Number(/担当なし (\d+)件/.exec(t)?.[1] ?? 0);
  };
  await btn.waitFor({ timeout: 30000 });
  const n0 = await countOf();
  // 初期データにも担当なしの繰り返しの回があるので、件数は「足した1件を含む N件」（N は2以上）
  check(n0 >= 2, '帯に「担当なし N件」（元に戻した1件を含む）', n0);
  check((await btn.getAttribute('class'))?.includes('btn-primary') === false, '［要対応を組む］は主ボタンではない');
  check(/要対応を組む/.test(await btn.innerText()), 'ボタンの名前は「要対応を組む」', await btn.innerText());
  const before = await data(page);
  const target = before.visits.find((y) => y.staffId === null && !y.pinned && y.earliestStart === '10:00');
  check(!!target, '前提：元に戻した担当なしの訪問が残っている', before.visits.length);
  await btn.click();
  const text = await toastText(page, /件の担当を組みました/, 120000);
  check(/^\d+件の担当を組みました/.test(text), '［要対応を組む］を押すと知らせ「N件の担当を組みました」', text);
  const after = await dataWhen(page, (x) => x.visits.find((y) => y.id === target.id)?.staffId);
  const v = after.visits.find((y) => y.id === target.id);
  check(!!v?.staffId && v.pinned === false, '足した訪問に担当が付く（ピンは付けない）', v);
  check(hashOf(page).startsWith('#/month'), '月の予定のまま（画面を移らない）');
  // 組んだ分だけ減る（組めない日の訪問は担当なしのまま残るので、帯の件数は残ってもよい。0件なら［要対応を組む］が消える）
  const n1 = await until(async () => {
    const n = await countOf();
    return n < n0 ? { n } : null;
  });
  check(n1 !== null && n1 !== undefined && n1.n < n0, '組んだあとは帯の「担当なし」の件数が減る（0件なら消える）', {
    n0,
    n1,
  });
}

/** 帯の「<種類> N件」の N（帯が無い・その種類が無ければ 0） */
async function bandCount(page, label) {
  const el = page.getByTestId('attention-band-text');
  const t = (await el.count()) ? await el.innerText() : '';
  return Number(new RegExp(`${label} (\\d+)件`).exec(t)?.[1] ?? 0);
}

/**
 * 2b 間に合わない訪問を［要対応を組む］で組み直す（ADR-0089）：今日の朝の担当のある訪問の担当に、その時刻を含む時間休（欠勤の時間帯）を
 * 入れると、その訪問だけでも時間の約束に間に合わない＝帯に「間に合わない N件」。押すと別の人に組み直され、帯の「間に合わない」が減る
 * （伝えた日の訪問は組み直さないので、今日の伝えた記録は消してから）
 */
async function lateArrange(page) {
  await page.goto(`${BASE}#/month`);
  await page.getByTestId('sched-nav').waitFor({ timeout: 60000 });
  const d0 = await data(page);
  const v = visitsIn(d0, TODAY, TODAY).find(
    (x) =>
      !x.cancelled && x.staffId && x.windowKind === 'fixed' && x.earliestStart >= '09:00' && x.earliestStart <= '10:30',
  );
  check(!!v, '前提：今日の朝（9:00〜10:30）に担当のある固定の訪問がある', visitsIn(d0, TODAY, TODAY).length);
  if (!v) return;
  await page.evaluate(
    ([k, staffId, date]) => {
      const d = JSON.parse(localStorage.getItem(k));
      d.absences = [
        ...d.absences.filter((a) => !(a.staffId === staffId && a.date === date)),
        { id: 'e2e-late', staffId, date, from: '08:00', to: '12:00', note: '' },
      ];
      // 2 の組みで今日は伝えた記録が付いている。伝えた日の訪問は組み直さないので、まだ伝えていない日に戻す
      delete d.snapshots[date];
      localStorage.setItem(k, JSON.stringify(d));
    },
    [STORAGE_KEY, v.staffId, TODAY],
  );
  await page.reload();
  await page.getByTestId('attention-band').waitFor({ timeout: 60000 });
  const late0 =
    (await until(async () => {
      const n = await bandCount(page, '間に合わない');
      return n > 0 ? n : null;
    }, 30000)) ?? 0;
  const text0 = await page.getByTestId('attention-band-text').innerText();
  check(late0 > 0, '時間休で時間の約束に間に合わない訪問は帯に「間に合わない N件」（重なりではない）', text0);
  check(
    /担当なし \d+件・間に合わない|^間に合わない/.test(text0) || !/担当なし/.test(text0),
    '並びは 担当なし → 間に合わない',
    text0,
  );
  const btn = page.getByTestId('attention-band-arrange');
  await btn.waitFor({ timeout: 30000 });
  await btn.click();
  const toastDone = await toastText(page, /件の担当を組みました/, 120000);
  check(/^\d+件の担当を組みました/.test(toastDone), '［要対応を組む］の知らせ「N件の担当を組みました」', toastDone);
  const after = await dataWhen(page, (x) => {
    const y = findVisit(x, v.id);
    return !!y && y.staffId !== v.staffId;
  });
  const moved = findVisit(after, v.id);
  check(!!moved?.staffId && moved.staffId !== v.staffId, '間に合わない訪問は別の人に組み直される', {
    before: v.staffId,
    after: moved,
  });
  const late1 = await until(async () => {
    const n = await bandCount(page, '間に合わない');
    return n < late0 ? { n } : null;
  }, 30000);
  check(!!late1, '組み直したあとは帯の「間に合わない」が減る（その訪問は帯から消える）', { late0, late1 });
}

/** 3 〈利用者さん〉の画面で担当なしの繰り返しを足す → 自動で組まれ、繰り返しの担当が書かれる */
async function pattern(page) {
  await freshAsked(page, '/clients/c1', '[data-testid="pcal"]', UNARRANGED);
  const d0 = await data(page);
  const p0 = d0.patterns.filter((p) => p.clientId === 'c1').length;
  const staffName = (d, id) => d.staff.find((s) => s.id === id)?.displayName ?? d.staff.find((s) => s.id === id)?.name;
  await page.getByTestId('pattern-add').click();
  const form = page.getByTestId('pattern-form');
  await form.waitFor();
  await form.getByTestId('pattern-weekdays').getByRole('button', { name: '木' }).click();
  await form.getByLabel('開始', { exact: true }).fill('17:00');
  const staffSel = form.getByTestId('pattern-staff');
  const usual0 = await staffSel
    .locator('select')
    .inputValue()
    .catch(() => '');
  check(usual0 === '' || usual0 === 'none', '前提：いつもの担当は選ばない（担当なし）', usual0);
  await form.getByTestId('pattern-save').click();
  const d1 = await dataWhen(page, (x) => {
    const p = x.patterns.find((y) => y.clientId === 'c1' && y.earliestStart === '17:00');
    return !!p && p.usualStaffId !== null;
  });
  const added = d1.patterns.find((p) => p.clientId === 'c1' && p.earliestStart === '17:00');
  check(d1.patterns.filter((p) => p.clientId === 'c1').length === p0 + 1, '繰り返しが1件増えた');
  check(!!added && added.usualStaffId !== null, '自動で組まれ、繰り返しの担当（usualStaffId）が書かれる', added);
  const text = await toastText(page, /件の担当を組みました/);
  check(/^\d+件の担当を組みました/.test(text), '知らせ「N件の担当を組みました」', text);
  // 画面の表示：行の「いつもの担当」と、カレンダーの回
  const row = page.locator(`[data-testid="pattern-row"][data-pattern="${added.id}"]`);
  await row.waitFor();
  const name = staffName(d1, added.usualStaffId);
  const rowText = await row.innerText();
  check(!!name && rowText.includes(name), '繰り返しの行の「いつもの担当」に組んだ人が出る', { name, rowText });
  // 範囲（今日〜翌月末）の回に担当が付き（組めない日は担当なしのまま）、担当は繰り返しの担当に寄る
  const month = new Date(`${TODAY}T00:00:00Z`);
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
  const rows = visitsIn(d1, TODAY, end).filter((y) => y.pattern?.id === added.id);
  check(
    rows.length > 0 && rows.some((y) => y.staffId === added.usualStaffId),
    '今日〜翌月末の回に担当が付く',
    rows.length,
  );
  check(!!findVisit(d1, rows[0]?.id ?? ''), '回の訪問が見つかる（前提）');
}

/** 4 ひな形「単発のみ」を当てると繰り返しの欄が消える */
async function oneOff(page, dlg) {
  await freshAsked(page, '/clients/c1', '[data-testid="pcal"]', UNARRANGED);
  check((await page.getByTestId('patterns-section').count()) === 1, '前提：初めは繰り返しの欄が出る（基本）');
  await applyTemplate(page, dlg, 'oneOff');
  const d = await dataWhen(page, (x) => x.org.features.patterns === false);
  check(
    d.org.features.patterns === false && d.org.features.expert === false,
    '単発のみ：繰り返しの機能が切',
    d.org.features,
  );
  await page.goto('about:blank');
  await page.goto(`${BASE}#/clients/c1`);
  await page.getByTestId('pcal').waitFor({ timeout: 60000 });
  await settle(page, 400);
  check((await page.getByTestId('patterns-section').count()) === 0, '単発のみ：予定のタブから繰り返しの欄が消える');
  check((await page.getByTestId('pattern-add').count()) === 0, '単発のみ：「繰り返しを足す」も出ない');
}

/** 今日の最初の担当の列の最初の帯の訪問 ID */
const firstVisit = (page) =>
  page.locator('.route-col:not(.route-col-none) .tl-band').first().getAttribute('data-visit');

/** 訪問を別の担当へ移す（帯 → 詳細の「担当を変える」→ 押せる最初のほかの人）。移した先の人の ID を返す */
async function moveVisit(page, vid) {
  await page.locator(`.tl-band[data-visit="${vid}"] .tl-band-btn`).click();
  await reBtn(page).waitFor({ timeout: 5000 });
  await reBtn(page).click();
  await reList(page).waitFor();
  const item = reList(page).locator('[data-key^="to-"]:not([aria-disabled="true"])').first();
  const key = await item.getAttribute('data-key');
  await item.click();
  const staffId = key.replace(/^to-/, '');
  await dataWhen(page, (d) => d.visits.find((x) => x.id === vid)?.staffId === staffId);
  await settle(page, 400);
  return staffId;
}

/** 5 切の日の画面：確定の段階（確定のボタン・確定済み・まだ伝えていない）が無い */
async function plain(page) {
  await freshAsked(page, `/plan?date=${TODAY}`, '[data-testid="sched-nav"]', UNARRANGED);
  const d = await data(page);
  check(d.org.features.expert === false, '前提：初めて開くとエキスパート機能は切', d.org.features);
  check(!d.snapshots[TODAY], '前提：初期データに今日の伝えた記録は無い', Object.keys(d.snapshots));
  check((await page.getByTestId('adopt').count()) === 0, '確定（伝えた）のボタンを出さない');
  check((await page.getByTestId('confirm-state').count()) === 0, '「まだ伝えていない」「確定済み」の印を出さない');
  check((await page.getByTestId('plan-next-unconfirmed').count()) === 0, '「次の確定していない日へ」を出さない');
  check((await page.locator('[data-told-date]').count()) === 0, '決まる前は「変更あり」の印が無い');
}

/**
 * 今日の要対応（担当なし・帯の印のある訪問）を取り消して、要対応の無い日にする（ADR-0089：要対応が残る日は伝えた記録を付けないので、
 * 自動の伝えた記録を確かめる前に呼ぶ）。今日の日の予定を開き直して返す
 */
async function clearIssuesToday(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/plan?date=${TODAY}`);
  await page.getByTestId('sched-nav').waitFor({ timeout: 60000 });
  await settle(page, 800);
  const marked = await page
    .locator('.tl-band-btn[data-marks~="issue"]')
    .evaluateAll((es) => es.map((e) => e.closest('[data-visit]')?.getAttribute('data-visit')));
  const d = await data(page);
  const bad = visitsIn(d, TODAY, TODAY).filter((v) => !v.cancelled && (v.staffId === null || marked.includes(v.id)));
  await page.evaluate(
    ([k, put]) => {
      const x = JSON.parse(localStorage.getItem(k));
      const ids = new Set(put.map((v) => v.id));
      x.visits = [...x.visits.filter((v) => !ids.has(v.id)), ...put];
      localStorage.setItem(k, JSON.stringify(x));
    },
    [STORAGE_KEY, bad.map((v) => ({ ...v, cancelled: true }))],
  );
  await page.reload();
  await page.getByTestId('sched-nav').waitFor({ timeout: 60000 });
  await settle(page, 800);
  check(
    (await page.locator('.tl-band-btn[data-marks~="issue"]').count()) === 0,
    '前提：今日の要対応の訪問を取り消した（要対応の無い日）',
  );
}

/** 5b 要対応（担当なし）が残る日は手で直しても伝えた記録を付けず、「変更あり」も出ない（ADR-0089） */
async function noTellWithIssues(page) {
  const d0 = await data(page);
  const open = visitsIn(d0, TODAY, TODAY).filter((v) => !v.cancelled && v.staffId === null);
  check(open.length > 0, '前提：今日に担当なしの訪問が残る（作った直後の組みを元に戻した初期データ）', open.length);
  await moveVisit(page, await firstVisit(page));
  await settle(page, 600);
  check(!(await data(page)).snapshots[TODAY], '要対応が残る日は、手で直しても伝えた記録を付けない');
  await moveVisit(page, await firstVisit(page));
  await settle(page, 600);
  check(!(await data(page)).snapshots[TODAY], 'もう一度直しても伝えた記録は無いまま');
  check(
    (await page.locator('[data-told-date]').count()) === 0 && (await page.getByTestId('confirm-state').count()) === 0,
    '要対応が残る日は直しても「変更あり」の印・チップが出ない（連絡していない変更を未連絡に出さない）',
  );
}

/** 6 手で直すと、その日が自動で決まった（伝えた）扱いになる */
async function settle1(page) {
  await clearIssuesToday(page);
  const vid = await firstVisit(page);
  const staffId = await moveVisit(page, vid);
  const d = await dataWhen(page, (x) => !!x.snapshots[TODAY]);
  const snap = d.snapshots[TODAY];
  check(!!snap && snap.date === TODAY && snap.at > 0, '手で直すと今日の伝えた記録が自動で付く', snap);
  check(
    snap?.visits.find((x) => x.id === vid)?.staffId === staffId,
    '伝えた記録は今の担当（移した先）になっている',
    snap?.visits.find((x) => x.id === vid),
  );
  check((await page.getByTestId('confirm-state').count()) === 0, '決まった直後は「変更あり」の印も出ない');
  check((await page.locator('[data-told-date]').count()) === 0, '決まった直後は訪問の「変更あり」の印が無い');
  check((await page.getByTestId('adopt').count()) === 0, '決まっても確定のボタンは出ない');
  return { vid, snap };
}

/** 7 もう一度直す → 変更あり → 印を押す → 連絡した → 消える → 元に戻す */
async function changed(page) {
  const vid = await firstVisit(page);
  const before = (await data(page)).snapshots[TODAY];
  const staffId = await moveVisit(page, vid);
  const d = await data(page);
  check(
    d.snapshots[TODAY].at === before.at && JSON.stringify(d.snapshots[TODAY].visits) === JSON.stringify(before.visits),
    '伝えた記録のある日は自動では書き換えない（直したあとも前の伝えた記録のまま）',
  );
  const chip = page.getByTestId('confirm-state');
  await chip.waitFor({ timeout: 10000 });
  check(/変更あり/.test(await chip.innerText()), '日の上に「変更あり N件」のチップ', await chip.innerText());
  const mark = page.locator(`.tl-band[data-visit="${vid}"] [data-told-date]`);
  await mark.waitFor({ timeout: 10000 });
  check(
    (await mark.innerText()).trim() === '変更あり' && (await mark.getAttribute('data-told-date')) === TODAY,
    '直した訪問に「変更あり」の印（その日の日付つき）',
    await mark.innerText(),
  );
  // 印を押すと連絡の一覧（札は選び直さない）
  const picked0 = await page.locator('.tl-band.is-picked').count();
  await page.getByTestId('schedule-toolbar').scrollIntoViewIfNeeded();
  await mark.click();
  await sheet(page).waitFor({ timeout: 10000 });
  check(true, '印を押すと連絡の一覧が開く');
  check(
    (await page.locator('.tl-band.is-picked').count()) === picked0,
    '印を押しても訪問の札の選択は変わらない',
    await page.locator('.tl-band.is-picked').count(),
  );
  const done = page.getByTestId('contacted');
  check((await done.count()) === 1, '連絡の一覧に「連絡した」ボタン（メール機能の入り切りに関係なく）');
  // 連絡した → 今の担当が伝えた記録になり、印が消える
  await done.click();
  const after = await dataWhen(page, (x) => x.snapshots[TODAY].at !== before.at);
  check(
    after.snapshots[TODAY].visits.find((x) => x.id === vid)?.staffId === staffId,
    '「連絡した」で今の担当が伝えた記録になる',
    after.snapshots[TODAY].visits.find((x) => x.id === vid),
  );
  await page.locator('[data-told-date]').first().waitFor({ state: 'detached', timeout: 10000 });
  check(
    (await page.getByTestId('confirm-state').count()) === 0 && (await page.locator('[data-told-date]').count()) === 0,
    '「連絡した」のあと「変更あり」の印・チップが消える',
  );
  check((await sheet(page).count()) === 0, '「連絡した」のあと連絡の一覧は閉じる');
  // 元に戻す（今の確定と同じ扱い）：伝えた記録が前に戻り、変更ありが戻る
  // 元に戻すは「その他 ▾」の中（エキスパート機能が切。PRD D384）
  await pressTool(page, 'more-undo', { where: 'more' });
  const undone = await dataWhen(page, (x) => x.snapshots[TODAY].at === before.at);
  check(undone.snapshots[TODAY].at === before.at, '操作の行の［元に戻す］で「連絡した」の前に戻る');
  await page.locator('[data-told-date]').first().waitFor({ timeout: 10000 });
  check(true, '元に戻すと「変更あり」の印が戻る');
}

/** 8 週の予定の印を押すと、その日の日の予定へ移り連絡の一覧が開く */
async function fromWeek(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/week`);
  // 1行の状態は「詳しく」の中（PRD D384）。開く
  await page.getByTestId('week-details-summary').click();
  await page.locator('[data-testid="week-status"]').first().waitFor({ timeout: 60000 });
  await settle(page, 600);
  const text = await page.getByTestId('week-status').innerText();
  check(
    /変更あり/.test(text) && !/確定済み|まだ伝えていない/.test(text),
    '週の1行の状態は「変更あり」と要対応だけ',
    text,
  );
  check((await page.getByTestId('week-next').count()) === 0, '週の主ボタン（まとめて確定）を出さない');
  const mark = page.locator('[data-told-date]').first();
  await mark.waitFor({ timeout: 10000 });
  const date = await mark.getAttribute('data-told-date');
  await mark.click();
  await sheet(page).waitFor({ timeout: 15000 });
  const hash = new URL(page.url()).hash;
  check(
    /^#\/plan/.test(hash) && !/do=told|date=/.test(hash),
    '印を押すと日の予定へ移り、URL の ?do=・?date= は消える',
    hash,
  );
  check(date === TODAY, '印の日付は直した今日', date);
  check((await page.getByTestId('contacted').count()) === 1, '週から移っても連絡の一覧に「連絡した」がある');
}

/** 9 月の予定：確定の段階が無い・要対応の帯に確定の話を出さない */
async function month(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  // 進み具合の帯は「詳しく」の中（PRD D384）。開く
  await page.getByTestId('month-details-summary').click();
  await page.getByTestId('progress-band').waitFor({ timeout: 60000 });
  await settle(page, 600);
  check((await page.getByTestId('band-confirm').count()) === 0, '月の帯に「確定 N/N日」を出さない');
  const next = await page.getByTestId('band-next').getAttribute('data-kind');
  check(next !== 'unconfirmed', '月の帯の次の一手に「確定していない日を見る」を出さない', next);
  // マスは例外だけ（PRD D410）：「変更あり」の印はマスに出さず、変更ありの日は「要対応 N」に数える。
  // マスを押すと右の欄にその日の訪問が出て、行の「変更あり」の印を押すとその日の日の予定の連絡の一覧
  const cell = page.locator(`[data-testid="month-day"][data-date="${TODAY}"]`);
  await cell.waitFor({ timeout: 15000 });
  check((await cell.locator('[data-told-date]').count()) === 0, '月のマスに「変更あり」の印を出さない');
  check((await cell.getByTestId('month-attn').count()) === 1, '変更ありの日のマスに「要対応 N」の札');
  await cell.click();
  const rowMark = page.locator('[data-testid="month-day-visits"] [data-told-date]').first();
  await rowMark.waitFor({ timeout: 15000 });
  await rowMark.click();
  await sheet(page).waitFor({ timeout: 15000 });
  const mh = new URL(page.url()).hash;
  check(/^#\/plan/.test(mh) && !/do=told|date=/.test(mh), '右の欄の行の印を押すと日の予定へ移り連絡の一覧が開く', mh);
  // ?do=unconfirmed は切では要対応へ：要対応の一覧が無い（切）ので、月に要対応があれば最初の要対応の行き先（日の予定）へ移る
  // （lib/useMonthAside の showAside）。月の右の欄は移る前の一瞬だけ描かれるので、それを待たず、移った先（日の予定）を待つ。
  // この段の月は今日が「変更あり」（上で「要対応 N」の札を確かめた）なので、要対応は必ずある
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month?do=unconfirmed`);
  const toPlan = await until(async () => /^#\/plan/.test(hashOf(page)), 60000);
  await page.getByTestId('sched-nav').waitFor({ timeout: 60000 });
  await settle(page, 400);
  check(!!toPlan, '?do=unconfirmed は確定していない日の欄でなく、最初の要対応の日の予定へ移る', hashOf(page));
  check(
    (await page.getByTestId('month-unconfirmed').count()) === 0,
    '?do=unconfirmed でも確定していない日の欄は出ない（要対応へ）',
  );
  check((await page.getByRole('button', { name: /まとめて確定/ }).count()) === 0, '「まとめて確定」のボタンを出さない');
  await page.goto('about:blank');
  await page.goto(`${BASE}#/month`);
  await page.getByTestId('sched-nav').waitFor({ timeout: 60000 });
  const band = page.getByTestId('attention-band');
  if ((await band.count()) > 0)
    check(!/確定|伝えて/.test(await band.innerText()), '要対応の帯に確定の話を出さない', await band.innerText());
}

/** 10 エキスパート機能が入なら確定（伝えた）の操作が出て、自動では伝えない */
async function expertOn(page) {
  await freshAsked(page, `/plan?date=${TODAY}`, '[data-testid="sched-nav"]', UNARRANGED);
  await page.evaluate((k) => {
    const d = JSON.parse(localStorage.getItem(k));
    d.org.features = { ...d.org.features, expert: true };
    localStorage.setItem(k, JSON.stringify(d));
  }, STORAGE_KEY);
  await page.reload();
  await page.getByTestId('adopt').waitFor({ timeout: 60000 });
  check((await page.getByTestId('adopt').count()) === 1, 'expert 入：確定（伝えた）のボタンが出る');
  check(
    /まだ伝えていない/.test(await page.getByTestId('confirm-state').innerText()),
    'expert 入：「まだ伝えていない」の印が出る',
  );
  const vid = await firstVisit(page);
  await moveVisit(page, vid);
  const d = await data(page);
  check(!d.snapshots[TODAY], 'expert 入：手で直しても自動では伝えた記録を付けない', Object.keys(d.snapshots));
}

/** 11 決まった日に担当なしの訪問を足すと、自動の組みが担当を付ける（伝えた内容は書き換えず、足した訪問は「変更あり」） */
async function addToSettled(page) {
  await freshAsked(page, `/plan?date=${TODAY}`, '[data-testid="sched-nav"]', UNARRANGED);
  await clearIssuesToday(page);
  await moveVisit(page, await firstVisit(page));
  const d0 = await dataWhen(page, (x) => !!x.snapshots[TODAY]);
  await page.getByTestId('plan-visit-add').click();
  await page.getByTestId('visit-panel').waitFor();
  await page.getByTestId('visit-panel').getByTestId('vp-start').fill('10:00');
  await settle(page, 400);
  await page.getByTestId('vp-save').click();
  await page.getByTestId('visit-panel').waitFor({ state: 'detached', timeout: 10000 });
  const ids0 = new Set(d0.visits.map((x) => x.id));
  const addedOf = (d) => d.visits.find((x) => !ids0.has(x.id) && !x.pattern && x.earliestStart === '10:00');
  const d1 = await dataWhen(page, (x) => addedOf(x)?.staffId);
  const v = addedOf(d1);
  check(!!v && v.staffId !== null && v.date === TODAY, '決まった日に足した訪問にも自動で担当が付く', v);
  check(d1.snapshots[TODAY].at === d0.snapshots[TODAY].at, '伝えた記録は書き換えない');
  await page.locator(`.tl-band[data-visit="${v.id}"] [data-told-date]`).waitFor({ timeout: 10000 });
  check(true, '足した訪問は「変更あり」（伝える必要がある）');
}

const steps = sharedPage({
  open: () => openAsked(),
  steps: [
    ['1 単発の訪問を足すと担当が組まれ、元に戻せる', single],
    ['2 要対応の帯の［要対応を組む］', bandArrange],
    ['2b 間に合わない訪問を［要対応を組む］で組み直す', lateArrange],
    ['3 繰り返しを足すと組まれ、繰り返しの担当が書かれる', pattern],
    ['4 ひな形「単発のみ」で繰り返しの欄が消える', oneOff],
    ['5 切の日の画面に確定の段階が無い', plain],
    ['5b 要対応が残る日は伝えた記録・変更ありが出ない', noTellWithIssues],
    ['6 手で直すと自動で決まる', settle1],
    ['7 変更あり・印・連絡した・元に戻す', changed],
    ['8 週の印から日の予定の連絡の一覧へ', fromWeek],
    ['9 月に確定の段階が無い', month],
    ['10 expert 入は確定の操作', expertOn],
    ['11 決まった日に足した訪問も自動で組まれる', addToSettled],
  ],
  call: (fn, s) => fn(s.page, s.dlg),
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
