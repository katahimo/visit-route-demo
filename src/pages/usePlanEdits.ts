// 日の予定の手直しと確定（PRD D74・D217・D218・D329・D346。ADR-0053）：訪問を担当へ移す・担当なしにする・ピンを外す・
// 受けられる人に入れる・訪問を取り消す・確定（伝えた）。どれも全体の「元に戻す」の1手。データを書くのは update（store）だけ
import { useEffect, useRef, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useHistoryOps, useUndoAction } from '../components/undo';
import type { useRouteSelection } from '../components/useRouteSelection';
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import { own } from '../lib/common';
import { confirmDay } from '../lib/confirmDay';
import { writeRoutes } from '../lib/dayPlan';
import { hardReasonLabels, notAllowedText } from '../lib/reassignMenu';
import { cancelVisitOp } from '../lib/visitOps';
import { bestInsertion } from '../matching';
import { placeVisit, type ReassignCandidate } from '../reassign';
import type { PlanData } from './usePlanData';
import { focusAfterMove } from './usePlanNav';

type Update = (fn: (d: DemoData) => DemoData, label?: string) => void;

/**
 * 書く：fn で書いたデータにする（全体の「元に戻す」の1手。label は手の名前。PRD D329）。変わらなければ false。
 * 書く前のデータはいちばん新しいもの（描き直しの前に続けて書いても前の手を消さない）
 */
export function useWriteWith(data: DemoData, update: Update) {
  const dataRef = useRef(data);
  dataRef.current = data;
  return (label: string, fn: (d: DemoData) => DemoData) => {
    const before = dataRef.current;
    const next = fn(before);
    if (next === before) return false;
    update((d) => (d === before ? next : fn(d)), label);
    return true;
  };
}

type EditArgs = {
  date: string;
  d: PlanData;
  sel: ReturnType<typeof useRouteSelection>;
  writeWith: ReturnType<typeof useWriteWith>;
  /** 計算中（描き直しの状態） */
  running: boolean;
  /** いま Worker が動いているか（確認のあとに見る） */
  busy: () => boolean;
};

