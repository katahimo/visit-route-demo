// 連絡を貼り付けて入れる（PRD D418。ADR-0084）を本物のブラウザで確かめる：
// 予定（月・週・日）の「その他 ▾」に「連絡を貼り付けて入れる」があり、押すと右の欄（`paste-panel`）が開いてテキストの欄にフォーカス、
// 貼ると少し待って1行ずつ読み、一覧（読んだ内容とチェック・読めない理由）と件数が出る → チェックを外すと主ボタンの件数が減る →
// ［N件を入れる］（主ボタンは1つ）で欠勤・訪問の取り消し（この回だけ）・〈利用者さん〉の休みを1回で書き、知らせ「N件を入れました。要対応 M件」、
// 担当は振り直さない → 同じ文をもう一度貼ると「すでに入っている」で主ボタンが押せない → Esc で閉じて「その他 ▾」へフォーカス →
// 「元に戻す」1回で3件とも戻る、読めない行（日付が無い・名前が見つからない・過ぎた日・終わりの日が無い・出勤の時刻・上の行と重なる休み）の理由
// （同じ名前が2人などは lib の test）、上に行を足しても外したチェックが戻らない、
// 〈利用者さん〉の休みの機能を切ると休みの行が「…の休みの機能が切」、欠勤・キャンセルと休みの両方を切ると入口を出さない。
//
// 使い方：npm run build && npx vite preview --port 4183 のあとで node scripts/e2e-paste.cjs
// 環境変数は scripts/lib/env.cjs（PLAYWRIGHT・CHROMIUM・BASE・OUT_DIR・FAKE_NOW）
// 終了コード：全部通れば 0、通らないものがあれば 1。ページのエラー（pageerror）も失敗に数える
const { STORAGE_KEY, TODAY, check, settle, stored, waitStored, runSteps } = require('./lib/env.cjs');
const { openPage, sharedPage } = require('./lib/steps.cjs');
const { goTo, openMore, closeMore, pressTool, toolCount } = require('./lib/ui.cjs');

/** 日付の足し算（YYYY-MM-DD） */
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** 「11/6」の形 */
const md = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
/** 欠勤・取り消しの日（今日の2日後）と、休みの期間（その日〜1週間後） */
const DAY = addDays(TODAY, 2);
const LEAVE_TO = addDays(DAY, 7);

const panel = (page) => page.getByTestId('paste-panel');
const rowsOf = (page) =>
  page.getByTestId('paste-row').evaluateAll((els) =>
    els.map((el) => ({
      state: el.dataset.state,
      text: el.querySelector('.paste-row-text')?.textContent ?? '',
      reason: el.querySelector('[data-testid="paste-row-reason"]')?.textContent ?? null,
      checked: el.querySelector('input')?.checked ?? null,
    })),
  );
const focusedId = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');

/** 貼る文の材料：DAY に勤務のある〈スタッフ〉・DAY に毎週の訪問のある〈利用者さん〉・休みにする別の〈利用者さん〉（姓） */
async function people(page) {
  const d = await stored(page);
  const wd = weekdayOf(DAY);
  const surname = (n) => n.trim().split(/\s+/)[0];
  const st = d.staff.find((s) => s.active && s.workDays.includes(wd));
  const p = d.patterns.find(
    (x) =>
      x.repeat === 'weekly' &&
      x.everyWeeks === 1 &&
      x.weekdays.includes(wd) &&
      x.from <= DAY &&
      (x.to === null || x.to >= DAY) &&
      d.clients.some((c) => c.id === x.clientId && c.active),
  );
  const cancel = d.clients.find((c) => c.id === p.clientId);
  const leave = d.clients.find(
    (c) => c.active && c.id !== cancel.id && surname(c.displayName) !== surname(cancel.displayName),
  );
  return { staff: st, cancel, leave, surname };
}

/** テキストの欄に貼る（入力イベント）→ 読み直しの待ちのあと一覧が出るまで */
async function paste(page, text) {
  await page.getByTestId('paste-text').fill(text);
  await page.getByTestId('paste-rows').waitFor({ timeout: 10000 });
  await settle(page, 400);
}

async function openPaste(page) {
  await pressTool(page, 'paste-open', { where: 'more' });
  await panel(page).waitFor({ timeout: 10000 });
  await settle(page, 200);
}

let names = null;
let pasted = '';

