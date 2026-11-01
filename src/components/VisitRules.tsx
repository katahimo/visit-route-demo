import { Car, DoorOpen, KeyRound, TriangleAlert } from 'lucide-react';
import type { Client } from '../contracts/documents';
import { useFeature } from './useFeature';

/** 訪問先の決まりごと（PRD D66。ADR-0013）の見出しとアイコン（入力欄・表示で同じ並び） */
export const VISIT_RULE_FIELDS = [
  { key: 'entryNote', label: '入り方', icon: DoorOpen, placeholder: '例：インターホンを押してから玄関へ' },
  { key: 'keyNote', label: '鍵', icon: KeyRound, placeholder: '例：ポストの中のキーボックス' },
  { key: 'parkingNote', label: '駐車場', icon: Car, placeholder: '例：坂の下の空き地に1台' },
  { key: 'cautionNote', label: '注意', icon: TriangleAlert, placeholder: '例：玄関の段差が高い' },
] as const;

export type VisitRuleKey = (typeof VISIT_RULE_FIELDS)[number]['key'];

/** 訪問先の決まりごとがあるか */
export const hasVisitRules = (c: Pick<Client, VisitRuleKey> | undefined | null): boolean =>
  !!c && VISIT_RULE_FIELDS.some((f) => c[f.key].trim() !== '');

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
