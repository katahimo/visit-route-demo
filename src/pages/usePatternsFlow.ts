// 〈利用者さん〉の繰り返し（定期パターン。ADR-0012・0052）の状態と処理：開いている欄（足す・直す／終わらせる）・入力中の変更の有無・
// 誤りの文と、保存（足す・直す）・消す・終わらせる。どれも確認してからデータを変える
import { useEffect, useId, useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useFeature } from '../components/useFeature';
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import { jstDate } from '../domain/time';
import { requestAutoArrange } from '../lib/autoArrangeBatch';
import { byName, newId } from '../lib/common';
import { mdText } from '../lib/dateText';
import { patternEndConfirm, patternRemoveConfirm, patternSplitConfirm } from '../lib/patternConfirm';
import {
  type PatternForm,
  parsePatternForm,
  patternConfirmedDays,
  patternEndDefault,
  patternSinceError,
} from '../lib/patternForm';
import { endPatternOp } from '../lib/visitOps';
import { removePattern, splitPattern } from '../patterns';
import { useDemoData } from '../store';

/** 終わらせる繰り返しと最後の日（opened は開いたときの最後の日。変更があるかの判定） */
export type PatternEnding = { id: string; last: string; opened: string };

/** 保存の前後で増えた・日時が変わった担当なしの回を自動で組む依頼を出す（繰り返しの担当も書く。ADR-0072）。依頼したら true */
const arrangeAfter = (before: DemoData, after: DemoData, today: string): boolean =>
  requestAutoArrange({ before, after, today, writeUsual: true });

/** 開いている欄（足す・直す／終わらせる）と誤りの文。入力中の変更の有無を onDirty で知らせる */
function usePatternsDraft(onDirty?: (dirty: boolean) => void) {
  const [form, setForm] = useState<PatternForm | null>(null);
  /** 開いたときの入力（変更があるかの判定） */
  const [opened, setOpened] = useState<PatternForm | null>(null);
  /** 終わらせる繰り返しと最後の日（null：閉じている） */
  const [ending, setEnding] = useState<PatternEnding | null>(null);
  const open = (f: PatternForm | null) => {
    setError(null);
    setEnding(null);
    setForm(f);
    setOpened(f);
  };
  const dirty =
    (form !== null && JSON.stringify(form) !== JSON.stringify(opened)) ||
    (ending !== null && ending.last !== ending.opened);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);
  // 誤りはオブジェクトで持つ（同じ文で保存し直しても作り直して読み上げる。PRD D250）
  const [errorState, setErrorState] = useState<{ text: string } | null>(null);
  const error = errorState?.text ?? null;
  const setError = (text: string | null) => setErrorState(text === null ? null : { text });
  return { form, setForm, ending, setEnding, open, errorState, error, setError };
}

