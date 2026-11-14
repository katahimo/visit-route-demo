// メニューの決まり（PRD D132〜D135・D179・D180・D326・D230・D231。ADR-0034・0045・0054。design.md §4 app）。
// 左のメニュー・スマホの引き出し・下のタブ（menuSections）と、上の帯の画面の名前・コマンドパレットの画面（screenSections）で、
// 並びと今の画面をどれと見るかを1か所で決める
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { isHrefOn, isOn } from './features';
import { type PeopleSide, peopleMatch } from './peopleTabs';
import { planYm } from './scheduleMode';
import { startGuidePlanPath } from './startGuide';
import { SUDDEN_DO } from './sudden';

/**
 * メニューの1項目（アイコンなどは呼ぶ側で足す）。to に `?` を含むものは操作（画面の中の欄を開く）で、今の画面の印を付けない。
 * short は下のタブの短い名前（無ければ label。PRD D326）。
 * match はこの項目が受け持つ画面のパス（今の画面の印。無ければ to だけ。PRD D273・D275。予定は月・週・日・比較、設定は設定のタブ）
 */
export type NavEntry = { to: string; label: string; short?: string; match?: readonly string[] };
/** メニューのグループ（見出しの無いグループはデータだけ） */
export type NavSection<T extends NavEntry = NavEntry> = { title?: string; items: readonly T[] };

/** 予定のグループの見出し（画面の一覧のグループ。上の帯では項目名だけを出す。PRD D230） */
export const SCHEDULE_GROUP = '予定';

/** メニューの「予定」が受け持つ画面（月・週・日の予定と、その日の案を比べる。PRD D273） */
export const SCHEDULE_PATHS: readonly string[] = ['/month', '/week', '/plan'];
/**
 * メニューの「組む」が受け持つ画面（エキスパート機能が入。ADR-0100）：条件の重み・担当を組む・案を比べる
 */
export const ARRANGE_PATHS: readonly string[] = ['/rules', '/arrange', '/compare'];
/** メニューの「予定」で開く表示として覚える画面（比較は覚えない） */
export const SCHEDULE_VIEWS: readonly string[] = ['/month', '/week', '/plan'];
/** メニューの「予定」の既定（まだどの表示も開いていないとき）：日の予定（PRD D273） */
export const SCHEDULE_DEFAULT = '/plan';

/** 予定の表示として覚える画面か（古い #/schedule は日の予定） */
export const isScheduleView = (pathname: string): boolean => SCHEDULE_VIEWS.includes(activeNavPath(pathname));

/** 設定のタブ（並び。PRD D275。条件の重みは予定を組むへ移した。ADR-0065）。メニューは「設定」1項目で、画面の上のタブで切り替える */
export const SETTINGS_TABS: readonly { to: string; label: string }[] = [
  { to: '/types', label: '訪問の種類' },
  { to: '/items', label: '特性の項目' },
  { to: '/settings', label: '管理者設定' },
  { to: '/data', label: 'データ' },
];
/** 設定のタブの画面か */
export const isSettingsPath = (pathname: string): boolean => SETTINGS_TABS.some((t) => t.to === pathname);

/** 切っていない設定のタブ（切った機能のタブは出さない。訪問の種類・管理者設定・データは土台で残る） */
export const settingsTabs = (features: Features): { to: string; label: string }[] =>
  SETTINGS_TABS.filter((t) => isHrefOn(features, t.to));

/**
 * 下のタブに並べる項目の key（そのあとに「探す」「メニュー」。PRD D400・D401）：エキスパート機能が切なら
 * 予定・空き状況・〈利用者さん〉・〈スタッフ〉（設定は引き出しとパレット。空き状況が切なら空き状況の代わりに設定。ADR-0080）、
 * 入なら 予定・〈利用者さん〉・〈スタッフ〉・組む（設定・空き状況は引き出し）
 */
