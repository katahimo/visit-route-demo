// 日の予定の画面（PRD D4・D58・D63）の表示のための純粋関数：列に出す人・要対応の印・未連絡の変更の印
import type { Absence } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import type { ContactList, Routes } from '../contracts/reassign';
import { NONE } from '../domain/scheduleModel';
import { clock } from './contacts';
import type { VisitIssue } from './dayPlan';

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
