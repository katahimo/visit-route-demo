// メニューの決まり（PRD D132〜D135・D178〜D180・D230〜D232・D326。ADR-0034・0045・0054。design.md §4 app）。
// 左のメニュー・スマホの引き出し・下のタブ（menuSections）と、上の帯の画面の名前・コマンドパレットの画面（screenSections）で、
// 並びと今の画面をどれと見るかを1か所で決める
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { isHrefOn } from './features';
import { planLabel, planYm } from './scheduleMode';
import { SUDDEN_DO } from './sudden';

/**
 * メニューの1項目（アイコンなどは呼ぶ側で足す）。to に `?` を含むものは操作（画面の中の欄を開く）で、今の画面の印を付けない。
 * short は下のタブの短い名前（無ければ label。PRD D232）。
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
 * 基本情報の画面（ADR-0067）：予定と相性の表・〈利用者さん〉・〈スタッフ〉・相性・勤務時間（シフト）・勤務の見込み
 * （〈利用者さん〉・〈スタッフ〉の画面も一覧に当てる。activeNavPath）。予定を組むの 1 の段
 */
export const BASICS_PATHS: readonly string[] = [
  '/basics',
  '/clients',
  '/staff',
  '/compat',
  '/availability',
  '/workload',
];
/** メニューの「予定を組む」が受け持つ画面（ADR-0063・ADR-0065〜ADR-0067）：基本情報・条件の重み・組み方の標準・担当を組む・案を比べる */
export const ARRANGE_PATHS: readonly string[] = [...BASICS_PATHS, '/rules', '/standard', '/arrange', '/compare'];
/** 予定を組むの段（ADR-0067）：基本情報・組み方の標準の2段（同じ画面で1段ずつ出す）・担当を組む */
export type ArrangeStepKey = 'basics' | 'proposals' | 'register' | 'arrange';
/** 予定を組むの段の並び（作業の順。ADR-0067）。to は段の画面。条件の重みは段に入れない（組み方の標準の 2 からの寄り道） */
export const ARRANGE_STEPS: readonly { key: ArrangeStepKey; to: string; label: string }[] = [
  { key: 'basics', to: '/basics', label: '基本情報' },
  { key: 'proposals', to: '/standard', label: '案をくらべる' },
  { key: 'register', to: '/standard', label: '標準にする' },
  { key: 'arrange', to: '/arrange', label: '担当を組む' },
];
/** 予定を組むの段の一覧の型 */
export type ArrangeStep = (typeof ARRANGE_STEPS)[number];
/**
 * 出す段（ADR-0067）：full（組み方の標準が無い・組み方の標準の画面）なら4段、標準があれば 基本情報 → 担当を組む の2段
 */
export const arrangeSteps = (full: boolean): readonly ArrangeStep[] =>
  full ? ARRANGE_STEPS : ARRANGE_STEPS.filter((s) => s.key === 'basics' || s.key === 'arrange');
/** 段の次（最後の段なら null） */
export const nextArrangeStep = (steps: readonly ArrangeStep[], key: ArrangeStepKey): ArrangeStep | null =>
  steps[steps.findIndex((s) => s.key === key) + 1] ?? null;
/** 段の前（最初の段なら null） */
export const prevArrangeStep = (steps: readonly ArrangeStep[], key: ArrangeStepKey): ArrangeStep | null => {
  const i = steps.findIndex((s) => s.key === key);
  return i > 0 ? (steps[i - 1] ?? null) : null;
};
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
 * 基本情報のタブ（並び。ADR-0067。ADR-0054 の人のタブを予定を組むの 1 へ移した）。メニューは予定を組むの子「基本情報」1項目で、
 * 画面の上のタブで切り替える（設定のタブと同じ形）。勤務の見込みは勤務時間（シフト）の続き（タブは勤務時間（シフト）に印）
 */
export const BASICS_TABS: readonly { to: string; label: 'client' | 'staff' | string; match?: readonly string[] }[] = [
  { to: '/basics', label: '予定と相性' },
  { to: '/clients', label: 'client' },
  { to: '/staff', label: 'staff' },
  { to: '/compat', label: '相性' },
  { to: '/availability', label: '勤務時間（シフト）', match: ['/availability', '/workload'] },
];

/** 切っていない基本情報のタブ（名前は呼び方から。〈利用者さん〉・〈スタッフ〉は「一覧」を付けない） */
export const basicsTabs = (
  terms: Pick<Terms, 'client' | 'staff'>,
  features: Features,
): { to: string; label: string; match: readonly string[] }[] =>
  BASICS_TABS.filter((t) => isHrefOn(features, t.to)).map((t) => ({
    to: t.to,
    label: t.label === 'client' ? terms.client : t.label === 'staff' ? terms.staff : t.label,
    match: t.match ?? [t.to],
  }));

