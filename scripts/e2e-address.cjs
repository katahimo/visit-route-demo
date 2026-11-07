// 住所の入力の部品（AddressField。PRD D86〜D90・D118〜D121。ADR-0016）を本物のブラウザで確かめる。
// 外部の検索（郵便番号検索・国土地理院）は page.route の偽の応答に差し替え、外へは出さない：
//   1 開いただけ・打っただけでは送らない。送るのは zipcode・q だけ
//   2 郵便番号を7桁に直す（全角・ハイフン・空白の多い貼り付け）
//   3 候補・「住所を元に戻す」
//   4 見つからない・つながらない・時間切れ（8秒）で知らせを出し、データを変えない
//   5 連打しても1回だけ送る。探している途中に欄を閉じたら書かない
//   6 探している途中に欄を書き換えたら、古い応答で上書きしない
//   7 空き状況：郵便番号を打っても計算し直さない・ピンで見出しが切り替わる・ピンがあれば住所を打っても計算し直さない・
//     郵便番号で住所を差し替えてもピンは残る・仮押さえで postalCode が入る
//   8 〈スタッフ〉の自宅：郵便番号を保存しない
//   9 〈利用者さん〉の欄：data-testid がそろっている・保存で postalCode が入る
//  10 名簿を読み込んだら自動で緯度・経度を入れる（PRD D427。ADR-0094）：確認の本文に送ることの1文・［名簿を読み込む］の続きで
//     始まる（もう押さない）・止める・［続きを探す］・見つからない人は結果に市区町村の1行・「緯度・経度なし」の絞り込みと行の操作
//  11 〈スタッフ〉の自宅をまとめて置く（PRD D427）：一覧の欄・休止を除く・行の［住所から探す］（1人だけ）・［緯度・経度を編集］
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-address.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const path = require('node:path');
const { BASE, OUT_DIR, STORAGE_KEY, check, stored, runSteps, settle, until: untilTrue } = require('./lib/env.cjs');
const { openContext, pagePerStep } = require('./lib/steps.cjs');

const ZIP_ONE = {
  status: 200,
  message: null,
  results: [{ address1: '宮城県', address2: '仙台市青葉区', address3: '一番町' }],
};
const ZIP_TWO = {
  status: 200,
  message: null,
  results: [
    { address1: '宮城県', address2: '仙台市青葉区', address3: '一番町' },
    { address1: '宮城県', address2: '仙台市青葉区', address3: '二日町' },
  ],
};
const feature = (lng, lat, title) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: { title },
});
const GSI_TWO = [
  feature(140.8716, 38.2601, '宮城県仙台市青葉区一番町一丁目'),
  feature(140.88, 38.27, '宮城県仙台市青葉区一番町二丁目'),
];
const GSI_ONE = [feature(140.8716, 38.2601, '宮城県仙台市青葉区一番町一丁目')];

/**
 * 偽の検索サービス。mode：ok（応答を返す）・notFound・abort（つながらない）・hang（応答しない）。delay で応答を遅らせる。
 * notFoundIf（URL → 真偽）が真の呼び出しは、mode が ok でも見つからないを返す。
 * 呼ばれた URL（デコード済み）を calls に残し、応答を返し終えた（つながらないも含む）数を answered に数える
 */
async function fakeServices(page) {
  const fake = {
    zip: { mode: 'ok', body: ZIP_ONE, delay: 0 },
    gsi: { mode: 'ok', body: GSI_ONE, delay: 0 },
    calls: [],
    answered: 0,
  };
  const handle = (key, notFoundBody) => async (route) => {
    const url = decodeURIComponent(route.request().url());
    fake.calls.push(url);
    const f = fake[key];
    if (f.mode === 'hang') return; // 応答しない（アプリの時間切れを待つ）
    if (f.delay) await new Promise((r) => setTimeout(r, f.delay));
    try {
      if (f.mode === 'abort') return await route.abort('failed');
      const body = f.mode === 'notFound' || f.notFoundIf?.(url) ? notFoundBody : f.body;
      // JSONP で呼び直されたときは callback で包む
      const cb = new URL(route.request().url()).searchParams.get('callback');
      await route.fulfill({
        status: 200,
        contentType: cb ? 'text/javascript' : 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: cb ? `${cb}(${JSON.stringify(body)})` : JSON.stringify(body),
      });
    } catch {
      // ページが閉じた・呼び出しを止めた
    } finally {
      fake.answered++;
    }
  };
  await page.route(/zipcloud\.ibsnet\.co\.jp/, handle('zip', { status: 200, message: null, results: null }));
  await page.route(/msearch\.gsi\.go\.jp/, handle('gsi', []));
  return fake;
}

