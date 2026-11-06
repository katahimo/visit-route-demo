// 上の帯の「戻る」「進む」（PRD D438。ADR-0103）の純粋な部分：進める先の番号の決め方と、タブの間の覚え方。
// 戻れるかは react-router が履歴に入れる番号（history.state.idx）が 0 より大きいか。進めるかは、このタブで開いた中で
// いちばん先の番号（maxIdx）が今の番号より大きいか。maxIdx は読み直しても残るよう sessionStorage に置く（タブを閉じれば消える）

/** sessionStorage のキー（このタブで開いた中でいちばん先の履歴の番号） */
export const HISTORY_MAX_KEY = 'vrdemo:history:max';

/** 画面の移り方（react-router の NavigationType と同じ文字） */
export type NavKind = 'PUSH' | 'REPLACE' | 'POP';

/** 移ったあとの、いちばん先の番号。新しく開いた（PUSH）ら先の履歴は消えるので今の番号。置き換え・戻る・進むは下げない */
export function nextMaxIdx(prevMax: number, now: number, kind: NavKind): number {
  return kind === 'PUSH' ? now : Math.max(prevMax, now);
}

/**
 * 開いたときのいちばん先の番号。restored は、起動したときの履歴の項目に react-router の番号が残っていたか
 * （読み直し・履歴での行き来）。残っていれば覚えた番号を使う。新しく開いた（アドレス欄・リンクから）なら
 * react-router が番号を 0 から振り直すので、覚えた番号は使わない
 */
export function initialMaxIdx(stored: number, now: number, restored: boolean): number {
  return restored ? Math.max(stored, now) : now;
}

/** 履歴の項目に react-router の番号があるか */
export function hasHistoryIdx(state: unknown): boolean {
  return typeof (state as { idx?: unknown } | null)?.idx === 'number';
}

/** react-router が履歴に入れる番号（無ければ 0） */
export function historyIdxOf(state: unknown): number {
  const idx = (state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 ? idx : 0;
}

type SessionLike = Pick<Storage, 'getItem' | 'setItem'>;
const session = (): SessionLike | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
};

/** 覚えたいちばん先の番号（無い・読めなければ 0） */
export function loadHistoryMax(store: SessionLike | null = session()): number {
  try {
    const n = Number(store?.getItem(HISTORY_MAX_KEY));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** いちばん先の番号を覚える（書けなければ何もしない） */
export function saveHistoryMax(n: number, store: SessionLike | null = session()): void {
  try {
    store?.setItem(HISTORY_MAX_KEY, String(n));
  } catch {
    // 書けない（プライベートモードの上限など）ときは覚えない
  }
}
