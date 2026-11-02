// 〈利用者さん〉の繰り返し（定期パターン。ADR-0012・0013・0028・0062）を足す・直す欄：種類と繰り返し方・曜日・第何週・時刻と期間と担当・
// 曜日ごとの時刻・曜日ごとの標準の開始。欄の中身の確かめは lib/patternForm、保存の処理は usePatternsFlow
import { CalendarClock, Check, Trash2, X } from 'lucide-react';
import { enterToSave, FieldError } from '../components/FieldError';
import { MonthWeekChips } from '../components/MonthWeekChips';
import { WithIcon } from '../components/ui';
import '../components/weekdayToggles.css';
import type { Pattern, Staff, VisitType } from '../contracts/documents';
import { WEEKDAY_LABELS } from '../lib/common';
import {
  isRepeatChoice,
  type PatternForm,
  repeatChoiceLabel,
  repeatChoiceOf,
  repeatChoices,
  sortedWeekdays,
  toggleNumber,
  withRepeatChoice,
} from '../lib/patternForm';
import { typeOf } from '../lib/patternText';

/** 欄の値と書き換え（どの区画も同じ） */
type FieldsProps = { form: PatternForm; setForm: (f: PatternForm) => void };

/** 種類と繰り返し方・曜日・第何週（毎月のとき） */
function PatternRepeatFields({
  form,
  setForm,
  visitTypes,
  monthlyOn,
  monthlyOffId,
  daysLocked,
}: FieldsProps & {
  visitTypes: readonly VisitType[];
  monthlyOn: boolean;
  monthlyOffId: string;
  daysLocked: boolean;
}) {
  const toggleDay = (w: number) => setForm({ ...form, weekdays: toggleNumber(form.weekdays, w) });
  return (
    <>
      <div className="form-grid">
        <label>
          種類
          <select
            value={form.typeId}
            onChange={(e) => {
              const t = typeOf(visitTypes, e.target.value);
              // 種類を選ぶと所要の初期値をその種類の標準の所要にする
              setForm({
                ...form,
                typeId: e.target.value,
                ...(t ? { durationMinutes: String(t.durationMinutes) } : {}),
              });
            }}
          >
            <option value="">種類なし</option>
            {visitTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          繰り返し
          <select
            disabled={!monthlyOn && form.repeat === 'monthly'}
            aria-describedby={!monthlyOn && form.repeat === 'monthly' ? monthlyOffId : undefined}
            value={repeatChoiceOf(form)}
            onChange={(e) => isRepeatChoice(e.target.value) && setForm(withRepeatChoice(form, e.target.value))}
            data-testid="pattern-repeat"
          >
            {repeatChoices(monthlyOn || form.repeat === 'monthly').map((c) => (
              <option key={c} value={c}>
                {repeatChoiceLabel(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!monthlyOn && (form.repeat === 'monthly' || form.perDay) && (
        <span className="sub" id={monthlyOffId} data-testid="pattern-monthly-off">
          毎月の第N週・曜日ごとの時刻は管理者設定で切っています（読むだけです。訪問は今どおり作られます）
        </span>
      )}
      <div className="stack" style={{ gap: 4 }}>
        <span className="sub">曜日（1つ以上）</span>
        <fieldset className="weekday-toggles" aria-label="曜日" data-testid="pattern-weekdays">
          {WEEKDAY_LABELS.map((w, i) => (
            <button
              key={w}
              type="button"
              className={`weekday-toggle${form.weekdays.includes(i) ? ' is-on' : ''}`}
              aria-pressed={form.weekdays.includes(i)}
              // 曜日ごとの時刻を切っているとき、曜日を足すと黙って共通の時刻になるので押せない（読むだけ。ADR-0028）
              disabled={daysLocked}
              aria-describedby={daysLocked ? monthlyOffId : undefined}
              onClick={() => toggleDay(i)}
            >
              {w}
            </button>
          ))}
        </fieldset>
      </div>
      {form.repeat === 'monthly' && (
        <div className="stack" style={{ gap: 4 }}>
          <span className="sub">第何週（1つ以上。例：第3・第4の木曜）</span>
          <fieldset className="weekday-toggles" aria-label="第何週" data-testid="pattern-month-weeks">
            <MonthWeekChips
              weeks={form.monthWeeks}
              onChange={(monthWeeks) => setForm({ ...form, monthWeeks })}
              disabled={!monthlyOn}
            />
          </fieldset>
          <span className="sub">第5は、その曜日が5回ある月だけ訪問を作ります。</span>
        </div>
      )}
    </>
  );
}

/** 時間の決め方・開始・所要・いつから（開始日）・終了日・担当・メモ */
function PatternTimeFields({ form, setForm, staff, today }: FieldsProps & { staff: readonly Staff[]; today: string }) {
  return (
    <div className="form-grid">
      <label>
        時間の決め方
        <select
          value={form.windowKind}
          onChange={(e) => setForm({ ...form, windowKind: e.target.value as Pattern['windowKind'] })}
        >
          <option value="fixed">ちょうど</option>
          <option value="window">幅（この間に開始）</option>
        </select>
      </label>
      <label>
        {form.windowKind === 'fixed' ? '開始' : '開始（早）'}
        <input
          type="time"
          value={form.earliestStart}
          onChange={(e) => setForm({ ...form, earliestStart: e.target.value })}
        />
      </label>
      {form.windowKind === 'window' && (
        <label>
          開始（遅）
          <input
            type="time"
            value={form.latestStart}
            onChange={(e) => setForm({ ...form, latestStart: e.target.value })}
          />
        </label>
      )}
      <label>
        所要（分）
        <input
          type="number"
          min={5}
          max={720}
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
        />
      </label>
      {form.id ? (
        <label>
          <WithIcon icon={CalendarClock} size={14}>
            いつから変えますか
          </WithIcon>
          <input
            type="date"
            min={today}
            value={form.since}
            onChange={(e) => setForm({ ...form, since: e.target.value })}
          />
        </label>
      ) : (
        <label>
          開始日
          <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value || today })} />
        </label>
      )}
      <label>
        終了日（空＝続く）
        <input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
      </label>
      <label>
        担当（いつもの担当）
        <select
          value={form.usualStaffId}
          onChange={(e) => setForm({ ...form, usualStaffId: e.target.value })}
          data-testid="pattern-staff"
        >
          <option value="">担当なし（AI で組む）</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.active ? '' : '（休止中）'}
            </option>
          ))}
        </select>
      </label>
      <label>
        メモ
        <input value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </label>
    </div>
  );
}

