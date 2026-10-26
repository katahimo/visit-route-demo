import { describe, expect, it } from 'vitest';
import { applyTemplate } from './features';
import {
  ARRANGE_PATHS,
  ARRANGE_STEPS,
  absenceHref,
  activeNavPath,
  arrangeSteps,
  basicsTabs,
  bottomTabs,
  isActiveNav,
  isNavAction,
  isScheduleView,
  isSettingsPath,
  type MenuItem,
  menuSections,
  NAV_OPEN_DEFAULT,
  navTitle,
  navTitleParts,
  nextArrangeStep,
  prevArrangeStep,
  SCHEDULE_DEFAULT,
  scheduleHref,
  screenSections,
  settingsHref,
  settingsTabs,
  showsDateSwitch,
  tabClick,
  tabLabel,
} from './nav';

const terms = { client: '利用者さん', staff: 'スタッフ' };
const TODAY = '2026-10-21';
const groups = menuSections(TODAY, {});
const screens = screenSections(terms, {});
/** key でメニューの項目を引く（子の項目も） */
const item = (key: string, g = groups): MenuItem =>
  g.flatMap((x) => x.items.flatMap((i) => [i, ...(i.children ?? [])])).find((i) => i.key === key)!;

describe('menuSections（PRD D326・D349・D364。ADR-0054・0063・0067）', () => {
  it('見出しの無い5項目：ホーム・予定を組む・予定・空き状況・設定（人は予定を組むの基本情報へ）', () => {
    expect(groups.map((g) => g.title ?? null)).toEqual([null]);
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toEqual([
      'ホーム',
      '予定を組む',
      '予定',
      '空き状況',
      '設定',
    ]);
  });
  it('予定の子はリンク（今日の予定・◯月の予定・欠勤・キャンセル）、予定を組むの子は基本情報・組み方の標準・担当を組む（ADR-0067）', () => {
    expect(item('schedule').children?.map((i) => [i.label, i.to])).toEqual([
      ['今日の予定', '/plan?date=2026-10-21'],
      ['11月の予定', '/month?ym=2026-11'],
      ['欠勤・キャンセル', '/plan?date=2026-10-21&do=absence'],
    ]);
    expect(item('arrange').children?.map((i) => [i.key, i.label, i.to])).toEqual([
      ['arrange:basics', '基本情報', '/basics'],
      ['arrange:standard', '組み方の標準', '/standard'],
      ['arrange:assign', '担当を組む', '/arrange?ym=2026-11'],
    ]);
    // 基本情報の印は基本情報のタブの画面と〈利用者さん〉・〈スタッフ〉の画面
    for (const p of [
      '/basics',
      '/clients',
      '/staff',
      '/compat',
      '/availability',
      '/workload',
      '/clients/c1',
      '/staff/s1',
    ])
      expect(isActiveNav(item('arrange:basics'), p)).toBe(true);
    expect(item('settings').children?.map((i) => i.to)).toEqual(['/types', '/items', '/settings', '/data']);
    // 前半は今月
    const early = menuSections('2026-10-03', {});
    expect(item('month-view', early).to).toBe('/month?ym=2026-10');
    expect(item('arrange:assign', early).to).toBe('/arrange?ym=2026-10');
    expect(NAV_OPEN_DEFAULT).toEqual({ schedule: true, arrange: true, settings: false });
  });
  it('件数の印：組む月の担当なしの日は「担当を組む」、今日をまだ伝えていないは「今日の予定」', () => {
    const g = menuSections(TODAY, {}, {}, { planUnassignedDays: 3, todayUntold: true });
    expect(item('arrange:assign', g).badge).toEqual({ text: '3日', label: '担当なしの訪問がある日 3日' });
    expect(item('today', g).badge?.text).toBe('未確定');
    expect(item('arrange:assign').badge).toBeUndefined();
    // 基本情報が変わった印は担当なしの日の数より先（ADR-0067）
    const changed = menuSections(TODAY, {}, {}, { planUnassignedDays: 3, basisChanged: true });
    expect(item('arrange:assign', changed).badge?.text).toBe('変更');
  });
  it('今の画面の印は画面で決める（予定の子・予定を組むの子）', () => {
    expect(isActiveNav(item('today'), '/plan')).toBe(true);
    expect(isActiveNav(item('month-view'), '/week')).toBe(true);
    expect(isActiveNav(item('month-view'), '/plan')).toBe(false);
    expect(isActiveNav(item('absence'), '/plan')).toBe(false);
    expect(isActiveNav(item('schedule'), '/compare')).toBe(false);
    expect(isActiveNav(item('arrange'), '/compare')).toBe(true);
    expect(isActiveNav(item('arrange:assign'), '/compare')).toBe(true);
    expect(isActiveNav(item('arrange:standard'), '/standard')).toBe(true);
    expect(isActiveNav(item('arrange'), '/rules')).toBe(true);
    // 条件の重みは組み方の標準の寄り道（ADR-0066）
    expect(isActiveNav(item('arrange:standard'), '/rules')).toBe(true);
    expect(isActiveNav(item('settings'), '/rules')).toBe(false);
  });
  it('予定を組むの段：基本情報 → 案をくらべる → 標準にする → 担当を組む。標準があれば2段。条件の重みは段・子に入れない（ADR-0067）', () => {
    expect(ARRANGE_PATHS).toEqual([
      '/basics',
      '/clients',
      '/staff',
      '/compat',
      '/availability',
      '/workload',
      '/rules',
      '/standard',
      '/arrange',
      '/compare',
    ]);
    expect(ARRANGE_STEPS.map((s) => [s.key, s.to, s.label])).toEqual([
      ['basics', '/basics', '基本情報'],
      ['proposals', '/standard', '案をくらべる'],
      ['register', '/standard', '標準にする'],
      ['arrange', '/arrange', '担当を組む'],
    ]);
    const full = arrangeSteps(true);
    expect(nextArrangeStep(full, 'basics')?.key).toBe('proposals');
    expect(nextArrangeStep(full, 'register')?.key).toBe('arrange');
    expect(nextArrangeStep(full, 'arrange')).toBeNull();
    expect(prevArrangeStep(full, 'basics')).toBeNull();
    expect(prevArrangeStep(full, 'proposals')?.key).toBe('basics');
    const short = arrangeSteps(false);
    expect(short.map((s) => s.key)).toEqual(['basics', 'arrange']);
    expect(nextArrangeStep(short, 'basics')?.key).toBe('arrange');
    // 標準を登録したあとは子は基本情報・担当を組むで、組み方の標準・条件の重みも担当を組むに印（ADR-0066 追記）
    const std = menuSections(TODAY, {}, {}, { hasStandard: true });
    expect(item('arrange', std).children?.map((i) => i.key)).toEqual(['arrange:basics', 'arrange:assign']);
    expect(isActiveNav(item('arrange:assign', std), '/standard')).toBe(true);
    expect(isActiveNav(item('arrange:assign', std), '/rules')).toBe(true);
    const off = menuSections(TODAY, { rules: false });
    expect(item('arrange', off).children?.map((i) => i.key)).toEqual([
      'arrange:basics',
      'arrange:standard',
      'arrange:assign',
    ]);
    expect(settingsTabs({}).map((t) => t.label)).toEqual(['訪問の種類', '特性の項目', '管理者設定', 'データ']);
  });
  it('下のタブは子の項目からも引く（欠勤）', () => {
    expect(bottomTabs(groups).map((i) => i.key)).toEqual(['home', 'schedule', 'absence']);
  });
  it('同じ名前の項目が無い', () => {
    const labels = menuSections(TODAY, {}).flatMap((g) => g.items.map((i) => i.label));
    expect(new Set(labels).size).toBe(labels.length);
  });
  it('基本情報のタブ：予定と相性・〈利用者さん〉・〈スタッフ〉・相性・勤務時間（シフト）（ADR-0067）', () => {
    expect(basicsTabs(terms, {}).map((t) => t.label)).toEqual([
      '予定と相性',
      '利用者さん',
      'スタッフ',
      '相性',
      '勤務時間（シフト）',
    ]);
    expect(basicsTabs(terms, { compat: false }).map((t) => t.to)).toEqual([
      '/basics',
      '/clients',
      '/staff',
      '/availability',
    ]);
  });
  it('欠勤・キャンセルを登録は今日の日の予定の欄を開く操作', () => {
    expect(item('absence').to).toBe(absenceHref(TODAY));
    expect(absenceHref(TODAY)).toBe('/plan?date=2026-10-21&do=absence');
    expect(isNavAction(item('absence').to)).toBe(true);
  });
  it('「予定」は最後に開いた表示（無ければ日の予定）。比較は覚えない', () => {
    expect(item('schedule').to).toBe(SCHEDULE_DEFAULT);
    expect(SCHEDULE_DEFAULT).toBe('/plan');
    expect(item('schedule', menuSections(TODAY, {}, { schedule: '/month' })).to).toBe('/month');
    expect(scheduleHref('/week')).toBe('/week');
    expect(scheduleHref('/compare')).toBe('/plan');
    expect(scheduleHref(null)).toBe('/plan');
  });
  it('「設定」は最後に開いたタブ（切っていれば先頭のタブ）。無ければ訪問の種類（ADR-0047）', () => {
    expect(item('settings').to).toBe('/types');
    expect(settingsHref(applyTemplate('basic'))).toBe('/types');
    expect(settingsHref({}, '/data')).toBe('/data');
    expect(settingsHref({ rules: false }, '/rules')).toBe('/types');
    // 前に覚えた条件の重み（設定のタブから外した。ADR-0065）は先頭のタブ
    expect(settingsHref({}, '/rules')).toBe('/types');
    expect(item('settings', menuSections(TODAY, {}, { settings: '/rules' })).to).toBe('/types');
    expect(settingsHref({}, '/compat')).toBe('/types');
    expect(item('settings', menuSections(TODAY, {}, { settings: '/types' })).to).toBe('/types');
  });
  it('isScheduleView・isSettingsPath', () => {
    for (const p of ['/month', '/week', '/plan', '/schedule']) expect(isScheduleView(p)).toBe(true);
    expect(isScheduleView('/compare')).toBe(false);
    for (const p of ['/types', '/items', '/settings', '/data']) expect(isSettingsPath(p)).toBe(true);
    expect(isSettingsPath('/rules')).toBe(false);
    expect(isSettingsPath('/staff')).toBe(false);
    expect(isSettingsPath('/compat')).toBe(false);
  });
});

