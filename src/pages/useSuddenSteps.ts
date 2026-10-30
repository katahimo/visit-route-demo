// 「欠勤・キャンセル」の欄（PRD D167〜D172・D243〜D246）の段階の状態と処理：段階・何が起きたか・人と欠勤の入力・訪問・
// 済んだこと・［連絡した］の印・見込み（previewOf）。見た目は suddenSteps.tsx の段ごとの関数と SuddenPanel
import { type ReactNode, useMemo, useState } from 'react';
import type { DemoData } from '../contracts/data';
import type { Absence, Terms } from '../contracts/documents';
import type { Slot } from '../domain/availability';
import { copyText } from '../lib/clipboard';
import { newId } from '../lib/common';
import type { ContactRow } from '../lib/contacts';
import type { BuiltMail } from '../lib/mailto';
import {
  type AbsenceDraft,
  absenceOfDraft,
  absenceSummary,
  draftError,
  draftOf,
  reassignBlocked,
  type StaffChoice,
  type SuddenKind,
  type SuddenStep,
  type VisitChoice,
} from '../lib/sudden';
import { previewOf } from './absenceParts';

/** 欄を開くときの初め（列の見出しからは〈スタッフ〉と人を決めて2段目から） */
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
  /** 4段目の振り直しの結果（まとめ・案A と案B を選ぶ欄）。今の担当に振り直しが出るまでは null */
  result: ReactNode;
  /** 登録して振り直す（anneal：続けて案B も作る）。振り直せたら true */
  onReassign: (absence: Absence, anneal: boolean) => Promise<boolean>;
  onSaveOnly: (absence: Absence) => void;
  /** 欠勤を取り消す（確認ダイアログで取り消したら false） */
  onRemoveAbsence: (absence: Absence) => Promise<boolean>;
  onCancelVisit: (visitId: string, sameDay: boolean) => void;
  /** 確定（伝えた。確認ダイアログで取り消したら false） */
  onAdopt: () => Promise<boolean>;
  /** 元の案に戻す（確認ダイアログで取り消したら false）。振り直していなければ undefined */
  onRevert?: () => Promise<boolean>;
  /**
   * 5段目の連絡の一覧（元の担当 → 今の担当の差と、取り消した訪問から。PRD D244）。差を出せなければ null
   */
  contacts: ContactRow[] | null;
  /** 欠勤の人に残る訪問の数（振り直していない。5段目の上に注意を出す。連絡文には入らない） */
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

/** 済んだこと（4段目の見出し） */
export type Done = { kind: 'staff'; text: string } | { kind: 'client'; text: string; sameDay: boolean };

/** ［連絡した］の印の鍵（宛先と文。文が変われば別の行として扱う） */
export const sentKey = (r: ContactRow) => `${r.key}\n${r.text}`;

/** 段階の状態と処理 */
export function useSuddenSteps(p: SuddenPanelProps) {
  const { init, date, data, slotsOf, running } = p;
  const [step, setStep] = useState<SuddenStep>(init.staffId ? 2 : init.kind ? 2 : 1);
  const [kind, setKind] = useState<SuddenKind | null>(init.kind ?? (init.staffId ? 'staff' : null));
  const [staffId, setStaffId] = useState<string>(init.staffId ?? '');
  const [draft, setDraft] = useState<AbsenceDraft>(() => draftOf(slotsOf.get(init.staffId ?? '')?.absence ?? null));
  const [visitId, setVisitId] = useState('');
  const [sameDay, setSameDay] = useState(true);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * 5段目で［連絡した］に印を付けた行（その場の状態だけ。データに残さない。ADR-0038）。鍵は宛先と文（sentKey）なので、
   * 確定し直して文が変わった行の印は消える
   */
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());

  const av = staffId ? slotsOf.get(staffId) : undefined;
  const existing = av?.absence ?? null;
  const baseSlots = av?.baseSlots ?? [];
  const error = draftError(draft);
  const absence = staffId ? absenceOfDraft(draft, staffId, date, existing) : null;
  // 見込みは3段目だけで出す（メモは見込みに効かないので key に入れない）
  const key = absence ? JSON.stringify([absence.staffId, absence.from, absence.to]) : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: 入力（key）とデータが変わったときだけ見込みを作り直す
  const preview = useMemo(
    () => (step === 3 && kind === 'staff' && absence && !error ? previewOf(data, date, absence) : null),
    [step, kind, key, data, date, error],
  );
  const blocked = reassignBlocked({
    error,
    running,
    hasPreview: !!preview,
    hasBase: preview?.hasBase ?? false,
  });
  const pickStaff = (id: string) => {
    setStaffId(id);
    setDraft(draftOf(slotsOf.get(id)?.absence ?? null));
  };
  const go = (s: SuddenStep) => setStep(s);
  /** 1段目で何が起きたかを選ぶ。種類を変えたら、前に選んだ人・訪問・欠勤の入力を消す */
  const chooseKind = (k: SuddenKind) => {
    if (k !== kind) {
      setStaffId('');
      setVisitId('');
      setDraft(draftOf(null));
      setSameDay(true);
    }
    setKind(k);
    go(2);
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
  const reassignNow = (anneal: boolean) =>
    guarded(async () => {
      if (!absence || blocked) return;
      const a = withId(absence);
      if (!(await p.onReassign(a, anneal))) return;
      setDone({ kind: 'staff', text: absenceSummary(p.staffName(a.staffId), a, baseSlots) });
      go(4);
    });
  const cancelNow = () => {
    if (!visitId) return;
    const info = p.visitInfo(visitId);
    p.onCancelVisit(visitId, sameDay);
    setDone({ kind: 'client', text: `${info.client} ${info.window}`, sameDay });
    go(4);
  };
  // 5段目（連絡）まで進んだら差の欄へは移らない（確定まで済んでいる）
  const close = () => p.onClose(done?.kind === 'staff' && step < 5);
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
    step,
    kind,
    staffId,
    draft,
    setDraft,
    visitId,
    setVisitId,
    sameDay,
    setSameDay,
    done,
    busy,
    sent,
    existing,
    baseSlots,
    error,
    absence,
    preview,
    blocked,
    pickStaff,
    go,
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

/** 段ごとの関数に渡すもの（欄の props と段階の状態） */
export type StepCtx = { p: SuddenPanelProps; s: ReturnType<typeof useSuddenSteps> };

/** 段ごとの中身と下の帯 */
export type StepView = { body: ReactNode; footer: ReactNode };