export const bottomTabKeys = (features: Features): readonly string[] => {
  if (isOn(features, 'expert')) return ['schedule', 'clients', 'staff', 'arrange'];
  return isOn(features, 'vacancy')
    ? ['schedule', 'vacancy', 'clients', 'staff']
    : ['schedule', 'clients', 'staff', 'settings'];
};

/**
 * 起動したとき（#/・#/home・知らない URL）・切った機能の URL から移る先（PRD D213・D400・D401）：ホームは無いので予定の画面
 * （最初に開く画面と同じ：繰り返しを使うなら月、使わないなら週。lib/startGuide。エキスパート機能の入切に関わらず同じ）
 */
export const homePath = (features: Features): '/month' | '/week' => startGuidePlanPath(features);

/**
 * 操作の項目か（URL に ?do= を持つ。例：「欠勤・キャンセルを登録」＝ `/plan?date=…&do=absence`。PRD D180・D231）。
 * 日付・月だけを持つリンク（今日の予定・◯月の予定・担当を組む）は画面の項目
 */
export const isNavAction = (to: string): boolean => /[?&]do=/.test(to);

/**
 * 今の画面に当たる URL のパス。古いリンクの #/schedule は日の予定。〈利用者さん〉・〈スタッフ〉の画面（`/clients/:id`・`/staff/:id`。
 * PRD D308）は一覧の項目に当てる
 */
export function activeNavPath(pathname: string): string {
  if (pathname === '/schedule') return '/plan';
  const person = /^\/(clients|staff)\/[^/]+$/.exec(pathname);
  if (person) return `/${person[1]}`;
  return pathname;
}

/** そのメニューの項目が今の画面か（操作の項目はいつも false。match があればそのどれか。PRD D273・D275） */
export const isActiveNav = (item: NavEntry, pathname: string): boolean =>
  !isNavAction(item.to) && (item.match ?? [item.to]).includes(activeNavPath(pathname));

/**
 * 上の帯の日付の選択を出す画面（PRD D267）：選んでいる日付で中身が変わる画面だけ。案を比べる・勤務の見込み
 * （日付の月）・勤務時間（シフト）（今日の列の印）。日・週・月の予定は画面の中のナビの行（ScheduleNav）で送るので出さない（PRD D347）。ほかの画面（空き状況・一覧・相性・条件・設定・データ）では出さない
 * （日付は覚えたまま。〈利用者さん〉一覧・相性の絞り込みの週は、選んでいる日付の週のまま「N/D からの週」と書く）
 */
export const DATE_PAGES: readonly string[] = ['/compare', '/workload', '/availability'];

/** 上の帯に日付の選択を出すか（古い #/schedule は日の予定） */
export const showsDateSwitch = (pathname: string): boolean => DATE_PAGES.includes(activeNavPath(pathname));

/** 画面の一覧（パレット）に出さない画面の名前（上の帯。案を比べるは担当を組むから開く。ADR-0063。登録の案内は自分のデータで始めたあとの3段。ADR-0073） */
const EXTRA_TITLES: Record<string, string> = {
  '/compare': '提案を比べる',
  '/start': '登録の案内',
  '/feedback': 'ご意見',
};

/**
 * 上の帯に出す今の画面の名前：グループの見出しと項目名（例「人」と「利用者さん一覧」。帯では「人・利用者さん一覧」と並べ、
 * 狭い画面で入りきらないときは項目名をまとめて次の行へ送る。PRD D179）。groups は画面の一覧（screenSections）。
 * 見出しの無いグループ（〈利用者さん〉・〈スタッフ〉）と「予定」のグループ（項目名が「月の予定」などで見出しと重なる）は group が null。
 * 一覧に無い画面は null（PRD D132・D179・D230・D273）
 */
export function navTitleParts(
  groups: readonly NavSection[],
  pathname: string,
): { group: string | null; item: string } | null {
  for (const g of groups) {
    const item = g.items.find((i) => isActiveNav(i, pathname));
    if (item) return { group: g.title && g.title !== SCHEDULE_GROUP ? g.title : null, item: item.label };
  }
  const extra = EXTRA_TITLES[activeNavPath(pathname)];
  return extra ? { group: null, item: extra } : null;
}

