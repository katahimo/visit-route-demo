/**
 * まとめて置く処理の順番（PRD D427。ADR-0016・ADR-0094）。外部の検索は同時に1本にする。
 * - 列（PlaceLane）：〈利用者さん〉と〈スタッフ〉の置く処理を1本の列に並べる。前の仕事が終わってから次を始める
 * - 予約（PlaceRunGate）：走っている最中にもう一度頼まれたら（名簿を読み込んだ）、終わったあと残りを続けて探す予約を持つ
 */

/** 外部の検索を同時に1本にする列 */
export type PlaceLane = {
  /**
   * 前の仕事が終わってから job を始める。待っている間に signal で止めたら job を呼ばずに null を返す
   * （次の仕事は前の仕事が終わるまで待つ）
   */
  run: <T>(job: () => Promise<T>, signal?: AbortSignal) => Promise<T | null>;
  /** 走っている・待っている仕事があるか */
  busy: () => boolean;
};

/** 止めたら（または turn が終わったら）戻る */
function untilTurnOrAbort(turn: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return turn;
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      signal.removeEventListener('abort', done);
      resolve();
    };
    signal.addEventListener('abort', done);
    void turn.then(done);
  });
}

export function createPlaceLane(): PlaceLane {
  let tail: Promise<void> = Promise.resolve();
  let count = 0;
  const noop = () => undefined;
  return {
    run: <T>(job: () => Promise<T>, signal?: AbortSignal): Promise<T | null> => {
      const turn = tail;
      count += 1;
      const p = (async () => {
        try {
          await untilTurnOrAbort(turn, signal);
          if (signal?.aborted) return null;
          return await job();
        } finally {
          count -= 1;
        }
      })();
      // 待つのをやめた仕事の後ろは、その前の仕事が終わるまで待つ
      tail = p.then(() => turn).then(noop, noop);
      return p;
    },
    busy: () => count > 0,
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
