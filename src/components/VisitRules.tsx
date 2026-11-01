import { Car, DoorOpen, KeyRound, type LucideIcon, TriangleAlert } from 'lucide-react';
import type { Client } from '../contracts/documents';
import { hasVisitRules, VISIT_RULES, type VisitRuleKey } from '../lib/visitRules';
import { useFeature } from './useFeature';

/** 決まりごとの項目ごとのアイコンと入力の例（項目と名前の並びは lib/visitRules の VISIT_RULES） */
const RULE_VIEW: Record<VisitRuleKey, { icon: LucideIcon; placeholder: string }> = {
  entryNote: { icon: DoorOpen, placeholder: '例：インターホンを押してから玄関へ' },
  keyNote: { icon: KeyRound, placeholder: '例：ポストの中のキーボックス' },
  parkingNote: { icon: Car, placeholder: '例：坂の下の空き地に1台' },
  cautionNote: { icon: TriangleAlert, placeholder: '例：玄関の段差が高い' },
};

/** 訪問先の決まりごと（PRD D66。ADR-0013）の見出しとアイコン（入力欄・表示で同じ並び） */
export const VISIT_RULE_FIELDS = VISIT_RULES.map((r) => ({ ...r, ...RULE_VIEW[r.key] }));

/**
 * 訪問先の決まりごと（入り方・鍵・駐車場・注意）の表示。空の項目は出さず、どれも空なら何も出さない。
 * スタッフ画面の各訪問・日の画面の訪問の詳細に置く。訪問先の決まりごとの機能を切っていれば出さない（ADR-0028）。
 * first（初めての訪問先。PRD D415）なら「初めて」の印を付ける（決まりごとが無い・切っていても印は出す。置き場所は呼ぶ側で先頭に）
 */
export function VisitRules({
  client,
  first = false,
}: {
  client: Pick<Client, VisitRuleKey> | undefined | null;
  first?: boolean;
}) {
  // 訪問先の決まりごと（ADR-0028 の visitNotes）を切っていれば出さない
  const on = useFeature('visitNotes');
  const shown = on && !!client && hasVisitRules(client);
  if (!first) return shown && client ? <RuleList client={client} /> : null;
  return (
    <div className="visit-first" data-testid="visit-first">
      <span className="chip chip-warn">初めて</span>
      <span className="sub">過去8週に担当していない訪問先</span>
      {shown && client && <RuleList client={client} />}
    </div>
  );
}

function RuleList({ client }: { client: Pick<Client, VisitRuleKey> }) {
  return (
    <dl className="visit-rules" data-testid="visit-rules">
      {VISIT_RULE_FIELDS.filter((f) => client[f.key].trim() !== '').map((f) => (
        <div key={f.key} className={`visit-rule${f.key === 'cautionNote' ? ' is-caution' : ''}`}>
          <dt>
            <f.icon size={13} aria-hidden="true" />
            {f.label}
          </dt>
          <dd>{client[f.key]}</dd>
        </div>
      ))}
    </dl>
  );
}
