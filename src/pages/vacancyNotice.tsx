import { ClipboardList, Copy } from 'lucide-react';
import { FieldError } from '../components/FieldError';
import { MailButton, MailLengthNote, MailNotice } from '../components/mailParts';
import { WithIcon } from '../components/ui';
import type { Terms, VisitType } from '../contracts/documents';
import { VACANCY_MARGIN_DEFAULT } from '../contracts/vacancy';
import { mdText } from '../lib/dateText';
import { NO_TYPE_TEXT, NOTICE_PERIODS, type NoticePeriod, noticeLine } from '../lib/vacancyView';
import type { VacancyNoticeState } from './useVacancyNotice';
import { FoldMark } from './vacancyParts';

/** 空き枠の案内文の欄（PRD D67。ADR-0013）：期間・種類を選んで文を作り、コピー・紹介元へメール（mailOn のとき） */
export function NoticeCard({
  notice: n,
  terms,
  visitTypes,
  period,
  typeId,
  duration,
  hasPlace,
  mailOn,
  stageOn,
}: {
  notice: VacancyNoticeState;
  terms: Terms;
  visitTypes: readonly VisitType[];
  period: { value: NoticePeriod; set: (p: NoticePeriod) => void };
  typeId: { value: string; set: (id: string) => void };
  /** 上の条件の所要（正しくなければ null） */
  duration: number | null;
  hasPlace: boolean;
  /** メール（ADR-0028 の mail）：切なら紹介元へのメールを出さない */
  mailOn: boolean;
  /** 段階・紹介元（ADR-0028 の clientStage）：切なら紹介元の一覧と BCC のメールを出さない */
  stageOn: boolean;
}) {
  const { noticeType, noticeDuration, noticeSpan, notice, noticeStale, setNoticeOpen, copyNotice } = n;
  return (
    <details
      className="vacancy-notice"
      data-testid="notice-card"
      onToggle={(e) => setNoticeOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary data-testid="notice-toggle">
        <h3 className="vacancy-sub-title">
          <WithIcon icon={ClipboardList} size={16}>
            {mailOn ? '空き枠の案内文・紹介元へメール' : '空き枠の案内文'}
          </WithIcon>
        </h3>
        <span className="vacancy-stage-line" data-testid="notice-line">
          {noticeLine(
            NOTICE_PERIODS.find((p) => p.id === period.value)?.label ?? '',
            noticeType?.name ?? null,
            noticeDuration,
          )}
        </span>
        <FoldMark />
      </summary>
      <div className="stack">
        <p className="sub">
          紹介元などへ空いている枠を知らせる文を作ります。{terms.staff}の条件・場所は上の「1 いつ・何を」「2
          場所」のままです。
        </p>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
          <fieldset className="segmented seg-sm" aria-label="案内する期間" data-testid="notice-period">
            {NOTICE_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period.value === p.id}
                className={period.value === p.id ? 'is-on' : ''}
                onClick={() => period.set(p.id)}
              >
                {p.label}
              </button>
            ))}
          </fieldset>
          <label style={{ minWidth: 220 }}>
            種類
            <select value={typeId.value} onChange={(e) => typeId.set(e.target.value)} data-testid="notice-type">
              <option value="">
                {NO_TYPE_TEXT}（所要 {duration !== null ? `${duration}分` : '—'}）
              </option>
              {visitTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}（{t.durationMinutes}分）
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="sub">
          {mdText(noticeSpan.from)}〜{mdText(noticeSpan.to)}
          {period.value === 'fourWeeks'
            ? '：毎週続けて受けられる曜日・開始の時間を載せます'
            : '：日ごとに、受けられる開始の時間を載せます'}
          {hasPlace ? '（場所への移動を含む）' : `（目安。移動を前後${VACANCY_MARGIN_DEFAULT}分で見込む）`}
        </p>
        <FieldError live={false}>
          {noticeDuration === null && '種類を選ぶか、上の「1 いつ・何を」の所要を正しく入れてください'}
        </FieldError>
        {notice && (
          <>
            <output className="inquiry-summary notice-text" data-testid="notice-text">
              {notice.text}
            </output>
            {notice.noPlan.length > 0 && (
              <p className="sub" data-testid="notice-noplan">
                計算できなかった日（{notice.noPlan.length}日）は載せていません（上の表の注意）。
              </p>
            )}
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={copyNotice}
                disabled={noticeStale}
                data-testid="copy-notice"
              >
                <WithIcon icon={Copy}>案内文をコピー</WithIcon>
              </button>
            </div>
            {mailOn && stageOn && <NoticeMail notice={n} />}
          </>
        )}
      </div>
    </details>
  );
}

/** 紹介元へ BCC で一斉に（PRD D95・D96。ADR-0017）：宛先を選び、長すぎるときは何通かに分けたメールのボタン */
function NoticeMail({ notice: n }: { notice: VacancyNoticeState }) {
  const { referrers, mailOff, setMailOff, mailBcc, noticeMails, copyRecipients, noticeMailWhy } = n;
  return (
    <div className="stack notice-mail" style={{ gap: 6 }} data-testid="notice-mail">
      {referrers.length > 0 && (
        <fieldset className="notice-mail-to">
          <legend>紹介元へメール（BCC で一斉。宛先どうしにアドレスは見えません）</legend>
          {referrers.map((r) => {
            const key = r.email.toLowerCase();
            return (
              <label key={key} className="check">
                <input
                  type="checkbox"
                  checked={!mailOff.has(key)}
                  onChange={(e) =>
                    setMailOff((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  style={{ width: 'auto' }}
                  data-testid="notice-mail-pick"
                />
                {r.names.join('・') || '（名前なし）'} <span className="sub">{r.email}</span>
              </label>
            );
          })}
        </fieldset>
      )}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {noticeMails.length === 0 ? (
          <MailButton mail={null} label="紹介元へメール（BCC）" why={noticeMailWhy} testId="notice-mail-open" />
        ) : (
          noticeMails.map((g, i) => (
            <span key={g.bcc[0]} className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <MailButton
                mail={g.mail}
                label={`紹介元へメール（${noticeMails.length > 1 ? `${i + 1}/${noticeMails.length}・` : ''}BCC ${g.bcc.length}件）`}
                why={noticeMailWhy}
                testId="notice-mail-open"
              />
              <MailLengthNote mail={g.mail} />
            </span>
          ))
        )}
        {mailBcc.length > 0 && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => void copyRecipients()}
            data-testid="notice-mail-copy-to"
          >
            <WithIcon icon={Copy} size={14}>
              宛先をコピー
            </WithIcon>
          </button>
        )}
      </div>
      {noticeMails.length > 1 && (
        <p className="sub" data-testid="notice-mail-split">
          宛先が多いので、メールアプリに渡せる長さに収まるよう {noticeMails.length} 通に分けました。順に押してください。
        </p>
      )}
      <MailNotice />
    </div>
  );
}
