import { Check, Plus, X } from 'lucide-react';
import { toggleWeekday } from '../lib/addPlan';
import { WEEKDAY_LABELS } from '../lib/common';
import { EVERY_WEEKS_LABELS } from '../lib/patternText';
import { FieldError, RequiredMark } from './FieldError';
import { SidePanel, WithIcon } from './ui';
import { useAddPlan } from './useAddPlan';
import { COMPACT_QUERY, useMedia } from './useMedia';
import './addPlan.css';
import './weekdayToggles.css';

/** 欄（〈利用者さん〉・定期は曜日とくり返し／単発は日付・時刻・所要） */
function AddPlanFields({ a }: { a: ReturnType<typeof useAddPlan> }) {
  return (
    <div className="form-grid">
      <label>
        <span>
          {a.terms.client}
          <RequiredMark />
        </span>
        <select
          value={a.clientId}
          required
          {...a.bad('client')}
          onChange={(e) => a.setClientId(e.target.value)}
          data-testid="add-plan-client"
        >
          {a.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </label>
      {a.kind === 'recurring' ? (
        <>
          <fieldset className="add-plan-days" data-testid="add-plan-weekdays" tabIndex={-1} {...a.bad('weekdays')}>
            <legend>
              曜日
              <RequiredMark />
            </legend>
            <div className="weekday-toggles">
              {WEEKDAY_LABELS.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  className={`weekday-toggle${a.pform.weekdays.includes(i) ? ' is-on' : ''}`}
                  aria-pressed={a.pform.weekdays.includes(i)}
                  onClick={() => a.setPform({ ...a.pform, weekdays: toggleWeekday(a.pform.weekdays, i) })}
                >
                  {w}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            くり返し
            <select
              value={a.pform.everyWeeks}
              onChange={(e) => a.setPform({ ...a.pform, everyWeeks: Number(e.target.value) })}
              data-testid="add-plan-repeat"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {EVERY_WEEKS_LABELS[n]}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label>
          <span>
            日付
            <RequiredMark />
          </span>
          <input
            type="date"
            required
            {...a.bad('date')}
            min={a.today}
            value={a.draft.date}
            onChange={(e) => a.setDraft({ ...a.draft, date: e.target.value || a.draft.date })}
            data-testid="add-plan-date"
          />
        </label>
      )}
      <label>
        <span>
          時刻
          <RequiredMark />
        </span>
        <input
          type="time"
          required
          {...a.bad('start')}
          value={a.draft.earliestStart}
          onChange={(e) => a.setStart(e.target.value)}
          data-testid="add-plan-start"
        />
      </label>
      <label>
        <span>
          所要（分）
          <RequiredMark />
        </span>
        <input
          type="number"
          required
          {...a.bad('duration')}
          min={5}
          max={720}
          value={Number.isFinite(a.draft.durationMinutes) ? a.draft.durationMinutes : ''}
          onChange={(e) => a.setDuration(e.target.value)}
          data-testid="add-plan-duration"
        />
      </label>
    </div>
  );
}

/**
 * 「予定を入れる」の引き出し（エキスパート機能が切のとき、月・週の主ボタン。PRD D388。試作 simple-flow の panelHTML の add）：
 * 〈利用者さん〉を選び、定期は 曜日・くり返し・時刻・所要（〈利用者さん〉の繰り返しを足す）、単発は 日付・時刻・所要（その日の訪問を足す）を入れて「入れる」。
 * 入れたら担当なしの分は自動で組む（ADR-0072）。入れ方は繰り返しを使うか（機能 patterns）で決まる。状態と保存は useAddPlan
 */
export function AddPlanPanel({ onClose }: { onClose: () => void }) {
  const a = useAddPlan(onClose);
  const narrow = useMedia(COMPACT_QUERY);
  const noClients = a.clients.length === 0;
  return (
    <SidePanel
      icon={Plus}
      title="予定を入れる"
      narrow
      sheet={narrow}
      onClose={onClose}
      onSubmit={() => (noClients ? undefined : a.save())}
      footer={
        <>
          <button
            type="submit"
            className="btn btn-primary"
            aria-disabled={noClients || undefined}
            data-testid="add-plan-save"
          >
            <WithIcon icon={Check}>入れる</WithIcon>
          </button>
          <button type="button" className="btn" onClick={onClose} data-testid="add-plan-close">
            <WithIcon icon={X}>やめる</WithIcon>
          </button>
        </>
      }
    >
      <div className="add-plan stack" data-testid="add-plan" data-kind={a.kind}>
        {noClients ? (
          <p className="sub" data-testid="add-plan-none">
            先に{a.terms.client}を入れてください。
          </p>
        ) : (
          <AddPlanFields a={a} />
        )}
        <FieldError id={a.errorId} token={a.errorState}>
          {a.errorState?.text}
        </FieldError>
      </div>
    </SidePanel>
  );
}