const pinText = (page, id) => page.getByTestId(`${id}-place`).getByTestId('place-pin-text').textContent();
/** 要素の文字が正規表現に当たるまで待つ */
async function until(loc, re, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const t = (await loc.textContent()) ?? (await loc.inputValue().catch(() => ''));
    if (re.test(t)) return t;
    await loc.page().waitForTimeout(50);
  }
  return (await loc.textContent()) ?? '';
}
async function untilValue(loc, pred, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await loc.inputValue();
    if (pred(v)) return v;
    await loc.page().waitForTimeout(50);
  }
  return loc.inputValue();
}

/** その人の画面の住所の節を直す形で開く（`?tab=basic&edit=place`。PRD D308） */
async function openClient(page, id = 'c1') {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/clients/${id}?tab=basic&edit=place`);
  await page.getByTestId('client-place').waitFor();
}
/** 直している節の「取り消し」（変更があれば確認に「捨てる」で答える） */
const cancelSection = (page) => page.getByTestId('sec-cancel').click();

/** 1・2・3・9：送るもの・正規化・候補・元に戻す・〈利用者さん〉の欄 */
async function basics(page, fake) {
  await openClient(page);
  const box = page.getByTestId('client-place');
  for (const id of [
    'client-postal',
    'client-postal-search',
    'client-address',
    'client-geo-search',
    'place-notice',
    'place-lookup-status',
    'place-pin',
    'place-pin-text',
  ]) {
    check((await box.getByTestId(id).count()) === 1, `〈利用者さん〉：data-testid「${id}」がある`);
  }
  check(/郵便番号・住所のみ送信/.test(await box.getByTestId('place-notice').textContent()), '〈利用者さん〉：注記');
  const before = await page.getByTestId('client-address').inputValue();
  await page.getByTestId('client-postal').fill('  ９８０ －　０８１１  ');
  await page.getByTestId('client-address').fill(`${before}`);
  await settle(page, 400);
  check(fake.calls.length === 0, '開いただけ・打っただけでは送らない', fake.calls);
  // 押せない理由は読み上げでも聞こえる
  await page.getByTestId('client-postal').fill('980-08');
  check(
    (await page.getByTestId('client-postal').getAttribute('aria-describedby')) !== null &&
      (await page.getByTestId('client-postal-search').getAttribute('aria-describedby')) !== null,
    '郵便番号のエラー・押せない理由を aria-describedby で結ぶ',
  );
  // aria-disabled のボタンも押せる（押しても送らない）
  await page.getByTestId('client-postal-search').click({ force: true });
  await settle(page, 200);
  check(fake.calls.length === 0, '7桁でなければ送らない');
  // 2 正規化（空白の多い貼り付け）
  await page.getByTestId('client-postal').fill('  ９８０ －　０８１１  ');
  await page.getByTestId('client-postal').blur();
  check((await page.getByTestId('client-postal').inputValue()) === '9800811', '郵便番号を7桁に直す（離れたとき）');
  // 3 候補・元に戻す
  fake.zip.body = ZIP_TWO;
  await page.getByTestId('client-address').fill('東京都千代田区1-1');
  await page.getByTestId('client-postal-search').click();
  await untilValue(page.getByTestId('client-address'), (v) => v === '宮城県仙台市青葉区一番町');
  check(fake.calls.length === 1 && /\?zipcode=9800811$/.test(fake.calls[0]), '送るのは zipcode だけ', fake.calls);
  check((await page.getByTestId('postal-candidate').count()) === 2, '郵便番号の候補が出る');
  await page.getByTestId('postal-candidate').nth(1).click();
  check(
    (await page.getByTestId('client-address').inputValue()) === '宮城県仙台市青葉区二日町',
    '候補を押すと住所を置き換える',
  );
  await page.getByTestId('client-address-undo').click();
  check(
    (await page.getByTestId('client-address').inputValue()) === '東京都千代田区1-1',
    '「住所を元に戻す」で最初の住所に戻る',
  );
  // 住所 → ピン（候補つき）
  fake.gsi.body = GSI_TWO;
  await page.getByTestId('client-address').fill('宮城県仙台市青葉区一番町1-1');
  await page.getByTestId('client-geo-search').click();
  await until(box.getByTestId('place-pin-text'), /38\.26010/);
  const q = fake.calls.at(-1);
  check(/AddressSearch\?q=宮城県仙台市青葉区一番町1-1$/.test(q), '送るのは q だけ', q);
  check((await page.getByTestId('geo-candidate').count()) === 2, '住所の候補が出る');
  await page.getByTestId('geo-candidate').nth(1).click();
  check(/38\.27000/.test(await pinText(page, 'client')), '候補を押すとピンを置き直す');
  // ピンがある状態で郵便番号から住所を差し替えても、ピンは残る
  fake.zip.body = ZIP_ONE;
  await page.getByTestId('client-address').fill('東京都');
  await page.getByTestId('client-postal-search').click();
  const s = await until(box.getByTestId('place-lookup-status'), /緯度・経度は前のまま/);
  check(/『住所から入れ直す』を押してください/.test(s), 'ピンがあれば入れ直しを促す知らせ', s);
  check(/38\.27000/.test(await pinText(page, 'client')), 'ピンは消さずに残す');
  // 9 保存で postalCode が入る
  await page.getByRole('button', { name: '保存' }).click();
  await settle(page, 400);
  const c1 = (await stored(page)).clients.find((c) => c.id === 'c1');
  check(
    c1.place.postalCode === '9800811' && c1.place.address === '宮城県仙台市青葉区一番町' && c1.place.lat === 38.27,
    '〈利用者さん〉：保存で郵便番号・住所・位置が入る',
    c1.place,
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'address-client.png'), fullPage: true });
}

/** 4：見つからない・つながらない・時間切れ */
async function failures(page, fake) {
  await openClient(page, 'c2');
  const box = page.getByTestId('client-place');
  const status = box.getByTestId('place-lookup-status');
  const addr0 = await page.getByTestId('client-address').inputValue();
  const pin0 = await pinText(page, 'client');
  fake.zip.mode = 'notFound';
  await page.getByTestId('client-postal').fill('9999999');
  await page.getByTestId('client-postal-search').click();
  check(/見つかりませんでした/.test(await until(status, /見つかりませんでした/)), '郵便番号：見つからない');
  fake.zip.mode = 'abort';
  await page.getByTestId('client-postal-search').click();
  check(
    /つながりませんでした/.test(await until(status, /つながりませんでした/)),
    '郵便番号：つながらない（JSONP も失敗）',
  );
  fake.gsi.mode = 'notFound';
  await page.getByTestId('client-address').fill('どこにもない住所');
  await page.getByTestId('client-geo-search').click();
  check(/見つかりませんでした/.test(await until(status, /見つかりませんでした/)), '住所：見つからない');
  fake.gsi.mode = 'abort';
  await page.getByTestId('client-geo-search').click();
  check(/つながりませんでした/.test(await until(status, /つながりませんでした/)), '住所：つながらない');
  fake.gsi.mode = 'hang';
  await page.getByTestId('client-geo-search').click();
  check(
    /時間内に応答がありませんでした/.test(await until(status, /時間内に応答がありませんでした/, 11000)),
    '住所：時間切れ（8秒）',
  );
  check(
    (await page.getByTestId('client-address').inputValue()) === 'どこにもない住所' &&
      (await pinText(page, 'client')) === pin0,
    '失敗してもデータ（住所・位置）は変えない',
  );
  await cancelSection(page);
  const c2 = (await stored(page)).clients.find((c) => c.id === 'c2');
  check(c2.place.address === addr0, '失敗しても store は変えない');
}

/** 空き状況の「2 場所（任意）」を開く（PRD D184。はじめは畳んで要約の行だけ） */
async function openVacancyPlace(page) {
  const stage = page.getByTestId('vacancy-step-place');
  await stage.waitFor();
  if ((await stage.getAttribute('open')) === null) await page.getByTestId('vacancy-place-toggle').click();
  await page.getByTestId('vacancy-place').waitFor();
}

/** 偽の検索サービスへ送るまで待つ（押してから、探している途中の操作をする前に） */
async function untilSent(fake, before) {
  await untilTrue(() => fake.calls.length > before);
}
/**
 * 送った検索の（古い）応答を返し終え、ページがそれを受けて落ち着くまで待つ。
 * 「古い応答が来ても書かない」は DOM に出ないので、応答を返したこと（fake.answered）を目印にする（ADR-0041）
 */
async function untilAnswered(page, fake, before) {
  await untilTrue(() => fake.answered > before);
  await settle(page, 300);
}

/** 5・6：連打・閉じる・途中で書き換え */
async function races(page, fake) {
  await page.goto(`${BASE}#/vacancy`);
  await openVacancyPlace(page);
  const status = page.getByTestId('vacancy-status');
  // 5 連打しても1回
  fake.zip.delay = 600;
  await page.getByTestId('vacancy-postal').fill('9800811');
  await page.getByTestId('vacancy-postal-search').click({ clickCount: 3, delay: 20 });
  // 探している間（aria-disabled）にもう一度押す
  await page.getByTestId('vacancy-postal-search').click({ force: true });
  await untilValue(page.getByTestId('vacancy-address'), (v) => v !== '');
  check(fake.calls.filter((u) => u.includes('zipcode=')).length === 1, '連打しても1回しか送らない', fake.calls.length);
  // 6 郵便番号を探している途中に住所を書き換えたら、古い応答で上書きしない
  fake.zip.delay = 800;
  await page.getByTestId('vacancy-address').fill('');
  await page.getByTestId('vacancy-postal').fill('9800812');
  let sent = fake.calls.length;
  let answered = fake.answered;
  await page.getByTestId('vacancy-postal-search').click();
  await untilSent(fake, sent);
  await page.getByTestId('vacancy-address').fill('手で書いた住所');
  await untilAnswered(page, fake, answered);
  check(
    (await page.getByTestId('vacancy-address').inputValue()) === '手で書いた住所',
    '途中で住所を書き換えたら、郵便番号の古い応答で上書きしない',
  );
  check(!/住所を探しています/.test(await status.textContent()), '書き換えたら「探しています」を解く');
  // 郵便番号を書き換えた場合
  await page.getByTestId('vacancy-address').fill('');
  sent = fake.calls.length;
  answered = fake.answered;
  await page.getByTestId('vacancy-postal-search').click();
  await untilSent(fake, sent);
  await page.getByTestId('vacancy-postal').fill('100-0001');
  await untilAnswered(page, fake, answered);
  check(
    (await page.getByTestId('vacancy-address').inputValue()) === '',
    '途中で郵便番号を書き換えたら、古い応答を捨てる',
  );
  // 住所を探している途中に住所を書き換えたら、ピンを置かない
  fake.gsi.delay = 800;
  await page.getByTestId('vacancy-address').fill('宮城県仙台市青葉区一番町');
  sent = fake.calls.length;
  answered = fake.answered;
  await page.getByTestId('vacancy-geo-search').click();
  await untilSent(fake, sent);
  await page.getByTestId('vacancy-address').fill('宮城県仙台市青葉区一番町2-2');
  await untilAnswered(page, fake, answered);
  check(/未登録/.test(await pinText(page, 'vacancy')), '途中で住所を書き換えたら、古い応答でピンを置かない');
  fake.zip.delay = 0;
  fake.gsi.delay = 0;

  // 5 探している途中に節を取り消したら書かない
  fake.zip.delay = 800;
  await openClient(page, 'c3');
  const addr0 = await page.getByTestId('client-address').inputValue();
  await page.getByTestId('client-postal').fill('9800811');
  sent = fake.calls.length;
  answered = fake.answered;
  await page.getByTestId('client-postal-search').click();
  await untilSent(fake, sent);
  await cancelSection(page);
  await untilAnswered(page, fake, answered);
  const c3 = (await stored(page)).clients.find((c) => c.id === 'c3');
  check(c3.place.address === addr0 && c3.place.postalCode !== '9800811', '探している途中に取り消したら書かない');
  await openClient(page, 'c3');
  check((await page.getByTestId('client-address').inputValue()) === addr0, '開き直しても古い応答は入らない');
  fake.zip.delay = 0;
}

