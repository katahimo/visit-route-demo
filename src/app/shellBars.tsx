import { CalendarDays, ChevronLeft, ChevronRight, Menu, Route as RouteIcon, Search } from 'lucide-react';
import type { RefObject } from 'react';
import { Link } from 'react-router-dom';
import { BatchBand } from '../components/batchBand';
import { IS_MAC } from '../components/CommandPalette';
import { useDay } from '../components/day';
import { FullscreenButton } from '../components/FullscreenButton';
import { dateText } from '../lib/dateText';
import {
  bottomTabs,
  isActiveNav,
  type MenuItem,
  type NavSection,
  type navTitleParts,
  showsDateSwitch,
  tabClick,
  tabLabel,
} from '../lib/nav';
import { NAV_ICONS } from './shellNav';

/** 上の帯（月まとめ作成の進み具合・スマホの今の画面の名前・探す・日付の切り替え・全画面） */
export function AppHeader({
  headerRef,
  screenName,
  orgName,
  pathname,
  paletteOpen,
  openPalette,
}: {
  headerRef: RefObject<HTMLElement | null>;
  /** 上の帯の今の画面の名前（スマホ。PRD D132・D179。見出し・項目名） */
  screenName: ReturnType<typeof navTitleParts>;
  orgName: string;
  pathname: string;
  paletteOpen: boolean;
  openPalette: () => void;
}) {
  return (
    <header ref={headerRef} className="app-header">
      {/* 月まとめ作成の進み具合と［止める］（PRD D256。ほかの画面へ移っても続く。月の予定では画面の中に出す） */}
      <BatchBand />
      {/* スマホだけ：ロゴと今の画面の名前（PRD D132。広い画面では出さない。「メニュー」は下のタブ。PRD D336） */}
      <div className="m-head-title">
        <span className="brand-mark" aria-hidden="true">
          <RouteIcon size={18} strokeWidth={2.4} />
        </span>
        <strong className="m-screen-name" data-testid="screen-name">
          {/* 見出しと項目名はそれぞれひとまとまりで折り返す（入りきらなければ項目名を次の行へ。PRD D179） */}
          {screenName ? (
            <>
              {screenName.group && <span className="m-screen-group">{screenName.group}・</span>}
              <span className="m-screen-item">{screenName.item}</span>
            </>
          ) : (
            orgName
          )}
        </strong>
      </div>
      {/* コマンドパレットを開く（PRD D181。広い画面は「探す・移動」とキーの印、狭い画面は「探す」） */}
      <button
        type="button"
        className="btn btn-small cmdk-open"
        aria-haspopup="dialog"
        aria-expanded={paletteOpen}
        aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
        onClick={openPalette}
        data-testid="cmdk-open"
      >
        <Search size={16} aria-hidden="true" />
        <span>
          探す<span className="cmdk-open-more">・移動</span>
        </span>
        <span className="cmdk-open-kbd" aria-hidden="true">
          <kbd>{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
        </span>
      </button>
      {/* 日付の選択は日付で中身が変わる画面だけ（PRD D267） */}
      {showsDateSwitch(pathname) && <DateSwitcher />}
      {/* 全画面の切り替え（右端。少しでも広く使う） */}
      <FullscreenButton />
    </header>
  );
}

/** スマホだけ：よく使うタブ（ホーム・予定・欠勤）と「探す」「メニュー」（PRD D336。印刷では出さない） */
export function BottomTabs({
  groups,
  pathname,
  paletteOpen,
  openPalette,
  menuOpen,
  drawerId,
  menuBtnRef,
  openMenu,
}: {
  groups: readonly NavSection<MenuItem>[];
  pathname: string;
  paletteOpen: boolean;
  openPalette: () => void;
  menuOpen: boolean;
  drawerId: string;
  menuBtnRef: RefObject<HTMLButtonElement | null>;
  openMenu: () => void;
}) {
  return (
    <nav className="bottom-tabs" aria-label="よく使う画面" data-testid="bottom-tabs">
      {bottomTabs(groups).map((item) => {
        const { key, to, icon } = item;
        const Icon = NAV_ICONS[icon];
        // 「予定」は月・週・日の予定で印（PRD D273）。欠勤は操作なので印を付けない
        const on = isActiveNav(item, pathname);
        const click = tabClick(item, pathname);
        return (
          <Link
            key={key}
            to={to}
            className={on ? 'bottom-tab active' : 'bottom-tab'}
            aria-current={on ? 'page' : undefined}
            onClick={(e) => {
              // 今の画面のタブは何もしない（押し直して URL のクエリ＝画面の状態を消さない）
              if (click === 'stay') e.preventDefault();
            }}
            data-testid="bottom-tab"
            data-tab={key}
          >
            <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
            <span>{tabLabel(item)}</span>
          </Link>
        );
      })}
      {/* 「探す」：コマンドパレットを開く（PRD D336。上の帯から下のタブへ移した。空き状況はメニューと探すから） */}
      <button
        type="button"
        className="bottom-tab"
        aria-haspopup="dialog"
        aria-expanded={paletteOpen}
        onClick={openPalette}
        data-testid="bottom-search"
        data-tab="search"
      >
        <Search size={20} strokeWidth={2.1} aria-hidden="true" />
        <span>探す</span>
      </button>
      {/* 「メニュー」：全部の画面の引き出し（PRD D133・D336。上の帯から下のタブの最後へ移した） */}
      <button
        ref={menuBtnRef}
        type="button"
        className="bottom-tab m-menu-btn"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? drawerId : undefined}
        onClick={openMenu}
        data-testid="menu-btn"
      >
        <Menu size={20} strokeWidth={2.1} aria-hidden="true" />
        <span>メニュー</span>
      </button>
    </nav>
  );
}

/** 日付の切り替え（データの中の日付から選ぶ） */
function DateSwitcher() {
  const { date, setDate, dates } = useDay();
  const i = dates.indexOf(date);
  return (
    <div className="date-switch">
      <CalendarDays size={18} className="date-icon" aria-hidden="true" />
      <button
        type="button"
        className="icon-btn"
        disabled={i <= 0}
        onClick={() => setDate(dates[i - 1] ?? date)}
        aria-label="前の日"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="日付">
        {dates.map((d) => (
          <option key={d} value={d}>
            {dateText(d)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="icon-btn"
        disabled={i < 0 || i >= dates.length - 1}
        onClick={() => setDate(dates[i + 1] ?? date)}
        aria-label="次の日"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
