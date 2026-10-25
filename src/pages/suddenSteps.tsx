// 「欠勤・キャンセル」の欄の段ごとの中身と下の帯（PRD D167〜D172・D243〜D246。ADR-0038・ADR-0044）。
// 状態と処理は useSuddenSteps、欄の枠は SuddenPanel
import {
  Ban,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
  Trash2,
  Undo2,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import { WithIcon } from '../components/ui';
import type { Absence } from '../contracts/documents';
import {
  absenceSummary,
  cancelImpact,
  impactText,
  noPlanText,
  recommendAnneal,
  type SuddenStep,
  suddenHeading,
} from '../lib/sudden';
import { AbsenceFields, AbsenceTargets } from './absenceParts';
import type { Done, StepCtx, StepView } from './useSuddenSteps';

/** 段の見出し（段を進めたらここへフォーカス） */
export const stepHeading = (text: string) => (
  <h3 className="sudden-step-title" tabIndex={-1} data-return-focus>
    {text}
  </h3>
);

export const backButton = (go: (s: SuddenStep) => void, to: SuddenStep) => (
  <button type="button" className="btn" onClick={() => go(to)} data-testid="sudden-back">
    <WithIcon icon={ChevronLeft}>戻る</WithIcon>
  </button>
);

const closeButton = (close: () => void) => (
  <button type="button" className="btn" onClick={close} data-testid="sudden-close">
    <WithIcon icon={X}>閉じる</WithIcon>
  </button>
);

/** 1段目：何が起きたか（休む・キャンセル）と、この日の欠勤（直す・取り消す） */
export function kindStep({ p, s }: StepCtx): StepView {
  const { terms, staffList } = p;
  const { kind, chooseKind, pickStaff } = s;
  const absentNow = staffList.filter((x) => x.absent);
  const body = (
    <>
      {stepHeading(suddenHeading(kind, 1, terms.staff))}
      <div className="sudden-choices">
        <button
          type="button"
          className="card sudden-choice"
          data-testid="sudden-kind-staff"
          onClick={() => chooseKind('staff')}
        >
          <UserRoundX size={22} aria-hidden="true" />
          <span className="sudden-choice-text">
            <strong>{terms.staff}が休む</strong>
            <span className="sub">急な欠勤・遅刻・早退。休む人の訪問を、ほかの人へ振り直します</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="card sudden-choice"
          data-testid="sudden-kind-client"
          onClick={() => chooseKind('client')}
        >
          <CalendarX2 size={22} aria-hidden="true" />
          <span className="sudden-choice-text">
            <strong>{terms.client}がキャンセル</strong>
            <span className="sub">当日キャンセル。その訪問を取り消し、担当から外します</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      {absentNow.length > 0 && (
        <div className="stack sudden-existing" style={{ gap: 4 }} data-testid="sudden-existing">
          <strong>この日の欠勤（直す・取り消す）</strong>
          {absentNow.map((s) => (
            <button
              key={s.id}
              type="button"
              className="link-btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => {
                chooseKind('staff');
                pickStaff(s.id);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
  const footer = closeButton(s.close);
  return { body, footer };
}

/** 2段目（休む）：休む人と欠勤の時間帯 */
export function staffStep({ p, s }: StepCtx): StepView {
  const { terms, staffList, date } = p;
  const { staffId, pickStaff, draft, setDraft, baseSlots, existing, error } = s;
  const body = (
    <>
      {stepHeading(suddenHeading('staff', 2, terms.staff))}
      {staffList.length === 0 ? (
        <p className="sub">この日に働く{terms.staff}がいません</p>
      ) : (
        <label className="field">
          <span className="field-label">休む人</span>
          <select value={staffId} onChange={(e) => pickStaff(e.target.value)} data-testid="sudden-staff">
            <option value="">選んでください</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {staffId && (
        <AbsenceFields
          draft={draft}
          onChange={(x) => setDraft((cur) => ({ ...cur, ...x }))}
          baseSlots={baseSlots}
          existing={existing}
          date={date}
          error={error}
        />
      )}
    </>
  );
  const footer = (
    <>
      <button type="submit" className="btn btn-primary" disabled={!staffId || !!error} data-testid="sudden-next">
        <WithIcon icon={ChevronRight}>次へ：影響を見る</WithIcon>
      </button>
      {backButton(s.go, 1)}
    </>
  );
  return { body, footer };
}

/** 2段目（キャンセル）：取り消す訪問と取り消しの種類 */
export function visitStep({ p, s }: StepCtx): StepView {
  const { terms, visitList } = p;
  const { visitId, setVisitId, sameDay, setSameDay, go } = s;
  const body = (
    <>
      {stepHeading(suddenHeading('client', 2, terms.staff))}
      {visitList.length === 0 ? (
        <p className="sub">この日に取り消せる訪問がありません</p>
      ) : (
        <label className="field">
          <span className="field-label">訪問</span>
          <select value={visitId} onChange={(e) => setVisitId(e.target.value)} data-testid="sudden-visit">
            <option value="">選んでください</option>
            {visitList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="stack cancel-kind" style={{ gap: 6 }}>
        <legend>取り消しの種類</legend>
        <label className="check">
          <input
            type="radio"
            name="sudden-cancel-kind"
            checked={sameDay}
            onChange={() => setSameDay(true)}
            style={{ width: 'auto' }}
            data-testid="sudden-same-day"
          />
          当日キャンセル（その日になって{terms.client}の都合で取りやめ）
        </label>
        <label className="check">
          <input
            type="radio"
            name="sudden-cancel-kind"
            checked={!sameDay}
            onChange={() => setSameDay(false)}
            style={{ width: 'auto' }}
          />
          ふつうの取り消し（前もって決まった休み・予定の変更など）
        </label>
      </fieldset>
    </>
  );
  const footer = (
    <>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!visitId}
        onClick={() => go(3)}
        data-testid="sudden-next"
      >
        <WithIcon icon={ChevronRight}>次へ：影響を見る</WithIcon>
      </button>
      {backButton(s.go, 1)}
    </>
  );
  return { body, footer };
}

/** 3段目（休む）：影響（振り直す訪問の見込み）と、登録して振り直す・欠勤だけ登録 */
export function absenceImpactStep({ p, s }: StepCtx, absence: Absence): StepView {
  const { terms, running, staffName, visitLabel, onSaveOnly, onRemoveAbsence } = p;
  const { preview, blocked, busy, reassignNow, error, withId, baseSlots, existing, guarded } = s;
  const impact = preview ? impactText(preview.targets) : null;
  const hasBase = !!preview && preview.hasBase;
  /**
   * 主ボタンは「登録して振り直す（おすすめ）」の1つ（PRD D264。ADR-0044）。案A で入らない見込みなら、おすすめは
   * 案B も作るほう（sudden-anneal）、無ければ案A（sudden-reassign）。もう一方と「欠勤だけ登録」は控えめな文字のボタン
   */
  const recommended = !!preview && recommendAnneal({ hasBase, unplacedA: preview.unplacedA });
  const disabledWhy = blocked ?? undefined;
  const reassignBtn = (anneal: boolean, primary: boolean) => (
    <button
      type="button"
      className={primary ? 'btn btn-primary' : 'btn btn-text'}
      disabled={!!blocked || busy}
      title={disabledWhy}
      onClick={() => void reassignNow(anneal)}
      data-testid={anneal ? 'sudden-anneal' : 'sudden-reassign'}
    >
      {primary ? (
        <WithIcon icon={Send}>登録して振り直す（おすすめ）</WithIcon>
      ) : anneal ? (
        '登録して、案B も作る'
      ) : (
        '案A だけで振り直す'
      )}
    </button>
  );
  const saveOnly = (
    <button
      type="button"
      // 振り直しの元の案が無い日（案の無い日・計算中・見込みを出せない）は振り直せないので、欠勤だけ登録を主ボタンにする
      // （押せない振り直しのボタンは出さない。主ボタンは1つ。PRD D264）
      className={hasBase ? 'btn btn-text' : 'btn btn-primary'}
      disabled={!!error || busy || running}
      title={running ? '計算中は押せません。終わってから登録してください' : undefined}
      onClick={() => onSaveOnly(withId(absence))}
      data-testid="sudden-save-only"
    >
      欠勤だけ登録（振り直さない）
    </button>
  );
  const body = (
    <>
      {stepHeading(suddenHeading('staff', 3, terms.staff))}
      <p>
        <strong>{absenceSummary(staffName(absence.staffId), absence, baseSlots)}</strong>
        {absence.note ? `（${absence.note}）` : ''}
      </p>
      <div aria-live="polite" className="stack" style={{ gap: 8 }}>
        {!preview ? (
          <p className="sub">見込みを出せませんでした</p>
        ) : (
          <div className="stack absence-preview" style={{ gap: 4 }} data-testid="absence-preview">
            <strong className="sudden-impact" data-testid="sudden-impact">
              {impact?.title}
            </strong>
            {preview.targets.length > 0 && <span className="sub">{impact?.detail}</span>}
            <AbsenceTargets targets={preview.targets} visitLabel={visitLabel} />
          </div>
        )}
        {preview && !hasBase && (
          <p className="warn-text" data-testid="sudden-no-plan">
            {noPlanText(running)}
          </p>
        )}
        {hasBase && preview && (
          <div className="stack sudden-options" style={{ gap: 8 }}>
            <p className="sudden-recommend" data-testid="sudden-recommend">
              おすすめ：
              {recommended
                ? '案A では入らない見込みなので、登録して案A を作ったあと、案B も作って比べます'
                : '登録して、空き時間に入れます（案A）'}
            </p>
            <div className={`sudden-option${recommended ? '' : ' is-recommended'}`}>
              <strong className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                空き時間に入れる（案A）
                {!recommended && <span className="chip chip-primary">おすすめ</span>}
              </strong>
              <span className="sub">
                ほかの人の担当・順番・時刻は変えず、空き時間に入れます（{staffName(absence.staffId)}
                さんの残りの訪問は、欠勤明けの移動で開始が遅れることがあります）。
                {preview.unplacedA > 0
                  ? `${preview.unplacedA}件が入らない見込みです`
                  : preview.targets.length > 0
                    ? 'すべて入る見込みです'
                    : ''}
              </span>
            </div>
            <div className={`sudden-option${recommended ? ' is-recommended' : ''}`} data-testid="anneal-suggest">
              <strong className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                少し動かしてよい（案B）
                {recommended && <span className="chip chip-primary">おすすめ</span>}
              </strong>
              <span className="sub">
                案A を作ったあと、ほかの人の訪問も少し動かして入れる案を AI が作ります（少し時間がかかります）。案A
                と比べて選べます
              </span>
            </div>
          </div>
        )}
        {blocked && hasBase && <p className="sub">押せません：{blocked}</p>}
        {/* ほかのやり方（控えめな文字のボタン。PRD D264）。振り直せない日は出さない（欠勤だけ登録が主ボタン） */}
        {hasBase && (
          <div className="row sudden-alt" style={{ gap: 4, flexWrap: 'wrap' }} data-testid="sudden-alt">
            <span className="sub">ほかのやり方：</span>
            {reassignBtn(!recommended, false)}
            {saveOnly}
          </div>
        )}
      </div>
    </>
  );
  const footer = (
    <>
      {hasBase ? reassignBtn(recommended, true) : saveOnly}
      {existing && (
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={() =>
            void guarded(async () => {
              await onRemoveAbsence(existing);
            })
          }
          data-testid="sudden-remove"
        >
          <WithIcon icon={Trash2}>欠勤を取り消す</WithIcon>
        </button>
      )}
      {backButton(s.go, 2)}
    </>
  );
  return { body, footer };
}

/** 3段目（キャンセル）：取り消す訪問とその影響 */
export function cancelImpactStep({ p, s }: StepCtx, visitId: string): StepView {
  const { terms, visitInfo, hasPlan } = p;
  const { sameDay, cancelNow } = s;
  const info = visitInfo(visitId);
  const body = (
    <>
      {stepHeading(suddenHeading('client', 3, terms.staff))}
      <p>
        <strong>
          {info.client} {info.window}
        </strong>{' '}
        の訪問を{sameDay ? '当日キャンセルとして' : ''}取り消します。
      </p>
      <ul className="sudden-targets" data-testid="sudden-cancel-impact">
        {cancelImpact({ owner: info.owner, sameDay, clientWord: terms.client, hasPlan }).map((x) => (
          <li key={x} className="sub">
            {x}
          </li>
        ))}
      </ul>
    </>
  );
  const footer = (
    <>
      <button type="button" className="btn btn-danger" onClick={cancelNow} data-testid="sudden-cancel-ok">
        <WithIcon icon={Ban}>{sameDay ? '当日キャンセルとして取り消す' : '取り消す'}</WithIcon>
      </button>
      {backButton(s.go, 2)}
    </>
  );
  return { body, footer };
}

/** 4段目：済んだこと・振り直しの結果（案A・案B を選ぶ） */
export function doneStep({ p, s }: StepCtx, done: Done): StepView {
  const { terms, result, onRevert, onClose, running } = p;
  const { go, busy, guarded } = s;
  const body = (
    <>
      {stepHeading(suddenHeading(done.kind, 4, terms.staff))}
      <p className="row" style={{ gap: 6 }} data-testid="sudden-done">
        <Check size={16} aria-hidden="true" />
        {done.kind === 'staff'
          ? `${done.text}を登録して振り直しました`
          : `${done.text} を${done.sameDay ? '当日キャンセルとして' : ''}取り消しました`}
      </p>
      {done.kind === 'staff' &&
        (result ?? (
          <p className="sub" aria-live="polite">
            振り直しを出しています…
          </p>
        ))}
    </>
  );
  const footer = (
    <>
      <button type="button" className="btn btn-primary" onClick={() => go(5)} data-testid="sudden-to-contacts">
        <WithIcon icon={ChevronRight}>次へ：連絡</WithIcon>
      </button>
      {done.kind === 'staff' && onRevert && (
        <button
          type="button"
          className="btn"
          disabled={running || busy}
          onClick={() =>
            void guarded(async () => {
              if (await onRevert()) onClose(false);
            })
          }
          data-testid="sudden-revert"
        >
          <WithIcon icon={Undo2}>振り直す前に戻す</WithIcon>
        </button>
      )}
      {done.kind === 'staff' && (
        <button type="button" className="btn" onClick={() => onClose(true)} data-testid="sudden-to-bar">
          <WithIcon icon={UserRoundCheck}>日の予定で差を見る</WithIcon>
        </button>
      )}
      {closeButton(s.close)}
    </>
  );
  return { body, footer };
}