/** 7：空き状況 */
async function vacancy(page) {
  await page.goto(`${BASE}#/vacancy`);
  await openVacancyPlace(page);
  await settle(page, 800);
  // 「計算しています…」が出たら記録する
  await page.evaluate(() => {
    window.__calc = 0;
    const card = document.querySelector('[data-testid="vacancy-table-card"]');
    new MutationObserver(() => {
      if (/計算しています/.test(card.textContent)) window.__calc++;
    }).observe(card, { subtree: true, childList: true, characterData: true });
  });
  const calcs = () => page.evaluate(() => window.__calc);
  const title = () => page.getByTestId('vacancy-table-card').locator('.section-title, h2, h3').first().textContent();
  check(/目安/.test(await title()), '場所が空なら目安');
  check(/郵便番号・住所のみ送信/.test(await page.getByTestId('vacancy-notice').textContent()), '空き状況：注記');
  await page.getByTestId('vacancy-postal').fill('980-0811');
  await settle(page, 700);
  check((await calcs()) === 0, '郵便番号を打っても計算し直さない');
  await page.getByTestId('vacancy-postal-search').click();
  await untilValue(page.getByTestId('vacancy-address'), (v) => v === '宮城県仙台市青葉区一番町');
  check((await page.getByTestId('vacancy-postal').inputValue()) === '9800811', '空き状況：郵便番号を7桁に直す');
  await page.getByTestId('vacancy-address').fill('宮城県仙台市青葉区一番町1-1');
  const gridBefore = await page.getByTestId('vacancy-grid').textContent();
  await page.getByTestId('vacancy-geo-search').click();
  await until(page.getByTestId('vacancy-place').getByTestId('place-pin-text'), /38\.26010/);
  await settle(page, 1200);
  const t1 = await title();
  check(/宮城県仙台市青葉区一番町1-1への移動を含む/.test(t1), 'ピンで見出しが「移動を含む」に切り替わる', t1);
  check(
    !/約/.test(await page.getByTestId('vacancy-grid').textContent()) &&
      gridBefore !== (await page.getByTestId('vacancy-grid').textContent()),
    '表が移動を含む値に変わる',
  );
  // ピンがあるとき住所を打っても計算し直さない。見出しはピンを置いたときの住所のまま
  const n = await calcs();
  await page.getByTestId('vacancy-address').fill('宮城県仙台市青葉区一番町1-1 ビル');
  await settle(page, 700);
  check((await calcs()) === n, 'ピンがあるとき住所を打っても計算し直さない');
  check(/一番町1-1への移動を含む/.test(await title()), '見出しはピンを置いたときの住所');
  // 郵便番号から住所を差し替えてもピンは残り、知らせを出す
  await page.getByTestId('vacancy-address').fill('東京都');
  await page.getByTestId('vacancy-postal-search').click();
  const s = await until(page.getByTestId('vacancy-status'), /緯度・経度は前のまま/);
  check(
    /『住所から入れ直す』/.test(s) && /38\.26010/.test(await pinText(page, 'vacancy')),
    '空き状況：住所を差し替えてもピンは残る',
  );
  check(/一番町1-1への移動を含む/.test(await title()), '差し替えても見出しはピンを置いたときの住所');
  await page.screenshot({ path: path.join(OUT_DIR, 'address-vacancy.png'), fullPage: true });
  // 仮押さえで postalCode が入る
  await page.getByTestId('hold-open').click();
  await page.getByTestId('hold-name').fill('問い合わせ 確認さん');
  await page.getByTestId('hold-register').click();
  await settle(page, 600);
  const c = (await stored(page)).clients.find((x) => x.displayName === '問い合わせ 確認さん');
  check(
    c && c.place.postalCode === '9800811' && c.place.lat === 38.2601,
    '仮押さえで postalCode・位置が入る',
    c?.place,
  );
  check(c && !('pinnedAddress' in c.place), '仮押さえの場所に画面だけの値を入れない');
}

