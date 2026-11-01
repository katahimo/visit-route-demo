// 日の予定の欠勤の振り直し（ADR-0011。PRD D26〜D35）の状態と処理：登録して振り直す・差の欄・案A／案B・連絡の一覧・
// 振り直す前に戻す。計算は lib/planReassign と reassign、Worker は usePlanRun。データを書くのは update（store）だけ
import { type ComponentProps, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useHistoryOps, useUndoAction } from '../components/undo';
import type { DemoData, ReassignInfo } from '../contracts/data';
import type { Absence, Visit } from '../contracts/documents';
import type { Problem, ScoreScale } from '../contracts/problem';
import { timeText } from '../domain/availability';
import { applyReassign, baseOf, chooseReassign, revertReassign, saveAbsence } from '../lib/absences';
import { attempt, own } from '../lib/common';
import { contactCount } from '../lib/contacts';
import { pointsOf } from '../lib/dayPlan';
import { appHistory } from '../lib/history';
import { scrollBehavior } from '../lib/motion';
import {
  absentStaffOf,
  annealDisabledWhy,
  annealKeyOf,
  planAOf,
  planAResultOf,
  planReassign,
  reassignMarksOf,
  routesOfIds,
} from '../lib/planReassign';
import { type CompileInput, compile } from '../matching';
import {
  type ContactList,
  contactsOf,
  leftOf,
  prepareAnneal,
  type ReassignResult,
  type Routes,
  reassignDiff,
  STAY_WEIGHT_DEFAULT,
  settleAnneal,
  targetsOf,
} from '../reassign';
import { leftReasonText } from './absenceParts';
import type { LeftContact } from './contactPanel';
import type { AnnealBox, ReassignOption } from './reassignParts';
import { type PlanRun, usePlanRun } from './usePlanRun';

/** 振り直しの手の名前（「振り直す前に戻す」は直前の手がこの日のこれのときだけ全体の「元に戻す」で戻す） */
const REASSIGN_LABEL = '欠勤の振り直し';

type Update = (fn: (d: DemoData) => DemoData, label?: string) => void;
type WriteWith = (label: string, fn: (d: DemoData) => DemoData) => boolean;

type FlowArgs = {
  date: string;
  data: DemoData;
  update: Update;
  /** fn で書いたデータにする（全体の「元に戻す」の1手。変わらなければ false） */
  writeWith: WriteWith;
  problem: Problem | null;
  /** 今の担当の並び */
  routes: Routes;
  hasPlan: boolean;
  compileInput: CompileInput;
  scoreProblem: Problem | null;
  scoreScale: ScoreScale | null;
  staffName: (id: string) => string;
  visitById: Map<string, Visit>;
  /** 選んだ訪問・区間を外す（振り直し・案の切り替えのあと） */
  resetSelection: () => void;
  /** 「欠勤・キャンセル」の欄を閉じる（欄の外から振り直したとき） */
  closeSudden: () => void;
};

/** 振り直しの差（振り直しの情報・振り直す前の問題・差・印・欠勤の人に残る訪問・案A・連絡の一覧） */
function useReassignView(x: Pick<FlowArgs, 'date' | 'data' | 'problem' | 'routes' | 'compileInput'>) {
  const { date, data, problem, routes, compileInput } = x;
  /** その日の振り直しの情報（振り直しの提案を反映した日） */
  const info = own(data.reassigns, date) ?? null;
  /** 振り直す前の時刻を出す問題（振り直しに使った欠勤を除いたデータで compile。差・案B・連絡の一覧の before） */
  const before = useMemo(() => {
    if (!info) return null;
    const used = new Set(info.absenceIds);
    return (
      attempt(() => compile({ ...compileInput, absences: compileInput.absences.filter((a) => !used.has(a.id)) }, date))
        .value ?? null
    );
  }, [info, compileInput, date]);
  const diff = useMemo(() => {
    if (!info || !problem || !before) return null;
    return attempt(() => reassignDiff({ problem: before, routes: info.baseRoutes }, { problem, routes })).value ?? null;
  }, [info, before, problem, routes]);
  /** 代行（訪問ID → 元の担当）・開始の変化（訪問ID → 分）・変わる人・地図で太くする訪問 */
  const marks = useMemo(() => reassignMarksOf(diff), [diff]);
  /** 振り直しに使った欠勤が取り消されている */
  const cancelled = !!info?.absenceIds.some((id) => !data.absences.some((a) => a.id === id));
  /** 振り直しに使った欠勤の人（まだある欠勤） */
  const absentStaff = useMemo(() => absentStaffOf(info, data.absences, date), [info, data.absences, date]);
  /** 欠勤の人に残る、欠勤と重なる訪問（手直しで戻した等。leftOf） */
  const left = useMemo(() => {
    if (!info || !problem || !before || absentStaff.size === 0) return [];
    return attempt(() => leftOf(problem, { problem: before, routes }, [...absentStaff])).value ?? [];
  }, [info, problem, before, absentStaff, routes]);
  const leftById = useMemo(() => new Map(left.map((v) => [v.visitId, v])), [left]);
  /** 案A の列（振り直した直後） */
  const planA = useMemo(() => (info && problem ? planAOf(info, problem, routes) : null), [info, problem, routes]);
  /** 連絡の一覧（振り直す前と今の差。確定前でも見られる） */
  const contacts = useMemo((): ContactList | null => {
    if (!info || !problem || !before) return null;
    return attempt(() => contactsOf({ problem: before, routes: info.baseRoutes }, { problem, routes })).value ?? null;
  }, [info, before, problem, routes]);
  return { info, before, diff, marks, cancelled, absentStaff, left, leftById, planA, contacts };
}

