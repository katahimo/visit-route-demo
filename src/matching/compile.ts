// DemoData（その日の訪問・スタッフ・項目・条件・相性）→ Problem（可否・費用表・移動の行列）
import type { DemoData } from '../contracts/data';
import type { Client, LatLng, Pattern, Place, Staff, VisitType } from '../contracts/documents';
import type { Problem, ProblemStaff, ProblemVisit, Reason } from '../contracts/problem';
import { type Condition, type Item, POINTS_PER_WEIGHT, type Rule, type Traits } from '../contracts/rules';
import { afterLastDay, availabilityOf, withoutAbsences } from '../domain/availability';
import { leaveOn } from '../domain/leaves';
import { hhmmToMinutes } from '../domain/time';
import { visitsOn } from '../patterns';
import { conditionText, matches } from './conditions';
import { EPS, fitStart } from './timing';
import { travelMatrices, UNPLACED_TRAVEL_MIN } from './travel';

const INF = Number.POSITIVE_INFINITY;
/** 位置が未登録の組に足す点（位置のある人・訪問先を先に選ぶ。可否にはしない） */
export const UNPLACED_POINTS = 30;
/** infeasible に載せる原因の数 */
const INFEASIBLE_REASONS = 3;

function latLngOf(p: Place): LatLng | null {
  return p.lat === null || p.lng === null ? null : { lat: p.lat, lng: p.lng };
}

type MinuteSlot = { start: number; end: number };

/**
 * その日の稼働時間帯（分、開始の順）。base は欠勤を差し引く前、slots は差し引いた後（ADR-0011）。
 * absence はその日のその人の欠勤（無ければ null）
 */
function slotsOf(
  data: CompileInput,
  s: Staff,
  date: string,
): { base: MinuteSlot[]; slots: MinuteSlot[]; absence: { from: string | null; to: string | null } | null } {
  const override = data.availability.find((a) => a.staffId === s.id && a.date === date);
  const raw = availabilityOf(s, date, override).slots;
  const toMinutes = (xs: { start: string; end: string }[]) =>
    xs
      .map((x) => ({ start: hhmmToMinutes(x.start), end: hhmmToMinutes(x.end) }))
      .filter((x) => x.start < x.end)
      .sort((a, b) => a.start - b.start);
  const absences = data.absences.filter((a) => a.staffId === s.id && a.date === date);
  const base = toMinutes(raw);
  if (absences.length === 0) return { base, slots: base, absence: null };
  return { base, slots: toMinutes(withoutAbsences(raw, absences)), absence: absences[absences.length - 1] ?? null };
}

/** 有効な条件（weight 0 かつ hard false は無効） */
function isActive(r: Rule): boolean {
  return r.weight > 0 || r.hard;
}

/** 条件を判定するのに使うもの：項目と、その日（開始年の項目の年数を数える。ADR-0070） */
type CondLook = { items: Map<string, Item>; date: string };

/** 条件1つの判定から理由を作る（満たせば points 0、満たさなければ ngPoints＝重み×10 か hard なら Infinity） */
function condReasons(
  ruleId: string,
  ngPoints: number,
  conds: Condition[],
  look: CondLook,
  target: 'staff' | 'client',
  traits: Traits,
  okLabel: (text: string) => string,
  ngLabel: (text: string) => string,
  out: Reason[],
): void {
  for (const c of conds) {
    const item = look.items.get(c.itemId);
    // 参照する項目がない（消された・相手側の項目でない）条件は無視する
    if (!item || item.target !== target) continue;
    const text = conditionText(c, item);
    if (matches(c, item, traits[c.itemId], look.date)) {
      out.push({ ruleId, label: okLabel(text), points: 0 });
    } else {
      out.push({ ruleId, label: ngLabel(text), points: ngPoints });
    }
  }
}

/**
 * compile が読むデータ（これ以外のフィールド：伝えた内容・プリセット・種などは問題に効かない）。
 * 訪問の担当・開始・ピンは問題に効かない（ピンは compile の pins で渡す）
 */