/** 7：仮押さえの注記の出し分け */
async function holdNote(page) {
  await page.goto(`${BASE}#/vacancy`);
  await openVacancyPlace(page);
  await settle(page, 800);
  await page.getByTestId('hold-open').click();
  check(
    /場所が空なので、住所・緯度・経度はあとで/.test(
      await page.locator('.side-panel, [role="dialog"]').last().textContent(),
    ),
    '仮押さえ：場所が空の注記',
  );
  await page.getByRole('button', { name: '閉じる' }).last().click();
  await page.getByTestId('vacancy-address').fill('宮城県仙台市青葉区一番町');
  await page.getByTestId('hold-open').click();
  const t = await page.locator('.side-panel, [role="dialog"]').last().textContent();
  check(/緯度・経度はあとで入れてください/.test(t) && !/場所が空なので/.test(t), '仮押さえ：住所だけのときの注記');
}

/** 8：〈スタッフ〉の自宅 */
async function staffHome(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/staff/s1?tab=basic`);
  await page.locator('[data-testid="person-sec"][data-section="home"]').getByTestId('sec-edit').click();
  await page.getByTestId('staff-home-place').waitFor();
  check(
    /保存しません/.test(await page.getByTestId('staff-home-place').textContent()),
    '自宅：郵便番号は保存しないと書く',
  );
  await page.getByTestId('staff-home-postal').fill('980-0811');
  await page.getByTestId('staff-home-postal-search').click();
  await untilValue(page.getByTestId('staff-home-address'), (v) => v.startsWith('宮城県仙台市青葉区一番町'));
  await page.getByRole('button', { name: '保存' }).click();
  await settle(page, 400);
  const s1 = (await stored(page)).staff.find((s) => s.id === 's1');
  check(
    s1.home.address.startsWith('宮城県仙台市青葉区一番町') && !('postalCode' in s1.home),
    '自宅：住所は保存し、郵便番号は保存しない',
    s1.home,
  );
  // 保存すると読むだけに戻る（PRD D308）。郵便番号は出さず、直し直すと郵便番号は空
  const home = page.locator('[data-testid="person-sec"][data-section="home"]');
  check(
    (await home.getByTestId('staff-home-place').count()) === 0 && !/980-?0811/.test(await home.textContent()),
    '自宅：保存すると読むだけに戻り、郵便番号は出ない',
  );
  await home.getByTestId('sec-edit').click();
  await page.getByTestId('staff-home-place').waitFor();
  check((await page.getByTestId('staff-home-postal').inputValue()) === '', '自宅：直し直すと郵便番号は空');
  await cancelSection(page);
  await page.goto('about:blank');
  await page.goto(`${BASE}#/staff/s1?tab=basic`);
  await home.getByTestId('sec-edit').click();
  await page.getByTestId('staff-home-place').waitFor();
  check((await page.getByTestId('staff-home-postal').inputValue()) === '', '自宅：開き直すと郵便番号は空');
}

