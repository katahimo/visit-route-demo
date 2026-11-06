// 「欠勤・キャンセル」の欄の2段目「連絡・確定」：済んだこと・振り直しの結果（案A・案B）・連絡（宛先ごとの文・コピー・メール・
// ［連絡した］）と確定（PRD D244〜D246・D414・D415。ADR-0038・ADR-0082）
import { Check, CircleCheck, ClipboardCopy, Undo2, UserRoundCheck } from 'lucide-react';
import { MailButton, MailLengthNote } from '../components/mailParts';
import { StaffMarkById } from '../components/StaffMark';
import { WithIcon } from '../components/ui';
import { CONTACT_KIND_LABEL, type ContactKind, type ContactRow } from '../lib/contacts';
import { NO_EMAIL } from '../lib/mail';
import { confirmNote, SUDDEN_HEADINGS } from '../lib/sudden';
import { stepHeading } from './suddenSteps';
import { type Done, type StepCtx, type StepView, sentKey } from './useSuddenSteps';

/** 種類の印の色（担当が外れる・中止は灰、新しく入るは移る色、時刻は注意の色） */
const KIND_CHIP: Record<ContactKind, string> = {
  removed: 'chip',
  added: 'chip chip-move',
  shifted: 'chip chip-warn',
  cancelled: 'chip',
  client: 'chip',
};

/** 確定の文（空なら出さない） */
function ConfirmNote({ text }: { text: string }) {
  return text ? (
    <p className="sub" data-testid="sudden-confirm-note">
      {text}
    </p>
  ) : null;
}

/** 済んだこと・振り直す前に戻す・日の予定で差を見る・振り直しの結果（案B も作るときは開いておく） */
function doneHead({ p, s }: StepCtx, done: Done) {
  const { result, onRevert, onClose, running } = p;
  const { busy, guarded } = s;
  return (
    <>
      <p className="row" style={{ gap: 6 }} data-testid="sudden-done">
        <Check size={16} aria-hidden="true" />
        {done.kind === 'staff'
          ? `${done.text}を登録して振り直しました`
          : `${done.text} を${done.sameDay ? '当日キャンセルとして' : ''}取り消しました`}
      </p>
      {done.kind === 'staff' && (
        <>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {onRevert && (
              <button
                type="button"
                className="btn btn-small"
                disabled={running || busy}
                onClick={() =>
                  void guarded(async () => {
                    if (await onRevert()) onClose(false);
                  })
                }
                data-testid="sudden-revert"
              >
                <WithIcon icon={Undo2} size={14}>
                  振り直す前に戻す
                </WithIcon>
              </button>
            )}
            <button type="button" className="btn btn-small" onClick={() => onClose(true)} data-testid="sudden-to-bar">
              <WithIcon icon={UserRoundCheck} size={14}>
                日の予定で差を見る
              </WithIcon>
            </button>
          </div>
          <details className="sudden-result-box" open={done.anneal} data-testid="sudden-result-box">
            <summary>振り直しの結果（案A・案B）</summary>
            {result ?? (
              <p className="sub" aria-live="polite">
                振り直しを出しています…
              </p>
            )}
          </details>
        </>
      )}
    </>
  );
}

