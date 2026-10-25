// 〈利用者さん〉の画面の予定のカレンダー（PRD D309。ADR-0056）：見せ方と基準の日は URL の cal（month のときだけ）・
// d（今日でないときだけ）に replace で書く。選んでいる繰り返し（カレンダーで目立たせる）は画面の中だけ
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type CalView, calViewOf } from '../lib/personPage';

export function useClientCal(today: string) {
  const [params, setParams] = useSearchParams();
  const calView = calViewOf(params.get('cal'));
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('d') ?? '') ? params.get('d')! : today;
  const setCal = ({ view, anchor: a }: { view: CalView; anchor: string }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (view === 'week') p.delete('cal');
        else p.set('cal', view);
        if (a === today) p.delete('d');
        else p.set('d', a);
        return p;
      },
      { replace: true },
    );
  const [pattern, setPattern] = useState<string | null>(null);
  return { calView, anchor, setCal, pattern, setPattern };
}
