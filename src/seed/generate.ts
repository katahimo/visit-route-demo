// 写した元：katahimo-dev/visit-route-poc @ a46e7db scripts/seedDemo.ts（visitsOf・overridesOf・manualRoutesOf。visitsOf は generate.testkit.ts）
// Firebase に依存しない生成ロジック。同じ日付なら毎回同じ結果（乱数・現在時刻を使わない）。
import type { Availability, Client, Staff, Visit } from '../contracts/documents';
import type { Compat, Condition, Traits } from '../contracts/rules';
import { availabilityOf, type Slot, withinSlots } from '../domain/availability';
import { addDays, hhmmToMinutes, weekday } from '../domain/time';
import { matches } from '../matching/conditions';
import { INITIAL_ITEMS } from './people';

/** 日ごとの変化の番号の 0 日目 */
const DAY_ZERO = '2026-01-01';
/** 日ごとの変化の番号。日付だけで決まる */
export const dayNumber = (date: string) => Math.round((Date.parse(date) - Date.parse(DAY_ZERO)) / 86400000);

/**
 * CLIENT_SEEDS の i 番目の利用者さんが平日に休む曜日（0=日〜6=土）。
 * generate.testkit.ts の visitsOf の「(i + 日の番号) % 7 が 0 の日は休み」を曜日に直したもの（土日になる人は平日に休みが無い）
 */
export function restWeekdayOf(i: number): number {
  return weekday(addDays(DAY_ZERO, (7 - (i % 7)) % 7));
}

/** 手作業の割り当てで見込む移動時間（分）。実際より短く見積もりがち */
const MANUAL_TRAVEL_MIN = 30;

export const UNASSIGNED_KEY = '__none';

const itemById = new Map(INITIAL_ITEMS.map((it) => [it.id, it]));
/** 日付 date に条件を満たすか（seed の項目は INITIAL_ITEMS） */
const satisfies = (c: Condition, traits: Traits, date: string) =>
  matches(c, itemById.get(c.itemId), traits[c.itemId], date);

/**
 * 日ごとの稼働時間帯の上書き（同じ日なら毎回同じ）。
 * s1は5日に1回の時間休、s2は7日に1回の休み、s4は隔週の土曜に休日出勤、s7は4日に1回の遅出
 */
function overridesOf(date: string, n: number, staff: Staff[]): Record<string, Slot[]> {
  const dow = weekday(date);
  const weekdayOn = (id: string) => staff.find((s) => s.id === id)?.workDays.includes(dow) ?? false;
  const out: Record<string, Slot[]> = {};
  if (weekdayOn('s1') && n % 5 === 0)
    out.s1 = [
      { start: '08:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ];
  if (weekdayOn('s2') && n % 7 === 2) out.s2 = [];
  if (dow === 6 && n % 14 < 7) out.s4 = [{ start: '09:00', end: '15:00' }];
  if (weekdayOn('s7') && n % 4 === 1) out.s7 = [{ start: '11:00', end: '16:30' }];
  return out;
}

/**
 * 手作業らしい割り当て：時刻の早い訪問から、担当の慣れ（場所によらない順番）で空いている人に入れる。
 * 必要条件・NG（相性×）・勤務時間は守るが、近さは見ないので遠回りになる
 */
function manualRoutesOf(
  date: string,
  n: number,
  visits: Visit[],
  staff: Staff[],
  clients: Map<string, Client>,
  compat: Compat,
  slotsOf: Map<string, Slot[]>,
): Record<string, string[]> {
  const working = staff.filter((s) => (slotsOf.get(s.id)?.length ?? 0) > 0);
  const freeAt = new Map(working.map((s) => [s.id, hhmmToMinutes(slotsOf.get(s.id)?.[0]?.start ?? '00:00')]));
  const routes: Record<string, string[]> = {};
  for (const [k, v] of visits.entries()) {
    const c = clients.get(v.clientId);
    let placed = false;
    for (let j = 0; j < working.length; j++) {
      const s = working[(k * 3 + n + j) % working.length] as Staff;
      const slots = slotsOf.get(s.id) ?? [];
      if (c?.requirements.some((r) => !satisfies(r, s.traits, date))) continue;
      if ((compat[v.clientId]?.[s.id] ?? 0) === -2) continue;
      const free = freeAt.get(s.id) ?? 0;
      const start = Math.max(
        hhmmToMinutes(v.earliestStart),
        free + ((routes[s.id]?.length ?? 0) > 0 ? MANUAL_TRAVEL_MIN : 0),
      );
      if (start > hhmmToMinutes(v.latestStart) || !withinSlots(slots, start, start + v.durationMinutes)) continue;
      freeAt.set(s.id, start + v.durationMinutes);
      routes[s.id] = [...(routes[s.id] ?? []), v.id];
      placed = true;
      break;
    }
    if (!placed) routes[UNASSIGNED_KEY] = [...(routes[UNASSIGNED_KEY] ?? []), v.id];
  }
  return routes;
}

export type DayData = { visits: Visit[]; availability: Availability[]; manualRoutes: Record<string, string[]> };

/**
 * 1日分（稼働時間帯の上書き・手作業案）。visits はその日の訪問（パターンから展開したもの）。
 * 返す訪問の staffId は手作業案の担当に合わせる
 */
export function generateDay(date: string, visits: Visit[], staff: Staff[], clients: Client[], compat: Compat): DayData {
  const n = dayNumber(date);
  const active = staff.filter((s) => s.active);
  const clientMap = new Map(clients.filter((c) => c.active).map((c) => [c.id, c]));
  const overrides = overridesOf(date, n, active);
  const slotsOf = new Map(
    active.map((s) => [
      s.id,
      availabilityOf(s, date, overrides[s.id] ? { slots: overrides[s.id] as Slot[] } : null).slots,
    ]),
  );
  const manualRoutes = manualRoutesOf(date, n, visits, active, clientMap, compat, slotsOf);
  const owner = new Map(
    Object.entries(manualRoutes).flatMap(([sid, ids]) =>
      sid === UNASSIGNED_KEY ? [] : ids.map((id) => [id, sid] as const),
    ),
  );
  return {
    visits: visits.map((v) => ({ ...v, staffId: owner.get(v.id) ?? null })),
    availability: Object.entries(overrides).map(([staffId, slots]) => ({ staffId, date, slots })),
    manualRoutes,
  };
}

/** from から n 日分の日付 */
export function datesFrom(from: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}
