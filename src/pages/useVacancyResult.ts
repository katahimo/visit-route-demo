import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COMPACT_QUERY, useMedia } from '../components/useMedia';
import type { DemoData } from '../contracts/data';
import type { VacancyQuery, VacancyRange, VacancyResult } from '../contracts/vacancy';
import { attempt } from '../lib/common';
import { scrollLeftToShow } from '../lib/scrollEdge';
import { NARROW_FIRST_START } from '../lib/vacancyView';
import { vacancyOf } from '../vacancy';

/** 条件を変えてから計算し直すまで（ms） */
export const DEBOUNCE_MS = 300;

/** 条件を変えると 300ms 間引いて計算し直す（データは読むだけ） */
export function useVacancyResult(data: DemoData, query: VacancyQuery | null, range: VacancyRange | null) {
  const [result, setResult] = useState<VacancyResult | null>(null);
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    if (!query || !range) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const id = window.setTimeout(() => {
      setResult(attempt(() => vacancyOf(data, query, range)).value);
      setBusy(false);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [data, query, range]);
  return { result, busy };
}

/**
 * 狭い画面では、表がはじめに出たとき 9:00 の列が曜日の列のすぐ右に来るまで横に巻く（PRD D221）。
 * 表が出ているあいだは1回だけ（条件を変えても人が巻いた位置のまま）。表が消えたら（入る時刻が無い・計算できない）箱も消えて
 * 7:00 に戻るので、次に表が出たときにまた巻く。表が畳んだ「詳しく ▾」の中（PRD D412）なら、開いたときに巻く。返すのは表の箱に付ける ref
 */
export function useNarrowGridScroll(hasGrid: boolean) {
  const narrow = useMedia(COMPACT_QUERY);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridScrolled = useRef(false);
  useLayoutEffect(() => {
    if (!hasGrid) {
      gridScrolled.current = false;
      return;
    }
    const box = gridRef.current;
    if (!narrow || !box || gridScrolled.current) return;
    const scroll = () => {
      const target = box.querySelector<HTMLElement>(`thead th[data-start="${NARROW_FIRST_START}"]`);
      // 畳んだ中（見えていない）は位置が測れないので、開くまで待つ
      if (!target || box.getClientRects().length === 0) return false;
      gridScrolled.current = true;
      const left = box.getBoundingClientRect().left;
      const corner = box.querySelector<HTMLElement>('thead th.vacancy-corner');
      const stickyRight = corner ? corner.getBoundingClientRect().right - left : 0;
      box.scrollLeft = scrollLeftToShow(box, target.getBoundingClientRect().left - left, stickyRight);
      return true;
    };
    if (scroll()) return;
    const fold = box.closest('details');
    if (!fold) return;
    const onToggle = () => {
      if (fold.open && scroll()) fold.removeEventListener('toggle', onToggle);
    };
    fold.addEventListener('toggle', onToggle);
    return () => fold.removeEventListener('toggle', onToggle);
  }, [narrow, hasGrid]);
  return gridRef;
}