/** 顧客台帳の形（ADR-0073）の列名。名簿の読み込みで住所のある〈利用者さん〉を足すのに使う（値は架空） */
const LEDGER_HEAD =
  '利用者名,利用者カナ,利用者生年月日,性別,郵便番号,都道府県,市区町村,町名以下,建物名,利用者電話番号,利用者携帯電話番号,請求方法,請求送付先,請求先氏名,続柄,請求先郵便番号,請求先都道府県,請求先市区町村,請求先町名以下,請求先建物名,請求先電話番号,顧客番号,銀行番号,支店番号,口座種別,口座番号,口座名義名カナ,利用者状態,備考'.split(
    ',',
  );
const ledgerTsv = (rows) =>
  [LEDGER_HEAD, ...rows.map((v) => LEDGER_HEAD.map((h) => v[h] ?? ''))].map((r) => r.join('\t')).join('\r\n');
/** 10：名簿を読み込んだら自動で緯度・経度を入れる（PRD D427。ADR-0094） */
async function rosterPlaceAll(page, fake, dlg) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/clients`);
  await page.getByTestId('client-row').first().waitFor();
  await page.getByTestId('roster-toggle').click();
  await page.getByTestId('roster-card').waitFor();
  // 市の名前の無い住所（「架空区…」）は国土地理院で見つからない。止められるよう応答を遅らせる
  fake.gsi = { mode: 'ok', body: GSI_ONE, delay: 700, notFoundIf: (u) => u.includes('架空区') };
  const sent = fake.calls.length;
  const asked = dlg.messages.length;
  // 2人だけの名簿なので追加・更新で読む（既定の総入れ替えだとほかの人が終了になる。PRD D441）
  await page.getByTestId('roster-mode-merge').check();
  await page.getByTestId('roster-file-input').setInputFiles({
    name: 'ledger.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from(
      `${ledgerTsv([
        { 利用者名: '位置 一郎', 都道府県: '架空県', 市区町村: '架空市', 町名以下: '架空町1-1', 利用者状態: '利用中' },
        { 利用者名: '位置 二郎', 町名以下: '架空区架空町2-2', 利用者状態: '利用中' },
      ])}\r\n`,
      'utf8',
    ),
  });
  await page.locator('.toast').filter({ hasText: '名簿を読み込みました' }).waitFor({ timeout: 20000 });
  check(
    dlg.messages
      .slice(asked)
      .join('\n')
      .includes(
        '読み込んだあと、住所から緯度・経度を探します（住所を郵便番号の検索と国土地理院の地図の検索に使います）',
      ),
    '名簿のあと：確認の本文に、読み込んだあと住所から緯度・経度を探すことを書く',
    dlg.messages.slice(asked),
  );
  const progress = page.getByTestId('place-all-progress');
  await until(progress, /探しています/, 5000);
  check(
    (await page.getByTestId('roster-card').isHidden()) &&
      (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'place-all' &&
      (await page.getByTestId('place-all-stop').count()) === 1,
    '名簿のあと：［名簿を読み込む］の続きで自動で始まる（名簿の欄を閉じ、まとめて置く欄へフォーカス・「止める」）',
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'roster-place-running.png') });
  // 探しているあいだは上の帯にも進み具合と［止める］（画面を移っても続く。PRD D445）
  check(
    /緯度・経度を探しています \d+\/\d+人/.test(await page.getByTestId('place-band-text').innerText()) &&
      (await page.getByTestId('place-band-stop').count()) === 1,
    '名簿のあと：探しているあいだは上の帯に進み具合と［止める］を出す',
  );
  // 止める → 「止めました」と［続きを探す］
  await page.getByTestId('place-all-stop').click();
  await until(progress, /止めました/, 5000);
  const run = page.getByTestId('place-all-run');
  check(/^続きを探す（\d+人）$/.test((await run.innerText()).trim()), '名簿のあと：止めると［続きを探す（N人）］', {
    text: await run.innerText(),
  });
  // 続きを探す → 終わる
  fake.gsi.delay = 0;
  const before = fake.calls.length;
  await run.click();
  await until(progress, /終わりました/, 20000);
  await untilTrue(async () =>
    (await stored(page)).clients.some((c) => c.displayName === '位置 一郎' && c.place.lat !== null),
  );
  const after = (await stored(page)).clients;
  const ichiro = after.find((c) => c.displayName === '位置 一郎');
  const jiro = after.find((c) => c.displayName === '位置 二郎');
  check(
    ichiro?.place.lat !== null && jiro?.place.lat === null && fake.calls.length > before && fake.calls.length > sent,
    '名簿のあと：続きを探すと残りを入れる（見つからない人は緯度・経度なしのまま）',
    { ichiro: ichiro?.place, jiro: jiro?.place },
  );
  const failed = page.getByTestId('place-all-failed');
  check(
    (await failed.innerText()).includes('位置 二郎') &&
      /市区町村の名前が無い住所/.test(await page.getByTestId('place-all-city-hint').innerText()) &&
      /移動30分/.test(await page.getByTestId('place-all-note').innerText()),
    '名簿のあと：見つからない人は見つからなかった人に出し、市区町村の1行と「移動30分で計算」の補足',
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'roster-place-done.png') });
  // 緯度・経度なしだけ見る：絞り込みのチップ「緯度・経度なし」が入り、行はすべて「緯度・経度なし」
  await page.getByTestId('place-all-only').click();
  const chip = page.locator('[data-testid="clients-cf-chip"][data-chip="noPlace"]');
  await untilTrue(async () => (await chip.getAttribute('aria-pressed')) === 'true');
  const rows = page.getByTestId('client-row');
  const n = await rows.count();
  check(
    n >= 1 && (await page.locator('[data-testid="client-row"] [data-testid="no-place"]').count()) === n,
    '緯度・経度なしだけ見る：絞り込みのチップ「緯度・経度なし」が入り、緯度・経度の無い人だけになる',
    { n },
  );
  const jiroRow = rows.filter({ hasText: '位置 二郎' });
  check(
    (await jiroRow.getByTestId('no-place-search').count()) === 1 &&
      (await jiroRow.getByTestId('no-place-map').count()) === 1,
    '行の「緯度・経度なし」に［住所から探す］［緯度・経度を編集］',
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'clients-no-place.png') });
  // 緯度・経度を編集 → その人の画面の住所の節が開いた形
  await jiroRow.getByTestId('no-place-map').click();
  await page.getByTestId('client-place').waitFor({ timeout: 5000 });
  check(
    /#\/clients\/[^?]+\?tab=basic$/.test(new URL(page.url()).hash),
    '［緯度・経度を編集］：その人の画面の住所の節を開いて移る（URL の edit は消す）',
    page.url(),
  );
}

/** 自宅の位置を消した〈スタッフ〉を用意する（s1 は架空区＝見つからない、s2 は見つかる、s3 は休止） */
async function staffWithoutHomes(page) {
  await page.goto('about:blank');
  await page.goto(`${BASE}#/staff`);
  await page.getByTestId('staff-row').first().waitFor();
  await page.evaluate((key) => {
    const d = JSON.parse(localStorage.getItem(key));
    const [a, b, c] = d.staff;
    a.home = { address: '架空区架空町3-3', lat: null, lng: null };
    b.home = { address: '宮城県仙台市青葉区一番町', lat: null, lng: null };
    c.home = { address: '宮城県仙台市青葉区二日町', lat: null, lng: null };
    c.active = false;
    localStorage.setItem(key, JSON.stringify(d));
  }, STORAGE_KEY);
  await page.reload();
  await page.getByTestId('staff-row').first().waitFor();
  return (await stored(page)).staff.slice(0, 3);
}

