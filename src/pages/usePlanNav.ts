// 日の予定の移動とフォーカス：訪問の詳細の欄を開く・列や帯へ巻く・「見る」・URL の入口（?date=・?do=unassigned）・
// 週間の帯から開いた訪問・時間軸の帯のキーボード（PRD D201・D204・D217・D301・D333・D345）
import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { focusUndo, undoFocusTarget } from '../components/undo';
import type { useRouteSelection } from '../components/useRouteSelection';
import { useOpenVisit } from '../components/VisitPanel';
import { useVisitKeys } from '../components/visitKeys';
import { isDate } from '../lib/isDate';
import { UNASSIGNED_DO } from '../lib/links';
import { scrollBehavior } from '../lib/motion';
import type { PlanData } from './usePlanData';
import type { PlanView } from './usePlanView';

/** 画面を移るときの state（週の帯・要対応の帯から開く訪問）から訪問の ID */
const visitIdOf = (state: unknown): string | null => (state as { visitId?: string } | null)?.visitId ?? null;
/** 要対応の帯の「見に行く」から来たか（担当なしの訪問は選べないので欄を開く。PRD D403） */
const fromBandOf = (state: unknown): boolean => (state as { band?: boolean } | null)?.band === true;

/** 予定の画面の地図・選択で使うルートの集まりのキー（今の担当の並びは1つだけ） */
export const PLAN_SET = 'plan';

type RouteSel = ReturnType<typeof useRouteSelection>;

/** 列の見出し（欠勤の欄を閉じたとき・移したあとのフォーカスの戻り先） */
export const colHeadOf = (sid: string) =>
  document.querySelector<HTMLElement>(`.route-col[data-staff="${CSS.escape(sid)}"] .col-focus`);