/** 曜日ごとの時刻（切っているときは今の値を読むだけで出す） */
function PatternDayTimes({ form, setForm, monthlyOn }: FieldsProps & { monthlyOn: boolean }) {
  const startLabel = form.windowKind === 'fixed' ? '開始' : '開始（早）';
  return (
    <div className="stack" style={{ gap: 4 }} hidden={!monthlyOn && !form.perDay}>
      <label className="check">
        <input
          type="checkbox"
          disabled={!monthlyOn}
          checked={form.perDay}
          onChange={(e) => setForm({ ...form, perDay: e.target.checked })}
          data-testid="pattern-per-day"
        />
        曜日ごとに時刻を変える（例：月曜は 9:30、木曜は 15:00）
      </label>
      {form.perDay &&
        (form.weekdays.length === 0 ? (
          <span className="sub">先に曜日を選んでください</span>
        ) : (
          <div className="pattern-daytimes" data-testid="pattern-daytimes">
            <div className="row pattern-daytime sub" aria-hidden="true">
              <span className="pattern-daytime-day">曜日</span>
              <span className="pattern-daytime-col">{startLabel}</span>
              {form.windowKind === 'window' && <span className="pattern-daytime-col">開始（遅）</span>}
            </div>
            {sortedWeekdays(form).map((w) => {
              const t = form.dayTimes[w] ?? { earliestStart: '', latestStart: '' };
              const set = (patch: Partial<typeof t>) =>
                setForm({ ...form, dayTimes: { ...form.dayTimes, [w]: { ...t, ...patch } } });
              return (
                <div key={w} className="row pattern-daytime">
                  <strong className="pattern-daytime-day">{WEEKDAY_LABELS[w]}</strong>
                  <label className="pattern-daytime-col">
                    <span className="sr-only">
                      {WEEKDAY_LABELS[w]}曜の{startLabel}
                    </span>
                    <input
                      type="time"
                      value={t.earliestStart}
                      disabled={!monthlyOn}
                      onChange={(e) => set({ earliestStart: e.target.value })}
                    />
                  </label>
                  {form.windowKind === 'window' && (
                    <label className="pattern-daytime-col">
                      <span className="sr-only">{WEEKDAY_LABELS[w]}曜の開始（遅）</span>
                      <input
                        type="time"
                        value={t.latestStart}
                        disabled={!monthlyOn}
                        onChange={(e) => set({ latestStart: e.target.value })}
                      />
                    </label>
                  )}
                </div>
              );
            })}
            <span className="sub">
              空の曜日は、上の共通の時刻です。
              {form.windowKind === 'window' && '開始（遅）が空なら、共通の時刻と同じ幅にします。'}
            </span>
          </div>
        ))}
    </div>
  );
}

