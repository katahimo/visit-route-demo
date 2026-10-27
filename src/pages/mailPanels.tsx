// 日・週の予定を担当ごとにメールアプリで開く欄（PRD D92・D93。ADR-0017）。
// 担当は確定した割当があればそれ、無ければ今の案（どちらかを欄と本文に書く）。鍵の情報は「鍵の情報も入れる」を選んだときだけ
// （既定はオフ。画面の中だけの状態で保存しない）。データは書き換えない
import { CircleCheck, Mail, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MailNotice, type MailRow, MailRows, useMailLimit } from '../components/mailParts';
import { SidePanel, WithIcon } from '../components/ui';
import type { DemoData } from '../contracts/data';
import { byName } from '../lib/common';
import { type DayMailRow, dayMailProgress, dayMailRows, sendableKeys } from '../lib/dayMail';
import { isOn } from '../lib/features';
import { mailTo, mdw, sourceWord, weekByStaff, weekMailText } from '../lib/mail';
import { MailReserveBox } from './mailReserve';

/**
 * 日のメールと確定（PRD D346・D368）：state は伝えた状態、onConfirm は確定する
 * （mail＝全員分のメールを作った・reserve＝Google で予約した（note は知らせの文）・manual＝欄のボタン）
 */
export type DayMailConfirm = {
  state: 'none' | 'told' | 'changed';
  onConfirm: (by: 'mail' | 'reserve' | 'manual', note?: string) => void;
};

/**
 * メールを作った人を数え、送れる人全員分を作ったらその日を確定（伝えた）にする（PRD D346）。
 * メールを作った人と「全員分を作って1回確定した」は画面の中だけ。日付を変えたら数え直す
 */
function useDayMailConfirm(date: string, rows: readonly DayMailRow[], confirm: DayMailConfirm | undefined) {
  /** メールを作った人（行の key） */
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  /** 全員分を作って1回確定した（元に戻したあとに押し直しても二重にしない。欄の文にも使う） */
  const [autoDone, setAutoDone] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付が変わったときだけ数え直す
  useEffect(() => {
    setSent(new Set());
    setAutoDone(false);
  }, [date]);
  const sendable = sendableKeys(rows);
  const sentCount = sendable.filter((k) => sent.has(k)).length;
  useEffect(() => {
    if (!confirm || confirm.state === 'told' || autoDone) return;
    if (sendable.length > 0 && sentCount === sendable.length) {
      setAutoDone(true);
      confirm.onConfirm('mail');
    }
  }, [confirm, autoDone, sendable.length, sentCount]);
  return {
    sent,
    onOpen: (key: string) => setSent((x) => new Set([...x, key])),
    progressText: confirm
      ? dayMailProgress({ state: confirm.state, sendable: sendable.length, sent: sentCount, autoDone })
      : '',
  };
}

/**
 * 日の予定（担当ごと。PRD D92）。confirm があれば、メールを作った人を数え、送れる人（アドレスがあり、長すぎない）全員分を作ったら
 * その日を確定（伝えた）にする（PRD D346。アプリは送信を知れないので「メールを作る」を押したことで数える。元に戻すで戻せる）。
 * アドレスの無い人・電話で伝えたときのため、欄の下に「確定（伝えた）にする」も置く
 */
