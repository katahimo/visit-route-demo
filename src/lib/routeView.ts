// 担当ごとのルートの地図と選択（予定 #/plan と比較 #/compare で共通。ADR-0009）。選択のフックは components/useRouteSelection
import type { Client, Staff, Visit } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import { colorOf, initialOf } from './colors';
import { hasLocation, own, staffColor } from './common';

/** 「最後の訪問先 → 自宅」の区間のキーの頭（区間のキーは訪問ID か `home:<staffId>`） */
export const HOME_LEG = 'home:';
export const homeLegKey = (staffId: string) => `${HOME_LEG}${staffId}`;

/** 地図に描くルートの集まり（予定は1つ、比較は A＝点線・B＝実線の2つ） */
export type RouteSet = { key: string; routes: Record<string, string[]>; dashed?: boolean };

/** 選んだもの：訪問（id＝訪問ID）か区間（id＝訪問ID：その訪問へ来る移動、`home:<staffId>`：自宅へ帰る移動）と、どのルートの集まりか */
export type RouteSel = { id: string; set: string };

type LatLng = { lat: number; lng: number };

/** 地図の点（components/RouteMap が描く）。highlight は選んだ訪問先（大きく・輪で囲み・前に出す） */
export type MapPoint = { lat: number; lng: number; label: string; color: string; highlight?: boolean };
/**
 * 地図の線（components/RouteMap が描く）。highlight は選んだ区間（太く・前に出す。dashed なら点線のまま）。区間があるときは、ほかの線を薄くする。
 * bold は目立たせたい区間（欠勤の振り直しで代行に入れた訪問へ来る区間など。ADR-0011）：太く描くだけで、ほかの線は薄くしない
 */
export type MapLine = {
  points: LatLng[];
  color: string;
  dashed?: boolean;
  highlight?: boolean;
  bold?: boolean;
};

/**
 * 地図の点・線を作る。担当（staffOrder の順）ごと・集まりごとに、自宅 → 訪問先 → 自宅を結ぶ（線の色は担当の色）。
 * focusStaff があればその人だけ。picked の訪問先と、focusLeg の区間（と行き先の訪問先）を強調する。
 * 同じ訪問先の点は1つにまとめる。emphasize の訪問へ来る区間は太く描く（欠勤の振り直しの代行。ADR-0011）
 */
export function buildRouteMap(args: {
  sets: RouteSet[];
  staffOrder: string[];
  staffById: Map<string, Staff>;
  visitById: Map<string, Visit>;
  clientById: Map<string, Client>;
  colorOfStaff: Map<string, string>;
  focusStaff: string | null;
  picked: RouteSel | null;
  focusLeg: RouteSel | null;
  emphasize?: ReadonlySet<string>;
}): { points: MapPoint[]; lines: MapLine[] } {
  const { sets, staffOrder, staffById, visitById, clientById, colorOfStaff, focusStaff, picked, focusLeg } = args;
  const emphasize = args.emphasize ?? new Set<string>();
  const homes: MapPoint[] = [];
  /** 訪問ID → 点（同じ訪問は1つ） */
  const visitPts = new Map<string, MapPoint>();
  const lines: MapLine[] = [];
  const placeOf = (id: string): LatLng | null => {
    const c = clientById.get(visitById.get(id)?.clientId ?? '');
    return c && hasLocation(c.place) ? { lat: c.place.lat, lng: c.place.lng } : null;
  };
  const visitPoint = (id: string, at: LatLng) => {
    const c = clientById.get(visitById.get(id)?.clientId ?? '');
    const p = visitPts.get(id) ?? {
      ...at,
      label: initialOf(c?.displayName ?? ''),
      color: colorOf(c?.color ?? 0),
    };
    visitPts.set(id, p);
    return p;
  };
  for (const sid of staffOrder) {
    if (focusStaff && sid !== focusStaff) continue;
    const s = staffById.get(sid);
    const color = colorOfStaff.get(sid) ?? staffColor(0);
    const home = s && hasLocation(s.home) ? { lat: s.home.lat, lng: s.home.lng } : null;
    let homeShown = false;
    for (const set of sets) {
      const ids = own(set.routes, sid) ?? [];
      if (ids.length === 0) continue;
      const legOn = focusLeg?.set === set.key ? focusLeg.id : null;
      const path: LatLng[] = [];
      if (home) {
        path.push(home);
        if (!homeShown) homes.push({ ...home, label: '家', color });
        homeShown = true;
      }
      let lastId: string | null = null;
      for (const id of ids) {
        const at = placeOf(id);
        if (!at) continue;
        const prev = path[path.length - 1];
        if (id === legOn && prev) lines.push({ points: [prev, at], color, dashed: set.dashed, highlight: true });
        else if (emphasize.has(id) && prev) lines.push({ points: [prev, at], color, dashed: set.dashed, bold: true });
        path.push(at);
        const p = visitPoint(id, at);
        if ((picked?.id === id && picked.set === set.key) || id === legOn) p.highlight = true;
        lastId = id;
      }
      const last = path[path.length - 1];
      if (home && lastId && last) {
        if (legOn === homeLegKey(sid)) {
          lines.push({ points: [last, home], color, dashed: set.dashed, highlight: true });
          const p = visitPts.get(lastId);
          if (p) p.highlight = true;
        }
        path.push(home);
      }
      lines.push({ points: path, color, dashed: set.dashed });
    }
  }
  return { points: [...homes, ...visitPts.values()], lines };
}

