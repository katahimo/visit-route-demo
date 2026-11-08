// 〈利用者さん〉の休みの入力（PRD D65。ADR-0013）：入れる・直すの入力と変更の有無・誤り・重なる確定した日・保存・消す
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { useDay } from '../components/day';
import { useToast } from '../components/Toast';
import { type Client, type ClientLeave, clientLeaveSchema } from '../contracts/documents';
import { jstDate } from '../domain/time';
import { newId } from '../lib/common';
import { mdText } from '../lib/dateText';
import { confirmLeave } from '../lib/leaveGuard';
import { leaveConfirmedDates, leavesOf, leaveVisits, removeLeave, saveLeave } from '../lib/leaves';
import { useDemoData } from '../store';

/** 休みの入力（id が null なら新しい休み） */
export type ClientLeaveForm = { id: string | null; from: string; to: string; note: string };

export function useClientLeaves({
  client,
  onOpenDay,
  onDirty,
}: {
  client: Client;
  onOpenDay?: (date: string) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const { data, update } = useDemoData();
  const terms = data.org.terms;
  const toast = useToast();
  const confirmDialog = useConfirm();
  const navigate = useNavigate();
  const { setDate } = useDay();
  const today = jstDate(Date.now());
  const [form, setFormState] = useState<ClientLeaveForm | null>(null);
  /** 開いたときの入力（変更があるかの判定） */
  const [opened, setOpened] = useState<ClientLeaveForm | null>(null);
  const openForm = (f: ClientLeaveForm | null) => {
    setFormState(f);
    setOpened(f);
  };
  const setForm = (f: ClientLeaveForm) => setFormState(f);
  const dirty = form !== null && JSON.stringify(form) !== JSON.stringify(opened);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);
  // 誤りはオブジェクトで持つ（同じ文で保存し直しても作り直して読み上げる。PRD D250）
  const [errorState, setErrorState] = useState<{ text: string } | null>(null);
  const error = errorState?.text ?? null;
  const setError = (text: string | null) => setErrorState(text === null ? null : { text });
  const leaves = useMemo(() => leavesOf(data, client.id), [data, client.id]);
  const openDay =
    onOpenDay ??
    (async (d: string) => {
      // 下書きのある画面（入力中の休み）から移るときは確かめる（断れば移らない）
      if (!(await confirmLeave())) return;
      setDate(d);
      navigate('/plan');
    });

  /** 入力中の休みと重なる確定した日（形が正しいときだけ） */
  const draftConfirmed = useMemo(() => {
    if (!form || !/^\d{4}-\d{2}-\d{2}$/.test(form.from) || !/^\d{4}-\d{2}-\d{2}$/.test(form.to)) return [];
    if (form.from > form.to) return [];
    return leaveConfirmedDates(data, { clientId: client.id, from: form.from, to: form.to });
  }, [form, data, client.id]);

  const save = () => {
    if (!form) return;
    setError(null);
    const r = clientLeaveSchema.safeParse({
      id: form.id ?? newId('l'),
      clientId: client.id,
      from: form.from,
      to: form.to,
      note: form.note.trim(),
    });
    if (!r.success) {
      const where = r.error.issues[0]?.path[0];
      setError(
        where === 'to' && form.from > form.to ? '終了日は開始日以降にしてください' : '日付を正しく入れてください',
      );
      return;
    }
    const leave: ClientLeave = r.data;
    const n = leaveVisits(data, leave).length;
    update((d) => saveLeave(d, leave), '休みを保存');
    openForm(null);
    toast(
      `休みを${form.id ? '直しました' : '追加しました'}（${mdText(leave.from)}〜${mdText(leave.to)}・訪問 ${n}件は無しになります）`,
    );
  };

  const remove = async (l: ClientLeave) => {
    const ok = await confirmDialog({
      title: `${mdText(l.from)}〜${mdText(l.to)}の休みを消しますか？`,
      body: 'この間の訪問は元に戻ります（担当なしになった回は、日の予定で組みます）。',
      confirmLabel: '休みを消す',
      tone: 'danger',
    });
    if (!ok) return;
    update((d) => removeLeave(d, l.id), '休みを消す');
    if (form?.id === l.id) openForm(null);
    toast(`休みを消しました（${mdText(l.from)}〜${mdText(l.to)}の訪問は元に戻ります）`);
  };

  return {
    data,
    terms,
    today,
    leaves,
    form,
    setForm,
    openForm,
    error,
    errorState,
    setError,
    openDay,
    draftConfirmed,
    save,
    remove,
  };
}
