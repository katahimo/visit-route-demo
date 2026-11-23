// 更新前の控えに戻す・書き出す・作り直しの前に比べる（PRD D485。ADR-0122）。キーと残し方は releaseBackup.ts。
// 読み込み（importJson）と1世代の控え（restoreFrom）を使うので persist の外側に置く（persist はここを import しない）
import type { DemoData } from '../contracts/data';
import { importJson, isImportError, restoreFrom } from './persist';
import { releasePreviousText } from './releaseBackup';

/** 更新前の控えに戻すときに、いまのデータを1世代の控えに残す操作の名前 */
export const RELEASE_RESTORE_REASON = '更新前の控えに戻す';

/**
 * 更新前の控えに戻す（PRD D485）：控えの元の文字を今の読み込みと同じく migrate・repair に通し、いまのデータ now を1世代の控えに残してから返す。
 * 1世代の控えに残せなければ戻さない（swapPrevious と同じ）。更新前の控えは戻したあとも残す（もう一度戻せる。ADR-0122）
 */
export function restoreReleasePrevious(now: DemoData, at: number = Date.now()): { data: DemoData } | { error: string } {
  const text = releasePreviousText();
  return restoreFrom(text === null ? null : importJson(text), now, RELEASE_RESTORE_REASON, at);
}

/** 更新前の控えのファイル（読んだ元の文字のまま）。無ければ null */
export function exportReleasePrevious(): Blob | null {
  const text = releasePreviousText();
  return text === null ? null : new Blob([text], { type: 'application/json' });
}

/** 更新前の控えが data と同じデータを持っているか（更新の画面で作り直す前に、1世代の控えに残すかを決める。違えば残す） */
export function releaseBackupHolds(data: DemoData): boolean {
  const text = releasePreviousText();
  if (text === null) return false;
  const r = importJson(text);
  return !isImportError(r) && JSON.stringify(r) === JSON.stringify(data);
}
