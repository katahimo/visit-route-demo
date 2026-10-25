// 訪問の詳細の欄（VisitPanel）の入力の区画：何を・いつ（日時を変える）・担当・変える範囲
import type { DemoData } from '../contracts/data';
import type { Staff } from '../contracts/documents';
import { dateText } from '../lib/dateText';
import { typeOf } from '../lib/patternText';
import { SCOPE_LABELS, type ScopeTexts, type StaffChoices, type VisitDraft, type VisitScope } from '../lib/visitOps';
import { keptText, startPatch } from '../lib/visitPanelText';
import { type invalidAttrs, RequiredMark } from './FieldError';
import { StaffMark } from './StaffMark';
import { KEEP, NONE_PICK } from './useVisitPanel';
import { TypeDot } from './visitType';

/** 入力の欄の誤りの印（aria-invalid・aria-describedby） */
type Bad = (k: keyof VisitDraft) => ReturnType<typeof invalidAttrs>;

type DraftProps = {
  data: DemoData;
  draft: VisitDraft;
  set: (patch: Partial<VisitDraft>) => void;
  bad: Bad;
  isNew: boolean;
};

/** 〈利用者さん〉（新しい訪問だけ。利用中の人と、選んでいる人） */
function ClientField({ data, draft, set, bad }: DraftProps) {
  return (
    <label>
      <span>
        {data.org.terms.client}
        <RequiredMark />
      </span>
      <select
        value={draft.clientId}
        required
        {...bad('clientId')}
        onChange={(e) => set({ clientId: e.target.value })}
        data-testid="vp-client"
      >
        <option value="">選択してください</option>
        {data.clients
          .filter((c) => c.active || c.id === draft.clientId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
      </select>
    </label>
  );
}

/** 種類（新しい訪問は、種類を選ぶと所要をその種類の標準の所要にする） */
function TypeField({ data, draft, set, isNew }: DraftProps) {
  return (
    <label>
      <span className="row" style={{ gap: 6 }}>
        種類
        {typeOf(data.visitTypes, draft.typeId) && <TypeDot type={typeOf(data.visitTypes, draft.typeId)!} />}
      </span>
      <select
        value={draft.typeId ?? ''}
        onChange={(e) => {
          const t = typeOf(data.visitTypes, e.target.value);
          // 新しい訪問は、種類を選ぶと所要をその種類の標準の所要にする
          set({
            typeId: e.target.value || null,
            ...(isNew && t ? { durationMinutes: t.durationMinutes } : {}),
          });
        }}
        data-testid="vp-type"
      >
        <option value="">種類なし</option>
        {data.visitTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        {draft.typeId && !typeOf(data.visitTypes, draft.typeId) && <option value={draft.typeId}>（消えた種類）</option>}
      </select>
    </label>
  );
}

/** 時間の約束・開始時刻（幅を保ってずらす）・最も遅い開始時刻 */
function StartFields({ draft, set, bad }: DraftProps) {
  return (
    <>
      <label>
        時間の約束
        <select
          value={draft.windowKind}
          onChange={(e) => set({ windowKind: e.target.value as VisitDraft['windowKind'] })}
          data-testid="vp-window"
        >
          <option value="fixed">開始時刻が決まっている</option>
          <option value="window">開始に幅がある（受けられる時間帯）</option>
        </select>
      </label>
      <label>
        <span>
          {draft.windowKind === 'fixed' ? '開始時刻' : '最も早い開始時刻'}
          <RequiredMark />
        </span>
        <input
          type="time"
          value={draft.earliestStart}
          required
          {...bad('earliestStart')}
          onChange={(e) => set(startPatch(draft, e.target.value))}
          data-testid="vp-start"
        />
      </label>
      {draft.windowKind === 'window' && (
        <label>
          <span>
            最も遅い開始時刻
            <RequiredMark />
          </span>
          <input
            type="time"
            value={draft.latestStart}
            required
            {...bad('latestStart')}
            onChange={(e) => set({ latestStart: e.target.value })}
            data-testid="vp-latest"
          />
        </label>
      )}
    </>
  );
}

/** 何を・いつ（新しい訪問）／日時を変える */
export function VisitTimeFields(p: DraftProps & { today: string }) {
  const { draft, set, bad, isNew, today } = p;
  return (
    <fieldset className="vp-section" data-testid="vp-time">
      <legend>{isNew ? '何を・いつ' : '日時を変える'}</legend>
      <div className="form-grid">
        {isNew && <ClientField {...p} />}
        <TypeField {...p} />
        <label>
          <span>
            日付
            <RequiredMark />
          </span>
          <input
            type="date"
            value={draft.date}
            min={today}
            required
            {...bad('date')}
            onChange={(e) => set({ date: e.target.value || draft.date })}
            data-testid="vp-date"
          />
        </label>
        <StartFields {...p} />
        <label>
          <span>
            所要時間（分）
            <RequiredMark />
          </span>
          <input
            type="number"
            min={5}
            max={720}
            value={Number.isFinite(draft.durationMinutes) ? draft.durationMinutes : ''}
            required
            {...bad('durationMinutes')}
            onChange={(e) => set({ durationMinutes: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
            data-testid="vp-duration"
          />
        </label>
        <label>
          メモ
          <input
            value={draft.note}
            maxLength={200}
            {...bad('note')}
            onChange={(e) => set({ note: e.target.value })}
            data-testid="vp-note"
          />
        </label>
      </div>
    </fieldset>
  );
}

/** 担当（新しい訪問）／担当を替える：変えない・候補の人・担当なし */
export function VisitStaffFields({
  isNew,
  draftDate,
  visitDate,
  choices,
  pick,
  setPick,
  staffById,
}: {
  isNew: boolean;
  draftDate: string;
  /** 開いた訪問の日（新しい訪問は無し） */
  visitDate: string | undefined;
  choices: StaffChoices;
  pick: string;
  setPick: (p: string) => void;
  staffById: ReadonlyMap<string, Staff>;
}) {
  const current = choices.currentStaffId;
  const staffName = (id: string | null) => (id ? (staffById.get(id)?.name ?? '（不明）') : '');
  return (
    <fieldset className="vp-section" data-testid="vp-staff">
      <legend>
        {isNew ? '担当' : '担当を替える'}
        {draftDate !== visitDate && !isNew && <span className="sub">（{dateText(draftDate)}の候補）</span>}
      </legend>
      {choices.why && <p className="sub">{choices.why}</p>}
      <div className="vp-choices" role="radiogroup" aria-label="担当">
        <label className="vp-choice">
          <input
            type="radio"
            name="vp-staff"
            checked={pick === KEEP}
            onChange={() => setPick(KEEP)}
            data-testid="vp-staff-keep"
          />
          <span className="vp-choice-text">
            <span className="vp-choice-name">
              {isNew ? '選ばない（担当なし。あとで AI で組める）' : '変えない'}
              {!isNew && current && <span className="sub">（今：{staffName(current)}）</span>}
            </span>
          </span>
        </label>
        {choices.choices
          .filter((c) => !c.current)
          .map((c) => {
            const off = !!c.disabled;
            return (
              <label
                key={c.staffId}
                className={`vp-choice${off ? ' is-off' : ''}`}
                title={c.disabled || undefined}
                data-testid="vp-staff-choice"
                data-staff={c.staffId}
              >
                <input
                  type="radio"
                  name="vp-staff"
                  checked={pick === c.staffId}
                  disabled={off}
                  onChange={() => setPick(c.staffId)}
                />
                <span className="vp-choice-text">
                  <span className="vp-choice-name with-staff-mark">
                    <StaffMark staff={staffById.get(c.staffId)} size="xs" />
                    {staffName(c.staffId)}
                  </span>
                  <span className="sub vp-choice-desc">{c.disabled || c.description}</span>
                </span>
              </label>
            );
          })}
        {!isNew && current && (
          <label className="vp-choice">
            <input
              type="radio"
              name="vp-staff"
              checked={pick === NONE_PICK}
              onChange={() => setPick(NONE_PICK)}
              data-testid="vp-staff-none"
            />
            <span className="vp-choice-text">
              <span className="vp-choice-name">担当なし（入らなかった訪問へ）</span>
              <span className="sub vp-choice-desc">ピンも外れます（この回だけ）</span>
            </span>
          </label>
        )}
      </div>
      <p className="sub">選んだ人にピンが付き、AI で組んでも担当は変わりません。</p>
    </fieldset>
  );
}

/** 変える範囲（繰り返しの回：この回だけ・これ以降・すべて） */
export function VisitScopeFields({
  scopes,
  scope,
  setScope,
}: {
  scopes: ScopeTexts;
  scope: VisitScope;
  setScope: (s: VisitScope) => void;
}) {
  return (
    <fieldset className="vp-section" data-testid="vp-scope">
      <legend>変える範囲（繰り返しの回です）</legend>
      {(['once', 'following', 'all'] as const).map((k) => (
        <label key={k} className="check">
          <input
            type="radio"
            name="vp-scope"
            checked={scope === k}
            onChange={() => setScope(k)}
            style={{ width: 'auto' }}
            data-testid={`vp-scope-${k}`}
          />
          {SCOPE_LABELS[k]}
          {k === 'following' && <span className="sub">（{scopes.following}）</span>}
          {k === 'all' && <span className="sub">（{scopes.all}）</span>}
        </label>
      ))}
      {scope !== 'once' && (
        <p className="sub" data-testid="vp-scope-note">
          {scopes.otherDays ? 'ほかの曜日の回は変えません。' : ''}
          {keptText(scope === 'all' ? scopes.keptDates.all : scopes.keptDates.following)}
          担当を選ぶと、範囲の回の担当といつもの担当も替わります。
        </p>
      )}
    </fieldset>
  );
}
