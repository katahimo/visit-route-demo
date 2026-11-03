// 訪問の詳細の欄の担当：欄の日時での担当の候補（staffChoices・staffPickError）と、担当の割り当て（assignOnDays）。
// どれも純粋関数で、DemoData を書き換えない（書いたデータは呼ぶ側が store の update(fn) で反映する）
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { bestInsertion, compile } from '../matching';
import { findVisit, putVisits, visitsOn } from '../patterns';
import { attempt } from './common';
import { dayProblemOf, pinsOf, routesOf, writeRoutes } from './dayPlan';
import { isDate } from './isDate';
import { type ReassignChoice, reassignChoices, workingStaff } from './reassignMenu';
import { type UnassignedReason, unassignedReasonOf } from './unassignedReason';
import { normalized, type VisitDraft } from './visitDraft';

// ---- 担当の候補 ----

/** 担当の候補の1人（「担当を変える ▾」と同じ判定。lib/reassignMenu の reassignChoices） */
export type StaffChoice = ReassignChoice;

export type StaffChoices = {
  date: string;
  /** その日の今の担当（日付を変えたら別の日なので null） */
  currentStaffId: string | null;
  choices: StaffChoice[];
  /** 候補を出せない理由（null＝出せた）。ほかに選べる人が1人もいなければ、組めない理由の内訳 */
  why: string | null;
  /**
   * 組めない理由（PRD D430）：担当なしの訪問か、今の担当のほかに選べる人がいないとき（lib/unassignedReason。この訪問を除いた列で見る）。
   * 担当がいてほかに選べる人もいれば null
   */
  blocked: UnassignedReason | null;
};

/** 新しい訪問を問題に入れるときの仮の ID */
export const NEW_VISIT_ID = '__new_visit';

/** 欄の入力のまま、問題に入る訪問を作る（新しい訪問は仮の ID・担当なし） */
function draftVisit(base: Visit | null, f: VisitDraft): Visit {
  const n = normalized(f);
  return {
    ...(base ?? { staffId: null, start: null, pinned: false, cancelled: false, cancelKind: null, pattern: null }),
    ...n,
    start: null,
    id: base?.id ?? NEW_VISIT_ID,
  } as Visit;
}

/**
 * 欄の日時（変えていればその日時）で、担当の候補を出す（「担当を変える ▾」と同じ関数 reassignChoices。PRD D303）。
 * 問題は日の予定と同じ作り方（データの条件・ピンなし）。列はその日の担当の並びからこの訪問を除いたもの。
 * 出す人はその日に働く人（稼働時間帯がある・列に訪問がある。workingStaff）と今の担当。選べる人を先に、選べない人は理由つきで後ろ
 */
export function staffChoices(d: DemoData, visitId: string | null, draft: VisitDraft): StaffChoices {
  const empty = (why: string): StaffChoices => ({
    date: draft.date,
    currentStaffId: null,
    choices: [],
    why,
    blocked: null,
  });
  if (!isDate(draft.date) || !/^\d{2}:\d{2}$/.test(draft.earliestStart) || !(draft.durationMinutes >= 5))
    return empty('日付・時刻・所要を入れると候補が出ます');
  if (!draft.clientId) return empty('〈利用者さん〉を選ぶと候補が出ます');
  const base = visitId ? findVisit(d, visitId) : null;
  const moved = draftVisit(base, draft);
  const input = { ...d, visits: putVisits(d.visits, [moved]) };
  const problem = attempt(() => compile(input, draft.date)).value;
  if (!problem) return empty('その日の計算ができません');
  if (!problem.visits.some((x) => x.id === moved.id)) return empty('計算に入らない訪問です（休み・利用中でない など）');
  const all = routesOf(
    problem,
    visitsOn(input, draft.date).filter((x) => x.id !== moved.id),
  );
  const current = base && base.date === draft.date && !base.cancelled ? base.staffId : null;
  const working = workingStaff(problem, all);
  const choices = reassignChoices(problem, all, moved.id, current, (sid) => working.has(sid));
  const selectable = choices.some((c) => !c.current && !c.disabled);
  const blocked =
    current === null || !selectable ? unassignedReasonOf(problem, all, moved.id, d.org.terms, d.clients) : null;
  const others = choices.some((c) => !c.current);
  const why = !others && blocked ? `ほかに担当できる${d.org.terms.staff}がいません（${blocked.summary}）` : null;
  return { date: draft.date, currentStaffId: current, choices, why, blocked };
}

