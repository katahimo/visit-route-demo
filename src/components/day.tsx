// 画面で選んでいる日付の文脈。app/App.tsx が DayProvider で渡し、画面（pages）と部品（components）が useDay で読む
import { createContext, useContext } from 'react';

/** 画面で選んでいる日付（データの中の日付から選ぶ。すべての画面で共通） */
export type DayCtx = { date: string; setDate: (d: string) => void; dates: string[] };
const Ctx = createContext<DayCtx | null>(null);
export const DayProvider = Ctx.Provider;
export function useDay(): DayCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('DayProvider がありません');
  return v;
}
