// 〈利用者さん〉の休みのタブの部品（PRD D65。ADR-0013）：休みの一覧の行と、入れる・直すの入力（重なる確定した日の注意）
import { Check, Pencil, Trash2, TriangleAlert, X } from 'lucide-react';
import { enterToSave, FieldError } from '../components/FieldError';
import { WithIcon } from '../components/ui';
import type { DemoData } from '../contracts/data';
import type { ClientLeave } from '../contracts/documents';
import { dateText, mdText } from '../lib/dateText';
import { leaveConfirmedDates, leaveVisits } from '../lib/leaves';
import type { ClientLeaveForm } from './useClientLeaves';

/** 休みの一覧（期間・理由・その期間の訪問の数・確定した日の数と「直す」） */
export function ClientLeaveList({
  leaves,
  data,
  today,
  onEdit,
}: {
  leaves: ClientLeave[];
  data: DemoData;
  today: string;
  onEdit: (l: ClientLeave) => void;
}) {
  if (leaves.length === 0) return <span className="sub">休みはありません</span>;
  return (
    <ul className="leave-list">
      {leaves.map((l) => {
        const n = leaveVisits(data, l).length;
        const fixed = leaveConfirmedDates(data, l);
        const past = l.to < today;
        return (
          <li key={l.id} className="leave-row" data-testid="leave-row">
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <strong>
                {mdText(l.from)}〜{mdText(l.to)}
                {past && <span className="sub">（終わった休み）</span>}
              </strong>
              <span className="sub">
                {l.note || '理由なし'}・訪問 {n}件は無し
                {fixed.length > 0 && `・確定した日 ${fixed.length}日`}
              </span>
            </span>
            <span className="actions">
              <button
                type="button"
                className="btn btn-small btn-text"
                aria-label={`${mdText(l.from)}〜${mdText(l.to)}の休みを直す`}
                onClick={() => onEdit(l)}
                data-testid="leave-edit"
              >
                <WithIcon icon={Pencil} size={14}>
                  直す
                </WithIcon>
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** 入れる・直すの入力（保存を押すまでデータを変えない） */
export function ClientLeaveFormBox({
  form,
  setForm,
  clientName,
  clientTerm,
  draftConfirmed,
  errorState,
  error,
  onOpenDay,
  onSave,
  onCancel,
  onRemove,
}: {
  form: ClientLeaveForm;
  setForm: (f: ClientLeaveForm) => void;
  clientName: string;
  /** 〈利用者さん〉の呼び方 */
  clientTerm: string;
  /** 入力中の休みと重なる確定した日 */
  draftConfirmed: string[];
  errorState: { text: string } | null;
  error: string | null;
  onOpenDay: (date: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <fieldset className="leave-form stack" data-testid="leave-form" onKeyDown={enterToSave(onSave)}>
      <legend>{form.id ? '休みを直す' : '休みを追加'}</legend>
      <div className="form-grid">
        <label>
          開始日
          <input
            type="date"
            value={form.from}
            data-testid="leave-from"
            onChange={(e) => {
              const from = e.target.value;
              // 終了日が開始日より前になったら、終了日を開始日に合わせる
              setForm({ ...form, from, to: form.to && from > form.to ? from : form.to });
            }}
          />
        </label>
        <label>
          終了日
          <input
            type="date"
            value={form.to}
            min={form.from}
            data-testid="leave-to"
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
        </label>
        <label>
          理由（任意）
          <input
            value={form.note}
            maxLength={100}
            placeholder="例：入院、ショートステイ"
            data-testid="leave-note"
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
      </div>
      {draftConfirmed.length > 0 && (
        <div className="leave-warn" data-testid="leave-warn">
          <WithIcon icon={TriangleAlert} size={14}>
            確定した日（{draftConfirmed.map(mdText).join('・')}）に{clientName}の訪問があります。
            休みを入れた日が確定済みなら「未連絡の変更」になります。その日の「日の予定」の連絡の一覧で確かめてください。
          </WithIcon>
          <ul>
            {draftConfirmed.map((d) => (
              <li key={d}>
                <button type="button" className="link-button" onClick={() => onOpenDay(d)}>
                  {dateText(d)}の予定を開く
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FieldError token={errorState}>{error}</FieldError>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-small btn-primary" onClick={onSave} data-testid="leave-save">
          <WithIcon icon={Check} size={14}>
            保存
          </WithIcon>
        </button>
        <button type="button" className="btn btn-small" onClick={onCancel} data-testid="leave-cancel">
          <WithIcon icon={X} size={14}>
            取り消し
          </WithIcon>
        </button>
        {form.id && (
          <button type="button" className="btn btn-small btn-danger" onClick={onRemove} data-testid="leave-remove">
            <WithIcon icon={Trash2} size={14}>
              この休みを消す
            </WithIcon>
          </button>
        )}
      </div>
      <span className="sub">
        {clientTerm}
        の休みは、訪問を別の日に振り替えません。振り替えるときは、予定のカレンダーで訪問を足してください。
      </span>
    </fieldset>
  );
}