type ReassignView = ReturnType<typeof useReassignView>;

/** 作った案B（その場だけ。保存しない。決定2） */
type AnnealMade = { key: string; weight: number; result: ReassignResult; stopped: boolean };

/** 案B「少し動かしてよい」（PRD D34。ADR-0011）：重み・作る・作った案B・案B を案A のままにした理由 */
function useAnneal(x: FlowArgs & { view: ReassignView; planRun: PlanRun; setError: (e: string | null) => void }) {
  const { date, problem, view, planRun, setError, staffName } = x;
  const toast = useToast();
  /** 「変更を減らす」の重み（反映した振り直しが案B ならその重み） */
  const [stayWeight, setStayWeight] = useState<number>(STAY_WEIGHT_DEFAULT);
  useEffect(() => {
    if (view.info?.stayWeight !== undefined) setStayWeight(view.info.stayWeight);
  }, [view.info?.stayWeight]);
  /** 案B を案A のままにした理由（settleAnneal。key が今の振り直しと違えば見せない） */
  const [annealNote, setAnnealNote] = useState<{ key: string; text: string } | null>(null);
  const [made, setMade] = useState<AnnealMade | null>(null);
  /** 今の振り直し（元の案・欠勤・案A）のキー。案B の結果がこの振り直しのものか */
  const key = annealKeyOf(date, view.info);
  const anneal = made && made.key === key ? made : null;
  const note = annealNote && annealNote.key === key ? annealNote.text : null;
  const disabled = annealDisabledWhy({
    info: view.info,
    cancelled: view.cancelled,
    planA: view.planA,
    otherRunning: !!planRun.running && planRun.running !== 'anneal',
  });
  /** 案B を Worker で作る（進み具合・止める）。初期解は案A。作った案B はその場だけ（選ぶと訪問に書く） */
  const start = () => {
    const { info, before: reassignBefore, planA } = view;
    if (!problem || !info || !reassignBefore || !planA || planRun.running || disabled) return;
    setError(null);
    const before = { problem: reassignBefore, routes: info.baseRoutes };
    const weight = stayWeight;
    const k = key ?? '';
    const prep = attempt(() =>
      prepareAnneal(problem, before, planA, targetsOf(problem, before, [...view.absentStaff]), { weight }),
    );
    if (!prep.value) {
      setError(`案B を作れませんでした（${prep.error}）`);
      return;
    }
    const p = prep.value;
    // 案A の列が使えない人（必須の違反・回れない列）は、その列だけ案A のまま動かさずに作る
    const heldText =
      p.held.length > 0
        ? `${p.held.map(staffName).join('・')}さんの列は案A に守れない条件があるため、案A のまま動かしていません（その列は手で直してください）`
        : null;
    setAnnealNote(heldText ? { key: k, text: heldText } : null);
    planRun.run(
      'anneal',
      p.problem,
      '少し動かす',
      (res) => {
        // 保険：案A に入っていた訪問を落とした・案A より良くならないときは案B として出さない（案A のまま）
        const settled = attempt(() => settleAnneal(p, res.routes));
        if (!settled.value) {
          setError(`案B を作れませんでした（${settled.error}）`);
          return;
        }
        const got = settled.value;
        if (!got.ok) {
          const text =
            got.reason === 'keepDropped'
              ? `案B が、案A に入っていた訪問（${got.visitIds.length}件）を外してしまったため、案A のままにしました`
              : '案A を超えられませんでした（案A のままにしました）';
          setAnnealNote({ key: k, text: heldText ? `${text}。${heldText}` : text });
          toast(text);
          return;
        }
        setMade({ key: k, weight, result: got.result, stopped: res.stopped });
        const sameAsA = JSON.stringify(got.result.routes) === JSON.stringify(planA);
        toast(
          sameAsA
            ? '案B は案A と同じになりました。動かしても良くなりませんでした'
            : res.stopped
              ? '途中までの案B を出しました。案A と比べて選んでください'
              : '案B を作りました。案A と比べて選んでください',
        );
      },
      p.initial,
    );
  };
  return { stayWeight, setStayWeight, anneal, note, disabled, start, clear: () => setMade(null) };
}

