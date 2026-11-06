// 予定の操作の行（入切とも。PRD D384・D402。ADR-0073・ADR-0074）：主ボタン1つ＋ボタン1つまで、ほかは「その他 ▾」へ。
// どのボタンを残すかは lib/exceptionView の mainTools（入と切の差はそこの1か所）。
// 切：日は「訪問を1件追加」（その日の訪問の欄を開く）が主ボタン（スマホは出さず主ボタン無し）、週・月は「定期の予定を追加」（単発のみは「予約を追加」）（引き出しは AddPlanPanel。PRD D402）。
// もう1つは「欠勤・キャンセルを登録」。要対応を組むのは要対応の帯（PRD D403。ADR-0077）。
// 入：月・週は「定期の予定を追加」＋「担当を組む」（担当を組むの画面へ）、日は「訪問を1件追加」＋「確定（伝えた）」。欠勤・キャンセルは「その他 ▾」の中。
// 入切とも、ボタンの右に アイコンだけの［元に戻す］［やり直す］（数えない補助。PRD D432）。
// 入切とも「その他 ▾」の最後に「連絡を貼り付けて入れる」（PRD D418。欠勤・キャンセルか〈利用者さん〉の休みの機能が入のとき）。
// 入切とも、元に戻す・やり直すの前に「休みを取り込む」（毎日使うので「その他 ▾」に入れず見える所に。PRD D440。欠勤・キャンセルの機能が入のとき）
import { ClipboardPaste, Plus, Sparkles } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { planAddLabel } from '../lib/addPlan';
import { ADD_VISIT_LABEL, mainTools, type ScheduleZoom } from '../lib/exceptionView';
import { AddPlanPanel } from './AddPlanPanel';
import { CAL_OFF_ICON, CAL_OFF_LABEL, CAL_OFF_SHORT, CalendarOffPanel } from './CalendarOffPanel';
import { MenuButton, type MenuItem } from './MenuButton';
import { PASTE_LABEL, PastePanel } from './PastePanel';
import { WithIcon } from './ui';
import { UndoIconButtons } from './undo';
import { useFeature, useFeatures } from './useFeature';

/** 欠勤・キャンセルを登録：切は操作の行のボタン（node）、入は「その他 ▾」の項目（item） */
export type AbsenceTool = { node: ReactNode; item: MenuItem };

/** 日の「訪問を1件追加」（押せない理由があれば why。スマホは null＝ボタンにしない） */
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
  const [adding, setAdding] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [calOff, setCalOff] = useState(false);
  const features = useFeatures();
  const suddenOn = useFeature('sudden');
  const leaveOn = useFeature('clientLeave');
  const pasteOn = suddenOn || leaveOn;
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
  const paste: MenuItem = {
    key: 'paste',
    label: PASTE_LABEL,
    icon: ClipboardPaste,
    onSelect: () => setPasting(true),
    testId: 'paste-open',
  };
  const items = [...moreItems, ...(expert && absence ? [absence.item] : []), ...(pasteOn ? [paste] : [])];
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
            <span className="tb-label">{planAddLabel(features)}</span>
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
      {suddenOn && (
        <button
          type="button"
          className="btn"
          onClick={() => setCalOff(true)}
          title={CAL_OFF_LABEL}
          data-testid="cal-off-open"
        >
          <WithIcon icon={CAL_OFF_ICON}>
            <span className="tb-label">{CAL_OFF_SHORT}</span>
          </WithIcon>
        </button>
      )}
      <UndoIconButtons />
      <MenuButton
        label="その他"
        items={items}
        testId={`${zoom === 'day' ? 'plan' : zoom}-more`}
        className="plan-more"
      />
      {after}
      {adding && <AddPlanPanel onClose={() => setAdding(false)} />}
      {pasting && <PastePanel onClose={() => setPasting(false)} />}
      {calOff && <CalendarOffPanel onClose={() => setCalOff(false)} />}
    </div>
  );
}