/** 連絡の1行（宛名・種類・初めての印・文・コピー・メール・［連絡した］） */
function ContactItem({ ctx, r }: { ctx: StepCtx; r: ContactRow }) {
  const { terms, contactMail } = ctx.p;
  const { sent, copyRow, toggleSent } = ctx.s;
  const mail = r.to === 'staff' ? contactMail(r) : null;
  return (
    <li
      className={`sudden-contact${sent.has(sentKey(r)) ? ' is-sent' : ''}`}
      data-testid="sudden-contact"
      data-to={r.to}
      data-kinds={r.kinds.join(' ')}
    >
      <div className="sudden-contact-head">
        {r.to === 'staff' && <StaffMarkById id={r.id} size="xs" />}
        <strong>{r.name}</strong>
        {r.to === 'client' ? (
          <span className="chip">{terms.client}あて</span>
        ) : (
          r.kinds.map((k) => (
            <span key={k} className={KIND_CHIP[k]}>
              {CONTACT_KIND_LABEL[k]}
            </span>
          ))
        )}
        {r.first && (
          <span className="chip chip-warn" data-testid="sudden-contact-first">
            初めて
          </span>
        )}
      </div>
      <pre className="sudden-contact-text" data-testid="sudden-contact-text">
        {r.text}
      </pre>
      <div className="sudden-contact-acts">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => copyRow(r)}
          aria-label={`${r.name}への文をコピー`}
          data-testid="sudden-contact-copy"
        >
          <WithIcon icon={ClipboardCopy} size={14}>
            文をコピー
          </WithIcon>
        </button>
        {r.to === 'staff' && (
          <>
            <MailButton
              mail={mail}
              label="メール"
              why={NO_EMAIL}
              srLabel={`${r.name}へのメールを作る`}
              testId="sudden-contact-mail"
            />
            <MailLengthNote mail={mail} />
          </>
        )}
        <label className="check sudden-contact-sent">
          <input
            type="checkbox"
            checked={sent.has(sentKey(r))}
            onChange={(e) => toggleSent(sentKey(r), e.target.checked)}
            style={{ width: 'auto' }}
            aria-label={`${r.name}に連絡した`}
            data-testid="sudden-contact-sent"
          />
          連絡した
        </label>
      </div>
    </li>
  );
}

/** 2段目：済んだこと・連絡（宛先ごとの文・コピー・メール・［連絡した］）と確定 */
export function contactStep(ctx: StepCtx, done: Done): StepView {
  const { p, s } = ctx;
  const { terms, contacts, confirmState, confirmStep, leftCount = 0, hasPlan, running, onAdopt, onClose } = p;
  const { sent, busy, guarded } = s;
  const rows = contacts ?? [];
  const sentCount = rows.filter((r) => sent.has(sentKey(r))).length;
  const body = (
    <>
      {stepHeading(SUDDEN_HEADINGS[2])}
      {doneHead(ctx, done)}
      <p className="sub">
        {done.kind === 'staff'
          ? '振り直す前と後で担当が変わった人への連絡です。'
          : `取り消した訪問の担当への連絡です。キャンセルした${terms.client}あては作りません。`}
        文はコピーするか、メールアプリで開いて送ります。
      </p>
      <ConfirmNote text={confirmNote(confirmState, confirmStep)} />
      {leftCount > 0 && (
        <p className="warn-text" role="note" data-testid="sudden-contacts-left">
          欠勤の人に残る訪問 {leftCount}件（連絡文には入りません。日の予定で確かめてください）
        </p>
      )}
      {contacts === null ? (
        <p className="sub" data-testid="sudden-contacts-none">
          {done.kind === 'staff'
            ? '振り直しの差を出せませんでした。日の予定の「連絡の一覧」で確かめてください'
            : '差を出せませんでした。取り消した訪問の担当へは、日の予定で担当を確かめて連絡してください'}
        </p>
      ) : rows.length === 0 ? (
        <p data-testid="sudden-contacts-none">連絡が要る変更はありません。</p>
      ) : (
        <>
          <p className="sudden-contacts-count" aria-live="polite" data-testid="sudden-contacts-count">
            連絡した {sentCount}/{rows.length}人
          </p>
          <ul className="sudden-contacts" data-testid="sudden-contacts">
            {rows.map((r) => (
              <ContactItem key={r.key} ctx={ctx} r={r} />
            ))}
          </ul>
        </>
      )}
    </>
  );
  const canAdopt = confirmStep && hasPlan && confirmState !== 'told';
  const footer = (
    <>
      {canAdopt && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={running || busy}
          title={running ? '計算中は押せません' : '連絡が済んだら押します（今の担当と時刻を伝えた内容として残します）'}
          onClick={() =>
            void guarded(async () => {
              if (await onAdopt()) onClose(false);
            })
          }
          data-testid="sudden-adopt"
        >
          <WithIcon icon={CircleCheck}>連絡したので確定</WithIcon>
        </button>
      )}
      <button
        type="button"
        className={canAdopt ? 'btn' : 'btn btn-primary'}
        onClick={() => onClose(false)}
        data-testid="sudden-finish"
      >
        <WithIcon icon={Check}>{canAdopt ? 'あとで確定する' : '終わる'}</WithIcon>
      </button>
    </>
  );
  return { body, footer };
}
