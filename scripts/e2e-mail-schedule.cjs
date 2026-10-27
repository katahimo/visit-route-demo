// メールの予約送信（PRD D366〜D369。ADR-0069）：
// 管理者設定の「メールの予約送信」で URL・合言葉を入れて「接続を試す」→「保存」。日の予定のメールの欄の「N人分を予約して確定」で
// 事業所の GAS に全員分を預け、その日が確定（伝えた）になる。「予約済み」「予約し直す」「予約を取り消す」。合言葉が違えば理由の知らせ。
// つないでいなければ枠は管理者設定への案内だけ。GAS は page.route の偽の応答に差し替え、外へは出さない
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-mail-schedule.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
const path = require('node:path');
const { BASE, OUT_DIR, check, runSteps, settle } = require('./lib/env.cjs');
const { sharedPage } = require('./lib/steps.cjs');

const GAS_URL = 'https://script.google.com/macros/s/AKfyFAKE_e2e/exec';
const TOKEN = 'e2e-token';

/** GAS の偽物：届いた頼みを残し、合言葉が合えば成功を返す */
async function fakeGas(page) {
  const seen = [];
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
            ? { ok: true, v: 1, canceled: 2 }
            : { ok: true, v: 1, quota: 99 };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(res),
    });
  });
  return seen;
}

const toastHas = (page, text) => page.locator('.toast', { hasText: text });

async function openDayMail(page) {
  await page.goto(`${BASE}#/plan`);
  await page.getByTestId('day-mail').waitFor({ timeout: 30000 });
  await page.getByTestId('day-mail').click();
  await page.getByTestId('day-mail-panel').waitFor();
  await settle(page, 200);
}

let seen = [];
const steps = sharedPage({
  steps: [
    [
      'not-connected',
      async (page) => {
        seen = await fakeGas(page);
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
        check((await page.getByTestId('mail-schedule-template').count()) === 1, 'ひな型のコピーの行がある');
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
