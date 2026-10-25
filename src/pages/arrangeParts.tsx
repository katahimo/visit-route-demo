// 担当を組む画面（ArrangePage）の区画：範囲・AI で組む（組む日・考え方・進み具合）・案を比べる
import { CalendarDays, GitCompareArrows, Sparkles, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FieldError } from '../components/FieldError';
import { WithIcon } from '../components/ui';
import { UndoButtons } from '../components/undo';
import type { Preset } from '../contracts/rules';
import { etaText } from '../lib/arrange';
import { dateText, mdText, ymText } from '../lib/dateText';
import { isDate } from '../lib/isDate';
import type { BatchMode } from '../lib/month';
import { type BatchRun, type BatchSource, type BatchVariant, monthBatch } from '../lib/monthBatch';

/** 範囲の呼び名 */
const SCOPE_LABEL: Record<BatchSource, string> = { month: '月', week: '週', day: '日' };
const SCOPES: readonly BatchSource[] = ['month', 'week', 'day'];

/** 範囲を選ぶ区画の入力：見ている範囲と、担当なし・要対応の数 */
export type ArrangeRangeProps = {
  headingId: string;
  scope: BatchSource;
  ym: string;
  at: string;
  rangeLabel: string;
  monthOptions: readonly string[];
  counts: { unassigned: number; unassignedDays: number; care: number };
  onPick: (next: BatchSource, value?: string) => void;
};

/** 範囲（月・週・日の切り替え、月または日の選択、担当なし・要対応の件数） */
export function ArrangeRangeSection({
  headingId,
  scope,
  ym,
  at,
  rangeLabel,
  monthOptions,
  counts,
  onPick,
}: ArrangeRangeProps) {
  return (
    <section className="card stack" aria-labelledby={headingId} data-testid="arrange-range">
      <h2 id={headingId} className="arrange-title">
        範囲
      </h2>
      <div className="row arrange-range-row">
        <fieldset className="segmented" aria-label="範囲の大きさ" data-testid="arrange-scope">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              className={scope === s ? 'is-on' : undefined}
              aria-pressed={scope === s}
              onClick={() => onPick(s)}
              data-scope={s}
            >
              {SCOPE_LABEL[s]}
            </button>
          ))}
        </fieldset>
        {scope === 'month' ? (
          <select
            aria-label="月を選ぶ"
            value={ym}
            onChange={(e) => onPick('month', e.target.value)}
            data-testid="arrange-month"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {ymText(m)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="date"
            aria-label={scope === 'week' ? '週の中の日を選ぶ' : '日を選ぶ'}
            value={at}
            onChange={(e) => isDate(e.target.value) && onPick(scope, e.target.value)}
            data-testid="arrange-date"
          />
        )}
        <span className="sub" data-testid="arrange-range-label">
          {scope === 'week' ? rangeLabel : scope === 'day' ? dateText(at) : ymText(ym)}
        </span>
      </div>
      <p className="arrange-counts" data-testid="arrange-counts">
        今日以降：担当なしの訪問{' '}
        <strong data-testid="arrange-unassigned" data-count={counts.unassigned}>
          {counts.unassigned}件
        </strong>
        （{counts.unassignedDays}日）・要対応{' '}
        <strong data-testid="arrange-care" data-count={counts.care}>
          {counts.care}件
        </strong>
      </p>
    </section>
  );
}

/** 組む日の選び方（要対応のある日だけ／伝えていない日をすべて） */
function ArrangeModeFields({
  mode,
  careDays,
  allDays,
  onMode,
}: {
  mode: BatchMode;
  careDays: number;
  allDays: number;
  onMode: (m: BatchMode) => void;
}) {
  return (
    <fieldset className="stack batch-mode" style={{ gap: 6 }}>
      <legend>組む日</legend>
      <label className="check">
        <input
          type="radio"
          name="arrange-mode"
          checked={mode === 'care'}
          onChange={() => onMode('care')}
          style={{ width: 'auto' }}
          data-testid="arrange-mode-care"
        />
        要対応のある日だけ（{careDays}日）
      </label>
      <label className="check">
        <input
          type="radio"
          name="arrange-mode"
          checked={mode === 'all'}
          onChange={() => onMode('all')}
          style={{ width: 'auto' }}
          data-testid="arrange-mode-all"
        />
        伝えていない日をすべて組み直す（{allDays}日）
      </label>
    </fieldset>
  );
}

