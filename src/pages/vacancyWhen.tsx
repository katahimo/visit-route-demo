import { type ReactNode, useId } from 'react';
import { ConditionsEditor } from '../components/conditions';
import { FieldError, invalidAttrs } from '../components/FieldError';
import { Hint } from '../components/ui';
import '../components/weekdayToggles.css';
import type { DemoData } from '../contracts/data';
import { VACANCY_DURATION_MAX, VACANCY_DURATION_MIN, VACANCY_WEEKS_MAX, VACANCY_WEEKS_MIN } from '../contracts/vacancy';
import { HALF_HOURS, timeText } from '../domain/availability';
import { WEEKDAY_LABELS } from '../lib/common';
import { typeOf } from '../lib/patternText';
import { bandText, DURATION_CHIPS, toggleBand, WISH_BANDS } from '../lib/vacancyBands';
import { NO_TYPE_TEXT } from '../lib/vacancyView';
import type { VacancyInputState } from './useVacancyInput';
import { ROW_WEEKDAYS, StepNo } from './vacancyParts';

// 空き状況の段階1「いつ・何を」（PRD D184・D411。ADR-0080）：曜日・時間帯・所要のチップと、畳んだ「くわしい条件」

/** チップ1つ（押すと入切。aria-pressed） */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      className={`weekday-toggle vacancy-chip${on ? ' is-on' : ''}`}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** チップの1行（見出し＋並び） */
function ChipRow({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div className="stack vacancy-chip-row">
      <span className="sub">{label}</span>
      <fieldset className="weekday-toggles" aria-label={label} data-testid={testId}>
        {children}
      </fieldset>
    </div>
  );
}

