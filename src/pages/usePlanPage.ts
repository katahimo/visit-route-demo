// 日の予定（PRD D4・D316・D18。版2：ADR-0053）の状態と処理をまとめる：計算（usePlanData）・表示（usePlanView）・
// 移動とフォーカス（usePlanNav）・手直しと確定（usePlanEdits）・ドラッグ（usePlanDrag）・欠勤の振り直し（useReassignFlow）・
// 「欠勤・キャンセル」の欄（useSuddenFlow）。画面の部品はここで返すものだけを使う
import { useMemo } from 'react';
import { useDay } from '../components/day';
import { useMailLimit } from '../components/mailParts';
import { useToast } from '../components/Toast';
import { useConfirmStep, useFeature } from '../components/useFeature';
import { useRouteSelection } from '../components/useRouteSelection';
import { useToldEntry } from '../components/useToldEntry';
import { dayContactWords } from '../lib/contacts';
import { servedPairsBefore } from '../lib/firstVisit';
import { contactMailText, mailTo } from '../lib/mail';
import { usePlanData } from './usePlanData';
import { usePlanDrag } from './usePlanDrag';
import { useCancelPanel, useConfirmDay, usePlanEdits, useWriteWith } from './usePlanEdits';
import { colHeadOf, usePlanNav } from './usePlanNav';
import { useDayRows, usePlanMap, useStaffLines } from './usePlanShown';
import { usePlanView } from './usePlanView';
import { reassignShown, useReassignFlow } from './useReassignFlow';
import { useSuddenEntry, useSuddenFlow, useSuddenState } from './useSuddenFlow';

/** 切った機能の欄・ボタン・リンクは出さない（PRD D213。ADR-0028） */
function usePlanFeatures() {
  return {
    /** 稼働の見込み（の画面へ移るボタン・リンク） */
    workloadOn: useFeature('workload'),
    /**
     * 画面の中の欄・ボタン（ADR-0028）：欠勤・キャンセル（操作の行・列の見出し・当日キャンセルの選択）、メール（ボタン・欄・連絡の一覧）、
     * 条件の重み（点数の横の理由）。欠勤の印・帯（事実）は残す
     */
    suddenOn: useFeature('sudden'),
    mailOn: useFeature('mail'),
    rulesOn: useFeature('rules'),
    compatOn: useFeature('compat'),
    /** 確定（伝えた）の段階（expert 入。切なら自動で決まり、確定のボタンなどは出さない。ADR-0073） */
    confirmStep: useConfirmStep(),
    /** 訪問先の決まりごと（初めての訪問先の連絡文に添える。PRD D415） */
    notesOn: useFeature('visitNotes'),
  };
}

/** 日の予定の状態と処理 */
export function usePlanPage() {
  const { date, setDate, dates } = useDay();
  const d = usePlanData(date);
  const f = usePlanFeatures();
  const toast = useToast();
  const v = usePlanView(date);
  /** 地図で見る担当・強調する区間・選んだ訪問（列の見出し・凡例・訪問・区間を押す） */
  const sel = useRouteSelection(date, (_set, id) => d.owner.get(id));
  /** 「欠勤・キャンセル」の欄の開け閉め（PRD D167〜D172） */
  const suddenState = useSuddenState(date);
  useSuddenEntry({
    date,
    setDate,
    knownStaff: (sid) => d.data.staff.some((s) => s.id === sid),
    works: (sid) => (d.slotsOf.get(sid)?.baseSlots.length ?? 0) > 0,
    open: suddenState.open,
  });
  const nav = usePlanNav({ date, setDate, d, v, sel });
  const writeWith = useWriteWith(d.data, d.update);
  // ---- 急な欠勤と振り直し（ADR-0011。PRD D26〜D35）：差の欄・案A／案B・連絡の一覧・振り直す前に戻す ----
  const flow = useReassignFlow({
    date,
    data: d.data,
    update: d.update,
    writeWith,
    problem: d.problem,
    routes: d.routes,
    hasPlan: d.hasPlan,
    compileInput: d.compileInput,
    scoreProblem: d.scoreProblem,
    scoreScale: d.scoreScale,
    staffName: d.staffName,
    visitById: d.visitById,
    resetSelection: sel.reset,
    closeSudden: () => suddenState.setSudden(null),
  });
  const running = !!flow.planRun.running;
  const busy = flow.planRun.busy;
  const edits = usePlanEdits({ date, d, sel, writeWith, running, busy });
  const cancel = useCancelPanel(date, edits.applyCancel);
  const confirm = useConfirmDay({ date, d, update: d.update, busy });
  // 週・月の「変更あり」の印から（?do=told）：その日の連絡の一覧を開く。日付を変えると閉じる処理（useConfirmDay）のあとに置く
  useToldEntry({
    date,
    setDate,
    canOpen: d.toldState === 'changed',
    open: () => confirm.setToldOpen(true),
  });
  const drag = usePlanDrag({ owner: d.owner, running, moveTo: edits.moveTo, unassign: edits.unassign });
  /** この端末の mailto の長さの目安（ADR-0017） */
  const mailLimit = useMailLimit();
  /** 過去8週に担当した組（初めての訪問先の印と決まりごと。PRD D415） */
  const served = useMemo(() => servedPairsBefore(d.data, date), [d.data, date]);
  const contact = {
    words: dayContactWords({
      date,
      staffWord: d.terms.staff,
      orgName: d.data.org.name,
      staffName: d.staffName,
      clientById: d.clientById,
      visits: d.m.allVisits,
      served,
      notesOn: f.notesOn,
    }),
    /** 〈スタッフ〉あての連絡のメール（PRD D94。メールを切っていれば出さない） */
    staffMail: f.mailOn
      ? (staffId: string, text: string) =>
          mailTo(d.staffById.get(staffId)?.email ?? '', contactMailText(d.data.org, date, text), mailLimit)
      : undefined,
    onCopied: (ok: boolean, what: string) =>
      toast(ok ? `${what}をコピーしました` : 'コピーできませんでした。文を選んでコピーしてください'),
  };
  // ---- 「欠勤・キャンセル」の欄（PRD D167〜D172）：選択肢・訪問の担当・2段目の振り直しの結果と連絡 ----
  const sudden = useSuddenFlow({
    date,
    data: d.data,
    update: d.update,
    terms: d.terms,
    state: suddenState,
    flow,
    day: {
      staff: d.staff,
      slotsOf: d.slotsOf,
      visits: d.visits,
      visitById: d.visitById,
      clientById: d.clientById,
      staffName: d.staffName,
      visitLabel: d.visitLabel,
    },
    plan: {
      problem: d.problem,
      routes: d.routes,
      hasPlan: d.hasPlan,
      owner: d.owner,
      startOf: (id) => d.explained.get(id)?.timing?.start ?? null,
      told: d.told,
      toldState: d.toldState,
    },
    contactWords: contact.words,
    applyCancel: edits.applyCancel,
    adopt: confirm.adopt,
    confirmStep: f.confirmStep,
    staffMail: contact.staffMail,
    onCopied: contact.onCopied,
    colHeadOf,
  });
  const map = usePlanMap(d, sel, flow.marks);
  const dayRows = useDayRows(d, v.compact);
  const staffLines = useStaffLines(d);
  return {
    date,
    setDate,
    dates,
    d,
    f,
    v,
    sel,
    nav,
    flow,
    shown: reassignShown(flow, d.visitById),
    running,
    edits,
    cancel,
    confirm,
    drag,
    contact,
    served,
    sudden,
    suddenState,
    map,
    dayRows,
    staffLines,
  };
}

export type PlanCtx = ReturnType<typeof usePlanPage>;