/** 考え方（プリセット）を選ぶ欄 */
function ArrangePresetField({
  presets,
  basePreset,
  presetId,
  onPreset,
}: {
  presets: readonly Preset[];
  basePreset: Preset | null;
  presetId: string;
  onPreset: (id: string) => void;
}) {
  return (
    <label className="stack arrange-preset" style={{ gap: 4 }}>
      <span>考え方（プリセット）</span>
      <select value={presetId} onChange={(e) => onPreset(e.target.value)} data-testid="arrange-preset">
        <option value="">点数の基準（{basePreset?.name ?? '今の重み'}）</option>
        {presets
          .filter((p) => p.id !== basePreset?.id)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
      <span className="sub">選んだ考え方の重みで組みます。点数の基準と条件の重みは変わりません</span>
    </label>
  );
}

/** 組んでいる間の進み具合の帯（止めるボタンつき） */
function ArrangeProgress({ run }: { run: BatchRun }) {
  const progressValue = run.index + (run.total > 0 ? Math.min(1, run.iteration / run.total) : 0);
  const making = run.targets[run.index];
  return (
    <div className="stack month-progress" style={{ gap: 4 }} data-testid="arrange-progress">
      <progress
        value={progressValue}
        max={Math.max(1, run.targets.length)}
        aria-label="担当を組む進み具合"
        style={{ width: '100%' }}
      />
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span className="sub" aria-live="polite">
          {run.variants
            ? `${run.label}の案：${run.variants[run.index] ?? ''}（${Math.min(run.index + 1, run.targets.length)}/${run.targets.length}つ目）`
            : `${run.label}：${making ? `${mdText(making)}・` : ''}${Math.min(run.index + 1, run.targets.length)}/${run.targets.length}日（組めた日 ${run.made}日）`}
        </span>
        <button type="button" className="btn btn-small" onClick={() => monthBatch.stop()} data-testid="arrange-stop">
          <WithIcon icon={Square} size={14}>
            止める
          </WithIcon>
        </button>
      </div>
    </div>
  );
}

/** 「AI で組む」の区画の入力 */
export type ArrangeRunProps = {
  headingId: string;
  scope: BatchSource;
  /** 組み方の標準がまだ無い */
  needStandard: boolean;
  /** 標準が無いときに日の案へ移る日 */
  guideDay: string;
  /** 考え方ごとの案（範囲が日で標準が無いときだけ） */
  variants: BatchVariant[] | null;
  mode: BatchMode;
  careDays: number;
  allDays: number;
  /** 考え方（プリセット）の欄：出すとき true */
  showPreset: boolean;
  presets: readonly Preset[];
  basePreset: Preset | null;
  presetId: string;
  /** 組む日の数 */
  runDays: number;
  /** 組む回数 */
  runs: number;
  /** 組んでいる最中の状態（無ければ null） */
  run: BatchRun | null;
  error: string | null;
};

/** 「AI で組む」の区画の操作 */
export type ArrangeRunActions = {
  onPickDay: (day: string) => void;
  onMode: (m: BatchMode) => void;
  onPreset: (id: string) => void;
  onStart: () => void;
};

/** AI で組む（標準が無い週・月は案内、それ以外は組む日・考え方・開始・進み具合） */
export function ArrangeRunSection({ view, actions }: { view: ArrangeRunProps; actions: ArrangeRunActions }) {
  const { headingId, scope, needStandard, guideDay, variants, mode, run, runs, runDays } = view;
  return (
    <section className="card stack" aria-labelledby={headingId} data-testid="arrange-run">
      <h2 id={headingId} className="arrange-title">
        AI で組む
      </h2>
      {needStandard && scope !== 'day' ? (
        <>
          <p data-testid="arrange-need-standard">
            組み方の標準がまだありません。週・月をまとめて組む前に、1日を考え方（プリセット）ごとに組んでくらべ、気に入った案を標準にしてください。標準を決めると、週・月もその考え方で組めます
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => actions.onPickDay(guideDay)}
              data-testid="arrange-to-day"
            >
              <WithIcon icon={CalendarDays}>{mdText(guideDay)}を考え方ごとの案で組む</WithIcon>
            </button>
          </div>
        </>
      ) : (
        <>
          {variants && (
            <p className="arrange-choices-note" data-testid="arrange-choices-note">
              組み方の標準がまだ無いので、{variants.map((v) => `「${v.name}」`).join('')}の{variants.length}
              つの考え方でこの日を組んで並べます。気に入った案を「この案を標準にする」で選ぶと、これからはその考え方で組みます
            </p>
          )}
          {!variants && (
            <ArrangeModeFields mode={mode} careDays={view.careDays} allDays={view.allDays} onMode={actions.onMode} />
          )}
          {!variants && view.showPreset && (
            <ArrangePresetField
              presets={view.presets}
              basePreset={view.basePreset}
              presetId={view.presetId}
              onPreset={actions.onPreset}
            />
          )}
          <p data-testid="arrange-count">
            組む日：<strong>{runDays}日</strong>
            {variants && runs > 0 && `（${runs}つの案）`}
            {runs > 0 && <span className="sub">（見込み {etaText(runs)}）</span>}
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              aria-disabled={run !== null || runDays === 0 || undefined}
              onClick={actions.onStart}
              data-testid="arrange-start"
            >
              <WithIcon icon={Sparkles}>
                {run ? '組んでいます…' : variants ? `${runs || variants.length}つの案を組む` : 'AI で組む'}
              </WithIcon>
            </button>
            {/* 反映した提案は全体の「元に戻す」で1手戻せる（PRD D329） */}
            <UndoButtons />
          </div>
        </>
      )}
      {run && <ArrangeProgress run={run} />}
      <FieldError>{view.error}</FieldError>
      {!(needStandard && scope !== 'day') && (
        <p className="sub">
          ピンの訪問（手で替えた訪問・組み方の標準の担当）はそのままで、ほかの訪問の担当と時刻を組みます。今日より前の日・確定した日は組みません。
          1日ずつ組み、終わったら提案を出します。見て「反映する」と担当が変わります（「元に戻す」で戻せます）。ほかの画面へ移っても組み続けます。
        </p>
      )}
    </section>
  );
}

