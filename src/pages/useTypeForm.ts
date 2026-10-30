// 訪問の種類の画面（ADR-0012。PRD D36）の編集の欄の状態と処理：開く・保存・消す。入力の確かめとデータの組み立ては lib/visitTypes
import { useId, useMemo, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { type FormErr, invalidAttrs } from '../components/FieldError';
import { useToast } from '../components/Toast';
import type { VisitType } from '../contracts/documents';
import {
  blankVisitType,
  checkVisitTypeForm,
  removeVisitType,
  saveVisitType,
  typeUses,
  usesOf,
  type VisitTypeForm,
  visitTypeForm,
} from '../lib/visitTypes';
import { useDemoData } from '../store';

export function useTypeForm() {
  const { data, update } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [form, setForm] = useState<VisitTypeForm | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<FormErr>(null);
  const errorId = useId();
  /** 誤った欄の印（PRD D250） */
  const bad = (field: string) => invalidAttrs(error?.field === field, errorId);
  /** 種類ごとの、使っている訪問・パターンの数 */
  const uses = useMemo(() => typeUses({ visits: data.visits, patterns: data.patterns }), [data.visits, data.patterns]);

  const open = (t: VisitType | null) => {
    setError(null);
    setIsNew(!t);
    setForm(visitTypeForm(t ?? blankVisitType(data.visitTypes.length)));
  };

  const save = () => {
    if (!form) return;
    setError(null);
    const r = checkVisitTypeForm(form, data.visitTypes, isNew);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    const t = r.type;
    update((d) => saveVisitType(d, t), '訪問の種類を保存');
    setIsNew(false);
    setForm(null);
    toast('保存しました');
  };

  const remove = async (t: VisitType) => {
    const u = usesOf(uses, t.id);
    const ok = await confirmDialog({
      title: `種類「${t.name}」を消しますか？`,
      body: `${t.name}を使っている訪問 ${u.visits}件・定期パターン ${u.patterns}件は種類なしになります。`,
      confirmLabel: '消す',
      tone: 'danger',
    });
    if (!ok) return;
    update((d) => removeVisitType(d, t.id), '訪問の種類を消す', { tell: false });
    setForm(null);
    toast(`種類「${t.name}」を消しました`);
  };

  return { form, setForm, isNew, error, errorId, bad, uses, open, save, remove };
}
