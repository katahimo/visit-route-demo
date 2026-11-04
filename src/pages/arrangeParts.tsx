// 担当を組む画面（ArrangePage）の区画：範囲・AI で組む（組む日・考え方・進み具合）・案を比べる
import { GitCompareArrows, Sparkles, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FieldError } from '../components/FieldError';
import { WithIcon } from '../components/ui';
import { UndoButtons } from '../components/undo';
import { etaText } from '../lib/arrange';
import { dateText, mdText, ymText } from '../lib/dateText';
import { arrangeWords } from '../lib/exceptionView';
import { isDate } from '../lib/isDate';
import type { BatchMode } from '../lib/month';
import { type BatchRun, type BatchSource, monthBatch } from '../lib/monthBatch';

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
          {`${run.label}：${making ? `${mdText(making)}・` : ''}${Math.min(run.index + 1, run.targets.length)}/${run.targets.length}日（組めた日 ${run.made}日）`}
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
  /** エキスパート機能が入（考え方を替える条件の重みの案内を出す。ADR-0100） */
  expert: boolean;
  mode: BatchMode;
  careDays: number;
  allDays: number;
  /** 点数の基準のプリセットの名前（いつもこの考え方で組む） */
  basisName: string;
  /** 組む日の数 */
  runDays: number;
  /** 組んでいる最中の状態（無ければ null） */
  run: BatchRun | null;
  error: string | null;
};

/** 「AI で組む」の区画の操作 */
export type ArrangeRunActions = {
  onMode: (m: BatchMode) => void;
  onStart: () => void;
};

/** AI で組む（組む日・考え方・開始・進み具合） */
export function ArrangeRunSection({ view, actions }: { view: ArrangeRunProps; actions: ArrangeRunActions }) {
  const { headingId, mode, run, runDays } = view;
  return (
    <section className="card stack" aria-labelledby={headingId} data-testid="arrange-run">
      <h2 id={headingId} className="arrange-title">
        AI で組む
      </h2>
      <ArrangeModeFields mode={mode} careDays={view.careDays} allDays={view.allDays} onMode={actions.onMode} />
      <p data-testid="arrange-basis">
        考え方：<strong>{view.basisName}</strong>
        {view.expert && (
          <span className="sub">
            （替えるのは<Link to="/rules">条件の重み</Link>）
          </span>
        )}
      </p>
      <p data-testid="arrange-count">
        組む日：<strong>{runDays}日</strong>
        {runDays > 0 && <span className="sub">（見込み {etaText(runDays)}）</span>}
      </p>
      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          aria-disabled={run !== null || runDays === 0 || undefined}
          onClick={actions.onStart}
          data-testid="arrange-start"
        >
          <WithIcon icon={Sparkles}>{run ? '組んでいます…' : 'AI で組む'}</WithIcon>
        </button>
        {/* 反映した提案は全体の「元に戻す」で1手戻せる（PRD D329） */}
        <UndoButtons />
      </div>
      {run && <ArrangeProgress run={run} />}
      <FieldError>{view.error}</FieldError>
      <p className="sub">{arrangeWords(!view.expert).note('繰り返しのいつもの担当')}</p>
    </section>
  );
}

/**
 * 案を比べる区画（範囲の今日以降の最初の訪問のある日で「案を比べる」を開く。日は比べる画面の上の帯で選び直す。
 * 日付の欄・［日の予定を見る］は比べる画面の日付と提案の帯の日のリンクに寄せた。ADR-0088）
 */
export function ArrangeCompareSection({ headingId, compareDate }: { headingId: string; compareDate: string }) {
  return (
    <section className="card stack" aria-labelledby={headingId} data-testid="arrange-compare">
      <h2 id={headingId} className="arrange-title">
        案を比べる
      </h2>
      <p className="sub">
        1日を選び、今の担当と考え方ごとの提案を並べて比べます（保存しません。日は比べる画面で選び直せます）
      </p>
      <div className="row">
        <Link className="btn" to={`/compare?date=${compareDate}`} data-testid="arrange-compare-open">
          <WithIcon icon={GitCompareArrows}>{dateText(compareDate)}の案を比べる</WithIcon>
        </Link>
      </div>
    </section>
  );
}
