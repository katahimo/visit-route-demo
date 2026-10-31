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
import { addressCellText, type ClientCol, clientColumns, clientNameNote, usualPlanText } from '../lib/peopleView';
import { shouldOpenRow } from '../lib/rowOpen';
import { orDash } from '../lib/viewMode';

/** どの行でも同じもの */
type RowContext = {
  data: DemoData;
  /** 出す列（名前・住所・いつもの予定の3列と、くわしい列。lib/peopleView） */
  cols: readonly ClientCol[];
  /** くわしい列を出しているか（名前の下によみ・紹介元を添える） */
  detailed: boolean;
  /** 入か（住所の列に〒郵便番号を添える） */
  expert: boolean;
  stageOn: boolean;
  allowedOn: boolean;
  clientItems: Item[];
  itemById: Map<string, Item>;
  usualMap: ReadonlyMap<string, string>;
  staffName: (id: string | null) => string;
  today: string;
  onOpen: (c: Client) => void;
};

/** 列の見出し（呼び名は org.terms から） */
const COL_LABEL: Record<ClientCol, (staffTerm: string) => string> = {
  name: () => '名前',
  address: () => '住所',
  plan: () => 'いつもの予定',
  place: () => '位置',
  traits: () => '特性',
  requires: (staff) => `${staff}に求めること`,
  usual: () => 'いつもの担当',
  state: () => '状態',
};

export function ClientsTable({
  shown,
  data,
  staff,
  usualMap,
  stageOn,
  allowedOn,
  detailed,
  expert,
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
  /** くわしい列を出しているか（入で切り替えを入れたとき。PRD D394） */
  detailed: boolean;
  /** エキスパート機能が入か（住所の列に〒郵便番号を添える） */
  expert: boolean;
  /** 行を押したとき（その人の画面へ） */
  onOpen: (c: Client) => void;
}) {
  const terms = data.org.terms;
  const staffName = (id: string | null) => (id ? (staff.find((s) => s.id === id)?.name ?? '（不明）') : '');
  const cols = clientColumns(detailed);
  const ctx: RowContext = {
    data,
    cols,
    detailed,
    expert,
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
          {cols.map((col) => (
            <th key={col} {...narrowRole.columnheader}>
              {COL_LABEL[col](terms.staff)}
            </th>
          ))}
          <th {...narrowRole.columnheader} aria-label="操作" />
        </tr>
      </thead>
      <tbody {...narrowRole.rowgroup}>
        {shown.length === 0 && (
          <tr {...narrowRole.row}>
            <td {...narrowRole.cell} colSpan={cols.length + 1} className="sub">
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
  const { cols, onOpen } = ctx;
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
      {cols.map((col) => (
        <ClientCell key={col} col={col} c={c} ctx={ctx} />
      ))}
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

/** 名前のセル（色の丸・名前・仮の印。くわしい列を出しているときはよみ・紹介元も添える） */
function NameCell({ c, ctx }: { c: Client; ctx: RowContext }) {
  return (
    <td {...narrowRole.cell} className="narrow-title" data-label="名前">
      <span className="row person-name">
        <span className="dot dot-sm" style={{ background: colorOf(c.color) }}>
          {initialOf(c.displayName)}
        </span>
        <span className="person-main">
          <span className="row" style={{ gap: 6 }}>
            {c.displayName}
            {c.tentative && <TentativeMark />}
            {/* 状態の列を出さないときは、例外の休み中を名前のそばに残す */}
            {clientNameNote(!!leaveOn(ctx.data.clientLeaves, c.id, ctx.today), ctx.cols) && (
              <span className="chip chip-warn">休み中</span>
            )}
          </span>
          {ctx.detailed && c.kana && <small className="person-sub">{c.kana}</small>}
          {ctx.stageOn && ctx.detailed && c.referrer.name && (
            <small className="person-sub">紹介元：{c.referrer.name}</small>
          )}
        </span>
      </span>
    </td>
  );
}

/** 担当できる人を限る印つきのいつもの担当 */
function UsualCell({ c, ctx }: { c: Client; ctx: RowContext }) {
  const { allowedOn, usualMap, staffName } = ctx;
  return (
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
  );
}

/** 状態のセル（段階・仮押さえ・休み中） */
function StateCell({ c, ctx }: { c: Client; ctx: RowContext }) {
  const { data, today } = ctx;
  return (
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
  );
}

/** 1つの列のセル（列の種類ごとの分岐はここに集める） */
function ClientCell({ col, c, ctx }: { col: ClientCol; c: Client; ctx: RowContext }) {
  const { data, clientItems, itemById } = ctx;
  const terms = data.org.terms;
  switch (col) {
    case 'name':
      return <NameCell c={c} ctx={ctx} />;
    case 'address':
      return (
        <td {...narrowRole.cell} data-label="住所" data-testid="client-address">
          {orDash(addressCellText(c.place, ctx.expert))}
        </td>
      );
    case 'plan':
      return (
        <td {...narrowRole.cell} data-label="いつもの予定" data-testid="client-plan">
          {orDash(usualPlanText(data.patterns, c.id, ctx.today))}
        </td>
      );
    case 'place':
      return (
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
      );
    case 'traits':
      return (
        <td {...narrowRole.cell} data-label="特性">
          <TraitChips traits={c.traits} items={clientItems} />
        </td>
      );
    case 'requires':
      return (
        <td {...narrowRole.cell} className="cond-cell" data-label={`${terms.staff}に求めること`}>
          <CondChips requirements={c.requirements} preferences={c.preferences} itemById={itemById} />
        </td>
      );
    case 'usual':
      return <UsualCell c={c} ctx={ctx} />;
    case 'state':
      return <StateCell c={c} ctx={ctx} />;
    default: {
      const _: never = col;
      return _;
    }
  }
}
