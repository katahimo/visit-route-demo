// 初めての訪問先（PRD D415。ADR-0082）：〈スタッフ〉がその〈利用者さん〉を過去8週に担当していなければ「初めて」。
// 欠勤・キャンセルの欄の連絡文に決まりごと（D66。lib/visitRules）を添えるか、日の予定の訪問の詳細・スマホ画面に「初めて」の印を付けるかの判定。
// 純粋関数（データは書き換えない）
import type { DemoData } from '../contracts/data';
import type { Client } from '../contracts/documents';
import { addDays } from '../domain/time';
import { visitsIn } from '../patterns';
import { type VisitRuleKey, type VisitRuleLine, visitRuleLines } from './visitRules';

/** 担当の履歴を見る長さ（週） */
export const FIRST_VISIT_WEEKS = 8;

/** 過去に担当した組（〈利用者さん〉と〈スタッフ〉）。isFirstVisit で引く */
export type ServedPairs = ReadonlySet<string>;

const pairKey = (clientId: string, staffId: string) => `${clientId}\n${staffId}`;

/**
 * date の前日から8週さかのぼった間に、取り消していない訪問で担当した組（保存した回と繰り返しの回。lib/visitLists と同じ visitsIn）
 */
export function servedPairsBefore(data: Pick<DemoData, 'visits' | 'patterns' | 'clients'>, date: string): ServedPairs {
  const out = new Set<string>();
  const from = addDays(date, -7 * FIRST_VISIT_WEEKS);
  for (const v of visitsIn(data, { from, to: addDays(date, -1) }))
    if (!v.cancelled && v.staffId) out.add(pairKey(v.clientId, v.staffId));
  return out;
}

/** その〈スタッフ〉がその〈利用者さん〉を過去8週に担当していないか（初めて） */
export const isFirstVisit = (served: ServedPairs, clientId: string, staffId: string): boolean =>
  !served.has(pairKey(clientId, staffId));

/**
 * 初めての訪問先に添える決まりごと（D415。欠勤・キャンセルの欄の連絡文の「お願いします」の行）：初めてなら決まりごとの行
 * （入っている項目だけ。決まりごとを切っていれば空＝印だけ）、過去8週に担当していれば null
 */
export function firstVisitNotes(
  served: ServedPairs,
  x: { clientId: string; staffId: string; client: Pick<Client, VisitRuleKey> | undefined; notesOn: boolean },
): VisitRuleLine[] | null {
  if (!isFirstVisit(served, x.clientId, x.staffId)) return null;
  return x.notesOn ? visitRuleLines(x.client) : [];
}
