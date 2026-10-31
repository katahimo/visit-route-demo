import { TriangleAlert } from 'lucide-react';
import { type ReactElement, Suspense, useCallback, useId, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AutoArrangeHost } from '../components/autoArrangeHost';
import { MonthBatchHost } from '../components/batchBand';
import { CommandPalette } from '../components/CommandPalette';
import { BrokenDataNotice, DataWatch } from '../components/DataNotices';
import { DayProvider, useDay } from '../components/day';
import { FeatureOffNotice } from '../components/FeatureOffNotice';
import { PersonPopoverProvider } from '../components/PersonPopover';
import { TourProvider } from '../components/Tour';
import { HistoryKeys } from '../components/undo';
import { NARROW_QUERY } from '../components/useMedia';
import { VisitPanelProvider } from '../components/VisitPanel';
import { addDays, jstDate } from '../domain/time';
import { featureLabel, featureOfLocation, isFeatureOffState, isOn } from '../lib/features';
import { homePath, navTitleParts, tabClick } from '../lib/nav';
import ArrangePage from '../pages/ArrangePage';
import AvailabilityPage from '../pages/AvailabilityPage';
import BasicsPage from '../pages/BasicsPage';
import ClientPage from '../pages/ClientPage';
import ClientsPage from '../pages/ClientsPage';
import DataPage from '../pages/DataPage';
import ItemsPage from '../pages/ItemsPage';
import MonthPrintPage from '../pages/MonthPrintPage';
import RulesPage from '../pages/RulesPage';
import SettingsPage from '../pages/SettingsPage';
import StaffPage from '../pages/StaffPage';
import StaffPersonPage from '../pages/StaffPersonPage';
import StaffViewPage from '../pages/StaffViewPage';
import StandardPage from '../pages/StandardPage';
import StartGuidePage from '../pages/StartGuidePage';
import TypesPage from '../pages/TypesPage';
import WeekPage from '../pages/WeekPage';
import WorkloadPage from '../pages/WorkloadPage';
import { useDemoData } from '../store';
import { ErrorBoundary } from './ErrorBoundary';
import { ComparePage, CompatPage, MonthPage, PageLoading, PlanPage, PreloadWhenShown, VacancyPage } from './lazyPages';
import { NavDrawer } from './NavDrawer';
import { AppHeader, BottomTabs } from './shellBars';
import { Brand, NavGroups } from './shellNav';
import { useHeaderHeight, useShellNav, useShellOverlays } from './useAdminShell';

/** seed は基準日から14日分 */
const DAYS = 14;

