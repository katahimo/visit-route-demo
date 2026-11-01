// 訪問先の決まりごと（PRD D66。ADR-0013）の項目と名前の並び（入り方・鍵・駐車場・注意）。入力欄・表示・連絡文・日の予定のメールで同じ並びを使う。
// 純粋関数（データは書き換えない）
import type { Client } from '../contracts/documents';

/** 決まりごとの項目（D66 の並び） */
export const VISIT_RULES = [
  { key: 'entryNote', label: '入り方' },
  { key: 'keyNote', label: '鍵' },
  { key: 'parkingNote', label: '駐車場' },
  { key: 'cautionNote', label: '注意' },
] as const;

export type VisitRuleKey = (typeof VISIT_RULES)[number]['key'];

export type VisitRuleLine = { label: string; text: string };

/** 訪問先の決まりごとがあるか */
export const hasVisitRules = (c: Pick<Client, VisitRuleKey> | undefined | null): boolean =>
  !!c && VISIT_RULES.some((r) => c[r.key].trim() !== '');

/** 決まりごとの行（入っている項目だけ。改行は空白にして1行に）。includeKeys が false なら鍵を入れない */
export function visitRuleLines(c: Pick<Client, VisitRuleKey> | null | undefined, includeKeys = true): VisitRuleLine[] {
  if (!c) return [];
  return VISIT_RULES.filter((r) => (includeKeys || r.key !== 'keyNote') && c[r.key].trim() !== '').map((r) => ({
    label: r.label,
    text: oneLine(c[r.key]),
  }));
}

/** 改行は空白にして1行に（前後の空白も落とす） */
export const oneLine = (s: string): string => s.trim().replace(/\s*\n\s*/g, ' ');
