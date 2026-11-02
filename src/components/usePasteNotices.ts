// 「連絡を貼り付けて入れる」の欄（PRD D418。ADR-0084）の状態と処理：貼った文を入力のたびに少し待って読み（lib/pasteRows）、
// 一覧のチェックを持ち、［N件を入れる］で欠勤・訪問の取り消し・〈利用者さん〉の休みを1回の update で書く（元に戻せる）。振り直さない
import { useEffect, useMemo, useState } from 'react';
import { jstDate } from '../domain/time';
import { newId } from '../lib/common';
import {
  applyPasteRows,
  type PasteRow,
  pasteCareCount,
  pasteDoneText,
  pasteRowKeys,
  pasteRows,
} from '../lib/pasteRows';
import { useDemoData } from '../store';
import { useToast } from './Toast';
import { useUndoAction } from './undo';

/** 打つ・貼るたびに読み直すまでの待ち（ミリ秒） */
export const PASTE_READ_DELAY_MS = 250;

export function usePasteNotices(onClose: () => void) {
  const { data, update } = useDemoData();
  const toast = useToast();
  const undoAction = useUndoAction();
  const today = jstDate(Date.now());
  const [text, setText] = useState('');
  /** 読んだ文（入力のたびに読み直さず、少し待ってから） */
  const [readText, setReadText] = useState('');
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const t = setTimeout(() => setReadText(text), PASTE_READ_DELAY_MS);
    return () => clearTimeout(t);
  }, [text]);
  const rows = useMemo(() => pasteRows(data, readText, today), [data, readText, today]);
  /** 一覧の行の鍵（文と同じ文の何回目か。上に行を足しても外したチェックを保つ） */
  const keys = useMemo(() => pasteRowKeys(rows), [rows]);
  const pickedOf = (list: readonly PasteRow[]) => {
    const ks = list === rows ? keys : pasteRowKeys(list);
    return list.filter((r, i) => r.action && !unchecked.has(ks[i]!));
  };
  const picked = pickedOf(rows);

  const save = () => {
    // 待っている間に押したら、今の文で読み直してから入れる
    const list = pickedOf(readText === text ? rows : pasteRows(data, text, today));
    if (list.length === 0) return;
    const care = pasteCareCount(applyPasteRows(data, list, today, newId), list, today);
    update((d) => applyPasteRows(d, list, today, newId), '連絡を貼り付けて入れる');
    toast(pasteDoneText(list.length, care), { action: undoAction });
    onClose();
  };

  const toggle = (i: number) => {
    const r = rows[i];
    if (!r?.action) return;
    const k = keys[i]!;
    setUnchecked((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  return {
    text,
    setText,
    rows,
    /** その行が入れる対象か（読めた行でチェックが入） */
    checked: (i: number) => !!rows[i]?.action && !unchecked.has(keys[i]!),
    toggle,
    count: picked.length,
    terms: data.org.terms,
    save,
  };
}