describe('isActiveNav（今の画面の印。PRD D273・D275）', () => {
  it('「予定」は月・週・日の予定（古い #/schedule も）。比較は予定を組む', () => {
    for (const p of ['/month', '/week', '/plan', '/schedule']) expect(isActiveNav(item('schedule'), p)).toBe(true);
    expect(isActiveNav(item('schedule'), '/home')).toBe(false);
  });
  it('「設定」は設定のタブ。勤務の見込みは勤務時間（シフト）', () => {
    for (const p of ['/types', '/items', '/settings', '/data']) expect(isActiveNav(item('settings'), p)).toBe(true);
    expect(isActiveNav(item('settings'), '/compat')).toBe(false);
    for (const p of ['/clients', '/staff', '/compat', '/availability', '/workload'])
      expect(isActiveNav(item('arrange:basics'), p)).toBe(true);
  });
  it('操作の項目は今の画面にしない', () => {
    expect(isActiveNav(item('absence'), '/plan')).toBe(false);
  });
  it('古い #/schedule は日の予定と見る', () => {
    expect(activeNavPath('/schedule')).toBe('/plan');
    expect(activeNavPath('/week')).toBe('/week');
  });
  it('〈利用者さん〉・〈スタッフ〉の画面は一覧の項目に当てる（PRD D308）', () => {
    expect(activeNavPath('/clients/c1')).toBe('/clients');
    expect(activeNavPath('/staff/new')).toBe('/staff');
    expect(isActiveNav(item('arrange:basics'), '/clients/c1')).toBe(true);
    expect(isActiveNav(item('arrange:basics'), '/staff/s1')).toBe(true);
    expect(activeNavPath('/staff-view/s1')).toBe('/staff-view/s1');
  });
});

