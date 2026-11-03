// 要対応の帯の種類（PRD D384・D403・D404。ADR-0089）の分け方：訪問ごとの検査（lib/dayPlan の visitIssues）を、帯に数える
// 担当なし・間に合わない・重なり・休みの人 に分ける純粋関数。要対応の帯（lib/attentionBand）・来月の確認（lib/nextMonthCheck）・
// 札の目立たせ方（lib/visitLook）・自動の組みの対象（lib/autoArrange）・自動の伝えた記録（lib/settled）が同じ分け方を使う
import type { Problem } from '../contracts/problem';
import type { CompileInput } from '../matching';
import { visitsOn } from '../patterns';
import { dayProblemOf, dayRoutes, type IssueKind, type VisitIssue, visitIssues } from './dayPlan';

/**
 * 帯に数える訪問の種類：担当なし・間に合わない（時間の約束・働ける時間に間に合わない）・重なり（前の訪問と重なる）・
 * 休みの人（休みの人に割り当てた訪問）
 */
export type VisitBandKind = 'unassigned' | 'late' | 'overlap' | 'off';

/** 1つの訪問が複数に当たるときに数える順（休みの人の訪問は働ける時間が無いので間に合わない・重なりは重ねない） */
const PRIORITY: readonly VisitBandKind[] = ['unassigned', 'off', 'late', 'overlap'];

/** 訪問の検査の種類 → 帯の種類（条件に合わない（notAllowed）は帯に数えない：目立たせるのは4つだけ。PRD D384） */
const BAND_OF: Record<IssueKind, VisitBandKind | null> = {
  unassigned: 'unassigned',
  off: 'off',
  late: 'late',
  overlap: 'overlap',
  notAllowed: null,
};

/** 帯に数える種類の検査か（担当なし・間に合わない・重なり・休みの人。条件に合わないは数えない）。訪問の札の目立たせ方（lib/visitLook の exceptionsOnly）も同じ分け方 */
export const isBandIssue = (kind: IssueKind): boolean => BAND_OF[kind] !== null;

/** 1つの訪問を帯のどの種類に数えるか（担当なし → 休みの人 → 間に合わない → 重なり の順で先に当たったもの。条件に合わないだけなら undefined）。来月の確認（lib/nextMonthCheck）も同じ数え方 */
export const visitBandKind = (issues: readonly VisitIssue[]): VisitBandKind | undefined =>
  PRIORITY.find((k) => issues.some((x) => BAND_OF[x.kind] === k));

/**
 * その日の帯の種類の訪問（訪問ID → 種類）。problem を渡すとそれを使い、無ければその日の問題を作る（計算に入れる訪問が無い日は空）。
 * 担当は今の訪問の担当・開始の並び（dayRoutes）
 */
export function dayBandIssues(data: CompileInput, date: string, problem?: Problem | null): Map<string, VisitBandKind> {
  const out = new Map<string, VisitBandKind>();
  const p = problem !== undefined ? problem : dayProblemOf(data, date);
  if (!p || p.visits.length === 0) return out;
  for (const [id, issues] of visitIssues(p, dayRoutes(data, date, p), visitsOn(data, date))) {
    const kind = visitBandKind(issues);
    if (kind) out.set(id, kind);
  }
  return out;
}
