// 連絡の一覧（欠勤の振り直し・未連絡の変更。PRD D35・D94。ADR-0011・ADR-0017）：担当が変わる訪問先・時刻が変わる訪問・
// 仕事が増える/減るスタッフと、スタッフごと・訪問先ごとの連絡文（コピー・メール）。印刷するとこの欄だけが出る。送信はしない
import { Check, ClipboardCopy, MessageSquareText, Printer, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { MailButton, MailLengthNote } from '../components/mailParts';
import { StaffMarkById } from '../components/StaffMark';
import { SidePanel, WithIcon } from '../components/ui';
import type { Terms } from '../contracts/documents';
import type { ContactList, ContactVisit } from '../contracts/reassign';
import { copyText } from '../lib/clipboard';
import { allContactsText, type ContactWords, clientMessages, clock, staffMessage } from '../lib/contacts';
import { NO_EMAIL } from '../lib/mail';
import type { BuiltMail } from '../lib/mailto';

/** 連絡の一覧の1行の時刻（元 → 今） */
function timeChange(x: ContactVisit): string {
  if (x.fromStart === null) return clock(x.toStart);
  if (x.toStart === null || Math.round(x.toStart - x.fromStart) === 0) return clock(x.fromStart);
  return `${clock(x.fromStart)} → ${clock(x.toStart)}`;
}

/** 連絡の一覧に出す、欠勤の人に残る訪問（時刻は「9:00」。対応が必要） */
export type LeftContact = { visitId: string; clientId: string; staffId: string; at: string; reason: string };

/**
 * 連絡の一覧（右から出る欄。確定前でも見られる）：担当が変わる訪問先・時刻が変わる訪問・仕事が増える/減るスタッフと、
 * スタッフごと・訪問先ごとの連絡文（コピー）。印刷するとこの欄だけが出る。送信はしない
 */
export function ContactPanel({
  list,
  left = [],
  words,
  terms,
  staffMail,
  onCopied,
  onContacted,
  onClose,
}: {
  list: ContactList;
  /** 欠勤の人に残る、振り直すべき訪問（連絡文には入れず、一覧のいちばん上に出す） */
  left?: LeftContact[];
  words: ContactWords;
  terms: Terms;
  /**
   * 担当が変わった〈スタッフ〉あてのメール（PRD D94。ADR-0017）：スタッフの ID と連絡文から、メールアプリを開く URL を作る。
   * メールアドレスが無ければ null（ボタンは押せず理由を出す）。渡さなければメールのボタンを出さない
   */
  staffMail?: (staffId: string, text: string) => BuiltMail | null;
  /** コピーしたあと（ok：できたか） */
  onCopied: (ok: boolean, what: string) => void;
  /**
   * 「連絡した」（expert 切の未連絡の変更の一覧だけ。メール機能の入り切りに関係なく出す。ADR-0073）：今の担当・時刻を伝えた記録にする。
   * 渡さなければボタンを出さない
   */
  onContacted?: () => void;
  onClose: () => void;
}) {
  const clients = clientMessages(list, words);
  const empty = list.staff.length === 0 && list.staffChanged.length === 0;
  const nothing = empty && left.length === 0;
  const copy = (text: string, what: string) => {
    void copyText(text).then((ok) => onCopied(ok, what));
  };
  return (
    <SidePanel
      icon={MessageSquareText}
      title="連絡の一覧"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={empty}
            onClick={() => copy(allContactsText(list, words), 'すべての連絡文')}
          >
            <WithIcon icon={ClipboardCopy}>すべての連絡文をコピー</WithIcon>
          </button>
          <button type="button" className="btn" disabled={empty} onClick={() => window.print()}>
            <WithIcon icon={Printer}>印刷</WithIcon>
          </button>
          {onContacted && (
            <button
              type="button"
              className="btn"
              onClick={onContacted}
              title="今の担当と時刻を伝えた内容として残します（変更ありが消えます）"
              data-testid="contacted"
            >
              <WithIcon icon={Check}>連絡した</WithIcon>
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            <WithIcon icon={X}>閉じる</WithIcon>
          </button>
        </>
      }
    >
      <div className="stack contact-sheet" data-testid="contact-sheet">
        <p className="sub">
          振り直す前と今の担当の差から作っています（確定の前でも見られます）。連絡文はコピーするだけで、送信はしません。
        </p>
        {left.length > 0 && <LeftSection left={left} words={words} terms={terms} />}
        {nothing ? (
          <p>連絡が要る変更はありません。</p>
        ) : empty ? null : (
          <>
            <StaffChangedSection list={list} words={words} terms={terms} />
            <TimeChangedSection list={list} words={words} terms={terms} />
            <StaffListSection list={list} words={words} terms={terms} />
            <StaffMessagesSection list={list} words={words} terms={terms} staffMail={staffMail} copy={copy} />
            <ClientMessagesSection clients={clients} words={words} terms={terms} copy={copy} />
          </>
        )}
      </div>
    </SidePanel>
  );
}

type SectionProps = { list: ContactList; words: ContactWords; terms: Terms };

/** 欠勤の人に残っている訪問（連絡文には入らない。対応が必要） */
function LeftSection({ left, words, terms }: { left: LeftContact[]; words: ContactWords; terms: Terms }) {
  return (
    <section className="stack contact-section left-box" style={{ gap: 4 }} data-testid="contact-left">
      <h3 className="error">欠勤の人に残っている訪問（{left.length}件）：対応が必要</h3>
      <p className="sub">
        欠勤の時間と重なるのに振り直していない訪問です（連絡文には入りません）。別の{terms.staff}
        への振り替えと{terms.client}への連絡を決めてください
      </p>
      <table className="contact-table">
        <thead>
          <tr>
            <th scope="col">時刻</th>
            <th scope="col">{terms.client}</th>
            <th scope="col">担当（欠勤）</th>
            <th scope="col">理由</th>
          </tr>
        </thead>
        <tbody>
          {left.map((x) => (
            <tr key={x.visitId}>
              <td className="nowrap">{x.at}</td>
              <td>{words.clientName(x.clientId)}様</td>
              <td>
                <span className="with-staff-mark">
                  <StaffMarkById id={x.staffId} size="xs" />
                  {words.staffName(x.staffId)}
                </span>
              </td>
              <td>{x.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** 担当が変わる〈利用者さん〉 */
function StaffChangedSection({ list, words, terms }: SectionProps) {
  return (
    <section className="stack contact-section" style={{ gap: 4 }}>
      <h3>
        担当が変わる{terms.client}（{list.staffChanged.length}件）
      </h3>
      {list.staffChanged.length === 0 ? (
        <p className="sub">ありません</p>
      ) : (
        <table className="contact-table">
          <thead>
            <tr>
              <th scope="col">時刻</th>
              <th scope="col">{terms.client}</th>
              <th scope="col">前の担当 → 新しい担当</th>
            </tr>
          </thead>
          <tbody>
            {list.staffChanged.map((x) => (
              <tr key={x.visitId}>
                <td className="nowrap">{timeChange(x)}</td>
                <td>{words.clientName(x.clientId)}様</td>
                <td>
                  {x.fromStaffId ? (
                    <span className="with-staff-mark">
                      <StaffMarkById id={x.fromStaffId} size="xs" />
                      {words.staffName(x.fromStaffId)}
                    </span>
                  ) : (
                    '（なし）'
                  )}{' '}
                  →{' '}
                  {x.toStaffId ? (
                    <span className="with-staff-mark">
                      <StaffMarkById id={x.toStaffId} size="xs" />
                      {words.staffName(x.toStaffId)}
                    </span>
                  ) : (
                    <strong>入らない（調整中）</strong>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** 時刻だけ変わる〈利用者さん〉 */
function TimeChangedSection({ list, words, terms }: SectionProps) {
  return (
    <section className="stack contact-section" style={{ gap: 4 }}>
      <h3>
        時刻だけ変わる{terms.client}（{list.timeChanged.length}件）
      </h3>
      {list.timeChanged.length === 0 ? (
        <p className="sub">ありません</p>
      ) : (
        <table className="contact-table">
          <thead>
            <tr>
              <th scope="col">時刻</th>
              <th scope="col">{terms.client}</th>
              <th scope="col">担当</th>
            </tr>
          </thead>
          <tbody>
            {list.timeChanged.map((x) => (
              <tr key={x.visitId}>
                <td className="nowrap">{timeChange(x)}</td>
                <td>{words.clientName(x.clientId)}様</td>
                <td>
                  {x.toStaffId && (
                    <span className="with-staff-mark">
                      <StaffMarkById id={x.toStaffId} size="xs" />
                      {words.staffName(x.toStaffId)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** 仕事が増える・減る〈スタッフ〉 */
function StaffListSection({ list, words, terms }: SectionProps) {
  return (
    <section className="stack contact-section" style={{ gap: 4 }}>
      <h3>
        仕事が増える・減る{terms.staff}（{list.staff.length}人）
      </h3>
      <ul className="contact-staff">
        {list.staff.map((c) => (
          <li key={c.staffId}>
            <strong className="with-staff-mark">
              <StaffMarkById id={c.staffId} size="xs" />
              {words.staffName(c.staffId)}
            </strong>
            {c.added.length > 0 && <span className="chip chip-move">増える {c.added.length}件</span>}
            {c.removed.length > 0 && <span className="chip">外れる {c.removed.length}件</span>}
            {c.shifted.length > 0 && <span className="chip chip-warn">時刻が変わる {c.shifted.length}件</span>}
            <ul>
              {c.added.map((x) => (
                <li key={`a-${x.visitId}`}>
                  追加：{clock(x.toStart)} {words.clientName(x.clientId)}様
                  {words.clientAddress(x.clientId) ? `（${words.clientAddress(x.clientId)}）` : ''}
                </li>
              ))}
              {c.removed.map((x) => (
                <li key={`r-${x.visitId}`}>
                  外れる：{clock(x.fromStart)} {words.clientName(x.clientId)}様
                </li>
              ))}
              {c.shifted.map((x) => (
                <li key={`s-${x.visitId}`}>
                  時刻：{timeChange(x)} {words.clientName(x.clientId)}様
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 〈スタッフ〉あての連絡文（コピー・メール） */
function StaffMessagesSection({
  list,
  words,
  terms,
  staffMail,
  copy,
}: SectionProps & {
  staffMail?: (staffId: string, text: string) => BuiltMail | null;
  copy: (text: string, what: string) => void;
}) {
  return (
    <section className="stack contact-section" style={{ gap: 6 }}>
      <h3>
        連絡文（{terms.staff}あて・{list.staff.length}人）
      </h3>
      {list.staff.map((c) => {
        const text = staffMessage(c, words);
        const mail = staffMail?.(c.staffId, text) ?? null;
        return (
          <ContactMessage
            key={c.staffId}
            text={text}
            label={`${words.staffName(c.staffId)}さんへの連絡文`}
            onCopy={() => copy(text, `${words.staffName(c.staffId)}さんへの連絡文`)}
            extra={
              staffMail && (
                <>
                  <MailButton
                    mail={mail}
                    label="メール"
                    why={NO_EMAIL}
                    srLabel={`${words.staffName(c.staffId)}さんへのメールを作る`}
                    testId="contact-mail"
                  />
                  <MailLengthNote mail={mail} />
                </>
              )
            }
          />
        );
      })}
    </section>
  );
}

/** 〈利用者さん〉あての連絡文（コピー） */
function ClientMessagesSection({
  clients,
  words,
  terms,
  copy,
}: {
  clients: { clientId: string; text: string }[];
  words: ContactWords;
  terms: Terms;
  copy: (text: string, what: string) => void;
}) {
  return (
    <section className="stack contact-section" style={{ gap: 6 }}>
      <h3>
        連絡文（{terms.client}あて・{clients.length}件）
      </h3>
      {clients.length === 0 && <p className="sub">ありません</p>}
      {clients.map((c) => (
        <ContactMessage
          key={c.clientId}
          text={c.text}
          label={`${words.clientName(c.clientId)}様への連絡文`}
          onCopy={() => copy(c.text, `${words.clientName(c.clientId)}様への連絡文`)}
        />
      ))}
    </section>
  );
}

function ContactMessage({
  text,
  label,
  onCopy,
  extra,
}: {
  text: string;
  label: string;
  onCopy: () => void;
  /** コピーの横に並べるもの（メールのボタン。PRD D94） */
  extra?: ReactNode;
}) {
  return (
    <div className="contact-msg">
      <pre title={label}>{text}</pre>
      <div className="contact-msg-acts no-print">
        <button type="button" className="btn btn-small" onClick={onCopy} aria-label={`${label}をコピー`}>
          <WithIcon icon={ClipboardCopy} size={14}>
            コピー
          </WithIcon>
        </button>
        {extra}
      </div>
    </div>
  );
}
