// 〈利用者さん〉一覧の表（PRD D220・D308）：1人1行（狭い画面ではカード）。行のどこを押してもその人の画面へ、右端は「開く」
import { Eye, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CondChips, TraitChips } from '../components/conditions';
import { TentativeMark } from '../components/parts';
import { StaffMarkById } from '../components/StaffMark';
import type { DemoData } from '../contracts/data';
import type { Client, Staff } from '../contracts/documents';
import type { Item } from '../contracts/rules';
import { leaveOn } from '../domain/leaves';
import { jstDate } from '../domain/time';
import { STAGE_LABELS } from '../lib/clientStage';
import { colorOf, initialOf } from '../lib/colors';
import { hasLocation } from '../lib/common';
import { narrowRole } from '../lib/narrowRoles';
import { formatPostalCode } from '../lib/postalCode';
import { shouldOpenRow } from '../lib/rowOpen';

/** どの行でも同じもの */
type RowContext = {
  data: DemoData;
  stageOn: boolean;
  allowedOn: boolean;
  clientItems: Item[];
  itemById: Map<string, Item>;
  usualMap: ReadonlyMap<string, string>;
  staffName: (id: string | null) => string;
  today: string;
  onOpen: (c: Client) => void;
};

export function ClientsTable({
  shown,
  data,
  staff,
  usualMap,
  stageOn,
  allowedOn,
  onOpen,
}: {
  shown: Client[];
  data: DemoData;
  /** 名前の順の〈スタッフ〉 */
  staff: Staff[];
  /** 〈利用者さん〉ID → いつもの担当 */
  usualMap: ReadonlyMap<string, string>;
  stageOn: boolean;
  allowedOn: boolean;
  /** 行を押したとき（その人の画面へ） */
  onOpen: (c: Client) => void;
}) {
  const terms = data.org.terms;
  const staffName = (id: string | null) => (id ? (staff.find((s) => s.id === id)?.name ?? '（不明）') : '');
  const ctx: RowContext = {
    data,
    stageOn,
    allowedOn,
    clientItems: data.items.filter((i) => i.target === 'client'),
    itemById: new Map(data.items.map((i) => [i.id, i])),
    usualMap,
    staffName,
    today: jstDate(Date.now()),
    onOpen,
  };
  return (
    <table {...narrowRole.table} className="people-table narrow-cards" data-testid="narrow-clients">
      <thead {...narrowRole.rowgroup}>
        <tr {...narrowRole.row}>
          <th {...narrowRole.columnheader}>名前</th>
          <th {...narrowRole.columnheader}>位置</th>
          <th {...narrowRole.columnheader}>特性</th>
          <th {...narrowRole.columnheader}>{terms.staff}に求めること</th>
          <th {...narrowRole.columnheader}>いつもの担当</th>
          <th {...narrowRole.columnheader}>状態</th>
          <th {...narrowRole.columnheader} aria-label="操作" />
        </tr>
      </thead>
      <tbody {...narrowRole.rowgroup}>
        {shown.length === 0 && (
          <tr {...narrowRole.row}>
            <td {...narrowRole.cell} colSpan={7} className="sub">
              当てはまる{terms.client}がいません
            </td>
          </tr>
        )}
        {shown.map((c) => (
          <ClientsRow key={c.id} c={c} ctx={ctx} />
        ))}
      </tbody>
    </table>
  );
}

function ClientsRow({ c, ctx }: { c: Client; ctx: RowContext }) {
  const { data, stageOn, allowedOn, clientItems, itemById, usualMap, staffName, today, onOpen } = ctx;
  const terms = data.org.terms;
  return (
    <tr
      {...narrowRole.row}
      data-testid="client-row"
      className="row-open"
      // 行のどこを押してもその人の画面へ（PRD D308。ボタン・リンク・文字の選択は除く。キーボードは右端の「開く」）
      onClick={(e) => {
        const ok = shouldOpenRow({
          target: e.target as Element,
          row: e.currentTarget,
          selection: window.getSelection()?.toString() ?? '',
          detail: e.detail,
        });
        if (!ok) return;
        onOpen(c);
      }}
    >
      <td {...narrowRole.cell} className="narrow-title" data-label="名前">
        <span className="row person-name">
          <span className="dot dot-sm" style={{ background: colorOf(c.color) }}>
            {initialOf(c.displayName)}
          </span>
          <span className="person-main">
            <span className="row" style={{ gap: 6 }}>
              {c.displayName}
              {c.tentative && <TentativeMark />}
            </span>
            {c.kana && <small className="person-sub">{c.kana}</small>}
            {(c.place.address || c.place.postalCode) && (
              <small className="person-sub">
                {c.place.postalCode && `〒${formatPostalCode(c.place.postalCode)} `}
                {c.place.address}
              </small>
            )}
            {stageOn && c.referrer.name && <small className="person-sub">紹介元：{c.referrer.name}</small>}
          </span>
        </span>
      </td>
      <td {...narrowRole.cell} data-label="位置">
        {hasLocation(c.place) ? (
          <span className="chip chip-ok" title="位置あり">
            <MapPin size={13} strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">あり</span>
          </span>
        ) : (
          <span className="chip chip-warn">未登録</span>
        )}
      </td>
      <td {...narrowRole.cell} data-label="特性">
        <TraitChips traits={c.traits} items={clientItems} />
      </td>
      <td {...narrowRole.cell} className="cond-cell" data-label={`${terms.staff}に求めること`}>
        <CondChips requirements={c.requirements} preferences={c.preferences} itemById={itemById} />
      </td>
      <td {...narrowRole.cell} className="nowrap" data-label="いつもの担当">
        {usualMap.get(c.id) && (
          <span className="with-staff-mark">
            <StaffMarkById id={usualMap.get(c.id)!} size="xs" />
            {staffName(usualMap.get(c.id)!)}
          </span>
        )}
        {allowedOn && c.allowedStaffIds.length > 0 && (
          <span
            className="chip chip-limit"
            title={`担当できる人を限っています：${c.allowedStaffIds.map(staffName).join('、')}`}
            data-testid="client-limit"
          >
            <ShieldCheck size={13} aria-hidden="true" />限{' '}
            {c.allowedStaffIds.map((id) => staffName(id).split(/\s+/)[0]).join('、')}
          </span>
        )}
      </td>
      <td {...narrowRole.cell} className="narrow-head" data-label="状態">
        <span className={`chip stage-chip is-${c.stage}`} data-testid="client-stage">
          {STAGE_LABELS[c.stage]}
        </span>
        {c.tentative && <span className="chip chip-warn">仮押さえ</span>}
        {leaveOn(data.clientLeaves, c.id, today) && (
          <span className="chip chip-warn" title={leaveOn(data.clientLeaves, c.id, today)?.note || undefined}>
            休み中
          </span>
        )}
      </td>
      <td {...narrowRole.cell} className="narrow-act">
        <Link
          className="icon-btn tone-plain"
          to={`/clients/${encodeURIComponent(c.id)}`}
          title={`${c.displayName}を開く`}
          aria-label={`${c.displayName}を開く`}
          data-testid="client-open"
        >
          <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}
