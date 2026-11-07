// 住所から位置を探す順（PRD D445。ADR-0110）：組む範囲（今日〜翌月末）に予定のある〈利用者さん〉を先に（近い日から）、予定の無い人をあとに探す。
// 予定のある人と〈スタッフ〉の自宅を探し終えたら、その時点で担当を組める（残りの人は組みに効かない）。純粋関数
import type { DemoData } from '../contracts/data';
import { autoRange } from './autoArrange';
import { ownerId, type PlaceKind, type PlacePerson, placeAllTargets } from './placeAll';

type PlanData = Pick<DemoData, 'visits' | 'patterns'>;

/** 組む範囲に予定のある〈利用者さん〉と、その最初の日（単発・保存した回は日付、繰り返しは範囲と重なる最初の日） */
export function firstVisitDays(d: PlanData, today: string): Map<string, string> {
  const { from, to } = autoRange(today);
  const out = new Map<string, string>();
  const put = (clientId: string, date: string) => {
    const cur = out.get(clientId);
    if (cur === undefined || date < cur) out.set(clientId, date);
  };
  for (const v of d.visits) if (!v.cancelled && v.date >= from && v.date <= to) put(v.clientId, v.date);
  for (const p of d.patterns) {
    if (p.from > to || (p.to !== null && p.to < from)) continue;
    put(p.clientId, p.from > from ? p.from : from);
  }
  return out;
}

/** 探す順：〈利用者さん〉は予定のある人を最初の日の早い順に先へ（同じ日・予定の無い人は元の順）。〈スタッフ〉は元の順 */
export function placeOrder(d: PlanData, kind: PlaceKind, people: readonly PlacePerson[], today: string): PlacePerson[] {
  if (kind === 'staff') return [...people];
  const first = firstVisitDays(d, today);
  const key = (p: PlacePerson) => first.get(ownerId(p.id)) ?? '~';
  return people
    .map((p, i) => ({ p, i, k: key(p) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i))
    .map((x) => x.p);
}

/** 組みに効く人か（〈スタッフ〉は全員・〈利用者さん〉は組む範囲に予定のある人） */
export function mattersForArrange(d: PlanData, kind: PlaceKind, personId: string, today: string): boolean {
  return kind === 'staff' || firstVisitDays(d, today).has(ownerId(personId));
}

/**
 * 組める段階か：まだ探していない（tried に無い）位置の無い人のうち、組みに効く人がいない。
 * tried は探した人（見つからなかった人も。`${kind}:${id}`）
 */
export function arrangeReady(
  d: PlanData & Pick<DemoData, 'clients' | 'staff'>,
  today: string,
  tried: ReadonlySet<string>,
): boolean {
  if (placeAllTargets(d, 'staff').targets.some((p) => !tried.has(`staff:${p.id}`))) return false;
  const first = firstVisitDays(d, today);
  return !placeAllTargets(d, 'client').targets.some((p) => !tried.has(`client:${p.id}`) && first.has(ownerId(p.id)));
}
