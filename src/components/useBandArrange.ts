// 要対応の帯の［担当なしを組む］（PRD D403。ADR-0077）：エキスパート機能が切のとき、今日〜翌月末の組める担当なしの訪問の数と、
// それをいまの条件で自動で組む（ADR-0072 第2段。前の予定の「その他 ▾」の「担当なしの訪問を組む」と同じ処理と範囲）。入は「担当を組む」の画面で組むので出さない
import { useMemo } from 'react';
import { jstDate } from '../domain/time';
import { autoRange, targetCount, unassignedTargets } from '../lib/autoArrange';
import { autoArrange, requestUnassignedArrange } from '../lib/autoArrangeBatch';
import { exceptionsOnly } from '../lib/exceptionView';
import { useDemoData } from '../store';
import { useValueStore } from './valueStore';

/** 組める担当なしの数・組んでいるか・組む。出さないとき（入・0件で組んでいない）は null */
export type BandArrange = { count: number; running: boolean; run: () => void };

export function useBandArrange(): BandArrange | null {
  const { data } = useDemoData();
  const running = useValueStore(autoArrange.run) !== null;
  const exceptionOnly = exceptionsOnly(data.org.features);
  const today = jstDate(Date.now());
  const count = useMemo(
    () => (exceptionOnly ? targetCount(unassignedTargets(data, today, autoRange(today))) : 0),
    [exceptionOnly, data, today],
  );
  if (!exceptionOnly || (count === 0 && !running)) return null;
  return {
    count,
    running,
    run: () => {
      if (!running) requestUnassignedArrange(data, today);
    },
  };
}
