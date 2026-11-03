// URL の入口 ?date=（PRD D204・D417）：?date= だけのリンクはその日を選び（useDay の setDate）、URL から ?date= を消す。
// ?do= が付いているときはその入口（日の予定の ?do=unassigned・?do=told など）に任せて何もしない。
// 日の予定（pages/usePlanNav）と〈スタッフ〉のスマホ画面（pages/StaffViewPage）が使う
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isDate } from '../lib/isDate';

export function useDateEntry(date: string, setDate: (d: string) => void) {
  const [params, setParams] = useSearchParams();
  const doParam = params.get('do');
  const dateParam = params.get('date');
  // biome-ignore lint/correctness/useExhaustiveDependencies: ?date= が付いたときだけ
  useEffect(() => {
    if (dateParam === null || doParam !== null) return;
    if (isDate(dateParam) && dateParam !== date) setDate(dateParam);
    setParams(
      (p) => {
        p.delete('date');
        return p;
      },
      { replace: true },
    );
  }, [dateParam]);
}
