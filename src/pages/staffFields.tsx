// 〈スタッフ〉の画面の節の中身（PRD D71・D299・D308〜D310。ADR-0015・ADR-0050）：基本の読む形と、
// 基本・ふだんの勤務・最終勤務日を直す入力欄

import { RequiredMark } from '../components/FieldError';
import { Check } from '../components/parts';
import { DlRow, StaffTravelRow } from '../components/personDetail';
import { StaffMark } from '../components/StaffMark';
import { Hint } from '../components/ui';
import { TRAVEL_MODES, type TravelMode } from '../contracts/codes';
import type { Staff } from '../contracts/documents';
import { addDays } from '../domain/time';
import { TRAVEL_MODE_LABELS, WEEKDAY_LABELS } from '../lib/common';
import { mdText } from '../lib/dateText';
import { surnameInitial } from '../lib/staffMark';
import { orDash } from '../lib/viewMode';
import type { SetStaffForm, StaffBadAttrs } from './useStaffEdit';

/** 入力欄の部品に共通の props */
type FieldsProps = { form: Staff; setForm: SetStaffForm; bad: StaffBadAttrs };

/** 基本の節の読む形（印・状態・メールアドレス・移動手段） */
export function StaffBasicView({ s }: { s: Staff }) {
  return (
    <>
      <div className="with-staff-mark" data-testid="view-staff-mark">
        <StaffMark staff={s} size="lg" />
        <span className="sub">{s.icon ? `アイコン「${s.icon}」` : 'アイコンは未設定（苗字の最初の1文字）'}</span>
      </div>
      <dl>
        <DlRow term="状態" value={s.active ? '利用中' : '休止中'} />
        <DlRow term="メールアドレス" value={orDash(s.email)} />
        <StaffTravelRow staff={s} />
      </dl>
    </>
  );
}

/** 基本の節の入力欄（名前・アイコン・メールアドレス・移動手段・利用中） */
export function StaffBasicFields({
  form,
  setForm,
  bad,
  previewColor,
}: FieldsProps & { previewColor: string | undefined }) {
  return (
    <>
      <div className="form-grid">
        <label>
          <span>
            名前
            <RequiredMark />
          </span>
          <input
            value={form.name}
            maxLength={50}
            required
            {...bad('name')}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            data-testid="staff-name"
          />
        </label>
        {/* アイコン（任意の1〜2文字。PRD D299。ADR-0050）。空なら苗字の最初の1文字を薄く出す */}
        <label>
          アイコン（1〜2文字・任意）
          <span className="staff-icon-field">
            <StaffMark staff={form} size="lg" color={previewColor} />
            <input
              value={form.icon}
              maxLength={32}
              autoComplete="off"
              placeholder={surnameInitial(form.name)}
              {...bad('icon')}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              data-testid="staff-icon"
            />
          </span>
          <span className="sub">印の中に出す文字（絵文字も可）。空なら苗字の最初の1文字</span>
        </label>
        <label>
          メールアドレス（任意）
          <input
            type="email"
            value={form.email}
            maxLength={254}
            autoComplete="off"
            placeholder="name@example.com"
            {...bad('email')}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            data-testid="staff-email"
          />
          <span className="sub">予定をメールアプリで開くときの宛先（送信は人が押します）</span>
        </label>
        <label>
          移動手段
          <select
            value={form.travelMode}
            onChange={(e) => setForm({ ...form, travelMode: e.target.value as TravelMode })}
          >
            {TRAVEL_MODES.map((t) => (
              <option key={t} value={t}>
                {TRAVEL_MODE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Check checked={form.active} onChange={(c) => setForm({ ...form, active: c })}>
        利用中（外すと休止）
      </Check>
    </>
  );
}

/** ふだんの勤務の入力欄（勤務の開始・終了・曜日） */
export function StaffHoursFields({ form, setForm, bad }: FieldsProps) {
  return (
    <>
      <div className="form-grid">
        <label>
          勤務開始
          <input
            type="time"
            step={1800}
            value={form.shiftStart}
            {...bad('shiftStart')}
            onChange={(e) => setForm({ ...form, shiftStart: e.target.value })}
            data-testid="staff-shift-start"
          />
        </label>
        <label>
          勤務終了
          <input
            type="time"
            step={1800}
            value={form.shiftEnd}
            {...bad('shiftEnd')}
            onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })}
            data-testid="staff-shift-end"
          />
        </label>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="sub">勤務する曜日</span>
        {WEEKDAY_LABELS.map((w, d) => (
          <Check
            key={w}
            checked={form.workDays.includes(d)}
            onChange={(c) =>
              setForm({
                ...form,
                workDays: c ? [...form.workDays, d].sort() : form.workDays.filter((x) => x !== d),
              })
            }
          >
            {w}
          </Check>
        ))}
      </div>
    </>
  );
}

/** 最終勤務日の入力欄（退職・担当替え。ADR-0015） */
export function StaffLastDayFields({
  form,
  setForm,
  bad,
  terms,
}: FieldsProps & { terms: { client: string; staff: string } }) {
  return (
    <>
      <Hint>
        <ul className="hint-list">
          <li>退職や担当替えで、この日を最後に勤務しなくなるときに入れます。</li>
          <li>翌日からは予定に入りません。</li>
          <li>
            保存すると、その人が担当している{terms.client}の代わりの{terms.staff}を選ぶ欄が開きます。
          </li>
        </ul>
      </Hint>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <label className="row" style={{ gap: 6 }}>
          最終勤務日
          <input
            type="date"
            value={form.lastDay ?? ''}
            {...bad('lastDay')}
            onChange={(e) => setForm({ ...form, lastDay: e.target.value || null })}
            data-testid="staff-lastday-input"
            style={{ width: 'auto' }}
          />
        </label>
        {form.lastDay && (
          <button type="button" className="btn btn-small" onClick={() => setForm({ ...form, lastDay: null })}>
            最終勤務日を消す
          </button>
        )}
        {form.lastDay && <span className="sub">{mdText(addDays(form.lastDay, 1))}から勤務なし</span>}
      </div>
    </>
  );
}
