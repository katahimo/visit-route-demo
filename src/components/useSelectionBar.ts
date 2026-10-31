import { useEffect, useMemo, useRef, useState } from 'react';
import type { DemoData } from '../contracts/data';
import { jstDate } from '../domain/time';
import { dateText } from '../lib/dateText';
import { assignMany, cancelMany, moveManyToDate, multiResultText, shiftMany } from '../lib/multiEdit';
import { toldDaysChanged } from '../lib/visitOps';
import { findVisit } from '../patterns';
import { useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';
import { focusUndo } from './undo';
import { COMPACT_QUERY, useMedia } from './useMedia';

type Edit = (d: DemoData) => { data: DemoData; done: number; failed: { why: string }[] };

/**
 * 複数選択の帯（SelectionBar）の状態と処理：選んだ訪問のうち今見ている日付のもの・担当の候補・「別の日へ」の日付の欄・
 * 担当を替える／時刻をずらす／別の日へ移す／取り消す。どれも1回の update（全体の「元に戻す」で1手戻る）
 */
export function useSelectionBar(ids: readonly string[], dates: readonly string[], onClear: () => void) {
  const { data, update } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const today = jstDate(Date.now());
  /** スマホ（600px 以下）は下から出る欄の置き場所に、時刻をずらすは出さない（スマホでは動かさない。ADR-0051 の決定5） */
  const compact = useMedia(COMPACT_QUERY);
  const live = ids.filter((id) => {
    const v = findVisit(data, id);
    return !!v && dates.includes(v.date);
  });
  const staff = useMemo(() => data.staff.filter((s) => s.active), [data.staff]);
  /** 「別の日へ」の日付（null は閉じている） */
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const moveRef = useRef<HTMLButtonElement>(null);
  // 選んだ訪問が無くなったら日付の欄も閉じる（次に選んだとき開いたまま出さない）
  const empty = live.length === 0;
  useEffect(() => {
    if (empty) setMoveTo(null);
  }, [empty]);

  const run = (what: string, fn: Edit) => {
    // 結果の数は今のデータで見るが、書くのは store の最新のデータに反映し直す（確認を待つ間の別のタブの変更を消さない）
    const r = fn(data);
    // 選んだ訪問のまとめ直しは自動の組みを依頼しないので、決まった扱いは待たずに付ける（ADR-0073）
    if (r.done > 0) update((d) => fn(d).data, what, { settleNow: true });
    toast(multiResultText(what, { done: r.done, failed: r.failed.map((f) => ({ visitId: '', why: f.why })) }));
    return r.done;
  };

  const assignTo = (staffId: string) => run('担当を替えました', (d) => assignMany(d, live, staffId, today));

  const shiftBy = (m: number) =>
    run(`時刻を${m > 0 ? '+' : '−'}${Math.abs(m)}分ずらしました`, (d) => shiftMany(d, live, m, today));

  /** 日付の欄の「移す」：確定した日が変わるなら確かめてから移す */
  const moveGo = async () => {
    const to = moveTo;
    if (!to) return;
    // 確定（伝えた）した日（移す前の日・移す先の日）が変わるなら確かめる（キー・欄と同じ文）
    const fixed = toldDaysChanged(data, moveManyToDate(data, live, to, today).data, today);
    if (
      fixed.length > 0 &&
      !(await confirmDialog({
        title: '確定した日の訪問も変えますか？',
        body: `確定した日（${fixed.map((x) => dateText(x)).join('・')}）の訪問も変わります。その日は「未連絡の変更あり」になり、連絡の一覧に出ます。`,
        confirmLabel: '変える',
      }))
    )
      return;
    const done = run(`${dateText(to)}へ移しました`, (d) => moveManyToDate(d, live, to, today));
    setMoveTo(null);
    // 1件も移せなければ選んだまま（選び直さなくてよい）。移したら帯が消えるので、フォーカスは「元に戻す」へ
    if (done === 0) return;
    onClear();
    focusUndo();
  };

  /** 「取り消す」：確かめてから選んだ訪問を取り消す */
  const cancelSelected = async () => {
    const ok = await confirmDialog({
      title: `${live.length}件の訪問を取り消しますか？`,
      body: '取り消した訪問は担当の並びから外れます。「元に戻す」で戻せます。',
      confirmLabel: '訪問を取り消す',
      cancelLabel: 'やめる',
      tone: 'danger',
    });
    if (!ok) return;
    run('訪問を取り消しました', (d) => cancelMany(d, live, today));
    onClear();
  };

  return { today, compact, live, staff, moveTo, setMoveTo, moveRef, assignTo, shiftBy, moveGo, cancelSelected };
}