/** 下のタブに並べる項目の key（ホーム・予定・欠勤。4つ目は「探す」（コマンドパレット）、5つ目は「メニュー」のボタン。PRD D336） */
export const BOTTOM_TABS: readonly string[] = ['home', 'schedule', 'absence'];

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
 * （日付の月）・勤務時間（シフト）（今日の列の印）。日・週・月の予定は画面の中のナビの行（ScheduleNav）で送るので出さない（PRD D347）。ほかの画面（ホーム・空き状況・一覧・相性・条件・設定・データ）では出さない
 * （日付は覚えたまま。〈利用者さん〉一覧・相性の絞り込みの週は、選んでいる日付の週のまま「N/D からの週」と書く）
 */
export const DATE_PAGES: readonly string[] = ['/compare', '/workload', '/availability'];

/** 上の帯に日付の選択を出すか（古い #/schedule は日の予定） */
export const showsDateSwitch = (pathname: string): boolean => DATE_PAGES.includes(activeNavPath(pathname));

/** 画面の一覧（パレット）に出さない画面の名前（上の帯。案を比べるは担当を組むから開く。ADR-0063） */
const EXTRA_TITLES: Record<string, string> = { '/compare': '提案を比べる' };

/**
 * 上の帯に出す今の画面の名前：グループの見出しと項目名（例「人」と「利用者さん一覧」。帯では「人・利用者さん一覧」と並べ、
 * 狭い画面で入りきらないときは項目名をまとめて次の行へ送る。PRD D179）。groups は画面の一覧（screenSections）。
 * 見出しの無いグループ（ホーム）と「予定」のグループ（項目名が「月の予定」などで見出しと重なる）は group が null。
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

/** 下のタブの項目：メニュー（子の項目も）から BOTTOM_TABS の順に引く（メニューに無い項目は出さない。PRD D336） */
export function bottomTabs<T extends NavEntry & { key: string; children?: readonly T[] }>(
  groups: readonly NavSection<T>[],
): T[] {
  const all = groups.flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]));
  return BOTTOM_TABS.flatMap((key) => all.find((i) => i.key === key) ?? []);
}

/** 下のタブの名前：短い名前（ホーム・予定・欠勤）。無ければメニューの名前（PRD D336） */
export const tabLabel = (item: NavEntry): string => item.short ?? item.label;

/**
 * 下のタブ・メニューの項目を押したとき：今開いている画面そのものなら何もしない（'stay'。押し直して URL のクエリ＝画面の状態を
 * 消さない。PRD D133・D336）。ほかは移る（'go'。比較から「予定」は覚えた表示へ移る）
 */
export function tabClick(item: NavEntry, pathname: string): 'stay' | 'go' {
  // 〈利用者さん〉の画面（`/clients/:id`）から一覧の項目を押したら一覧へ移る（同じ画面ではない）
  return !isNavAction(item.to) && item.to === (pathname === '/schedule' ? '/plan' : pathname) ? 'stay' : 'go';
}

/** メニューの項目のアイコンの名前（アイコンの部品は App で引く。純粋関数に React を持ち込まない） */
export type NavIcon =
  | 'home'
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
  | 'standard'
  | 'rules'
  | 'types'
  | 'items'
  | 'settings'
  | 'data';
/**
 * メニューの項目（アイコンの名前つき）。key は下のタブで引く名前（URL が覚えた表示で変わる項目があるため）。
 * children は畳める子の項目（PRD D349）、badge は件数の印
 */
export type MenuItem = NavEntry & {
  key: string;
  icon: NavIcon;
  children?: readonly MenuItem[];
  badge?: { text: string; label: string };
};

/**
 * メニューの件数の印と状態（PRD D349・D360・D363）：組む月の担当なしの日の数・今日をまだ伝えていないか・組み方の標準があるか
 * （あれば予定を組むの子に組み方の標準を出さない。ADR-0066 追記）・基本情報が最後に組んだあとに変わったか（ADR-0067）
 */
export type MenuBadges = {
  planUnassignedDays?: number;
  todayUntold?: boolean;
  hasStandard?: boolean;
  basisChanged?: boolean;
};

/** 畳める項目（親の key）と既定で開いておくか（設定はふだん畳む。PRD D349） */
export const NAV_OPEN_DEFAULT: Readonly<Record<string, boolean>> = {
  schedule: true,
  arrange: true,
  settings: false,
};