export type CompileInput = Pick<
  DemoData,
  | 'org'
  | 'items'
  | 'rules'
  | 'staff'
  | 'clients'
  | 'compat'
  | 'visits'
  | 'availability'
  | 'absences'
  | 'visitTypes'
  | 'patterns'
  | 'clientLeaves'
>;

/** 訪問の種類の必要条件の理由の ruleId（条件 rules の ID ではない。ADR-0012） */
export const VISIT_TYPE_RULE_ID = 'visitType';

/**
 * 担当できる人（〈利用者さん〉の allowedStaffIds。PRD D68。ADR-0014）で外れる組の理由の ruleId（条件 rules の ID ではない）。
 * 種類（visitType）と同じく常に必須で、条件の重み・必須・プリセットに関係しない
 */
export const ALLOWED_STAFF_RULE_ID = 'allowedStaff';

/** 欠勤で可にならない組の理由の文（ADR-0011。ruleId は 'slot'） */
export const ABSENT_ALL_DAY = '欠勤（終日）';
/** 途中の欠勤で、その日の稼働時間帯が全部なくなったとき */
export const ABSENT_NO_HOURS = '欠勤で働ける時間がない';
export const ABSENCE_OVERLAP = '欠勤の時間と重なる';
/** その日に勤務が無い（勤務する曜日でない・その日だけの勤務を外した。ruleId は 'slot'） */
export const DAY_OFF = '休み';
/** 勤務の時間帯に、時間の約束と所要が収まらない（ruleId は 'slot'） */
export const OUTSIDE_HOURS = '働ける時間に収まらない';
/** 最終勤務日の後（PRD D71。ADR-0015。ruleId は 'slot'） */
export const AFTER_LAST_DAY = '最終勤務日の後';

/** 手直しで固定した訪問の、固定した担当以外の可否の原因 */
export const PIN_RULE_ID = 'pin';
export const PIN_LABEL = 'ピン（手直し）';

/** 稼働時間帯に収まらない原因（ruleId は 'slot'）を out に足す。収まるなら何も足さない */
function pushSlotReason(
  out: Reason[],
  a: {
    s: Staff;
    /** 欠勤を差し引いた後の稼働時間帯 */
    slots: MinuteSlot[];
    day: ReturnType<typeof slotsOf>;
    date: string;
    earliest: number;
    latest: number;
    duration: number;
  },
): void {
  const { s, slots, day, date, earliest, latest, duration } = a;
  const fits = (xs: MinuteSlot[]) => xs.length > 0 && fitStart(xs, earliest, duration) <= latest;
  if (slots.length === 0) {
    // 欠勤（ADR-0011）：もともと働く日なら「欠勤（終日）」（途中の欠勤で全部なくなったら「欠勤で稼働時間がない」）、
    // もともと休みなら「休み」
    // 最終勤務日の後（ADR-0015）は「最終勤務日の後」
    const absent = day.absence && day.base.length > 0;
    const allDay = day.absence?.from === null && day.absence?.to === null;
    out.push({
      ruleId: 'slot',
      label: afterLastDay(s, date) ? AFTER_LAST_DAY : absent ? (allDay ? ABSENT_ALL_DAY : ABSENT_NO_HOURS) : DAY_OFF,
      points: INF,
    });
  } else if (earliest <= latest && !fits(slots)) {
    const label = day.absence && fits(day.base) ? ABSENCE_OVERLAP : OUTSIDE_HOURS;
    out.push({ ruleId: 'slot', label, points: INF });
  }
}

/** 担当できる人の限り（〈利用者さん〉の ID → 限った人の ID と名前）。ADR-0014 */
type StaffLimit = { ids: Set<string>; names: string };

/**
 * 担当できる人（ADR-0014）：その日の問題にいる（利用中の）人だけを数える。だれもいなければ限らない（repair と同じ扱い）。
 * on が false（機能を切った。ADR-0028）なら、どの〈利用者さん〉も限らない
 */
