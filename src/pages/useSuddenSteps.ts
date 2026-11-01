// 「欠勤・キャンセル」の欄（PRD D167〜D172・D244〜D246・D414）の状態と処理：段（1 何が起きたか・2 連絡・確定）・何が起きたか・
// 人と欠勤の入力・訪問・済んだこと・［連絡した］の印・見込み（absencePreviewOf）。見た目は suddenSteps.tsx・suddenContactStep.tsx と SuddenPanel
import { type ReactNode, useMemo, useState } from 'react';
import type { DemoData } from '../contracts/data';
import type { Absence, Terms } from '../contracts/documents';
import type { Slot } from '../domain/availability';
import { copyText } from '../lib/clipboard';
import { attempt, newId } from '../lib/common';
import type { ContactRow } from '../lib/contacts';
import type { BuiltMail } from '../lib/mailto';
import { absencePreviewOf } from '../lib/planReassign';
import {
  type AbsenceDraft,
  absenceOfDraft,
  absenceSummary,
  draftError,
  draftOf,
  reassignBlocked,
  recommendAnneal,
  type StaffChoice,
  type SuddenKind,
  type SuddenStep,
  type VisitChoice,
} from '../lib/sudden';

/** 欄を開くときの初め（列の見出しからは〈スタッフ〉と人を決めて開く） */
export type SuddenInit = { kind?: SuddenKind; staffId?: string };

export type SuddenPanelProps = {
  init: SuddenInit;
  date: string;
  data: DemoData;
  terms: Terms;
  /** 休む人の選択肢（その日にもともと働く人） */
  staffList: StaffChoice[];
  /** キャンセルの訪問の選択肢（その日の取り消していない訪問） */
  visitList: VisitChoice[];
  slotsOf: ReadonlyMap<string, { baseSlots: Slot[]; absence: Absence | null }>;
  staffName: (id: string) => string;
  visitLabel: (id: string) => string;
  /** キャンセルの訪問の〈利用者さん〉の名前・時刻・いまの担当の名前 */
  visitInfo: (visitId: string) => { client: string; window: string; owner: string | null };
  /** 計算中（自動作成・案B など） */
  running: boolean;
  /** その日に訪問があり、問題を作れる */
  hasPlan: boolean;
  /** 伝えた状態（none＝まだ伝えていない・told＝伝えた・changed＝伝えたあとに変わった） */
  confirmState: 'none' | 'told' | 'changed';
  /** 確定（伝えた）の段階を出すか（expert 入。切なら「連絡したので確定」を出さない。ADR-0073） */
  confirmStep: boolean;
  /** 2段目の振り直しの結果（まとめ・担当が移る訪問・案A と案B を選ぶ欄）。今の担当に振り直しが出るまでは null */
  result: ReactNode;
  /** 案B の「変更を減らす」の重み（1段目の「ほかのやり方」。差の欄の案B と同じ値） */
  weight: number;
  onWeight: (w: number) => void;
  /** 登録して振り直す（anneal：続けて案B も作る）。振り直せたら true */
  onReassign: (absence: Absence, anneal: boolean) => Promise<boolean>;
  onSaveOnly: (absence: Absence) => void;
  /** 欠勤を取り消す（確認ダイアログで取り消したら false） */
  onRemoveAbsence: (absence: Absence) => Promise<boolean>;
  onCancelVisit: (visitId: string, sameDay: boolean) => void;
  /** 確定（伝えた。確認ダイアログで取り消したら false） */
  onAdopt: () => Promise<boolean>;
  /** 振り直す前に戻す（確認ダイアログで取り消したら false）。振り直していなければ undefined */
  onRevert?: () => Promise<boolean>;
  /**
   * 2段目の連絡の一覧（元の担当 → 今の担当の差と、取り消した訪問から。PRD D244）。差を出せなければ null
   */
  contacts: ContactRow[] | null;
  /** 欠勤の人に残る訪問の数（振り直していない。2段目の上に注意を出す。連絡文には入らない） */
  leftCount?: number;
  /** 〈スタッフ〉あてのメール（PRD D94）。メールアドレスが無ければ null。メールを切っていれば渡さない（ボタンを出さない） */
  contactMail?: (row: ContactRow) => BuiltMail | null;
  /** 文をコピーしたあと（ok：できたか・what：何の文か） */
  onCopied: (ok: boolean, what: string) => void;
  /** 閉じる（toBar：日の画面の差の欄へ移る） */
  onClose: (toBar: boolean) => void;
  fallbackFocus?: () => HTMLElement | null;
  returnFocus?: () => HTMLElement | null;
};

/** 済んだこと（2段目の上の1行。anneal：案B も作っている） */
export type Done =
  | { kind: 'staff'; text: string; anneal: boolean }
  | { kind: 'client'; text: string; sameDay: boolean };

/** ［連絡した］の印の鍵（宛先と文。文が変われば別の行として扱う） */
export const sentKey = (r: ContactRow) => `${r.key}\n${r.text}`;

