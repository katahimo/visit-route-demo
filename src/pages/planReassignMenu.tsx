// 訪問の詳細の「担当を変える ▾」（PRD D217。ADR-0030）：日の予定の順番のカード・時間軸の帯の詳細から
import { ArrowRightLeft, CircleOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MenuButton, type MenuItem } from '../components/MenuButton';
import type { Problem } from '../contracts/problem';
import { CURRENT_TEXT, NONE_TEXT, reassignChoices } from '../lib/reassignMenu';

/**
 * 訪問の詳細の「担当を変える ▾」（PRD D217。ADR-0030）：ドラッグと同じ手直しを、押す・キーボード・タッチで。
 * 候補は「受けられる人」と同じ candidatesFor（列のある人だけ）。押せる人を先に、必須の条件に合わない人は押せず理由を出す。
 * 今の担当は印を付けて押せない。担当のいる訪問は最後に「担当なしにする」。選ぶとドラッグと同じ moveTo・unassign
 */
export function ReassignMenu({
  problem,
  routes,
  visitId,
  ownerId,
  pinned,
  staffIds,
  staffName,
  staffTerm,
  busy,
  onMove,
  onNone,
}: {
  problem: Problem;
  routes: Record<string, string[]>;
  visitId: string;
  ownerId: string | null;
  pinned: boolean;
  /** 列を出している人（ドラッグで落とせる人と同じ） */
  staffIds: string[];
  staffName: (id: string) => string;
  staffTerm: string;
  /** 押せない理由（計算中）。無ければ false */
  busy: string | false;
  onMove: (staffId: string) => void;
  onNone: () => void;
}) {
  /** 候補は一覧を開いているときだけ計算する（「受けられる人」の CandidateBox と同じ。訪問を選ぶ・ドラッグのたびに計算しない） */
  const [open, setOpen] = useState(false);
  // 判定は訪問の詳細の欄と同じ関数（lib/reassignMenu の reassignChoices。ADR-0051）。出す人は列を出している人
  const sorted = useMemo(() => {
    if (!open) return [];
    const shown = new Set(staffIds);
    return reassignChoices(problem, routes, visitId, ownerId, (sid) => shown.has(sid)).filter((c) => !c.current);
  }, [open, problem, routes, visitId, ownerId, staffIds]);
  if (!problem.visits.some((v) => v.id === visitId)) return null;
  const items: MenuItem[] = [
    ...(ownerId
      ? [
          {
            key: `cur-${ownerId}`,
            group: '今の担当',
            testId: 'plan-reassign-current',
            label: staffName(ownerId),
            note: pinned ? 'ピン' : undefined,
            description: CURRENT_TEXT,
            current: true,
            disabled: true,
            onSelect: () => {},
          },
        ]
      : []),
    ...sorted.map(
      (c, i): MenuItem => ({
        key: `to-${c.staffId}`,
        group: i === 0 ? `ほかの${staffTerm}へ移す` : undefined,
        testId: 'plan-reassign-item',
        label: staffName(c.staffId),
        description: c.description,
        disabled: busy || c.disabled,
        onSelect: () => onMove(c.staffId),
      }),
    ),
    // 担当の無い訪問で移せる人がいなければ、そう書く（一覧を空にしない）
    ...(!ownerId && open && sorted.length === 0
      ? [
          {
            key: 'empty',
            testId: 'plan-reassign-empty',
            label: `移せる${staffTerm}がいません`,
            disabled: true,
            onSelect: () => {},
          },
        ]
      : []),
    ...(ownerId
      ? [
          {
            key: 'none',
            group: 'そのほか',
            testId: 'plan-reassign-none',
            label: '担当なしにする',
            description: NONE_TEXT,
            icon: CircleOff,
            disabled: busy,
            onSelect: onNone,
          },
        ]
      : []),
  ];
  return (
    <div className="plan-reassign">
      <MenuButton
        label="担当を変える"
        icon={ArrowRightLeft}
        items={items}
        testId="plan-reassign"
        onOpenChange={setOpen}
      />
    </div>
  );
}