function staffLimitsOf(clients: Map<string, Client>, staffDocs: Staff[], on: boolean): Map<string, StaffLimit> {
  const activeName = new Map(staffDocs.map((s) => [s.id, s.name]));
  const limitOf = new Map<string, StaffLimit>();
  for (const c of on ? clients.values() : []) {
    const ids = [...new Set(c.allowedStaffIds)].filter((id) => activeName.has(id));
    if (ids.length > 0) limitOf.set(c.id, { ids: new Set(ids), names: ids.map((id) => activeName.get(id)).join('、') });
  }
  return limitOf;
}

/** 条件1つ（rules の1件）の理由を out に足す（担当と〈利用者さん〉の組1つ） */
function pushRuleReasons(
  out: Reason[],
  r: Rule,
  a: {
    s: Staff;
    client: Client;
    look: CondLook;
    terms: CompileInput['org']['terms'];
    /** 相性（機能を切ったら 0） */
    level: number;
    /** いつもの担当（無ければ null） */
    usualStaffId: string | null;
    /** その日に働く担当の ID */
    working: Set<string>;
  },
): void {
  const { s, client, look, terms, level, usualStaffId, working } = a;
  const w = r.weight * POINTS_PER_WEIGHT;
  const ng = r.hard ? INF : w;
  switch (r.type) {
    case 'clientRequirement':
      condReasons(
        r.id,
        ng,
        client.requirements,
        look,
        'staff',
        s.traits,
        (t) => `必要条件：${t} ✓`,
        (t) => `必要条件：${t} ✗`,
        out,
      );
      break;
    case 'clientPreference':
      condReasons(
        r.id,
        ng,
        client.preferences,
        look,
        'staff',
        s.traits,
        (t) => `希望○ ${t}`,
        (t) => `希望✗ ${t}`,
        out,
      );
      break;
    case 'staffRequirement':
      condReasons(
        r.id,
        ng,
        s.requirements,
        look,
        'client',
        client.traits,
        (t) => `${terms.staff}の必要条件：${t} ✓`,
        (t) => `${terms.staff}の必要条件：${t} ✗`,
        out,
      );
      break;
    case 'staffPreference':
      condReasons(
        r.id,
        ng,
        s.preferences,
        look,
        'client',
        client.traits,
        (t) => `${terms.staff}の希望○ ${t}`,
        (t) => `${terms.staff}の希望✗ ${t}`,
        out,
      );
      break;
    case 'compatibility':
      if (level === 2) out.push({ ruleId: r.id, label: '相性◎', points: 0 - w, level: 2 });
      else if (level === 1) out.push({ ruleId: r.id, label: '相性○', points: 0 - w / 2, level: 1 });
      else if (level === -1) out.push({ ruleId: r.id, label: '相性△', points: r.hard ? INF : w, level: -1 });
      break;
    case 'continuity': {
      const usual = usualStaffId;
      // いつもの担当がその日に働かないなら、この条件は無視する
      if (!usual || !working.has(usual)) break;
      if (usual === s.id) out.push({ ruleId: r.id, label: 'いつもの担当', points: 0 });
      else out.push({ ruleId: r.id, label: 'いつもの担当でない', points: r.hard ? INF : w });
      break;
    }
    case 'balance':
    case 'wait':
      break; // 割当費用に入らない
    default: {
      // 条件の種類を足したら、ここが型の誤りになる（割当費用に入れるか、上の case に足す）
      const _exhaustive: never = r.type;
      void _exhaustive;
    }
  }
}

/** compile の中で、訪問と担当の組の理由を作るときに使う、その日の共通のもの */
type PairContext = {
  data: CompileInput;
  date: string;
  pins: Record<string, string> | undefined;
  items: Map<string, Item>;
  rules: Rule[];
  staffDocs: Staff[];
  staff: ProblemStaff[];
  daySlots: ReturnType<typeof slotsOf>[];
  places: (LatLng | null)[];
  /** その日の問題にいる担当の ID */
  staffIds: Set<string>;
  /** その日に働く（稼働時間帯がある）担当の ID（自宅の位置が未登録でも働く。ADR-0093） */
  working: Set<string>;
  /** 相性×の理由の ruleId（最初の相性の条件） */
  firstCompat: string;
  limitOf: Map<string, StaffLimit>;
  compatOn: boolean;
};

