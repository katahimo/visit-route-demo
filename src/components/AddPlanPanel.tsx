import { Plus, X } from 'lucide-react';
import { planAddLabel } from '../lib/addPlan';
import { WEEKDAY_LABELS } from '../lib/common';
import {
  isRepeatChoice,
  repeatChoiceLabel,
  repeatChoiceOf,
  repeatChoices,
  toggleNumber,
  withRepeatChoice,
} from '../lib/patternForm';
import { FieldError, RequiredMark } from './FieldError';
import { MonthWeekChips } from './MonthWeekChips';
import { PlanCsvSection } from './PlanCsvSection';
import { SidePanel, WithIcon } from './ui';
import { useAddPlan } from './useAddPlan';
import { useFeatures } from './useFeature';
import { COMPACT_QUERY, useMedia } from './useMedia';
import './addPlan.css';
import './weekdayToggles.css';

/** 定期のくり返し（毎週〜4週ごと・毎月（第N））と第N のチップ（毎月のとき）と開始日（ADR-0083） */
function RepeatFields({ a }: { a: ReturnType<typeof useAddPlan> }) {
  const f = a.pform;
  return (
    <>
      <label>
        くり返し
        <select
          value={repeatChoiceOf(f)}
          onChange={(e) => isRepeatChoice(e.target.value) && a.setPform(withRepeatChoice(f, e.target.value))}
          data-testid="add-plan-repeat"
        >
          {repeatChoices(a.monthlyOn || f.repeat === 'monthly').map((c) => (
            <option key={c} value={c}>
              {repeatChoiceLabel(c)}
            </option>
          ))}
        </select>
      </label>
      {f.repeat === 'monthly' && (
        <fieldset className="add-plan-days" data-testid="add-plan-month-weeks" tabIndex={-1} {...a.bad('monthWeeks')}>
          <legend>
            第何週
            <RequiredMark />
          </legend>
          <div className="weekday-toggles">
            <MonthWeekChips weeks={f.monthWeeks} onChange={(monthWeeks) => a.setPform({ ...f, monthWeeks })} />
          </div>
          <span className="sub">第5は、その曜日が5回ある月だけ訪問を作ります。</span>
        </fieldset>
      )}
      <label>
        <span>
          開始日
          <RequiredMark />
        </span>
        <input
          type="date"
          required
          {...a.bad('from')}
          min={a.today}
          value={f.from}
          onChange={(e) => a.setPform({ ...f, from: e.target.value || f.from })}
          data-testid="add-plan-from"
        />
      </label>
    </>
  );
}

/** 欄（〈利用者さん〉・定期は曜日・くり返し・開始日／単発は日付、と時刻・所要） */
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
                  onClick={() => a.setPform({ ...a.pform, weekdays: toggleNumber(a.pform.weekdays, i) })}
                >
                  {w}
                </button>
              ))}
            </div>
          </fieldset>
          <RepeatFields a={a} />
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
 * 「定期の予定を追加」（単発のみは「予約を追加」）の引き出し（エキスパート機能が切のとき、月・週の主ボタン。PRD D402）：
 * 〈利用者さん〉を選び、定期は 曜日・くり返し（毎月なら第N）・開始日・時刻・所要（〈利用者さん〉の繰り返しを足す）、単発は 日付・時刻・所要（その日の訪問を足す）を入れて「追加」（閉じるは「閉じる」。日の訪問の欄と同じ言葉）。
 * 入れたら担当なしの分は自動で組む（ADR-0072）。入れ方は繰り返しを使うか（機能 patterns）で決まる。状態と保存は useAddPlan。
 * CSV の欄（PlanCsvSection。単発の訪問のテンプレート・書き出し・読み込み。ADR-0090）：単発は上に開いて「予約の CSV を読み込む」、定期は下に畳んで出す
 */
export function AddPlanPanel({ onClose }: { onClose: () => void }) {
  const a = useAddPlan(onClose);
  const features = useFeatures();
  const narrow = useMedia(COMPACT_QUERY);
  const noClients = a.clients.length === 0;
  const csv = <PlanCsvSection kind={a.kind} clientTerm={a.terms.client} onImported={onClose} />;
  return (
    <SidePanel
      icon={Plus}
      title={planAddLabel(features)}
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
            <WithIcon icon={Plus}>追加</WithIcon>
          </button>
          <button type="button" className="btn" onClick={onClose} data-testid="add-plan-close">
            <WithIcon icon={X}>閉じる</WithIcon>
          </button>
        </>
      }
    >
      <div className="add-plan stack" data-testid="add-plan" data-kind={a.kind}>
        {/* 単発は CSV の取り込みが主なので上に開いて出す（定期は下に畳む） */}
        {a.kind === 'oneOff' && csv}
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
        {a.kind === 'recurring' && csv}
      </div>
    </SidePanel>
  );
}