/**
 * 下のタブの項目：メニューから bottomTabKeys の順に引く（メニューに無い項目は出さない。PRD D401・D400）
 */
export function bottomTabs<T extends NavEntry & { key: string; children?: readonly T[] }>(
  groups: readonly NavSection<T>[],
  features: Features,
): T[] {
  const all = groups.flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]));
  return bottomTabKeys(features).flatMap((key) => all.find((i) => i.key === key) ?? []);
}

/** 下のタブの名前：短い名前（予定・組むなど）。無ければメニューの名前（PRD D401） */
export const tabLabel = (item: NavEntry): string => item.short ?? item.label;

/**
 * 下のタブ・メニューの項目を押したとき：今開いている画面そのものなら何もしない（'stay'。押し直して URL のクエリ＝画面の状態を
 * 消さない。PRD D133・D401）。ほかは移る（'go'。比較から「予定」は覚えた表示へ移る）
 */
export function tabClick(item: NavEntry, pathname: string): 'stay' | 'go' {
  // 〈利用者さん〉の画面（`/clients/:id`）から一覧の項目を押したら一覧へ移る（同じ画面ではない）
  return !isNavAction(item.to) && item.to === (pathname === '/schedule' ? '/plan' : pathname) ? 'stay' : 'go';
}

/** メニューの項目のアイコンの名前（アイコンの部品は App で引く。純粋関数に React を持ち込まない） */
export type NavIcon =
  | 'month'
  | 'week'
  | 'day'
  | 'compare'
  | 'absence'
  | 'vacancy'
  | 'clients'
  | 'people'
  | 'compat'
  | 'staff'
  | 'hours'
  | 'workload'
  | 'arrange'
  | 'rules'
  | 'types'
  | 'items'
  | 'settings'
  | 'data';
/**
 * メニューの項目（アイコンの名前つき）。key は下のタブで引く名前（URL が覚えた表示で変わる項目があるため）。
 * children は畳める子の項目（PRD D401）、badge は件数の印
 */
export type MenuItem = NavEntry & {
  key: string;
  icon: NavIcon;
  children?: readonly MenuItem[];
  badge?: { text: string; label: string };
};

/** メニューの件数の印（PRD D401）：組む月の担当なしの日の数 */
export type MenuBadges = {
  planUnassignedDays?: number;
};

/** 畳める項目（親の key。いまは「組む」だけ）と既定で開いておくか（PRD D401） */
export const NAV_OPEN_DEFAULT: Readonly<Record<string, boolean>> = { arrange: true };

/** 欠勤・キャンセルの欄を今日の日の予定で開く URL（PRD D172） */
export const absenceHref = (today: string): string => `/plan?date=${today}&do=${SUDDEN_DO}`;

/** メニューの「予定」「設定」で開く画面（最後に開いた表示・タブ。無ければ既定。PRD D273・D275） */
export type LastViews = { schedule?: string | null; settings?: string | null; people?: PeopleSide };

/**
 * メニューの「設定」で開くタブ：最後に開いた設定のタブ（切っていなければ）、無ければ先頭のタブ
 * （訪問の種類は土台で切れないので、いつも訪問の種類。ADR-0047・PRD D275）。設定のタブに無い画面（前に覚えた条件の重みなど）は先頭のタブ
 */
export function settingsHref(features: Features, last?: string | null): string {
  const tabs = settingsTabs(features);
  if (last && tabs.some((t) => t.to === last)) return last;
  return tabs[0]?.to ?? '/settings';
}

/** メニューの「予定」で開く表示：最後に開いた月・週・日の予定、無ければ日の予定（PRD D273） */
export const scheduleHref = (last?: string | null): string =>
  last && SCHEDULE_VIEWS.includes(last) ? last : SCHEDULE_DEFAULT;