/** 訪問 j の側で、どの担当にも共通のもの */
type VisitSide = {
  j: number;
  pv: ProblemVisit;
  client: Client;
  vType: VisitType | undefined;
  usualStaffId: string | null;
};

/** 訪問1件と担当1人の組の理由（並べる前） */
function pairReasons(ctx: PairContext, v: VisitSide, i: number): Reason[] {
  const { data, date, pins, items, rules, staffDocs, staff, daySlots, places, staffIds, working } = ctx;
  const terms = data.org.terms;
  const S = staffDocs.length;
  const { j, pv, client, vType, usualStaffId } = v;
  const s = staffDocs[i]!;
  const ps = staff[i]!;
  const out: Reason[] = [];
  const look: CondLook = { items, date };
  // 位置が未登録でも組む（移動は UNPLACED_TRAVEL_MIN 分とみる。ADR-0093）。位置のある組を先に選ぶよう点を足す。
  // 移動時間（片道・分）を手で決めた〈利用者さん〉は位置を使わないので足さない（ADR-0096）
  if (!places[S + j] && client.place.travelMinutes === undefined)
    out.push({
      ruleId: 'noPlace',
      label: `${terms.client}の緯度・経度が未登録（移動は${UNPLACED_TRAVEL_MIN}分とみる）`,
      points: UNPLACED_POINTS,
    });
  if (!places[i])
    out.push({
      ruleId: 'noPlace',
      label: `${terms.staff}の自宅の緯度・経度が未登録（移動は${UNPLACED_TRAVEL_MIN}分とみる）`,
      points: UNPLACED_POINTS,
    });
  if (pv.earliest > pv.latest) out.push({ ruleId: 'time', label: '時間の約束の幅が正しくない', points: INF });
  pushSlotReason(out, {
    s,
    slots: ps.slots,
    day: daySlots[i]!,
    date,
    earliest: pv.earliest,
    latest: pv.latest,
    duration: pv.duration,
  });
  const level = ctx.compatOn ? (data.compat[client.id]?.[s.id] ?? 0) : 0;
  // 相性×は重み・hard にかかわらず外す
  if (level === -2) out.push({ ruleId: ctx.firstCompat, label: '相性×', points: INF, level: -2 });
  const pin = pins?.[pv.id];
  if (pin !== undefined && pin !== s.id && staffIds.has(pin)) {
    out.push({ ruleId: PIN_RULE_ID, label: PIN_LABEL, points: INF });
  }
  if (vType) {
    // 種類の必要条件は常に必須（条件の重み・必須・プリセットに関係しない。ADR-0012）
    condReasons(
      VISIT_TYPE_RULE_ID,
      INF,
      vType.requirements,
      look,
      'staff',
      s.traits,
      (t) => `種類（${vType.name}）：${t} ✓`,
      (t) => `種類（${vType.name}）：${t} ✗`,
      out,
    );
  }
  const limit = ctx.limitOf.get(client.id);
  if (limit) {
    // 担当できる人を限っている（社内の決まり。常に必須。ADR-0014）
    out.push(
      limit.ids.has(s.id)
        ? { ruleId: ALLOWED_STAFF_RULE_ID, label: `担当を限る：${limit.names} ✓`, points: 0 }
        : { ruleId: ALLOWED_STAFF_RULE_ID, label: `担当を限る：${limit.names} ✗`, points: INF },
    );
  }
  for (const r of rules) pushRuleReasons(out, r, { s, client, look, terms, level, usualStaffId, working });
  return out;
}

