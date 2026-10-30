// 日の画面の URL の入口 `?do=told`（週・月の「変更あり」の印から。lib/links の toldHref。ADR-0073・PRD D382）：
// その日を選び、URL から ?date= と ?do= を消し、連絡の一覧（未連絡の変更）を開く。日付を変えると欄を閉じる処理のあとに開くので、
// 呼ぶ側は useConfirmDay のあとにこのフックを呼ぶ
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { shouldOpenTold, toldEntryDate } from '../lib/links';

/**
 * date は今選んでいる日、canOpen はその日に未連絡の変更があるか（無ければ開かない）、open は連絡の一覧を開く
 */
export function useToldEntry(x: { date: string; setDate: (d: string) => void; canOpen: boolean; open: () => void }) {
  const { date, setDate, canOpen, open } = x;
  const [params, setParams] = useSearchParams();
  const doParam = params.get('do');
  const pending = useRef<string | null>(null);
  /** ?do=told を受けた回数（同じ日を開いたままでも、開く effect を走らせる） */
  const [asked, setAsked] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ?do= が付いたときだけ
  useEffect(() => {
    const target = toldEntryDate(doParam, params.get('date'), date);
    if (target === null) return;
    if (target !== date) setDate(target);
    pending.current = target;
    setAsked((n) => n + 1);
    setParams(
      (p) => {
        p.delete('do');
        p.delete('date');
        return p;
      },
      { replace: true },
    );
  }, [doParam]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付が変わった・受けたときだけ
  useEffect(() => {
    if (pending.current === null || pending.current !== date) return;
    const go = shouldOpenTold(pending.current, date, canOpen);
    pending.current = null;
    if (go) open();
  }, [date, asked]);
}