/**
 * 組む（エキスパート機能が入のとき。ADR-0100）：条件の重み・担当を組む。条件の重みは自動の組み・担当を組むで AI が使う重みで、
 * いつでもここから開く。〈利用者さん〉・〈スタッフ〉の一覧と予定と相性は人の項目（PRD D401）。
 * 件数の印は「組む」の1つだけ（担当なしの日の数）
 */
function arrangeMenuItem(features: Features, today: string, badges: MenuBadges): MenuItem {
  const children: MenuItem[] = [
    { key: 'arrange:rules', to: '/rules', label: '条件の重み', icon: 'rules', match: ['/rules'] },
    {
      key: 'arrange:assign',
      to: `/arrange?ym=${planYm(today)}`,
      label: '担当を組む',
      icon: 'arrange',
      match: ['/arrange', '/compare'],
    },
  ];
  return {
    key: 'arrange',
    to: '/arrange',
    label: '組む',
    short: '組む',
    icon: 'arrange',
    match: ARRANGE_PATHS,
    children: children.filter((i) => isHrefOn(features, i.to)),
    badge: arrangeBadge(badges),
  };
}

/** 「組む」の件数の印（担当なしの日の数。PRD D401） */
function arrangeBadge(badges: MenuBadges): MenuItem['badge'] {
  if (badges.planUnassignedDays)
    return { text: `${badges.planUnassignedDays}日`, label: `担当なしの訪問がある日 ${badges.planUnassignedDays}日` };
  return undefined;
}

/**
 * メニューの並び（PRD D400・D401。ADR-0054・0063・0067・0072・0073・0074・0078）：見出しの無いグループ1つ。
 * エキスパート機能が切なら 予定・空き状況・〈利用者さん〉・〈スタッフ〉・設定 の5つ（呼び名は terms）、入なら その〈スタッフ〉と設定の間に「組む」を足した6つ。
 * ホームは無く（要対応は予定の上の帯。PRD D404）、欠勤・キャンセルは予定の操作の行から開く。
 * 子の項目を持つのは入の「組む」だけ（条件の重み・担当を組む。ADR-0100）。件数の印も「組む」の1つ（badges）。
 * 担当を組む（#/arrange）は切では日の予定などから開き、メニューには出さない。
 * 今の画面の印：予定は月・週・日（切はさらに比較・担当を組む）、空き状況は空き状況、〈利用者さん〉は一覧・予定と相性、
 * 〈スタッフ〉は一覧・勤務時間（シフト）・勤務の見込み、相性は最後に開いた側（入切とも。lib/peopleTabs。PRD D394）、
 * 設定は設定のタブ（親を押すと最後に開いたタブ）。
 * 案を比べるは担当を組むから開く（メニュー・パレットには出さない）。下のタブは短い名前（short）も使う。today は今日。
 * features で切った機能の項目は出さない（lib/features の表から引く）
 */
export function menuSections(
  terms: Pick<Terms, 'client' | 'staff'>,
  today: string,
  features: Features,
  last: LastViews = {},
  badges: MenuBadges = {},
): NavSection<MenuItem>[] {
  const expert = isOn(features, 'expert');
  const person = (side: PeopleSide, label: string): MenuItem => ({
    key: side,
    to: `/${side}`,
    label,
    short: label,
    icon: side,
    match: peopleMatch(side, last.people),
  });
  const items: MenuItem[] = [
    {
      key: 'schedule',
      to: scheduleHref(last.schedule),
      label: '予定',
      short: '予定',
      icon: 'day',
      match: expert ? SCHEDULE_PATHS : [...SCHEDULE_PATHS, '/arrange', '/compare'],
    },
    // 空き状況は予定の次の上の段の項目（入切とも。PRD D400・D401。ADR-0078）
    { key: 'vacancy', to: '/vacancy', label: '空き状況', short: '空き状況', icon: 'vacancy' },
    person('clients', terms.client),
    person('staff', terms.staff),
    ...(expert ? [arrangeMenuItem(features, today, badges)] : []),
    {
      key: 'settings',
      to: settingsHref(features, last.settings),
      label: '設定',
      short: '設定',
      icon: 'settings',
      match: settingsTabs(features).map((t) => t.to),
    },
  ];
  const on = items.filter((i) => isHrefOn(features, i.to));
  return on.length > 0 ? [{ items: on }] : [];
}

