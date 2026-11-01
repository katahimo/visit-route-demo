// 初めての訪問先（PRD D415。ADR-0082）：〈スタッフ〉がその〈利用者さん〉を過去8週に担当していなければ「初めて」。
// 連絡文・日の予定の訪問の詳細・スマホ画面に、決まりごと（D66）を添えるかの判定と、決まりごとの行。純粋関数（データは書き換えない）
import type { DemoData } from '../contracts/data';
import type { Client } from '../contracts/documents';
import { addDays } from '../domain/time';
import { visitsIn } from '../patterns';

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

/** 決まりごとの項目（入り方・鍵・駐車場・注意。D66 の並び） */
const RULES = [
  ['entryNote', '入り方'],
  ['keyNote', '鍵'],
  ['parkingNote', '駐車場'],
  ['cautionNote', '注意'],
] as const;

export type VisitRuleKey = (typeof RULES)[number][0];

export type VisitRuleLine = { label: string; text: string };

/** 決まりごとの行（入っている項目だけ。改行は空白にして1行に） */
export function visitRuleLines(c: Pick<Client, VisitRuleKey> | null | undefined): VisitRuleLine[] {
  if (!c) return [];
  return RULES.filter(([k]) => c[k].trim() !== '').map(([k, label]) => ({
    label,
    text: c[k].trim().replace(/\s*\n\s*/g, ' '),
  }));
}
