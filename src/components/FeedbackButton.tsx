import { MessageSquarePlus, MessageSquareText } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { formError } from '../lib/common';
import {
  FEEDBACK_BUTTON,
  FEEDBACK_CAPTURING,
  FEEDBACK_COMMENT_LABEL,
  FEEDBACK_DIALOG_TITLE,
  FEEDBACK_LIST_BUTTON,
  FEEDBACK_NO_IMAGE,
  FEEDBACK_NOTE,
  FEEDBACK_PATH,
  FEEDBACK_SAVE,
  FEEDBACK_WITH_IMAGE,
  feedbackListLink,
  feedbackProblem,
  feedbackSavedText,
} from '../lib/feedback';
import { NO_CAPTURE_ATTR } from './captureScreen';
import { FieldError } from './FieldError';
import { useToast } from './Toast';
import { useBodyScrollLock } from './useBodyScrollLock';
import { type FeedbackDraft, useFeedbackCount, useFeedbackDraft } from './useFeedback';
import './confirmDialog.css';
import './feedback.css';

const noCapture = { [NO_CAPTURE_ATTR]: '' };

/**
 * 画面へのご意見のボタン（PRD D449。ADR-0114）：どの画面でも左下に出す。押すとその画面を撮り、ご意見を書くダイアログを出す。
 * 残したご意見はこの端末に溜まり、「ご意見」の画面（pages/FeedbackPage）からまとめて送る。ご意見の画面では出さない
 */
export function FeedbackButton() {
  const { pathname } = useLocation();
  const count = useFeedbackCount();
  const { busy, draft, start, save, cancel } = useFeedbackDraft();
  const toast = useToast();
  if (pathname === FEEDBACK_PATH) return null;
  return (
    <>
      <div className="feedback-fabs" {...noCapture}>
        <button
          type="button"
          className="feedback-fab"
          onClick={() => void start()}
          disabled={busy}
          aria-busy={busy}
          aria-label={busy ? FEEDBACK_CAPTURING : FEEDBACK_BUTTON}
          data-testid="feedback-button"
          {...noCapture}
        >
          <MessageSquarePlus size={18} aria-hidden="true" />
          <span>{busy ? FEEDBACK_CAPTURING : FEEDBACK_BUTTON}</span>
          {count > 0 && !busy && (
            <span className="feedback-fab-count" data-testid="feedback-count">
              {count}
            </span>
          )}
        </button>
        {/* 書かなくても、残したご意見をいつでも見られる */}
        <Link
          to={FEEDBACK_PATH}
          className="feedback-fab feedback-fab-icon"
          aria-label={FEEDBACK_LIST_BUTTON}
          title={FEEDBACK_LIST_BUTTON}
          data-testid="feedback-open-list"
        >
          <MessageSquareText size={18} aria-hidden="true" />
          <span>{FEEDBACK_LIST_BUTTON}</span>
        </Link>
      </div>
      {draft && (
        <FeedbackDialog
          draft={draft}
          count={count}
          onCancel={cancel}
          onSave={async (comment, withImage) => toast(feedbackSavedText(await save(comment, withImage)))}
        />
      )}
    </>
  );
}

/** ご意見を書くダイアログ：撮った画面・ご意見の欄・画像を付けるか・［残す］（主ボタン）。Esc・背景・取り消すで捨てる */
function FeedbackDialog({
  draft,
  count,
  onCancel,
  onSave,
}: {
  draft: FeedbackDraft;
  count: number;
  onCancel: () => void;
  onSave: (comment: string, withImage: boolean) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const [withImage, setWithImage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const titleId = useId();
  const commentId = useId();
  useBodyScrollLock();
  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      cancelRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const submit = async () => {
    const problem = feedbackProblem(comment);
    if (problem) {
      setError(problem);
      textRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave(comment, withImage);
    } catch (e) {
      setError(`残せませんでした（${formError(e)}）。画像を外すか、残したご意見を送ってから消してください。`);
      setSaving(false);
    }
  };
  return createPortal(
    <div className="confirm-wrap" data-testid="feedback-wrap" {...noCapture}>
      <div className="confirm-backdrop" aria-hidden="true" onClick={onCancel} />
      <form
        className="confirm-dialog feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="feedback-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 id={titleId}>{FEEDBACK_DIALOG_TITLE}</h2>
        <p className="sub">{draft.screen || draft.path}</p>
        {draft.image ? (
          <>
            <img className="feedback-shot" src={draft.image} alt="撮った画面" data-testid="feedback-shot" />
            <label className="feedback-check">
              <input
                type="checkbox"
                checked={withImage}
                onChange={(e) => setWithImage(e.target.checked)}
                data-testid="feedback-with-image"
              />
              {FEEDBACK_WITH_IMAGE}
            </label>
          </>
        ) : (
          <p className="sub" data-testid="feedback-no-image">
            {FEEDBACK_NO_IMAGE}
          </p>
        )}
        <label htmlFor={commentId}>{FEEDBACK_COMMENT_LABEL}</label>
        <textarea
          id={commentId}
          ref={textRef}
          rows={4}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setError(null);
          }}
          data-testid="feedback-comment"
        />
        <FieldError>{error}</FieldError>
        <p className="sub">{FEEDBACK_NOTE}</p>
        {count > 0 && (
          <Link to={FEEDBACK_PATH} onClick={onCancel} data-testid="feedback-list-link">
            {feedbackListLink(count)}
          </Link>
        )}
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={onCancel} data-testid="feedback-cancel">
            取り消す
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} data-testid="feedback-save">
            {FEEDBACK_SAVE}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