/** 11：〈スタッフ〉の自宅をまとめて置く（PRD D427） */
async function staffPlaceAll(page, fake) {
  fake.gsi = { mode: 'ok', body: GSI_ONE, delay: 0, notFoundIf: (u) => u.includes('架空区') };
  const [a, b, c] = await staffWithoutHomes(page);
  const panel = page.getByTestId('place-all');
  await panel.waitFor({ timeout: 5000 });
  const run = page.getByTestId('place-all-run');
  check(
    (await panel.getAttribute('data-kind')) === 'staff' &&
      (await run.innerText()).trim() === '住所から緯度・経度を入れる（2人）',
    '〈スタッフ〉：一覧に「住所から緯度・経度を入れる（2人）」（休止の人は数えない）',
    { text: await run.innerText() },
  );
  const chip = page.getByTestId('staff-filter-chip');
  check(
    (await chip.innerText()).includes('2'),
    '〈スタッフ〉：絞り込みのチップ「緯度・経度なし 2」',
    await chip.innerText(),
  );
  await chip.click();
  check(
    (await page.getByTestId('staff-row').count()) === 2,
    '〈スタッフ〉：「緯度・経度なし」で緯度・経度の無い人だけになる',
  );
  // 行の［住所から探す］は、その人だけ送る
  const sent = fake.calls.length;
  const rowB = page.getByTestId('staff-row').filter({ hasText: b.name });
  await rowB.getByTestId('no-place-search').click();
  await until(page.getByTestId('place-all-progress'), /終わりました/, 8000);
  await untilTrue(async () => (await stored(page)).staff.find((s) => s.id === b.id)?.home.lat !== null);
  const calls = fake.calls.slice(sent);
  check(
    calls.length === 1 && calls[0].includes('一番町'),
    '〈スタッフ〉：行の［住所から探す］はその人の住所だけ送って自宅に置く',
    calls,
  );
  // まとめて置く：残りの1人（見つからない）。休止の人は送らない
  const sent2 = fake.calls.length;
  await run.click();
  await until(page.getByTestId('place-all-progress'), /終わりました/, 8000);
  const after = (await stored(page)).staff;
  check(
    fake.calls.length - sent2 === 1 &&
      !fake.calls.slice(sent2).some((u) => u.includes('二日町')) &&
      after.find((s) => s.id === c.id)?.home.lat === null &&
      (await page.getByTestId('place-all-failed').innerText()).includes(a.name),
    '〈スタッフ〉：まとめて置くと休止を除いて送り、見つからない人は置けなかった人に出す',
    fake.calls.slice(sent2),
  );
  await page.screenshot({ path: path.join(OUT_DIR, 'staff-place-all.png') });
  // 緯度・経度を編集 → その人の画面の自宅の節を開いた形
  await page.getByTestId('staff-row').filter({ hasText: a.name }).getByTestId('no-place-map').click();
  await page.getByTestId('staff-home-place').waitFor({ timeout: 5000 });
  check(
    /#\/staff\/[^?]+\?tab=basic$/.test(new URL(page.url()).hash),
    '〈スタッフ〉：［緯度・経度を編集］でその人の画面の自宅の節を開いて移る（URL の edit は消す）',
    page.url(),
  );
}

const steps = pagePerStep({
  open: async (browser) => {
    const s = await openContext(browser);
    return { ...s, fake: await fakeServices(s.page) };
  },
  call: (fn, s) => fn(s.page, s.fake, s.dlg),
  steps: [basics, failures, races, vacancy, holdNote, staffHome, rosterPlaceAll, staffPlaceAll],
  label: (name) => `${name} が止まった`,
  after: (name, { dlg, fake }) => {
    check(dlg.native.length === 0, `${name}：ブラウザのダイアログを出さない`, dlg.native);
    // 送り先は2つのサービスだけ
    check(
      fake.calls.every(
        (u) =>
          u.startsWith('https://zipcloud.ibsnet.co.jp/api/search?zipcode=') ||
          u.startsWith('https://msearch.gsi.go.jp/address-search/AddressSearch?q='),
      ),
      `${name}：送り先は郵便番号検索・国土地理院だけ`,
    );
  },
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
