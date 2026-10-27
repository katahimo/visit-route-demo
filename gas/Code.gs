/**
 * 訪問予定アプリ：メールの予約送信（Google Apps Script・スプレッドシートに付けて使う）
 * やりとりの形の正は アプリ側の src/contracts/mailSchedule.ts（ここは手で合わせる）。
 * アプリ → doPost（JSON の文字を text/plain で POST）→ シート「予約」に預ける → 時刻トリガーの sendDue が送る。
 */

// ---- 定数 ----
var VERSION = 1; // やりとりの版（アプリの MAIL_SCHEDULE_VERSION と同じ）
var MAX_MAILS = 100; // 1回に預けるメールの上限
var MAX_BODY = 40000; // 本文の上限（文字）
var MAX_SUBJECT = 200;
var MAX_TO = 254;
var MAX_SENDER = 100;
var SEND_LIMIT_MS = 5 * 60 * 1000; // sendDue の1回の実行の打ち切り
var LOCK_WAIT_MS = 30 * 1000;

var SHEET_QUEUE = '予約';
var SHEET_CONFIG = '設定';
var PROP_TOKEN = 'TOKEN';

var HEADERS = ['キー', '送る時刻', '宛先', '件名', '本文', '状態', '更新日時', 'メモ', '差出人'];
// 列の番号（1始まり）
var COL = { KEY: 1, SEND_AT: 2, TO: 3, SUBJECT: 4, BODY: 5, STATUS: 6, UPDATED: 7, MEMO: 8, SENDER: 9 };
var ST = { QUEUED: '予約', SENT: '送信済み', CANCELED: '取消', REPLACED: '置き換え', FAILED: '失敗' };

var TZ = 'Asia/Tokyo';

// ---- メニュー ----

/** シートを開いたとき、メニュー「訪問予定」を出す */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('訪問予定')
    .addItem('初期設定', 'setUp')
    .addItem('合言葉を作り直す', 'regenerateToken')
    .addItem('今すぐ送る（予約の時刻を過ぎた分）', 'sendDueNow')
    .addItem('使い方', 'showHelp')
    .addToUi();
}

/** 初期設定：合言葉・トリガー・シートを用意し、デプロイの手順を出す */
function setUp() {
  var ui = SpreadsheetApp.getUi();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    ui.alert('ほかの処理が動いています。少し待ってからもう一度やってください。');
    return;
  }
  try {
    var props = PropertiesService.getScriptProperties();
    var created = false;
    if (!props.getProperty(PROP_TOKEN)) {
      props.setProperty(PROP_TOKEN, makeToken());
      created = true;
    }
    ensureQueueSheet();
    ensureTrigger();
    writeConfigSheet();
    ui.alert(
      '初期設定ができました' + (created ? '' : '（合言葉はすでにあるので、そのままです）'),
      [
        '続けて、次の手順でウェブアプリとして公開します（初回だけ）。',
        '',
        '1. 拡張機能 › Apps Script を開く',
        '2. 右上の「デプロイ」 › 「新しいデプロイ」',
        '3. 種類の歯車 › 「ウェブアプリ」',
        '4. 実行するユーザー：自分',
        '5. アクセスできるユーザー：全員',
        '6. 「デプロイ」を押す（許可を求められたら許可する）',
        '7. 出てきた「ウェブアプリ」の URL（末尾が /exec）をコピーする',
        '8. アプリの「管理者設定 › メールの予約送信」に、URL とシート「設定」の合言葉を貼る',
        '9. 「接続を試す」を押す',
        '',
        '※ コードを直したときは「デプロイを管理」で版を上げる（URL が変わらない）。',
      ].join('\n'),
      ui.ButtonSet.OK
    );
  } finally {
    lock.releaseLock();
  }
}

/** 合言葉を作り直す（古い合言葉は使えなくなる） */
function regenerateToken() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty(PROP_TOKEN)) {
    ui.alert('先にメニュー「訪問予定 › 初期設定」をやってください。');
    return;
  }
  var res = ui.alert(
    '合言葉を作り直しますか？',
    '今の合言葉は使えなくなります。作り直したら、アプリの設定に新しい合言葉を貼り直してください。',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    ui.alert('ほかの処理が動いています。少し待ってからもう一度やってください。');
    return;
  }
  try {
    props.setProperty(PROP_TOKEN, makeToken());
    writeConfigSheet();
  } finally {
    lock.releaseLock();
  }
  ui.alert('合言葉を作り直しました。シート「設定」の新しい合言葉を、アプリの設定に貼り直してください。');
}

