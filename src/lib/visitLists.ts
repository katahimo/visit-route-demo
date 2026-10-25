// 訪問の一覧（欄を開く入口。PRD D304・D309）：担当なしの訪問・その日の訪問の行・〈利用者さん〉と〈スタッフ〉の期間の訪問。
// どれも純粋関数で、DemoData を書き換えない
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { isOnLeave } from '../domain/leaves';
import { addDays } from '../domain/time';
import { visitsIn, visitsOn } from '../patterns';
import { dayProblemOf, routesOf, unassignedOf } from './dayPlan';

// ---- 一覧（欄を開く入口） ----

/** 担当なしの訪問（今日〜until。日付・開始の順）。ホームの要対応から欄を開く（PRD D304） */
export function unassignedVisits(d: DemoData, today: string, until: string): Visit[] {
  const out: Visit[] = [];
  for (let date = today; date <= until; date = addDays(date, 1)) {
    const p = dayProblemOf(d, date);
    if (!p || p.visits.length === 0) continue;
    const visits = visitsOn(d, date);
    const ids = new Set(unassignedOf(p, routesOf(p, visits)));
    for (const v of visits) if (ids.has(v.id)) out.push(v);
  }
  return out;
}

/** 一覧の1行（担当と印） */
export type VisitRow = {
  visit: Visit;
  staffId: string | null;
  /** unassigned＝担当なし */
  mark: 'unassigned' | null;
};

/**
 * その日の訪問の行（ホームの今日の訪問。PRD D304）：取り消し・休みを除き、担当なし → これからの近い順 → 済んだ時刻の順。
 * limit 件まで、残りは rest に数だけ
 */
export function dayVisitRows(
  d: Pick<DemoData, 'visits' | 'patterns' | 'clients' | 'clientLeaves'>,
  date: string,
  nowHm: string,
  limit = 5,
): { rows: VisitRow[]; rest: number } {
  const rows = visitsOn(d, date)
    .filter((v) => !v.cancelled && !isOnLeave(d.clientLeaves, v))
    .map((v): VisitRow => ({ visit: v, staffId: v.staffId, mark: v.staffId === null ? 'unassigned' : null }));
  const rank = (r: VisitRow) => (r.mark === 'unassigned' ? 0 : 1);
  const at = (v: Visit) => v.start ?? v.earliestStart;
  rows.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(at(a.visit) < nowHm) - Number(at(b.visit) < nowHm) ||
      (at(a.visit) < at(b.visit) ? -1 : at(a.visit) > at(b.visit) ? 1 : 0),
  );
  return { rows: rows.slice(0, limit), rest: Math.max(0, rows.length - limit) };
}

/** 〈利用者さん〉の、その期間の訪問（取り消しも。日付・開始の順）。〈利用者さん〉の画面の予定（PRD D304） */
export function clientVisitsIn(
  d: Pick<DemoData, 'visits' | 'patterns' | 'clients'>,
  clientId: string,
  from: string,
  to: string,
): Visit[] {
  return visitsIn(d, { from, to }).filter((v) => v.clientId === clientId);
}

/**
 * 〈スタッフ〉が担当している、その期間の訪問（訪問の担当がその人。取り消しを除く。日付・開始の順）。
 * 〈スタッフ〉の画面の予定のカレンダー（PRD D309）
 */
export function staffVisitsIn(
  d: Pick<DemoData, 'visits' | 'patterns' | 'clients'>,
  staffId: string,
  from: string,
  to: string,
): Visit[] {
  return visitsIn(d, { from, to }).filter((v) => v.staffId === staffId && !v.cancelled);
}
