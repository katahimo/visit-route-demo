// 週間（ADR-0012の段階2。PRD D49〜D51。design.md §4 pages「週間（段階2）」）の画面の純粋関数。
// 表・帯の形を作る計算だけ（データを書く操作 moveFollowing・insertIntoPlan は lib/weekOps）。今日・時刻は引数で受け取る
import type { Client, Pattern, Staff, Visit } from '../contracts/documents';
import type { Problem, StopTiming } from '../contracts/problem';
import type { Routes } from '../contracts/reassign';
import type { Item } from '../contracts/rules';
import { availabilityOf, withoutAbsences } from '../domain/availability';
import { isOnLeave } from '../domain/leaves';
import { addDays, hhmmToMinutes, minutesToHhmm, weekday } from '../domain/time';
import { ALLOWED_STAFF_RULE_ID, type CompileInput, compile, scheduleRoute, VISIT_TYPE_RULE_ID } from '../matching';
import { findVisit, putVisits, visitsOn } from '../patterns';
import { fitsOf } from '../reassign';
import { attempt, byDisplayName, byName, own } from './common';
import { dayProblemOf, dayRoutes, pinsOf, routesOf } from './dayPlan';
import { DAY_END, DAY_START, spansOf } from './spans';
import { busyParts, type StaffSlot, staffSlots } from './staffBar';

/** ドラッグの丸めの刻み（分） */
export const SNAP_MINUTES = 15;

// ---- 週 ----