describe('navTitle（上の帯の名前。画面の一覧から引く）', () => {
  it('グループの見出し＋項目名で、〈利用者さん〉と〈スタッフ〉の一覧を見分ける', () => {
    expect(navTitle(screens, '/clients')).toBe('基本情報・利用者さん一覧');
    expect(navTitle(screens, '/staff')).toBe('基本情報・スタッフ一覧');
    expect(navTitle(screens, '/availability')).toBe('基本情報・勤務時間（シフト）');
    expect(navTitle(screens, '/compat')).toBe('基本情報・相性');
    expect(navTitle(screens, '/basics')).toBe('基本情報・予定と相性');
    expect(navTitle(screens, '/workload')).toBe('基本情報・勤務の見込み');
    expect(navTitle(screens, '/vacancy')).toBe('空き状況');
  });
  it('予定は項目名だけ（「日の予定」にそろえる。PRD D230・D273）', () => {
    expect(navTitle(screens, '/plan')).toBe('日の予定');
    expect(navTitle(screens, '/schedule')).toBe('日の予定');
    expect(navTitle(screens, '/month')).toBe('月の予定');
    expect(navTitle(screens, '/week')).toBe('週の予定');
    expect(navTitle(screens, '/compare')).toBe('提案を比べる');
    expect(navTitleParts(screens, '/plan')).toEqual({ group: null, item: '日の予定' });
  });
  it('設定のタブは「設定・〜」、予定を組むは「予定を組む・〜」、見出しの無いグループは項目名だけ', () => {
    expect(navTitle(screens, '/rules')).toBe('予定を組む・条件の重み');
    expect(navTitle(screens, '/standard')).toBe('予定を組む・組み方の標準');
    expect(navTitle(screens, '/arrange')).toBe('予定を組む・担当を組む');
    expect(screens.find((g) => g.title === '予定を組む')?.items.map((i) => i.to)).toEqual([
      '/rules',
      '/standard',
      '/arrange',
    ]);
    expect(screens.find((g) => g.title === '設定')?.items.map((i) => i.to)).toEqual([
      '/types',
      '/items',
      '/settings',
      '/data',
    ]);
    expect(navTitle(screens, '/data')).toBe('設定・データ');
    expect(navTitle(screens, '/settings')).toBe('設定・管理者設定');
    expect(navTitle(screens, '/types')).toBe('設定・訪問の種類');
    expect(navTitle(screens, '/home')).toBe('ホーム');
  });
  it('一覧に無い画面は null', () => {
    expect(navTitle(screens, '/nowhere')).toBeNull();
    expect(navTitleParts(screens, '/nowhere')).toBeNull();
  });
  it('navTitleParts：見出しと項目名を分ける（見出しの無いグループは null）', () => {
    expect(navTitleParts(screens, '/clients')).toEqual({ group: '基本情報', item: '利用者さん一覧' });
    expect(navTitleParts(screens, '/home')).toEqual({ group: null, item: 'ホーム' });
  });
});

