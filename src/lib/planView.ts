// 日の予定の画面（PRD D4・D58・D63）の表示のための純粋関数：列に出す人・要対応の印・未連絡の変更の印・
// 「入らない」「守れない条件」の一覧の行（PRD D345）
import type { Absence } from '../contracts/documents';
import type { PlanScore, Problem, Reason, VisitExplain } from '../contracts/problem';
import type { ContactList, Routes } from '../contracts/reassign';
import { NONE } from '../domain/scheduleModel';
import { clock } from './contacts';
import type { VisitIssue } from './dayPlan';
import type { HardLink } from './hardLinks';
import { reasonFace } from './scoreReason';

/**
 * 列に出す人：その日に働く人（欠勤で稼働時間帯が無くなった人（もともと働く日）も。欠勤の印・「欠勤を直す」。ADR-0011）と、
 * 訪問の担当になっている人。staffIds（名前の順）の順で、そのあとに staffIds にいない担当（担当なしの印は除く）
 */
export function planColumns(
  problem: Problem | null,
  routes: Routes,
  staffIds: readonly string[],
  slotsOf: ReadonlyMap<string, { absence: Absence | null; baseSlots: readonly unknown[] }>,
): string[] {
  const absentToday = (id: string) => {
    const a = slotsOf.get(id);
    return !!a?.absence && a.baseSlots.length > 0;
  };
  const working = new Set(problem?.staff.filter((s) => s.slots.length > 0 || absentToday(s.id)).map((s) => s.id) ?? []);
  const withVisits = new Set(
    Object.entries(routes)
      .filter(([, ids]) => ids.length > 0)
      .map(([k]) => k),
  );
  const order = staffIds.filter((id) => working.has(id) || withVisits.has(id));
  return [...order, ...[...withVisits].filter((id) => !order.includes(id) && id !== NONE)];
}

/** 要対応の文（担当なしを除く。担当が休みなど）の訪問ごとの一覧（カード・帯の赤い印） */
export function hardLabelsOf(issues: ReadonlyMap<string, readonly VisitIssue[]>): Map<string, string[]> {
  const h = new Map<string, string[]>();
  for (const [id, list] of issues) {
    const xs = list.filter((x) => x.kind !== 'unassigned').map((x) => x.label);
    if (xs.length > 0) h.set(id, xs);
  }
  return h;
}

/** 訪問ごとの未連絡の変更の文（「担当 A→B」「時刻 9:00→9:30」。両方あれば時刻） */
export function toldMarksOf(told: ContactList | null, staffName: (id: string) => string): Map<string, string> {
  const out = new Map<string, string>();
  const name = (id: string | null) => (id ? staffName(id) : 'なし');
  for (const c of told?.staffChanged ?? []) out.set(c.visitId, `担当 ${name(c.fromStaffId)}→${name(c.toStaffId)}`);
  for (const c of told?.timeChanged ?? []) out.set(c.visitId, `時刻 ${clock(c.fromStart)}→${clock(c.toStart)}`);
  return out;
}

/**
 * 担当なしの訪問の理由：どの担当も可にならない訪問は infeasible の理由、候補がいるのに入らない訪問は explain の理由
 * （「担当なしの訪問」の列の札と「入らない」の一覧で同じ）
 */
export function unplacedReasons(
  problem: Problem | null,
  explained: ReadonlyMap<string, Pick<VisitExplain, 'reasons'>>,
  visitId: string,
): Reason[] {
  const inf = problem?.infeasible.find((f) => problem.visits[f.visit]?.id === visitId);
  return inf?.reasons ?? explained.get(visitId)?.reasons ?? [];
}

/** 「入らない」「守れない条件」の一覧の1行（components/PlanIssueCount の IssueRow と同じ形） */
export type PlanIssueRow = {
  visitId: string;
  time: string;
  clientName: string;
  staffName?: string;
  reasons: string[];
  links: HardLink[];
};

/** 一覧の行の名前・時刻を引くもの */
type RowWords = {
  /** 時刻（今の担当の開始。無ければ約束の開始） */
  timeOf: (visitId: string) => string;
  clientName: (visitId: string) => string;
};

/**
 * 「入らない N」の一覧（PRD D345）：理由は「担当なしの訪問」の列の札と同じ言葉。関連の画面は組めない理由の直す画面
 * （lib/unassignedReason。PRD D430。切った機能の行き先は呼ぶ側で外す）
 */
export function droppedRowsOf(
  unassigned: readonly string[],
  reasonsOf: (visitId: string) => readonly Reason[],
  w: RowWords,
  linksOf: (visitId: string) => HardLink[] = () => [],
): PlanIssueRow[] {
  return unassigned.map((id) => ({
    visitId: id,
    time: w.timeOf(id),
    clientName: w.clientName(id),
    reasons: reasonsOf(id).map((r) => reasonFace(r).text),
    links: linksOf(id),
  }));
}

/**
 * 「守れない条件 N」の一覧（PRD D345）：訪問ごとに1行（理由・関連の画面は重ねない）、時刻の順。
 * linksOf は違反の関連の画面（切った機能の行き先は呼ぶ側で外す）
 */
export function hardRowsOf(
  violations: readonly PlanScore['hardViolations'][number][],
  linksOf: (v: PlanScore['hardViolations'][number]) => HardLink[],
  w: RowWords & { staffName: (staffId: string) => string },
): PlanIssueRow[] {
  const rows: PlanIssueRow[] = [];
  for (const h of violations) {
    const links = linksOf(h);
    const row = rows.find((r) => r.visitId === h.visitId);
    if (row) {
      if (!row.reasons.includes(h.label)) row.reasons.push(h.label);
      for (const l of links) if (!row.links.some((x) => x.to === l.to)) row.links.push(l);
      continue;
    }
    rows.push({
      visitId: h.visitId,
      time: w.timeOf(h.visitId),
      clientName: w.clientName(h.visitId),
      staffName: w.staffName(h.staffId),
      reasons: [h.label],
      links,
    });
  }
  return rows.sort((a, b) => a.time.localeCompare(b.time));
}