/** メニュー用：予約の時刻を過ぎた分を今すぐ送る */
function sendDueNow() {
  var ui = SpreadsheetApp.getUi();
  if (!PropertiesService.getScriptProperties().getProperty(PROP_TOKEN)) {
    ui.alert('先にメニュー「訪問予定 › 初期設定」をやってください。');
    return;
  }
  var r = sendDue();
  ui.alert(
    '送信を終えました',
    '送信済み：' + r.sent + '通\n失敗：' + r.failed + '通\n残り（上限や時間のため次の回）：' + r.pending + '通',
    ui.ButtonSet.OK
  );
}

/** メニュー用：使い方 */
function showHelp() {
  SpreadsheetApp.getUi().alert('使い方', helpText(), SpreadsheetApp.getUi().ButtonSet.OK);
}

function helpText() {
  return [
    '1. メニュー「訪問予定 › 初期設定」を1回やる。',
    '2. 「デプロイ › 新しいデプロイ › ウェブアプリ（実行：自分／アクセス：全員）」で /exec の URL を得る。',
    '3. アプリの「管理者設定 › メールの予約送信」に URL とシート「設定」の合言葉を貼り、「接続を試す」を押す。',
    '4. アプリが預けたメールはシート「予約」に並び、時刻を過ぎると5分ごとの確認で送られる（最大5分遅れる）。',
  ].join('\n');
}

// ---- Web アプリの入口 ----

/** URL をブラウザで開いたとき。データは出さない */
function doGet() {
  return ContentService.createTextOutput('このURLはアプリの設定に貼ります。').setMimeType(ContentService.MimeType.TEXT);
}

/** アプリからの頼み（ping / queue / cancel） */
function doPost(e) {
  try {
    var req = parseRequest(e);
    if (req.error) return fail('badRequest', req.error);
    var body = req.body;

    var expected = PropertiesService.getScriptProperties().getProperty(PROP_TOKEN);
    if (!expected) return fail('notSetUp', '初期設定がまだです。シートのメニュー「訪問予定 › 初期設定」をやってください。');
    if (typeof body.token !== 'string' || !safeEquals(body.token, expected)) {
      return fail('unauthorized', '合言葉が違います。');
    }

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) return fail('serverError', '混み合っています。少し待ってからやり直してください。');
    try {
      if (body.action === 'ping') {
        return ok({ quota: MailApp.getRemainingDailyQuota() });
      }
      if (body.action === 'queue') return handleQueue(body);
      if (body.action === 'cancel') return handleCancel(body);
      return fail('badRequest', '知らない action です。');
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    return fail('serverError', 'GAS の中でエラーが起きました。シートの持ち主が Apps Script の「実行数」を確認してください。');
  }
}

/** 本文の JSON を読み、共通の形（v・token・action）を確かめる */
function parseRequest(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') return { error: '本文がありません。' };
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return { error: 'JSON として読めません。' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: '形が違います。' };
  if (body.v !== VERSION) return { error: '版（v）が合いません。GAS の Code.gs をアプリに合う版へ更新してください。' };
  if (typeof body.action !== 'string') return { error: 'action がありません。' };
  return { body: body };
}

/** 預ける：同じ key の「予約」を「置き換え」にして、新しい行を足す */
function handleQueue(body) {
  var bad = validateQueue(body);
  if (bad) return fail('badRequest', bad);
  var sendAt = new Date(body.sendAt);
  var now = new Date();
  var sheet = getQueueSheet() || ensureQueueSheet();

  // 古い「予約」を置き換えにする
  replaceStatus(sheet, body.key, ST.QUEUED, ST.REPLACED, '同じ日の預け直しで置き換え');

  // 新しい行を足す
  var rows = body.mails.map(function (m) {
    return [body.key, sendAt, escapeCell(m.to), escapeCell(m.subject), escapeCell(m.body), ST.QUEUED, now, '', escapeCell(body.senderName)];
  });
  var start = sheet.getLastRow() + 1;
  var shortage = start + rows.length - 1 - sheet.getMaxRows();
  if (shortage > 0) sheet.insertRowsAfter(sheet.getMaxRows(), shortage); // 行が足りなければ増やす
  var range = sheet.getRange(start, 1, rows.length, HEADERS.length);
  range.setNumberFormats(rows.map(rowFormats));
  range.setValues(rows);
  SpreadsheetApp.flush();
  return ok({ queued: rows.length, quota: MailApp.getRemainingDailyQuota() });
}

/** 取り消す：その key のまだ送っていない行を「取消」にする */
function handleCancel(body) {
  if (!isKey(body.key)) return fail('badRequest', 'key の形が違います。');
  var sheet = getQueueSheet() || ensureQueueSheet();
  var n = replaceStatus(sheet, body.key, ST.QUEUED, ST.CANCELED, 'アプリから取消');
  SpreadsheetApp.flush();
  return ok({ canceled: n });
}

