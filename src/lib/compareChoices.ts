// 提案を比べる（#/compare。D19・D22・ADR-0005・ADR-0064）の比べる案の一覧と、A・B の選び方・条件の差・担当の並びを作る純粋関数。
// 画面（pages/ComparePage）は store から読んだデータを渡すだけで、案の組み立て・判定はここで行う
import type { DemoData, ReassignInfo } from '../contracts/data';
import type { Client, Visit } from '../contracts/documents';
import type { Problem, Reason, ScoreScale } from '../contracts/problem';
import type { Preset, Rule } from '../contracts/rules';
import { toHundred } from '../evaluate';
import { scheduleRoute } from '../matching';
import { applyPreset } from '../seed';
import { attempt, ruleWeightText } from './common';
import { routesOf, unassignedOf } from './dayPlan';
import { type BatchProposal, type ProposalDay, proposalDayFresh } from './monthBatch';

/** A・B のどちらか */
export type CompareSide = 'a' | 'b';

/** 比べる候補：今の担当・欠勤前（振り直す前の担当）・提案（この画面で作った提案・担当を組むで出した提案） */
export type CompareChoice = {
  id: string;
  title: string;
  kind: 'current' | 'before' | 'proposal';
  rules: Rule[];
  routes: Record<string, string[]>;
  unassigned: string[];
  /** 提案を作ったときのその日の訪問（変わったら当てられない） */
  visits?: readonly Visit[];
  /** 担当を組むで出した提案の日（反映してよいかを担当を組むと同じ決まりで確かめる。proposalDayFresh） */
  day?: ProposalDay;
  stopped?: boolean;
};

/** 今の担当の案の ID */
export const CURRENT_CHOICE = 'current';
/** 欠勤前（振り直す前の担当）の案の ID */
export const BEFORE_CHOICE = 'before';
/** 担当を組むで出した提案の ID の頭（この画面で消した・反映したものを隠すのに使う） */
const ARRANGE_PREFIX = 'arrange-';

/** 担当を組むで出した提案か */
export const isArrangeChoice = (c: Pick<CompareChoice, 'id'>): boolean => c.id.startsWith(ARRANGE_PREFIX);

/**
 * 担当を組むで出した提案のうち date の日の分（考え方ごとの案はそれぞれ、範囲の提案はその日）。比べる案に足す（ADR-0064）。
 * 担当なしは今の問題で数え直すので空にしておく（compareChoices）。hidden（この画面で消した・反映した ID）は外す
 */
export function arrangeChoices(
  batch: BatchProposal | null,
  date: string,
  presets: readonly Preset[],
  rules: Rule[],
  hidden: ReadonlySet<string>,
): CompareChoice[] {
  if (!batch) return [];
  const of = (key: string, title: string, day: ProposalDay | undefined, presetId: string | null): CompareChoice[] => {
    if (!day || day.date !== date) return [];
    const preset = presetId ? presets.find((p) => p.id === presetId) : undefined;
    return [
      {
        id: `${ARRANGE_PREFIX}${batch.id}-${key}`,
        title,
        kind: 'proposal',
        rules: preset ? applyPreset(rules, preset) : rules,
        routes: day.routes,
        unassigned: [],
        visits: day.visits,
        day,
      },
    ];
  };
  const list = batch.choices
    ? batch.choices.flatMap((c) =>
        of(
          c.presetId,
          `「${c.name}」の案（担当を組む）`,
          c.days.find((d) => d.date === date),
          c.presetId,
        ),
      )
    : of(
        'range',
        `${batch.label}の提案（担当を組む）`,
        batch.days.find((d) => d.date === date),
        null,
      );
  return list.filter((c) => !hidden.has(c.id));
}

export type CompareChoicesInput = {
  /** その日の問題（計算できる訪問が無ければ比べる担当も無い） */
  problem: Problem | null;
  /** その日の訪問（今の担当を読む） */
  visits: readonly Visit[];
  /** その日の振り直しの情報（あれば欠勤前を並べる） */
  reassign: ReassignInfo | null;
  rules: Rule[];
  /** 担当を組むで出した提案（arrangeChoices） */
  fromArrange: readonly CompareChoice[];
  /** この画面で作った提案 */
  made: readonly CompareChoice[];
};

/** 比べる案の一覧：欠勤前（振り直した日だけ）・今の担当・担当を組むの提案（担当なしを数え直す）・この画面で作った提案の順 */
export function compareChoices({
  problem,
  visits,
  reassign,
  rules,
  fromArrange,
  made,
}: CompareChoicesInput): CompareChoice[] {
  if (!problem || problem.visits.length === 0) return [];
  const out: CompareChoice[] = [];
  const ids = problem.visits.map((v) => v.id);
  if (reassign) {
    const placed = new Set(Object.values(reassign.baseRoutes).flat());
    out.push({
      id: BEFORE_CHOICE,
      title: '欠勤前（振り直す前の担当）',
      kind: 'before',
      rules,
      routes: reassign.baseRoutes,
      unassigned: ids.filter((v) => !placed.has(v)),
    });
  }
  const routes = routesOf(problem, visits);
  out.push({
    id: CURRENT_CHOICE,
    title: '今の担当',
    kind: 'current',
    rules,
    routes,
    unassigned: unassignedOf(problem, routes),
  });
  return [...out, ...fromArrange.map((c) => ({ ...c, unassigned: unassignedOf(problem, c.routes) })), ...made];
}

/** 選んだ A・B の ID（null は既定） */
export type CompareSelection = { a: string | null; b: string | null };

