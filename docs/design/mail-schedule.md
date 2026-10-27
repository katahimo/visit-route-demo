# メールの予約送信（`src/contracts/mailSchedule.ts`・`src/lib/mailSchedule.ts`・`gas/Code.gs`。PRD D366〜D369。ADR-0069）

```ts
MAIL_SCHEDULE_VERSION = 1; MAIL_SCHEDULE_MAX_MAILS = 100; MAIL_SCHEDULE_MAX_BODY = 40000
MailScheduleRequest = { v, token } & ({ action: 'ping' } | { action: 'queue', key /* 訪問の日 */, sendAt /* ISO +09:00 */, senderName, mails: { to, subject, body }[] } | { action: 'cancel', key })
MailScheduleResponse = { ok: true, v, queued?, canceled?, quota? } | { ok: false, v, error: 'unauthorized' | 'badRequest' | 'notSetUp' | 'serverError', message? }
MailScheduleSettings = { url, token, sendTime /* 前日の HH:MM */ }; MailReservation = { sendAt, count, at }
GAS_TEMPLATE_URL /* ひな型のコピー用のリンク（空ならまだ無い） */; DEFAULT_SEND_TIME = '18:00'; MAIL_SCHEDULE_TIMEOUT_MS = 20000
isGasUrl(url); settingsErrors(s); isReady(s); sendAtFor(date, sendTime, now) /* 過ぎた日は null・過ぎた時刻は今 */
scheduledMails(rows) /* アドレスのある行の件名・全文 */; queueRequest・cancelRequest・pingRequest
postMailSchedule(url, req, { fetch?, timeoutMs? }) /* 失敗：GAS の error・timeout・network・badResponse */; mailScheduleMessage(reason)
```

- 呼ぶ：`fetch(url, { method: 'POST', body: JSON 文字, redirect: 'follow' })`。ヘッダーを付けない（OPTIONS を出さない）。応答は zod で読み、知らない項目は捨てる
- この端末の覚え：`store/mailSchedule`（キー `visit-route-demo:mail-schedule`。設定と、日付ごとの預けた記録を新しい60日分。設定を空にすると記録も消す）。画面は `components/useMailSchedule`
- GAS：シート「予約」（1通1行。キー・送る時刻・宛先・件名・本文・状態（予約／送信済み／取消／置き換え／失敗／期限切れ）・更新日時・メモ・差出人・試した回数）、シート「設定」（合言葉・トリガー）。`queue` は同じキーの「予約」を「置き換え」にして足す。`sendDue`（5分ごと）は時刻を過ぎた「予約」を MailApp で送る（残りの上限・5分まで。訪問の日を過ぎた分は「期限切れ」、送れなければ3回まで次の回で送り直す）。合言葉が無ければ notSetUp、版・形が違えば badRequest。手順は `gas/README.md`
