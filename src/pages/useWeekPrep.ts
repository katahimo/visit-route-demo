import { useId, useMemo, useRef } from 'react';
import { useBulkConfirm } from '../components/useBulkConfirm';
import { useDayStatuses } from '../components/useDayStatuses';
import { useConfirmStep } from '../components/useFeature';
import { useValueStore } from '../components/valueStore';
import type { DemoData } from '../contracts/data';
import { rangeProgress } from '../lib/month';
import { monthBatch } from '../lib/monthBatch';
import { weekNext, weekPrepOf } from '../lib/weekPrep';
import type { CompileInput } from '../matching';

/**
 * この週の準備（PRD D280・D282。ADR-0046・ADR-0053）：担当なしを組む → 確定 → 済み の主ボタン1つと、1行の状態（PRD D332）。
 * 数えるのは週の今日以降の日（月をまたぐ週も1度に）
 */
export function useWeekPrep(x: {
  data: DemoData;
  compileInput: CompileInput;
  dates: readonly string[];
  today: string;
}) {
  const { data, compileInput, dates, today } = x;
  /** 週の今日以降の日（組む・確定するのはこの日だけ。月をまたぐ週も1度に） */
  const futureDates = useMemo(() => dates.filter((d) => d >= today), [dates, today]);
  /** 日の状態（月の予定・ホームと同じ数え方。lib/useDayStatuses） */
  const weekStatuses = useDayStatuses(data, compileInput, futureDates);
  const prep = useMemo(() => {
    const statusOf = (d: string) => weekStatuses.get(d)?.status;
    return weekPrepOf(rangeProgress(data, futureDates, today, statusOf), statusOf);
  }, [weekStatuses, futureDates, data, today]);
  /** 月の予定の担当を組む計算（ADR-0042）：組んでいる間は確定しない */
  const batchRun = useValueStore(monthBatch.run);
  const confirmStep = useConfirmStep();
  const next = weekNext({ futureDays: prep.futureDays, bulk: prep.bulk, running: batchRun !== null, confirmStep });
  /** 主ボタンの場所（押したあとボタンが状態の文に替わったら、ここへフォーカスを戻す） */
  const nextRef = useRef<HTMLDivElement>(null);
  /** 押せない理由の文の id（主ボタンの aria-describedby） */
  const whyId = useId();
  /**
   * この週の問題の無い日をまとめて確定（PRD D280）：月の「問題の無い日をまとめて確定」（D223）と同じ決まり・同じ確認の型で、
   * 範囲をこの週の今日以降にする。1回の update で日ごとに「確定（伝えた）」と同じ書き方（lib/confirmDay）
   */
  const confirmBulk = useBulkConfirm(
    (d) => weekStatuses.get(d)?.problem,
    // 押したボタンは状態の文に替わるので、フォーカスは主ボタンの場所へ（body に落とさない）
    () => nextRef.current?.focus({ preventScroll: true }),
  );
  const confirmWeek = () => confirmBulk(prep.bulk);
  return { prep, next, nextRef, whyId, confirmWeek };
}

export type WeekPrepFlow = ReturnType<typeof useWeekPrep>;
