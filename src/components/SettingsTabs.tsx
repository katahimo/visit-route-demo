import {
  CalendarRange,
  Clock,
  Database,
  HeartHandshake,
  House,
  Layers,
  type LucideIcon,
  Settings,
  Tags,
  UserRound,
} from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { activeNavPath, settingsTabs } from '../lib/nav';
import { peopleSideOf, peopleTabs, peopleTabsLabel } from '../lib/peopleTabs';
import { useDemoData } from '../store';
import { rememberedPeopleSide } from './peopleSide';
import { useFeatures } from './useFeature';

/** タブのアイコン（メニューの前の項目と同じ。並びは lib/nav の SETTINGS_TABS・lib/peopleTabs） */
const ICONS: Record<string, LucideIcon> = {
  '/basics': CalendarRange,
  '/types': Layers,
  '/items': Tags,
  '/settings': Settings,
  '/data': Database,
  '/clients': House,
  '/staff': UserRound,
  '/compat': HeartHandshake,
  '/availability': Clock,
};

/** タブのナビ（設定・人のタブで共通）。狭い画面でタブが横に巻くとき、今のタブを見える所へ（ページは縦に巻かない） */
function TabNav({
  tabs,
  on,
  label,
  testId,
  className,
}: {
  tabs: readonly { to: string; label: string }[];
  on: (to: string) => boolean;
  label: string;
  testId: string;
  className: string;
}) {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 画面が変わったときだけ
  useLayoutEffect(() => {
    const nav = navRef.current;
    const cur = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !cur || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = Math.max(0, cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2);
  }, [pathname]);
  return (
    <nav ref={navRef} className={`view-switch ${className}`} aria-label={label} data-testid={testId}>
      {tabs.map(({ to, label: text }) => {
        const isOn = on(to);
        const Icon = ICONS[to] ?? Settings;
        return (
          <Link
            key={to}
            to={to}
            className={`view-switch-item${isOn ? ' is-on' : ''}`}
            aria-current={isOn ? 'page' : undefined}
            data-tab={to.slice(1)}
          >
            <Icon size={15} aria-hidden="true" />
            {text}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 〈利用者さん〉・〈スタッフ〉の画面の上の小さいタブ（入切とも。PRD D394。ADR-0073 第4段・ADR-0074 段3）：
 * 〈スタッフ〉＝一覧・勤務（勤務時間（シフト）・勤務の見込み）・相性、〈利用者さん〉＝一覧・予定と相性・相性（ADR-0099）。
 * 相性はどちらのタブからも開くので、来た側のタブを出す（lib/peopleTabs・components/peopleSide）
 */
export function PeopleTabs() {
  const { pathname } = useLocation();
  const { data } = useDemoData();
  const here = activeNavPath(pathname);
  const side = peopleSideOf(here, rememberedPeopleSide());
  if (!side) return null;
  const tabs = peopleTabs(side, data.org.features);
  return (
    <TabNav
      tabs={tabs}
      on={(to) => tabs.find((t) => t.to === to)?.match.includes(here) ?? false}
      label={peopleTabsLabel(side, data.org.terms)}
      testId="people-tabs"
      className="settings-tabs people-tabs"
    />
  );
}

/**
 * 設定のタブ（PRD D275。ADR-0045）：訪問の種類・特性の項目・管理者設定・データ（相性は人のタブ、条件の重みは「組む」。ADR-0065・ADR-0099）。
 * メニューは「設定」1項目にし、画面の見出しの下のこのタブで切り替える（予定の［月｜週｜日］と同じ形。リンクのナビで、
 * 今の画面は aria-current と太字・下線）。URL は前のまま（`#/types` など）。切った機能のタブは出さない
 */
export function SettingsTabs() {
  const { pathname } = useLocation();
  const tabs = settingsTabs(useFeatures());
  return (
    <TabNav
      tabs={tabs}
      on={(to) => to === pathname}
      label="設定の切り替え"
      testId="settings-tabs"
      className="settings-tabs"
    />
  );
}