/**
 * 選んだ担当がその入力の日時で選べるか（保存の前に計算し直す。日付を変えたあとに前の日の候補が残っていても割り当てない）。
 * staff：undefined＝変えない（いつも可）、null＝担当なし（今の担当があるときだけ）、ID＝候補にあって選べる人。誤りの文か null
 */
export function staffPickError(
  d: DemoData,
  visitId: string | null,
  draft: VisitDraft,
  staff: string | null | undefined,
): string | null {
  if (staff === undefined) return null;
  const c = staffChoices(d, visitId, draft);
  if (staff === null) {
    return c.currentStaffId !== null ? null : '担当なしは、今の担当がいる回の「この回だけ」で選べます';
  }
  if (c.why) return `担当を選べません（${c.why}）`;
  const x = c.choices.find((y) => y.staffId === staff);
  if (!x) return '選んだ担当は、この日時では候補にいません。担当を選び直してください';
  if (x.disabled) return `選んだ担当は、この日時では選べません（${x.disabled}）`;
  return null;
}

// ---- 担当を割り当てる ----

/** 担当を割り当てられなかった回と理由 */
export type AssignFail = { visitId: string; date: string; why: string };

/**
 * 訪問をその日の担当の並びで担当に割り当ててピンにする（日の予定の「担当を変える ▾」と同じく最も費用の少ない位置。staffId が null なら
 * 担当なしにしてピンも外す）。その日に担当できない人（force 以外）は割り当てずに failed へ。
 * force の訪問は可否を見ずに割り当てる（欄で選んだこの回。保存の前に staffPickError で選べることを見る）。問題にいない人はいつも failed
 */
export function assignOnDays(
  d: DemoData,
  items: readonly { visitId: string; date: string }[],
  staffId: string | null,
  force: ReadonlySet<string> = new Set(),
): { data: DemoData; failed: AssignFail[] } {
  const failed: AssignFail[] = [];
  const byDate = new Map<string, string[]>();
  for (const x of items) byDate.set(x.date, [...(byDate.get(x.date) ?? []), x.visitId]);
  let data = d;
  for (const [date, ids] of byDate) {
    const visits = visitsOn(data, date);
    const pins = pinsOf(visits.filter((v) => !ids.includes(v.id)));
    const problem = dayProblemOf(data, date, Object.keys(pins).length > 0 ? pins : undefined);
    if (!problem) {
      for (const id of ids) failed.push({ visitId: id, date, why: 'その日の計算ができません' });
      continue;
    }
    let routes = routesOf(problem, visits);
    const nextPins = { ...pins };
    let any = false;
    for (const id of ids) {
      const j = problem.visits.findIndex((v) => v.id === id);
      if (j < 0) {
        failed.push({ visitId: id, date, why: '計算に入らない訪問' });
        continue;
      }
      if (staffId === null) {
        routes = Object.fromEntries(Object.entries(routes).map(([s, xs]) => [s, xs.filter((x) => x !== id)]));
        delete nextPins[id];
      } else {
        const i = problem.staff.findIndex((s) => s.id === staffId);
        // force（欄で選んだこの回。選べるかは staffPickError で見た）でも、その日に問題にいない人は割り当てない
        if (i < 0 || (!force.has(id) && problem.allowed[j]?.[i] !== true)) {
          failed.push({ visitId: id, date, why: i < 0 ? 'その日は働かない' : 'その日は担当できない' });
          continue;
        }
        routes = bestInsertion(problem, routes, id, staffId);
        nextPins[id] = staffId;
      }
      any = true;
    }
    if (any) data = writeRoutes(data, date, problem, routes, { pins: nextPins });
  }
  return { data, failed };
}