/** 手直し：訪問を担当へ移す（最も費用の少ない位置に入れてピン）・担当なしにする・ピンを外す・受けられる人に入れる・取り消す */
export function usePlanEdits(x: EditArgs) {
  const { date, d, sel, writeWith, running } = x;
  const { problem, hasPlan, routes, pins, owner, staffName } = d;
  const toast = useToast();
  const confirmDialog = useConfirm();
  /** トーストの「元に戻す」（全体の履歴を1手戻す。PRD D218・D329） */
  const undoAction = useUndoAction();
  const historyOps = useHistoryOps();
  /** 担当の並びとピンを訪問に書く（手直し） */
  const writeDay = (
    p: Problem,
    nextRoutes: Record<string, string[]>,
    nextPins: Record<string, string>,
    label = '担当を替える',
  ) => writeWith(label, (data) => writeRoutes(data, date, p, nextRoutes, { pins: nextPins }));
  /**
   * 手直しのトーストの「元に戻す」：全体の履歴を1手戻し、トーストから押したら（ボタンが消えるので）戻した訪問の帯・カードへフォーカス
   * （from は戻したあとの担当。PRD D217）
   */
  const undoMove = (visitId: string, from: string | null) => ({
    ...undoAction,
    onClick: () => {
      const ae = document.activeElement;
      const fromToast = !ae || ae === document.body || !!ae.closest('.toast');
      historyOps.undo();
      sel.follow(visitId, from);
      if (fromToast) focusAfterMove(visitId, from);
    },
  });
  const moveTo = (visitId: string, staffId: string) => {
    if (!problem || !hasPlan || running) return;
    if (owner.get(visitId) === staffId && own(pins, visitId) === staffId) return;
    const p = problem;
    const prev = owner.get(visitId) ?? null;
    const saved = writeDay(p, owner.get(visitId) === staffId ? routes : bestInsertion(p, routes, visitId, staffId), {
      ...pins,
      [visitId]: staffId,
    });
    // 移した訪問を選んでいたら、地図の絞り込みを新しい担当に合わせる
    sel.follow(visitId, staffId);
    const opts = saved ? { action: undoMove(visitId, prev) } : undefined;
    if (!d.allowedFor(visitId, staffId)) {
      toast(
        `${staffName(staffId)}さんへ移しました。${notAllowedText(hardReasonLabels(p, visitId, staffId))}ので、要対応に出ます`,
        opts,
      );
    } else {
      toast(`${staffName(staffId)}さんへ移しました`, opts);
    }
  };
  /** 担当なしへ移す（列から外す。ピンは担当のピンなので外す） */
  const unassign = (visitId: string) => {
    if (!problem || !hasPlan || running || !owner.has(visitId)) return;
    const { [visitId]: _had, ...rest } = pins;
    const prev = owner.get(visitId) ?? null;
    const saved = writeDay(
      problem,
      Object.fromEntries(Object.entries(routes).map(([s, ids]) => [s, ids.filter((v) => v !== visitId)])),
      rest,
      '担当なしにする',
    );
    sel.follow(visitId, null);
    toast('担当なしにしました', saved ? { action: undoMove(visitId, prev) } : undefined);
  };
  const unpin = (visitId: string) => {
    if (!problem) return;
    const { [visitId]: _had, ...rest } = pins;
    writeDay(problem, routes, rest, 'ピンを外す');
  };
  /**
   * 担当なしの訪問を候補の人に入れる（ピン。時刻は変えない。間に合わなければ要対応の赤い枠）。
   * その人の既存の訪問の開始が遅れるときは確認を出す
   */
  const placeCandidate = async (visitId: string, c: ReassignCandidate) => {
    if (!problem || !hasPlan || running) return;
    const staffId = c.staffId;
    if (
      c.delayedCount > 0 &&
      !(await confirmDialog({
        title: `${staffName(staffId)}さんに入れますか？`,
        body: `${staffName(staffId)}さんの訪問 ${c.delayedCount}件の開始が最大 +${c.maxDelayMinutes}分 遅れます。`,
        confirmLabel: '遅れても入れる',
      }))
    )
      return;
    if (x.busy()) return;
    const p = problem;
    const saved = writeDay(
      p,
      placeVisit(p, routes, visitId, staffId),
      { ...pins, [visitId]: staffId },
      '受けられる人に入れる',
    );
    sel.follow(visitId, staffId);
    toast(`${staffName(staffId)}さんに入れました`, saved ? { action: undoMove(visitId, null) } : undefined);
  };
  /**
   * 訪問を取り消す（取り消しの欄・「欠勤・キャンセル」の欄で共通）。当日キャンセルなら取り消しの種類 'sameDay'
   * （回数を数えるだけ。請求はしない。ADR-0015）。ほかの担当はそのままで、この訪問は計算から外れる
   */
  const applyCancel = (visitId: string, sameDay: boolean) => {
    const v = d.m.allVisits.find((y) => y.id === visitId && !y.cancelled);
    if (!v) return;
    writeWith(sameDay ? '当日キャンセル' : '訪問を取り消す', (data) => cancelVisitOp(data, visitId, sameDay));
    toast(sameDay ? '当日キャンセルとして取り消しました' : '取り消しました', { action: undoAction });
  };
  return { moveTo, unassign, unpin, placeCandidate, applyCancel };
}

/** 取り消しの欄（PRD D74。日付を変えたら閉じる）：開いている訪問（null：閉じている）と、当日キャンセルか */
export function useCancelPanel(date: string, applyCancel: (visitId: string, sameDay: boolean) => void) {
  const [cancelFor, setCancelFor] = useState<Visit | null>(null);
  const [sameDay, setSameDay] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたら閉じる
  useEffect(() => {
    setCancelFor(null);
  }, [date]);
  return {
    cancelFor,
    sameDay,
    setSameDay,
    /** 取り消しの欄を開く（取り消しの種類を選ぶ。開くたびに「ふつうの取り消し」から） */
    open: (v: Visit) => {
      setCancelFor(v);
      setSameDay(false);
    },
    close: () => setCancelFor(null),
    /** 取り消しの欄の「取り消す」 */
    ok: () => {
      if (!cancelFor) return;
      applyCancel(cancelFor.id, sameDay);
      setCancelFor(null);
    },
  };
}

