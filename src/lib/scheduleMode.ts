// 予定を組む月の決まり（ADR-0063。予定のモードは廃止）：組む月（月の後半は来月）・担当なしの日の数・メニューの件数の印。
// データは書き換えない
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';
import { own } from './common';
import { activeDayVisits } from './dayPlan';
import { hasStandard } from './standard';
import { monthDates, ymOf } from './ym';

/** 来月（YYYY-MM） */
export const nextYm = (today: string): string => ymOf(addDays(`${ymOf(today)}-01`, 31));

/**
 * この日（日付の日）以降を月の後半とし、来月の準備を始める日にする（シフトの希望・利用者さんへの連絡は月の後半に始まり、月末7日では
 * 来月の担当を組むのが遅い。事業所ごとに変えない：契約に足すほどの差が無い。PRD D255 の日。段1でホームを無くして移した。ADR-0074）
 */
export const LATE_MONTH_FROM_DAY = 15;

/** 月の後半か */
export const isLateMonth = (today: string): boolean => Number(today.slice(8, 10)) >= LATE_MONTH_FROM_DAY;

/** 組む月：月の後半なら来月、前半なら今月（メニューの「◯月の予定」・「担当を組む」） */
export const planYm = (today: string): string => (isLateMonth(today) ? nextYm(today) : ymOf(today));

/**
 * その月の、担当なしの訪問がある日（今日以降・まだ伝えていない日）の数。ホームの「N月の担当を AI で組む」と同じ日の数え方
 * （担当が null の訪問。取り消し・〈利用者さん〉の休みの回は数えない）。compile しないので軽い
 */
export function unassignedDayCount(
  data: Pick<DemoData, 'visits' | 'patterns' | 'clients' | 'clientLeaves' | 'snapshots'>,
  ym: string,
  today: string,
): number {
  // 同じデータ・月・今日なら覚えた数（メニュー・既定のモードで何度も数えない。データは書き換えず新しい物になる）
  const key = `${ym}|${today}`;
  const memo = UNASSIGNED_MEMO.get(data);
  const hit = memo?.get(key);
  if (hit !== undefined) return hit;
  const n = countUnassigned(data, ym, today);
  if (memo) memo.set(key, n);
  else UNASSIGNED_MEMO.set(data, new Map([[key, n]]));
  return n;
}
const UNASSIGNED_MEMO = new WeakMap<object, Map<string, number>>();
function countUnassigned(
  data: Pick<DemoData, 'visits' | 'patterns' | 'clients' | 'clientLeaves' | 'snapshots'>,
  ym: string,
  today: string,
): number {
  let n = 0;
  for (const d of monthDates(ym)) {
    if (d < today || own(data.snapshots, d)) continue;
    if (activeDayVisits(data, d).some((v) => v.staffId === null)) n += 1;
  }
  return n;
}

/**
 * メニューの件数の印（PRD D349・D390）：組む月の担当なしの日の数（unassignedDayCount）と、組み方の標準があるか（PRD D360）。
 * compile しないので画面を移るたびに数えても軽い
 */
export function menuBadges(
  data: Pick<DemoData, 'visits' | 'patterns' | 'clients' | 'clientLeaves' | 'snapshots' | 'standard'>,
  today: string,
): { planUnassignedDays: number; hasStandard: boolean } {
  return {
    hasStandard: hasStandard(data),
    planUnassignedDays: unassignedDayCount(data, planYm(today), today),
  };
}
