// 組み方の標準の画面の「1. 案をくらべる」の状態：案のカード・いちばん点の高い案・表で見ている案
import { useId, useState } from 'react';
import type { DemoData } from '../contracts/data';
import { bestIndex, diffCounts, type StandardTable, tableDiff } from '../lib/standard';
import { runProposals, type StandardWork } from '../lib/standardDraft';

/** 案のカード（考え方ごと）の見た目のための値と操作 */
export function useStandardProposals(
  data: DemoData,
  today: string,
  current: StandardTable,
  key: string,
  work: StandardWork,
) {
  const [viewing, setViewing] = useState<string | null>(null);
  const viewId = useId();
  const run = () => {
    setViewing(null);
    void runProposals(data, today);
  };
  const cards = data.presets.map((preset) => {
    const prop = work.proposals.find((x) => x.presetId === preset.id);
    const diff = prop?.table ? diffCounts(tableDiff(prop.table, current)) : null;
    return { preset, prop, diff };
  });
  const best = bestIndex(cards.map((c) => c.prop?.stats ?? null));
  const proposalsStale = work.proposalsOf !== null && work.proposalsOf.key !== key;
  const viewed = cards.find((c) => c.preset.id === viewing && c.prop?.table);
  return { viewing, setViewing, viewId, run, cards, best, proposalsStale, viewed };
}

/** useStandardProposals の返り値（案の区画の部品が受け取る） */
export type StandardProposals = ReturnType<typeof useStandardProposals>;
