// 読み込んだデータを入れる共通の手（名簿の読み込み useRosterImport・予約の読み込み useBookingImport。ADR-0020・ADR-0075）：
// 1世代の控えを残して store の update で入れ、入ったかは次の描画で data を見て決める（入らなければ成功と言わず、残した控えを前の世代に戻す）。
// 読み込みや確認のあいだに別のところ（別のタブなど）でデータが変わったかも見る
import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import type { DemoData } from '../contracts/data';
import { type PreviousKeep, useDemoData } from '../store';
import { useToast } from './Toast';

/** 読み込みのあいだにデータが変わって、確かめる前に止めたときの文 */
export const IMPORT_CHANGED_TEXT =
  '読み込みのあいだにデータが変わりました。もう一度読み込んでください（いまのデータはそのままです）';

export function usePendingImport(setError: Dispatch<SetStateAction<string | null>>) {
  const { data, update, keepPrevious } = useDemoData();
  const toast = useToast();
  const latest = useRef(data);
  latest.current = data;
  const pending = useRef<{
    base: DemoData;
    next: DemoData;
    done: string;
    keep: PreviousKeep;
    onDone?: () => void;
  } | null>(null);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    if (data === p.next) {
      pending.current = null;
      toast(p.done);
      p.onDone?.();
    } else if (data !== p.base) {
      pending.current = null;
      // 入らなかったので、残した控えは前の世代に戻す
      p.keep.cancel();
      setError(
        '読み込みのあいだにデータが変わったので入れませんでした（いまのデータはそのままです）。もう一度読み込んでください',
      );
    }
  }, [data, toast, setError]);

  return {
    data,
    toast,
    /** base を読んだあとに、データが別のところで変わったか */
    changedSince: (base: DemoData) => latest.current !== base,
    /** 控えを残して next を入れる（done は控えの結果から知らせの文を作る。onDone は入ったと見届けたときに呼ぶ） */
    commit: (x: {
      base: DemoData;
      next: DemoData;
      label: string;
      done: (keep: PreviousKeep) => string;
      onDone?: () => void;
    }) => {
      const keep = keepPrevious(x.label);
      pending.current = { base: x.base, next: x.next, done: x.done(keep), keep, onDone: x.onDone };
      update((d) => (d === x.base ? x.next : d), x.label, { tell: false });
    },
  };
}
