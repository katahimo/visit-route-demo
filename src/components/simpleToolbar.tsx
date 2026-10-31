// 予定の操作の行（エキスパート機能が切のとき。PRD D384。ADR-0073）：主ボタン1つ＋ボタン1つまで、ほかは「その他 ▾」へ。
// どのボタンを残すかは lib/exceptionView の mainTools。日は「訪問を追加」（言葉は「予定を入れる」。addVisitLabel）が主ボタン（スマホは出さず主ボタン無し）、
// 週・月は「予定を入れる」が主ボタン（引き出しは AddPlanPanel。PRD D402）。もう1つは「欠勤・キャンセルを登録」。担当なしを組むは要対応の帯（PRD D403）
import { Plus } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { addVisitLabel, mainTools, type ScheduleZoom } from '../lib/exceptionView';
import { AddPlanPanel } from './AddPlanPanel';
import { MenuButton, type MenuItem } from './MenuButton';
import { WithIcon } from './ui';
import { useHistoryMenuItems } from './undo';

/** 日の「訪問を追加」（押せない理由があれば why。スマホは null＝ボタンにしない） */
export type AddTool = { onClick: () => void; why: string | false };

export function SimpleToolbar({
  zoom,
  className,
  absence,
  add,
  moreItems,
  after,
}: {
  zoom: ScheduleZoom;
  className: string;
  /** 「欠勤・キャンセルを登録」のボタン（無ければ null） */
  absence: ReactNode;
  add: AddTool | null;
  /** 画面ごとの「その他 ▾」の項目（表示の切り替え・使い方・印刷など） */
  moreItems: MenuItem[];
  after?: ReactNode;
}) {
  const history = useHistoryMenuItems();
  const [adding, setAdding] = useState(false);
  const { primary, second } = mainTools(zoom, { add: add !== null, plan: true, absence: absence !== null });
  const items = [...moreItems, ...history];
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
            <span className="tb-label">{addVisitLabel(true)}</span>
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
      {second === 'absence' && absence}
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
