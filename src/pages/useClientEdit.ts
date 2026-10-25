// 〈利用者さん〉の画面の節の編集（PRD D308・D311。ADR-0052）：直している節と入力・誤り・繰り返しと休みの入力の変更・
// 変更があるまま離れる・別の節を直す・取り消すときの確認・`?edit=` で節を開く
import { useCallback, useEffect, useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { type FormErr, invalidAttrs } from '../components/FieldError';
import { useAskDiscard } from '../components/personPage';
import { useLeaveGuard } from '../components/useLeaveGuard';
import type { Client, Staff, Terms } from '../contracts/documents';
import {
  CLIENT_SECTION_TAB,
  CLIENT_SECTIONS,
  type ClientEdit,
  type ClientSecKey,
  clientSectionDirty,
  newClientEdit,
  openClientEdit,
} from '../lib/clientEdit';
import { CLIENT_COLORS } from '../lib/colors';
import { newClient } from '../lib/newClient';

/** 入力を直す（新しい値か、今の入力から作る関数） */
export type SetClientForm = (f: Client | ((c: Client) => Client)) => void;

export function useClientEdit({
  isNew,
  saved,
  staff,
  nextColor,
  terms,
  onDirty,
  onLeave,
}: {
  isNew: boolean;
  saved: Client | undefined;
  staff: readonly Staff[];
  /** 新しい人の色（今の人数） */
  nextColor: number;
  terms: Terms;
  onDirty: (dirty: boolean, who: string) => void;
  onLeave: () => void;
}) {
  const confirmDialog = useConfirm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<ClientEdit | null>(() =>
    isNew ? newClientEdit(newClient({ color: nextColor % CLIENT_COLORS.length })) : null,
  );
  const [error, setError] = useState<FormErr>(null);
  const [resetKey, setResetKey] = useState(0);
  const [childDirty, setChildDirty] = useState({ patterns: false, leaves: false });
  const onPatternsDirty = useCallback(
    (d: boolean) => setChildDirty((x) => (x.patterns === d ? x : { ...x, patterns: d })),
    [],
  );
  const onLeavesDirty = useCallback(
    (d: boolean) => setChildDirty((x) => (x.leaves === d ? x : { ...x, leaves: d })),
    [],
  );
  const sectionDirty = clientSectionDirty(edit, saved, staff);
  const dirty = sectionDirty || childDirty.patterns || childDirty.leaves;
  const whoText = `${(edit?.form.displayName ?? saved?.displayName ?? '').trim() || '（名前なし）'}（${terms.client}）`;
  useEffect(() => {
    onDirty(dirty, whoText);
  }, [dirty, whoText, onDirty]);
  /** 変更を捨てる（節・繰り返し・休みの入力を閉じる） */
  const discardAll = () => {
    setEdit(null);
    setError(null);
    setResetKey((k) => k + 1);
    setChildDirty({ patterns: false, leaves: false });
  };
  // 変更があるまま画面を離れる（メニュー・リンク・パレット・再読込）ときは確かめる（PRD D311）
  useLeaveGuard(
    dirty,
    {
      title: '変更を捨てて移りますか？',
      body: `${whoText}の変更を保存していません。`,
      confirmLabel: '捨てて移る',
      cancelLabel: '編集を続ける',
      tone: 'danger',
    },
    () => {
      onLeave();
      discardAll();
    },
  );
  const ask = useAskDiscard(dirty, whoText);
  const startEdit = async (key: ClientSecKey) => {
    if (!saved || edit?.key === key) return;
    if (!(await ask('section'))) return;
    discardAll();
    setEdit(openClientEdit(key, saved, staff));
  };
  const cancelEdit = async () => {
    if (
      sectionDirty &&
      !(await confirmDialog({
        title: '変更を捨てますか？',
        body: `${whoText}の変更を保存していません。`,
        confirmLabel: '捨てる',
        cancelLabel: '編集を続ける',
        tone: 'danger',
      }))
    )
      return;
    if (edit?.key === 'new') {
      // 新しい人を取り消したら一覧へ（何も入れていなければ確かめない）
      onLeave();
      setEdit(null);
      navigate('/clients');
      return;
    }
    setEdit(null);
    setError(null);
  };
  const setForm: SetClientForm = (f) =>
    setEdit((e) => (e ? { ...e, form: typeof f === 'function' ? f(e.form) : f } : e));
  const setLimit = (on: boolean) => setEdit((e) => (e ? { ...e, limit: on } : e));
  /** 誤りの文の id（節の誤りの文と入力欄の aria-describedby で同じもの） */
  const errorId = useId();
  const bad = (field: string) => invalidAttrs(error?.field === field, errorId);
  // 「まとめて地図に置く」の「編集」などから節を開いて来たとき（`?edit=place`）。開いたら URL から消す
  const editParam = params.get('edit');
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の edit が替わったときだけ
  useEffect(() => {
    if (!editParam) return;
    if (editParam in CLIENT_SECTIONS && saved) setEdit(openClientEdit(editParam as ClientSecKey, saved, staff));
    // 節のあるタブへ移す（予定のタブなど、節の無いタブで開いたとき）
    const onTab = editParam in CLIENT_SECTIONS ? CLIENT_SECTION_TAB[editParam as ClientSecKey] : null;
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('edit');
        if (onTab) p.set('tab', onTab);
        return p;
      },
      { replace: true },
    );
  }, [editParam]);

  return {
    edit,
    setEdit,
    error,
    setError,
    resetKey,
    onPatternsDirty,
    onLeavesDirty,
    whoText,
    discardAll,
    ask,
    startEdit,
    cancelEdit,
    setForm,
    setLimit,
    errorId,
    bad,
  };
}
