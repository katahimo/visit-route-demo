// 月の画面の右の欄（選ばないとき。PRD D143・D153・D223）：要対応／確定していない日の切り替えと、そこへ移る（帯の数字・ボタン、
// 週・日の帯・要対応の帯から来たときの ?do=）、問題の無い日をまとめて確定
import { useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useBulkConfirm } from '../components/useBulkConfirm';
import { useConfirmStep } from '../components/useFeature';
import type { Problem } from '../contracts/problem';
import type { BulkConfirm } from '../lib/confirmDay';
import { scrollBehavior } from '../lib/motion';
import { type BandOp, bandHref } from '../lib/progressBand';
import type { ParamsPatch } from './useMonthNav';

export type AsideView = 'attention' | 'unconfirmed';

export function useMonthAside(x: {
  ym: string;
  params: URLSearchParams;
  navigate: NavigateFunction;
  patchParams: (patch: ParamsPatch) => void;
  /** 全体の表示にする（extra は一緒に URL から消すもの） */
  showAll: (extra?: ParamsPatch) => void;
  problemOf: (date: string) => Problem | null | undefined;
  bulk: BulkConfirm;
}) {
  const { ym, navigate } = x;
  /** 確定（伝えた）の段階を出すか（expert 入）。切なら「確定していない日」の欄は無く、行き先は要対応にする（ADR-0073） */
  const confirmStep = useConfirmStep();
  const viewOf = (view: AsideView): AsideView => (view === 'unconfirmed' && !confirmStep ? 'attention' : view);
  /** 選ばないときの右の欄：要対応／確定していない日（進み具合の帯の「確定」から。PRD D153） */
  const [asideView, setAsideView] = useState<AsideView>('attention');
  const asideRef = useRef<HTMLElement>(null);
  /** 右の欄へ移る（要対応・確定していない日） */
  const showAside = (view: AsideView, extra: ParamsPatch = {}) => {
    // 全体の表示にする（pickFocus('all') と同じ。extra は一緒に URL から消すもの）
    x.showAll(extra);
    setAsideView(view);
    requestAnimationFrame(() => {
      asideRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      asideRef.current?.focus({ preventScroll: true });
    });
  };
  /** 帯の数字・ボタン：担当を組むは担当を組むの画面へ（その月。ADR-0063）、ほかはこの画面の中で欄を開く */
  const onBandOp = (op: BandOp) => {
    if (op === 'batch') navigate(bandHref(ym, 'batch'));
    else showAside(viewOf(op));
  };

  // ---- 週・日の帯・要対応の帯から来たときの操作（PRD D153・D404。?do=）----
  // batch（古いリンク）：担当を組むの画面へ移す。attention・unconfirmed：右の欄の要対応・確定していない日へ。
  // 1回だけ行い、URL から ?do= を消す（戻る・再読込で繰り返さない）
  const doParam = x.params.get('do');
  // biome-ignore lint/correctness/useExhaustiveDependencies: ?do= が付いたときだけ
  useEffect(() => {
    if (doParam === null) return;
    if (doParam === 'attention' || doParam === 'unconfirmed') {
      showAside(viewOf(doParam), { do: null });
      return;
    }
    if (doParam === 'batch') {
      navigate(bandHref(ym, 'batch'), { replace: true });
      return;
    }
    x.patchParams({ do: null });
  }, [doParam]);

  /**
   * まとめて確定：独自の確認（日付と残す日）のあと、1回の update で日ごとに日の画面の「この割当で確定」と同じ書き方
   * （lib/confirmDay）。問題は日の状態を数えたときのもの（計算に入れる訪問は条件の重みに依らない）。作っている間は押せない
   */
  const runBulkConfirm = useBulkConfirm(
    x.problemOf,
    // 押したボタンは0日になって押せなくなるので、フォーカスは右の欄へ（確定していない日の一覧の先頭から読める）
    () => asideRef.current?.focus({ preventScroll: true }),
  );
  const confirmBulk = () => runBulkConfirm(x.bulk);

  return { asideView, setAsideView, asideRef, onBandOp, hasTarget: doParam !== null, confirmBulk };
}

export type MonthAside = ReturnType<typeof useMonthAside>;