describe('bottomTabs（PRD D336）', () => {
  it('ホーム・予定・欠勤の順に引き、短い名前で出す（4つ目の「探す」・5つ目の「メニュー」は画面のボタン。空き状況は出さない）', () => {
    expect(bottomTabs(groups).map(tabLabel)).toEqual(['ホーム', '予定', '欠勤']);
    expect(bottomTabs(groups).map((i) => i.label)).toEqual(['ホーム', '予定', '欠勤・キャンセル']);
  });
  it('メニューに無い項目は出さない', () => {
    expect(bottomTabs([{ items: [{ key: 'home', to: '/home', label: 'ホーム' }] }]).map((i) => i.to)).toEqual([
      '/home',
    ]);
    expect(bottomTabs([{ items: [{ key: 'vacancy', to: '/vacancy', label: '空き状況' }] }])).toEqual([]);
  });
  it('短い名前が無ければメニューの名前', () => {
    expect(tabLabel({ to: '/x', label: '名前' })).toBe('名前');
    expect(tabLabel({ to: '/x', label: '名前', short: '短' })).toBe('短');
  });
});

describe('tabClick（下のタブ・メニューを押したとき）', () => {
  it('今開いている画面そのものなら何もしない。ほかは移る', () => {
    expect(tabClick(item('home'), '/home')).toBe('stay');
    expect(tabClick(item('schedule'), '/plan')).toBe('stay');
    expect(tabClick(item('schedule'), '/schedule')).toBe('stay');
    // 比較から「予定」は覚えた表示（既定は日の予定）へ移る
    expect(tabClick(item('schedule'), '/compare')).toBe('go');
    // 覚えた表示が月なら、週から押すと月へ
    const g = menuSections(TODAY, {}, { schedule: '/month' });
    expect(tabClick(item('schedule', g), '/week')).toBe('go');
    expect(tabClick(item('schedule', g), '/month')).toBe('stay');
    // 欠勤は操作なので、日の予定の上でも移る（欄を開く）
    expect(tabClick(item('absence'), '/plan')).toBe('go');
    // 〈利用者さん〉の画面から「基本情報」を押すと予定と相性の表へ移る
    expect(tabClick(item('arrange:basics'), '/clients/c1')).toBe('go');
    expect(tabClick(item('arrange:basics'), '/basics')).toBe('stay');
  });
});

describe('showsDateSwitch（PRD D267・D347）', () => {
  it('日付で中身が変わる画面だけ日付の選択を出す（予定の3画面は画面の中のナビの行）', () => {
    for (const p of ['/compare', '/workload', '/availability']) expect(showsDateSwitch(p)).toBe(true);
    for (const p of [
      '/plan',
      '/schedule',
      '/week',
      '/month',
      '/home',
      '/vacancy',
      '/clients',
      '/staff',
      '/compat',
      '/rules',
      '/types',
      '/items',
      '/settings',
      '/data',
    ])
      expect(showsDateSwitch(p)).toBe(false);
  });
});
