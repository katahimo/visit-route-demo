// 退職・担当替えの一括振り直し（PRD D71。ADR-0015）の欄の区画：〈利用者さん〉ごとの代わりの表・最終勤務日の後の訪問の日の一覧。
// 状態と処理は useOffboardFlow
import { CalendarDays } from 'lucide-react';
import { PersonButton } from '../components/PersonPopover';
import { WithIcon } from '../components/ui';
import type { Client, Staff } from '../contracts/documents';
import { addDays } from '../domain/time';
import { dateText, mdText, monthLabel } from '../lib/dateText';
import type { OffboardClient } from '../lib/offboard';
import {
  offboardAddsAllowedText,
  offboardCandidateText,
  offboardOutsideAllowedText,
  offboardRolesText,
} from '../lib/offboardView';
import { NOBODY } from './useOffboardFlow';

/** 〈利用者さん〉ごとの代わりの〈スタッフ〉を選ぶ表 */
export function OffboardClientsTable({
  staffId,
  clients,
  choices,
  onChoices,
  staffById,
  clientById,
  limitsOn,
  terms,
}: {
  /** 退職する人 */
  staffId: string;
  clients: readonly OffboardClient[];
  /** 〈利用者さん〉ID → 選んだ人（'' はだれにもしない） */
  choices: Record<string, string>;
  onChoices: (choices: Record<string, string>) => void;
  staffById: ReadonlyMap<string, Staff>;
  clientById: ReadonlyMap<string, Client>;
  /** 機能「担当を限る」が入か */
  limitsOn: boolean;
  terms: { client: string; staff: string };
}) {
  return (
    <div className="table-scroll">
      <table className="people-table offboard-table" data-testid="offboard-clients">
        <thead>
          <tr>
            <th scope="col">{terms.client}</th>
            <th scope="col">いまの持ち方</th>
            <th scope="col">代わりの{terms.staff}</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const value = choices[c.clientId] ?? NOBODY;
            const client = clientById.get(c.clientId);
            const chosen = staffById.get(value);
            const to = chosen ? { id: chosen.id, name: chosen.name } : null;
            const adds = client && limitsOn && offboardAddsAllowedText(client, staffId, to);
            const outside = client && offboardOutsideAllowedText(client, staffId, to, limitsOn);
            return (
              <tr key={c.clientId} data-testid="offboard-client">
                <th scope="row" className="person-name">
                  {/* 名前から詳細（select の option には置けないので行の見出しだけ。PRD D208） */}
                  <PersonButton
                    kind="client"
                    id={c.clientId}
                    name={clientById.get(c.clientId)?.displayName ?? ''}
                    testId="offboard-client-name"
                  />
                </th>
                <td className="nowrap">{offboardRolesText(c)}</td>
                <td>
                  <select
                    value={value}
                    onChange={(e) => onChoices({ ...choices, [c.clientId]: e.target.value })}
                    aria-label={`${clientById.get(c.clientId)?.displayName ?? ''}の代わりの${terms.staff}`}
                    data-testid="offboard-choice"
                  >
                    {c.candidates.map((x) => (
                      <option key={x.staffId} value={x.staffId}>
                        {staffById.get(x.staffId)?.name ?? ''}
                        {offboardCandidateText(c, x)}
                      </option>
                    ))}
                    <option value={NOBODY}>（だれにもしない）</option>
                  </select>
                  {adds && (
                    <p className="sub" data-testid="offboard-adds-allowed">
                      {adds}
                    </p>
                  )}
                  {outside && (
                    <p className="sub" data-testid="offboard-outside-allowed">
                      {outside}
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 最終勤務日の後の訪問の日の一覧（押すとその日の予定へ）と、月の予定を開くボタン */
export function OffboardVisitDays({
  byDate,
  lastDay,
  from,
  onOpenDay,
  onOpenMonth,
}: {
  byDate: readonly [string, { count: number; confirmed: number }][];
  lastDay: string;
  from: string;
  onOpenDay: (date: string) => void;
  onOpenMonth: () => void;
}) {
  return (
    <>
      <p className="sub">
        この訪問は{mdText(addDays(lastDay, 1))}
        から「担当が休み」の要対応になります。「まとめて適用」で担当を替えるか、日の予定で直してください。
      </p>
      <button type="button" className="btn btn-small" onClick={onOpenMonth}>
        <WithIcon icon={CalendarDays} size={14}>
          {monthLabel(from)}の「月の予定」を開く
        </WithIcon>
      </button>
      <ul className="offboard-days" data-testid="offboard-visits">
        {byDate.map(([d, x]) => (
          <li key={d}>
            <button type="button" className="offboard-day-btn" onClick={() => onOpenDay(d)}>
              <span>{dateText(d)}</span>
              <span>
                {x.count}件{x.confirmed > 0 ? `（確定 ${x.confirmed}件）` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