/** 1 いつ・何を（PRD D184・D411）。押すとすぐ下の結果が変わる（自動で計算し直すので主ボタンは無い） */
export function WhenStage({
  data,
  input,
  durationOk,
  fromOk,
  wishOk,
}: {
  data: Pick<DemoData, 'visitTypes' | 'items' | 'org'>;
  input: VacancyInputState;
  durationOk: boolean;
  fromOk: boolean;
  wishOk: boolean;
}) {
  const { duration, setDuration, wishDays, setWishDays, wishBands, setWishBands } = input;
  /** 入力の誤りの文の id（入力欄の aria-describedby。PRD D250） */
  const errIds = { duration: useId(), from: useId(), wish: useId() };
  const toggleDay = (w: number) =>
    setWishDays(wishDays.includes(w) ? wishDays.filter((x) => x !== w) : [...wishDays, w]);
  return (
    <section className="card stack vacancy-stage" data-testid="vacancy-step-when">
      <div className="section-title">
        <h2>
          <StepNo n={1} />
          いつ・何を
        </h2>
      </div>
      <ChipRow label="曜日（選ばない＝どの曜日でも）" testId="wish-days">
        {ROW_WEEKDAYS.map((w) => (
          <Chip key={w} on={wishDays.includes(w)} onClick={() => toggleDay(w)}>
            {WEEKDAY_LABELS[w]!}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label="時間帯（始める時刻。複数可）" testId="wish-bands">
        <Chip on={wishBands.length === 0} onClick={() => setWishBands([])}>
          指定なし
        </Chip>
        {WISH_BANDS.map((b) => (
          <Chip key={b.id} on={wishBands.includes(b.id)} onClick={() => setWishBands(toggleBand(wishBands, b.id))}>
            {bandText(b)}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label="所要" testId="duration-chips">
        {DURATION_CHIPS.map((n) => (
          <Chip key={n} on={duration === String(n)} onClick={() => setDuration(String(n))}>
            {`${n}分`}
          </Chip>
        ))}
      </ChipRow>
      <MoreConditions data={data} input={input} ok={{ durationOk, fromOk, wishOk }} errIds={errIds} />
      <FieldError id={errIds.duration} live={false}>
        {!durationOk && `所要は${VACANCY_DURATION_MIN}〜${VACANCY_DURATION_MAX}分で入れてください（くわしい条件）`}
      </FieldError>
      <FieldError id={errIds.from} live={false}>
        {!fromOk && '開始日を入れてください（くわしい条件）'}
      </FieldError>
      <FieldError id={errIds.wish} live={false}>
        {!wishOk && '開始の幅は「から」を「まで」より前にしてください（くわしい条件）'}
      </FieldError>
    </section>
  );
}

/**
 * くわしい条件 ▾（PRD D411。閉じて始める）：種類・所要（ほかの分）・開始の幅（30分刻み）・週の回数・開始日・見る週の数・必要な条件。
 * 開始の幅を変えると時間帯のチップは指定なしに戻る（useVacancyInput）
 */
function MoreConditions({
  data,
  input,
  ok,
  errIds,
}: {
  data: Pick<DemoData, 'visitTypes' | 'items' | 'org'>;
  input: VacancyInputState;
  ok: { durationOk: boolean; fromOk: boolean; wishOk: boolean };
  errIds: { duration: string; from: string; wish: string };
}) {
  const { typeId, setTypeId, duration, setDuration, wishFrom, setWishFrom, wishTo, setWishTo } = input;
  const { perWeek, setPerWeek, from, setFrom, weeks, setWeeks, requirements, setRequirements } = input;
  const halfHours = HALF_HOURS.map((h) => (
    <option key={h} value={h}>
      {timeText(h)}
    </option>
  ));
  return (
    <details className="vacancy-more" data-testid="vacancy-more">
      <summary data-testid="vacancy-more-toggle">くわしい条件 ▾</summary>
      <div className="stack vacancy-more-body">
        <div className="form-grid">
          <label>
            種類
            <select
              value={typeId}
              data-testid="vacancy-type"
              onChange={(e) => {
                const t = typeOf(data.visitTypes, e.target.value);
                setTypeId(e.target.value);
                // 種類を選ぶと所要の初期値をその種類の標準の所要にする
                if (t) setDuration(String(t.durationMinutes));
              }}
            >
              <option value="">{NO_TYPE_TEXT}</option>
              {data.visitTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            所要（分）
            <input
              type="number"
              min={VACANCY_DURATION_MIN}
              max={VACANCY_DURATION_MAX}
              step={5}
              value={duration}
              {...invalidAttrs(!ok.durationOk, errIds.duration)}
              data-testid="vacancy-duration"
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label>
            開始の幅（から）
            <select
              value={wishFrom}
              {...invalidAttrs(!ok.wishOk, errIds.wish)}
              onChange={(e) => setWishFrom(e.target.value)}
              data-testid="wish-from"
            >
              {halfHours}
            </select>
          </label>
          <label>
            開始の幅（まで）
            <select
              value={wishTo}
              {...invalidAttrs(!ok.wishOk, errIds.wish)}
              onChange={(e) => setWishTo(e.target.value)}
              data-testid="wish-to"
            >
              {halfHours}
            </select>
          </label>
          <label>
            週の回数
            <select value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  週{n}回
                </option>
              ))}
            </select>
          </label>
          <label>
            開始日
            <input
              type="date"
              value={from}
              {...invalidAttrs(!ok.fromOk, errIds.from)}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            見る週の数
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {Array.from({ length: VACANCY_WEEKS_MAX - VACANCY_WEEKS_MIN + 1 }, (_, i) => i + VACANCY_WEEKS_MIN).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}週
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <h3 className="vacancy-sub-title">
          {data.org.terms.staff}の条件
          {requirements.length > 0 ? `（${requirements.length}件）` : '（問わない）'}
        </h3>
        <Hint>例：性別が女性。種類の「担当に必要な条件」は、ここで選ばなくても入ります。</Hint>
        <ConditionsEditor items={data.items} target="staff" value={requirements} onChange={setRequirements} />
      </div>
    </details>
  );
}