type Anneal = ReturnType<typeof useAnneal>;

/** 案A・案B の比べる数（元の案との差・点数の基準の物差しの点数）と、どちらかを反映する */
function useReassignOptions(x: FlowArgs & { view: ReassignView; anneal: Anneal; planRun: PlanRun }) {
  const { date, problem, routes, view, anneal: a, planRun, scoreProblem, scoreScale } = x;
  const toast = useToast();
  const confirmDialog = useConfirm();
  const undoAction = useUndoAction();
  const { info, before: reassignBefore, planA } = view;
  const made = a.anneal;
  const options: ReassignOption[] = useMemo(() => {
    if (!problem || !info || !reassignBefore) return [];
    const before = { problem: reassignBefore, routes: info.baseRoutes };
    const norm = (r: Routes) => JSON.stringify(routesOfIds(problem, r));
    const cur = norm(routes);
    const option = (key: ReassignOption['key'], title: string, r: Routes): ReassignOption => ({
      key,
      title,
      diff: attempt(() => reassignDiff(before, { problem, routes: r })).value,
      hundred: pointsOf(scoreProblem, scoreScale, r),
      current: norm(r) === cur,
    });
    const out: ReassignOption[] = [];
    if (planA) out.push(option('insert', '案A（空き時間に入れる）', planA));
    if (made) out.push(option('anneal', `案B（変更を減らす ${made.weight}）`, made.result.routes));
    // 作った案B が無い（再読込・画面を移った）が反映したのが案B なら、今の並びを案B として並べる（案A に戻せる）
    else if (info.method === 'anneal')
      out.push(option('anneal', `案B（変更を減らす ${info.stayWeight ?? ''}）`, routes));
    return out;
  }, [problem, info, reassignBefore, routes, planA, made, scoreProblem, scoreScale]);
  /** 案A・案B のどちらかを反映する */
  const choose = async (key: 'insert' | 'anneal') => {
    if (!problem || !info || planRun.running) return;
    // 今の並びが案A・案B のどちらとも違う（手直しした）ときだけ確認する
    if (
      !options.some((o) => o.current) &&
      !(await confirmDialog({
        title: `手直しを捨てて${key === 'anneal' ? '案B' : '案A'}に切り替えますか？`,
        body: '今の担当の手直しは消えます。',
        confirmLabel: '捨てて切り替える',
        tone: 'danger',
      }))
    )
      return;
    if (planRun.busy()) return;
    const p = problem;
    if (key === 'anneal') {
      if (!made) return;
      const b = made;
      x.writeWith('案B を反映', (d) =>
        chooseReassign(d, date, { problem: p, result: b.result, method: 'anneal', stayWeight: b.weight }),
      );
      toast('案B（少し動かした案）を反映しました', { action: undoAction });
    } else {
      if (!planA) return;
      const resultA = planAResultOf(p, planA);
      x.writeWith('案A を反映', (d) => chooseReassign(d, date, { problem: p, result: resultA, method: 'insert' }));
      toast('案A（空き時間に入れた案）を反映しました', { action: undoAction });
    }
    x.resetSelection();
  };
  return { options, choose };
}

/**
 * 差の欄へ移る（欠勤の登録のあと・列の見出しの近道・下の帯）。欠勤を登録して振り直したあと、欄が閉じて振り直しが出てから移る。
 * 日付を変えたら・少し経っても振り直しが出なければ下ろす（あとの手直しで急に移らない）
 */
