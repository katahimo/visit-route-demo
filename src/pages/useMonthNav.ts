// 月の画面の URL と選んでいる日付（PRD D59・D189・D347）：表示する月（?ym=）・見せ方（?layout=）・URL の一部だけ変える・
// 月を送る・日の予定や要対応の行き先へ移る。選んでいる日付と表示する月を合わせる
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDay } from '../components/day';
import { useMedia } from '../components/useMedia';
import { jstDate } from '../domain/time';
import { ymText } from '../lib/dateText';
import type { LinkTarget } from '../lib/links';
import { MONTH_LAYOUT_PARAM, MONTH_LIST_QUERY, type MonthLayout, monthLayoutOf } from '../lib/monthList';
import { firstDayOf, isYm, ymOf } from '../lib/ym';

/** URL の一部の変え方（null は消す） */
export type ParamsPatch = Record<string, string | null>;

export function useMonthNav() {
  const { date, setDate, dates: dataDates } = useDay();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = jstDate(Date.now());
  const raw = params.get('ym') ?? '';
  const ym = isYm(raw) ? raw : ymOf(date);
  /** 月の見せ方（PRD D189）：URL の ?layout= か、無ければ幅（600px 以下は日ごとの一覧）。データには保存しない */
  const narrowList = useMedia(MONTH_LIST_QUERY);
  const layout = monthLayoutOf(params.get(MONTH_LAYOUT_PARAM), narrowList);

  /** URL の一部だけ変える（ほかの値は残す） */
  const patchParams = (patch: ParamsPatch) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  };

  // ---- 選んでいる日付との同期（PRD D59）----
  // URL の ?ym= で開いた月が選んでいる日付の月と違えば、選んでいる日付をその月に合わせる（その月の1日、今月なら今日）
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の月が変わったときだけ
  useEffect(() => {
    if (isYm(raw) && ymOf(date) !== raw) setDate(firstDayOf(raw, today));
  }, [raw]);
  // 上の日付の切り替えで選んでいる日付が別の月になったら、表示する月も合わせる
  const lastDate = useRef(date);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 選んでいる日付が変わったときだけ
  useEffect(() => {
    if (lastDate.current === date) return;
    lastDate.current = date;
    if (isYm(raw) && ymOf(date) !== raw) patchParams({ ym: ymOf(date) });
  }, [date]);

  /** カレンダーと一覧を切り替える（押したら幅の既定と同じでも URL に書く。PRD D189） */
  const pickLayout = (next: MonthLayout) => {
    if (next === layout) return;
    patchParams({ [MONTH_LAYOUT_PARAM]: next });
  };
  /** 月を選ぶ欄の月（データの日付の月。PRD D347） */
  const monthOptions = useMemo(
    () => [...new Set([...dataDates.map(ymOf), ym])].sort().map((v) => ({ value: v, text: ymText(v) })),
    [dataDates, ym],
  );
  /** 月を送る：選んでいる日付もその月の1日（今月なら今日）にする（PRD D59） */
  const goMonth = (next: string) => {
    const d = firstDayOf(next, today);
    lastDate.current = d;
    patchParams({ ym: next });
    setDate(d);
  };
  /** その日の「日の予定」へ */
  const openDay = useCallback(
    (d: string) => {
      // 予定の画面へ移るので、表示する月は合わせない（合わせると ?ym= を書く遷移が予定の画面への遷移を打ち消す）
      lastDate.current = d;
      setDate(d);
      navigate('/plan');
    },
    [setDate, navigate],
  );
  /** 要対応の1行の行き先へ移る（PRD D201。行き先は lib/links の attentionTarget。日付も選んでおく） */
  const openTarget = (t: LinkTarget) => {
    lastDate.current = t.date;
    setDate(t.date);
    navigate(t.to);
  };

  return {
    date,
    today,
    ym,
    params,
    navigate,
    narrowList,
    layout,
    monthOptions,
    patchParams,
    pickLayout,
    goMonth,
    openDay,
    openTarget,
  };
}

export type MonthNav = ReturnType<typeof useMonthNav>;
