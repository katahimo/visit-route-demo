// 担当を組む（#/arrange。ADR-0063）：AI で担当を組むのはこの画面と組み方の標準だけ。予定（月・週・日）は手で直す。
// 範囲（月・週・日）を選び、選んだ範囲の担当なし・要対応を見て、「AI で組む」で範囲の提案を出す（lib/monthBatch。画面の外で計算し、
// ほかの画面へ移っても続く。ADR-0042）。提案は範囲の提案の帯で見て［反映する］［捨てる］（反映は全体の「元に戻す」で1手戻る）。
// いつも点数の基準（標準の考え方）で組む。エキスパート機能が入で組み方の標準が無い間は組まず、組み方の標準へ案内する（ADR-0065）。
// エキスパート機能が切なら、標準が無くても点数の基準のプリセットで組む（標準・案を比べるへの入口は出さない。ADR-0072）。
// 日を選んで「案を比べる」（#/compare）へ移れる（案を比べるが使えるとき）。
// 基本情報（予定・相性・勤務時間）が最後に組んだあとに変われば、上に知らせと［組み直す］（ADR-0067）
import { CalendarCheck, Sparkles } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrangeSteps } from '../components/ArrangeSteps';
import { RangeProposalBand } from '../components/scheduleParts';
import { PageHeader, WithIcon } from '../components/ui';
import { useBasisChanged } from '../components/useArrangeBasis';
import { useCompileInput } from '../components/useDayModel';
import { useDayStatuses } from '../components/useDayStatuses';
import { useFeature } from '../components/useFeature';
import { useValueStore } from '../components/valueStore';
import { jstDate } from '../domain/time';
import { needsStandard, rangeCounts, scopeOf } from '../lib/arrange';
import { mdText, monthLabel } from '../lib/dateText';
import { arrangeWords } from '../lib/exceptionView';
import { type BatchMode, batchTargets } from '../lib/month';
import { type BatchSource, monthBatch, weekLabel } from '../lib/monthBatch';
import { hasStandard } from '../lib/standard';
import { setStandardStep } from '../lib/standardDraft';
import { weekDates, weekStart } from '../lib/week';
import { addMonths, monthDates, ymOf } from '../lib/ym';
import { scorePresetOf } from '../seed';
import { useDemoData } from '../store';
import { ArrangeBasisNotice, ArrangeCompareSection, ArrangeRangeSection, ArrangeRunSection } from './arrangeParts';
import { useArrangeStart } from './useArrangeStart';
import './arrange.css';

