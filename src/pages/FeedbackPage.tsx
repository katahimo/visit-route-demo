import { Download, Lock, MessageSquareText, Share2, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { FieldError } from '../components/FieldError';
import { Empty, PageHeader, SectionTitle, WithIcon } from '../components/ui';
import type { FeedbackItem } from '../contracts/feedback';
import {
  FEEDBACK_EMPTY,
  FEEDBACK_PASSWORD_MIN,
  FEEDBACK_TITLE,
  FEEDBACK_VOLATILE,
  feedbackAtText,
  sizeText,
} from '../lib/feedback';
import '../components/feedback.css';
import './settings.css';
import { type FeedbackSend, useFeedbackSend } from './useFeedbackSend';

/**
 * 意見（PRD D450。ADR-0114）：画面のボタンで残した意見の一覧と、まとめて送る欄。
 * パスワードで閉じた1つのファイルを作り、端末の共有の画面（LINE・メールなど）で渡すか、保存してメールを開く
 */
export default function FeedbackPage() {
  const send = useFeedbackSend();
  const { items } = send;
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <PageHeader icon={MessageSquareText} title={FEEDBACK_TITLE} lead="画面のボタンで残した意見を、まとめて送ります" />
      {send.volatile && (
        <div className="warn-box">
          <p>{FEEDBACK_VOLATILE}</p>
        </div>
      )}
      {items !== null && items.length === 0 && <Empty icon={MessageSquareText}>{FEEDBACK_EMPTY}</Empty>}
      {items !== null && items.length > 0 && (
        <>
          <SendCard send={send} count={items.length} />
          <section className="card stack" data-testid="feedback-list">
            <SectionTitle icon={MessageSquareText}>残した意見（{items.length}件）</SectionTitle>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} onRemove={() => void send.removeOne(item)} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

/** まとめて送る：①パスワードを決めてファイルを作る → ②共有する／保存してメールを開く → 送ったら消す */
function SendCard({ send, count }: { send: FeedbackSend; count: number }) {
  const pwId = useId();
  const { bundle } = send;
  return (
    <section className="card stack" data-testid="feedback-send">
      <SectionTitle icon={Lock}>まとめて送る</SectionTitle>
      <p className="sub">
        意見{count}
        件を、パスワードで開く1つのファイルにします。受け取った人は、ファイルをブラウザで開いてパスワードを入れます。
        パスワードは、ファイルとは別の手段（電話など）で伝えてください。
      </p>
      <label htmlFor={pwId}>ファイルを開くパスワード（{FEEDBACK_PASSWORD_MIN}文字以上）</label>
      <div className="feedback-send-row">
        <input
          id={pwId}
          type="text"
          autoComplete="off"
          value={send.password}
          onChange={(e) => send.setPassword(e.target.value)}
          style={{ maxWidth: 280 }}
          data-testid="feedback-password"
        />
        <button
          type="button"
          className={bundle ? 'btn' : 'btn btn-primary'}
          disabled={send.making}
          onClick={() => void send.make()}
          data-testid="feedback-make"
        >
          <WithIcon icon={Lock}>{send.making ? '作っています…' : 'ファイルを作る'}</WithIcon>
        </button>
      </div>
      <FieldError>{send.error}</FieldError>
      {bundle && (
        <>
          <p data-testid="feedback-file">
            {bundle.file.name}（{sizeText(bundle.file.size)}）を作りました。
          </p>
          <div className="feedback-send-row">
            {send.shareable && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void send.share()}
                data-testid="feedback-share"
              >
                <WithIcon icon={Share2}>共有する（LINE・メールなど）</WithIcon>
              </button>
            )}
            <button
              type="button"
              className={send.shareable ? 'btn' : 'btn btn-primary'}
              onClick={send.saveAndMail}
              data-testid="feedback-save-mail"
            >
              <WithIcon icon={Download}>保存してメールを開く</WithIcon>
            </button>
          </div>
          <p className="sub">
            「保存してメールを開く」は、ファイルを保存し、件名と本文の入ったメールを開きます。保存したファイルをメールに添付してください。
          </p>
          {send.sent && (
            <button
              type="button"
              className="btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => void send.removeSent()}
              data-testid="feedback-remove-sent"
            >
              <WithIcon icon={Trash2}>送った意見を消す</WithIcon>
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ItemRow({ item, onRemove }: { item: FeedbackItem; onRemove: () => void }) {
  return (
    <div className="feedback-item" data-testid="feedback-item">
      {item.image ? (
        <img src={item.image} alt="意見を残したときの画面" loading="lazy" />
      ) : (
        <p className="sub">（画像なし）</p>
      )}
      <div>
        <strong>{item.screen || item.path}</strong>
        <p className="sub" style={{ margin: 0 }}>
          {feedbackAtText(item.at)}
        </p>
        <p className="feedback-item-comment">{item.comment}</p>
        <button type="button" className="btn btn-small" onClick={onRemove} data-testid="feedback-item-remove">
          <WithIcon icon={Trash2}>消す</WithIcon>
        </button>
      </div>
    </div>
  );
}
