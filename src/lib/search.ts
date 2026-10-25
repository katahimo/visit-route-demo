// 〈利用者さん〉の検索（PRD D61。design.md §4 pages「混み具合バーの3段・〈利用者さん〉の検索・週間の上限」）。
// 表示名・よみの部分一致。ひらがな・カタカナ・全角半角・大文字小文字・空白の違いを問わない
import type { Client } from '../contracts/documents';

/** カタカナ（ァ〜ヶ・ヽヾ）をひらがなに */
function kataToHira(text: string): string {
  return text.replace(/[ァ-ヶヽヾ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * 比べるための形にそろえる：NFKC（全角英数→半角、半角カナ→全角カナ、全角空白→半角）→ 小文字 → 空白を除く → カタカナをひらがなに。
 * 例：「ﾄｼｮｶﾝ　フミ」→「としょかんふみ」
 */
export function normalizeKana(text: string): string {
  // ハイフン・各種マイナス・ダッシュ（NFKC で残るもの）は長音「ー」にそろえる
  return kataToHira(
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[-‐‑‒–—―−－ｰ]/g, 'ー'),
  );
}

/** 近道のまとめて選ぶボタンの文。N は足す人数（すでに選んでいる人は数えない） */
export function chooseAllLabel(toAdd: number): string {
  return `あと${toAdd}人を選ぶ`;
}

/** 表示名かよみに query が含まれるか（query が空なら true） */
export function matchClient(client: Pick<Client, 'displayName' | 'kana'>, query: string): boolean {
  const q = normalizeKana(query);
  if (q === '') return true;
  return normalizeKana(client.displayName).includes(q) || normalizeKana(client.kana).includes(q);
}

/** 先頭から一致するか（候補の並びで前に出す） */
export function matchClientPrefix(client: Pick<Client, 'displayName' | 'kana'>, query: string): boolean {
  const q = normalizeKana(query);
  if (q === '') return false;
  return normalizeKana(client.displayName).startsWith(q) || normalizeKana(client.kana).startsWith(q);
}

/**
 * 候補を絞る：一致する人を、先頭から一致する人 → それ以外の順に（同じ組の中は渡した順のまま）。
 * limit を超えた分は数だけ返す
 */
export function searchClients<T extends Pick<Client, 'displayName' | 'kana'>>(
  clients: readonly T[],
  query: string,
  limit: number,
): { list: T[]; rest: number } {
  const hit = clients.filter((c) => matchClient(c, query));
  const head = hit.filter((c) => matchClientPrefix(c, query));
  const tail = hit.filter((c) => !matchClientPrefix(c, query));
  const all = [...head, ...tail];
  return { list: all.slice(0, limit), rest: Math.max(0, all.length - limit) };
}

/**
 * 近道「〈スタッフ〉が担当する人」の表（〈スタッフ〉の ID → 〈利用者さん〉の ID）。
 * pairs は案の担当（〈スタッフ〉の ID と、その人が担当する訪問の〈利用者さん〉の ID。未知の訪問は undefined で飛ばす）、
 * それに各〈利用者さん〉のいつもの担当（usual。lib/usualStaff の usualStaffMap）を足す
 */
export function staffClientMap(
  pairs: Iterable<readonly [string, string | undefined]>,
  clients: readonly Pick<Client, 'id'>[],
  usual: ReadonlyMap<string, string>,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (sid: string, cid: string | undefined) => {
    if (cid === undefined) return;
    const set = out.get(sid) ?? new Set<string>();
    set.add(cid);
    out.set(sid, set);
  };
  for (const [sid, cid] of pairs) add(sid, cid);
  for (const c of clients) {
    const sid = usual.get(c.id);
    if (sid) add(sid, c.id);
  }
  return out;
}

/**
 * 近道「〈スタッフ〉が担当する人」で最初に選んでおく〈スタッフ〉：担当する人（候補の中で数えた人数）が1人以上いる最初の人。
 * だれもいなければ先頭（〈スタッフ〉がいなければ ''）。
 * 名前の順の先頭の人が、案もいつもの担当も無い人だと、近道を開いたとたんに候補が0人になるため
 */
export function defaultStaffOf(staff: readonly { id: string }[], countOf: (staffId: string) => number): string {
  return (staff.find((s) => countOf(s.id) > 0) ?? staff[0])?.id ?? '';
}

/** ids のうち、候補（clients）にいる人の数 */
export function countAmong(ids: ReadonlySet<string>, clients: readonly { id: string }[]): number {
  return clients.reduce((n, c) => n + (ids.has(c.id) ? 1 : 0), 0);
}

/** 検索欄の近道（この期間に訪問がある人・〈スタッフ〉が担当する人・最近選んだ人・仮押さえの人） */
export type PickerShortcut = 'period' | 'staff' | 'recent' | 'tentative';

/**
 * 近道で絞った人（近道なしなら全員）。period は期間に訪問がある人の ID、staffSet は選んでいる〈スタッフ〉が担当する人の ID
 * （null なら0人）、recent は最近選んだ人の ID（新しい順）
 */
export function pickerBase<T extends { id: string; tentative?: boolean }>(
  shortcut: PickerShortcut | null,
  clients: readonly T[],
  src: {
    period?: ReadonlySet<string>;
    staffSet: ReadonlySet<string> | null;
    recent: readonly string[];
    byId: ReadonlyMap<string, T>;
  },
): readonly T[] {
  switch (shortcut) {
    case 'period':
      return src.period ? clients.filter((c) => src.period?.has(c.id)) : clients;
    case 'staff':
      return src.staffSet ? clients.filter((c) => src.staffSet?.has(c.id)) : [];
    case 'recent':
      return src.recent.flatMap((id) => src.byId.get(id) ?? []);
    case 'tentative':
      return clients.filter((c) => c.tentative);
    default:
      return clients;
  }
}

/** 候補が0人のときの文（近道で絞って0人なら、その理由）。staffName は近道で選んでいる〈スタッフ〉の名前、periodLabel は「この週」など */
export function pickerEmptyText(
  query: string,
  shortcut: PickerShortcut | null,
  hint: { staffName?: string; periodLabel?: string },
): string {
  if (query === '' && shortcut === 'recent') return 'まだ選んだ人がいません';
  if (query === '' && shortcut === 'staff' && hint.staffName !== undefined)
    return `${hint.staffName}さんが担当する人はいません`;
  if (query === '' && shortcut === 'period' && hint.periodLabel !== undefined)
    return `${hint.periodLabel}に訪問がある人はいません`;
  return '見つかりません';
}

/** 「最近選んだ人」に ids（先頭が最新）を足す。重複は新しい方に寄せ、上限 limit 人まで */
export function pushRecent(recent: readonly string[], ids: readonly string[], limit: number): string[] {
  return [...ids, ...recent.filter((x) => !ids.includes(x))].slice(0, limit);
}

/** 検索欄でキーを押したときにすること（prevent は既定の動きを止めるか） */
export type PickerKeyAction =
  | { type: 'none' }
  | { type: 'open'; prevent: boolean }
  | { type: 'move'; step: 1 | -1; prevent: boolean }
  | { type: 'choose'; prevent: boolean }
  | { type: 'close'; prevent: boolean }
  | { type: 'clearQuery'; prevent: boolean }
  | { type: 'unselectLast'; prevent: boolean };

/**
 * 検索欄のキーの働き。日本語入力の変換中は何もしない（Enter・↑↓を変換の操作に譲る）。
 * ↓↑：閉じていれば開く／候補が無ければ何もしない／あれば移る。Enter：開いていて指している候補があれば選ぶ。
 * Esc：開いていれば閉じる、閉じていて文字があれば消す。文字が空で Backspace：複数で選んでいる人がいれば最後の人を外す
 */
export function pickerKeyAction(
  key: { key: string; composing: boolean },
  state: {
    open: boolean;
    optionCount: number;
    hasActive: boolean;
    hasQuery: boolean;
    multiple: boolean;
    hasSelected: boolean;
  },
): PickerKeyAction {
  if (key.composing) return { type: 'none' };
  if (key.key === 'ArrowDown' || key.key === 'ArrowUp') {
    if (!state.open) return { type: 'open', prevent: true };
    if (state.optionCount === 0) return { type: 'none' };
    return { type: 'move', step: key.key === 'ArrowDown' ? 1 : -1, prevent: true };
  }
  if (key.key === 'Enter') return state.open && state.hasActive ? { type: 'choose', prevent: true } : { type: 'none' };
  if (key.key === 'Escape') {
    if (state.open) return { type: 'close', prevent: true };
    return state.hasQuery ? { type: 'clearQuery', prevent: true } : { type: 'none' };
  }
  if (key.key === 'Backspace' && !state.hasQuery && state.multiple && state.hasSelected)
    return { type: 'unselectLast', prevent: false };
  return { type: 'none' };
}
