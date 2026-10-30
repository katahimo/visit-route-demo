// 予定の操作の行（エキスパート機能が切のとき。PRD D384。ADR-0073）：主ボタン1つ＋ボタン1つまで、ほかは「その他 ▾」へ。
// どのボタンを残すかは lib/exceptionView の mainTools。日は「訪問を追加」が主ボタン（スマホは出さず「担当なしの訪問を組む」）、
// 週・月は「担当なしの訪問を組む」が主ボタン（担当なしが無ければ主ボタンは無し）。もう1つは「欠勤・キャンセルを登録」
import { Plus, Sparkles } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { mainTools, type ScheduleZoom } from '../lib/exceptionView';
import { MenuButton, type MenuItem } from './MenuButton';
import { WithIcon } from './ui';
import { useHistoryMenuItems } from './undo';
import type { SimpleMore } from './useSimpleMore';

/** 日の「訪問を追加」（押せない理由があれば why。スマホは null＝ボタンにしない） */
export type AddTool = { onClick: () => void; why: string | false };

export function SimpleToolbar({
  zoom,
  className,
  absence,
  add,
  moreItems,
  more,
  after,
}: {
  zoom: ScheduleZoom;
  className: string;
  /** 「欠勤・キャンセルを登録」のボタン（無ければ null） */
  absence: ReactNode;
  add: AddTool | null;
  /** 画面ごとの「その他 ▾」の項目（表示の切り替え・使い方・印刷など） */
  moreItems: MenuItem[];
  more: SimpleMore;
  after?: ReactNode;
}) {
  const history = useHistoryMenuItems();
  const { primary, second } = mainTools(zoom, {
    add: add !== null,
    arrange: more.arrange.count > 0,
    absence: absence !== null,
  });
  const items = [
    ...moreItems,
    ...history,
    ...more.items.filter((i) => !(primary === 'arrange' && i.key === 'auto-arrange')),
  ];
  const { arrange } = more;
  const rowRef = useRef<HTMLDivElement>(null);
  const hadFocus = useRef(false);
  // 押した主ボタンが消えたら（組み終えて担当なしが無くなった）、フォーカスを落とさず「その他 ▾」へ
  useEffect(() => {
    if (hadFocus.current && primary !== 'arrange') {
      hadFocus.current = false;
      rowRef.current?.querySelector<HTMLElement>('.plan-more button')?.focus();
    }
  }, [primary]);
  return (
    <div
      ref={rowRef}
      className={`row schedule-toolbar is-simple ${className}`}
      data-testid="schedule-toolbar"
      data-zoom={zoom}
    >
      {primary === 'add' && add && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            if (add.why === false) add.onClick();
          }}
          aria-disabled={add.why !== false || undefined}
          title={add.why || undefined}
          data-testid="plan-visit-add"
        >
          <WithIcon icon={Plus}>
            <span className="tb-label">訪問を追加</span>
          </WithIcon>
        </button>
      )}
      {primary === 'arrange' && (
        <button
          type="button"
          className="btn btn-primary"
          aria-disabled={arrange.running || undefined}
          onClick={() => {
            if (arrange.running) return;
            // 組み終えるとボタンが消えることがある：そのときフォーカスを「その他 ▾」へ移す（下の effect）
            hadFocus.current = true;
            arrange.run();
          }}
          title="今日から来月末までの担当なしの訪問を、いまの条件で組みます"
          data-testid="toolbar-arrange"
        >
          <WithIcon icon={Sparkles}>
            <span className="tb-label">
              {arrange.running ? '組んでいます…' : `担当なしの訪問を組む ${arrange.count}件`}
            </span>
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
    </div>
  );
}
