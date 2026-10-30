import { describe, expect, it } from 'vitest';
import { applyTemplate } from './features';
import {
  ARRANGE_PATHS,
  ARRANGE_STEPS,
  absenceHref,
  activeNavPath,
  arrangeSteps,
  BASICS_PATHS,
  basicsTabs,
  bottomTabs,
  isActiveNav,
  isNavAction,
  isScheduleView,
  isSettingsPath,
  type MenuItem,
  menuSections,
  NAV_OPEN_DEFAULT,
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
const groups = menuSections(terms, TODAY, {});
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
      ['arrange:clients', '利用者さん一覧', '/clients'],
      ['arrange:staff', 'スタッフ一覧', '/staff'],
      ['arrange:standard', '組み方の標準', '/standard'],
      ['arrange:assign', '担当を組む', '/arrange?ym=2026-11'],
    ]);
    // 基本情報の印は基本情報のタブの画面と〈利用者さん〉・〈スタッフ〉の画面
    // 基本情報の印はタブの画面、一覧と〈利用者さん〉・〈スタッフ〉の画面は一覧の子に印（ADR-0067 追記）
    for (const p of ['/basics', '/compat', '/availability', '/workload'])
      expect(isActiveNav(item('arrange:basics'), p)).toBe(true);
    for (const p of ['/clients', '/clients/c1']) expect(isActiveNav(item('arrange:clients'), p)).toBe(true);
    for (const p of ['/staff', '/staff/s1']) expect(isActiveNav(item('arrange:staff'), p)).toBe(true);
    expect(isActiveNav(item('arrange:basics'), '/clients')).toBe(false);
    expect(item('settings').children?.map((i) => i.to)).toEqual(['/types', '/items', '/settings', '/data']);
    // 前半は今月
    const early = menuSections(terms, '2026-10-03', {});
    expect(item('month-view', early).to).toBe('/month?ym=2026-10');
    expect(item('arrange:assign', early).to).toBe('/arrange?ym=2026-10');
    expect(NAV_OPEN_DEFAULT).toEqual({ schedule: true, arrange: true, people: true, settings: false });
  });
  it('件数の印：組む月の担当なしの日は「担当を組む」、今日をまだ伝えていないは「今日の予定」', () => {
    const g = menuSections(terms, TODAY, {}, {}, { planUnassignedDays: 3, todayUntold: true });
    expect(item('arrange:assign', g).badge).toEqual({ text: '3日', label: '担当なしの訪問がある日 3日' });
    expect(item('today', g).badge?.text).toBe('未確定');
    expect(item('arrange:assign').badge).toBeUndefined();
    // expert 切は確定の段階が無いので「未確定」の印は出さない（ADR-0073）
    const off = menuSections(terms, TODAY, { expert: false }, {}, { todayUntold: true });
    expect(item('today', off).badge).toBeUndefined();
    // 基本情報が変わった印は担当なしの日の数より先（ADR-0067）
    const changed = menuSections(
      terms,
      TODAY,
      {},
      {},
      { planUnassignedDays: 3, basisChanged: true, hasStandard: true },
    );
    expect(item('arrange:assign', changed).badge?.text).toBe('変更');
    // 標準が無い間は知らせない（PRD D363）
    const noStd = menuSections(terms, TODAY, {}, {}, { planUnassignedDays: 3, basisChanged: true });
    expect(item('arrange:assign', noStd).badge?.text).toBe('3日');
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
    const std = menuSections(terms, TODAY, {}, {}, { hasStandard: true });
    expect(item('arrange', std).children?.map((i) => i.key)).toEqual([
      'arrange:basics',
      'arrange:clients',
      'arrange:staff',
      'arrange:assign',
    ]);
    expect(isActiveNav(item('arrange:assign', std), '/standard')).toBe(true);
    expect(isActiveNav(item('arrange:assign', std), '/rules')).toBe(true);
    const off = menuSections(terms, TODAY, { rules: false });
    expect(item('arrange', off).children?.map((i) => i.key)).toEqual([
      'arrange:basics',
      'arrange:clients',
      'arrange:staff',
      'arrange:standard',
      'arrange:assign',
    ]);
    expect(settingsTabs({}).map((t) => t.label)).toEqual(['訪問の種類', '特性の項目', '管理者設定', 'データ']);
  });
  it('下のタブは子の項目からも引く（欠勤）', () => {
    expect(bottomTabs(groups).map((i) => i.key)).toEqual(['home', 'schedule', 'absence']);
  });
  it('同じ名前の項目が無い', () => {
    const labels = menuSections(terms, TODAY, {}).flatMap((g) => g.items.map((i) => i.label));
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
    expect(item('schedule', menuSections(terms, TODAY, {}, { schedule: '/month' })).to).toBe('/month');
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
    expect(item('settings', menuSections(terms, TODAY, {}, { settings: '/rules' })).to).toBe('/types');
    expect(settingsHref({}, '/compat')).toBe('/types');
    expect(item('settings', menuSections(terms, TODAY, {}, { settings: '/types' })).to).toBe('/types');
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
    for (const p of ['/compat', '/availability', '/workload'])
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
    expect(isActiveNav(item('arrange:clients'), '/clients/c1')).toBe(true);
    expect(isActiveNav(item('arrange:staff'), '/staff/s1')).toBe(true);
    expect(activeNavPath('/staff-view/s1')).toBe('/staff-view/s1');
  });
});

