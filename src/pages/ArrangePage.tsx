// 担当を組む（#/arrange。ADR-0063・ADR-0099）：範囲を選んで AI で担当を組む画面（予定を入れたときの自動の組みとは別）。
// 範囲（月・週・日）を選び、選んだ範囲の担当なし・要対応を見て、「AI で組む」で範囲の提案を出す（lib/monthBatch。画面の外で計算し、
// ほかの画面へ移っても続く。ADR-0042）。提案は範囲の提案の帯で見て［反映する］［捨てる］（反映は全体の「元に戻す」で1手戻る）。
// いつも条件の重み（点数の基準）で組む。いつもの担当がその日に担当できる回はピンと同じに扱う。
// 範囲の最初の日で「案を比べる」（#/compare）へ移れる（案を比べるが使えるとき。日は比べる画面で選び直す。ADR-0088）
import { Sparkles } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RangeProposalBand } from '../components/scheduleParts';
import { PageHeader } from '../components/ui';
import { useCompileInput } from '../components/useDayModel';
import { useDayStatuses } from '../components/useDayStatuses';
import { useFeature } from '../components/useFeature';
import { useValueStore } from '../components/valueStore';
import { jstDate } from '../domain/time';
import { rangeCounts, scopeOf } from '../lib/arrange';
import { mdText, monthLabel } from '../lib/dateText';
import { arrangeWords } from '../lib/exceptionView';
import { type BatchMode, batchTargets } from '../lib/month';
import { type BatchSource, monthBatch, weekLabel } from '../lib/monthBatch';
import { weekDates, weekStart } from '../lib/week';
import { addMonths, monthDates, ymOf } from '../lib/ym';
import { scorePresetOf } from '../seed';
import { useDemoData } from '../store';
import { ArrangeCompareSection, ArrangeRangeSection, ArrangeRunSection } from './arrangeParts';
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

  /** 考え方：いつも点数の基準（替えるのは条件の重み。ADR-0099） */
  const basisName = scorePresetOf(data.presets, data.scorePresetId)?.name ?? '今の重み';

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

  /** 案を比べる日（範囲の中の今日以降の最初の訪問のある日。選び直すのは比べる画面の日付。ADR-0088） */
  const compareDate = allTargets[0] ?? dates.find((d) => d >= today) ?? dates[0]!;

  return (
    <div className="stack arrange-page">
      <PageHeader icon={Sparkles} title="担当を組む" lead={arrangeWords(!expert).lead} />

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

      {compareOn && <ArrangeCompareSection headingId={`${ids}-compare`} compareDate={compareDate} />}
    </div>
  );
}
