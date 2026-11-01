// 「欠勤・キャンセル」の欄の1段目「何が起きたか」の中身と下の帯（PRD D167〜D172・D264・D265・D414。ADR-0044・ADR-0082）。
// 種類・人（訪問）・時間を選んだ時点で見込みとおすすめの振り直しを出し、［この案で決める］で登録と振り直しを1手で書く。
// 状態と処理は useSuddenSteps、2段目は suddenContactStep.tsx、欄の枠は SuddenPanel
import { Ban, CalendarX2, Check, Trash2, UserRoundX, X } from 'lucide-react';
import { WithIcon } from '../components/ui';
import type { Terms } from '../contracts/documents';
import { absenceText } from '../lib/absences';
import { cancelImpact, impactText, noPlanText, previewLine, SUDDEN_HEADINGS, type SuddenKind } from '../lib/sudden';
import { AbsenceFields, ReassignMoves } from './absenceParts';
import { StayWeight } from './reassignParts';
import type { StepCtx, StepView } from './useSuddenSteps';

/** 段の見出し（段を進めたらここへフォーカス） */
export const stepHeading = (text: string) => (
  <h3 className="sudden-step-title" tabIndex={-1} data-return-focus>
    {text}
  </h3>
);

export const closeButton = (close: () => void) => (
  <button type="button" className="btn" onClick={close} data-testid="sudden-close">
    <WithIcon icon={X}>閉じる</WithIcon>
  </button>
);

/** 何が起きたか（〈スタッフ〉が休む／〈利用者さん〉がキャンセル）。種類を変えると前の選択を消す */
function KindChoice({
  terms,
  kind,
  onChoose,
  disabled,
}: {
  terms: Terms;
  kind: SuddenKind | null;
  onChoose: (k: SuddenKind) => void;
  /** 計算中は選び直させない */
  disabled: boolean;
}) {
  const items = [
    { k: 'staff', icon: UserRoundX, text: `${terms.staff}が休む` },
    { k: 'client', icon: CalendarX2, text: `${terms.client}がキャンセル` },
  ] as const;
  return (
    <fieldset className="segmented sudden-kind" aria-label="何が起きたか">
      {items.map((x) => (
        <button
          key={x.k}
          type="button"
          aria-pressed={kind === x.k}
          className={kind === x.k ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => onChoose(x.k)}
          data-testid={`sudden-kind-${x.k}`}
        >
          <WithIcon icon={x.icon}>{x.text}</WithIcon>
        </button>
      ))}
    </fieldset>
  );
}

/** 1段目：何が起きたか（種類・人（訪問）・時間）と、見込み・おすすめの振り直し */
export function whatStep(ctx: StepCtx): StepView {
  const { p, s } = ctx;
  const body = (
    <>
      {stepHeading(SUDDEN_HEADINGS[1])}
      <KindChoice terms={p.terms} kind={s.kind} onChoose={s.chooseKind} disabled={s.locked} />
      {s.kind === 'staff' ? staffBody(ctx) : s.kind === 'client' ? clientBody(ctx) : null}
    </>
  );
  const footer = s.kind === 'staff' ? staffFooter(ctx) : s.kind === 'client' ? clientFooter(ctx) : closeButton(s.close);
  return { body, footer };
}

/** 欠勤だけ登録（振り直さない）。振り直せない日は主ボタン */
function saveOnlyButton({ p, s }: StepCtx, primary: boolean) {
  const { absence, error, locked, saveOnlyNow } = s;
  return (
    <button
      type="button"
      className={primary ? 'btn btn-primary' : 'btn btn-text'}
      disabled={!absence || !!error || locked}
      title={p.running ? '計算中は押せません' : undefined}
      onClick={saveOnlyNow}
      data-testid="sudden-save-only"
    >
      欠勤だけ登録（振り直さない）
    </button>
  );
}

