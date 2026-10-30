// 「変更あり」の印（lib/visitLook の toldDate。expert 切。ADR-0073）を押したときの行き先：日の画面はその日の連絡の一覧を開き、
// 週・月の画面はその日の日の予定へ移って連絡の一覧を開いた状態にする（URL の `?do=told`。lib/links の toldHref）。
// 印は訪問の札（button・帯）の中にあるので、札のクリックの中で印を押したかを見分けて呼ぶ（札の選択・ドラッグは壊さない）
import { createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { toldHref } from '../lib/links';

/** 日の画面が差し込む「その日の連絡の一覧を開く」（無ければ日の予定へ移る） */
export const OpenToldContext = createContext<((date: string) => void) | null>(null);

/** 「変更あり」の印を押したときの動き（date は印の日付） */
export function useOpenTold(): (date: string) => void {
  const open = useContext(OpenToldContext);
  const navigate = useNavigate();
  return open ?? ((date) => navigate(toldHref(date)));
}

/** クリックの対象が「変更あり」の印の中なら、その日付（印は data-told-date を持つ）。そうでなければ null */
export function toldDateOf(target: unknown): string | null {
  const el = target as { closest?: (selector: string) => { getAttribute(name: string): string | null } | null } | null;
  if (!el || typeof el.closest !== 'function') return null;
  return el.closest('[data-told-date]')?.getAttribute('data-told-date') ?? null;
}