/** 確定＝〈スタッフ〉に伝えた内容（ADR-0053）：確定する・全員分のメールを作ったので確定する・未連絡の変更の連絡の一覧 */
export function useConfirmDay(x: { date: string; d: PlanData; update: Update; busy: () => boolean }) {
  const { date, d, update } = x;
  const { hasPlan, problem, toldState, issues, terms } = d;
  const toast = useToast();
  const confirmDialog = useConfirm();
  const undoAction = useUndoAction();
  /** 未連絡の変更の連絡の一覧を開いている（日付を変えたら閉じる） */
  const [toldOpen, setToldOpen] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたら閉じる
  useEffect(() => {
    setToldOpen(false);
  }, [date]);
  /** 確定を書く（伝えた日の訪問を全部取り消した日は、伝えた訪問は無し） */
  const write = (label: string) => {
    const p = hasPlan ? problem : null;
    const at = Date.now();
    update(
      (data) =>
        p
          ? confirmDay(data, date, p, at)
          : { ...data, snapshots: { ...data.snapshots, [date]: { date, at, visits: [] } } },
      label,
    );
    setToldOpen(false);
  };
  /** 確定する（伝えた内容を残す。確定したら true） */
  const adopt = async (): Promise<boolean> => {
    // 伝えた日の訪問を全部取り消した日も、「外れる」を伝えたら確定し直せる（伝えた訪問は無し）
    if ((!hasPlan || !problem) && toldState !== 'changed') return false;
    const care = hasPlan ? issues.size : 0;
    const ok = await confirmDialog({
      title:
        toldState === 'changed' ? '変更を伝えたので、確定し直しますか？' : 'この担当と時刻を伝えたので、確定しますか？',
      body: `${care > 0 ? `要対応の訪問が ${care}件あります。\n\n` : ''}今の担当と時刻を〈${terms.staff}〉に伝えた内容として残します。このあとに変えた訪問は「未連絡の変更」になり、連絡の一覧に出ます。`,
      confirmLabel: '確定する',
    });
    if (!ok) return false;
    if (x.busy()) return false;
    write('確定（伝えた）');
    toast('確定しました（伝えた内容を残しました）');
    return true;
  };
  /**
   * 全員分のメールを作った・Google で予約したので確定する（PRD D346・D368。確認は出さず、知らせの「元に戻す」で戻せる。
   * 予約は戻さない）。note は予約したときの知らせの文
   */
  const confirmByMail = (by: 'mail' | 'reserve' = 'mail', note?: string): boolean => {
    if ((!hasPlan || !problem) && toldState !== 'changed') return false;
    if (x.busy()) return false;
    write(by === 'reserve' ? '確定（メールを予約した）' : '確定（メールを作った）');
    const care = hasPlan ? issues.size : 0;
    const head =
      by === 'reserve'
        ? `${note ?? 'メールを予約しました'}。この日を確定（伝えた）にしました`
        : '全員分のメールを作ったので、この日を確定（伝えた）にしました';
    toast(`${head}${care > 0 ? `（要対応の訪問 ${care}件あり）` : ''}`, { action: undoAction });
    return true;
  };
  /**
   * 連絡した（expert 切。ADR-0073・PRD D382）：連絡の一覧の「連絡した」。今の担当・時刻を伝えた記録にする（確定と同じ書き方。
   * 確認は出さず、知らせの「元に戻す」で戻せる）。残せたら true
   */
  const contacted = (): boolean => {
    if ((!hasPlan || !problem) && toldState !== 'changed') return false;
    if (x.busy()) return false;
    write('連絡した');
    toast('連絡した内容を残しました', { action: undoAction });
    return true;
  };
  return { toldOpen, setToldOpen, adopt, confirmByMail, contacted };
}