/** 設定のタブのアイコン */
const SETTINGS_ICON: Record<string, NavIcon> = {
  '/types': 'types',
  '/items': 'items',
  '/settings': 'settings',
  '/data': 'data',
};
/** 欠勤・キャンセルの欄を今日の日の予定で開く URL（ホームのカードと同じ。PRD D172） */
export const absenceHref = (today: string): string => `/plan?date=${today}&do=${SUDDEN_DO}`;

/** メニューの「予定」「設定」で開く画面（最後に開いた表示・タブ。無ければ既定。PRD D273・D275） */
export type LastViews = { schedule?: string | null; settings?: string | null };

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
 * メニューの並び（PRD D326・D349・D355・D364。ADR-0054・0063・0067）：見出しの無い5項目 ホーム・予定を組む・予定・空き状況・設定。
 * 「予定」「予定を組む」「設定」は畳める子の項目を持つ（既定は設定だけ畳む。今の画面の親はいつも開く）。
 * 「予定」の子：今日の予定（今日の日の予定）・◯月の予定（月の後半は来月、前半は今月の月の予定）・欠勤・キャンセル（今日の日の予定で
 * 欠勤・キャンセルの欄を開く）。親を押すと最後に開いた表示（既定は日の予定）。「予定を組む」の子：基本情報（人の項目。
 * 基本情報のタブの画面に印）・〈利用者さん〉一覧・〈スタッフ〉一覧（その画面に印。ADR-0067 追記）・組み方の標準（標準が無いときだけ）・担当を組む
 * （作業の順。条件の重みは組み方の標準の寄り道。ADR-0066・ADR-0067）。
 * 「設定」の子は設定のタブ。親を押すと最後に開いたタブ。
 * 案を比べるは担当を組むから開く（メニュー・パレットには出さない）。
 * 下のタブに出す項目は短い名前（short）も持つ。today は今日。badges は件数の印。
 * features で切った機能の項目は出さない（lib/features の表から引く）
 */
export function menuSections(
  terms: Pick<Terms, 'client' | 'staff'>,
  today: string,
  features: Features,
  last: LastViews = {},
  badges: MenuBadges = {},
): NavSection<MenuItem>[] {
  const scheduleChildren: MenuItem[] = [
    {
      key: 'today',
      to: `/plan?date=${today}`,
      label: '今日の予定',
      icon: 'day',
      match: ['/plan'],
      badge: badges.todayUntold ? { text: '未確定', label: '今日はまだ伝えていない' } : undefined,
    },
    {
      key: 'month-view',
      to: `/month?ym=${planYm(today)}`,
      label: planLabel(today),
      icon: 'month',
      match: ['/month', '/week'],
    },
    { key: 'absence', to: absenceHref(today), label: '欠勤・キャンセル', short: '欠勤', icon: 'absence' },
  ];
  // 予定を組む（ADR-0063・ADR-0066・ADR-0067）：作業の順に 基本情報・組み方の標準（条件の重みもここ）・担当を組む
  // （基本情報が変わった印、無ければ担当なしの日の数の印）。標準を登録したあとは組み方の標準を出さない
  // （標準の見直しは担当を組むの［標準の組み方を変える］から。印は担当を組む。ADR-0066 追記）
  const basicsChild: MenuItem = {
    key: 'arrange:basics',
    to: '/basics',
    label: '基本情報',
    icon: 'people',
    // 〈利用者さん〉一覧・〈スタッフ〉一覧はすぐ下の子に印（ADR-0067 追記）
    match: BASICS_PATHS.filter((p) => p !== '/clients' && p !== '/staff'),
  };
  // よく開く一覧は基本情報のタブだけでなく子にも出す（〈利用者さん〉・〈スタッフ〉の画面もここに印。ADR-0067 追記）
  const listChildren: MenuItem[] = [
    { key: 'arrange:clients', to: '/clients', label: `${terms.client}一覧`, icon: 'clients' },
    { key: 'arrange:staff', to: '/staff', label: `${terms.staff}一覧`, icon: 'staff' },
  ];
  const standardChild: MenuItem = {
    key: 'arrange:standard',
    to: '/standard',
    label: '組み方の標準',
    icon: 'standard',
    match: ['/standard', '/rules'],
  };
  const arrangeChildren: MenuItem[] = [
    basicsChild,
    ...listChildren,
    ...(badges.hasStandard ? [] : [standardChild]),
    {
      key: 'arrange:assign',
      to: `/arrange?ym=${planYm(today)}`,
      label: '担当を組む',
      icon: 'arrange',
      match: badges.hasStandard ? ['/arrange', '/compare', '/standard', '/rules'] : ['/arrange', '/compare'],
      // 標準が無い間は組み直しを知らせない（担当を組むの画面の知らせと同じ。PRD D363）
      badge:
        badges.hasStandard && badges.basisChanged
          ? { text: '変更', label: '基本情報が最後に組んだあとに変わった（組み直す）' }
          : badges.planUnassignedDays
            ? { text: `${badges.planUnassignedDays}日`, label: `担当なしの訪問がある日 ${badges.planUnassignedDays}日` }
            : undefined,
    },
  ];
  const items: MenuItem[] = [
    { key: 'home', to: '/home', label: 'ホーム', short: 'ホーム', icon: 'home' },
    {
      key: 'arrange',
      to: '/arrange',
      label: '予定を組む',
      short: '組む',
      icon: 'arrange',
      match: ARRANGE_PATHS,
      children: arrangeChildren.filter((i) => isHrefOn(features, i.to)),
    },
    {
      key: 'schedule',
      to: scheduleHref(last.schedule),
      label: '予定',
      short: '予定',
      icon: 'day',
      match: SCHEDULE_PATHS,
      children: scheduleChildren.filter((i) => isHrefOn(features, i.to)),
    },
    { key: 'vacancy', to: '/vacancy', label: '空き状況', short: '空き状況', icon: 'vacancy' },
    // 設定：訪問の種類・特性の項目・管理者設定（PRD D210。だれでも開ける）・データを1つにまとめる（タブ。PRD D275）
    {
      key: 'settings',
      to: settingsHref(features, last.settings),
      label: '設定',
      icon: 'settings',
      match: settingsTabs(features).map((t) => t.to),
      children: settingsTabs(features).map((t) => ({
        key: `settings:${t.to}`,
        to: t.to,
        label: t.label,
        icon: SETTINGS_ICON[t.to] ?? 'settings',
      })),
    },
  ];
  const on = items.filter((i) => isHrefOn(features, i.to));
  return on.length > 0 ? [{ items: on }] : [];
}

