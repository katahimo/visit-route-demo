// 行き止まりの所から次の画面へ移る行き先（PRD D201〜D204。ADR-0025）を決める純粋関数。
// 行き先は今ある URL の形だけ（日の画面・`?do=absence`・稼働の見込みの `?ym=`・`?staff=`）と、日の画面の
// 「入らなかった訪問」へ巻く `?do=unassigned`（日の画面が1回で URL から消す）。データは書き換えない。
// 機能の入り切り（PRD D213。ADR-0028）：切った機能（欠勤・キャンセル・稼働の見込み）の行き先は出さない
import type { Features } from '../contracts/features';
import { isHrefOn } from './features';
import { isDate } from './isDate';
import type { Attention } from './month';
import { SUDDEN_DO } from './sudden';
import { ymOf } from './ym';

/** 日の画面の「入らなかった訪問」の列へ巻く `?do=` の値（PRD D201） */
export const UNASSIGNED_DO = 'unassigned';

/**
 * 日の画面で「欠勤・キャンセル」の欄を開く URL（PRD D172・D201・D203）。
 * staffId を渡すと、その人を選んで開く（列の見出しの「欠勤を直す」と同じ）
 */
export function suddenHref(date: string, staffId?: string): string {
  const q = new URLSearchParams({ date, do: SUDDEN_DO });
  if (staffId) q.set('staff', staffId);
  return `/plan?${q.toString()}`;
}

/** その日の日の画面を開く URL（PRD D204。日の画面が ?date= を読んで消す。新しいタブでも開ける） */
export const dayHref = (date: string): string => `/plan?date=${date}`;

/** 日の画面で連絡の一覧（未連絡の変更）を開く `?do=` の値（expert 切の「変更あり」の印から。ADR-0073。PRD D382） */
export const TOLD_DO = 'told';

/** その日の日の画面で、連絡の一覧（未連絡の変更）を開いた状態にする URL（週・月の「変更あり」の印の行き先。日の画面が1回で URL から消す） */
export const toldHref = (date: string): string => `/plan?date=${date}&do=${TOLD_DO}`;

/**
 * 〈スタッフ〉のスマホ画面（PRD D16・D417）の URL。date を渡すとその日で開く（画面が ?date= を読んで消す。〈スタッフ〉の一覧の「今日の画面」）
 */
export const staffViewHref = (staffId: string, date?: string): string =>
  `/staff-view/${encodeURIComponent(staffId)}${date ? `?date=${date}` : ''}`;

/**
 * 日の画面の URL の入口 `?do=told`：受けたら移る先の日（?date= が正しければその日、無ければ今の日）。`?do=told` でなければ null。
 * 受けたら画面は ?do=・?date= を URL から消す（useToldEntry）
 */
export function toldEntryDate(doParam: string | null, dateParam: string | null, current: string): string | null {
  if (doParam !== TOLD_DO) return null;
  return dateParam && isDate(dateParam) ? dateParam : current;
}

/** 受けた日（pending）が今の日になったとき、連絡の一覧を開くか：未連絡の変更がある日だけ（変更の無い日は開かない） */
export const shouldOpenTold = (pending: string | null, date: string, canOpen: boolean): boolean =>
  pending !== null && pending === date && canOpen;

/** 日の画面で「入らなかった訪問」の列へ巻いて開く URL（PRD D201） */
export const unassignedHref = (date: string): string => `/plan?date=${date}&do=${UNASSIGNED_DO}`;

/** 稼働の見込みをその月・その人で開く URL（PRD D201。staffId が無ければ月だけ） */
export function workloadHref(ym: string, staffId?: string): string {
  const q = new URLSearchParams({ ym });
  if (staffId) q.set('staff', staffId);
  return `/workload?${q.toString()}`;
}

/**
 * 切った機能の行き先なら null（呼ぶ側はリンク・ボタンを出さない。PRD D213）。土台の行き先（日の画面・入らなかった訪問）はそのまま。
 * 例：`linkIfOn(features, suddenHref(date, staffId))`・`linkIfOn(features, workloadHref(ym, staffId))`
 */
export const linkIfOn = (features: Features, to: string): string | null => (isHrefOn(features, to) ? to : null);

/** 移る先：to は URL（クエリ付き）、date は移る前に選んでいる日付にする日、note は行き先を添える文（「（〜で開く）」） */
export type LinkTarget = { to: string; date: string; note: string };

/**
 * 月の画面の要対応の1行の行き先（PRD D201）：
 * - 入らない訪問 → 日の画面の「入らなかった訪問」の列
 * - 拘束が上限を超える → 稼働の見込み（その月・先頭の人）
 * - そのほか（担当なしの無い要対応・未連絡の変更）→ その日の日の画面
 *
 * 行き先の機能（欠勤・キャンセル・稼働の見込み）を features で切っていれば、その日の日の画面（土台）にする
 * （要対応の行は日付を持つので、行き先を消さずに日の画面へ。PRD D213）
 */
export function attentionTarget(a: Attention, features: Features): LinkTarget {
  const t = attentionTargetAll(a);
  return isHrefOn(features, t.to) ? t : dayTarget(a.date);
}

/** その日の日の画面へ移る行き先 */
const dayTarget = (date: string): LinkTarget => ({ to: '/plan', date, note: '（日の予定で開く）' });

/** すべて入のときの行き先 */
function attentionTargetAll(a: Attention): LinkTarget {
  switch (a.kind) {
    case 'care':
      return a.names.some((x) => x.startsWith('担当なし'))
        ? { to: unassignedHref(a.date), date: a.date, note: '（日の予定の「担当なしの訪問」で開く）' }
        : dayTarget(a.date);
    case 'overSpan':
      return { to: workloadHref(ymOf(a.date), a.staffIds?.[0]), date: a.date, note: '（勤務の見込みで開く）' };
    default:
      return dayTarget(a.date);
  }
}
