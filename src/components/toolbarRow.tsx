// 予定の操作の行（入切とも。PRD D384・D402。ADR-0073・ADR-0074）：主ボタン1つ＋ボタン1つまで、ほかは「その他 ▾」へ。
// どのボタンを残すかは lib/exceptionView の mainTools（入と切の差はそこの1か所）。
// 切：日は「予定を入れる」（その日の訪問の欄を開く）が主ボタン（スマホは出さず主ボタン無し）、週・月は「予定を入れる」（引き出しは AddPlanPanel。PRD D402）。
// もう1つは「欠勤・キャンセルを登録」。担当なしを組むは要対応の帯（PRD D403。ADR-0077）。
// 入：月・週は「予定を入れる」＋「担当を組む」（担当を組むの画面へ）、日は「予定を入れる」＋「確定（伝えた）」。欠勤・キャンセルは「その他 ▾」の中
import { Plus, Sparkles } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { ADD_VISIT_LABEL, mainTools, type ScheduleZoom } from '../lib/exceptionView';
import { AddPlanPanel } from './AddPlanPanel';
import { MenuButton, type MenuItem } from './MenuButton';
import { WithIcon } from './ui';
import { useHistoryMenuItems } from './undo';

/** 欠勤・キャンセルを登録：切は操作の行のボタン（node）、入は「その他 ▾」の項目（item） */
export type AbsenceTool = { node: ReactNode; item: MenuItem };

/** 日の「予定を入れる」（押せない理由があれば why。スマホは null＝ボタンにしない） */
export type AddTool = { onClick: () => void; why: string | false };

export function ToolbarRow({
  zoom,
  className,
  expert,
  absence,
  add,
  assignHref,
  confirm,
  moreItems,
  after,
}: {
  zoom: ScheduleZoom;
  className: string;
  /** エキスパート機能が入か（入は 担当を組む・確定（伝えた）を出し、欠勤・キャンセルは「その他 ▾」） */
  expert: boolean;
  /** 「欠勤・キャンセルを登録」（無ければ null） */
  absence: AbsenceTool | null;
  add: AddTool | null;
  /** 入の「担当を組む」の行き先（担当を組むの画面。切った機能・切のときは null） */
  assignHref: string | null;
  /** 入の日の「確定（伝えた）」のボタン（出さないときは null） */
  confirm: ReactNode;
  /** 画面ごとの「その他 ▾」の項目（表示の切り替え・使い方・印刷など） */
  moreItems: MenuItem[];
  after?: ReactNode;
}) {
  const history = useHistoryMenuItems();
  const [adding, setAdding] = useState(false);
  const { primary, second } = mainTools(
    zoom,
    {
      add: add !== null,
      plan: true,
      absence: !expert && absence !== null,
      assign: expert && assignHref !== null,
      confirm: expert && confirm !== null && confirm !== false,
    },
    expert,
  );
  const items = [...moreItems, ...history, ...(expert && absence ? [absence.item] : [])];
  return (
    <div className={`row schedule-toolbar is-simple ${className}`} data-testid="schedule-toolbar" data-zoom={zoom}>
      {primary === 'add' && add && (
        <button
          type="button"
          className="btn btn-primary tb-keep-label"
          onClick={() => {
            if (add.why === false) add.onClick();
          }}
          aria-disabled={add.why !== false || undefined}
          title={add.why || undefined}
          data-testid="plan-visit-add"
        >
          <WithIcon icon={Plus}>
            <span className="tb-label">{ADD_VISIT_LABEL}</span>
          </WithIcon>
        </button>
      )}
      {primary === 'plan' && (
        <button
          type="button"
          className="btn btn-primary tb-keep-label"
          onClick={() => setAdding(true)}
          data-testid="toolbar-add-plan"
        >
          <WithIcon icon={Plus}>
            <span className="tb-label">予定を入れる</span>
          </WithIcon>
        </button>
      )}
      {(primary === 'confirm' || second === 'confirm') && confirm}
      {second === 'assign' && assignHref && (
        <Link
          to={assignHref}
          className="btn"
          title="範囲を選んで AI で担当を組む画面を開く"
          data-testid="toolbar-assign"
        >
          <WithIcon icon={Sparkles}>
            <span className="tb-label">担当を組む</span>
          </WithIcon>
        </Link>
      )}
      {second === 'absence' && absence?.node}
      <MenuButton
        label="その他"
        items={items}
        testId={`${zoom === 'day' ? 'plan' : zoom}-more`}
        className="plan-more"
      />
      {after}
      {adding && <AddPlanPanel onClose={() => setAdding(false)} />}
    </div>
  );
}
