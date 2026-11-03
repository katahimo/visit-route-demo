// 〈スタッフ〉の画面の節の編集（PRD D299・D308〜D310。ADR-0014・ADR-0015・ADR-0050・ADR-0052）：直している節と入力・誤り・
// 編集中の印（離れるときの確かめ）・直し始める／取り消す・保存（検査 → 休止の確かめ → 保存 → 担当の振り直しの欄）
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { type FormErr, invalidAttrs, toFormErr } from '../components/FieldError';
import { useAskDiscard } from '../components/personPage';
import { useToast } from '../components/Toast';
import { useLeaveGuard } from '../components/useLeaveGuard';
import { type Staff, staffSchema } from '../contracts/documents';
import { addDays } from '../domain/time';
import { mdText } from '../lib/dateText';
import { offboardScope } from '../lib/offboard';
import { mergeFields, pickFields } from '../lib/personPage';
import {
  blankStaff,
  checkStaffFields,
  pauseTargets,
  STAFF_SECTIONS,
  type StaffSecKey,
  savedStaffData,
  withStaff,
} from '../lib/staffEdit';
import { staffColorMap } from '../lib/staffMark';
import { isDirty } from '../lib/viewMode';
import { useDemoData } from '../store';

type Edit = { key: StaffSecKey | 'new'; form: Staff; opened: Staff };

/** useStaffEdit に渡すもの */
type StaffEditOptions = {
  /** 保存してある人（新しい人なら undefined） */
  saved: Staff | undefined;
  isNew: boolean;
  today: string;
  offboardOn: boolean;
  allowedStaffOn: boolean;
  onDirty: (dirty: boolean, who: string) => void;
  onLeave: () => void;
  /** 担当の振り直しの欄を開く */
  setOffboard: (open: boolean) => void;
};

export function useStaffEdit(opts: StaffEditOptions) {
  const { saved, isNew, onDirty, onLeave } = opts;
  const { data } = useDemoData();
  const terms = data.org.terms;
  const confirmDialog = useConfirm();
  const navigate = useNavigate();
  const [edit, setEdit] = useState<Edit | null>(() => {
    if (!isNew) return null;
    const f = blankStaff(data.org.features);
    return { key: 'new', form: f, opened: structuredClone(f) };
  });
  const [error, setError] = useState<FormErr>(null);
  const sectionDirty = (() => {
    if (!edit) return false;
    if (edit.key === 'new') return isDirty(edit.form, edit.opened);
    if (!saved) return true;
    const keys = STAFF_SECTIONS[edit.key];
    return isDirty(pickFields(edit.form, keys), pickFields(saved, keys));
  })();
  const whoText = `${(edit?.form.name ?? saved?.name ?? '').trim() || '（名前なし）'}（${terms.staff}）`;
  useEffect(() => {
    onDirty(sectionDirty, whoText);
  }, [sectionDirty, whoText, onDirty]);
  const discardAll = useCallback(() => {
    setEdit(null);
    setError(null);
  }, []);
  useLeaveGuard(
    sectionDirty,
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
  const ask = useAskDiscard(sectionDirty, whoText);
  // 一覧の「位置なし」の［地図で置く］・まとめて置けなかった人の「編集」から節を開いて来たとき（`?edit=home`。PRD D427）。
  // 開いたら URL から消す
  const [params, setParams] = useSearchParams();
  const editParam = params.get('edit');
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の edit が替わったときだけ
  useEffect(() => {
    if (!editParam) return;
    if (editParam in STAFF_SECTIONS && saved)
      setEdit({ key: editParam as StaffSecKey, form: structuredClone(saved), opened: structuredClone(saved) });
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('edit');
        return p;
      },
      { replace: true },
    );
  }, [editParam]);
  const startEdit = async (key: StaffSecKey) => {
    if (!saved || edit?.key === key) return;
    if (!(await ask('section'))) return;
    setError(null);
    setEdit({ key, form: structuredClone(saved), opened: structuredClone(saved) });
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
      onLeave();
      setEdit(null);
      navigate('/staff');
      return;
    }
    setEdit(null);
    setError(null);
  };
  const setForm = (f: Staff | ((s: Staff) => Staff)) =>
    setEdit((e) => (e ? { ...e, form: typeof f === 'function' ? f(e.form) : f } : e));
  const form = edit?.form ?? null;
  /** 誤りの文の id（節の誤りの文と入力欄の aria-describedby で同じもの） */
  const errorId = useId();
  const bad = (field: string) => invalidAttrs(error?.field === field, errorId);
  /** 編集中の印の見本の色（保存したあとの名前の並びで決まる色） */
  const previewColor = useMemo(
    () =>
      form
        ? staffColorMap([
            ...data.staff.filter((x) => x.id !== form.id),
            { ...form, name: form.name.trim() || form.name },
          ]).get(form.id)
        : undefined,
    [form, data.staff],
  );

  const save = useStaffSave({ ...opts, edit, setEdit, setError });

  /** 節の部品（EditSection）に渡す、開け閉め・保存・誤り */
  const sec = (key: StaffSecKey) => {
    const editing = edit?.key === key;
    return {
      name: key,
      editing,
      onEdit: () => void startEdit(key),
      onSave: save,
      onCancel: () => void cancelEdit(),
      error: editing ? error : null,
      errorId,
    };
  };

  return { edit, form, setForm, error, errorId, bad, previewColor, save, cancelEdit, discardAll, ask, sec };
}

