// 日の予定の「欠勤・キャンセル」の欄（PRD D167〜D172・D243〜D246）の状態と処理：開け閉め・ホームなどの入口（?do=absence）・
// 欠勤だけ登録・欠勤の取り消し・欄からの訪問の取り消し・5段目の連絡の差。振り直しは useReassignFlow
import { type ComponentProps, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import type { DemoData } from '../contracts/data';
import type { Absence, Client, Staff, Terms, Visit } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import type { Slot } from '../domain/availability';
import { windowText } from '../domain/scheduleModel';
import { hhmmToMinutes } from '../domain/time';
import { removeAbsence, saveAbsence } from '../lib/absences';
import { attempt, own } from '../lib/common';
import { type CancelledContact, type ContactWords, contactRows, withoutVisit } from '../lib/contacts';
import { isDate } from '../lib/isDate';
import type { BuiltMail } from '../lib/mailto';
import { SUDDEN_DO, staffChoices, visitChoices } from '../lib/sudden';
import { type ContactList, contactsOf, type Routes } from '../reassign';
import { ReassignResultBox } from './absenceParts';
import { AnnealBox } from './reassignParts';
import type { SuddenPanel } from './SuddenPanel';
import { reassignShown, type useReassignFlow } from './useReassignFlow';
import type { SuddenInit } from './useSuddenSteps';

/** 連絡の一覧が出せない（差を出せない）ときでも、欠勤の人に残る訪問だけで開くための空の一覧 */
export const EMPTY_CONTACTS: ContactList = { staffChanged: [], timeChanged: [], staff: [] };

/** 欄で取り消した訪問（5段目の連絡の「中止」。PRD D244）と、取り消す前の担当の並び・問題（連絡の差の「前」） */
type SuddenCancel = {
  cancelled: CancelledContact;
  before: { problem: Problem; routes: Routes } | null;
};

/**
 * 「欠勤・キャンセル」の欄の開け閉め（null：閉じている）。日の画面の入口・ホーム（`?do=absence`）からは1段目、
 * 列の見出しの「この人の欠勤を登録」「欠勤を直す」からはその人を選んだ2段目で開く。日付を変えたら閉じる
 */
export function useSuddenState(date: string) {
  const [sudden, setSudden] = useState<SuddenInit | null>(null);
  /** 欄を閉じたあと、差の欄へ移るか（振り直したあと） */
  const toBar = useRef(false);
  /** 日の予定の「欠勤・キャンセルを登録」のボタン（欄を閉じたときの戻り先が消えていたら） */
  const btnRef = useRef<HTMLButtonElement>(null);
  /** 欄で取り消した訪問。欄を開き直すと消す */
  const [cancel, setCancel] = useState<SuddenCancel | null>(null);
  /** 欄を開く（前に振り直して閉じたときの「差の欄へ移る」を戻す。開き直して欠勤だけ登録したときに差の欄へ飛ばない） */
  const open = (init: SuddenInit) => {
    toBar.current = false;
    setCancel(null);
    setSudden(init);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたら開いた欄を閉じる
  useEffect(() => {
    setSudden(null);
  }, [date]);
  return { sudden, setSudden, toBar, btnRef, cancel, setCancel, open };
}

type SuddenState = ReturnType<typeof useSuddenState>;

/**
 * ホームの「急な欠勤・キャンセルを登録」（?date=今日&do=absence。PRD D172）：その日を選び、「欠勤・キャンセル」の欄を1段目で開き、
 * URL から ?date= と ?do= を消す（1回だけ。戻るで繰り返さない）。稼働時間の右の欄から（PRD D203）は `&staff=` の人の欠勤（2段目）
 */
export function useSuddenEntry(x: {
  date: string;
  setDate: (d: string) => void;
  /** データにいる〈スタッフ〉か */
  knownStaff: (id: string) => boolean;
  /** その日に働く人か（休みの日・最終勤務日の後の人は選択肢に無く2段目が壊れるので1段目。PR #48 のレビュー） */
  works: (id: string) => boolean;
  open: (init: SuddenInit) => void;
}) {
  const { date } = x;
  const [params, setParams] = useSearchParams();
  const doParam = params.get('do');
  /** ?do=absence で開く日（日付を切り替えたあとに開く。日付を変えると欄を閉じる effect より後で開くため）と、`&staff=` の人 */
  const pending = useRef<string | null>(null);
  const pendingStaff = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ?do= が付いたときだけ
  useEffect(() => {
    if (doParam !== SUDDEN_DO) return;
    const raw = params.get('date');
    const target = raw && isDate(raw) ? raw : date;
    if (target !== date) x.setDate(target);
    pending.current = target;
    // 知らない人・その日に働かない人なら1段目
    const sid = params.get('staff');
    pendingStaff.current = sid && x.knownStaff(sid) ? sid : null;
    setParams(
      (p) => {
        p.delete('do');
        p.delete('date');
        p.delete('staff');
        return p;
      },
      { replace: true },
    );
  }, [doParam]);
  useEffect(() => {
    if (pending.current === null || pending.current !== date) return;
    pending.current = null;
    const sid = pendingStaff.current;
    pendingStaff.current = null;
    x.open(sid && x.works(sid) ? { kind: 'staff', staffId: sid } : {});
  });
}

type ReassignFlow = ReturnType<typeof useReassignFlow>;

type SuddenArgs = {
  date: string;
  data: DemoData;
  update: (fn: (d: DemoData) => DemoData, label?: string) => void;
  terms: Terms;
  state: SuddenState;
  flow: ReassignFlow;
  /** 一覧・名前を引くもの */
  day: {
    staff: Staff[];
    slotsOf: ReadonlyMap<string, { baseSlots: Slot[]; absence: Absence | null }>;
    visits: Visit[];
    visitById: Map<string, Visit>;
    clientById: Map<string, Client>;
    staffName: (id: string) => string;
    visitLabel: (id: string) => string;
  };
  /** 今の担当の並び・問題・訪問の担当・今の開始（分。無ければ null） */
  plan: {
    problem: Problem | null;
    routes: Routes;
    hasPlan: boolean;
    owner: Map<string, string>;
    startOf: (visitId: string) => number | null;
    /** 伝えた内容と今の違い（伝えていない日は null） */
    told: ContactList | null;
    toldState: 'none' | 'told' | 'changed';
  };
  /** 確定（伝えた）の段階を出すか（expert 入） */
  confirmStep: boolean;
  contactWords: ContactWords;
  /** 訪問を取り消す（取り消しの欄と共通） */
  applyCancel: (visitId: string, sameDay: boolean) => void;
  adopt: () => Promise<boolean>;
  /** 〈スタッフ〉あてのメール（メールを切っていれば undefined） */
  staffMail?: (staffId: string, text: string) => BuiltMail | null;
  onCopied: (ok: boolean, what: string) => void;
  /** 列の見出し（欄を閉じたとき、フォーカスの戻り先が消えていたらここへ） */
  colHeadOf: (sid: string) => HTMLElement | null;
};

/** 「欠勤・キャンセル」の欄の処理と、欄に渡すもの（閉じていれば panel は null） */
export function useSuddenFlow(x: SuddenArgs): {
  panel: ComponentProps<typeof SuddenPanel> | null;
  /** 「欠勤・キャンセル」を出せる人（その日にもともと働く人） */
  staffList: ReturnType<typeof staffChoices>;
  btnRef: RefObject<HTMLButtonElement | null>;
} {
  const { date, state, flow, day, plan } = x;
  const toast = useToast();
  const confirmDialog = useConfirm();
  const { sudden } = state;
  /** いまの担当（訪問の担当） */
  const ownerName = (visitId: string): string | null => {
    const sid = plan.owner.get(visitId);
    return sid ? day.staffName(sid) : null;
  };
  const staffList = useMemo(
    () => staffChoices(day.staff, day.slotsOf, (sid) => (own(plan.routes, sid) ?? []).length),
    [day.staff, day.slotsOf, plan.routes],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: 訪問・〈利用者さん〉・担当が変わったときだけ
  const visitList = useMemo(
    () =>
      sudden
        ? visitChoices(
            day.visits,
            (id) => day.clientById.get(id)?.displayName ?? '（不明）',
            (id) => {
              const v = day.visitById.get(id);
              return v ? windowText(v) : '';
            },
            ownerName,
          )
        : [],
    [sudden, day.visits, day.clientById, day.visitById, plan.owner],
  );
  /**
   * 5段目の連絡の差（PRD D244）：欠勤は振り直しの差（振り直す前 → 今）。キャンセルは取り消す前の並び → 今
   * （取り消した訪問は「中止」として別に出す）
   */
  const list = useMemo((): ContactList | null => {
    if (!sudden) return null;
    const c = state.cancel;
    // 伝えた日は、伝えた内容 → 今の差（欠勤の振り直しのほか、手で変えた訪問も。「連絡したので確定」で伝えたことにするもの）。
    // 取り消した訪問は「中止」として別に出すので、差からは外す
    if (plan.told) return c ? withoutVisit(plan.told, c.cancelled.visitId) : plan.told;
    if (!c) return flow.contacts;
    const b = c.before;
    if (!b || !plan.problem) return EMPTY_CONTACTS;
    const p = plan.problem;
    return (
      attempt(() => contactsOf({ problem: p, routes: b.routes }, { problem: p, routes: plan.routes })).value ?? null
    );
  }, [sudden, state.cancel, flow.contacts, plan.problem, plan.routes, plan.told]);
  if (!sudden) return { panel: null, staffList, btnRef: state.btnRef };
  return {
    staffList,
    btnRef: state.btnRef,
    panel: {
      init: sudden,
      date,
      data: x.data,
      terms: x.terms,
      staffList,
      visitList,
      slotsOf: day.slotsOf,
      staffName: day.staffName,
      visitLabel: day.visitLabel,
      visitInfo: (visitId) => {
        const v = day.visitById.get(visitId);
        return {
          client: v ? (day.clientById.get(v.clientId)?.displayName ?? '（不明）') : '（不明）',
          window: v ? windowText(v) : '',
          owner: ownerName(visitId),
        };
      },
      running: !!flow.planRun.running,
      hasPlan: plan.hasPlan,
      confirmState: plan.toldState,
      confirmStep: x.confirmStep,
      result: suddenResult(x),
      onReassign: (a, anneal) => flow.registerAndReassign(a, anneal, true),
      ...suddenActions(x, toast, confirmDialog),
      onAdopt: x.adopt,
      onRevert: flow.info ? flow.revertToBase : undefined,
      contacts: list ? contactRows(list, state.cancel ? [state.cancel.cancelled] : [], x.contactWords) : null,
      leftCount: flow.left.length,
      contactMail: x.staffMail ? (row) => x.staffMail?.(row.id, row.text) ?? null : undefined,
      onCopied: x.onCopied,
      fallbackFocus: () => (sudden.staffId ? x.colHeadOf(sudden.staffId) : state.btnRef.current),
      returnFocus: () => (state.toBar.current ? document.getElementById(flow.barId) : null),
    },
  };
}

/** 4段目：今の担当の振り直しのまとめと、案A・案B を選ぶ欄（差の欄と同じ部品・同じ操作） */
function suddenResult(x: SuddenArgs) {
  const { flow } = x;
  if (!x.plan.hasPlan || !flow.info) return null;
  return (
    <ReassignResultBox
      info={flow.info}
      diff={flow.diff}
      left={flow.left.length}
      visitLabel={x.day.visitLabel}
      staffName={x.day.staffName}
    >
      <AnnealBox {...reassignShown(flow, x.day.visitById).annealBox} />
    </ReassignResultBox>
  );
}

/** 欄の操作：欠勤だけ登録・欠勤の取り消し・訪問の取り消し・閉じる */
function suddenActions(
  x: SuddenArgs,
  toast: ReturnType<typeof useToast>,
  confirmDialog: ReturnType<typeof useConfirm>,
): Pick<ComponentProps<typeof SuddenPanel>, 'onSaveOnly' | 'onRemoveAbsence' | 'onCancelVisit' | 'onClose'> {
  const { state, flow, day, plan } = x;
  return {
    onSaveOnly: (absence) => {
      x.update((d) => saveAbsence(d, absence), '欠勤を登録');
      state.setSudden(null);
      toast('欠勤を登録しました（担当はそのままです。休む人の訪問は要対応に出ます）');
    },
    onRemoveAbsence: async (absence) => {
      const ok = await confirmDialog({
        title: `${day.staffName(absence.staffId)}さんの欠勤を取り消しますか？`,
        body: '担当はそのままです。',
        confirmLabel: '欠勤を取り消す',
        cancelLabel: '残しておく',
        tone: 'danger',
      });
      if (!ok) return false;
      x.update((d) => removeAbsence(d, absence.id), '欠勤を取り消す');
      state.setSudden(null);
      // 担当は変えない。振り直したあとなら「振り直す前に戻す」で担当を戻せる（「元に戻す」だと欠勤が戻ってしまう。PR #81 のレビュー）
      if (flow.info)
        toast('欠勤を取り消しました。担当を戻すには「振り直す前に戻す」を押してください', {
          action: { label: '振り直す前に戻す', onClick: () => void flow.revertLatest(), testId: 'toast-revert' },
        });
      else toast('欠勤を取り消しました');
      return true;
    },
    // 欄からの取り消し：取り消す前の担当・開始と、取り消す前の担当の並び（取り消す訪問を除く）を覚えてから取り消す
    // （5段目の連絡の「中止」と差の「前」。PRD D244）
    onCancelVisit: (visitId, sameDay) => {
      const v = day.visitById.get(visitId);
      const sid = plan.owner.get(visitId) ?? null;
      if (v && plan.problem) {
        const start = plan.startOf(visitId) ?? hhmmToMinutes(v.earliestStart);
        const before = Object.fromEntries(
          Object.entries(plan.routes).map(([k, ids]) => [k, ids.filter((id) => id !== visitId)]),
        );
        state.setCancel({
          cancelled: { visitId, clientId: v.clientId, staffId: sid, start },
          before: { problem: plan.problem, routes: before },
        });
      }
      x.applyCancel(visitId, sameDay);
    },
    // 欄を閉じる（toBar：振り直したあとなので差の欄へ）
    onClose: (toBar) => {
      state.toBar.current = toBar && !!flow.info;
      state.setSudden(null);
      if (state.toBar.current) requestAnimationFrame(flow.goToBar);
    },
  };
}