const steps = sharedPage({
  open: () => openPage(),
  steps: [
    [
      '入口：月・週・日の「その他 ▾」に「連絡を貼り付けて入れる」',
      async (page) => {
        for (const where of ['週', '日', '月']) {
          await goTo(page, where);
          await settle(page, 300);
          check((await toolCount(page, 'paste-open')) === 1, `${where}の「その他 ▾」に「連絡を貼り付けて入れる」`);
        }
        names = await people(page);
        check(
          !!names.staff && !!names.cancel && !!names.leave,
          '貼る文の材料（〈スタッフ〉・訪問のある〈利用者さん〉）',
          JSON.stringify(names && { s: names.staff?.name, c: names.cancel?.displayName, l: names.leave?.displayName }),
        );
      },
    ],
    [
      '開く：右の欄・テキストの欄にフォーカス・はじめは0件で押せない',
      async (page) => {
        await openPaste(page);
        check((await focusedId(page)) === 'paste-text', '開いたらテキストの欄にフォーカス', await focusedId(page));
        const apply = page.getByTestId('paste-apply');
        check((await apply.textContent()).includes('0件を入れる'), '主ボタンは［0件を入れる］');
        check((await apply.getAttribute('aria-disabled')) === 'true', '0件のときは押せない');
        check((await page.locator('.drawer .btn-primary').count()) === 1, '欄の主ボタンは1つ');
      },
    ],
    [
      '貼る → 一覧：読んだ内容とチェック・読めない理由',
      async (page) => {
        const { staff, cancel, leave, surname } = names;
        pasted = [
          `${md(DAY)} ${surname(staff.name)}さん 午前休み`,
          `${md(DAY)} ${surname(cancel.displayName)}様 中止`,
          `${md(DAY)}〜${md(LEAVE_TO)} ${surname(leave.displayName)}様 入院`,
          'お疲れさまです',
          `${md(DAY)} 高橋 休み`,
          `2020/1/6 ${surname(staff.name)} 休み`,
          `${md(DAY)} ${surname(leave.displayName)}様 ショート`,
          `${md(DAY)} ${surname(staff.name)}さん 午後から出勤`,
          `${md(addDays(DAY, 3))}〜${md(addDays(LEAVE_TO, 3))} ${surname(leave.displayName)}様 入院`,
        ].join('\n');
        await paste(page, pasted);
        const rows = await rowsOf(page);
        check(rows.length === 9, '9行を読む（空でない行）', JSON.stringify(rows));
        check(
          rows.slice(0, 3).every((r) => r.state === 'ok' && r.checked === true),
          '読めた3行はチェック入り',
          JSON.stringify(rows.slice(0, 3)),
        );
        check(
          rows[0]?.text.includes('欠勤') && rows[0]?.text.includes(staff.name),
          '欠勤の行：名前と時間帯',
          rows[0]?.text,
        );
        check(rows[1]?.text.includes('訪問の取り消し'), '取り消しの行', rows[1]?.text);
        check(rows[2]?.text.includes('休み（入院）'), '休みの行', rows[2]?.text);
        check(
          JSON.stringify(rows.slice(3).map((r) => r.reason)) ===
            JSON.stringify([
              '日付が無い',
              '名前が見つからない',
              '過ぎた日',
              '終わりの日が無い',
              '出勤の時刻は読めません（休む時間帯で書く）',
              '上の行と重なる',
            ]),
          '読めない行の理由',
          JSON.stringify(rows.slice(3)),
        );
        check((await page.getByTestId('paste-count').textContent()).includes('読めた 3行・読めない 6行'), '件数の1行');
        check(
          (await page.getByTestId('paste-apply').textContent()).includes('3件を入れる'),
          '主ボタンは［3件を入れる］',
        );
        // チェックを外すと件数が減り、戻すと増える
        const box = page.getByTestId('paste-row-check').nth(1);
        await box.uncheck();
        check(
          (await page.getByTestId('paste-apply').textContent()).includes('2件を入れる'),
          'チェックを外すと［2件を入れる］',
        );
        // 上に行を足しても、外したチェックは外したまま（鍵は行の文と同じ文の何回目か）
        await paste(page, `お疲れさまです（追記）\n${pasted}`);
        const added = await rowsOf(page);
        check(
          added[2]?.checked === false && added[1]?.checked === true && added[3]?.checked === true,
          '上に行を足しても外したチェックが戻らない',
          JSON.stringify(added.slice(0, 4)),
        );
        await paste(page, pasted);
        await page.getByTestId('paste-row-check').nth(1).check();
        check((await page.getByTestId('paste-apply').textContent()).includes('3件を入れる'), '戻すと［3件を入れる］');
      },
    ],
    [
      '入れる：1回で書き、知らせ・振り直さない',
      async (page) => {
        const before = await stored(page);
        await page.getByTestId('paste-apply').click();
        await panel(page).waitFor({ state: 'detached', timeout: 10000 });
        const toast = page.locator('.toast .toast-text');
        await toast.waitFor({ timeout: 5000 });
        const msg = await toast.textContent();
        check(/^3件を入れました。要対応 \d+件$/.test(msg ?? ''), '知らせ「3件を入れました。要対応 M件」', msg);
        const ok = await waitStored(
          page,
          (d) =>
            d.absences.length === before.absences.length + 1 &&
            d.clientLeaves.length === before.clientLeaves.length + 1,
        );
        check(!!ok, '欠勤1件・休み1件が増える');
        const d = await stored(page);
        const a = d.absences.find((x) => x.staffId === names.staff.id && x.date === DAY);
        check(a?.from === null && a?.to === '12:00', '午前の欠勤（〜12:00）', JSON.stringify(a));
        const l = d.clientLeaves.find((x) => x.clientId === names.leave.id);
        check(l?.from === DAY && l?.to === LEAVE_TO && l?.note === '入院', '休みの期間とメモ', JSON.stringify(l));
        const v = d.visits.find((x) => x.clientId === names.cancel.id && x.date === DAY);
        check(v?.cancelled === true && v?.pattern?.edited === true, '訪問はこの回だけ取り消し', JSON.stringify(v));
        // 振り直さない：担当（staffId）の変わった保存した訪問が無い
        const moved = before.visits.filter((x) => {
          const y = d.visits.find((z) => z.id === x.id);
          return y && y.staffId !== x.staffId;
        });
        check(moved.length === 0, '担当は振り直さない', JSON.stringify(moved.map((x) => x.id)));
      },
    ],
    [
      'もう一度貼る：すでに入っている・押せない・Esc で「その他 ▾」へ',
      async (page) => {
        await openPaste(page);
        await paste(page, pasted.split('\n').slice(0, 3).join('\n'));
        const rows = await rowsOf(page);
        check(
          rows.length === 3 && rows.every((r) => r.reason === 'すでに入っている'),
          '3行とも「すでに入っている」',
          JSON.stringify(rows),
        );
        check((await page.getByTestId('paste-apply').getAttribute('aria-disabled')) === 'true', '0件で押せない');
        await page.keyboard.press('Escape');
        await panel(page).waitFor({ state: 'detached', timeout: 5000 });
        check((await focusedId(page)) === 'month-more', '閉じたら「その他 ▾」へフォーカス', await focusedId(page));
      },
    ],
    [
      '元に戻す：1回で3件とも戻る',
      async (page) => {
        const list = await openMore(page);
        const undo = list.getByTestId('more-undo');
        check((await undo.textContent()).includes('連絡を貼り付けて入れる'), '戻す手の名前', await undo.textContent());
        await closeMore(page);
        await pressTool(page, '元に戻す');
        const ok = await waitStored(
          page,
          (d) =>
            !d.absences.some((x) => x.staffId === names.staff.id && x.date === DAY) &&
            !d.clientLeaves.some((x) => x.clientId === names.leave.id) &&
            !d.visits.some((x) => x.clientId === names.cancel.id && x.date === DAY && x.cancelled),
        );
        check(!!ok, '欠勤・休み・取り消しがすべて戻る');
      },
    ],
    [
      '機能の入り切り：休みが切なら休みの行が読めない、両方切なら入口を出さない',
      async (page) => {
        const setFeatures = (features) =>
          page.evaluate(
            ([k, f]) => {
              const d = JSON.parse(localStorage.getItem(k));
              d.org.features = { ...d.org.features, ...f };
              localStorage.setItem(k, JSON.stringify(d));
            },
            [STORAGE_KEY, features],
          );
        await goTo(page, '/data');
        await setFeatures({ clientLeave: false });
        await goTo(page, '月');
        await settle(page, 300);
        await openPaste(page);
        await paste(page, pasted.split('\n')[2]);
        const rows = await rowsOf(page);
        check(/の休みの機能が切$/.test(rows[0]?.reason ?? ''), '休みの行は「…の休みの機能が切」', JSON.stringify(rows));
        await page.getByTestId('paste-close').click();
        await panel(page).waitFor({ state: 'detached', timeout: 5000 });
        await goTo(page, '/data');
        await setFeatures({ clientLeave: false, sudden: false });
        await goTo(page, '月');
        await settle(page, 300);
        check((await toolCount(page, 'paste-open')) === 0, '欠勤・キャンセルと休みが切なら入口を出さない');
        await goTo(page, '/data');
        await setFeatures({ clientLeave: true, sudden: true });
      },
    ],
  ],
});

module.exports = { steps };
if (require.main === module) runSteps(steps);
