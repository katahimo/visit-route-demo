// 担当を組む画面（ArrangePage）の区画：範囲・AI で組む（組む日・考え方・進み具合）・案を比べる
import { CalendarCheck, CalendarDays, GitCompareArrows, RefreshCw, Sparkles, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FieldError } from '../components/FieldError';
import { WithIcon } from '../components/ui';
import { UndoButtons } from '../components/undo';
import { etaText } from '../lib/arrange';
import { dateText, mdText, ymText } from '../lib/dateText';
import { isDate } from '../lib/isDate';
import type { BatchMode } from '../lib/month';
import { type BatchRun, type BatchSource, monthBatch } from '../lib/monthBatch';
import { setStandardStep } from '../lib/standardDraft';

/**
 * 基本情報が最後に組んだあとに変わった知らせ（ADR-0067。PRD D363）：［組み直す］で範囲の伝えていない日をすべて AI で組む
 * （提案の帯で確かめて反映。主ボタンは「AI で組む」のまま、ここは枠のボタン）
 */
export function ArrangeBasisNotice({
  rangeLabel,
  days,
  running,
  onRedo,
}: {
  rangeLabel: string;
  days: number;
  running: boolean;
  onRedo: () => void;
}) {
  return (
    <section className="card stack arrange-basis" aria-label="基本情報の変更" data-testid="arrange-basis-changed">
      <p className="warn">
        <strong>基本情報が、最後に組んだあとに変わりました</strong>
        （予定・相性・勤務時間（シフト）など）。組み直すと今の基本情報で担当を組みます
      </p>
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={onRedo}
          disabled={running || days === 0}
          data-testid="arrange-basis-redo"
        >
          <WithIcon icon={RefreshCw}>
            {rangeLabel}を組み直す（伝えていない {days}日）
          </WithIcon>
        </button>
        {days === 0 && <span className="sub">範囲に組める日がありません（今日より前・確定した日は組みません）</span>}
        <Link to="/basics" className="btn btn-text" data-testid="arrange-basis-link">
          基本情報を見る
        </Link>
      </div>
    </section>
  );
}

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
  /** 組み方の標準がまだ無い（範囲にかかわらず AI で組まず、組み方の標準へ案内する。ADR-0065） */
  needStandard: boolean;
  /** エキスパート機能が入（［標準の組み方を変える］の案内を出す。ADR-0072） */
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

/** 組み方の標準が無いときの案内（文と［組み方の標準を決める］だけ） */
function NeedStandard() {
  return (
    <>
      <p data-testid="arrange-need-standard">
        組み方の標準がまだありません。先に「組み方の標準」で、考え方ごとの案をくらべて標準の週を決めてください。標準を決めると、この画面では標準で埋まらない所を
        AI で埋めます
      </p>
      <div className="row">
        <Link
          className="btn btn-primary"
          to="/standard"
          onClick={() => setStandardStep('proposals')}
          data-testid="arrange-to-standard"
        >
          <WithIcon icon={CalendarCheck}>組み方の標準を決める</WithIcon>
        </Link>
      </div>
    </>
  );
}

/** AI で組む（標準が無ければ組み方の標準へ案内、それ以外は組む日・考え方・開始・進み具合） */
export function ArrangeRunSection({ view, actions }: { view: ArrangeRunProps; actions: ArrangeRunActions }) {
  const { headingId, needStandard, mode, run, runDays } = view;
  return (
    <section className="card stack" aria-labelledby={headingId} data-testid="arrange-run">
      <h2 id={headingId} className="arrange-title">
        AI で組む
      </h2>
      {needStandard ? (
        <NeedStandard />
      ) : (
        <>
          <ArrangeModeFields mode={mode} careDays={view.careDays} allDays={view.allDays} onMode={actions.onMode} />
          <p data-testid="arrange-basis">
            考え方：<strong>{view.basisName}</strong>
            {view.expert && <span className="sub">（点数の基準。替えるのは［標準の組み方を変える］）</span>}
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
        </>
      )}
      {run && <ArrangeProgress run={run} />}
      <FieldError>{view.error}</FieldError>
      {!needStandard && (
        <p className="sub">
          ピンの訪問（手で替えた訪問・{view.expert ? '組み方の標準の担当' : '繰り返しの担当'}）はそのままで、ほかの訪問の担当と時刻を組みます。今日より前の日・確定した日は組みません。
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
