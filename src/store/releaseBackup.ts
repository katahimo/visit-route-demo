// 更新前の控え（PRD D483・D485・D488。ADR-0122）：まだ見ていない更新があって開いたとき、読んだ元の文字（migrate・repair の前）を
// 1世代の控え（vrdemo:data:prev。PRD D227）とは別のキーに残す。1世代の控えには触らない。
// 戻す・書き出す・作り直しの前の比べは、読み込み（importJson）と1世代の控えを使うので persist.ts に置く（ここは persist を import しない）
import { isQuota, KEEP_FAILED, KEEP_FULL, KEEP_NO_STORAGE } from './quota';
import { appLocalStorage } from './storageSpace';

/** 更新前の控え（開いたときに読んだ元の文字のまま） */
export const RELEASE_PREV_KEY = 'vrdemo:data:release-prev';
/** 更新前の控えの時刻と更新の id（`{ at, release }`） */
export const RELEASE_PREV_INFO_KEY = 'vrdemo:data:release-prev:info';

/** 更新前の控えを残した時刻（ms）と、その更新の id（lib/releaseNotes） */
export type ReleasePreviousInfo = { at: number; release: string };

/** 更新前の控えを残した結果：残せた（時刻と更新の id）か、残せなかった理由（データには触らない） */
export type ReleaseBackup = { kept: true; at: number; release: string } | { kept: false; why: string };

function parseInfo(raw: string | null): ReleasePreviousInfo | null {
  try {
    const x = JSON.parse(raw ?? 'null') as Partial<ReleasePreviousInfo> | null;
    if (!x || typeof x.at !== 'number' || !Number.isFinite(x.at) || typeof x.release !== 'string') return null;
    return { at: x.at, release: x.release };
  } catch {
    return null;
  }
}

/** 更新前の控えの文字。無ければ null */
export function releasePreviousText(): string | null {
  try {
    return appLocalStorage()?.getItem(RELEASE_PREV_KEY) ?? null;
  } catch {
    return null;
  }
}

/** 更新前の控えの時刻と更新の id。控えが無い・情報が読めなければ null */
export function releasePreviousInfo(): ReleasePreviousInfo | null {
  try {
    const ls = appLocalStorage();
    if (!ls || ls.getItem(RELEASE_PREV_KEY) === null) return null;
    return parseInfo(ls.getItem(RELEASE_PREV_INFO_KEY));
  } catch {
    return null;
  }
}

/** 更新前の控えの時刻と更新の id が同じか（画面の state を無駄に替えない） */
export const sameReleasePreviousInfo = (a: ReleasePreviousInfo | null, b: ReleasePreviousInfo | null): boolean =>
  a === b || (!!a && !!b && a.at === b.at && a.release === b.release);

/** 更新前の控えを消す（本体の保存の容量を空ける・書きかけを消す）。消すものがあったか */
export function dropReleasePrevious(ls: Storage): boolean {
  try {
    const had = ls.getItem(RELEASE_PREV_KEY) !== null || ls.getItem(RELEASE_PREV_INFO_KEY) !== null;
    ls.removeItem(RELEASE_PREV_KEY);
    ls.removeItem(RELEASE_PREV_INFO_KEY);
    return had;
  } catch {
    return false;
  }
}

/**
 * 開いたときに読んだ元の文字 text を、更新 release の前の控えとして残す（PRD D483）。
 * 同じ更新の控えがもうあれば（読み直し・2つ目のタブ）、残した時刻を変えずにそれを返す。
 * 書けなければ（容量超過）古い更新前の控えを捨てて1回だけ試し直し、それでも書けなければ古い控えを書き戻して理由を返す。
 * 今のデータ・1世代の控えには触らない（PRD D488）
 */
export function keepBeforeRelease(text: string, release: string, at: number = Date.now()): ReleaseBackup {
  const ls = appLocalStorage();
  if (!ls) return { kept: false, why: KEEP_NO_STORAGE };
  let oldText: string | null;
  let oldInfo: string | null;
  try {
    oldText = ls.getItem(RELEASE_PREV_KEY);
    oldInfo = ls.getItem(RELEASE_PREV_INFO_KEY);
  } catch {
    return { kept: false, why: KEEP_NO_STORAGE };
  }
  const cur = oldText === null ? null : parseInfo(oldInfo);
  if (cur?.release === release) return { kept: true, at: cur.at, release };
  const info = JSON.stringify({ at, release } satisfies ReleasePreviousInfo);
  const write = () => {
    ls.setItem(RELEASE_PREV_KEY, text);
    ls.setItem(RELEASE_PREV_INFO_KEY, info);
  };
  try {
    write();
    return { kept: true, at, release };
  } catch (e) {
    // 古い更新前の控えが場所を取っているので、捨ててもう1回だけ
    dropReleasePrevious(ls);
    try {
      write();
      return { kept: true, at, release };
    } catch (e2) {
      // 書きかけを消し、古い控えを書き戻す（入っていた場所なので戻せるはず。戻せなければ書きかけを残さない）
      dropReleasePrevious(ls);
      if (oldText !== null && oldInfo !== null) {
        try {
          ls.setItem(RELEASE_PREV_KEY, oldText);
          ls.setItem(RELEASE_PREV_INFO_KEY, oldInfo);
        } catch {
          dropReleasePrevious(ls);
        }
      }
      return { kept: false, why: isQuota(e) || isQuota(e2) ? KEEP_FULL : KEEP_FAILED };
    }
  }
}
