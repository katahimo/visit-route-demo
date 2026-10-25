import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CalendarSearch,
  ChevronDown,
  Clock,
  Database,
  FlaskConical,
  GitCompareArrows,
  HeartHandshake,
  House,
  Layers,
  ListTodo,
  type LucideIcon,
  Route as RouteIcon,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Timer,
  UserRound,
  Users,
  UserX,
} from 'lucide-react';
import { Fragment, type MouseEvent, useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { isActiveNav, type MenuItem, NAV_OPEN_DEFAULT, type NavIcon, type NavSection } from '../lib/nav';
import { navOpenMemory } from '../store';

/** 左のメニュー（PRD D273〜D275。並びは lib/nav の menuSections） */
type NavItem = MenuItem;

/** メニューの項目のアイコン */
export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: ListTodo,
  month: CalendarRange,
  week: CalendarClock,
  day: CalendarDays,
  compare: GitCompareArrows,
  arrange: Sparkles,
  absence: UserX,
  vacancy: CalendarSearch,
  clients: House,
  people: Users,
  compat: HeartHandshake,
  staff: UserRound,
  hours: Clock,
  workload: Timer,
  standard: CalendarCheck,
  rules: SlidersHorizontal,
  types: Layers,
  items: Tags,
  settings: Settings,
  data: Database,
};

/** ロゴと事業所の名前（左のメニューと引き出しの頭） */
export function Brand({ orgName }: { orgName: string }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <RouteIcon size={20} strokeWidth={2.4} />
      </span>
      <div className="brand-text">
        <strong>{orgName}</strong>
        <span className="demo-badge" title="データはこのブラウザだけに保存。実在の個人情報は入れない">
          <FlaskConical size={12} aria-hidden="true" />
          デモ（ブラウザ内に保存）
        </span>
      </div>
    </div>
  );
}

/**
 * 畳める項目の開け閉め（PRD D349）。押して変えた開け閉めは覚える（この端末に残す。store/navOpen）。
 * 今の画面の親は、その親へ移ったときに開いて見せる（auto。覚えない。押して畳めば auto を外す）
 */
function useNavOpen(groups: readonly NavSection<NavItem>[], pathname: string) {
  const stored = useSyncExternalStore(navOpenMemory.subscribe, navOpenMemory.read, navOpenMemory.cached);
  const currentParent = groups.flatMap((g) => g.items).find((i) => i.children?.length && isActiveNav(i, pathname))?.key;
  const [auto, setAuto] = useState(currentParent);
  useEffect(() => {
    setAuto(currentParent);
  }, [currentParent]);
  const isOpen = (key: string) => (key === auto ? true : (stored[key] ?? NAV_OPEN_DEFAULT[key] ?? true));
  const toggle = (key: string, open: boolean) => {
    if (key === auto) setAuto(undefined);
    navOpenMemory.write(key, !open);
  };
  return { isOpen, toggle };
}

/**
 * メニューの並び（左のメニューとスマホの引き出しで共通。グループの見出し付きの縦並び）。
 * 子の項目を持つ項目は ▾ で畳める（PRD D349）。押して変えた開け閉めは覚える。今の画面の親は、その親へ移ったときに開いて見せる
 * （覚えない。同じ親の中で画面を移っても、畳んだら畳んだまま）。
 * 今の画面の印は、開いていれば子に、畳んでいれば親に付ける
 */
export function NavGroups({
  groups,
  pathname,
  onPick,
}: {
  groups: readonly NavSection<NavItem>[];
  pathname: string;
  /** 項目を押したとき（引き出しを閉じる。今の画面なら移らない） */
  onPick?: (e: MouseEvent<HTMLAnchorElement>, item: NavItem) => void;
}) {
  const { isOpen, toggle } = useNavOpen(groups, pathname);
  const link = (item: NavItem, on: boolean, extra = '') => {
    const Icon = NAV_ICONS[item.icon];
    return (
      <Link
        to={item.to}
        className={`nav-link${on ? ' active' : ''}${extra}`}
        aria-current={on ? 'page' : undefined}
        onClick={(e) => onPick?.(e, item)}
        data-testid="nav-link"
        data-key={item.key}
      >
        <Icon size={18} strokeWidth={2.1} aria-hidden="true" />
        <span>{item.label}</span>
        {item.badge && (
          <span className="nav-badge" title={item.badge.label} data-testid="nav-badge">
            <span aria-hidden="true">{item.badge.text}</span>
            <span className="sr-only">{item.badge.label}</span>
          </span>
        )}
      </Link>
    );
  };
  return (
    <nav className="nav-groups" aria-label="画面の一覧">
      {groups.map((g) => (
        <div key={g.items[0]!.key} className="nav-group">
          {g.title && <h2 className="nav-group-title">{g.title}</h2>}
          {g.items.map((item) => {
            // 今の画面の印（「予定」は月・週・日の予定、「設定」は設定のタブ。PRD D273・D275）
            const on = isActiveNav(item, pathname);
            const kids = item.children ?? [];
            if (kids.length === 0) return <Fragment key={item.key}>{link(item, on)}</Fragment>;
            const open = isOpen(item.key);
            const kidOn = kids.map((k) => isActiveNav(k, pathname));
            const subId = `nav-sub-${item.key}`;
            return (
              <div key={item.key} className={`nav-parent${open ? ' is-open' : ''}`} data-parent={item.key}>
                <div className="nav-parent-row">
                  {link(item, on && (!open || !kidOn.includes(true)), on ? ' has-current' : '')}
                  <button
                    type="button"
                    className="nav-toggle"
                    aria-expanded={open}
                    aria-controls={subId}
                    aria-label={`${item.label}の項目`}
                    onClick={() => toggle(item.key, open)}
                    data-testid="nav-toggle"
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                </div>
                <div id={subId} className="nav-sub" hidden={!open}>
                  {open && kids.map((k, n) => <Fragment key={k.key}>{link(k, kidOn[n]!, ' nav-child')}</Fragment>)}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
