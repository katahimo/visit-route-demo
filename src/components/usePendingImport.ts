// 読み込んだデータを入れる共通の手（名簿の読み込み useRosterImport・予約の読み込み useBookingImport。ADR-0020・ADR-0075）：
// 1世代の控えを残して store の update で入れ、入ったかは次の描画で data を見て決める（入らなければ成功と言わず、残した控えを前の世代に戻す）。
// 読み込みや確認のあいだに別のところ（住所からの位置の検索・別のタブなど）でデータが変わったら、同じファイルを今のデータで読み直し、
// 確かめた内容と同じなら読み直した結果を入れる（lib/importRebase）。入ったら担当なし・要対応を自動で組む（PRD D442）
import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import type { DemoData, ImportError } from '../contracts/data';
import { jstDate } from '../domain/time';
import { rebaseImport } from '../lib/importRebase';
import { arrangeAfterImport } from '../lib/placeRunner';
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
    /** store の更新の中で next を入れたか（入れた直後にほかの手（位置の検索など）が続いても、入ったと分かるように） */
    applied: boolean;
  } | null>(null);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    if (p.applied || data === p.next) {
      pending.current = null;
      toast(p.done);
      p.onDone?.();
      // 住所を探しているあいだは組まずに待たせ、探し終えてから位置のそろったデータで組む（PRD D445）
      arrangeAfterImport(p.base, p.next, jstDate(Date.now()));
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
    /**
     * base で読んだ結果 r を今のデータに当て直す（変わっていなければそのまま。変わっていたら reread で読み直し、
     * 確かめた内容と同じなら読み直した結果）。入れられなければ null（呼ぶ側は IMPORT_CHANGED_TEXT を出す）
     */
    rebase: <T extends { data: DemoData }>(
      base: DemoData,
      r: T,
      reread: (d: DemoData) => Promise<T | ImportError> | T | ImportError,
    ) => rebaseImport(base, r, () => latest.current, reread),
    /** 控えを残して next を入れる（done は控えの結果から知らせの文を作る。onDone は入ったと見届けたときに呼ぶ） */
    commit: (x: {
      base: DemoData;
      next: DemoData;
      label: string;
      done: (keep: PreviousKeep) => string;
      onDone?: () => void;
    }) => {
      const keep = keepPrevious(x.label);
      const p = { base: x.base, next: x.next, done: x.done(keep), keep, onDone: x.onDone, applied: false };
      pending.current = p;
      update(
        (d) => {
          if (d !== x.base) return d;
          p.applied = true;
          return x.next;
        },
        x.label,
        { tell: false },
      );
    },
  };
}
