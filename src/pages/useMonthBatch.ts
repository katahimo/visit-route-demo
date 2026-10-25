// 月の画面の月まとめ作成（PRD D256。計算は画面の外の lib/monthBatch。ADR-0042）：進み具合・いま作っている日・止める・
// この画面を開いている間に計算できずに止まった理由（ほかの画面で止まったときは知らせ（トースト）だけ）
import { useEffect, useRef, useState } from 'react';
import { useValueStore } from '../components/valueStore';
import { monthBatch } from '../lib/monthBatch';
import { ymOf } from '../lib/ym';

export function useMonthBatch(ym: string) {
  /** 月まとめ作成の進み具合（画面の外の計算。作っていなければ null。PRD D256） */
  const batch = useValueStore(monthBatch.run);
  /** 最後に終わった月まとめ作成（計算できずに止まった理由を出す） */
  const batchDone = useValueStore(monthBatch.done);
  const [error, setError] = useState<string | null>(null);
  // この画面を開いている間に計算できずに止まったら、理由を出す（ほかの画面で止まったときは知らせ（トースト）だけ）
  const seenDone = useRef(batchDone);
  useEffect(() => {
    if (batchDone === seenDone.current) return;
    seenDone.current = batchDone;
    if (batchDone?.error) setError(batchDone.error);
  }, [batchDone]);
  /** いま作っている日（表示している月の日だけ印を付ける。2か月にまたがる作成では2か月目の日も） */
  const making = batch ? batch.targets[batch.index] : undefined;
  const current = making && ymOf(making) === ym ? making : undefined;
  return { batch, running: batch !== null, current, error, stop: () => monthBatch.stop() };
}

export type MonthBatchState = ReturnType<typeof useMonthBatch>;
