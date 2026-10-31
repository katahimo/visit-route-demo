// 月の画面の日ごとの数（PRD D53・D59・D151〜D155・D223・D295）：日ごとの訪問・状態・数える案・印・要対応・今月の準備・
// 進み具合の帯・まとめて確定の対象。表示の選択（〈スタッフ〉・〈利用者さん〉）に依る数は useMonthFocusDays
import { useMemo } from 'react';
import type { BandModel } from '../components/progressBand';
import { useDayStatuses } from '../components/useDayStatuses';
import { useExceptionsOnly } from '../components/useFeature';
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { exceptionStatus } from '../lib/attentionBand';
import { bulkConfirmTargets } from '../lib/confirmDay';
import {
  attentionList,
  batchTargets,
  type DayMarks,
  type DayPlan,
  dayMarks,
  dayPlanOf,
  monthProgress,
} from '../lib/month';
import { attentionCountByDate } from '../lib/monthRest';
import { monthSummary, monthUsualRest } from '../lib/monthView';
import { urgentCount } from '../lib/progressBand';
import { calendarWeeks, monthDates } from '../lib/ym';
import type { CompileInput } from '../matching';
import { visitsOn } from '../patterns';

export function useMonthDays(data: DemoData, compileInput: CompileInput, ym: string, today: string) {
  const weeks = useMemo(() => calendarWeeks(ym), [ym]);
  const days = useMemo(() => monthDates(ym), [ym]);
  /** 日ごとの訪問（計算した繰り返しの回も。版2。ADR-0053） */
  const visitsByDate = useMemo(() => {
    const out = new Map<string, readonly Visit[]>();
    for (const d of days) out.set(d, visitsOn(data, d));
    return out;
  }, [data, days]);

  // ---- 日の問題と状態（lib/useDayStatuses。月・週・要対応の帯で共通）----
  const perDay = useDayStatuses(data, compileInput, days);
  // 切（例外だけ見せる。PRD D384）は要対応を帯と同じ分け方に絞る（lib/attentionBand の exceptionStatus）。マス・右の欄・進み具合の数が帯とそろう
  const only = useExceptionsOnly();
  const statuses = useMemo(
    () => new Map([...perDay].map(([d, x]) => [d, only ? exceptionStatus(x.status) : x.status])),
    [perDay, only],
  );

  /** その日の担当の並び（訪問の今の担当）。問題は上で作ったものを使う */
  const dayPlans = useMemo(() => {
    const out = new Map<string, DayPlan>();
    for (const d of days) out.set(d, dayPlanOf(data, d, perDay.get(d)?.problem ?? null));
    return out;
  }, [days, data, perDay]);

  // ---- 日のマスの印（D53）----
  const marks = useMemo(() => {
    const out = new Map<string, DayMarks>();
    for (const d of days) out.set(d, dayMarks(data, d));
    return out;
  }, [days, data]);

  const attention = useMemo(
    () => attentionList(data, days.map((d) => statuses.get(d)!).filter(Boolean), today),
    [data, days, statuses, today],
  );
  /** 日ごとの要対応の札「要対応 N」の N（右の欄の行と同じ数え方。PRD D295） */
  const attentionByDate = useMemo(() => attentionCountByDate(attention), [attention]);
  /** 曜日ごとの「ふだん」の休みの人数（同じ月の同じ曜日の最頻値。「休 N」はこれより多い日だけ出す。PRD D295） */
  const usualRest = useMemo(() => monthUsualRest(days, ym, marks), [days, ym, marks]);
  /** 今月の準備（PRD D59。進み具合の帯に出す。D151）。日の状態は上で compile・採点したものを使う（要対応の欄と同じ数え方） */
  const progress = useMemo(() => monthProgress(data, ym, today, (d) => statuses.get(d)), [data, ym, today, statuses]);

  /**
   * 見出しの下の要約（月全体。今日より前の日も数える）：帯に無いものだけ（入らない訪問・当日キャンセル）。
   * 訪問・案のある日は帯（今日以降）に出すので、同じ言葉で違う範囲の数を並べない（PR #38 のレビュー。PRD D154）
   */
  const summary = useMemo(() => monthSummary(days, statuses, visitsByDate), [days, statuses, visitsByDate]);

  /** 進み具合の帯（PRD D151〜D155）：今月の準備と同じ数え方。週・日の画面の帯と同じもの */
  const band = useMemo(
    (): BandModel => ({
      ym,
      progress,
      emptyTargets: batchTargets(data, days, today, 'care', (d) => {
        const s = statuses.get(d);
        return s && s.unassigned > 0 ? s : undefined;
      }).length,
      urgent: urgentCount(attention),
    }),
    [ym, progress, data, days, today, statuses, attention],
  );

  // ---- 問題の無い日をまとめて確定（PRD D223。右の欄の「確定していない日」）----
  /** 確定していない日（今日以降）のうち、一度も確定していない日で、必須の違反が無く要対応に出ない日（ADR-0031） */
  const bulk = useMemo(
    () => bulkConfirmTargets(progress.unconfirmed, (d) => statuses.get(d), attention),
    [progress, statuses, attention],
  );

  return {
    weeks,
    days,
    visitsByDate,
    perDay,
    statuses,
    dayPlans,
    marks,
    attention,
    attentionByDate,
    usualRest,
    progress,
    summary,
    band,
    bulk,
  };
}

export type MonthDays = ReturnType<typeof useMonthDays>;