/** 時間軸の帯にフォーカスを戻す（キーで動かしたあと。日付を移ったときは描き終わるまで待つ） */
export function focusBand(visitId: string) {
  let n = 0;
  const tick = () => {
    const el = document.querySelector<HTMLElement>(`.tl-band[data-visit="${CSS.escape(visitId)}"] .tl-band-btn`);
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    if (++n < 30) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * 「担当を変える ▾」で移したあとのフォーカス（PRD D217）：選んだ項目・ボタンは移した訪問の詳細ごと消える（列が替わる・
 * 選択が外れる）ので、移した先のカード、無ければ「元に戻す」、それも無ければ移した先の列の見出しへ
 */
export function focusAfterMove(visitId: string, staffId: string | null) {
  requestAnimationFrame(() => {
    const v = CSS.escape(visitId);
    const target =
      document.querySelector<HTMLElement>(
        `.route-item[data-visit="${v}"] .route-btn, .tl-band[data-visit="${v}"] .tl-band-btn`,
      ) ??
      undoFocusTarget() ??
      (staffId ? colHeadOf(staffId) : null);
    target?.focus();
  });
}

/** 列・担当なしの列・帯へ巻く（担当ごとの1日・「見る」・帯の近道） */
function useGoTo(d: PlanData, v: PlanView, sel: RouteSel) {
  const { shownView, setView, noneColId } = v;
  /**
   * 担当ごとの1日から（PRD D84。一覧のときは担当ごとの表示に切り替えてから）：その人を選んで（列の見出しを押したときと同じ。
   * 地図もその人に絞る）列へ移り、列の見出しにフォーカス。visitId があればその訪問を選んで（カードを押したときと同じ。
   * 選んだままなら外さず、地図をその人に絞り直す）列の中のカードへ移る
   */
  const goToStaff = (sid: string, visitId?: string) => {
    if (shownView === 'list' || shownView === 'day') setView('timeline');
    if (visitId) {
      const x = { id: visitId, set: PLAN_SET };
      if (sel.isPicked(x)) sel.focusOn(sid);
      else sel.togglePick(x);
    } else sel.focusOn(sid);
    requestAnimationFrame(() => {
      const col = document.querySelector<HTMLElement>(`.route-col[data-staff="${CSS.escape(sid)}"]`);
      const card = visitId ? col?.querySelector<HTMLElement>(`[data-visit="${CSS.escape(visitId)}"]`) : null;
      if (card) {
        card.scrollIntoView({ behavior: scrollBehavior(), block: 'center', inline: 'nearest' });
        return;
      }
      col?.scrollIntoView({ behavior: scrollBehavior(), block: 'start', inline: 'nearest' });
      colHeadOf(sid)?.focus({ preventScroll: true });
    });
  };
  /** 担当なしの訪問の列へ移る（帯の近道。一覧のときは担当ごとの表示に切り替えてから） */
  const goToNone = () => {
    // スマホの日ごとのリストは、最初の担当なしの行へ巻く
    if (shownView === 'day') {
      requestAnimationFrame(() =>
        document
          .querySelector('.day-row.is-unassigned')
          ?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }),
      );
      return;
    }
    if (shownView === 'list') setView('timeline');
    requestAnimationFrame(() =>
      document.getElementById(noneColId)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }),
    );
  };
  /** 「見る」（入らない訪問）：担当なしの列へ移り、その訪問を選ぶ（選んだままなら外さない） */
  const lookNone = (id: string) => {
    // スマホの日ごとのリストは表示を変えず、その行へ巻く（「担当なしの列へ」と同じ）
    if (shownView === 'day') {
      requestAnimationFrame(() =>
        document
          .querySelector(`.day-row[data-visit="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }),
      );
      return;
    }
    if (shownView === 'list') setView('timeline');
    const x = { id, set: PLAN_SET };
    if (!sel.isPicked(x)) sel.togglePick(x);
    requestAnimationFrame(() => {
      const col = document.getElementById(noneColId);
      const card = col?.querySelector<HTMLElement>(`[data-visit="${CSS.escape(id)}"]`);
      (card ?? col)?.scrollIntoView({ behavior: scrollBehavior(), block: 'center', inline: 'nearest' });
    });
  };
  /** 「見る」（担当のある訪問）：その人の列の訪問を選んで見える所へ（担当ごとの1日から移るときと同じ） */
  const lookAt = (id: string) => {
    const sid = d.owner.get(id);
    if (sid) goToStaff(sid, id);
    else lookNone(id);
  };
  return { goToStaff, goToNone, lookNone, lookAt };
}

/**
 * URL の入口：?date= だけのリンク（空き状況の「その日の予定を見る」。PRD D204）はその日を選んで ?date= を消す。
 * 月の要対応の「担当なし」から（?date=…&do=unassigned。PRD D201）はその日を選び、URL から ?date= と ?do= を消し、
 * 担当なしの訪問の列へ巻く（1回だけ。担当なしの訪問が無くなっていれば巻かない）
 */
function useUrlEntry(date: string, setDate: (d: string) => void, d: PlanData, goToNone: () => void) {
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
  const pendingNone = useRef<string | null>(null);
  /** ?do=unassigned を受けた回数（同じ日を開いたままでも、巻く effect を走らせる） */
  const [noneAsked, setNoneAsked] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ?do= が付いたときだけ
  useEffect(() => {
    if (doParam !== UNASSIGNED_DO) return;
    const raw = params.get('date');
    const target = raw && isDate(raw) ? raw : date;
    if (target !== date) setDate(target);
    pendingNone.current = target;
    setNoneAsked((n) => n + 1);
    setParams(
      (p) => {
        p.delete('do');
        p.delete('date');
        return p;
      },
      { replace: true },
    );
  }, [doParam]);
  // ?do=unassigned を受けた日（PRD D201）：並びが出ていれば1回だけ巻く。担当なしの訪問が無いときは巻かずに終える
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付・並びが変わったときだけ
  useEffect(() => {
    if (pendingNone.current === null || pendingNone.current !== date || !d.problem) return;
    pendingNone.current = null;
    if (d.unassigned.length > 0) goToNone();
  }, [date, d.problem, d.unassigned.length, noneAsked]);
}

/** 日の予定の移動とフォーカス */
export function usePlanNav(x: { date: string; setDate: (d: string) => void; d: PlanData; v: PlanView; sel: RouteSel }) {
  const { date, setDate, d, v, sel } = x;
  /** 訪問の詳細の欄（PRD D301〜D304。App の殻の欄を開く） */
  const openVisitPanel = useOpenVisit();
  const location = useLocation();
  const go = useGoTo(d, v, sel);
  /**
   * 訪問の詳細の欄を開く（PRD D301。null は新しい訪問をこの日に）。閉じたあとのフォーカスは開いた帯・カード（保存で作り直した回は
   * 新しい ID の帯）、無ければ一覧の行の「開く」、それも無ければ開く前の要素
   */
  const openVisit = (id: string | null) =>
    openVisitPanel({
      ...(id ? { visitId: id } : { newVisit: { date } }),
      returnFocus: (vid) => {
        const vv = vid ? CSS.escape(vid) : null;
        const el = vv
          ? document.querySelector<HTMLElement>(
              `.tl-band[data-visit="${vv}"] .tl-band-btn, .route-item[data-visit="${vv}"] .route-btn, [data-testid="visit-row-open"][data-visit="${vv}"], .day-row[data-visit="${vv}"]`,
            )
          : null;
        // 新しく足したときは「訪問を追加」のボタンへ（スマホの「その他 ▾」は閉じた一覧の項目の代わりに「その他」のボタンへ）
        return (
          el ??
          (id ? null : document.querySelector<HTMLElement>('[data-testid="plan-visit-add"], [data-testid="plan-more"]'))
        );
      },
    });
  useUrlEntry(date, setDate, d, go.goToNone);
  /** 週間の帯・要対応の帯から開いたときに選ぶ訪問（並びが出たら1回だけ選んで見える所へ） */
  const wantVisit = useRef<string | null>(visitIdOf(location.state));
  const wantOpen = useRef(fromBandOf(location.state));
  const [wantTick, setWantTick] = useState(0);
  // 日の予定を開いたまま移ってきたとき（要対応の帯を日の予定で押したとき）も受ける（開いたときの state は初期値で読む）
  const seenKey = useRef(location.key);
  useEffect(() => {
    if (seenKey.current === location.key) return;
    seenKey.current = location.key;
    wantVisit.current = visitIdOf(location.state);
    wantOpen.current = fromBandOf(location.state);
    setWantTick((n) => n + 1);
  }, [location.key, location.state]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 並びが出たとき・新しく頼まれたときに1回だけ
  useEffect(() => {
    const id = wantVisit.current;
    // 日付を移した直後は前の日の並び：その訪問がこの日にあるときだけ受ける
    if (!id || !d.hasPlan || !d.visitById.has(id)) return;
    wantVisit.current = null;
    const band = wantOpen.current;
    wantOpen.current = false;
    // 受けた state は履歴から消す（戻る・読み直しで欄をもう一度開かない。React Router の今の location はそのまま）
    if ((window.history.state as { usr?: unknown } | null)?.usr)
      window.history.replaceState({ ...window.history.state, usr: null }, '');
    const sid = d.owner.get(id);
    if (band) {
      // 要対応の帯から（PRD D403）：担当のある訪問はその人の列で選んで巻く（選んだままなら絞り直してフォーカス。一覧なら時間軸へ）、
      // 担当なしの訪問は担当の列に無く選べないので欄（受けられる人）を開く（同じ日を見ていても画面が変わる）
      if (sid) go.goToStaff(sid, id);
      else openVisit(id);
      return;
    }
    const x = { id, set: PLAN_SET };
    if (sid && !sel.isPicked(x)) sel.togglePick(x);
    requestAnimationFrame(() =>
      document.querySelector(`[data-visit="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center' }),
    );
  }, [d.hasPlan, d.owner, wantTick]);
  /** キーで動かしたあと（日付を移ったらその日へ、フォーカスは動かした帯） */
  const onKeyMoved = (r: { date: string; visitId: string }) => {
    if (r.date !== date) setDate(r.date);
    focusBand(r.visitId);
  };
  /**
   * 時間軸の帯のキーボード（PRD D333）：↑↓ 15分・←→ 1日（その日の予定へ移る）・Shift+←→ 隣の担当の列（列の順）・Enter で欄・
   * Delete で取り消し（確認）。どれも全体の「元に戻す」の1手。動かしたらフォーカスは動かした帯、取り消したら「元に戻す」
   */
  const visitKeys = useVisitKeys({
    staffOrder: () => d.columns,
    onOpen: (id) => openVisit(id),
    onMoved: onKeyMoved,
    onCancelled: focusUndo,
  });
  return { ...go, openVisit, visitKeys, onKeyMoved };
}
