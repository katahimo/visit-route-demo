import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDay } from '../components/day';
import { COMPACT_QUERY, useMedia } from '../components/useMedia';
import { jstDate } from '../domain/time';
import { paramOf } from '../lib/common';
import { isDate } from '../lib/isDate';
import { weekDates } from '../lib/week';
import { selectionOf, type WeekBy, weekOptionsOf } from '../lib/weekScreen';
import { weekViewOf } from '../lib/weekView';

/** 週の予定の表の種類（時間軸／〈スタッフ〉×曜日／〈利用者さん〉×曜日） */
export type WeekTab = 'timeline' | 'table' | 'clients';

/**
 * 週の予定（pages/WeekPage.tsx）の URL と週：?d= の週・表示（?view=・?by=。lib/weekView）・選んだ人（?staff=・?client=・?cf=）と、
 * 選んでいる日付との同期（PRD D59）・週を送る・日の予定を開く
 */
export function useWeekNav() {
  const { date, setDate, dates: dataDates } = useDay();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = jstDate(Date.now());
  const rawD = params.get('d') ?? '';
  const anchor = isDate(rawD) ? rawD : date;
  const dates = useMemo(() => weekDates(anchor), [anchor]);
  const start = dates[0]!;
  /** 週を選ぶ欄の週（データの日付を含む週の月曜。PRD D347） */
  const weekOptions = useMemo(() => weekOptionsOf(dataDates, start), [dataDates, start]);
  /** 狭い画面（600px 以下）。?view=・?by= が無ければ〈スタッフ〉×曜日の表（PRD D222。URL には書かない） */
  const narrow = useMedia(COMPACT_QUERY);
  /** 表示（PRD D188。1つの切り替え。URL は今までの ?view=・?by= のまま。lib/weekView） */
  const view = weekViewOf(params.get('view'), params.get('by'), narrow);
  const tab: WeekTab = view === 'table' || view === 'clients' ? view : 'timeline';
  const by: WeekBy = view === 'timeline-client' ? 'client' : 'staff';
  const staffParam = paramOf(params, 'staff');
  const clientParam = paramOf(params, 'client');
  const staffSel = useMemo(() => selectionOf(staffParam), [staffParam]);
  const clientSel = useMemo(() => selectionOf(clientParam), [clientParam]);
  /** 〈利用者さん〉×曜日の表の絞り込み（PRD D108。?cf=。無ければこの週に訪問がある人） */
  const cfParam = paramOf(params, 'cf');

  const go = (next: Record<string, string | null>, replace = false) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace });
  };

  // ---- 選んでいる日付との同期（PRD D59）----
  // URL の ?d= で開いた日が選んでいる日付と違えば、選んでいる日付をその日にする
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の日が変わったときだけ
  useEffect(() => {
    if (isDate(rawD) && rawD !== date) setDate(rawD);
  }, [rawD]);
  // 上の日付の切り替えで選んでいる日付が変わったら、表示する週もその日を含む週にする
  const lastDate = useRef(date);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 選んでいる日付が変わったときだけ
  useEffect(() => {
    if (lastDate.current === date) return;
    lastDate.current = date;
    if (isDate(rawD) && rawD !== date) go({ d: date });
  }, [date]);

  /** 週を送る：選んでいる日付もその日にする（PRD D59。曜日はそのまま） */
  const goWeek = (d: string) => {
    lastDate.current = d;
    go({ d });
    setDate(d);
  };
  const setSel = (key: 'staff' | 'client', ids: string[] | null) => go({ [key]: ids === null ? null : ids.join(',') });
  const openDay = (d: string, visitId?: string) => {
    // 予定の画面へ移るので、表示する週は合わせない（合わせると ?d= を書く遷移が予定の画面への遷移を打ち消す）
    lastDate.current = d;
    setDate(d);
    navigate('/plan', visitId ? { state: { visitId } } : undefined);
  };
  return {
    date,
    today,
    anchor,
    dates,
    start,
    weekOptions,
    narrow,
    view,
    tab,
    by,
    staffSel,
    clientParam,
    clientSel,
    cfParam,
    go,
    goWeek,
    setSel,
    openDay,
  };
}

export type WeekNav = ReturnType<typeof useWeekNav>;
