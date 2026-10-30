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
import { type ArrangeStepKey, activeNavPath, arrangeSteps, basicsTabs, settingsTabs } from '../lib/nav';
import { peopleSideOf, peopleTabs, peopleTabsLabel } from '../lib/peopleTabs';
import { hasStandard } from '../lib/standard';
import { setStandardStep } from '../lib/standardDraft';
import { useDemoData } from '../store';
import { rememberedPeopleSide } from './peopleSide';
import { useExceptionsOnly, useFeature, useFeatures } from './useFeature';

/** タブのアイコン（メニューの前の項目と同じ。並びは lib/nav の SETTINGS_TABS・BASICS_TABS） */
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

/** タブのナビ（設定・基本情報で共通）。狭い画面でタブが横に巻くとき、今のタブを見える所へ（ページは縦に巻かない） */
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
 * 〈利用者さん〉・〈スタッフ〉の画面の上の小さいタブ（エキスパート機能が切のとき。PRD D388。ADR-0073 第4段）：
 * 〈スタッフ〉＝一覧・勤務（勤務時間（シフト）・勤務の見込み）・相性、〈利用者さん〉＝一覧・相性。
 * 相性はどちらのタブからも開くので、来た側のタブを出す（lib/peopleTabs・components/peopleSide）。
 * 予定と相性（#/basics）など、ほかの旧画面には出さない
 */
function PeopleTabs() {
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
 * 基本情報の段の表示とタブ（ADR-0067。ADR-0054 の人のタブを予定を組むの 1 へ移した）：上に予定を組むの段（1 基本情報が今の段）、
 * 下にタブ（予定と相性・〈利用者さん〉・〈スタッフ〉・相性・勤務時間（シフト））。勤務の見込みは勤務時間（シフト）の続き
 * （印は勤務時間（シフト））。URL は前のまま（`#/clients` など）。切った機能のタブは出さない。
 * エキスパート機能が切のときは、段も旧タブも出さず〈利用者さん〉・〈スタッフ〉の小さいタブ（PeopleTabs）だけ
 */
export function BasicsNav() {
  const { pathname } = useLocation();
  const { data } = useDemoData();
  const only = useExceptionsOnly();
  const tabs = basicsTabs(data.org.terms, data.org.features);
  const here = activeNavPath(pathname);
  if (only) return <PeopleTabs />;
  return (
    <div className="stack basics-nav">
      <ArrangeSteps current="basics" />
      <TabNav
        tabs={tabs}
        on={(to) => tabs.find((t) => t.to === to)?.match.includes(here) ?? false}
        label="基本情報の切り替え"
        testId="people-tabs"
        className="settings-tabs people-tabs"
      />
    </div>
  );
}

/**
 * 設定のタブ（PRD D275。ADR-0045）：訪問の種類・特性の項目・管理者設定・データ（相性は基本情報のタブ、条件の重みは予定を組む。ADR-0065・ADR-0067）。
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

/**
 * 予定を組むの段（ADR-0066・ADR-0067）：基本情報 → 案をくらべる → 標準にする（組み方の標準の画面で1段ずつ）→ 担当を組む。
 * 組み方の標準があれば 基本情報 → 担当を組む の2段（full で4段。組み方の標準の画面はいつも4段）。
 * 欠勤・キャンセルの欄の段階と同じ形で、今の段は aria-current="step"。ほかの段は押して移れる（前の段を終えていなくてもよい）。
 * 組み方の標準の段は画面の外の入れ物（standardWork.step）で替える。条件の重みは段に入れない（案をくらべるからの寄り道）
 */
export function ArrangeSteps({ current, full }: { current: ArrangeStepKey; full?: boolean }) {
  const { data } = useDemoData();
  const expert = useFeature('expert');
  const steps = arrangeSteps(full ?? !hasStandard(data));
  // エキスパート機能が切なら段は出さない（基本情報・担当を組むは別々の画面。ADR-0072）
  if (!expert) return null;
  return (
    <nav aria-label="予定を組むの段" data-testid="arrange-steps">
      <ol className="arrange-steps">
        {steps.map((s, i) => {
          const on = s.key === current;
          const body = (
            <>
              <span className="arrange-step-no" aria-hidden="true">
                {i + 1}
              </span>
              <span className="arrange-step-name">{s.label}</span>
            </>
          );
          return (
            <li key={s.key} className={on ? 'is-current' : undefined} data-step={s.key}>
              {on ? (
                <span className="arrange-step" aria-current="step">
                  {body}
                </span>
              ) : (
                <Link
                  to={s.to}
                  className="arrange-step"
                  onClick={() => {
                    if (s.key === 'proposals' || s.key === 'register') setStandardStep(s.key);
                  }}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