export function DayMailPanel({
  data,
  date,
  onClose,
  confirm,
}: {
  data: DemoData;
  date: string;
  onClose: () => void;
  confirm?: DayMailConfirm;
}) {
  const terms = data.org.terms;
  /**
   * 機能の入り切り（ADR-0028）：訪問先の決まりごとを切れば入り方・鍵・駐車場・注意と「鍵の情報も入れる」、
   * 道順のリンクを切れば Google マップの道順を本文に入れない
   */
  const notesOn = isOn(data.org.features, 'visitNotes');
  const mapsOn = isOn(data.org.features, 'mapsLink');
  /** 鍵の情報も入れる（既定はオフ。保存しない） */
  const [includeKeys, setIncludeKeys] = useState(false);
  const limit = useMailLimit();
  /**
   * 本文の担当の言い方：確定の欄（confirm）から送るメールは、送ると確定になるので「確定した担当」と書く（PRD D346。
   * 前日の日のメールで確定を知らせる、と週のメールに書くのと合わせる）
   */
  const { day, rows, mailSource } = useMemo(
    () => dayMailRows(data, date, { notesOn, mapsOn, includeKeys, confirming: !!confirm, limit }),
    [data, date, notesOn, mapsOn, includeKeys, confirm, limit],
  );
  const noEmail = rows.filter((r) => !r.email).length;
  const { sent, onOpen, progressText } = useDayMailConfirm(date, rows, confirm);
  const open = confirm && confirm.state !== 'told';
  return (
    <SidePanel
      icon={Mail}
      title={`${mdw(date)}の予定をメールで送る`}
      onClose={onClose}
      footer={
        <>
          {open && day.source !== null && (
            <button
              type="button"
              className="btn"
              onClick={() => confirm.onConfirm('manual')}
              data-testid="day-mail-confirm"
              title="メールの無い人に電話などで伝えたときも、ここで確定できます"
            >
              <WithIcon icon={CircleCheck}>確定（伝えた）にする</WithIcon>
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            <WithIcon icon={X}>閉じる</WithIcon>
          </button>
        </>
      }
    >
      <div className="stack" data-testid="day-mail-panel">
        {day.source === null ? (
          <p data-testid="day-mail-source">この日は計算できる訪問がありません。</p>
        ) : (
          <>
            <p data-testid="day-mail-source">
              <strong>{sourceWord(mailSource)}</strong>
              の担当で、{terms.staff}ごとに 順番・時刻・{terms.client}・住所{notesOn ? '・入り方・駐車場・注意' : ''}
              {mapsOn &&
                ` と、Google マップの道順のリンク（1日の全行程と区間ごと。${terms.staff}の自宅と移動手段から）`}
              を本文に入れます。
            </p>
            {notesOn && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={includeKeys}
                  onChange={(e) => setIncludeKeys(e.target.checked)}
                  style={{ width: 'auto' }}
                  data-testid="mail-include-keys"
                />
                鍵の情報も入れる（既定は入れません。メールは転送・誤送信で人の目に触れることがあります）
              </label>
            )}
            <MailNotice>
              {noEmail > 0 &&
                ` メールアドレスの無い${terms.staff}（${noEmail}人）は、${terms.staff}の画面で入れられます。`}
            </MailNotice>
            {rows.length > 0 && (
              <MailReserveBox
                date={date}
                rows={rows}
                senderName={data.org.name}
                staffWord={terms.staff}
                confirm={confirm}
              />
            )}
            {confirm && rows.length > 0 && (
              <p className="sub" data-testid="day-mail-progress">
                {progressText}
              </p>
            )}
            {rows.length === 0 ? (
              <p>この日に訪問のある{terms.staff}はいません。</p>
            ) : (
              <MailRows rows={rows} testId="day-mail-rows" sent={sent} onOpen={onOpen} />
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}

/** 週の予定（担当ごと。PRD D93）。dates は月〜日 */
export function WeekMailPanel({
  data,
  dates,
  onClose,
}: {
  data: DemoData;
  dates: readonly string[];
  onClose: () => void;
}) {
  const terms = data.org.terms;
  const byStaff = useMemo(() => weekByStaff(data, dates), [data, dates]);
  const limit = useMailLimit();
  const first = dates[0] ?? '';
  const last = dates[dates.length - 1] ?? '';
  // 最終勤務日（ADR-0015）が週の初めより前の人は出さない
  const staff = useMemo(
    () => [...data.staff].filter((s) => s.active && (s.lastDay === null || s.lastDay >= first)).sort(byName),
    [data.staff, first],
  );
  const rows: MailRow[] = staff.map((s) => {
    const days = byStaff.get(s.id) ?? [];
    const count = days.reduce((n, d) => n + d.visits.length, 0);
    return {
      key: s.id,
      name: s.name,
      email: s.email,
      summary: `訪問 ${count}件`,
      mail: mailTo(s.email, weekMailText(data.org, s, days), limit),
    };
  });
  const noEmail = rows.filter((r) => !r.email).length;
  return (
    <SidePanel
      icon={Mail}
      title={`${mdw(first)}〜${mdw(last)}の予定をメールで送る`}
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          <WithIcon icon={X}>閉じる</WithIcon>
        </button>
      }
    >
      <div className="stack" data-testid="week-mail-panel">
        <p>
          週の見通しとして、今の担当で曜日ごとの訪問（時刻・{terms.client}
          ）を本文に入れます（確定していない日があれば、冒頭に「確定した予定は前日のメールでお知らせします」と書きます）。
          住所・道順・決まりごと・鍵の情報は入れません（日の予定のメールで送り、送るとその日が確定になります）。
          週のメールを送っても確定にはしません。
        </p>
        <MailNotice>
          {noEmail > 0 && ` メールアドレスの無い${terms.staff}（${noEmail}人）は、${terms.staff}の画面で入れられます。`}
        </MailNotice>
        <MailRows rows={rows} testId="week-mail-rows" />
      </div>
    </SidePanel>
  );
}
