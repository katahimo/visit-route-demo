// 予定の「その他 ▾」に足す項目（エキスパート機能が切のとき。PRD D383）：メニューから外した空き状況と、ホームの無くなった
// 担当なしの訪問の［組む］（ADR-0072 第2段。今日〜翌月末の担当なしを、いまの条件で自動で組む）。入のときは足さない
import { CalendarSearch, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { jstDate } from '../domain/time';
import { autoRange, targetCount, unassignedTargets } from '../lib/autoArrange';
import { autoArrange, requestUnassignedArrange } from '../lib/autoArrangeBatch';
import { confirmLeave } from '../lib/leaveGuard';
import { isSimpleMenu } from '../lib/nav';
import { type SimpleMoreKind, simpleMoreKinds } from '../lib/simpleMore';
import { useDemoData } from '../store';
import type { MenuItem } from './MenuButton';
import { useValueStore } from './valueStore';

export function useSimpleMoreItems(): MenuItem[] {
  const { data } = useDemoData();
  const navigate = useNavigate();
  const running = useValueStore(autoArrange.run) !== null;
  const features = data.org.features;
  const simple = isSimpleMenu(features);
  const today = jstDate(Date.now());
  // 担当なしの訪問の数（今日〜翌月末）
  const unassigned = useMemo(
    () => (simple ? targetCount(unassignedTargets(data, today, autoRange(today))) : 0),
    [simple, data, today],
  );
  const kinds = simpleMoreKinds(features, unassigned);
  const byKind: Record<SimpleMoreKind, MenuItem> = {
    'auto-arrange': {
      key: 'auto-arrange',
      label: '担当なしの訪問を組む',
      note: running ? '組んでいます…' : `${unassigned}件`,
      icon: Sparkles,
      description: '今日から来月末までの担当なしの訪問を、いまの条件で組みます',
      disabled: running ? '組んでいます' : false,
      onSelect: () => {
        if (!running) requestUnassignedArrange(data, today);
      },
      testId: 'more-auto-arrange',
    },
    vacancy: {
      key: 'vacancy',
      label: '空き状況',
      icon: CalendarSearch,
      onSelect: () => void confirmLeave().then((ok) => ok && navigate('/vacancy')),
      testId: 'more-vacancy',
    },
  };
  // 足す項目は「予定まわり」のまとまりにする（スマホの日の予定の「そのほか」の見出しの中に入れない）
  return kinds.map((k, i) => (i === 0 ? { ...byKind[k], group: '予定まわり' } : byKind[k]));
}
