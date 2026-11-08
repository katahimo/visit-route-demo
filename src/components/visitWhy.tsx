// 訪問の詳細の「組めない理由」の枠（PRD D430。ADR-0098）：担当なしの訪問か、今の担当のほかに選べる人がいないとき、
// 短い理由・内訳・直し方の案内・［直す画面］のリンク（lib/unassignedReason。切った機能の行き先は出さない）
import { CircleHelp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { linkIfOn } from '../lib/links';
import type { UnassignedReason } from '../lib/unassignedReason';
import type { StaffChoices } from '../lib/visitStaff';
import { useDemoData } from '../store';
import { Term } from './Term';
import { WithIcon } from './ui';

/**
 * 訪問の詳細の担当の候補（staffChoices）に組めない理由があれば枠を出す（担当なし・ほかに選べる人がいない。日時を変えれば
 * その日時で計算し直したもの）
 */
export function VisitWhy({ choices, onLeave }: { choices: StaffChoices | null; onLeave: () => void }) {
  if (!choices?.blocked) return null;
  return <VisitWhyBox reason={choices.blocked} owned={choices.currentStaffId !== null} onLeave={onLeave} />;
}

function VisitWhyBox({
  reason,
  owned,
  onLeave,
}: {
  reason: UnassignedReason;
  /** 今の担当がいる（ほかの人に替えられない理由として出す） */
  owned: boolean;
  /** リンクで画面を移るとき（欄を閉じる） */
  onLeave: () => void;
}) {
  const { data } = useDemoData();
  const links = reason.links.filter((l) => linkIfOn(data.org.features, l.to) !== null);
  return (
    <section className="vp-why" aria-label={owned ? 'ほかに替えられない理由' : '組めない理由'} data-testid="vp-why">
      <WithIcon icon={CircleHelp} size={16}>
        <strong>{owned ? 'ほかに替えられない理由' : <Term k="unassignedWhy" />}</strong>
        <span className="vp-why-label" data-testid="vp-why-label">
          {reason.label}
        </span>
      </WithIcon>
      {reason.summary !== reason.label && (
        <p className="sub" data-testid="vp-why-summary">
          {reason.summary}
        </p>
      )}
      <p className="vp-why-guide" data-testid="vp-why-guide">
        {reason.guide}
      </p>
      {links.length > 0 && (
        <p className="row vp-why-links">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="btn btn-small" onClick={onLeave} data-testid="vp-why-link">
              {l.label}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}
