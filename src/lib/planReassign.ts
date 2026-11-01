// 欠勤の振り直しの手順（ADR-0011。版2は ADR-0053）：欠勤を足したデータで compile し、振り直しの元の案から振り直す訪問を出して
// 振り直す。日の予定の「この案で決める」と「欠勤・キャンセル」の欄の見込み（absencePreviewOf）で同じ手順を使う。
// あわせて、日の予定の振り直しの差の欄・案A／案B の画面のための純粋関数（データは書かない。書くのは lib/absences）
import type { DemoData, ReassignInfo } from '../contracts/data';
import type { Absence } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import type { ReassignDiff, ReassignResult, ReassignTarget, Routes } from '../contracts/reassign';
import { compile } from '../matching';
import { reassign, reassignDiff, targetsOf } from '../reassign';
import { absencesOn, baseOf, type ReassignBase, saveAbsence, withoutAbsencesOn } from './absences';
import { own } from './common';

/** 振り直しの手順の前半：欠勤を足したデータ・その日の問題（欠勤を入れた条件）・振り直しの元の案・その日の欠勤 */
export type AbsenceBase = {
  data: DemoData;
  problem: Problem;
  base: ReassignBase;
  /** その日の欠勤（足した欠勤を含む。振り直しに使う） */
  absences: Absence[];
};

/** 振り直しの手順の全部：前半と、振り直す訪問・振り直した結果（案A） */
export type AbsenceReassign = AbsenceBase & { targets: ReassignTarget[]; result: ReassignResult };

/** 手順の前半（compile に失敗すると投げる） */
function absenceBaseOf(data: DemoData, date: string, absence: Absence): AbsenceBase {
  const d = saveAbsence(data, absence);
  const problem = compile(d, date);
  return { data: d, problem, base: baseOf(d, date, problem), absences: absencesOn(d, date) };
}

/** 振り直しの元の案に担当のある訪問があるか（無ければ振り直せない） */
const hasBase = (b: Pick<AbsenceBase, 'base'>): boolean => Object.values(b.base.routes).some((ids) => ids.length > 0);

/**
 * 手順の後半：振り直す訪問（targetsOf）と振り直した結果（reassign。案A）と、振り直す前の並び（見込みの差に使う）。
 * 振り直す前の時刻（欠勤と重なるか）は、その日の欠勤を除いた問題で出す
 */
function reassignWithBefore(b: AbsenceBase, date: string) {
  const absent = [...new Set(b.absences.map((a) => a.staffId))];
  const before = { problem: compile(withoutAbsencesOn(b.data, date), date), routes: b.base.routes };
  const targets = targetsOf(b.problem, before, absent);
  return { before, targets, result: reassign(b.problem, b.base.routes, targets) };
}

/** 欠勤を足して振り直す（前半と後半。失敗すると投げる。呼ぶ側は attempt で包む） */
export function planReassign(data: DemoData, date: string, absence: Absence): AbsenceReassign {
  const b = absenceBaseOf(data, date, absence);
  const { targets, result } = reassignWithBefore(b, date);
  return { ...b, targets, result };
}

/** 欠勤の見込み（「欠勤・キャンセル」の欄の1段目。PRD D414） */
export type AbsencePreview = {
  /** 振り直す訪問 */
  targets: ReassignTarget[];
  /** 振り直しの元の案に担当のある訪問があるか（無ければ振り直せない） */
  hasBase: boolean;
  /** 案A（空き時間に入れるだけ）で入らない見込みの件数（案B を勧める） */
  unplacedA: number;
  /** 案A の差（担当が移る訪問の一覧。D265）。振り直せなければ null */
  diff: ReassignDiff | null;
};

/** 欠勤を入れたデータで案A を作り、振り直す訪問と差を出す（データは書かない。失敗すると投げる） */
export function absencePreviewOf(data: DemoData, date: string, absence: Absence): AbsencePreview {
  const b = absenceBaseOf(data, date, absence);
  if (!hasBase(b)) return { targets: [], hasBase: false, unplacedA: 0, diff: null };
  const { before, targets, result } = reassignWithBefore(b, date);
  return {
    targets,
    hasBase: true,
    unplacedA: result.unplaced.length,
    diff: reassignDiff(before, { problem: b.problem, routes: result.routes }),
  };
}