export function usePatternsFlow({
  clientId,
  selected,
  onSelect,
  onDirty,
}: {
  clientId: string;
  selected: string | null;
  onSelect?: (id: string | null) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const { data, update } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const today = jstDate(Date.now());
  const { form, setForm, ending, setEnding, open, errorState, error, setError } = usePatternsDraft(onDirty);
  /**
   * 毎月の第N週・曜日ごとの時刻（ADR-0028 の patternMonthly）。切なら選べない。今の値がそれなら欄は読むだけで出す
   * （パターンは事実なので、訪問は今どおり作られる）
   */
  const monthlyOn = useFeature('patternMonthly');
  const monthlyOffId = useId();
  /** 曜日ごとの時刻のパターンで patternMonthly が切：曜日・曜日ごとの時刻は読むだけ（データを変えない） */
  const daysLocked = !monthlyOn && !!form?.perDay;
  const patterns = useMemo(() => data.patterns.filter((p) => p.clientId === clientId), [data.patterns, clientId]);
  const staff = useMemo(() => [...data.staff].sort(byName), [data.staff]);
  const staffName = (id: string | null) => (id ? (data.staff.find((s) => s.id === id)?.name ?? '（不明）') : null);

  const save = async () => {
    if (!form) return;
    setError(null);
    if (!form.id) {
      // 足す：回は見るときに計算するので、繰り返しを足すだけ（版2）
      const p = parsePatternForm(form, form.from, clientId, data.visitTypes);
      if (typeof p === 'string') {
        setError(p);
        return;
      }
      const add = (d: DemoData): DemoData => ({ ...d, patterns: [...d.patterns, p] });
      // 保存後のデータは先に1回だけ作り、store にもそれを入れる（自動の組みが読むデータと参照をそろえる）
      const after = add(data);
      update((d) => (d === data ? after : add(d)), '繰り返しを足す');
      open(null);
      // 保存したあと、増えた担当なしの回を自動で組む（保存の前後のデータで対象を決める。繰り返しの担当も書く。ADR-0072）
      const auto = arrangeAfter(data, after, today);
      toast(
        p.usualStaffId
          ? `繰り返しを足しました（担当：${staffName(p.usualStaffId)}）`
          : `繰り返しを足しました（${auto ? '担当を自動で組みます' : '担当なし'}）`,
      );
      return;
    }
    // 直す：「いつから」で分けて、その日以降の（この回だけの変更でない）訪問を作り直す
    const sinceError = patternSinceError(form.since, today);
    if (sinceError) {
      setError(sinceError);
      return;
    }
    const original = data.patterns.find((x) => x.id === form.id);
    if (!original) return;
    const p = parsePatternForm(
      form,
      form.since <= original.from ? original.from : form.since,
      clientId,
      data.visitTypes,
    );
    if (typeof p === 'string') {
      setError(p);
      return;
    }
    const { id: _, from: __, ...next } = p;
    const nid = newId('pt');
    const c = splitPattern(data, original.id, next, form.since, today, nid);
    const m = patternConfirmedDays(data, original.id, form.since > today ? form.since : today, c);
    if (!(await confirmDialog(patternSplitConfirm(form.since, c.removed.length, m)))) return;
    const after = { ...data, patterns: c.patterns, visits: c.visits };
    update((d) => {
      if (d === data) return after;
      const x = splitPattern(d, original.id, next, form.since, today, nid);
      return { ...d, patterns: x.patterns, visits: x.visits };
    }, '繰り返しを直す');
    open(null);
    // 直した回の担当なし（日時が変わった・増えた回）を自動で組む
    const auto = arrangeAfter(data, after, today);
    toast(auto ? '繰り返しを直しました（担当を自動で組みます）' : '繰り返しを直しました');
  };

  const remove = async (p: Pattern) => {
    const c = removePattern(data, p.id, today);
    const m = patternConfirmedDays(data, p.id, today, c);
    if (!(await confirmDialog(patternRemoveConfirm(m)))) return;
    update((d) => {
      const x = removePattern(d, p.id, today);
      return { ...d, patterns: x.patterns, visits: x.visits };
    }, '繰り返しを消す');
    if (form?.id === p.id) open(null);
    if (selected === p.id) onSelect?.(null);
    toast('繰り返しを消しました');
  };

  /** 終わらせる：最後の日より後の回を消し、終了日を入れる（確認してから） */
  const end = async () => {
    if (!ending) return;
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ending.last)) {
      setError('最後の日を入れてください');
      return;
    }
    const r = endPatternOp(data, ending.id, ending.last, today);
    if (!(await confirmDialog(patternEndConfirm(ending.last, r.removed, r.confirmedDays)))) return;
    update((d) => endPatternOp(d, ending.id, ending.last, today).data, '繰り返しを終わらせる');
    setEnding(null);
    toast(`繰り返しを${mdText(ending.last)}で終わらせました`);
  };

  /** 終わらせる欄を開く（足す・直す欄は閉じる） */
  const startEnd = (p: Pattern) => {
    open(null);
    const last = patternEndDefault(p, today);
    setEnding({ id: p.id, last, opened: last });
  };
  /** 終わらせる欄を閉じる */
  const cancelEnd = () => {
    setEnding(null);
    setError(null);
  };

  return {
    data,
    today,
    patterns,
    staff,
    staffName,
    form,
    setForm,
    ending,
    setEnding,
    open,
    errorState,
    error,
    monthlyOn,
    monthlyOffId,
    daysLocked,
    save,
    remove,
    end,
    startEnd,
    cancelEnd,
  };
}
