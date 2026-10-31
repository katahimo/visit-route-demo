// 「予定を入れる」の引き出し（AddPlanPanel）の状態と保存：〈利用者さん〉・入れ方（定期／単発）ごとの欄の値と、保存。
// 保存は今ある仕組みを使う：定期は〈利用者さん〉の繰り返しを足す（usePatternAdd）、単発はその日の訪問を足す（lib/visitOps の applyVisitEdit）。
// どちらも入れたあと、担当なしの分を自動で組む（ADR-0072）。データを書くのは store の update だけ
import { useId, useState } from 'react';
import { jstDate } from '../domain/time';
import {
  type AddPlanError,
  type AddPlanField,
  addPlanClients,
  addPlanDate,
  addPlanDone,
  addPlanError,
  addPlanFieldOf,
  addPlanKind,
  addPlanPatternForm,
  addPlanSaveError,
  addPlanVisitDraft,
} from '../lib/addPlan';
import { requestAutoArrange } from '../lib/autoArrangeBatch';
import { newId } from '../lib/common';
import { dateText } from '../lib/dateText';
import { patternWhenText } from '../lib/patternText';
import { applyVisitEdit } from '../lib/visitOps';
import { useDemoData } from '../store';
import { useDay } from './day';
import { invalidAttrs } from './FieldError';
import { useToast } from './Toast';
import { useUndoAction } from './undo';
import { usePatternAdd } from './usePatternAdd';

/** 訪問の入力の欄 → 引き出しの欄（無いものは文から探す） */
const FIELD_OF: Partial<Record<string, AddPlanField>> = {
  date: 'date',
  earliestStart: 'start',
  latestStart: 'start',
  durationMinutes: 'duration',
  clientId: 'client',
};

export function useAddPlan(onClose: () => void) {
  const { data, update, latest } = useDemoData();
  const toast = useToast();
  const undoAction = useUndoAction();
  const addPattern = usePatternAdd();
  const { date: shown } = useDay();
  const today = jstDate(Date.now());
  const kind = addPlanKind(data.org.features);
  const clients = addPlanClients(data);
  const first = addPlanDate(shown, today);
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [pform, setPform] = useState(() => addPlanPatternForm(first, today));
  const [draft, setDraft] = useState(() => addPlanVisitDraft(data, first, clients[0]?.id));
  const [errorState, setErrorState] = useState<AddPlanError | null>(null);
  const errorId = useId();
  const fail = (text: string, field?: AddPlanField) => setErrorState({ text, field: field ?? addPlanFieldOf(text) });
  /** 入力の欄の誤りの印（aria-invalid・aria-describedby） */
  const bad = (f: AddPlanField) => invalidAttrs(errorState?.field === f, errorId);

  /** 時刻・所要は定期・単発で同じ欄（どちらの値も同じに書き換える） */
  const setStart = (t: string) => {
    setPform({ ...pform, earliestStart: t, latestStart: t });
    setDraft({ ...draft, earliestStart: t, latestStart: t });
  };
  const setDuration = (minutes: string) => {
    setPform({ ...pform, durationMinutes: minutes });
    setDraft({ ...draft, durationMinutes: minutes === '' ? Number.NaN : Number(minutes) });
  };

  const saveRecurring = () => {
    const r = addPattern(pform, clientId);
    if ('error' in r) return fail(r.error);
    toast(addPlanDone(patternWhenText(r.pattern), r.auto), { action: undoAction });
    onClose();
  };

  const saveOneOff = () => {
    const input = { visitId: null, draft: { ...draft, clientId }, staff: undefined, scope: 'once' } as const;
    const ids = { visit: newId('v'), patterns: [newId('pt'), newId('pt')] } as const;
    // 描画のあとにデータが変わっていても、いまのデータで確かめて入れる。入れられなければ何も書かず・知らせず・組まず、誤りを出す
    const before = latest.current;
    const r = applyVisitEdit(before, input, today, ids);
    if (!r.ok) return fail(addPlanSaveError(r.error, before !== data), FIELD_OF[r.field ?? '']);
    update((d) => {
      if (d === before) return r.data;
      const x = applyVisitEdit(d, input, today, ids);
      return x.ok ? x.data : d;
    }, '訪問を追加');
    const auto = requestAutoArrange({ before, after: r.data, today, writeUsual: false });
    toast(addPlanDone(`${dateText(draft.date)} ${draft.earliestStart}`, auto), { action: undoAction });
    onClose();
  };

  const save = () => {
    setErrorState(null);
    const e = addPlanError(
      kind,
      { clientId, weekdays: pform.weekdays, duration: draft.durationMinutes },
      data.org.terms.client,
    );
    if (e) return fail(e.text, e.field);
    if (kind === 'recurring') saveRecurring();
    else saveOneOff();
  };

  return {
    kind,
    clients,
    clientId,
    setClientId,
    pform,
    setPform,
    draft,
    setDraft,
    setStart,
    setDuration,
    errorState,
    errorId,
    bad,
    save,
    today,
    terms: data.org.terms,
  };
}
