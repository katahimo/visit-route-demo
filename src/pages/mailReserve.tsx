// 日の予定のメールの欄の「Google で予約して送る」（PRD D367・D368。ADR-0069）：その日の担当ごとのメール（全文）を
// 事業所の Google Apps Script に預け、前日の決めた時刻に送らせる。預けたら、その日を確定（伝えた）にする。
// 設定が無ければ管理者設定への案内だけ出す（mailto のメールを作るはそのまま使える）
import { CalendarClock, CalendarX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { WithIcon } from '../components/ui';
import { useMailSchedule } from '../components/useMailSchedule';
import { jstDate } from '../domain/time';
import type { DayMailRow } from '../lib/dayMail';
import { GAS_TRIGGER_MINUTES, mailScheduleMessage, scheduledMails, sendAtFor, sendAtText } from '../lib/mailSchedule';
import type { DayMailConfirm } from './mailPanels';

export function MailReserveBox({
  date,
  rows,
  senderName,
  staffWord,
  confirm,
}: {
  date: string;
  rows: readonly DayMailRow[];
  senderName: string;
  staffWord: string;
  confirm?: DayMailConfirm;
}) {
  const ms = useMailSchedule();
  const toast = useToast();
  const confirmDialog = useConfirm();
  if (!ms.ready)
    return (
      <p className="sub" data-testid="mail-reserve-off">
        Google のアカウントから決まった時刻に自動で送るには、
        <Link to="/settings">管理者設定</Link>のいちばん下の「メールの予約送信」でつなぎます。
      </p>
    );
  const now = Date.now();
  const at = sendAtFor(date, ms.settings.sendTime, now);
  const mails = scheduledMails(rows);
  const reserved = ms.reservations[date];
  const willConfirm = !!confirm && confirm.state !== 'told';
  const reserve = async () => {
    if (!at || mails.length === 0) return;
    const r = await ms.reserve({ date, sendAt: at.iso, senderName, mails });
    if (!r.ok) {
      toast(`予約できませんでした。${mailScheduleMessage(r.reason)}`);
      return;
    }
    const msg = `${sendAtText(at)}に ${mails.length}人分のメールを送るよう予約しました`;
    if (willConfirm) confirm.onConfirm('reserve', msg);
    else toast(msg);
  };
  const cancel = async () => {
    const ok = await confirmDialog({
      title: 'この日の予約を取り消しますか？',
      body: 'まだ送っていないメールを送らないようにします（確定はそのままです）。',
      confirmLabel: '予約を取り消す',
    });
    if (!ok) return;
    const r = await ms.cancel(date);
    toast(r.ok ? '予約を取り消しました' : `取り消せませんでした。${mailScheduleMessage(r.reason)}`);
  };
  const why =
    at === null
      ? '過ぎた日の予定は予約できません'
      : mails.length === 0
        ? `メールアドレスのある${staffWord}がいません`
        : null;
  /** 送る時刻と時刻トリガーの間隔を過ぎたか（もう送った見込み。それまでは取り消せる） */
  const sentLikely = reserved ? Date.parse(reserved.sendAt) + GAS_TRIGGER_MINUTES * 60_000 <= now : false;
  return (
    <section className="mail-reserve stack" aria-label="Google で予約して送る" data-testid="mail-reserve">
      <p className="sub">
        <strong>Google で予約して送る</strong>：
        {at?.immediate
          ? '前日の送る時刻を過ぎているので、すぐ（5分ほどで）'
          : `前日 ${ms.settings.sendTime}${at ? `（${sendAtText(at)}）` : ''}に、`}
        メールアドレスのある{staffWord}
        {mails.length}人へ、事業所の Google のアカウントから送ります。本文は省かずに全部入ります
        {willConfirm ? '。予約すると、この日を確定（伝えた）にします' : ''}。
      </p>
      {reserved && (
        <p className="sub" data-testid="mail-reserved">
          <span className="chip chip-ok">{sentLikely ? '送信の時刻を過ぎました' : '予約済み'}</span>{' '}
          {mdwTime(reserved.sendAt)}に {reserved.count}人分（{jstDate(reserved.at)} に予約）。
          {!sentLikely && '変えたときは「予約し直す」で新しい内容に置き換えます。'}
          {confirm?.state === 'changed' && ' 確定のあとに変えた訪問があります。'}
        </p>
      )}
      <span className="mail-reserve-act">
        <button
          type="button"
          className="btn"
          onClick={() => void reserve()}
          disabled={ms.busy || why !== null}
          title={why ?? undefined}
          data-testid="mail-reserve-send"
        >
          <WithIcon icon={CalendarClock}>
            {reserved && !sentLikely ? '予約し直す' : `${mails.length}人分を予約${willConfirm ? 'して確定' : 'する'}`}
          </WithIcon>
        </button>
        {reserved && !sentLikely && (
          <button
            type="button"
            className="btn btn-text"
            onClick={() => void cancel()}
            disabled={ms.busy}
            data-testid="mail-reserve-cancel"
          >
            <WithIcon icon={CalendarX}>予約を取り消す</WithIcon>
          </button>
        )}
        {why && <span className="sub">{why}</span>}
        {ms.busy && <span className="sub">Google とやりとりしています…</span>}
      </span>
    </section>
  );
}

/** 「2026-10-26T18:00:00+09:00」→「10/26（月）18:00」 */
const mdwTime = (iso: string) => sendAtText({ iso, immediate: false });
