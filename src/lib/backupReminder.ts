// 控え（バックアップ）の書き出しの記録と知らせ（PRD D227。ADR-0032）：最後に書き出した日の文と、起動したときに知らせるかを決める純粋関数。
// 日付は日本時間の YYYY-MM-DD を引数で受ける（Date.now を読まない）。記録の読み書きは store の backupMemory
import type { DemoData } from '../contracts/data';
import { mdText } from './dateText';
import { daysBetween } from './ym';

/** この日数以上書き出していなければ知らせる */
export const BACKUP_REMIND_DAYS = 14;
/** 起動したときの知らせ（トースト） */
export const BACKUP_REMIND_TEXT = '控え（バックアップ）を2週間以上書き出していません。データの画面で書き出せます';
/** まだ書き出していないときの文 */
export const NEVER_EXPORTED_TEXT = 'まだ書き出していません';

/** 「10/12（7日前）」「10/19（今日）」。まだなら「まだ書き出していません」 */
export function exportAgoText(last: string | null, today: string): string {
  if (last === null) return NEVER_EXPORTED_TEXT;
  const n = daysBetween(last, today);
  return `${mdText(last)}（${n <= 0 ? '今日' : `${n}日前`}）`;
}

/**
 * 確定した日の数（伝えた内容に1件でも担当の決まった訪問がある日）。初期データが入れた過去の伝えた日（基準日より前。
 * seed の withPastTold）は数えない（初期データのまま開いただけで控えの知らせを出さない）
 */
export function confirmedDayCount(data: Pick<DemoData, 'snapshots' | 'baseDate'>): number {
  let n = 0;
  for (const s of Object.values(data.snapshots))
    if (s.date >= data.baseDate && s.visits.some((v) => v.staffId !== null)) n++;
  return n;
}

/**
 * 起動したときに控えの知らせを出すか：確定した日が1日以上あり、最後に書き出してから BACKUP_REMIND_DAYS 日以上
 * （まだ書き出していないときも）、かつ今日はまだ知らせていない（1日1回まで）
 */
export function shouldRemindBackup(x: {
  lastExport: string | null;
  lastReminded: string | null;
  today: string;
  confirmedDays: number;
}): boolean {
  if (x.confirmedDays < 1) return false;
  if (x.lastReminded !== null && x.lastReminded >= x.today) return false;
  if (x.lastExport === null) return true;
  return daysBetween(x.lastExport, x.today) >= BACKUP_REMIND_DAYS;
}

/** 時刻（ms）を日本時間の「10/19 14:03」に */
function jstStamp(at: number): string {
  const j = new Date(at + 9 * 3600 * 1000).toISOString();
  return `${mdText(j)} ${j.slice(11, 16)}`;
}

/** 「直前の状態に戻す」の欄の文：「10/19 14:03 の『初期状態に戻す』の前の状態に戻せます」 */
export const previousText = (p: { at: number; reason: string }): string =>
  `${jstStamp(p.at)} の『${p.reason}』の前の状態に戻せます`;

// ---- 更新前の控え（PRD D483〜D485。ADR-0122）----

/** 時刻（ms）を日本時間の「14時03分」に */
function jstClock(at: number): string {
  const j = new Date(at + 9 * 3600 * 1000).toISOString();
  return `${Number(j.slice(11, 13))}時${j.slice(14, 16)}分`;
}

/** 更新の id（'YYYY-MM-DD'・'YYYY-MM-DD-2'）を「11月21日」に */
const releaseDayText = (release: string): string => `${Number(release.slice(5, 7))}月${Number(release.slice(8, 10))}日`;

/** データの画面の更新前の控えの見出し：「更新前の控え（11月21日の更新の前・14時03分）」 */
export const releaseBackupTitle = (p: { at: number; release: string }): string =>
  `更新前の控え（${releaseDayText(p.release)}の更新の前・${jstClock(p.at)}）`;

/**
 * 更新前の控えに戻す確認の本文（PRD D485。ADR-0122）。いまのデータは直前の状態の控えに回り、今ある直前の状態の控え（previous）は置き換わる。
 * 更新前の控えは戻したあとも残る
 */
export const releaseRestoreBody = (
  p: { at: number; release: string },
  previous: { at: number; reason: string } | null,
): string =>
  `${releaseBackupTitle(p)}のデータに戻します。いまのデータは「直前の状態に戻す」の控えに回ります` +
  (previous ? `（今ある控え（${jstStamp(previous.at)} の『${previous.reason}』の前）は置き換わります）` : '') +
  '。この更新前の控えは戻したあとも残ります。';

/** 設定のひな形の手順の①：自動で残した更新前の控え */
export const releaseBackupKeptText = (at: number): string => `更新前の控えを自動で残しました（${jstClock(at)}）`;

/** 更新前の控えを残せなかったとき（容量など。データには触っていない） */
export const releaseBackupFailedText = (why: string): string =>
  `更新前の控えを自動で残せませんでした（${why.replace(/^控えを残せません：/, '')}）。データはそのままです`;