/** queue の中身の検査。問題があれば文（日本語）を返す */
function validateQueue(b) {
  if (!isKey(b.key)) return 'key の形が違います（YYYY-MM-DD）。';
  if (typeof b.sendAt !== 'string' || !b.sendAt || isNaN(Date.parse(b.sendAt))) return 'sendAt が日時として読めません。';
  if (typeof b.senderName !== 'string' || b.senderName.length > MAX_SENDER) return 'senderName の形が違います。';
  if (!Array.isArray(b.mails) || b.mails.length < 1 || b.mails.length > MAX_MAILS) {
    return 'mails は 1〜' + MAX_MAILS + ' 通にしてください。';
  }
  for (var i = 0; i < b.mails.length; i++) {
    var m = b.mails[i];
    if (!m || typeof m !== 'object') return 'mails[' + i + '] の形が違います。';
    if (typeof m.to !== 'string' || m.to.length < 3 || m.to.length > MAX_TO || m.to.indexOf('@') < 0 || /[\r\n,;\s]/.test(m.to)) {
      return 'mails[' + i + '] の宛先が違います。';
    }
    if (typeof m.subject !== 'string' || m.subject.length < 1 || m.subject.length > MAX_SUBJECT || /[\r\n]/.test(m.subject)) {
      return 'mails[' + i + '] の件名が違います。';
    }
    if (typeof m.body !== 'string' || m.body.length < 1 || m.body.length > MAX_BODY) {
      return 'mails[' + i + '] の本文が違います（1〜' + MAX_BODY + '字）。';
    }
  }
  return '';
}

function isKey(k) {
  return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
}

/** 返事を組む */
function ok(extra) {
  var o = { ok: true, v: VERSION };
  for (var k in extra) o[k] = extra[k];
  return json(o);
}
function fail(error, message) {
  return json({ ok: false, v: VERSION, error: error, message: message });
}
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---- 送る ----

/**
 * 時刻トリガー（5分ごと）で動く。状態「予約」で送る時刻を過ぎた行を送る。
 * 送るのは MailApp の残りの上限まで。時間は5分で打ち切り、残りは次の回に回す。
 * 戻り値：{ sent, failed, pending }
 */
function sendDue() {
  var startedAt = Date.now();
  var result = { sent: 0, failed: 0, pending: 0 };
  var sheet = getQueueSheet();
  if (!sheet || sheet.getLastRow() < 2) return result;

  var now = new Date();
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  var due = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (v[COL.STATUS - 1] !== ST.QUEUED) continue;
    var at = v[COL.SEND_AT - 1];
    if (!(at instanceof Date) || isNaN(at.getTime())) continue; // 時刻が読めない行は触らない
    if (at.getTime() <= now.getTime()) due.push({ row: i + 2, at: at.getTime(), v: v });
  }
  due.sort(function (a, b) {
    return a.at - b.at || a.row - b.row;
  });

  var quota = MailApp.getRemainingDailyQuota();
  for (var j = 0; j < due.length; j++) {
    if (quota <= 0 || Date.now() - startedAt >= SEND_LIMIT_MS) {
      result.pending = due.length - j;
      break;
    }
    var outcome = sendOne(sheet, due[j]);
    if (outcome === 'sent') {
      result.sent++;
      quota--;
    } else if (outcome === 'failed') {
      result.failed++;
    } else if (outcome === 'quota') {
      result.pending = due.length - j;
      break;
    }
    // 'skipped'（ほかで状態が変わった）は数えない
  }
  return result;
}

/** 1行を送る。行ごとに短くロックし、送る直前に状態が変わっていないか確かめる（二重送信を防ぐ） */
function sendOne(sheet, item) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return 'skipped';
  try {
    var cur = sheet.getRange(item.row, 1, 1, HEADERS.length).getValues()[0];
    if (cur[COL.STATUS - 1] !== ST.QUEUED) return 'skipped';
    if (cur[COL.TO - 1] !== item.v[COL.TO - 1] || cur[COL.SUBJECT - 1] !== item.v[COL.SUBJECT - 1]) return 'skipped';

    var to = unescapeCell(cur[COL.TO - 1]);
    var subject = unescapeCell(cur[COL.SUBJECT - 1]);
    var body = unescapeCell(cur[COL.BODY - 1]);
    var sender = unescapeCell(cur[COL.SENDER - 1]);
    var opts = { to: to, subject: subject, body: body };
    if (sender) opts.name = sender;
    try {
      MailApp.sendEmail(opts);
    } catch (err) {
      if (MailApp.getRemainingDailyQuota() <= 0) return 'quota'; // 上限に達した。行は「予約」のまま次の日へ
      setStatus(sheet, item.row, ST.FAILED, String(err && err.message ? err.message : err));
      return 'failed';
    }
    setStatus(sheet, item.row, ST.SENT, '');
    return 'sent';
  } finally {
    lock.releaseLock();
  }
}