/** 曜日ごとの標準の開始（ADR-0062。曜日を選んでいるときだけ） */
function PatternUsualStarts({ form, setForm }: FieldsProps) {
  if (form.weekdays.length === 0) return null;
  const set = (w: number, start: string) => setForm({ ...form, usualStarts: { ...form.usualStarts, [w]: start } });
  return (
    <div className="stack" style={{ gap: 4 }}>
      <span className="sub">
        曜日ごとの標準の開始（空＝なし。開始（早）〜（遅）の間。組んだ開始の初期値になります）
      </span>
      <div className="pattern-daytimes" data-testid="pattern-usual-starts-form">
        {sortedWeekdays(form).map((w) => (
          <div key={w} className="row pattern-daytime">
            <strong className="pattern-daytime-day">{WEEKDAY_LABELS[w]}</strong>
            <label className="pattern-daytime-col">
              <span className="sr-only">{WEEKDAY_LABELS[w]}曜の標準の開始</span>
              <input type="time" value={form.usualStarts[w] ?? ''} onChange={(e) => set(w, e.target.value)} />
            </label>
            {form.usualStarts[w] && (
              <button
                type="button"
                className="btn btn-small btn-text"
                aria-label={`${WEEKDAY_LABELS[w]}曜の標準の開始を消す`}
                onClick={() => set(w, '')}
              >
                消す
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 足す・直す欄（保存・取り消し・直すときは消す） */
export function PatternEditForm({
  form,
  setForm,
  visitTypes,
  staff,
  today,
  monthlyOn,
  monthlyOffId,
  daysLocked,
  errorState,
  error,
  onSave,
  onCancel,
  onRemove,
}: FieldsProps & {
  visitTypes: readonly VisitType[];
  staff: readonly Staff[];
  today: string;
  monthlyOn: boolean;
  monthlyOffId: string;
  daysLocked: boolean;
  /** FieldError の token と文 */
  errorState: { text: string } | null;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  /** 直している繰り返しを消す */
  onRemove: () => void;
}) {
  return (
    <fieldset className="pattern-form stack" data-testid="pattern-form" onKeyDown={enterToSave(onSave)}>
      <legend>{form.id ? '繰り返しを直す' : '繰り返しを足す'}</legend>
      <PatternRepeatFields
        form={form}
        setForm={setForm}
        visitTypes={visitTypes}
        monthlyOn={monthlyOn}
        monthlyOffId={monthlyOffId}
        daysLocked={daysLocked}
      />
      <PatternTimeFields form={form} setForm={setForm} staff={staff} today={today} />
      <PatternDayTimes form={form} setForm={setForm} monthlyOn={monthlyOn} />
      <PatternUsualStarts form={form} setForm={setForm} />
      {form.id && (
        <span className="sub">
          「いつから」より前の訪問と、この回だけ変えた訪問・取り消した訪問は変えません。それ以外の訪問を新しい中身で作り直します。
        </span>
      )}
      <FieldError token={errorState}>{error}</FieldError>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-small btn-primary" onClick={onSave} data-testid="pattern-save">
          <WithIcon icon={Check} size={14}>
            保存
          </WithIcon>
        </button>
        <button type="button" className="btn btn-small" onClick={onCancel} data-testid="pattern-cancel">
          <WithIcon icon={X} size={14}>
            取り消し
          </WithIcon>
        </button>
        {form.id && (
          <button type="button" className="btn btn-small btn-danger" onClick={onRemove} data-testid="pattern-remove">
            <WithIcon icon={Trash2} size={14}>
              この繰り返しを消す
            </WithIcon>
          </button>
        )}
      </div>
    </fieldset>
  );
}