/** 〈スタッフ〉が休む：人・その日の欠勤・時間・見込み */
function staffBody(ctx: StepCtx) {
  const { p, s } = ctx;
  const { terms, staffList, date, onRemoveAbsence } = p;
  const { staffId, pickStaff, draft, setDraft, baseSlots, existing, error, busy, locked, guarded } = s;
  return (
    <>
      {staffList.length === 0 ? (
        <p className="sub">この日に働く{terms.staff}がいません</p>
      ) : (
        <label className="field">
          <span className="field-label">休む人</span>
          <select
            value={staffId}
            disabled={locked}
            onChange={(e) => pickStaff(e.target.value)}
            data-testid="sudden-staff"
          >
            <option value="">選んでください</option>
            {staffList.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {/* 登録済みの欠勤は、人を選ぶと出して直せる（PRD D414） */}
      {existing && (
        <p className="row sudden-existing" style={{ gap: 8, flexWrap: 'wrap' }} data-testid="sudden-existing">
          <span>
            この日の欠勤：{absenceText(existing, baseSlots)}
            {existing.note ? `（${existing.note}）` : ''}
          </span>
          <button
            type="button"
            className="btn btn-small btn-danger"
            disabled={busy}
            onClick={() =>
              void guarded(async () => {
                await onRemoveAbsence(existing);
              })
            }
            data-testid="sudden-remove"
          >
            <WithIcon icon={Trash2} size={14}>
              欠勤を取り消す
            </WithIcon>
          </button>
        </p>
      )}
      {staffId && (
        <AbsenceFields
          key={staffId}
          draft={draft}
          onChange={(x) => setDraft((cur) => ({ ...cur, ...x }))}
          baseSlots={baseSlots}
          date={date}
          error={error}
          disabled={locked}
        />
      )}
      {staffId && !error && absencePlan(ctx)}
      {/* 見込みの1行だけを読み上げる（前から置いておく小さな欄。ボタン・「ほかのやり方」を含む中身ごとは読み上げない） */}
      <p className="sr-only" aria-live="polite" data-testid="sudden-live">
        {previewLine(staffId && !error ? s.preview : undefined, p.running)}
      </p>
    </>
  );
}

/** 見込み：入らなくなる訪問・おすすめ・担当が移る訪問の一覧（D265）・ほかのやり方（PRD D264・D414） */
function absencePlan(ctx: StepCtx) {
  const { p, s } = ctx;
  const { preview, recommended, blocked } = s;
  if (!preview) return <p className="sub">見込みを出せませんでした</p>;
  if (!preview.hasBase)
    return (
      <p className="warn-text" data-testid="sudden-no-plan">
        {noPlanText(p.running)}
      </p>
    );
  const impact = impactText(preview.targets);
  return (
    <div className="stack sudden-plan" style={{ gap: 8 }} data-testid="absence-preview">
      <strong className="sudden-impact" data-testid="sudden-impact">
        {impact.title}
      </strong>
      {preview.targets.length > 0 && (
        <p className="sudden-recommend" data-testid="sudden-recommend">
          {recommended
            ? `おすすめ：案A では ${preview.unplacedA}件入りません。決めたあと、ほかの人の訪問も少し動かす案B を作って比べます`
            : 'おすすめ：空き時間に入れます（案A。ほかの人の担当・順番・時刻は変えません）'}
        </p>
      )}
      {preview.diff && preview.targets.length > 0 && (
        <ReassignMoves diff={preview.diff} visitLabel={p.visitLabel} staffName={p.staffName} />
      )}
      {blocked && <p className="sub">押せません：{blocked}</p>}
      <details className="sudden-alt" data-testid="sudden-alt">
        <summary>ほかのやり方</summary>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {reassignButton(ctx, !recommended, false)}
            {saveOnlyButton(ctx, false)}
          </div>
          <StayWeight weight={p.weight} onWeight={p.onWeight} />
        </div>
      </details>
    </div>
  );
}

/** 振り直しのボタン（主ボタンは［この案で決める］。もう一方の案は「ほかのやり方」の文字のボタン） */
function reassignButton({ s }: StepCtx, anneal: boolean, primary: boolean) {
  const { blocked, busy, reassignNow } = s;
  return (
    <button
      type="button"
      className={primary ? 'btn btn-primary' : 'btn btn-text'}
      disabled={!!blocked || busy}
      title={blocked ?? undefined}
      onClick={() => void reassignNow(anneal)}
      data-testid={primary ? 'sudden-decide' : anneal ? 'sudden-anneal' : 'sudden-reassign'}
    >
      {primary ? <WithIcon icon={Check}>この案で決める</WithIcon> : anneal ? '案B も作る' : '案A だけで振り直す'}
    </button>
  );
}

function staffFooter(ctx: StepCtx) {
  const { s } = ctx;
  return (
    <>
      {s.primary === 'reassign'
        ? reassignButton(ctx, s.recommended, true)
        : s.primary === 'saveOnly'
          ? saveOnlyButton(ctx, true)
          : null}
      {closeButton(s.close)}
    </>
  );
}

/** 〈利用者さん〉がキャンセル：訪問・取り消しの種類・影響 */
function clientBody({ p, s }: StepCtx) {
  const { terms, visitList, visitInfo, hasPlan } = p;
  const { visitId, setVisitId, sameDay, setSameDay, locked } = s;
  const info = visitId ? visitInfo(visitId) : null;
  return (
    <>
      {visitList.length === 0 ? (
        <p className="sub">この日に取り消せる訪問がありません</p>
      ) : (
        <label className="field">
          <span className="field-label">訪問</span>
          <select
            value={visitId}
            disabled={locked}
            onChange={(e) => setVisitId(e.target.value)}
            data-testid="sudden-visit"
          >
            <option value="">選んでください</option>
            {visitList.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="stack cancel-kind" style={{ gap: 6 }} disabled={locked}>
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
      {info && (
        <ul className="sudden-targets" aria-live="polite" data-testid="sudden-cancel-impact">
          {cancelImpact({ owner: info.owner, sameDay, clientWord: terms.client, hasPlan }).map((x) => (
            <li key={x} className="sub">
              {x}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function clientFooter({ s }: StepCtx) {
  return (
    <>
      <button
        type="button"
        className="btn btn-danger"
        disabled={!s.visitId}
        onClick={s.cancelNow}
        data-testid="sudden-cancel-ok"
      >
        <WithIcon icon={Ban}>{s.sameDay ? '当日キャンセルとして取り消す' : '取り消す'}</WithIcon>
      </button>
      {closeButton(s.close)}
    </>
  );
}