/** A・B に並べる案。既定：A＝今の担当、B＝最後の案（A 以外） */
export function comparePair(
  choices: readonly CompareChoice[],
  sel: CompareSelection,
): { A: CompareChoice | undefined; B: CompareChoice | undefined } {
  const byId = (id: string | null) => choices.find((c) => c.id === id);
  const A = byId(sel.a) ?? byId(CURRENT_CHOICE);
  const B = byId(sel.b) ?? choices.filter((c) => c.id !== A?.id).at(-1);
  return { A, B };
}

/**
 * side に id を選んだあとの選び方。もう一方と同じ案を選んだら入れ替える（同じ案どうしを比べない）。
 * 今と同じ案なら null（変えない）。A・B は comparePair で今並べている案
 */
export function pickSide(
  s: CompareSelection,
  pair: { A: CompareChoice | undefined; B: CompareChoice | undefined },
  side: CompareSide,
  id: string,
): CompareSelection | null {
  const { A, B } = pair;
  const other = side === 'a' ? B : A;
  const mine = side === 'a' ? A : B;
  if (mine?.id === id) return null;
  if (other?.id === id) return side === 'a' ? { a: id, b: mine?.id ?? null } : { a: mine?.id ?? null, b: id };
  return { a: s.a ?? A?.id ?? null, b: s.b ?? B?.id ?? null, [side]: id };
}

/** 提案を作ったあとに訪問が変わったか（変わったら当てられない）。担当を組むの提案は担当を組むと同じ決まりで確かめる */
export function choiceStale(c: CompareChoice, visits: readonly Visit[], data: DemoData): boolean {
  return (
    (!!c.visits && (c.visits.length !== visits.length || c.visits.some((v, i) => v !== visits[i]))) ||
    (!!c.day && !proposalDayFresh(data, c.day))
  );
}

/** 案の種類の文（一覧の「種類」の列） */
export function choiceKindText(kind: CompareChoice['kind']): string {
  switch (kind) {
    case 'current':
      return '保存している担当';
    case 'before':
      return '振り直す前';
    case 'proposal':
      return '提案（保存しない）';
    default: {
      const _: never = kind;
      return _;
    }
  }
}

/** 条件の差の1行（A・B の重みの文） */
export type RuleDiffRow = { id: string; label: string; a: string; b: string };

/** 条件の差：A・B の条件を合わせた並び（A の順、次に B だけの条件）で重みの文を並べる */
export function ruleDiffRows(a: Pick<CompareChoice, 'rules'>, b: Pick<CompareChoice, 'rules'>): RuleDiffRow[] {
  const ids = [...a.rules.map((r) => r.id), ...b.rules.map((r) => r.id)].filter((id, i, all) => all.indexOf(id) === i);
  return ids.map((id) => {
    const ra = a.rules.find((r) => r.id === id);
    const rb = b.rules.find((r) => r.id === id);
    return { id, label: (rb ?? ra)?.label ?? id, a: ruleWeightText(ra), b: ruleWeightText(rb) };
  });
}

/** 担当ごとの比較に並べる人：A・B のどちらかで訪問のある人を、人の並び順で（並びに無い人は後ろへ） */
export function compareStaffIds(
  aRoutes: Record<string, string[]>,
  bRoutes: Record<string, string[]>,
  staff: readonly { id: string }[],
): string[] {
  const ids = new Set(
    [...Object.entries(aRoutes), ...Object.entries(bRoutes)].filter(([, v]) => v.length > 0).map(([k]) => k),
  );
  const order = staff.map((s) => s.id).filter((id) => ids.has(id));
  return [...order, ...[...ids].filter((id) => !order.includes(id))];
}

/** どの担当も可にならない訪問の理由（訪問の ID → 理由） */
export function infeasibleReasons(problem: Problem | null): Map<string, Reason[]> {
  const out = new Map<string, Reason[]>();
  for (const f of problem?.infeasible ?? []) {
    const v = problem?.visits[f.visit];
    if (v) out.set(v.id, f.reasons);
  }
  return out;
}

/** 点数の A・B と差（B−A。高いほど良い）。どちらかの採点が無ければ null */
export function hundredDelta(
  a: { total: number } | null,
  b: { total: number } | null,
  scale: ScoreScale | null | undefined,
): { a: number; b: number; d: number } | null {
  if (!a || !b || !scale) return null;
  const ha = toHundred(a.total, scale);
  const hb = toHundred(b.total, scale);
  return { a: ha, b: hb, d: hb - ha };
}

/** 訪問の1行の文（「09:00 山田」。分からなければ「（不明）」） */
export function visitLabelOf(
  visitById: ReadonlyMap<string, Visit>,
  clientById: ReadonlyMap<string, Client>,
): (id: string) => string {
  return (id) => {
    const v = visitById.get(id);
    const c = v ? clientById.get(v.clientId) : undefined;
    return `${v?.earliestStart ?? ''} ${c?.displayName ?? '（不明）'}`;
  };
}

/** 1人のルートの移動・待ち（lenient。その人・訪問が問題に無い・計算できなければ null） */
export function routeTotals(problem: Problem | null, staffId: string, ids: readonly string[]) {
  if (!problem) return null;
  const si = problem.staff.findIndex((s) => s.id === staffId);
  if (si < 0) return null;
  const idx = ids.map((id) => problem.visits.findIndex((v) => v.id === id)).filter((i) => i >= 0);
  return attempt(() => scheduleRoute(problem, si, idx, 'lenient')).value;
}

/** もう一方の案では誰の担当か（「→ Bでは 名前」「← Aでは 名前」。同じなら null） */
export function movedLabel(
  other: string | undefined,
  staffId: string,
  side: CompareSide,
  staffName: (id: string) => string,
): string | null {
  if (other === staffId) return null;
  const name = other ? staffName(other) : '担当なし';
  return side === 'a' ? `→ Bでは ${name}` : `← Aでは ${name}`;
}