/** 画面全体：日付の文脈と、ルート（design.md §4 pages） */
export default function App() {
  const { data } = useDemoData();
  // 最初は今日（データに今日が無ければ基準日）。日がたってから開いても今日から始める。
  // 画面から選んだ日（月間カレンダーの訪問の無い日など）は、データに無い日でも選べる（explicit）
  const [pick, setPick] = useState(() => ({ date: jstDate(Date.now()), explicit: false }));
  const picked = pick.date;
  const setPicked = useCallback((d: string) => setPick({ date: d, explicit: true }), []);
  // データの中の日付（基準日から14日＋訪問のある日。定期パターンから展開した月の訪問も含む）＋画面から選んだ日
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < DAYS; i++) set.add(addDays(data.baseDate, i));
    for (const v of data.visits) set.add(v.date);
    if (pick.explicit && /^\d{4}-\d{2}-\d{2}$/.test(pick.date)) set.add(pick.date);
    return [...set].sort();
  }, [data.baseDate, data.visits, pick]);
  const date = dates.includes(picked)
    ? picked
    : dates.includes(data.baseDate)
      ? data.baseDate
      : (dates[0] ?? data.baseDate);
  // 切った機能の URL（ブックマーク・古いリンク・`?do=`）は予定の画面（ホームは無い。homePath。PRD D213・D383・D390。ADR-0028）へ移し、
  // その上で知らせる。
  // 管理者設定と土台の画面は表に無いので移さない（戻れなくならない）
  const { pathname, search } = useLocation();
  const needed = featureOfLocation(pathname, search);
  const blocked = needed !== null && !isOn(data.org.features, needed) ? needed : null;
  const home = homePath(data.org.features);

  return (
    <DayProvider value={{ date, setDate: setPicked, dates }}>
      {/* 予定の名前から開く〈スタッフ〉・〈利用者さん〉の詳細（PRD D122〜D126）。吹き出しは画面全体で1つ */}
      <PersonPopoverProvider>
        {/* 控えの知らせ・別のタブの変更の知らせ（PRD D227。トースト） */}
        <DataWatch />
        {/* 全体の「元に戻す・やり直す」のキー（Ctrl+Z・Ctrl+Shift+Z。PRD D329。ADR-0054） */}
        <HistoryKeys />
        {/* 範囲の AI で組む（担当を組む）の計算を画面の外で続ける（PRD D256・D257。ADR-0042）：store につなぎ、終わったら知らせる */}
        <MonthBatchHost />
        {/* 自動の組み（欄の保存・要対応の帯の［担当なしを組む］。ADR-0072 第2段）：同じく画面の外で続け、終わったら知らせて［元に戻す］ */}
        <AutoArrangeHost />
        {/* 訪問の詳細の欄（PRD D301〜D304。ADR-0051）：どの画面・コマンドパレットからでも開ける。欄は画面全体で1つ */}
        <VisitPanelProvider>
          {blocked ? (
            <Navigate to={home} replace state={{ featureOff: blocked }} />
          ) : (
            <Routes>
              <Route path="/staff-view/:staffId" element={<Guarded element={<StaffViewPage />} />} />
              {/* 月の予定の印刷（PRD D70）：左のメニューの外（印刷にナビを出さない） */}
              <Route path="/month/print" element={<Guarded element={<MonthPrintPage />} />} />
              <Route element={<AdminShell />}>
                {/* 日の予定は #/plan。古いリンクの #/schedule はそこへ */}
                <Route path="/schedule" element={<Navigate to="/plan" replace />} />
                {/* ホームは無い（PRD D383・D390。ADR-0073・ADR-0074）：古い #/home・起動したとき（#/・知らない URL）は予定の画面へ */}
                <Route path="/home" element={<Navigate to={home} replace />} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/month" element={<MonthPage />} />
                <Route path="/week" element={<WeekPage />} />
                <Route path="/workload" element={<WorkloadPage />} />
                <Route path="/vacancy" element={<VacancyPage />} />
                {/* 担当を組む（AI で範囲の担当を組む・提案を比べる。ADR-0063） */}
                <Route path="/arrange" element={<ArrangePage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/standard" element={<StandardPage />} />
                <Route path="/rules" element={<RulesPage />} />
                <Route path="/items" element={<ItemsPage />} />
                <Route path="/types" element={<TypesPage />} />
                <Route path="/basics" element={<BasicsPage />} />
                <Route path="/compat" element={<CompatPage />} />
                <Route path="/staff" element={<StaffPage />} />
                {/* 〈スタッフ〉・〈利用者さん〉の画面（全画面。PRD D308。ADR-0052）。new は新しい人 */}
                <Route path="/staff/:staffId" element={<StaffPersonPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:id" element={<ClientPage />} />
                <Route path="/availability" element={<AvailabilityPage />} />
                {/* 登録の案内（PRD D381。ADR-0073）：自分のデータで始めたあとの3段 */}
                <Route path="/start" element={<StartGuidePage />} />
                <Route path="/data" element={<DataPage />} />
                {/* 管理者設定（PRD D210。ADR-0028）：機能の入り切り。だれでも開ける・切れない */}
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to={home} replace />} />
              </Route>
            </Routes>
          )}
        </VisitPanelProvider>
      </PersonPopoverProvider>
    </DayProvider>
  );
}

/** 知らせを閉じたあと、フォーカスを画面の見出しへ */
function focusHeading() {
  requestAnimationFrame(() => {
    const h = document.querySelector<HTMLElement>('.app-main h1');
    if (!h) return;
    h.tabIndex = -1;
    h.focus();
  });
}

/** 画面ごとの例外の受け止め（ページを移ると戻る） */
function Guarded({ element }: { element: ReactElement }) {
  const { reset } = useDemoData();
  const { pathname } = useLocation();
  // 〈利用者さん〉・〈スタッフ〉の画面は人が替わっても同じ画面（作り直さない。変更があるまま別の人へ移るときに確かめるため。PRD D308）
  const page = pathname.replace(/^\/(clients|staff)\/[^/]+$/, '/$1/:id');
  return (
    <ErrorBoundary key={page} onReset={reset}>
      {element}
    </ErrorBoundary>
  );
}