function useBarFocus(date: string, info: ReassignInfo | null) {
  const barId = useId();
  /** 立てた日付 */
  const pending = useRef<string | null>(null);
  const goToBar = () => {
    const el = document.getElementById(barId);
    if (!el) return;
    el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    el.focus({ preventScroll: true });
  };
  // 欠勤を登録して振り直したら、差の欄（案A の結果・案B・連絡の一覧）へ移る
  // biome-ignore lint/correctness/useExhaustiveDependencies: 振り直しが画面に出たときに1回だけ
  useEffect(() => {
    if (pending.current !== date || !info) return;
    pending.current = null;
    const raf = requestAnimationFrame(goToBar);
    return () => cancelAnimationFrame(raf);
  }, [info, date]);
  // 日付を変えたら、差の欄へ移る予約を消す
  useEffect(() => {
    if (pending.current !== date) pending.current = null;
  }, [date]);
  /** 振り直したあと、差の欄へ移る予約を立てる */
  const later = () => {
    pending.current = date;
    const token = date;
    window.setTimeout(() => {
      if (pending.current === token) pending.current = null;
    }, 1500);
  };
  return { barId, goToBar, later };
}

/** 日の予定の欠勤の振り直し（差の欄・案A／案B・連絡の一覧・振り直す前に戻す） */
export function useReassignFlow(x: FlowArgs) {
  const { date, data, update, problem } = x;
  const toast = useToast();
  const confirmDialog = useConfirm();
  const historyOps = useHistoryOps();
  const undoAction = useUndoAction();
  /** いちばん新しいデータ（「振り直す前に戻す」で直前の手のあとに変わっていないか） */
  const dataRef = useRef(data);
  dataRef.current = data;
  const [error, setError] = useState<string | null>(null);
  const planRun = usePlanRun({
    date,
    seed: data.seed,
    scoreProblem: x.scoreProblem,
    scoreScale: x.scoreScale,
    onError: setError,
  });
  const view = useReassignView(x);
  const a = useAnneal({ ...x, view, planRun, setError });
  const opts = useReassignOptions({ ...x, view, anneal: a, planRun });
  const bar = useBarFocus(date, view.info);
  const [contactsOpen, setContactsOpen] = useState(false);
  /** 「登録して、少し動かしてよい（案B）も作る」で、振り直したあとに案B を始める日（日付を変えたら null） */
  const pendingAnneal = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたら前の日のエラーを消し、連絡の一覧を閉じる
  useEffect(() => {
    setContactsOpen(false);
    setError(null);
    // 前の日に「案B も作る」を押して、まだ始まっていなければやめる（別の日で始めない）
    pendingAnneal.current = null;
  }, [date]);
  // 「登録して、少し動かしてよい（案B）も作る」：振り直しが出たら案B を始める
  // biome-ignore lint/correctness/useExhaustiveDependencies: 振り直しと問題が出そろったときに1回だけ
  useEffect(() => {
    if (pendingAnneal.current !== date || !view.info || !problem || !view.planA || planRun.running) return;
    pendingAnneal.current = null;
    a.start();
  }, [view.info, problem, view.planA, planRun.running, date]);

  /**
   * 「登録して振り直す」：欠勤を足したデータで compile し、今の担当の並びから振り直して訪問に書く（1回の update で書く）。
   * stay：「欠勤・キャンセル」の欄から押した（欄は閉じず4段目へ進むので、差の欄へは移らない）。振り直せたら true
   */
  const registerAndReassign = async (absence: Absence, anneal = false, stay = false): Promise<boolean> => {
    if (planRun.running) return false;
    setError(null);
    const planned = attempt(() => planReassign(data, date, absence));
    if (planRun.busy()) return false;
    const r = planned.value;
    if (!r) {
      setError(`振り直せませんでした（${planned.error}）`);
      if (stay) toast(`振り直せませんでした（${planned.error}）`);
      return false;
    }
    a.clear();
    // 欠勤の登録と振り直しは別の手（「元に戻す」1回で振り直す前に戻り、欠勤は残る。PRD D329）
    const registered = saveAbsence(data, absence);
    update((d) => (d === data ? registered : saveAbsence(d, absence)), '欠勤を登録');
    update(
      (d) =>
        applyReassign(d, date, {
          problem: r.problem,
          result: r.result,
          base: d === registered ? r.base : baseOf(d, date, r.problem),
          absenceIds: r.absences.map((v) => v.id),
        }),
      REASSIGN_LABEL,
    );
    if (!stay) x.closeSudden();
    x.resetSelection();
    toast(`振り直しました（振り直し ${r.result.placed.length}件・入らない ${r.result.unplaced.length}件）`);
    // 案B も作る：書き込んだ振り直しと新しい問題が画面に出てから始める（上の effect）
    if (anneal) pendingAnneal.current = date;
    if (!stay) bar.later();
    return true;
  };
  /** もう一度振り直す（欠勤の人に残る訪問を、今の並びから振り直す。続けて振り直すのと同じ） */
  const reassignAgain = () => {
    const ab = data.absences.find((v) => v.date === date && view.absentStaff.has(v.staffId));
    if (ab) void registerAndReassign(ab);
  };
  /**
   * 振り直す前に戻す（PRD D31・D329）：直前の手が振り直し（欠勤の登録とは別の手）なら、全体の「元に戻す」で1手戻す（欠勤は残る）。
   * あとにほかの操作をしていたら、確かめてから振り直す前の担当・ピンに戻す（あとで足した訪問は今のまま。これも履歴の1手）
   */
  const revertToBase = async (): Promise<boolean> => {
    if (!problem || !view.info || planRun.busy()) return false;
    // 近道：直前の手がこの日の「欠勤の振り直し」で、その手の前にこの日の振り直しが無く、手のあとに何も変わっていないときだけ
    // 全体の「元に戻す」で1手戻す（別の日の振り直し・案A/案B の切り替えのあとで誤って戻さない）
    const last = appHistory.peek();
    if (
      last &&
      last.label === REASSIGN_LABEL &&
      last.after === dataRef.current &&
      !!own(last.after.reassigns, date) &&
      !own(last.before.reassigns, date)
    ) {
      historyOps.undo();
    } else {
      const ok = await confirmDialog({
        title: '振り直す前の担当に戻しますか？',
        body: '振り直したあとの手直しも含めて、振り直す前の担当とピンに戻します（あとで足した訪問は今のまま）。「元に戻す」で戻せます。',
        confirmLabel: '振り直す前に戻す',
      });
      if (!ok || planRun.busy()) return false;
      const p = problem;
      x.writeWith('振り直す前に戻す', (d) => revertReassign(d, date, p));
      toast('振り直す前に戻しました', { action: undoAction });
    }
    a.clear();
    x.resetSelection();
    return true;
  };
  /** トーストの「振り直す前に戻す」は前の描画の関数を持つので、押したときの最新の revertToBase を呼ぶ */
  const revertRef = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => {
    revertRef.current = revertToBase;
  });
  return {
    ...view,
    ...bar,
    error,
    setError,
    planRun,
    anneal: a,
    options: opts.options,
    choose: opts.choose,
    registerAndReassign,
    reassignAgain,
    revertToBase,
    revertLatest: () => revertRef.current(),
    contactsOpen,
    setContactsOpen,
  };
}

