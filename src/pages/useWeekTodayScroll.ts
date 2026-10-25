import { useEffect, useLayoutEffect, useRef } from 'react';
import { scrollLeftToShow } from '../lib/scrollEdge';
import type { WeekView } from '../lib/weekView';
import type { WeekTab } from './useWeekNav';

/**
 * 狭い画面では、はじめに今日の列を見せる（PRD D222）：時間軸の枠・表の箱を、今日の列が止めた列（時刻・名前）の
 * すぐ右に来るまで横に巻く。表示と週ごとに1回だけ（あとは人が巻いた位置のまま）。今日を含まない週では巻かない。
 * 戻り値はそれぞれの箱に付ける ref
 */
export function useWeekTodayScroll(x: {
  narrow: boolean;
  dates: readonly string[];
  today: string;
  view: WeekView;
  start: string;
  tab: WeekTab;
}) {
  const { narrow, dates, today, view, start, tab } = x;
  const timelineRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const clientScrollRef = useRef<HTMLDivElement>(null);
  const todayShown = useRef('');
  /** 縦に巻く今日の列の見出し（はじめの1回。巻いたら true） */
  const todayPaged = useRef<HTMLElement | true | null>(null);
  useLayoutEffect(() => {
    if (!narrow || !dates.includes(today)) {
      // 開いたときに今日の週でない・広い画面なら、あとで今日の週へ送っても縦には巻かない
      if (todayPaged.current === null) todayPaged.current = true;
      return;
    }
    const key = `${view}:${start}`;
    if (todayShown.current === key) return;
    const timeline = tab === 'timeline';
    const box = timeline ? timelineRef.current : tab === 'table' ? tableScrollRef.current : clientScrollRef.current;
    const target = box?.querySelector<HTMLElement>(timeline ? '.week-day-head.is-today' : 'thead th.is-today');
    if (!box || !target) return;
    todayShown.current = key;
    const sticky = box.querySelector<HTMLElement>(timeline ? '.week-gutter' : 'thead th');
    const left = box.getBoundingClientRect().left;
    const stickyRight = sticky ? sticky.getBoundingClientRect().right - left : 0;
    box.scrollLeft = scrollLeftToShow(box, target.getBoundingClientRect().left - left, stickyRight);
    if (!todayPaged.current) todayPaged.current = target;
  });
  /**
   * 開いて最初の1回だけ、今日の列の見出しが下のタブの裏・画面の下にあれば、上の帯のすぐ下まで縦に巻く（月の日ごとの一覧と同じ）。
   * 画面を移ったときの「上へ」（App の useEffect）のあとに巻くので、useEffect から次の描画で。表示を切り替えたときは巻かない。
   * 空の画面の案内（week-empty「この週には訪問がありません」）が出ているときは巻かない（案内と次の一手を先に見せる。ADR-0033）
   */
  useEffect(() => {
    const target = todayPaged.current;
    if (!target || target === true) return;
    todayPaged.current = true;
    if (document.querySelector('[data-testid="week-empty"]')) return;
    requestAnimationFrame(() => {
      const tabsH = document.querySelector('.bottom-tabs')?.getBoundingClientRect().height ?? 0;
      const headBottom = document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 0;
      // 貼り付いたナビの行（PRD D347。狭い画面では 0）の下まで
      const navH = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sched-nav-h')) || 0;
      const r = target.getBoundingClientRect();
      if (r.bottom > window.innerHeight - tabsH) window.scrollBy(0, r.top - Math.max(0, headBottom) - navH - 8);
    });
  });
  return { timelineRef, tableScrollRef, clientScrollRef };
}