/** 欠勤の入力と見込み（人・入力・既存の欠勤・見込み・押せない理由・おすすめ） */
function useAbsenceInput(p: SuddenPanelProps, on: boolean) {
  const { init, date, data, slotsOf, running } = p;
  const [staffId, setStaffId] = useState<string>(init.staffId ?? '');
  const [draft, setDraft] = useState<AbsenceDraft>(() => draftOf(slotsOf.get(init.staffId ?? '')?.absence ?? null));
  const av = staffId ? slotsOf.get(staffId) : undefined;
  const existing = av?.absence ?? null;
  const error = draftError(draft);
  const absence = staffId ? absenceOfDraft(draft, staffId, date, existing) : null;
  // 見込みは人と時間を選んだ時点で作る（メモは見込みに効かないので key に入れない。PRD D414）
  const key = absence ? JSON.stringify([absence.staffId, absence.from, absence.to]) : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: 入力（key）とデータが変わったときだけ見込みを作り直す
  const preview = useMemo(
    () => (on && absence && !error ? (attempt(() => absencePreviewOf(data, date, absence)).value ?? null) : null),
    [on, key, data, date, error],
  );
  const blocked = reassignBlocked({ error, running, hasPreview: !!preview, hasBase: preview?.hasBase ?? false });
  return {
    staffId,
    setStaffId,
    draft,
    setDraft,
    existing,
    baseSlots: av?.baseSlots ?? [],
    error,
    absence,
    preview,
    blocked,
    /** 案B も作るのがおすすめ（案A で入らない見込み。PRD D264） */
    recommended: !!preview && recommendAnneal({ hasBase: preview.hasBase, unplacedA: preview.unplacedA }),
  };
}

/** 段の状態と処理 */
export function useSuddenSteps(p: SuddenPanelProps) {
  const { init } = p;
  const [step, setStep] = useState<SuddenStep>(1);
  const [kind, setKind] = useState<SuddenKind | null>(init.kind ?? (init.staffId ? 'staff' : null));
  const input = useAbsenceInput(p, step === 1 && kind === 'staff');
  const { setStaffId, setDraft, existing, absence, blocked, baseSlots } = input;
  const [visitId, setVisitId] = useState('');
  const [sameDay, setSameDay] = useState(true);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * 2段目で［連絡した］に印を付けた行（その場の状態だけ。データに残さない。ADR-0038）。鍵は宛先と文（sentKey）なので、
   * 確定し直して文が変わった行の印は消える
   */
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());
  /** 人を選ぶ（その日の欠勤があればその値で入力を始める） */
  const pickStaff = (id: string) => {
    setStaffId(id);
    setDraft(draftOf(p.slotsOf.get(id)?.absence ?? null));
  };
  /** 何が起きたかを選ぶ。種類を変えたら、前に選んだ人・訪問・欠勤の入力を消す */
  const chooseKind = (k: SuddenKind) => {
    if (k !== kind) {
      setStaffId('');
      setVisitId('');
      setDraft(draftOf(null));
      setSameDay(true);
    }
    setKind(k);
  };
  const withId = (a: Absence): Absence => ({ ...a, id: existing?.id ?? newId('a') });
  const guarded = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  /** この案で決める（欠勤の登録と振り直しを1手で。anneal：案B も作る）→ 2段目 */
  const reassignNow = (anneal: boolean) =>
    guarded(async () => {
      if (!absence || blocked) return;
      const a = withId(absence);
      if (!(await p.onReassign(a, anneal))) return;
      setDone({ kind: 'staff', text: absenceSummary(p.staffName(a.staffId), a, baseSlots), anneal });
      setStep(2);
    });
  const cancelNow = () => {
    if (!visitId) return;
    const info = p.visitInfo(visitId);
    p.onCancelVisit(visitId, sameDay);
    setDone({ kind: 'client', text: `${info.client} ${info.window}`, sameDay });
    setStep(2);
  };
  // 振り直したあと閉じたら差の欄へ（「あとで確定する」「連絡したので確定」は差の欄へ移らない）
  const close = () => p.onClose(done?.kind === 'staff');
  const copyRow = (r: ContactRow) => {
    void copyText(r.text).then((ok) => p.onCopied(ok, `${r.name}への文`));
  };
  const toggleSent = (k: string, on: boolean) =>
    setSent((cur) => {
      const next = new Set(cur);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  return {
    ...input,
    step,
    kind,
    visitId,
    setVisitId,
    sameDay,
    setSameDay,
    done,
    busy,
    sent,
    pickStaff,
    chooseKind,
    withId,
    guarded,
    reassignNow,
    cancelNow,
    close,
    copyRow,
    toggleSent,
  };
}

/** 段ごとの関数に渡すもの（欄の props と段の状態） */
export type StepCtx = { p: SuddenPanelProps; s: ReturnType<typeof useSuddenSteps> };

/** 段ごとの中身と下の帯 */
export type StepView = { body: ReactNode; footer: ReactNode };
