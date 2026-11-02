// 日・週の予定のメール（PRD D92・D93・D346・D366〜D369。ADR-0059・ADR-0069）を本物のブラウザで確かめる：
// 日の予定の「その他 ▾」の「メールで送る」の欄で、送れる人（アドレスがあり、長すぎない）全員分の「メールを作る」を押すと、その日が確定（伝えた）になる。
// 作った人に「作成済み」、欄に「メールを作った人 N/M人」。知らせの「元に戻す」で確定が戻る。欄の「確定（伝えた）にする」は確認を出して確定する。
// 区間ごとの道順のリンクは、長さの目安 2000字の端末でも訪問4件までは本文に残る（区間を外す前に、決まりごと・全行程・住所を外す）。
// 日の予定の「その他 ▾」の書き出しは チャット用にコピー・メールで送る・印刷 の順。チャット用にコピーは見出し・■名前・訪問の行の形で、
// 住所・鍵（既定）を入れない。「鍵の情報も入れる」はメールの欄と同じ選択で、選ぶと鍵の行だけが増える（クリップボードの権限で読む）。
// 週の予定の「予定をメールで送る」は日と同じく操作の行の「その他 ▾」の中にあり、時間軸の表示でも出る。週のメールに「まだ確定していません」を日ごとに書かない。
// 予約送信：つないでいなければ枠は管理者設定への案内だけ。管理者設定の「メールの予約送信」で URL・合言葉を入れて「接続を試す」→「保存」。
// 日の予定のメールの欄の「N人分を予約して確定」で事業所の GAS に全員分を預け、その日が確定（伝えた）になる。「予約済み」「予約し直す」「予約を取り消す」。
// 合言葉が違えば理由の知らせ。GAS は page.route の偽の応答に差し替え、外へは出さない
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-mail.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
const path = require('node:path');
const { BASE, OUT_DIR, TODAY, STORAGE_KEY, check, runSteps, settle } = require('./lib/env.cjs');
const { sharedPage } = require('./lib/steps.cjs');
const { closeMore, openDetails, openMore, pressTool, toolCount } = require('./lib/ui.cjs');

/** メールを作るボタン（a 要素）の本文（mailto の body） */
async function bodies(page) {
  return page
    .locator('[data-testid="day-mail-rows"] a[data-testid="mail-open"]')
    .evaluateAll((els) => els.map((el) => new URL(el.getAttribute('href')).searchParams.get('body') ?? ''));
}

async function openDay(page) {
  await page.goto(`${BASE}#/plan`);
  await page.reload();
  await page.getByTestId('plan-more').waitFor({ timeout: 30000 });
  await settle(page, 300);
}

const GAS_URL = 'https://script.google.com/macros/s/AKfyFAKE_e2e/exec';
const TOKEN = 'e2e-token';

/** GAS の偽物：届いた頼みを残し、合言葉が合えば成功を返す（本物は 302 で googleusercontent へ移してから返すが、Playwright の偽の 302 は CORS の移り先を通さないので、すぐ返す） */
async function fakeGas(page) {
  const seen = [];
  const cors = { 'access-control-allow-origin': '*' };
  await page.route(/script\.google\.com/, async (route) => {
    const req = route.request();
    let body = null;
    try {
      body = JSON.parse(req.postData() ?? 'null');
    } catch {
      // 形の違う頼み
    }
    seen.push({ method: req.method(), headers: req.headers(), body });
    const res =
      body?.token !== TOKEN
        ? { ok: false, v: 1, error: 'unauthorized', message: '合言葉が違います。' }
        : body.action === 'queue'
          ? { ok: true, v: 1, queued: body.mails.length, quota: 90 }
          : body.action === 'cancel'
            ? { ok: true, v: 1, canceled: seen.filter((s) => s.body?.action === 'cancel').length === 1 ? 2 : 0 }
            : { ok: true, v: 1, quota: 99 };
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(res) });
  });
  return seen;
}

const toastHas = (page, text) => page.locator('.toast', { hasText: text });

async function openDayMail(page) {
  await page.goto(`${BASE}#/plan`);
  await page.getByTestId('plan-more').waitFor({ timeout: 30000 });
  await pressTool(page, 'day-mail', { where: 'more' });
  await page.getByTestId('day-mail-panel').waitFor();
  await settle(page, 200);
}

