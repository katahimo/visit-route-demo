// 〈利用者さん〉の画面の基本情報のタブの節「基本」「段階と紹介元」（PRD D308・D311。ADR-0015・0017）：読むときの中身と
// 直すときの入力欄。仮押さえの人は読むときに本登録にする・取り消すの枠
import { BookmarkCheck, BookmarkX } from 'lucide-react';
import type { FormErr, invalidAttrs } from '../components/FieldError';
import { RequiredMark } from '../components/FieldError';
import { Check, TentativeMark } from '../components/parts';
import { DlRow } from '../components/personDetail';
import { Hint, WithIcon } from '../components/ui';
import type { Client, ClientStage, Terms } from '../contracts/documents';
import type { ClientSecKey } from '../lib/clientEdit';
import { isBeforeActive, STAGE_LABELS, stageChoices, withStage } from '../lib/clientStage';
import { CLIENT_COLORS, colorOf, initialOf } from '../lib/colors';
import { orDash } from '../lib/viewMode';
import type { SetClientForm } from './useClientEdit';

/** 節の入力欄に共通で渡すもの（直している入力・直す・誤った入力欄の属性・呼び方） */
export type ClientFormCtx = {
  form: Client;
  setForm: SetClientForm;
  bad: (field: string) => ReturnType<typeof invalidAttrs>;
  terms: Terms;
};

/** 節（EditSection）の共通の引数 */
export type ClientSecOf = (key: ClientSecKey) => {
  name: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  error: FormErr;
  errorId: string;
};

export function ClientBasicView({ c }: { c: Client }) {
  return (
    <dl>
      <DlRow term="よみ" value={orDash(c.kana)} />
      <DlRow term="メモ" value={orDash(c.note)} />
      <DlRow
        term="色"
        value={
          <span className="row" style={{ gap: 6 }}>
            <span className="dot dot-sm" style={{ background: colorOf(c.color) }} aria-hidden="true">
              {initialOf(c.displayName)}
            </span>
            色{c.color + 1}
          </span>
        }
      />
    </dl>
  );
}

export function ClientBasicFields({ form, setForm, bad }: ClientFormCtx) {
  return (
    <>
      <div className="form-grid">
        <label>
          <span>
            表示名
            <RequiredMark />
          </span>
          <input
            value={form.displayName}
            maxLength={50}
            required
            {...bad('displayName')}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            data-testid="client-name"
          />
        </label>
        <label>
          よみ（ひらがな・任意。検索に使います）
          <input
            value={form.kana}
            maxLength={50}
            placeholder="例：としょかん ふみ"
            onChange={(e) => setForm({ ...form, kana: e.target.value })}
            data-testid="client-kana"
          />
        </label>
        <label>
          メモ
          <input value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="sub">色</span>
        {CLIENT_COLORS.map((col, i) => (
          <button
            key={col}
            type="button"
            className="dot dot-sm"
            aria-label={`色${i + 1}`}
            aria-pressed={form.color === i}
            onClick={() => setForm({ ...form, color: i })}
            style={{
              background: col,
              border: form.color === i ? '3px solid var(--ink)' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            {form.color === i ? '✓' : ''}
          </button>
        ))}
      </div>
    </>
  );
}

export function ClientStageView({
  c,
  saved,
  stageOn,
  terms,
  onConfirmTentative,
  onCancelTentative,
}: {
  c: Client;
  saved: Client | undefined;
  stageOn: boolean;
  terms: Terms;
  onConfirmTentative: (c: Client) => void;
  onCancelTentative: (c: Client) => void;
}) {
  return (
    <>
      <dl>
        <DlRow
          term="段階"
          value={`${STAGE_LABELS[c.stage]}${c.tentative ? '（枠を仮押さえ。予定・AI の提案に入ります）' : ''}`}
        />
        {stageOn && (
          <>
            <DlRow term="紹介元" value={orDash(c.referrer.name)} />
            <DlRow term="連絡先" value={orDash(c.referrer.contact)} />
            <DlRow term="メールアドレス" value={orDash(c.referrer.email)} />
            <DlRow term="紹介元のメモ" value={orDash(c.referrer.note)} />
          </>
        )}
      </dl>
      {saved?.tentative && (
        <div className="tentative-box stack" data-testid="tentative-box">
          <span className="row" style={{ gap: 6 }}>
            <TentativeMark />
            <strong>仮押さえの{terms.client}です</strong>
          </span>
          <span className="sub">
            問い合わせの試算から仮に押さえています（段階「{STAGE_LABELS[saved.stage]}」。予定・AI の提案に入ります）。
            決まったら本登録（利用中）に、断られたら取り消してください。
          </span>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-small" onClick={() => onConfirmTentative(saved)}>
              <WithIcon icon={BookmarkCheck} size={14}>
                本登録にする
              </WithIcon>
            </button>
            <button type="button" className="btn btn-small" onClick={() => onCancelTentative(saved)}>
              <WithIcon icon={BookmarkX} size={14}>
                仮押さえを取り消す
              </WithIcon>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function ClientStageFields({ form, setForm, bad, terms, stageOn }: ClientFormCtx & { stageOn: boolean }) {
  return (
    <>
      {stageOn ? (
        <Hint>
          段階は 相談受付 → 顔合わせ → 契約 → 利用中 → 終了 です。予定に入るのは「利用中」と、仮押さえしている
          {terms.client}だけです。
        </Hint>
      ) : (
        <Hint>予定に入るのは「利用中」の{terms.client}です。「終了」にすると予定に入りません。</Hint>
      )}
      <div className="form-grid" data-testid="client-stage-form">
        <label>
          段階
          <select
            value={form.stage}
            onChange={(e) => setForm(withStage(form, e.target.value as ClientStage))}
            data-testid="client-stage-select"
          >
            {stageChoices(form.stage, stageOn).map((st) => (
              <option key={st} value={st}>
                {STAGE_LABELS[st]}
              </option>
            ))}
          </select>
        </label>
        {isBeforeActive(form.stage) && (
          <Check checked={form.tentative} onChange={(on) => setForm(withStage(form, form.stage, on))}>
            枠を仮押さえする（予定・AI の提案に入れる）
          </Check>
        )}
        {stageOn && (
          <>
            <label>
              紹介元
              <input
                value={form.referrer.name}
                maxLength={50}
                placeholder="例：〇〇相談室"
                onChange={(e) => setForm({ ...form, referrer: { ...form.referrer, name: e.target.value } })}
                data-testid="client-referrer-name"
              />
            </label>
            <label>
              紹介元の連絡先
              <input
                value={form.referrer.contact}
                maxLength={100}
                placeholder="電話・メールなど"
                onChange={(e) => setForm({ ...form, referrer: { ...form.referrer, contact: e.target.value } })}
              />
            </label>
            <label>
              紹介元のメールアドレス（任意）
              <input
                type="email"
                value={form.referrer.email}
                maxLength={254}
                autoComplete="off"
                placeholder="name@example.com"
                {...bad('referrer')}
                onChange={(e) => setForm({ ...form, referrer: { ...form.referrer, email: e.target.value } })}
                data-testid="client-referrer-email"
              />
            </label>
            <label>
              紹介元のメモ
              <input
                value={form.referrer.note}
                maxLength={200}
                placeholder="例：返事待ち・顔合わせの日程"
                onChange={(e) => setForm({ ...form, referrer: { ...form.referrer, note: e.target.value } })}
              />
            </label>
          </>
        )}
      </div>
    </>
  );
}
