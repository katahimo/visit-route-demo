// 〈スタッフ〉一覧の部品（PRD D71・D220・D308。ADR-0015）：最終勤務日のある人の枠と、一覧の1行（狭い画面ではカード）
import { CalendarX, Clock, Eye, MapPin, Smartphone, UserRoundCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CondChips, TraitChips } from '../components/conditions';
import { StaffMark } from '../components/StaffMark';
import { WithIcon } from '../components/ui';
import type { Staff } from '../contracts/documents';
import type { Item } from '../contracts/rules';
import { hasLocation, WEEKDAY_LABELS } from '../lib/common';
import { mdText } from '../lib/dateText';
import { narrowRole } from '../lib/narrowRoles';
import { type StaffCol, shiftText, staffNameNote, workDaysText } from '../lib/peopleView';
import { shouldOpenRow } from '../lib/rowOpen';

/** 最終勤務日のある人と、振り直しが残っているもの（〈利用者さん〉の人数・訪問の件数） */
export type StaffLeaving = { staff: Staff; clients: number; visits: number };

/** 最終勤務日のある〈スタッフ〉の枠（振り直しの欄を開く） */
export function StaffLeavingCard({
  leaving,
  terms,
  onOpen,
}: {
  leaving: StaffLeaving[];
  terms: { client: string; staff: string };
  onOpen: (staffId: string) => void;
}) {
  return (
    <div className="card stack leaving-card" data-testid="leaving-card">
      <strong>
        <WithIcon icon={CalendarX} size={16}>
          最終勤務日のある{terms.staff}
        </WithIcon>
      </strong>
      <ul className="leaving-list">
        {leaving.map((x) => (
          <li key={x.staff.id}>
            <span>
              {x.staff.name}さん：最終勤務日 {mdText(x.staff.lastDay ?? '')}
            </span>
            <span className="sub">
              {x.clients > 0 || x.visits > 0
                ? `振り直しが残っています（${terms.client} ${x.clients}人・担当の訪問 ${x.visits}件）`
                : '振り直しは済んでいます'}
            </span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onOpen(x.staff.id)}
              data-testid="leaving-open"
            >
              <WithIcon icon={UserRoundCog} size={14}>
                担当の振り直しを開く
              </WithIcon>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 列の見出し（呼び名は org.terms から） */
const COL_LABEL: Record<StaffCol, (clientTerm: string) => string> = {
  name: () => '名前',
  days: () => '勤務日',
  hours: () => '勤務時間',
  work: () => '勤務',
  traits: () => '特性',
  requires: (client) => `${client}に求めること`,
  home: () => '自宅の位置',
  state: () => '状態',
};

/** 一覧の見出しの行 */
export function StaffHead({ cols, clientTerm }: { cols: readonly StaffCol[]; clientTerm: string }) {
  return (
    <tr {...narrowRole.row}>
      {cols.map((col) => (
        <th key={col} {...narrowRole.columnheader}>
          {COL_LABEL[col](clientTerm)}
        </th>
      ))}
      <th {...narrowRole.columnheader} aria-label="操作" />
    </tr>
  );
}

/** 1つの列のセル（列の種類ごとの分岐はここに集める） */
function StaffCell({
  col,
  cols,
  s,
  clientTerm,
  staffItems,
  itemById,
}: {
  col: StaffCol;
  cols: readonly StaffCol[];
  s: Staff;
  clientTerm: string;
  staffItems: Item[];
  itemById: Map<string, Item>;
}) {
  switch (col) {
    case 'name':
      return (
        <td {...narrowRole.cell} className="person-name narrow-title" data-label="名前">
          <span className="with-staff-mark">
            <StaffMark staff={s} size="md" />
            {s.name}
            {/* 切は状態の列を出さないので、例外の休止中だけ名前のそばに残す */}
            {staffNameNote(s, cols) && <span className="chip">{staffNameNote(s, cols)}</span>}
          </span>
        </td>
      );
    case 'days':
      return (
        <td {...narrowRole.cell} className="nowrap" data-label="勤務日" data-testid="staff-days">
          {workDaysText(s)}
        </td>
      );
    case 'hours':
      return (
        <td {...narrowRole.cell} className="nowrap" data-label="勤務時間" data-testid="staff-hours">
          {shiftText(s)}
        </td>
      );
    case 'work':
      return (
        <td {...narrowRole.cell} className="nowrap" data-label="勤務">
          <WithIcon icon={Clock} size={14}>
            {s.workDays.map((d) => WEEKDAY_LABELS[d]).join('')} {s.shiftStart}〜{s.shiftEnd}
          </WithIcon>
        </td>
      );
    case 'traits':
      return (
        <td {...narrowRole.cell} data-label="特性">
          <TraitChips traits={s.traits} items={staffItems} />
        </td>
      );
    case 'requires':
      return (
        <td {...narrowRole.cell} className="cond-cell" data-label={`${clientTerm}に求めること`}>
          <CondChips requirements={s.requirements} preferences={s.preferences} itemById={itemById} />
        </td>
      );
    case 'home':
      return (
        <td {...narrowRole.cell} data-label="自宅の位置">
          {hasLocation(s.home) ? (
            <span className="chip chip-ok">
              <WithIcon icon={MapPin} size={13}>
                あり
              </WithIcon>
            </span>
          ) : (
            <span className="chip chip-warn">未登録</span>
          )}
        </td>
      );
    case 'state':
      return (
        <td {...narrowRole.cell} className="narrow-head" data-label="状態">
          {!s.active && <span className="chip">休止中</span>}
          {s.lastDay && (
            <span
              className="chip chip-lastday"
              title={`最終勤務日 ${s.lastDay}（翌日から勤務なし）`}
              data-testid="staff-lastday"
            >
              最終 {mdText(s.lastDay)}
            </span>
          )}
        </td>
      );
    default: {
      const _: never = col;
      return _;
    }
  }
}

/** 一覧の1行（行のどこを押してもその人の画面へ） */
export function StaffRow({
  s,
  cols,
  clientTerm,
  staffItems,
  itemById,
  onOpen,
}: {
  s: Staff;
  /** 出す列（切は名前・勤務日・勤務時間。lib/peopleView） */
  cols: readonly StaffCol[];
  clientTerm: string;
  /** 〈スタッフ〉の項目（特性のチップ） */
  staffItems: Item[];
  itemById: Map<string, Item>;
  /** その人の画面へ移る */
  onOpen: () => void;
}) {
  return (
    <tr
      {...narrowRole.row}
      data-testid="staff-row"
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
        onOpen();
      }}
    >
      {cols.map((col) => (
        <StaffCell
          key={col}
          col={col}
          cols={cols}
          s={s}
          clientTerm={clientTerm}
          staffItems={staffItems}
          itemById={itemById}
        />
      ))}
      <td {...narrowRole.cell} className="nowrap narrow-act">
        <div className="actions">
          <Link
            className="icon-btn tone-plain"
            to={`/staff/${encodeURIComponent(s.id)}`}
            title={`${s.name}を開く`}
            aria-label={`${s.name}を開く`}
            data-testid="staff-open"
          >
            <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
          </Link>
          <Link
            className="icon-btn tone-plain"
            to={`/staff-view/${s.id}`}
            title={`${s.name}さんの画面で見る`}
            aria-label={`${s.name}さんの画面で見る`}
          >
            <Smartphone size={16} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>
      </td>
    </tr>
  );
}
