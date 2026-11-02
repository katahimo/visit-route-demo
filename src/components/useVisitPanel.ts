// 訪問の詳細の欄（VisitPanel）の状態と処理：入力・担当の候補・書く・保存・取り消し。データは lib/visitOps 越しに読み書きし、
// 書くのは store の update だけ
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DemoData } from '../contracts/data';
import type { Client, Visit } from '../contracts/documents';
import { requestAutoArrange } from '../lib/autoArrangeBatch';
import { newId } from '../lib/common';
import { dateText } from '../lib/dateText';
import { confirmLeave } from '../lib/leaveGuard';
import { directionsHref } from '../lib/mapsLink';
import { prevStopOf } from '../lib/prevStop';
import { draftOf, newDraft, SCOPE_LABELS, type VisitDraft, type VisitInfo, type VisitScope } from '../lib/visitDraft';
import { applyVisitEdit, cancelVisitOp, restoreOccurrenceOp, toldDaysChanged, uncancelVisitOp } from '../lib/visitOps';
import { savedText } from '../lib/visitPanelText';
import { staffChoices } from '../lib/visitStaff';
import { findVisit } from '../patterns';
import { type UpdateOptions, useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';
import { useDay } from './day';
import { invalidAttrs } from './FieldError';
import { useToast } from './Toast';
import { useUndoAction } from './undo';
import type { VisitPanelRequest } from './VisitPanel';

/** 一覧の選択肢の「変えない」 */
export const KEEP = '__keep';
/** 一覧の選択肢の「担当なし」 */
export const NONE_PICK = '__none';

const STALE = '開いている間にデータが変わりました。閉じて開き直してください';

export type VisitError = { text: string; field?: keyof VisitDraft };

/** 欄の入力（下書き・担当の選択・範囲・誤りとその欄の印）。はじめの入力は開いた訪問か新しい訪問の既定に頼みの draft を重ねる */
export function useVisitForm(req: VisitPanelRequest, data: DemoData, today: string) {
  const [draft, setDraft] = useState<VisitDraft>(() => {
    const base = req.visitId
      ? (() => {
          const x = req.visitId ? findVisit(data, req.visitId) : null;
          return x ? draftOf(x) : newDraft(data, today);
        })()
      : newDraft(data, req.newVisit?.date ?? today, req.newVisit?.clientId, req.newVisit?.start);
    return { ...base, ...req.draft };
  });
  const [pick, setPick] = useState<string>(req.staff ?? KEEP);
  const [scope, setScope] = useState<VisitScope>('once');
  const [error, setError] = useState<VisitError | null>(null);
  const errorId = useId();
  /** 入力の欄の誤りの印 */
  const bad = (k: keyof VisitDraft) => invalidAttrs(error?.field === k, errorId);
  const set = (patch: Partial<VisitDraft>) => {
    setDraft((f) => ({ ...f, ...patch }));
    setError(null);
  };
  return { draft, setDraft, set, pick, setPick, scope, setScope, error, setError, errorId, bad };
}

/**
 * 担当の候補（日時を変えたらその日時で計算し直す。打つたびに計算しないよう遅らせる）。候補が変わり、選んでいた人が候補に無い・
 * 選べなくなったら「変えない」に戻す（担当なしも今の担当がいなくなれば戻す）
 */
export function useStaffChoices(
  data: DemoData,
  visitId: string | null,
  draft: VisitDraft,
  on: boolean,
  pick: string,
  setPick: (p: string) => void,
) {
  const deferred = useDeferredValue(draft);
  const choices = useMemo(() => (on ? staffChoices(data, visitId, deferred) : null), [data, visitId, deferred, on]);
  useEffect(() => {
    if (!choices || pick === KEEP) return;
    const ok =
      pick === NONE_PICK
        ? choices.currentStaffId !== null
        : choices.choices.some((c) => c.staffId === pick && !c.disabled && !c.current);
    if (!ok) setPick(KEEP);
  }, [choices, pick, setPick]);
  return choices;
}

/**
 * 書く：別のタブ・別の操作で開いた訪問が変わっていないかを見て、書く前のデータが今のデータのときだけ書く。
 * latest はトーストの「元に戻す」のために殻で追う今のデータ
 */
export function useVisitWriter(visitId: string | null, isNew: boolean, latest: { readonly current: DemoData }) {
  const { data, update } = useDemoData();
  /**
   * 開いたときの訪問（欄の中の書き込みのあとは書いた形に差し替える）。保存・取り消しの前にデータの訪問と比べ、別のタブ・別の操作で
   * 変わっていれば古い入力で上書きしない
   */
  const baseRef = useRef<Visit | null>(visitId ? findVisit(data, visitId) : null);
  /** トーストの「元に戻す」（全体の履歴を1手戻す。PRD D329） */
  const undoAction = useUndoAction();

  /** 別のタブ・別の操作で開いた訪問が変わっていれば、その文（保存・取り消しを止める） */
  const changedElsewhere = (): string | null => {
    if (isNew || !visitId) return null;
    const now = visitId ? findVisit(latest.current, visitId) : null;
    return JSON.stringify(now) !== JSON.stringify(baseRef.current)
      ? 'この訪問は別の操作で変わりました。閉じて開き直してください'
      : null;
  };
  /**
   * 書く（書く前のデータが今のデータのときだけ。確認を待つ間などに別の変更が入っていれば書かずに null を返し、呼ぶ側が誤りを出す）。
   * 書いたら「元に戻す」の操作を返す。label は全体の履歴の手の名前
   */
  const write = (next: DemoData, label: string, opts?: UpdateOptions) => {
    const before = data;
    if (latest.current !== before) return null;
    update((d) => (d === before ? next : d), label, opts);
    if (visitId) baseRef.current = findVisit(next, visitId);
    return undoAction;
  };
  return { data, changedElsewhere, write };
}

type Writer = ReturnType<typeof useVisitWriter>;
type Form = ReturnType<typeof useVisitForm>;

/** 保存（日時・担当・範囲。これ以降・すべてで確定した日の訪問も変わるなら確かめる） */
export function useVisitSave(p: {
  req: VisitPanelRequest;
  writer: Writer;
  form: Form;
  visitId: string | null;
  info: VisitInfo | null;
  isNew: boolean;
  /** 保存できる（変えられる訪問で、狭い画面の新しい訪問でない）。できなければ閉じるだけ */
  savable: boolean;
  clientName: string;
  today: string;
  savedRef: { current: string | null };
  onClose: () => void;
}) {
  const { req, writer, form, visitId, info, isNew, today, onClose } = p;
  const { data, changedElsewhere, write } = writer;
  const { draft, pick, scope, setError } = form;
  const toast = useToast();
  const confirm = useConfirm();
  const v = info?.visit ?? null;
  return async () => {
    if (!p.savable) {
      onClose();
      return;
    }
    const elsewhere = changedElsewhere();
    if (elsewhere) {
      setError({ text: elsewhere });
      return;
    }
    const staff = pick === KEEP ? undefined : pick === NONE_PICK ? null : pick;
    const r = applyVisitEdit(
      data,
      { visitId, draft, staff, scope },
      today,
      { visit: newId('v'), patterns: [newId('pt'), newId('pt')] },
      Date.now(),
    );
    if (!r.ok) {
      setError({ text: r.error, field: r.field });
      return;
    }
    if (r.unchanged) {
      toast('変更はありません');
      onClose();
      return;
    }
    // これ以降・すべてで確定した日の訪問も変わるなら確かめる（週のドラッグと同じ）
    if (scope !== 'once' && !isNew) {
      const fixed = toldDaysChanged(data, r.data, today);
      if (
        fixed.length > 0 &&
        !(await confirm({
          title: '確定した日の訪問も変えますか？',
          body: `確定した日（${fixed.map((x) => dateText(x)).join('・')}）の訪問も変わります。その日は「未連絡の変更あり」になり、連絡の一覧に出ます。`,
          confirmLabel: '変える',
        }))
      )
        return;
    }
    const action = write(r.data, isNew ? '訪問を追加' : '訪問を保存');
    if (!action) {
      setError({ text: STALE });
      return;
    }
    // 保存した訪問が担当なしで増えた・日時が変わったなら、その分を自動で組む（保存の前後のデータで対象を決める。繰り返しの担当は書かない）
    // 人が「担当なし」とはっきり選んで保存したときは依頼しない（外した担当を黙って付け直さない）
    if (staff !== null) requestAutoArrange({ before: data, after: r.data, today, writeUsual: false });
    const after = findVisit(r.data, r.visitId);
    const label = after ? `${dateText(after.date)} ${after.earliestStart}` : '';
    const range = info?.pattern && !isNew ? `・${SCOPE_LABELS[scope]}` : '';
    toast(savedText(isNew, label, range, r.failed), { action });
    p.savedRef.current = r.visitId;
    req.onSaved?.({
      visitId: r.visitId,
      date: after?.date ?? draft.date,
      moved: isNew || (!!v && (after?.date !== v.date || after?.earliestStart !== v.earliestStart)),
      staffSet: staff !== undefined,
      isNew,
      label: `${p.clientName} ${label}`,
    });
    onClose();
  };
}

/** 欄の中の操作：取り消す・取り消しをやめる・この回の変更を戻す（前に別の操作で変わっていないかを見る） */
export function useVisitActions(req: VisitPanelRequest, writer: Writer, form: Form, v: Visit | null, today: string) {
  const { data, changedElsewhere, write } = writer;
  const { setError, setDraft } = form;
  const toast = useToast();
  /** 別の操作で変わっていれば誤りを出して true */
  const blocked = () => {
    const t = changedElsewhere();
    if (t) setError({ text: t });
    return !!t;
  };
  const doCancel = (sameDay: boolean) => {
    if (!v || blocked()) return;
    const action = write(cancelVisitOp(data, v.id, sameDay), sameDay ? '当日キャンセル' : '訪問を取り消す');
    if (!action) return setError({ text: STALE });
    toast(sameDay ? '当日キャンセルとして取り消しました' : '取り消しました', { action });
    req.onSaved?.({ visitId: v.id, date: v.date, moved: false, staffSet: false, isNew: false, label: '' });
  };
  const doUncancel = () => {
    if (!v || blocked()) return;
    const action = write(uncancelVisitOp(data, v.id), '取り消しをやめる');
    if (!action) return setError({ text: STALE });
    toast('取り消しをやめました', { action });
    req.onSaved?.({ visitId: v.id, date: v.date, moved: false, staffSet: false, isNew: false, label: '' });
  };
  const doRestore = () => {
    if (!v || blocked()) return;
    const next = restoreOccurrenceOp(data, v.id, today);
    if (next === data) return;
    const action = write(next, 'この回の変更を戻す');
    if (!action) return setError({ text: STALE });
    const after = findVisit(next, v.id);
    if (after) setDraft(draftOf(after));
    toast('この回の変更を戻しました（繰り返しのとおり）', { action });
  };
  return { doCancel, doUncancel, doRestore };
}

/** 日の予定でその日を開く（今その日の日の予定にいるなら出さない）。draftDate は新しい訪問の入力の日 */
export function useOpenDay(isNew: boolean, v: Visit | null, draftDate: string, onClose: () => void) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { date: shownDate, setDate } = useDay();
  const dayDate = v?.date ?? draftDate;
  const showDayLink = !isNew && !(pathname === '/plan' && shownDate === dayDate);
  const openDay = async () => {
    // 下書きのある画面（人の画面の節・条件の重み）から移るときは確かめる（断れば移らない）
    if (!(await confirmLeave())) return;
    onClose();
    setDate(dayDate);
    navigate('/plan', v ? { state: { visitId: v.id } } : undefined);
  };
  return { showDayLink, openDay };
}

/**
 * 道順（今の担当の列の前の訪問先、1件目は自宅から。lib/prevStop）と、スマホの「道順」のリンク：前の場所（前の訪問先・自宅）から。
 * 担当が無ければ今いる場所から（Google マップ。ADR-0018）
 */
export function useVisitRoute(data: DemoData, v: Visit | null, client: Client | undefined, mapsOn: boolean) {
  const route = useMemo(() => (v ? prevStopOf(data, v.id) : null), [v, data]);
  const routeHref = useMemo(() => {
    if (!v || !client || !mapsOn) return null;
    const mode = route?.staff.travelMode ?? 'DRIVE';
    return (
      (route?.from ? directionsHref({ origin: route.from, destination: client.place, mode }) : null) ??
      directionsHref({ origin: null, destination: client.place, mode })
    );
  }, [v, client, route, mapsOn]);
  return { route, routeHref };
}
