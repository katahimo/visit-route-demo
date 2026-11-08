// 提案の1日の変わる訪問の一覧（PRD D350・D356）：範囲の提案の帯で使う
import { ArrowRight } from 'lucide-react';
import type { DemoData } from '../contracts/data';
import { minutesToHhmm } from '../domain/time';
import { dateText } from '../lib/dateText';
import { type ProposalChange, type ProposalDay, proposalDayChanges } from '../lib/monthBatch';

/** 時刻の差の文（「30分遅く」「15分早く」） */
const shiftText = (minutes: number) => `${Math.abs(minutes)}分${minutes > 0 ? '遅く' : '早く'}`;

/**
 * 提案の1日の変わる訪問の一覧：提案での開始・〈利用者さん〉と、担当が変わる訪問は「今の担当 → 提案の担当」、
 * 時刻が変わる訪問は「担当 今の開始 → 提案の開始」。反映する前に誰の訪問がどう変わるかを見て決められるように
 */
export function ProposalChanges({
  data,
  day,
}: {
  data: DemoData;
  day: Pick<ProposalDay, 'date' | 'problem' | 'routes' | 'diff'>;
}) {
  const rows = proposalDayChanges(day);
  if (rows.length === 0) return null;
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.displayName ?? '（不明）';
  const who = (id: string | null) =>
    id === null ? '担当なし' : `${data.staff.find((s) => s.id === id)?.name ?? '（不明）'}さん`;
  const change = (r: ProposalChange) =>
    r.kind === 'staff' ? (
      <>
        {who(r.from)}
        <ArrowRight size={14} aria-hidden="true" />
        <span className="sr-only">から</span>
        <strong>{who(r.to)}</strong>
      </>
    ) : (
      <>
        {who(r.to)} {minutesToHhmm(r.at - r.minutes)}
        <ArrowRight size={14} aria-hidden="true" />
        <span className="sr-only">から</span>
        <strong>{minutesToHhmm(r.at)}</strong>（{shiftText(r.minutes)}）
      </>
    );
  return (
    <ul className="proposal-changes" aria-label={`${dateText(day.date)}の変わる訪問`} data-testid="proposal-changes">
      {rows.map((r) => (
        <li
          key={r.visitId}
          className={`proposal-change${r.kind === 'staff' && r.to === null ? ' is-unplaced' : ''}`}
          data-testid="proposal-change"
          data-kind={r.kind}
        >
          <span className="proposal-change-visit">
            {minutesToHhmm(r.at)} {clientName(r.clientId)}さん
          </span>
          <span className="proposal-change-who">{change(r)}</span>
        </li>
      ))}
    </ul>
  );
}