/**
 * その人の最後の訪問先から自宅までの移動（分）。計算に入れていないなら null。
 * 自宅の位置が無いときは null。ただし withEstimate なら組みが使った見込みの分数（ADR-0093）を返す
 */
export function homeTravel(
  problem: Problem | null,
  staff: Staff | undefined,
  routes: Record<string, string[]>,
  withEstimate = false,
): number | null {
  if (!problem || !staff || (!withEstimate && !hasLocation(staff.home))) return null;
  const lastId = own(routes, staff.id)?.at(-1);
  const st = problem.staff.find((x) => x.id === staff.id);
  const pv = lastId ? problem.visits.find((v) => v.id === lastId) : undefined;
  if (!st || !pv) return null;
  // 点の番号は compile のとおり（自宅＝スタッフの番号、訪問先＝スタッフの数＋訪問先の番号）。matching/timing.ts の帰りと同じ表
  const t = problem.travel[pv.point]?.[st.point];
  return t !== undefined && Number.isFinite(t) ? t : null;
}

/** 地図で選んでいるもの：見る担当（focusStaff。null は全員）・強調する区間（focusLeg）・選んだ訪問（picked） */
export type RouteSelState = { focusStaff: string | null; focusLeg: RouteSel | null; picked: RouteSel | null };

/** 何も選んでいない */
export const NO_ROUTE_SEL: RouteSelState = { focusStaff: null, focusLeg: null, picked: null };

/**
 * 選び方の操作。reset：すべて外す（日付・案が変わったとき）、focus：見る担当を変える（null は全員）、
 * pick：訪問を押した、leg：区間を押した、follow：訪問の担当が変わった（to が新しい担当、null は未割当）
 */
export type RouteSelAction =
  | { type: 'reset' }
  | { type: 'focus'; staffId: string | null }
  | { type: 'pick'; sel: RouteSel }
  | { type: 'leg'; sel: RouteSel }
  | { type: 'follow'; visitId: string; to: string | null };

/** 同じものを選んでいるか */
export const sameRouteSel = (a: RouteSel | null, b: RouteSel): boolean => !!a && a.id === b.id && a.set === b.set;

/**
 * 選んだ訪問・区間の操作（components/useRouteSelection の状態の遷移）。ownerOf(set, 訪問ID) は、その集まりでの担当。
 * 自宅へ帰る区間（`home:<staffId>`）の担当はキーの中の人。変わらなければ同じ物を返す
 */
export function routeSelect(
  s: RouteSelState,
  a: RouteSelAction,
  ownerOf: (set: string, visitId: string) => string | undefined,
): RouteSelState {
  const owner = (x: RouteSel) => (x.id.startsWith(HOME_LEG) ? x.id.slice(HOME_LEG.length) : ownerOf(x.set, x.id));
  const next = nextRouteSel(s, a, owner);
  return next.focusStaff === s.focusStaff && next.focusLeg === s.focusLeg && next.picked === s.picked ? s : next;
}

function nextRouteSel(s: RouteSelState, a: RouteSelAction, owner: (x: RouteSel) => string | undefined): RouteSelState {
  const { focusStaff, focusLeg, picked } = s;
  switch (a.type) {
    case 'reset':
      return NO_ROUTE_SEL;
    case 'focus': {
      // 選んでいた区間・訪問がその人のものでなければ外す（全員に戻したときも区間の強調は外す）
      const sid = a.staffId;
      return {
        focusStaff: sid,
        focusLeg: focusLeg && (sid === null || owner(focusLeg) !== sid) ? null : focusLeg,
        picked: picked && sid !== null && owner(picked) !== sid ? null : picked,
      };
    }
    case 'pick': {
      // 選ぶ（その人に地図を合わせ、その人のものでない区間の強調は外す）か、もう一度押して外す
      const on = !sameRouteSel(picked, a.sel);
      const o = owner(a.sel);
      if (!on || !o) return { ...s, picked: on ? a.sel : null };
      return { focusStaff: o, focusLeg: focusLeg && owner(focusLeg) !== o ? null : focusLeg, picked: a.sel };
    }
    case 'leg': {
      // 強調する（その人に地図を合わせ、その人のものでない選んだ訪問は外す）か、もう一度押して外す
      const on = !sameRouteSel(focusLeg, a.sel);
      const o = owner(a.sel);
      if (!on || !o) return { ...s, focusLeg: on ? a.sel : null };
      return { focusStaff: o, focusLeg: a.sel, picked: picked && owner(picked) !== o ? null : picked };
    }
    case 'follow': {
      // その訪問を選んでいた・その訪問へ来る区間を強調していたら、絞り込みを新しい担当に合わせ、その人のものでない選択を外す。
      // 未割当にしたときは、その訪問の選択を外す
      const hit = (x: RouteSel | null) => !!x && x.id === a.visitId;
      if (!hit(picked) && !hit(focusLeg)) return s;
      if (a.to === null)
        return { focusStaff, focusLeg: hit(focusLeg) ? null : focusLeg, picked: hit(picked) ? null : picked };
      return {
        focusStaff: focusStaff !== null ? a.to : null,
        focusLeg: focusLeg && !hit(focusLeg) ? null : focusLeg,
        picked: picked && !hit(picked) ? null : picked,
      };
    }
    default: {
      const _: never = a;
      return _;
    }
  }
}