/**
 * 保存（直している節の項目だけ検査 → 休止にするなら確かめる → 保存 → 最終勤務日を入れたら担当の振り直しの欄）。
 * 新しい人は保存したらその人の画面（基本情報）へ移る
 */
function useStaffSave({
  saved,
  today,
  offboardOn,
  allowedStaffOn,
  onLeave,
  setOffboard,
  edit,
  setEdit,
  setError,
}: StaffEditOptions & {
  edit: Edit | null;
  setEdit: (e: Edit | null) => void;
  setError: (e: FormErr) => void;
}) {
  const { data, update } = useDemoData();
  const terms = data.org.terms;
  const toast = useToast();
  const confirmDialog = useConfirm();
  const navigate = useNavigate();
  return async () => {
    if (!edit) return;
    setError(null);
    const key = edit.key;
    const base = key === 'new' || !saved ? edit.form : mergeFields(saved, edit.form, STAFF_SECTIONS[key]);
    /** 検査するのは直している節の項目だけ（ほかの節の古い値で保存を止めない） */
    const keys: readonly (keyof Staff)[] = key === 'new' ? (Object.keys(base) as (keyof Staff)[]) : STAFF_SECTIONS[key];
    const checked = checkStaffFields(data.staff, base, keys, terms.staff);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    const { email, icon } = checked;
    try {
      const s = staffSchema.parse({ ...base, email, icon });
      // 休止にするとき、〈利用者さん〉の「担当できる人」から外す（ADR-0014）
      const { limited, emptied } = pauseTargets(data, s);
      if (limited.length > 0 && allowedStaffOn) {
        const ok = await confirmDialog({
          title: `${s.name}さんを休止にして保存しますか？`,
          body: `${limited.map((c) => c.displayName).join('・')}の「担当できる人」から外します。${
            emptied.length > 0
              ? `${emptied.map((c) => c.displayName).join('・')}は担当できる人がいなくなり、だれでも担当できるようになります（必要なら${terms.client}の画面で選び直してください）。`
              : ''
          }\nあとで利用中に戻しても、担当できる人には戻りません。`,
          confirmLabel: '休止にして保存する',
        });
        if (!ok) return;
      }
      // 最終勤務日を入れた・変えたら、保存のあとに担当の振り直しの欄を開く（振り直すものがあるときだけ。ADR-0015）
      const lastDayChanged = s.active && s.lastDay !== null && saved?.lastDay !== s.lastDay;
      const nextData = { ...data, staff: withStaff(data.staff, s) };
      const sc = lastDayChanged && offboardOn ? offboardScope(nextData, s.id, today, false) : null;
      update((d) => savedStaffData(d, s), 'スタッフの保存');
      setEdit(null);
      if (sc && (sc.clients.length > 0 || sc.visits.length > 0)) {
        setOffboard(true);
        toast(`保存しました。${mdText(addDays(s.lastDay ?? '', 1))}からの担当を振り直してください`);
      } else toast('保存しました');
      if (key === 'new') {
        onLeave();
        navigate(`/staff/${encodeURIComponent(s.id)}?tab=basic`, { replace: true });
      }
    } catch (e) {
      setError(toFormErr(e));
    }
  };
}

/** 入力欄を直す関数（値か、今の入力から作る関数） */
export type SetStaffForm = ReturnType<typeof useStaffEdit>['setForm'];
/** 入力欄の誤りの属性（aria-invalid・aria-describedby） */
export type StaffBadAttrs = ReturnType<typeof useStaffEdit>['bad'];
