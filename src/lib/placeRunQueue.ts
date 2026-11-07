/**
 * まとめて置く処理の順番（PRD D427。ADR-0016・ADR-0094）。外部の検索は同時に1本にする。
 * - 鍵（PlaceLock）：外部の検索を同時に1本にする。1人探すごとに取り直し、〈スタッフ〉を〈利用者さん〉より先に探す（PRD D445）
 * - 予約（PlaceRunGate）：走っている最中にもう一度頼まれたら（名簿を読み込んだ）、終わったあと残りを続けて探す予約を持つ
 */

/**
 * 外部の検索を同時に1本にする鍵（ADR-0016）。待っている人が複数いれば、priority の小さい方（同じなら先に待った方）へ渡す
 * （〈スタッフ〉を〈利用者さん〉より先に探す。PRD D445）。1人探すごとに取り直すので、あとから来た優先の高い方が間に入れる
 */
export type PlaceLock = {
  /** 鍵を取る（取れたら外す手を返す）。待っている間に signal で止めたら null。onWait は待ち始めたとき・取れたときに呼ぶ */
  acquire: (
    priority: number,
    signal?: AbortSignal,
    onWait?: (waiting: boolean) => void,
  ) => Promise<(() => void) | null>;
};

export function createPlaceLock(): PlaceLock {
  let held = false;
  let seq = 0;
  const waiters: { priority: number; seq: number; give: () => void }[] = [];
  const release = () => {
    waiters.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    const next = waiters.shift();
    if (next) next.give();
    else held = false;
  };
  return {
    acquire: (priority, signal, onWait) => {
      if (signal?.aborted) return Promise.resolve(null);
      if (!held) {
        held = true;
        return Promise.resolve(once(release));
      }
      onWait?.(true);
      return new Promise((resolve) => {
        const w = {
          priority,
          seq: seq++,
          give: () => {
            signal?.removeEventListener('abort', quit);
            onWait?.(false);
            resolve(once(release));
          },
        };
        const quit = () => {
          const i = waiters.indexOf(w);
          if (i >= 0) waiters.splice(i, 1);
          onWait?.(false);
          resolve(null);
        };
        waiters.push(w);
        signal?.addEventListener('abort', quit);
      });
    },
  };
}

/** 1回だけ呼べる手（外す手を二度呼んでも、ほかの人の鍵を外さない） */
function once(fn: () => void): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
}

/** 1つの種類の置く処理の、走っているか・続けて探す予約 */
export type PlaceRunGate = {
  /** 始めてよいか。走っている最中なら続けて探す予約を持って false */
  request: () => boolean;
  /** 1回分が終わった。予約があり止めていなければ true（続けて探す。走っているまま）。それ以外は空けて false */
  finish: (stopped: boolean) => boolean;
};

export function createPlaceRunGate(): PlaceRunGate {
  let busy = false;
  let again = false;
  return {
    request: () => {
      if (busy) {
        again = true;
        return false;
      }
      busy = true;
      return true;
    },
    finish: (stopped) => {
      const go = again && !stopped;
      again = false;
      busy = go;
      return go;
    },
  };
}