let seen = [];
const steps = sharedPage({
  steps: [
    [
      'day-mail-confirm',
      async (page) => {
        await openDay(page);
        check(
          (await page.getByTestId('confirm-state').innerText()).includes('まだ伝えていない'),
          `日の予定（${TODAY}）ははじめ まだ伝えていない`,
        );
        await pressTool(page, 'day-mail', { where: 'more' });
        const panel = page.getByTestId('day-mail-panel');
        await panel.waitFor();
        const progress = page.getByTestId('day-mail-progress');
        const first = await progress.innerText();
        const m = /(\d+)\/(\d+)人/.exec(first);
        check(!!m && m[1] === '0' && Number(m[2]) > 0, '欄に「メールを作った人 0/M人」', first);
        check((await page.getByTestId('day-mail-confirm').count()) === 1, '欄に「確定（伝えた）にする」');
        // 区間ごとの道順は本文に残る（Windows の目安 2000字でも訪問4件までは。このテストの端末は 2000字の目安）
        const bs = await bodies(page);
        check(
          bs.length > 0 && bs.every((b) => /https:\/\/www\.google\.com\/maps\/dir\//.test(b)),
          'どの人のメールにも Google マップの道順のリンク',
          bs.map((b) => b.length),
        );
        // 欄から送るメールは送ると確定になるので、本文は「確定した担当」（「まだ確定していません」「（未確定）」と書かない）
        check(
          bs.every((b) => !b.includes('まだ確定していません') && !b.includes('（未確定）')),
          '日のメールの本文に「まだ確定していません」「（未確定）」と書かない',
        );
        const fourOrLess = bs.filter((b) => (b.match(/^\d+\. /gm) ?? []).length <= 4);
        check(
          fourOrLess.length > 0 && fourOrLess.every((b) => (b.match(/maps\/dir\//g) ?? []).length >= 2),
          '訪問4件までの人のメールには区間ごとの道順（2本以上）',
          fourOrLess.map((b) => (b.match(/maps\/dir\//g) ?? []).length),
        );
        await page.screenshot({ path: path.join(OUT_DIR, 'day-mail-panel.png') });
        // メールアプリを開かずに押す（href を外してから押す。押したことだけ数える）
        const links = page.locator('[data-testid="day-mail-rows"] a[data-testid="mail-open"]');
        const n = await links.count();
        await links.evaluateAll((els) => {
          for (const el of els) el.removeAttribute('href');
        });
        for (let i = 0; i < n - 1; i++) await links.nth(i).click();
        await settle(page, 200);
        check(
          (await page.getByTestId('mail-sent').count()) === n - 1 &&
            (await progress.innerText()).includes(`${n - 1}/${n}人`),
          '押した人に「作成済み」・数が進む',
          await progress.innerText(),
        );
        check(
          (await page.getByTestId('confirm-state').innerText()).includes('まだ伝えていない'),
          '全員分を作るまでは確定しない',
        );
        await links.nth(n - 1).click();
        await settle(page, 400);
        check(
          (await page.getByTestId('confirm-state').innerText()).includes('確定済み'),
          '全員分のメールを作ると確定（伝えた）になる',
        );
        const toast = page.locator('.toast', { hasText: '全員分のメールを作ったので' });
        check((await toast.count()) === 1, '知らせ「全員分のメールを作ったので、この日を確定（伝えた）にしました」');
        check((await progress.innerText()).includes('確定（伝えた）済み'), '欄は「確定（伝えた）済み」');
        check((await page.getByTestId('day-mail-confirm').count()) === 0, '確定したら欄の「確定にする」は出さない');
        await page.screenshot({ path: path.join(OUT_DIR, 'day-mail-confirmed.png') });
        await toast.getByTestId('toast-undo').click();
        await settle(page, 400);
        check(
          (await page.getByTestId('confirm-state').innerText()).includes('まだ伝えていない'),
          '知らせの「元に戻す」で確定が戻る',
        );
        check(
          (await progress.innerText()).includes('確定を元に戻しました'),
          '元に戻したあとの欄は「確定を元に戻しました…「確定（伝えた）にする」を押してください」',
          await progress.innerText(),
        );
        // 元に戻したあと、同じ欄で押し直しても二重に確定しない（欄を開き直すと数え直す）
        await links.nth(0).click();
        await settle(page, 300);
        check(
          (await page.getByTestId('confirm-state').innerText()).includes('まだ伝えていない'),
          '戻したあとに同じ欄で押し直しても確定しない',
        );
        // 欄の「確定（伝えた）にする」は確認を出して確定する
        await page.getByTestId('day-mail-confirm').click();
        const dlg = page.getByRole('alertdialog');
        await dlg.waitFor();
        await dlg.getByRole('button', { name: '確定する' }).click();
        await settle(page, 400);
        check(
          (await page.getByTestId('confirm-state').innerText()).includes('確定済み'),
          '欄の「確定（伝えた）にする」→ 確認 → 確定',
        );
      },
    ],
    [
      'day-chat-copy',
      async (page) => {
        // コピーした文はクリップボードの権限を与えて読む（PRD D419。ADR-0085）
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
        await openDay(page);
        const list = await openMore(page);
        const names = (await list.getByRole('menuitem').allInnerTexts()).map((t) => t.split('\n')[0].trim());
        await closeMore(page);
        const at = (x) => names.indexOf(x);
        check(
          at('チャット用にコピー') >= 0 &&
            at('チャット用にコピー') + 1 === at('メールで送る') &&
            at('メールで送る') + 1 === at('印刷'),
          '日の予定：「その他 ▾」の書き出しは チャット用にコピー・メールで送る・印刷 の順に1つずつ',
          names,
        );
        const copy = async () => {
          await page.evaluate(() => navigator.clipboard.writeText(''));
          await pressTool(page, 'day-chat-copy', { where: 'more' });
          await toastHas(page, 'チャット用の文をコピーしました').first().waitFor();
          return page.evaluate(() => navigator.clipboard.readText());
        };
        const text = await copy();
        const lines = text.split('\n');
        check(/^\d+\/\d+（.）の予定$/.test(lines[0]), 'チャット用の文：見出し「11/3（火）の予定」', lines[0]);
        check(lines[1]?.startsWith('■'), 'チャット用の文：見出しの次は「■〈名前〉」', lines[1]);
        check(
          lines.filter((l) => /^[ \d]\d:\d\d .+様（\d+分）$/.test(l)).length > 0 &&
            lines.every((l) => l === lines[0] || l.startsWith('■') || /^[ \d]\d:\d\d /.test(l) || l.startsWith('   ')),
          'チャット用の文：訪問は「 9:00 〈利用者さん〉様（60分）」、決まりごとは訪問の行の下に字下げ',
          text.slice(0, 300),
        );
        const data = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY);
        const addresses = (data?.clients ?? []).map((c) => c.place?.address ?? '').filter((a) => a.length > 0);
        check(addresses.length > 0 && addresses.every((a) => !text.includes(a)), 'チャット用の文に住所を入れない');
        check(!text.includes('鍵：'), 'チャット用の文：鍵は既定で入れない');
        // 「鍵の情報も入れる」はメールの欄と同じ選択（画面の中だけ）
        await pressTool(page, 'day-mail', { where: 'more' });
        await page.getByTestId('mail-include-keys').check();
        await page
          .locator('section.drawer', { has: page.getByTestId('day-mail-panel') })
          .getByRole('button', { name: '閉じる' })
          .first()
          .click();
        await settle(page, 200);
        const withKeys = await copy();
        check(
          withKeys
            .split('\n')
            .filter((l) => !l.startsWith('   鍵：'))
            .join('\n') === text,
          '「鍵の情報も入れる」を選ぶと、鍵の行だけが増える（初めての訪問先の行の下）',
          withKeys.slice(0, 300),
        );
        await page.screenshot({ path: path.join(OUT_DIR, 'day-chat-copy.png') });
        // 休み（取り消し）の訪問しかない日は「チャット用にコピー」「印刷」を出さない（文に出す訪問の数で判定）
        const date = await page.evaluate(() => document.querySelector('.app-shell')?.getAttribute('data-date'));
        const saved = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
        await page.evaluate(
          ({ k, date }) => {
            const d = JSON.parse(localStorage.getItem(k));
            d.clientLeaves = d.clients.map((c) => ({
              id: `e2e-${c.id}`,
              clientId: c.id,
              from: date,
              to: date,
              note: '',
            }));
            localStorage.setItem(k, JSON.stringify(d));
          },
          { k: STORAGE_KEY, date },
        );
        await openDay(page);
        check(
          (await toolCount(page, 'day-chat-copy')) === 0 && (await toolCount(page, 'day-print')) === 0,
          '休みの訪問しかない日は「チャット用にコピー」「印刷」を出さない',
        );
        await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: STORAGE_KEY, v: saved });
        await openDay(page);
      },
    ],
    [
      'week-mail-button',
      async (page) => {
        await page.goto(`${BASE}#/week`);
        await page.reload();
        await page.getByTestId('week-more').waitFor({ timeout: 30000 });
        check(
          (await page.locator('[data-testid="sched-nav"] [data-testid="week-mail"]').count()) === 0 &&
            (await toolCount(page, 'week-mail')) === 1,
          '週の予定：「予定をメールで送る」は操作の行の「その他 ▾」の中の1つだけ（ナビの行・表の上には無い。PRD D402）',
        );
        await pressTool(page, 'week-mail', { where: 'more' });
        const rows = page.getByTestId('week-mail-rows');
        await rows.waitFor();
        const body = await rows
          .locator('a[data-testid="mail-open"]')
          .first()
          .evaluate((el) => new URL(el.getAttribute('href')).searchParams.get('body') ?? '');
        check(
          !body.includes('まだ確定していません'),
          '週のメール：日ごとに「まだ確定していません」と書かない',
          body.slice(0, 200),
        );
        check(
          body.split('確定した予定は前日のメールでお知らせします').length <= 2,
          '週のメール：確定していない日があれば冒頭に1回だけ',
        );
        await page.screenshot({ path: path.join(OUT_DIR, 'week-mail.png') });
      },
    ],
    [
      'not-connected',
      async (page) => {
        seen = await fakeGas(page);
        // 前の段で確定した日を初期データに戻す
        await page.goto(`${BASE}#/data`);
        await page.evaluate((k) => localStorage.removeItem(k), STORAGE_KEY);
        await page.reload();
        await openDayMail(page);
        check((await page.getByTestId('mail-reserve-off').count()) === 1, 'つないでいなければ管理者設定への案内だけ');
        check((await page.getByTestId('mail-reserve-send').count()) === 0, 'つないでいなければ予約のボタンは無い');
        check((await page.getByTestId('mail-open').count()) > 0, 'mailto の「メールを作る」は今のまま');
      },
    ],
    [
      'settings',
      async (page) => {
        await page.goto(`${BASE}#/settings`);
        const card = page.getByTestId('mail-schedule-settings');
        await card.waitFor({ timeout: 30000 });
        // 手順は畳んで始める（PRD D395。開閉は覚えない）：閉じていると見えず、見出しの横に手順の数。開くと4つの手順
        const fold = page.getByTestId('mail-schedule-steps-fold');
        check(
          (await fold.getAttribute('open')) === null &&
            !(await page.getByTestId('mail-schedule-template').isVisible()) &&
            (await page.getByTestId('mail-schedule-steps-fold-heading').innerText()).includes('手順 4つ'),
          '予約送信の手順は閉じて始める（見出しに手順の数）',
        );
        check(
          (await card.locator('.feature-desc-line .sub').first().innerText()).includes(
            '前日の決めた時刻に自動で送ります',
          ) && !(await page.getByTestId('mail-schedule-notes').isVisible()),
          '予約送信の説明は1行（詳しい説明は ⓘ の中）',
        );
        const noteSummary = card.locator('details.hint > summary');
        check(
          (await noteSummary.innerText()).trim() === '説明' &&
            (await noteSummary.getAttribute('aria-label')) === 'メールの予約送信の説明',
          'ⓘ のラベルは「説明」（読み上げは「メールの予約送信の説明」）',
        );
        await noteSummary.click();
        const notes = (await page.getByTestId('mail-schedule-notes').innerText()).replace(/\s+/g, '');
        check(
          notes.includes('分ほど遅れることがあります') &&
            notes.includes('Googleのアカウント（スプレッドシート）を通ります') &&
            notes.includes('「メールを作る」でメールアプリから送れます'),
          'ⓘ を開くと、遅れる分数・Google を通ること・「メールを作る」で送れることが読める',
          notes,
        );
        await noteSummary.click();
        await openDetails(page, 'mail-schedule-steps-fold');
        check((await page.getByTestId('mail-schedule-template').count()) === 1, 'ひな型のコピーの行がある');
        check(
          (await page.getByTestId('mail-schedule-template').isVisible()) &&
            (await fold.locator('ol > li').count()) === 4,
          '手順を開くとひな型のコピーを含む4つの手順が見える',
        );
        await page.getByTestId('mail-schedule-save').click();
        check((await card.locator('[aria-invalid="true"]').count()) >= 2, '空のまま保存すると URL・合言葉に誤り');
        await page.getByTestId('mail-schedule-url').fill('https://example.com/exec');
        await page.getByTestId('mail-schedule-token').fill(TOKEN);
        await page.getByTestId('mail-schedule-save').click();
        check(
          (await page.getByTestId('mail-schedule-url').getAttribute('aria-invalid')) === 'true',
          'GAS でない URL は保存しない',
        );
        await page.getByTestId('mail-schedule-url').fill(GAS_URL);
        await page.getByTestId('mail-schedule-token').fill('wrong');
        await page.getByTestId('mail-schedule-test').click();
        await toastHas(page, '合言葉が合いません').waitFor({ timeout: 10000 });
        check(true, '合言葉が違えば「合言葉が合いません」');
        await page.getByTestId('mail-schedule-token').fill(TOKEN);
        await page.getByTestId('mail-schedule-test').click();
        await toastHas(page, 'つながりました').waitFor({ timeout: 10000 });
        const ping = seen[seen.length - 1];
        check(
          ping?.method === 'POST' && ping.body?.action === 'ping' && !/json/.test(ping.headers['content-type'] ?? ''),
          '接続を試す：POST・ping・Content-Type は JSON にしない（確認の問い合わせを出さない）',
          ping?.headers['content-type'],
        );
        await page.getByTestId('mail-schedule-save').click();
        await settle(page, 200);
        check((await card.innerText()).includes('つないでいます'), '保存すると「つないでいます」');
        await page.screenshot({ path: path.join(OUT_DIR, 'mail-schedule-settings.png') });
      },
    ],
    [
      'reserve-confirms',
      async (page) => {
        await openDayMail(page);
        check(
          (await page.getByTestId('confirm-state').innerText()).includes('まだ伝えていない'),
          'はじめ まだ伝えていない',
        );
        const send = page.getByTestId('mail-reserve-send');
        await send.waitFor();
        const label = await send.innerText();
        check(/\d+人分を予約して確定/.test(label), 'ボタン「N人分を予約して確定」', label);
        const n = Number(/(\d+)人分/.exec(label)?.[1] ?? 0);
        await send.click();
        await toastHas(page, '予約しました').waitFor({ timeout: 10000 });
        const q = seen.filter((s) => s.body?.action === 'queue').pop();
        check(
          q?.body?.mails?.length === n && q.body.mails.every((m) => m.to.includes('@') && m.body.length > 0),
          'アドレスのある全員分を預ける',
          q?.body?.mails?.length,
        );
        check(/T\d{2}:\d{2}:\d{2}\+09:00$/.test(q?.body?.sendAt ?? ''), '送る時刻は日本時間の ISO', q?.body?.sendAt);
        check(
          q?.body?.mails?.every((m) => !m.body.includes('まだ確定していません')),
          '預けた本文は「確定した担当」で書く',
        );
        await settle(page, 300);
        check((await page.getByTestId('confirm-state').innerText()).includes('確定済み'), '予約するとその日が確定');
        check((await page.getByTestId('mail-reserved').count()) === 1, '「予約済み」の行');
        check((await send.innerText()).includes('予約し直す'), '預けた日は「予約し直す」');
        await page.screenshot({ path: path.join(OUT_DIR, 'mail-reserved.png') });
        // 送る時刻（当日なのですぐ）を過ぎた予約を預け直すときは、全員にもう一度届くことを確かめる
        await send.click();
        const again = page.getByRole('alertdialog');
        await again.waitFor();
        check(
          (await again.innerText()).includes('もう一度'),
          '送る時刻を過ぎた予約し直しは「もう一度、全員に送りますか？」',
        );
        await again.getByTestId('confirm-cancel').click();
        await settle(page, 200);
        check(seen.filter((s) => s.body?.action === 'queue').length === 1, '確認でやめれば預け直さない');
        await page.getByTestId('mail-reserve-cancel').click();
        const dlg = page.getByRole('alertdialog');
        await dlg.waitFor();
        await dlg.getByRole('button', { name: '予約を取り消す' }).click();
        await toastHas(page, '予約を取り消しました').waitFor({ timeout: 10000 });
        check(
          seen.some((s) => s.body?.action === 'cancel'),
          '取り消しを GAS に送る',
        );
        await settle(page, 200);
        check((await page.getByTestId('mail-reserved').count()) === 0, '取り消すと「予約済み」が消える');
        check((await page.getByTestId('confirm-state').innerText()).includes('確定済み'), '取り消しても確定はそのまま');
        check(/\d+人分を予約する$/.test((await send.innerText()).trim()), '確定済みの日は「N人分を予約する」');
      },
    ],
  ],
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