/** 振り直しの欄の表示に要るもの（案B の欄の props・連絡の一覧・案B を勧めるか） */
export function reassignShown(
  flow: ReturnType<typeof useReassignFlow>,
  visitById: Map<string, Visit>,
): {
  annealBox: ComponentProps<typeof AnnealBox>;
  leftContacts: LeftContact[];
  contactsTotal: number;
  annealRecommended: boolean;
} {
  const { info, diff, anneal: a, planRun } = flow;
  return {
    annealBox: {
      weight: a.stayWeight,
      onWeight: a.setStayWeight,
      recommended: (diff?.unplaced.length ?? 0) > 0 && info?.method === 'insert',
      disabledWhy: a.disabled,
      running: planRun.running === 'anneal',
      progress: planRun.progressStore,
      onStart: a.start,
      onStop: planRun.stop,
      options: flow.options,
      absentStaff: flow.absentStaff,
      onChoose: flow.choose,
      stopped: !!a.anneal?.stopped,
      note: a.note,
    },
    /** 連絡の一覧のいちばん上に出す、欠勤の人に残る訪問 */
    leftContacts: flow.left.map((v) => {
      const visit = visitById.get(v.visitId);
      return {
        visitId: v.visitId,
        clientId: visit?.clientId ?? '',
        staffId: v.staffId,
        at: visit ? timeText(visit.earliestStart) : '',
        reason: leftReasonText(v),
      };
    }),
    contactsTotal: contactCount(flow.contacts) + flow.left.length,
    /** 案B を勧める（案A で入らない訪問があり、反映したのが案A で、まだ案B を作っていない） */
    annealRecommended: !!info && (diff?.unplaced.length ?? 0) > 0 && info.method === 'insert' && !a.anneal,
  };
}