/** どの担当も可にならない訪問と、多い原因（INFEASIBLE_REASONS 件まで） */
function infeasibleOf(
  allowed: boolean[][],
  reasons: Reason[][][],
  S: number,
  terms: CompileInput['org']['terms'],
): Problem['infeasible'] {
  const infeasible: Problem['infeasible'] = [];
  for (let j = 0; j < allowed.length; j++) {
    if (allowed[j]!.some(Boolean)) continue;
    const count = new Map<string, { r: Reason; n: number }>();
    for (let i = 0; i < S; i++) {
      for (const r of reasons[j]![i]!) {
        if (r.points !== INF) continue;
        const key = `${r.ruleId}\u0000${r.label}`;
        const e = count.get(key);
        if (e) e.n++;
        else count.set(key, { r, n: 1 });
      }
    }
    const list = [...count.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, INFEASIBLE_REASONS)
      .map(({ r, n }) => ({ ruleId: r.ruleId, label: `${r.label}（${n}人）`, points: INF }));
    if (S === 0) list.push({ ruleId: 'slot', label: `この日に働ける${terms.staff}がいない`, points: INF });
    infeasible.push({ visit: j, reasons: list });
  }
  return infeasible;
}

/** 負担の均等：可になる訪問の件数 n を稼働分に比例して配る（均等の条件が無効なら null） */
function balanceOf(rules: Rule[], staff: ProblemStaff[], working: Set<string>, n: number): Problem['balance'] {
  const balanceRules = rules.filter((r) => r.type === 'balance');
  const wBalance = balanceRules.reduce((a, r) => a + r.weight, 0);
  const hardBalance = balanceRules.some((r) => r.hard);
  if (!(wBalance > 0 || hardBalance)) return null;
  const cap = staff.map((s) => (working.has(s.id) ? s.slots.reduce((a, x) => a + (x.end - x.start), 0) : 0));
  const total = cap.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  const target = cap.map((c) => (n * c) / total);
  const hi = target.map((t) => Math.ceil(t - EPS));
  return {
    perVisit: wBalance * POINTS_PER_WEIGHT,
    lo: target.map((t) => Math.floor(t + EPS)),
    hi,
    // 必須なら上限＝目安の上＋1（休みの人は 0＋1。休みの人はもともと可否で外れる）
    cap: hardBalance ? hi.map((h) => h + 1) : null,
  };
}

/**
 * その日の問題を作る（キャンセルした訪問・休止中のスタッフ/訪問先・休み（ADR-0013）の〈利用者さん〉の訪問は入れない）。
 * pins（訪問ID → 担当ID）の訪問は、固定した担当だけを可にする（他の担当は「固定（手直し）」で外す）。
 * 固定した担当がこの日の問題にいないときは固定を無視する
 */