/** 案を比べる区画（日を選んで「案を比べる」「日の予定」へ移る） */
export function ArrangeCompareSection({
  headingId,
  compareDate,
  dates,
  onDate,
}: {
  headingId: string;
  compareDate: string;
  dates: readonly string[];
  onDate: (day: string) => void;
}) {
  return (
    <section className="card stack" aria-labelledby={headingId} data-testid="arrange-compare">
      <h2 id={headingId} className="arrange-title">
        案を比べる
      </h2>
      <p className="sub">1日を選び、今の担当と考え方ごとの提案を並べて比べます（保存しません）</p>
      <div className="row">
        <input
          type="date"
          aria-label="比べる日"
          value={compareDate}
          min={dates[0]}
          max={dates[dates.length - 1]}
          onChange={(e) => isDate(e.target.value) && onDate(e.target.value)}
          data-testid="arrange-compare-date"
        />
        <Link className="btn" to={`/compare?date=${compareDate}`} data-testid="arrange-compare-open">
          <WithIcon icon={GitCompareArrows}>{dateText(compareDate)}の案を比べる</WithIcon>
        </Link>
        <Link className="btn btn-text" to={`/plan?date=${compareDate}`} data-testid="arrange-day-open">
          <WithIcon icon={CalendarDays}>日の予定を見る</WithIcon>
        </Link>
      </div>
    </section>
  );
}