function AdminShell() {
  const { data, saveError } = useDemoData();
  /** 選んでいる日付（日付の選択を出さない画面でも覚えたまま。外枠の data-date で読める。PRD D267） */
  const { date: pickedDate } = useDay();
  const terms = data.org.terms;
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  /** 切った機能の URL から移ってきたときの、その機能（予定の画面の上に知らせを出す。PRD D213） */
  const home = homePath(data.org.features);
  const featureOff = pathname === home && isFeatureOffState(location.state) ? location.state.featureOff : null;
  const { menuOpen, setMenuOpen, paletteOpen, openPalette, closePalette } = useShellOverlays(pathname);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const sideNavRef = useRef<HTMLElement>(null);
  const drawerId = useId();
  useHeaderHeight(headerRef);
  const { groups, screens } = useShellNav(data, pathname);
  return (
    // 初回の案内ツアー（PRD D192・D193）：まだ見ていなければ起動したときに中央のカードで出す。データの画面からもう一度開ける
    <TourProvider terms={terms}>
      <div className="app-shell" data-date={pickedDate}>
        <aside ref={sideNavRef} className="side-nav">
          <Brand orgName={data.org.name} />
          <NavGroups groups={groups} pathname={pathname} />
        </aside>
        <div className="app-body">
          <AppHeader
            headerRef={headerRef}
            screenName={navTitleParts(screens, pathname)}
            orgName={data.org.name}
            pathname={pathname}
            paletteOpen={paletteOpen}
            openPalette={openPalette}
          />
          {saveError && (
            <div className="save-error" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              {saveError} <NavLink to="/data">データを書き出す</NavLink>
            </div>
          )}
          <main className="app-main">
            {/* 分けた画面（PRD D248）を読む間。画面を移るときは前の画面のまま待つ（移動は transition）ので、出るのは最初に開いたときだけ */}
            <Suspense fallback={<PageLoading />}>
              <Guarded
                element={
                  <>
                    {/* 保存していたデータを読めず初期データで開いた知らせ（PRD D227）。閉じたらフォーカスは画面の見出しへ */}
                    <BrokenDataNotice onClose={focusHeading} />
                    {featureOff && (
                      <FeatureOffNotice
                        name={featureLabel(featureOff, terms)}
                        onClose={() => {
                          // 知らせを閉じる（URL はそのまま。state だけ消す）。フォーカスは画面の見出しへ
                          navigate(home, { replace: true, state: null });
                          focusHeading();
                        }}
                      />
                    )}
                    <Outlet />
                    {/* 画面が出たあと（読み込み中の表示のあいだは数えない）に、分けた画面と地図を先に読む */}
                    <PreloadWhenShown />
                  </>
                }
              />
            </Suspense>
          </main>
          <BottomTabs
            groups={groups}
            features={data.org.features}
            pathname={pathname}
            paletteOpen={paletteOpen}
            openPalette={openPalette}
            menuOpen={menuOpen}
            drawerId={drawerId}
            menuBtnRef={menuBtnRef}
            openMenu={() => setMenuOpen(true)}
          />
        </div>
        {paletteOpen && <CommandPalette sections={screens} terms={terms} onClose={closePalette} />}
        {menuOpen && (
          <NavDrawer
            id={drawerId}
            label="メニュー"
            onClose={() => setMenuOpen(false)}
            // 広い画面へ戻して閉じたときは「メニュー」ボタンが隠れているので、左のメニューの今の項目へ
            returnFocus={() =>
              window.matchMedia(NARROW_QUERY).matches
                ? menuBtnRef.current
                : (sideNavRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ??
                  sideNavRef.current?.querySelector<HTMLElement>('a[href]'))
            }
            head={<Brand orgName={data.org.name} />}
          >
            <NavGroups
              groups={groups}
              pathname={pathname}
              onPick={(e, item) => {
                // 今の画面の項目は閉じるだけ（移り直して URL のクエリ＝画面の状態を消さない）
                if (tabClick(item, pathname) === 'stay') e.preventDefault();
                setMenuOpen(false);
              }}
            />
          </NavDrawer>
        )}
      </div>
    </TourProvider>
  );
}