export function compile(data: CompileInput, date: string, pins?: Record<string, string>): Problem {
  const terms = data.org.terms;
  const staffDocs = data.staff.filter((s) => s.active);
  const clients = new Map<string, Client>(data.clients.filter((c) => c.active).map((c) => [c.id, c]));
  // 〈利用者さん〉の休み（ADR-0013）の訪問は、取り消しと同じく問題に入れない（訪問のデータは消さない）
  const leaves = data.clientLeaves.filter((l) => l.from <= date && date <= l.to);
  // その日の訪問：保存した回と繰り返しから計算した回（版2。ADR-0053）
  const visitDocs = visitsOn(data, date).filter(
    (v) => !v.cancelled && clients.has(v.clientId) && leaveOn(leaves, v.clientId, date) === null,
  );
  const items = new Map(data.items.map((it) => [it.id, it]));
  const rules = data.rules.filter(isActive);
  const visitTypes = new Map<string, VisitType>(data.visitTypes.map((t) => [t.id, t]));
  const patterns = new Map<string, Pattern>(data.patterns.map((p) => [p.id, p]));
  // 機能の入り切り（ADR-0028。PRD D214）：切った好み・社内の決まりは読まない（そのデータが空のときと同じ問題）。
  // compat・allowedStaff は依存先が無いので、スイッチが切（false）かだけを見る。事実（休み・欠勤・最終勤務日・パターン）は読む
  const features = data.org.features;
  const compatOn = features.compat !== false;
  const limitOf = staffLimitsOf(clients, staffDocs, features.allowedStaff !== false);

  const S = staffDocs.length;
  const daySlots = staffDocs.map((s) => slotsOf(data, s, date));
  const staff: ProblemStaff[] = staffDocs.map((s, i) => ({
    id: s.id,
    name: s.name,
    point: i,
    slots: daySlots[i]!.slots,
  }));
  const visits: ProblemVisit[] = visitDocs.map((v, j) => {
    const earliest = hhmmToMinutes(v.earliestStart);
    const pv: ProblemVisit = {
      id: v.id,
      clientId: v.clientId,
      point: S + j,
      earliest,
      latest: v.windowKind === 'fixed' ? earliest : hhmmToMinutes(v.latestStart),
      duration: v.durationMinutes,
    };
    // 遠方（出張。ADR-0096）：その担当のその日はこの〈利用者さん〉の訪問だけ（matching/timing が見る）
    if (clients.get(v.clientId)!.place.farTrip === true) pv.solo = true;
    return pv;
  });

  // --- 地点と移動の行列 ---
  const places: (LatLng | null)[] = [
    ...staffDocs.map((s) => latLngOf(s.home)),
    ...visitDocs.map((v) => latLngOf(clients.get(v.clientId)!.place)),
  ];
  // 地点の鍵：訪問は 'c:'+clientId、自宅は 's:'+staffId（同じ〈利用者さん〉の続けた訪問を同じ担当が持てる）
  const keys = [...staffDocs.map((s) => `s:${s.id}`), ...visitDocs.map((v) => `c:${v.clientId}`)];
  // 手で決めた移動時間（片道・分。ADR-0096）：自宅は無し
  const fixed = [
    ...staffDocs.map(() => null),
    ...visitDocs.map((v) => clients.get(v.clientId)!.place.travelMinutes ?? null),
  ];
  const { travel, meters } = travelMatrices(places, fixed, keys, staffDocs);

  // --- 可否・割当費用・理由 ---
  const working = new Set(staff.filter((s) => s.slots.length > 0).map((s) => s.id));
  const ctx: PairContext = {
    data,
    date,
    pins,
    items,
    rules,
    staffDocs,
    staff,
    daySlots,
    places,
    staffIds: new Set(staff.map((s) => s.id)),
    working,
    firstCompat: rules.find((r) => r.type === 'compatibility')?.id ?? 'compatibility',
    limitOf,
    compatOn,
  };
  const allowed: boolean[][] = [];
  const assignCost: number[][] = [];
  const reasons: Reason[][][] = [];
  for (let j = 0; j < visits.length; j++) {
    const pv = visits[j]!;
    const doc = visitDocs[j]!;
    // 訪問の種類（いない種類の typeId は無視する。ADR-0012）
    const vType = doc.typeId === null ? undefined : visitTypes.get(doc.typeId);
    // いつもの担当：元の繰り返しの担当（版2：〈利用者さん〉は担当を持たない。単発の訪問は無し。ADR-0053）
    const pattern = doc.pattern === null ? undefined : patterns.get(doc.pattern.id);
    const side: VisitSide = {
      j,
      pv,
      client: clients.get(pv.clientId)!,
      vType,
      usualStaffId: pattern?.usualStaffId ?? null,
    };
    const rowAllowed: boolean[] = [];
    const rowCost: number[] = [];
    const rowReasons: Reason[][] = [];
    for (let i = 0; i < S; i++) {
      const out = pairReasons(ctx, side, i);
      out.sort((a, b) => b.points - a.points || 0);
      let cost = 0;
      let ok = true;
      for (const x of out) {
        if (x.points === INF) ok = false;
        else cost += x.points;
      }
      rowAllowed.push(ok);
      rowCost.push(cost);
      rowReasons.push(out);
    }
    allowed.push(rowAllowed);
    assignCost.push(rowCost);
    reasons.push(rowReasons);
  }

  // --- どの担当も可にならない訪問 ---
  const infeasible = infeasibleOf(allowed, reasons, S, terms);
  // --- 負担の均等：可になる訪問の件数を稼働分に比例して配る ---
  const balance = balanceOf(rules, staff, working, visits.length - infeasible.length);
  const wWait = rules.filter((r) => r.type === 'wait').reduce((a, r) => a + r.weight, 0);

  return {
    date,
    staff,
    visits,
    travel,
    meters,
    allowed,
    assignCost,
    reasons,
    waitPerMinute: wWait * 0.1,
    balance,
    infeasible,
  };
}