export default function ArrangePage() {
  const { data } = useDemoData();
  const compileInput = useCompileInput(data);
  const [params, setParams] = useSearchParams();
  const compareOn = useFeature('compare');
  const expert = useFeature('expert');
  const ids = useId();
  const today = jstDate(Date.now());
  const { scope, ym, at } = scopeOf(params, today);

  /** 範囲の日付（月はその月、週は月曜からの7日、日はその日） */
  const dates = useMemo(
    () => (scope === 'month' ? monthDates(ym) : scope === 'week' ? weekDates(at) : [at]),
    [scope, ym, at],
  );
  const statuses = useDayStatuses(data, compileInput, dates);
  /** 範囲の今日以降の担当なし・要対応（日の状態の数え方。月の予定と同じ） */
  const counts = useMemo(() => rangeCounts(dates, statuses, today), [dates, statuses, today]);

  /** 作り方：要対応のある日だけ（既定。手で決めた担当を変えうる組み直しを既定にしない）／伝えていない日すべて */
  const [mode, setMode] = useState<BatchMode>('care');
  const targetsOf = (m: BatchMode) => batchTargets(data, dates, today, m, (d) => statuses.get(d)?.status);
  const careTargets = targetsOf('care');
  const allTargets = targetsOf('all');
  const targets = mode === 'care' ? careTargets : allTargets;

  /** 考え方：いつも点数の基準（替えるのは組み方の標準の案をくらべる（と寄り道の条件の重み）。ADR-0065・ADR-0066） */
  const basisName = scorePresetOf(data.presets, data.scorePresetId)?.name ?? '今の重み';
  /** 組み方の標準がまだ無い（範囲にかかわらず AI で組まない。PRD D356。門はエキスパート機能が入のときだけ。D377） */
  const needStandard = needsStandard(expert, hasStandard(data));

  /** 基本情報が最後に組んだあとに変わった（ADR-0067） */
  const basisChanged = useBasisChanged(data);

  const run = useValueStore(monthBatch.run);
  const done = useValueStore(monthBatch.done);

  /** 範囲の呼び名（「11月」「11/2〜11/8の週」「11/3」） */
  const rangeLabel = scope === 'month' ? monthLabel(ym) : scope === 'week' ? weekLabel(at) : mdText(at);

  /** 範囲を変える（URL に書く。ほかのクエリは残さない） */
  const pick = (next: BatchSource, value?: string) => {
    setError(null);
    if (next === 'month') setParams({ ym: value ?? ym }, { replace: true });
    else if (next === 'week') setParams({ d: weekStart(value ?? at) }, { replace: true });
    else setParams({ date: value ?? at }, { replace: true });
  };
  /** 月を選ぶ欄の月：今月から6か月と、見ている月 */
  const monthOptions = useMemo(
    () => [...new Set([...Array.from({ length: 6 }, (_, i) => addMonths(ymOf(today), i)), ym])].sort(),
    [today, ym],
  );

  const { error, setError, start } = useArrangeStart({ scope, ym, at, today, rangeLabel, mode, targets });
  const shownError = error ?? done?.error ?? null;

  /** 案を比べる日（範囲の中の今日以降の最初の訪問のある日。選び直せる） */
  const firstDay = allTargets[0] ?? dates.find((d) => d >= today) ?? dates[0]!;
  const [compareDay, setCompareDay] = useState<string | null>(null);
  const compareDate = compareDay && dates.includes(compareDay) ? compareDay : firstDay;

  return (
    <div className="stack arrange-page">
      {/* 段の表示：標準が無い間は4段、あれば 基本情報 → 担当を組む の2段。標準があれば［標準の組み方を変える］で標準の手順へ（ADR-0067） */}
      <PageHeader
        nav={<ArrangeSteps current="arrange" />}
        icon={Sparkles}
        title="担当を組む"
        lead={arrangeWords(!expert).lead}
        actions={
          needStandard || !expert ? undefined : (
            <Link
              to="/standard"
              className="btn"
              onClick={() => setStandardStep('proposals')}
              data-testid="arrange-change-standard"
            >
              <WithIcon icon={CalendarCheck}>標準の組み方を変える</WithIcon>
            </Link>
          )
        }
      />

      {basisChanged && hasStandard(data) && (
        <ArrangeBasisNotice
          rangeLabel={rangeLabel}
          days={allTargets.length}
          running={run !== null}
          onRedo={() => {
            setMode('all');
            void start({ mode: 'all', targets: allTargets });
          }}
        />
      )}

      <ArrangeRangeSection
        headingId={`${ids}-range`}
        scope={scope}
        ym={ym}
        at={at}
        rangeLabel={rangeLabel}
        monthOptions={monthOptions}
        counts={counts}
        onPick={pick}
      />

      <ArrangeRunSection
        view={{
          headingId: `${ids}-run`,
          needStandard,
          expert,
          mode,
          careDays: careTargets.length,
          allDays: allTargets.length,
          basisName,
          runDays: targets.length,
          run,
          error: shownError,
        }}
        actions={{ onMode: setMode, onStart: () => void start() }}
      />

      {/* 組んだ提案（日・週・月の予定にも同じ帯が出る。PRD D328） */}
      <RangeProposalBand />

      {compareOn && (
        <ArrangeCompareSection
          headingId={`${ids}-compare`}
          compareDate={compareDate}
          dates={dates}
          onDate={setCompareDay}
        />
      )}
    </div>
  );
}
