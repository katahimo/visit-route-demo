import { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { IS_MAC } from '../components/CommandPalette';
import { rememberPeopleSide } from '../components/peopleSide';
import { useBasisChanged } from '../components/useArrangeBasis';
import { NARROW_QUERY } from '../components/useMedia';
import type { DemoData } from '../contracts/data';
import { jstDate } from '../domain/time';
import { hashPathname, isPaletteShortcut, keepPaletteOn } from '../lib/commandPalette';
import {
  activeNavPath,
  isScheduleView,
  isSettingsPath,
  type LastViews,
  menuSections,
  screenSections,
} from '../lib/nav';
import { menuBadges } from '../lib/scheduleMode';

/**
 * メニューの「予定」「設定」で開く、最後に開いた表示・タブ（PRD D273・D275）。開いている間だけ覚える
 * （画面の状態なので保存しない。AdminShell の外の画面（印刷・〈スタッフ〉のスマホ画面）から戻っても残るよう、モジュールに置く）
 */
const lastViews: LastViews = {};

/** 今の画面が予定の表示・設定のタブなら覚える（同じ値を何度書いても同じ） */
function rememberView(pathname: string): LastViews {
  if (isScheduleView(pathname)) lastViews.schedule = activeNavPath(pathname);
  if (isSettingsPath(pathname)) lastViews.settings = pathname;
  return { ...lastViews, people: rememberPeopleSide(pathname) };
}

/**
 * メニューの並びと画面の一覧（PRD D178〜D180・D230〜D232・D273・D275。ADR-0027・0034）。
 * ホーム／予定／当日・問い合わせ／人／AI の条件／設定。ルートの URL は変えない。
 * 当日・問い合わせの「欠勤・キャンセルを登録」は今日の日の予定の欄を開く操作（今の画面の印は付けない）
 */
export function useShellNav(data: DemoData, pathname: string) {
  const terms = data.org.terms;
  const features = data.org.features;
  const today = jstDate(Date.now());
  // 「予定」「設定」は最後に開いた表示・タブを開く（PRD D273・D275）
  const last = rememberView(pathname);
  const lastSchedule = last.schedule;
  const lastSettings = last.settings;
  const lastPeople = last.people;
  // 切った機能の項目は出さない（PRD D213）。下のタブもここから引く
  // 件数の印（PRD D349。compile しないので軽い）
  // 基本情報が最後に組んだあとに変われば担当を組むに「変更」の印（ADR-0067）
  const basisChanged = useBasisChanged(data);
  const badges = useMemo(() => ({ ...menuBadges(data, today), basisChanged }), [data, today, basisChanged]);
  const groups = useMemo(
    () =>
      menuSections(
        terms,
        today,
        features,
        { schedule: lastSchedule, settings: lastSettings, people: lastPeople },
        badges,
      ),
    [terms, today, features, lastSchedule, lastSettings, lastPeople, badges],
  );
  // 画面の一覧（メニューから外した画面も1つずつ）：上の帯の名前・パレットの画面（PRD D273・D275）
  const screens = useMemo(() => screenSections(terms, features), [terms, features]);
  return { groups, screens };
}

/**
 * コマンドパレット（PRD D181）とスマホの引き出し（PRD D133）の開け閉め。
 * パレットは開いた画面のパスを覚える（閉じていれば null）。開いたときの URL の hash から決める
 * （画面を移ってすぐ開いたとき、移った先の画面の描画より先に開いても、あとの「画面を移ったら閉じる」で閉じない）
 */
export function useShellOverlays(pathname: string) {
  /** スマホの引き出しを開いているか（PRD D133） */
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const paletteOpen = paletteFor !== null;
  const openPalette = useCallback(() => setPaletteFor(hashPathname(window.location.hash)), []);
  const closePalette = useCallback(() => setPaletteFor(null), []);
  // Ctrl+K（mac は ⌘K）でコマンドパレットを開く（PRD D181）。入力欄・テキストエリアの中でも開く（入れた文字はそのまま、閉じるとそこへ戻る）。
  // ほかの欄・確認・引き出し（aria-modal）が開いているあいだは開かない（そのときもブラウザの動きは止める）。開いたあとのキーはパレットが受ける
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e, IS_MAC)) return;
      // 開かないときもブラウザの動き（検索欄・アドレスバーへ移る）は止める
      e.preventDefault();
      if (document.querySelector('[aria-modal="true"]')) return;
      openPalette();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPalette]);
  // 画面を移ったら上へ。引き出しも閉じる（画面を選ぶと閉じる。PRD D133）
  // 本体はブロックにする（式本体だと戻り値が後始末として呼ばれる。Brave の scrollTo は値を返し「is not a function」になった）
  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
    // 移った先の画面で開き直したパレットは閉じない
    setPaletteFor((p) => keepPaletteOn(p, pathname));
  }, [pathname]);
  // 広い画面へ戻ったら引き出しを閉じる（左のメニューが出るので）
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => {
      if (!mq.matches) setMenuOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return { menuOpen, setMenuOpen, paletteOpen, openPalette, closePalette };
}

/**
 * スマホでは上の帯が2段に折り返すことがあるので、帯の高さ（--header-h。この下に貼り付く要素が使う）を測って出す。
 * 広い画面では styles.css の値（72px）のまま
 */
export function useHeaderHeight(headerRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const mq = window.matchMedia(NARROW_QUERY);
    const root = document.documentElement.style;
    const put = () => {
      if (mq.matches) root.setProperty('--header-h', `${Math.round(el.getBoundingClientRect().height)}px`);
      else root.removeProperty('--header-h');
    };
    put();
    const ro = new ResizeObserver(put);
    ro.observe(el);
    mq.addEventListener('change', put);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', put);
      root.removeProperty('--header-h');
    };
  }, [headerRef]);
}