/**
 * 画面の一覧（PRD D182・D230・D273・D275・D331）：コマンドパレットの「画面」と上の帯の画面の名前はここから引く（案を比べるは出さない）。
 * メニューでタブにまとめた画面（月・週・日の予定・基本情報のタブ・勤務の見込み・設定のタブ）も1つずつ持つ。
 * ホーム／予定（月の予定・週の予定・日の予定）／予定を組む（条件の重み・組み方の標準・担当を組む）／空き状況／
 * 基本情報（予定と相性・〈利用者さん〉一覧・〈スタッフ〉一覧・相性・勤務時間（シフト）・勤務の見込み。ADR-0067）／
 * 設定（訪問の種類・特性の項目・管理者設定・データ）。
 * 項目名は画面の見出しと同じ。切った機能の画面は出さない
 */
export function screenSections(terms: Pick<Terms, 'client' | 'staff'>, features: Features): NavSection<MenuItem>[] {
  const all: NavSection<MenuItem>[] = [
    { items: [{ key: 'home', to: '/home', label: 'ホーム', icon: 'home' }] },
    {
      title: SCHEDULE_GROUP,
      items: [
        { key: 'month', to: '/month', label: '月の予定', icon: 'month' },
        { key: 'week', to: '/week', label: '週の予定', icon: 'week' },
        { key: 'day', to: '/plan', label: '日の予定', icon: 'day' },
      ],
    },
    {
      title: '予定を組む',
      items: [
        { key: 'rules', to: '/rules', label: '条件の重み', icon: 'rules' },
        { key: 'standard', to: '/standard', label: '組み方の標準', icon: 'standard' },
        { key: 'arrange', to: '/arrange', label: '担当を組む', icon: 'arrange' },
      ],
    },
    { items: [{ key: 'vacancy', to: '/vacancy', label: '空き状況', icon: 'vacancy' }] },
    {
      title: '基本情報',
      items: [
        { key: 'basics', to: '/basics', label: '予定と相性', icon: 'people' },
        { key: 'clients', to: '/clients', label: `${terms.client}一覧`, icon: 'clients' },
        { key: 'staff', to: '/staff', label: `${terms.staff}一覧`, icon: 'staff' },
        { key: 'compat', to: '/compat', label: '相性', icon: 'compat' },
        { key: 'availability', to: '/availability', label: '勤務時間（シフト）', icon: 'hours' },
        { key: 'workload', to: '/workload', label: '勤務の見込み', icon: 'workload' },
      ],
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