describe('navTitleParts（上の帯の名前。画面の一覧から引く）', () => {
  it('グループの見出し＋項目名で、〈利用者さん〉と〈スタッフ〉の一覧を見分ける', () => {
    expect(navTitleParts(screens, '/clients')).toEqual({ group: '基本情報', item: '利用者さん一覧' });
    expect(navTitleParts(screens, '/staff')).toEqual({ group: '基本情報', item: 'スタッフ一覧' });
    expect(navTitleParts(screens, '/availability')).toEqual({ group: '基本情報', item: '勤務時間（シフト）' });
    expect(navTitleParts(screens, '/compat')).toEqual({ group: '基本情報', item: '相性' });
    expect(navTitleParts(screens, '/basics')).toEqual({ group: '基本情報', item: '予定と相性' });
    expect(navTitleParts(screens, '/workload')).toEqual({ group: '基本情報', item: '勤務の見込み' });
    expect(navTitleParts(screens, '/vacancy')).toEqual({ group: null, item: '空き状況' });
  });
  it('予定は項目名だけ（「日の予定」にそろえる。PRD D230・D273）', () => {
    expect(navTitleParts(screens, '/plan')).toEqual({ group: null, item: '日の予定' });
    expect(navTitleParts(screens, '/schedule')).toEqual({ group: null, item: '日の予定' });
    expect(navTitleParts(screens, '/month')).toEqual({ group: null, item: '月の予定' });
    expect(navTitleParts(screens, '/week')).toEqual({ group: null, item: '週の予定' });
    expect(navTitleParts(screens, '/compare')).toEqual({ group: null, item: '提案を比べる' });
  });
  it('設定のタブは見出しが「設定」、予定を組むは見出しが「予定を組む」、見出しの無いグループは項目名だけ', () => {
    expect(navTitleParts(screens, '/rules')).toEqual({ group: '予定を組む', item: '条件の重み' });
    expect(navTitleParts(screens, '/standard')).toEqual({ group: '予定を組む', item: '組み方の標準' });
    expect(navTitleParts(screens, '/arrange')).toEqual({ group: '予定を組む', item: '担当を組む' });
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
    expect(navTitleParts(screens, '/data')).toEqual({ group: '設定', item: 'データ' });
    expect(navTitleParts(screens, '/settings')).toEqual({ group: '設定', item: '管理者設定' });
    expect(navTitleParts(screens, '/types')).toEqual({ group: '設定', item: '訪問の種類' });
    expect(navTitleParts(screens, '/home')).toEqual({ group: null, item: 'ホーム' });
  });
  it('一覧に無い画面は null', () => {
    expect(navTitleParts(screens, '/nowhere')).toBeNull();
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
    const g = menuSections(terms, TODAY, {}, { schedule: '/month' });
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

describe('エキスパート機能が切のメニュー（PRD D377。ADR-0072）', () => {
  const off = { expert: false };
  const g = menuSections(terms, TODAY, off, {}, { planUnassignedDays: 3, basisChanged: true, hasStandard: true });
  it('ホーム・予定・人・空き状況・設定。予定を組むは出さない', () => {
    expect(g.flatMap((x) => x.items.map((i) => i.label))).toEqual(['ホーム', '予定', '人', '空き状況', '設定']);
    expect(item('arrange', g)).toBeUndefined();
  });
  it('「人」の子は 予定と相性・〈利用者さん〉一覧・〈スタッフ〉一覧。担当を組むの印は付けない', () => {
    const people = item('people', g);
    expect(people).toMatchObject({ to: '/basics', icon: 'people', match: BASICS_PATHS });
    expect(people.children?.map((i) => [i.key, i.label, i.to])).toEqual([
      ['people:basics', '予定と相性', '/basics'],
      ['people:clients', '利用者さん一覧', '/clients'],
      ['people:staff', 'スタッフ一覧', '/staff'],
    ]);
    expect(people.badge).toBeUndefined();
    expect(people.children?.some((c) => c.badge)).toBe(false);
    for (const p of ['/basics', '/compat', '/availability', '/workload', '/clients', '/staff/s1'])
      expect(isActiveNav(people, p)).toBe(true);
  });
  it('入のメニューには「人」が無い', () => {
    expect(item('people')).toBeUndefined();
  });
  it('画面の一覧：予定を組むのグループは無く担当を組むは予定のグループ、基本情報のグループ名は「人」', () => {
    const s = screenSections(terms, off);
    expect(s.some((x) => x.title === '予定を組む')).toBe(false);
    expect(navTitleParts(s, '/arrange')).toEqual({ group: null, item: '担当を組む' });
    expect(s.some((x) => x.title === '基本情報')).toBe(false);
    expect(s.find((x) => x.title === '人')?.items[0]?.to).toBe('/basics');
    const on = screenSections(terms, {});
    expect(on.some((x) => x.title === '基本情報')).toBe(true);
    expect(on.find((x) => x.title === '予定を組む')?.items.map((i) => i.to)).toEqual([
      '/rules',
      '/standard',
      '/arrange',
    ]);
  });
  it('下のタブはホーム・予定・欠勤のまま', () => {
    expect(bottomTabs(g).map((t) => t.key)).toEqual(['home', 'schedule', 'absence']);
  });
});