/** 担当の並びを問題の〈スタッフ〉の順・問題の訪問だけにそろえる（比べるため。空の列は除く） */
export function routesOfIds(problem: Problem, r: Routes): Routes {
  const ids = new Set(problem.visits.map((v) => v.id));
  const out: Routes = {};
  for (const s of problem.staff) {
    const xs = (own(r, s.id) ?? []).filter((id) => ids.has(id));
    if (xs.length > 0) out[s.id] = xs;
  }
  return out;
}

/**
 * 案A の列（振り直した直後）：振り直しの情報の案A（無く、反映したのが案A なら今の並び）を問題の訪問だけにする。
 * 案A が分からなければ null
 */
export function planAOf(info: ReassignInfo, problem: Problem, routes: Routes): Routes | null {
  const r = info.insertRoutes ?? (info.method === 'insert' ? routes : undefined);
  if (!r) return null;
  const ids = new Set(problem.visits.map((v) => v.id));
  return Object.fromEntries(Object.entries(r).map(([k, xs]) => [k, xs.filter((id) => ids.has(id))]));
}

/** 案A を反映するときの結果（担当のある訪問はみなピン。列に無い問題の訪問は担当なし） */
export function planAResultOf(problem: Problem, routesA: Routes): ReassignResult {
  const placed = new Set(Object.values(routesA).flat());
  const pins: Record<string, string> = {};
  for (const [sid, ids] of Object.entries(routesA)) for (const id of ids) pins[id] = sid;
  return {
    routes: routesA,
    placed: [],
    unplaced: [],
    unassigned: problem.visits.map((v) => v.id).filter((id) => !placed.has(id)),
    pins,
  };
}

/** 今の振り直し（日・元の案・欠勤・案A）のキー。作った案B がこの振り直しのものか（振り直しが無ければ null） */
export function annealKeyOf(date: string, info: ReassignInfo | null): string | null {
  return info ? JSON.stringify([date, info.baseRoutes, info.absenceIds, info.insertRoutes ?? null]) : null;
}

/** 振り直しの差の印：代行（訪問ID → 元の担当）・開始の変化（訪問ID → 分）・変わる人・地図で太くする訪問・入らない訪問 */
export type ReassignMarks = {
  substitute: Map<string, string>;
  shifted: Map<string, number>;
  changed: Set<string>;
  emphasize: Set<string>;
  unplaced: Set<string>;
};

/** 振り直しの差から印を作る（差が無ければ空） */
export function reassignMarksOf(diff: ReassignDiff | null): ReassignMarks {
  const substitute = new Map<string, string>();
  for (const x of diff?.moved ?? []) if (x.from !== null && x.to !== null) substitute.set(x.visitId, x.from);
  return {
    substitute,
    shifted: new Map((diff?.shifted ?? []).map((x) => [x.visitId, x.minutes])),
    changed: new Set(diff?.changedStaff ?? []),
    emphasize: new Set(substitute.keys()),
    unplaced: new Set(diff?.unplaced ?? []),
  };
}

/** 振り直しに使った欠勤の人（その日のまだある欠勤） */
export function absentStaffOf(info: ReassignInfo | null, absences: readonly Absence[], date: string): Set<string> {
  const ids = new Set(info?.absenceIds ?? []);
  return new Set(absences.filter((a) => ids.has(a.id) && a.date === date).map((a) => a.staffId));
}

/** 案B を作れない理由（作れれば null） */
export function annealDisabledWhy(x: {
  info: ReassignInfo | null;
  /** 振り直しに使った欠勤が取り消されている */
  cancelled: boolean;
  planA: Routes | null;
  /** 案B 以外の計算をしている */
  otherRunning: boolean;
}): string | null {
  if (!x.info) return '振り直しがありません';
  if (x.cancelled) return '欠勤が取り消されているので作れません';
  if (!x.planA) return '案A がありません';
  if (x.otherRunning) return '計算中は押せません';
  return null;
}