/**
 * 画面の一覧（PRD D182・D230・D273・D275・D331・D394）：コマンドパレットの「画面」と上の帯の画面の名前はここから引く（案を比べるは出さない）。
 * メニューでタブにまとめた画面（月・週・日の予定・人のタブ・勤務の見込み・設定のタブ）も1つずつ持つ。
 * 予定（月の予定・週の予定・日の予定・空き状況。切のときは担当を組むもここ。ホームは無い。PRD D400・D401）／
 * 人（区分の名前は付けない。予定と相性・〈利用者さん〉・〈スタッフ〉は呼び名そのまま・相性・勤務時間（シフト）・勤務の見込み）／
 * 組む（入のとき：条件の重み・担当を組む）／
 * 設定（訪問の種類・特性の項目・管理者設定・データ）。
 * 項目名は画面の見出しと同じ。切った機能の画面は出さない
 */
export function screenSections(terms: Pick<Terms, 'client' | 'staff'>, features: Features): NavSection<MenuItem>[] {
  const expert = isOn(features, 'expert');
  const arrangeScreen: MenuItem = { key: 'arrange', to: '/arrange', label: '担当を組む', icon: 'arrange' };
  const vacancyScreen: MenuItem = { key: 'vacancy', to: '/vacancy', label: '空き状況', icon: 'vacancy' };
  const clientsScreen: MenuItem = { key: 'clients', to: '/clients', label: terms.client, icon: 'clients' };
  const staffScreen: MenuItem = { key: 'staff', to: '/staff', label: terms.staff, icon: 'staff' };
  const basicsScreen: MenuItem = { key: 'basics', to: '/basics', label: '予定と相性', icon: 'people' };
  const workScreens: MenuItem[] = [
    { key: 'compat', to: '/compat', label: '相性', icon: 'compat' },
    { key: 'availability', to: '/availability', label: '勤務時間（シフト）', icon: 'hours' },
    { key: 'workload', to: '/workload', label: '勤務の見込み', icon: 'workload' },
  ];
  const all: NavSection<MenuItem>[] = [
    {
      title: SCHEDULE_GROUP,
      items: [
        { key: 'month', to: '/month', label: '月の予定', icon: 'month' },
        { key: 'week', to: '/week', label: '週の予定', icon: 'week' },
        { key: 'day', to: '/plan', label: '日の予定', icon: 'day' },
        // エキスパート機能が切なら「予定を組む」のグループは出さず、担当を組むは予定のグループに置く（ADR-0072）
        ...(expert ? [] : [arrangeScreen]),
        // 空き状況はメニューでは予定の次の項目なので、パレットでも予定のグループに置く（PRD D400・D401）
        vacancyScreen,
      ],
    },
    // 人：区分の名前は付けず、1つのグループに並べる（上の帯は項目名だけ。PRD D400・D385・D394）。予定と相性は入切ともここ（ADR-0100）
    { items: [basicsScreen, clientsScreen, staffScreen, ...workScreens] },
    {
      title: '組む',
      items: expert ? [{ key: 'rules', to: '/rules', label: '条件の重み', icon: 'rules' }, arrangeScreen] : [],
    },
    {
      title: '設定',
      items: [
        { key: 'types', to: '/types', label: '訪問の種類', icon: 'types' },
        { key: 'items', to: '/items', label: '特性の項目', icon: 'items' },
        { key: 'settings', to: '/settings', label: '管理者設定', icon: 'settings' },
        { key: 'data', to: '/data', label: 'データ', icon: 'data' },
      ],
    },
  ];
  return all.flatMap((g) => {
    const items = g.items.filter((i) => isHrefOn(features, i.to));
    return items.length > 0 ? [{ ...g, items }] : [];
  });
}