/** その日を含む週の月曜（月曜はじまり） */
export function weekStart(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

/** その日を含む週の日付（月〜日の7日） */
export function weekDates(date: string): string[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 15分刻みに丸める（近いほうへ） */
export const snapMinutes = (m: number, step = SNAP_MINUTES): number => Math.round(m / step) * step;

/** 開始 start（分）・所要 duration の訪問が時間軸の範囲（07:00〜20:00）に収まるか */
export const inDayRange = (start: number, duration: number): boolean =>
  start >= DAY_START && start + duration <= DAY_END;

// ---- その日の担当と帯 ----

/** 帯の元：担当のある訪問（plan）／担当なし・休み（visit）。版2は伝えたかどうかで帯を分けない */
export type BandSource = 'plan' | 'visit';

/** 時間軸の帯1つ（時刻は0時からの分。lenient） */
export type Band = {
  visitId: string;
  date: string;
  /** 担当（null＝担当なし） */
  staffId: string | null;
  start: number;
  end: number;
  source: BandSource;
  /** 〈利用者さん〉の休み（ADR-0013）のため無し（計算に入らない。薄く出し、動かさない） */
  leave?: boolean;
};

/** その日の担当の並びと帯 */
export type WeekDay = {
  date: string;
  /** いまのデータ・いまの条件の問題（作れなければ null） */
  problem: Problem | null;
  /** 担当 → 訪問ID の列（問題にある訪問だけ） */
  routes: Routes;
  /** 取り消しでない訪問の帯（開始の順）。休みの訪問は leave 付きで、訪問の開始（早）に置く */
  bands: Band[];
  /** その日の訪問（計算した繰り返しの回も。取り消しも含む） */
  visits: Visit[];
};

type DayInput = CompileInput;

/**
 * その日の帯と担当の並び。problem を渡すとそれを使う（無ければ compile。作れなければ null で、帯は訪問の開始（早）に置く）。
 * 帯は担当の列の lenient の開始〜終了。担当なし・問題に無い訪問は staffId＝null で、訪問の開始（早）〜＋所要に置く
 */
export function weekDay(data: DayInput, date: string, problem?: Problem | null): WeekDay {
  const p = problem !== undefined ? problem : dayProblemOf(data, date);
  const routes = p ? dayRoutes(data, date, p) : {};
  const placed = new Map<string, { staffId: string; start: number; end: number }>();
  if (p) {
    const vIndex = new Map(p.visits.map((v, i) => [v.id, i]));
    p.staff.forEach((st, s) => {
      const list = (own(routes, st.id) ?? []).map((id) => vIndex.get(id)!).filter((x) => x !== undefined);
      if (list.length === 0) return;
      const t = scheduleRoute(p, s, list, 'lenient');
      for (const stop of t?.stops ?? []) placed.set(stop.visitId, { staffId: st.id, start: stop.start, end: stop.end });
    });
  }
  const visits = visitsOn(data, date);
  const bands: Band[] = visits
    .filter((v) => !v.cancelled)
    .map((v): Band => {
      if (isOnLeave(data.clientLeaves, v)) {
        const start = hhmmToMinutes(v.earliestStart);
        return {
          visitId: v.id,
          date,
          staffId: null,
          start,
          end: start + v.durationMinutes,
          source: 'visit',
          leave: true,
        };
      }
      const at = placed.get(v.id);
      if (at) return { visitId: v.id, date, staffId: at.staffId, start: at.start, end: at.end, source: 'plan' };
      const start = hhmmToMinutes(v.earliestStart);
      return { visitId: v.id, date, staffId: null, start, end: start + v.durationMinutes, source: 'visit' };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  return { date, problem: p, routes, bands, visits };
}

// ---- 重なる帯を横に並べる ----

export type Lane = { lane: number; lanes: number };

/**
 * 同じ時刻に重なる帯を列の中で横に並べる（D49）。重なりのつながり（クラスター）ごとに、開始の順に空いている一番左の
 * レーンへ入れ、クラスターのレーンの数を lanes にする。end と次の start が同じなら重ならない
 */
export function laneLayout(items: readonly { id: string; start: number; end: number }[]): Map<string, Lane> {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
  const out = new Map<string, Lane>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;
  const flush = () => {
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= it.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else laneEnds[lane] = it.end;
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return out;
}

// ---- 動かす（D50。動かす操作は lib/weekOps） ----

/** 開始（早）を start に、開始（遅）を同じ幅だけずらした時刻（幅は保つ） */
export function shiftedTimes(v: Pick<Visit, 'earliestStart' | 'latestStart'>, start: number) {
  const width = hhmmToMinutes(v.latestStart) - hhmmToMinutes(v.earliestStart);
  return { earliestStart: minutesToHhmm(start), latestStart: minutesToHhmm(start + width) };
}

/** 今日より前の日の訪問・今日より前の日へは動かさない（帯のドラッグ・drop・日付の選択・moveFollowing で共通） */
export const canMoveVisit = (date: string, today: string): boolean => date >= today;

// ---- 〈スタッフ〉×曜日の表（D51） ----

export type WeekCell = {
  date: string;
  /** 休み（その日の稼働時間帯が無い） */
  off: boolean;
  count: number;
  /** 稼働時間（時間。その日の稼働時間帯の長さ。欠勤を差し引く） */
  hours: number;
  /** 移動（分。今の担当の列の lenient の移動。自宅へ帰る移動も含む） */
  travel: number;
  /** 種類ごとの件数（種類なしは数えない。種類の並びの順） */
  types: { typeId: string; count: number }[];
  /** 30分ごとの状態（PRD D76。lib/staffBar の staffSlots。0:00〜24:00 の48マス。3段に出すのは 8〜20時で外は端の印。PRD D82） */
  bar: StaffSlot[];
};

export type WeekRow = {
  staffId: string;
  cells: WeekCell[];
  total: { count: number; hours: number; travel: number };
  /** 件数の全員の平均との差 */
  diff: number;
  /** 差が平均の30%を超える */
  strong: boolean;
};

export type StaffWeekTable = {
  rows: WeekRow[];
  /** 日ごとの合計 */
  days: { date: string; count: number; hours: number; travel: number; visits: number }[];
  /** 件数の全員の平均 */
  average: number;
};

/** 差を強調する割合（平均の30%） */
export const STRONG_DIFF_RATIO = 0.3;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 〈スタッフ〉×曜日の表（D51）。行＝稼働中の〈スタッフ〉（名前の順）、列＝days（月〜日）。
 * 数えるのは、その日の担当の並び
 */
export function staffWeekTable(data: CompileInput, days: readonly WeekDay[]): StaffWeekTable {
  const staff = data.staff.filter((s) => s.active).sort(byName);
  const typeOrder = new Map(data.visitTypes.map((t, i) => [t.id, i]));
  const visitById = new Map(days.flatMap((day) => visitsOn(data, day.date)).map((v) => [v.id, v]));
  const rows: WeekRow[] = staff.map((s) => {
    const cells = days.map((day): WeekCell => {
      const override = data.availability.find((a) => a.staffId === s.id && a.date === day.date);
      const absences = data.absences.filter((a) => a.staffId === s.id && a.date === day.date);
      const base = availabilityOf(s, day.date, override).slots;
      const slots = withoutAbsences(base, absences);
      const hours = slots.reduce((m, x) => m + hhmmToMinutes(x.end) - hhmmToMinutes(x.start), 0) / 60;
      const list = own(day.routes, s.id) ?? [];
      let travel = 0;
      let stops: StopTiming[] = [];
      const p = day.problem;
      if (p && list.length > 0) {
        const si = p.staff.findIndex((x) => x.id === s.id);
        const vIndex = new Map(p.visits.map((v, i) => [v.id, i]));
        const idx = list.map((id) => vIndex.get(id)).filter((x): x is number => x !== undefined);
        if (si >= 0) {
          const t = scheduleRoute(p, si, idx, 'lenient');
          travel = t?.travelMinutes ?? 0;
          stops = t?.stops ?? [];
        }
      }
      const typeCount = new Map<string, number>();
      for (const id of list) {
        const t = visitById.get(id)?.typeId;
        if (t) typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
      }
      const types = [...typeCount]
        .map(([typeId, count]) => ({ typeId, count }))
        .sort((a, b) => (typeOrder.get(a.typeId) ?? 99) - (typeOrder.get(b.typeId) ?? 99));
      return {
        date: day.date,
        off: slots.length === 0,
        count: list.length,
        hours: round1(hours),
        travel: Math.round(travel),
        types,
        bar: staffSlots({
          shift: spansOf(slots),
          base: spansOf(base),
          busy: busyParts(stops),
          planned: true,
        }),
      };
    });
    const total = {
      count: cells.reduce((m, c) => m + c.count, 0),
      hours: round1(cells.reduce((m, c) => m + c.hours, 0)),
      travel: cells.reduce((m, c) => m + c.travel, 0),
    };
    return { staffId: s.id, cells, total, diff: 0, strong: false };
  });
  const average = rows.length > 0 ? rows.reduce((m, r) => m + r.total.count, 0) / rows.length : 0;
  for (const r of rows) {
    r.diff = round1(r.total.count - average);
    r.strong = average > 0 && Math.abs(r.total.count - average) > average * STRONG_DIFF_RATIO;
  }
  const dayTotals = days.map((day, i) => ({
    date: day.date,
    count: rows.reduce((m, r) => m + r.cells[i]!.count, 0),
    hours: round1(rows.reduce((m, r) => m + r.cells[i]!.hours, 0)),
    travel: rows.reduce((m, r) => m + r.cells[i]!.travel, 0),
    // その日の訪問の件数（取り消し・〈利用者さん〉の休みを除く）
    visits: day.bands.filter((b) => !b.leave).length,
  }));
  return { rows, days: dayTotals, average: round1(average) };
}

// ---- 資格（D57。design.md §4 pages「月間・週間の改定（2026-10-17）」） ----

/** 資格の項目の名前（項目「資格」。〈スタッフ〉の項目で、選択肢から1つ・複数のもの） */
export const QUALIFICATION_ITEM_NAME = '資格';

/** 項目「資格」（〈スタッフ〉の choice・multi で名前が「資格」の最初の項目。無ければ undefined） */
export function qualificationItem(items: readonly Item[]): Item | undefined {
  return items.find(
    (it) =>
      it.name === QUALIFICATION_ITEM_NAME && it.target === 'staff' && (it.kind === 'multi' || it.kind === 'choice'),
  );
}

/** 資格の短いバッジ。short は選択肢の頭文字2字まで、name は正式名（title に出す） */
export type QualificationBadge = { short: string; name: string };

/** その人が持つ資格の選択肢か（multi は含む、choice は等しい） */
function hasOption(item: Item, s: Pick<Staff, 'traits'>, option: string): boolean {
  const v = own(s.traits, item.id);
  return Array.isArray(v) ? v.includes(option) : v === option;
}

/**
 * 〈スタッフ〉の資格のバッジ（項目「資格」の選択肢の順）。項目が無い・値が無ければ []。
 * 選択肢に無い値（古いデータ）は出さない
 */
export function qualificationBadges(items: readonly Item[], s: Pick<Staff, 'traits'>): QualificationBadge[] {
  const item = qualificationItem(items);
  if (!item) return [];
  return item.options
    .filter((o) => hasOption(item, s, o))
    .map((o) => ({ short: [...o].slice(0, 2).join(''), name: o }));
}

/** その資格（項目「資格」の選択肢）を持つ稼働中の〈スタッフ〉の ID（staff の順）。項目が無ければ [] */
export function staffWithQualification(items: readonly Item[], staff: readonly Staff[], option: string): string[] {
  const item = qualificationItem(items);
  if (!item) return [];
  return staff.filter((s) => s.active && hasOption(item, s, option)).map((s) => s.id);
}

/** その日の問題で、その訪問を担当できる人（可否。compile の allowed）の ID。問題に無い訪問なら [] */
export function allowedStaffOf(problem: Problem | null, visitId: string): string[] {
  const v = problem?.visits.findIndex((x) => x.id === visitId) ?? -1;
  if (!problem || v < 0) return [];
  return problem.staff.filter((_, s) => problem.allowed[v]![s]).map((st) => st.id);
}

/** 担当が訪問の種類の必要条件（理由 visitType）で可でないか（D57 の「資格✗」）。問題に無い・担当がいないなら false */
export function typeUnfit(problem: Problem | null, visitId: string, staffId: string | null): boolean {
  if (!problem || !staffId) return false;
  const v = problem.visits.findIndex((x) => x.id === visitId);
  const s = problem.staff.findIndex((x) => x.id === staffId);
  if (v < 0 || s < 0) return false;
  // 満たした条件も理由（✓・0点）に入るので、可否で外れた（Infinity）ものだけ
  return problem.reasons[v]![s]!.some((r) => r.ruleId === VISIT_TYPE_RULE_ID && r.points === Number.POSITIVE_INFINITY);
}

/** 担当が担当を限る決まり（理由 allowedStaff。ADR-0014）で可でないか（「限✗」の印）。問題に無い・担当がいないなら false */
export function limitUnfit(problem: Problem | null, visitId: string, staffId: string | null): boolean {
  if (!problem || !staffId) return false;
  const v = problem.visits.findIndex((x) => x.id === visitId);
  const s = problem.staff.findIndex((x) => x.id === staffId);
  if (v < 0 || s < 0) return false;
  return problem.reasons[v]![s]!.some(
    (r) => r.ruleId === ALLOWED_STAFF_RULE_ID && r.points === Number.POSITIVE_INFINITY,
  );
}

/** 帯の印（資格✗・限✗）と、その説明（title）。どちらも無ければ空 */
export type UnfitMark = { short: string; why: string };
export function unfitMarks(problem: Problem | null, visitId: string, staffId: string | null): UnfitMark[] {
  const out: UnfitMark[] = [];
  if (typeUnfit(problem, visitId, staffId)) out.push({ short: '資格✗', why: '担当が種類の必要条件を満たさない' });
  if (limitUnfit(problem, visitId, staffId)) out.push({ short: '限✗', why: '担当が担当できる人に入っていない' });
  return out;
}

/**
 * 訪問をその日・時刻へ動かしたときに「入れる人」の数（D57。ドラッグ中の落とす先に出す）：
 * 訪問の日付と開始（早・遅。幅は保つ）を変えたデータで、その訪問を除いたピンでその日の問題を作り（insertIntoPlan と同じ）、
 * その日の担当の並びに reassign の fitsOf で入れられる人の数。データは書き換えない。
 * 問題が作れない・訪問が問題に無い（取り消し・休止中の〈利用者さん〉）なら null
 */
export function fitCountAt(data: DayInput, visitId: string, date: string, start: number): number | null {
  const v = findVisit(data, visitId);
  if (!v) return null;
  const moved: Visit = { ...v, date, ...shiftedTimes(v, start), start: null };
  const input: DayInput = { ...data, visits: putVisits(data.visits, [moved]) };
  const visits = visitsOn(input, date);
  const pins = pinsOf(visits.filter((x) => x.id !== visitId));
  const problem = attempt(() => compile(input, date, Object.keys(pins).length > 0 ? pins : undefined)).value;
  if (!problem || !problem.visits.some((x) => x.id === visitId)) return null;
  const routes = routesOf(
    problem,
    visits.filter((x) => x.id !== visitId),
  );
  return fitsOf(problem, routes, visitId).length;
}

// ---- 〈利用者さん〉×曜日の表（D56。マスの3段の帯は PRD D342） ----

/** 表のマスの訪問1件（時刻は帯と同じ。lenient の開始〜終了、案に無い・取り消し・休みは開始（早）〜＋所要） */
export type ClientWeekItem = {
  visitId: string;
  date: string;
  start: number;
  end: number;
  typeId: string | null;
  /** 担当（null＝担当なし・取り消し・休み） */
  staffId: string | null;
  /** 〈利用者さん〉の休み（ADR-0013）のため無し */
  leave?: boolean;
  /** 取り消した訪問（PRD D342。動かさない） */
  cancelled?: boolean;
  /** 取り消しのうち当日キャンセル（ADR-0015） */
  sameDay?: boolean;
  /** 担当が繰り返しの担当（いつもの担当）でない */
  substitute?: boolean;
  /** 担当なし */
  unassigned?: boolean;
};

export type ClientWeekCell = {
  date: string;
  /** 開始の順（取り消しも入る） */
  items: ClientWeekItem[];
};

export type ClientWeekRow = {
  clientId: string;
  /** days の順 */
  cells: ClientWeekCell[];
};

/**
 * 〈利用者さん〉×曜日の表（D56・PRD D342）。行＝clientIds の〈利用者さん〉（表示名の順。いない ID は除く）。
 * clientIds が null・空なら全員（利用中の〈利用者さん〉と、休止中でもその週に訪問がある〈利用者さん〉）。
 * マスは days の帯（weekDay。取り消しでない訪問）と、その日の取り消した訪問（訪問の開始（早）〜＋所要）を、
 * その〈利用者さん〉の分だけ開始の順に
 */
export function clientWeekTable(
  data: { clients: Client[]; visits: Visit[]; patterns: Pattern[] },
  days: readonly WeekDay[],
  clientIds: readonly string[] | null,
): ClientWeekRow[] {
  const dayVisitList = days.flatMap((day) => visitsOn(data, day.date));
  const visitById = new Map(dayVisitList.map((v) => [v.id, v]));
  const patternById = new Map(data.patterns.map((p) => [p.id, p]));
  const byClient = new Map<string, Map<string, ClientWeekItem[]>>();
  const push = (clientId: string, date: string, item: ClientWeekItem) => {
    const perDay = byClient.get(clientId) ?? new Map<string, ClientWeekItem[]>();
    byClient.set(clientId, perDay);
    const list = perDay.get(date) ?? [];
    perDay.set(date, list);
    list.push(item);
  };
  const dates = new Set(days.map((d) => d.date));
  for (const day of days) {
    for (const b of day.bands) {
      const v = visitById.get(b.visitId);
      if (!v) continue;
      const usual = (v.pattern ? patternById.get(v.pattern.id)?.usualStaffId : null) ?? null;
      push(v.clientId, day.date, {
        visitId: b.visitId,
        date: day.date,
        start: b.start,
        end: b.end,
        typeId: v.typeId,
        staffId: b.staffId,
        ...(b.leave ? { leave: true } : {}),
        ...(b.staffId !== null && usual !== null && b.staffId !== usual ? { substitute: true } : {}),
        ...(!b.leave && b.staffId === null ? { unassigned: true } : {}),
      });
    }
  }
  // 取り消した訪問（帯には無い）も、その日の印として入れる（PRD D342）
  for (const v of dayVisitList) {
    if (!v.cancelled || !dates.has(v.date)) continue;
    const start = hhmmToMinutes(v.earliestStart);
    push(v.clientId, v.date, {
      visitId: v.id,
      date: v.date,
      start,
      end: start + v.durationMinutes,
      typeId: v.typeId,
      staffId: null,
      cancelled: true,
      ...(v.cancelKind === 'sameDay' ? { sameDay: true } : {}),
    });
  }
  const picked = clientIds && clientIds.length > 0 ? new Set(clientIds) : null;
  const clients = [...data.clients]
    .filter((c) => (picked ? picked.has(c.id) : c.active || byClient.has(c.id)))
    .sort(byDisplayName);
  return clients.map((c) => ({
    clientId: c.id,
    cells: days.map((day) => {
      const items = [...(byClient.get(c.id)?.get(day.date) ?? [])].sort(
        (a, b) => a.start - b.start || a.end - b.end || a.visitId.localeCompare(b.visitId),
      );
      return { date: day.date, items };
    }),
  }));
}

/** マスの訪問の印の種類（PRD D342）：形と短い文字で分ける（色だけにしない） */
export type ClientItemKind = 'visit' | 'leave' | 'cancelled' | 'sameDay' | 'unassigned';

/**
 * マスの訪問の印：種類と、帯の下の短い文字（担当の短い名前・休・取消・当日取消・担当なし）、読み上げの文。
 * shortName・fullName は担当の呼び方（名字・フルネーム）
 */
export function clientItemMark(
  it: ClientWeekItem,
  names: { short: (staffId: string) => string; full: (staffId: string) => string },
): { kind: ClientItemKind; short: string; text: string } {
  if (it.cancelled)
    return it.sameDay
      ? { kind: 'sameDay', short: '当日取消', text: '当日キャンセル' }
      : { kind: 'cancelled', short: '取消', text: '取り消し' };
  if (it.leave) return { kind: 'leave', short: '休', text: '休みのため無し' };
  if (it.staffId !== null) {
    const sub = it.substitute ? '（いつもの担当でない）' : '';
    return { kind: 'visit', short: names.short(it.staffId), text: `${names.full(it.staffId)}さん${sub}` };
  }
  return { kind: 'unassigned', short: '担当なし', text: '担当なし' };
}