// ---- シート ----

function getQueueSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_QUEUE);
}

/** シート「予約」を用意する（なければ作る。見出しをそろえ、文字の列は書式を「書式なしテキスト」にする） */
function ensureQueueSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_QUEUE);
  if (!sheet) sheet = ss.insertSheet(SHEET_QUEUE);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  // 文字のまま持つ列（キー・宛先・件名・本文・差出人）は数式や日付に化けないようにする
  [COL.KEY, COL.TO, COL.SUBJECT, COL.BODY, COL.SENDER].forEach(function (c) {
    sheet.getRange(2, c, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  sheet.getRange(2, COL.SEND_AT, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange(2, COL.UPDATED, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  return sheet;
}

/** 追加する行ごとの書式（列の書式が行の追加で崩れても文字のまま入れる） */
function rowFormats() {
  var f = [];
  f[COL.KEY - 1] = '@';
  f[COL.SEND_AT - 1] = 'yyyy-mm-dd hh:mm';
  f[COL.TO - 1] = '@';
  f[COL.SUBJECT - 1] = '@';
  f[COL.BODY - 1] = '@';
  f[COL.STATUS - 1] = '@';
  f[COL.UPDATED - 1] = 'yyyy-mm-dd hh:mm:ss';
  f[COL.MEMO - 1] = '@';
  f[COL.SENDER - 1] = '@';
  return f;
}

/** key が同じで、状態が from の行を to にする。変えた行数を返す */
function replaceStatus(sheet, key, from, to, memo) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var values = sheet.getRange(2, 1, last - 1, COL.STATUS).getValues();
  var now = new Date();
  var n = 0;
  for (var i = 0; i < values.length; i++) {
    if (normalizeKey(values[i][COL.KEY - 1]) === key && values[i][COL.STATUS - 1] === from) {
      setStatus(sheet, i + 2, to, memo, now);
      n++;
    }
  }
  return n;
}

/** 状態・更新日時・メモを書く */
function setStatus(sheet, row, status, memo, now) {
  sheet.getRange(row, COL.STATUS, 1, 3).setValues([[status, now || new Date(), memo || '']]);
}

/** キーの列が日付に化けていても 'YYYY-MM-DD' に直す */
function normalizeKey(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v);
}

/** シート「設定」を書く（合言葉・トリガー・使い方） */
function writeConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CONFIG) || ss.insertSheet(SHEET_CONFIG);
  var token = PropertiesService.getScriptProperties().getProperty(PROP_TOKEN) || '';
  var hasTrigger = hasSendDueTrigger();
  sheet.clear();
  var rows = [
    ['合言葉', token],
    ['トリガー（5分ごとの送信）', hasTrigger ? 'あり' : 'なし'],
    ['', ''],
    ['アプリの設定欄', 'ウェブアプリの URL（末尾が /exec）と、上の合言葉を、アプリの「管理者設定 › メールの予約送信」に貼る。'],
    ['使い方', helpText()],
    ['注意', 'この合言葉を知っている人は、このシートにメールを預けられる。シートの共有は事業所の人だけにする。漏れたらメニュー「訪問予定 › 合言葉を作り直す」。'],
  ];
  sheet.getRange(1, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
  sheet.getRange(1, 1, rows.length, 1).setFontWeight('bold');
  sheet.getRange(1, 2, rows.length, 1).setWrap(true).setVerticalAlignment('top');
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 520);
}

// ---- トリガー ----

function hasSendDueTrigger() {
  return ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'sendDue';
  });
}

/** sendDue の時刻トリガーを5分ごとに付ける（すでにあれば足さない） */
function ensureTrigger() {
  if (hasSendDueTrigger()) return;
  ScriptApp.newTrigger('sendDue').timeBased().everyMinutes(5).create();
}

// ---- 部品 ----

/** 推測されにくい合言葉（UUID 2つ分の16進） */
function makeToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

/** 合言葉の比較。長さが違っても落ちず、最後まで比べる */
function safeEquals(a, b) {
  var diff = a.length ^ b.length;
  var len = Math.max(a.length, b.length);
  for (var i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** 先頭が = + - @ の文字は数式にならないよう ' を前に付ける */
function escapeCell(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** 読むときに escapeCell の ' を外す（シートが ' を食った場合は何もしない） */
function unescapeCell(s) {
  s = String(s);
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}
