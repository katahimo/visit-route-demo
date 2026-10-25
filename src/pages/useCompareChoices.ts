// 提案を比べるの比べる案と A・B の選び方の状態：この画面で作った提案（保存しない。日付を変えると捨てる）・
// 担当を組むの提案のうちこの画面で隠したもの・選んだ A・B。案の一覧の組み立ては lib/compareChoices
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { useUndoAction } from '../components/undo';
import type { DemoData, ReassignInfo } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import {
  arrangeChoices,
  BEFORE_CHOICE,
  type CompareChoice,
  type CompareSelection,
  type CompareSide,
  CURRENT_CHOICE,
  compareChoices,
  comparePair,
  isArrangeChoice,
  pickSide,
} from '../lib/compareChoices';
import { writeRoutes } from '../lib/dayPlan';
import type { BatchProposal } from '../lib/monthBatch';

export type CompareChoicesState = {
  choices: CompareChoice[];
  A: CompareChoice | undefined;
  B: CompareChoice | undefined;
  /** A・B を選ぶ（もう一方と同じ案なら入れ替える） */
  pick: (side: CompareSide, id: string) => void;
  /** 作った提案を足し、A＝今の担当・B＝作った提案に並べる */
  addMade: (c: CompareChoice, forDate: string) => void;
  /** 反映した提案を一覧から外し、A・B を既定に戻す */
  dropApplied: (c: CompareChoice) => void;
  /** 提案を消す（選んでいれば外す） */
  remove: (c: CompareChoice) => void;
};

/**
 * 比べる案の状態。onChange は比べる案が変わったとき（選んだ訪問・区間の持ち主も変わるので外す）。
 * asked は日の予定の「比較の画面で見る」で来たときの指定（A＝欠勤前、B＝今の担当。ADR-0011）
 */
export function useCompareChoices({
  data,
  date,
  problem,
  allVisits,
  reassign,
  batch,
  asked,
  onChange,
}: {
  data: DemoData;
  date: string;
  problem: Problem | null;
  allVisits: readonly Visit[];
  reassign: ReassignInfo | null;
  batch: BatchProposal | null;
  asked: { a?: string; b?: string } | null;
  onChange: () => void;
}): CompareChoicesState {
  const [sel, setSel] = useState<CompareSelection>({ a: null, b: null });
  /** この画面で作った提案（保存しない。日付を変えると捨てる） */
  const [proposals, setProposals] = useState<{ date: string; list: CompareChoice[] }>({ date, list: [] });
  const made = proposals.date === date ? proposals.list : [];
  /** 担当を組むの提案のうちこの画面で消した・反映したもの */
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const fromArrange = useMemo(
    () => arrangeChoices(batch, date, data.presets, data.rules, hidden),
    [batch, date, data.presets, data.rules, hidden],
  );
  // 日付を変えたら選んだ案・作った提案を外す（選んだ訪問・区間は useRouteSelection が外す）
  useEffect(() => {
    setSel({ a: null, b: null });
    setProposals({ date, list: [] });
  }, [date]);
  const choices = useMemo(
    () => compareChoices({ problem, visits: allVisits, reassign, rules: data.rules, fromArrange, made }),
    [problem, allVisits, reassign, data.rules, made, fromArrange],
  );
  // 日の予定から「比較の画面で見る」で来たら、A＝欠勤前、B＝今の担当
  // biome-ignore lint/correctness/useExhaustiveDependencies: 来たときに1回だけ合わせる
  useEffect(() => {
    if (asked?.a !== 'before' || !reassign) return;
    setSel({ a: BEFORE_CHOICE, b: CURRENT_CHOICE });
  }, [asked]);
  const pair = comparePair(choices, sel);
  const hide = (c: CompareChoice) => {
    if (isArrangeChoice(c)) setHidden((h) => new Set([...h, c.id]));
    setProposals((x) => ({ ...x, list: x.list.filter((y) => y.id !== c.id) }));
  };
  return {
    choices,
    ...pair,
    pick: (side, id) => {
      const mine = side === 'a' ? pair.A : pair.B;
      if (mine?.id === id) return;
      setSel((s) => pickSide(s, pair, side, id) ?? s);
      onChange();
    },
    addMade: (c, forDate) => {
      setProposals((x) => ({ date: forDate, list: x.date === forDate ? [...x.list, c] : [c] }));
      setSel({ a: CURRENT_CHOICE, b: c.id });
      onChange();
    },
    dropApplied: (c) => {
      hide(c);
      setSel({ a: null, b: null });
      onChange();
    },
    remove: (c) => {
      hide(c);
      setSel((s) => ({ a: s.a === c.id ? null : s.a, b: s.b === c.id ? null : s.b }));
      onChange();
    },
  };
}

/**
 * 提案を反映する：訪問の担当・開始に書く（ピンの訪問はそのまま）。提案を作ったあとに訪問が変わっていたら当てない。
 * 全体の「元に戻す」の1手（トーストと Ctrl+Z・予定の操作の行の「元に戻す」。PRD D329）。反映したら onApplied
 */
export function useApplyChoice({
  data,
  update,
  date,
  problem,
  stale,
  onApplied,
}: {
  data: DemoData;
  update: (fn: (d: DemoData) => DemoData, label?: string) => void;
  date: string;
  problem: Problem | null;
  stale: (c: CompareChoice) => boolean;
  onApplied: (c: CompareChoice) => void;
}): (c: CompareChoice) => void {
  const toast = useToast();
  const undoAction = useUndoAction();
  return (c) => {
    if (!problem || c.kind !== 'proposal') return;
    if (stale(c)) {
      toast('提案を作ったあとに訪問が変わりました。もう一度作ってください');
      return;
    }
    const p = problem;
    const before = data;
    const next = writeRoutes(before, date, p, c.routes);
    if (next !== before) update((d) => (d === before ? next : writeRoutes(d, date, p, c.routes)), `${c.title}を反映`);
    onApplied(c);
    if (next === before) {
      toast(`${c.title}は今の担当と同じです`);
      return;
    }
    toast(`${c.title}を反映しました`, { action: undoAction });
  };
}
