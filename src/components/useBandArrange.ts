// 要対応の帯の［要対応を組む］（PRD D403。ADR-0077・ADR-0089）：エキスパート機能が切のとき、今日〜翌月末の組める要対応の訪問
// （担当なしと、間に合わない・重なり・休みの人）の数と、それをいまの条件で自動で組む（ADR-0072 第2段。lib/autoArrange の bandTargets）。
// 入は「担当を組む」の画面で組むので出さない
import { useMemo } from 'react';
import { jstDate } from '../domain/time';
import { autoRange, bandTargets, targetCount } from '../lib/autoArrange';
import { autoArrange, requestBandArrange } from '../lib/autoArrangeBatch';
import { exceptionsOnly } from '../lib/exceptionView';
import { useDemoData } from '../store';
import { useValueStore } from './valueStore';

/** 組める要対応の訪問の数・組んでいるか・組む。出さないとき（入・0件で組んでいない）は null */
export type BandArrange = { count: number; running: boolean; run: () => void };

export function useBandArrange(): BandArrange | null {
  const { data } = useDemoData();
  const running = useValueStore(autoArrange.run) !== null;
  const exceptionOnly = exceptionsOnly(data.org.features);
  const today = jstDate(Date.now());
  const count = useMemo(
    () => (exceptionOnly ? targetCount(bandTargets(data, today, autoRange(today))) : 0),
    [exceptionOnly, data, today],
  );
  if (!exceptionOnly || (count === 0 && !running)) return null;
  return {
    count,
    running,
    run: () => {
      if (!running) requestBandArrange(data, today);
    },
  };
}
