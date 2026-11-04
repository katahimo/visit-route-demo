import { describe, expect, it } from 'vitest';
import { applyTemplate } from './features';
import {
  ARRANGE_PATHS,
  absenceHref,
  activeNavPath,
  bottomTabKeys,
  bottomTabs,
  homePath,
  isActiveNav,
  isNavAction,
  isScheduleView,
  isSettingsPath,
  type MenuItem,
  menuSections,
  NAV_OPEN_DEFAULT,
  navTitleParts,
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

describe('menuSections（入。PRD D401。ADR-0054・0063・0067・0074・0078）', () => {
  it('見出しの無い6項目：予定・空き状況・〈利用者さん〉・〈スタッフ〉・組む・設定（ホームは無い）', () => {
    expect(groups.map((g) => g.title ?? null)).toEqual([null]);
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toEqual([
      '予定',
      '空き状況',
      '利用者さん',
      'スタッフ',
      '組む',
      '設定',
    ]);
    expect(groups.flatMap((g) => g.items.map((i) => i.key))).toEqual([
      'schedule',
      'vacancy',
      'clients',
      'staff',
      'arrange',
      'settings',
    ]);
    expect(item('home')).toBeUndefined();
    expect(item('vacancy').to).toBe('/vacancy');
  });
  it('子の項目を持つのは「組む」だけ：条件の重み・担当を組む（ADR-0099）。〈利用者さん〉・〈スタッフ〉は子にしない', () => {
    expect(groups[0]!.items.filter((i) => i.children).map((i) => i.key)).toEqual(['arrange']);
    expect(item('arrange').children?.map((i) => [i.key, i.label, i.to])).toEqual([
      ['arrange:rules', '条件の重み', '/rules'],
      ['arrange:assign', '担当を組む', '/arrange?ym=2026-11'],
    ]);
    // 予定と相性は〈利用者さん〉の項目（入切とも。ADR-0099）
    for (const p of ['/clients', '/clients/c1', '/compat', '/basics']) expect(isActiveNav(item('clients'), p)).toBe(true);
    for (const p of ['/staff', '/staff/s1', '/availability', '/workload'])
      expect(isActiveNav(item('staff'), p)).toBe(true);
    for (const p of ['/clients', '/staff', '/clients/c1', '/basics']) expect(isActiveNav(item('arrange'), p)).toBe(false);
    expect(item('settings').children).toBeUndefined();
    // 前半は今月
    const early = menuSections(terms, '2026-10-03', {});
    expect(item('arrange:assign', early).to).toBe('/arrange?ym=2026-10');
    expect(NAV_OPEN_DEFAULT).toEqual({ arrange: true });
    // 条件の重みを切れば子は担当を組むだけ
    const off = menuSections(terms, TODAY, { rules: false });
    expect(item('arrange', off).children?.map((i) => i.key)).toEqual(['arrange:assign']);
  });
  it('件数の印は「組む」の1つだけ：組む月の担当なしの日の数', () => {
    const g = menuSections(terms, TODAY, {}, {}, { planUnassignedDays: 3 });
    expect(item('arrange', g).badge).toEqual({ text: '3日', label: '担当なしの訪問がある日 3日' });
    expect(g[0]!.items.filter((i) => i.badge || i.children?.some((c) => c.badge)).map((i) => i.key)).toEqual([
      'arrange',
    ]);
    expect(item('arrange').badge).toBeUndefined();
  });
  it('今の画面の印は画面で決める（予定は月・週・日、空き状況は空き状況。組むの子）', () => {
    for (const p of ['/month', '/week', '/plan']) expect(isActiveNav(item('schedule'), p)).toBe(true);
    expect(isActiveNav(item('schedule'), '/vacancy')).toBe(false);
    expect(isActiveNav(item('vacancy'), '/vacancy')).toBe(true);
    expect(isActiveNav(item('schedule'), '/compare')).toBe(false);
    expect(isActiveNav(item('schedule'), '/arrange')).toBe(false);
    expect(isActiveNav(item('arrange'), '/compare')).toBe(true);
    expect(isActiveNav(item('arrange:assign'), '/compare')).toBe(true);
    expect(isActiveNav(item('arrange'), '/rules')).toBe(true);
    expect(isActiveNav(item('arrange:rules'), '/rules')).toBe(true);
    expect(isActiveNav(item('arrange:assign'), '/rules')).toBe(false);
    expect(isActiveNav(item('settings'), '/rules')).toBe(false);
    expect(ARRANGE_PATHS).toEqual(['/rules', '/arrange', '/compare']);
    expect(settingsTabs({}).map((t) => t.label)).toEqual(['訪問の種類', '特性の項目', '管理者設定', 'データ']);
  });
  it('同じ名前の項目が無い', () => {
    const labels = menuSections(terms, TODAY, {}).flatMap((g) => g.items.map((i) => i.label));
    expect(new Set(labels).size).toBe(labels.length);
  });
  it('欠勤・キャンセルを登録は今日の日の予定の欄を開く操作（メニューには出さず、予定の操作の行から）', () => {
    expect(absenceHref(TODAY)).toBe('/plan?date=2026-10-21&do=absence');
    expect(isNavAction(absenceHref(TODAY))).toBe(true);
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
  it('「予定」は月・週・日の予定（古い #/schedule も）。比較は組む', () => {
    for (const p of ['/month', '/week', '/plan', '/schedule']) expect(isActiveNav(item('schedule'), p)).toBe(true);
    expect(isActiveNav(item('schedule'), '/home')).toBe(false);
  });
  it('「設定」は設定のタブ。勤務の見込みは勤務時間（シフト）', () => {
    for (const p of ['/types', '/items', '/settings', '/data']) expect(isActiveNav(item('settings'), p)).toBe(true);
    expect(isActiveNav(item('settings'), '/compat')).toBe(false);
  });
  it('操作の項目（URL に ?do=）は今の画面にしない', () => {
    expect(isActiveNav({ to: absenceHref(TODAY), label: '欠勤' }, '/plan')).toBe(false);
  });
  it('古い #/schedule は日の予定と見る', () => {
    expect(activeNavPath('/schedule')).toBe('/plan');
    expect(activeNavPath('/week')).toBe('/week');
  });
  it('〈利用者さん〉・〈スタッフ〉の画面は一覧の項目に当てる（PRD D308）', () => {
    expect(activeNavPath('/clients/c1')).toBe('/clients');
    expect(activeNavPath('/staff/new')).toBe('/staff');
    expect(isActiveNav(item('clients'), '/clients/c1')).toBe(true);
    expect(isActiveNav(item('staff'), '/staff/s1')).toBe(true);
    expect(activeNavPath('/staff-view/s1')).toBe('/staff-view/s1');
  });
});

describe('navTitleParts（上の帯の名前。画面の一覧から引く）', () => {
  it('グループの見出し＋項目名で、〈利用者さん〉と〈スタッフ〉の一覧を見分ける', () => {
    expect(navTitleParts(screens, '/clients')).toEqual({ group: null, item: '利用者さん' });
    expect(navTitleParts(screens, '/staff')).toEqual({ group: null, item: 'スタッフ' });
    expect(navTitleParts(screens, '/availability')).toEqual({ group: null, item: '勤務時間（シフト）' });
    expect(navTitleParts(screens, '/compat')).toEqual({ group: null, item: '相性' });
    expect(navTitleParts(screens, '/basics')).toEqual({ group: null, item: '予定と相性' });
    expect(navTitleParts(screens, '/workload')).toEqual({ group: null, item: '勤務の見込み' });
    expect(navTitleParts(screens, '/vacancy')).toEqual({ group: null, item: '空き状況' });
  });
  it('予定は項目名だけ（「日の予定」にそろえる。PRD D230・D273）', () => {
    expect(navTitleParts(screens, '/plan')).toEqual({ group: null, item: '日の予定' });
    expect(navTitleParts(screens, '/schedule')).toEqual({ group: null, item: '日の予定' });
    expect(navTitleParts(screens, '/month')).toEqual({ group: null, item: '月の予定' });
    expect(navTitleParts(screens, '/week')).toEqual({ group: null, item: '週の予定' });
    expect(navTitleParts(screens, '/compare')).toEqual({ group: null, item: '提案を比べる' });
  });
  it('設定のタブは見出しが「設定」、組むは見出しが「組む」、見出しの無いグループは項目名だけ。ホームは無い', () => {
    expect(navTitleParts(screens, '/rules')).toEqual({ group: '組む', item: '条件の重み' });
    expect(navTitleParts(screens, '/arrange')).toEqual({ group: '組む', item: '担当を組む' });
    expect(screens.find((g) => g.title === '組む')?.items.map((i) => i.to)).toEqual(['/rules', '/arrange']);
    expect(screens.find((g) => g.title === '設定')?.items.map((i) => i.to)).toEqual([
      '/types',
      '/items',
      '/settings',
      '/data',
    ]);
    expect(navTitleParts(screens, '/data')).toEqual({ group: '設定', item: 'データ' });
    expect(navTitleParts(screens, '/settings')).toEqual({ group: '設定', item: '管理者設定' });
    expect(navTitleParts(screens, '/types')).toEqual({ group: '設定', item: '訪問の種類' });
    expect(navTitleParts(screens, '/home')).toBeNull();
  });
  it('一覧に無い画面は null', () => {
    expect(navTitleParts(screens, '/nowhere')).toBeNull();
  });
});

describe('bottomTabs（PRD D401・D400）', () => {
  it('入：予定・〈利用者さん〉・〈スタッフ〉・組むの順に引く（5つ目以降の「探す」「メニュー」は画面のボタン。設定はメニューの中）', () => {
    expect(bottomTabs(groups, {}).map((i) => i.key)).toEqual(['schedule', 'clients', 'staff', 'arrange']);
    expect(bottomTabs(groups, {}).map(tabLabel)).toEqual(['予定', '利用者さん', 'スタッフ', '組む']);
    expect(bottomTabKeys({ expert: true })).toEqual(['schedule', 'clients', 'staff', 'arrange']);
  });
  it('メニューに無い項目は出さない', () => {
    expect(bottomTabs([{ items: [{ key: 'schedule', to: '/plan', label: '予定' }] }], {}).map((i) => i.to)).toEqual([
      '/plan',
    ]);
    expect(bottomTabs([{ items: [{ key: 'vacancy', to: '/vacancy', label: '空き状況' }] }], {})).toEqual([]);
    // 切った機能（〈利用者さん〉が無い）は、その分だけ減る
    expect(bottomTabs(menuSections(terms, TODAY, { expert: false }), {}).map((i) => i.key)).toEqual([
      'schedule',
      'clients',
      'staff',
    ]);
  });
  it('短い名前が無ければメニューの名前', () => {
    expect(tabLabel({ to: '/x', label: '名前' })).toBe('名前');
    expect(tabLabel({ to: '/x', label: '名前', short: '短' })).toBe('短');
  });
});

describe('tabClick（下のタブ・メニューを押したとき）', () => {
  it('今開いている画面そのものなら何もしない。ほかは移る', () => {
    expect(tabClick(item('schedule'), '/plan')).toBe('stay');
    expect(tabClick(item('schedule'), '/schedule')).toBe('stay');
    // 比較から「予定」は覚えた表示（既定は日の予定）へ移る
    expect(tabClick(item('schedule'), '/compare')).toBe('go');
    // 覚えた表示が月なら、週から押すと月へ
    const g = menuSections(terms, TODAY, {}, { schedule: '/month' });
    expect(tabClick(item('schedule', g), '/week')).toBe('go');
    expect(tabClick(item('schedule', g), '/month')).toBe('stay');
    // 操作（?do=）の項目は、日の予定の上でも移る（欄を開く）
    expect(tabClick({ to: absenceHref(TODAY), label: '欠勤' }, '/plan')).toBe('go');
    // 〈利用者さん〉の画面から一覧の項目を押すと一覧へ
    expect(tabClick(item('clients'), '/clients/c1')).toBe('go');
    expect(tabClick(item('clients'), '/clients')).toBe('stay');
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

describe('エキスパート機能が切のメニュー（PRD D400。ADR-0073・ADR-0078）', () => {
  const off = { expert: false };
  const g = menuSections(terms, TODAY, off, {}, { planUnassignedDays: 3 });
  it('メニューは 予定・空き状況・〈利用者さん〉・〈スタッフ〉・設定 の5つ（見出し・子の項目・件数の印なし。ホームは無い）', () => {
    expect(g.map((x) => x.title ?? null)).toEqual([null]);
    expect(g.flatMap((x) => x.items.map((i) => i.label))).toEqual([
      '予定',
      '空き状況',
      '利用者さん',
      'スタッフ',
      '設定',
    ]);
    expect(g.flatMap((x) => x.items.map((i) => i.key))).toEqual([
      'schedule',
      'vacancy',
      'clients',
      'staff',
      'settings',
    ]);
    expect(g.flatMap((x) => x.items).some((i) => i.children || i.badge)).toBe(false);
    expect(item('home', g)).toBeUndefined();
    expect(item('arrange', g)).toBeUndefined();
  });
  it('呼び名は terms から', () => {
    const t = menuSections({ client: 'お客様', staff: 'シッター' }, TODAY, off);
    expect(t.flatMap((x) => x.items.map((i) => i.label))).toEqual(['予定', '空き状況', 'お客様', 'シッター', '設定']);
  });
  it('行き先：予定は最後に開いた表示（既定は日の予定）、設定は最後に開いたタブ（無ければ訪問の種類）', () => {
    expect(g.flatMap((x) => x.items.map((i) => i.to))).toEqual(['/plan', '/vacancy', '/clients', '/staff', '/types']);
    const last = menuSections(terms, TODAY, off, { schedule: '/week', settings: '/data' });
    expect(last.flatMap((x) => x.items.map((i) => i.to))).toEqual(['/week', '/vacancy', '/clients', '/staff', '/data']);
  });
  it('今の画面の印：予定は月・週・日・比較・担当を組む、空き状況は空き状況、〈利用者さん〉・〈スタッフ〉は一覧と人の画面と関わる画面、設定は設定のタブ', () => {
    const on = (key: string, p: string) => isActiveNav(item(key, g), p);
    // 入と違い、切は 担当を組む・比較も予定に印（メニューに「組む」が無い）
    for (const p of ['/month', '/week', '/plan', '/schedule', '/arrange', '/compare'])
      expect(on('schedule', p)).toBe(true);
    expect(on('schedule', '/vacancy')).toBe(false);
    expect(on('vacancy', '/vacancy')).toBe(true);
    for (const p of ['/clients', '/clients/c1', '/basics', '/compat']) expect(on('clients', p)).toBe(true);
    for (const p of ['/staff', '/staff/s1', '/availability', '/workload']) expect(on('staff', p)).toBe(true);
    for (const p of ['/types', '/settings', '/data']) expect(on('settings', p)).toBe(true);
    expect(on('schedule', '/clients')).toBe(false);
    expect(on('clients', '/staff')).toBe(false);
  });
  it('相性は、どちらのタブから来たかの側（last.people）の項目に印が付く（PRD D394）', () => {
    const staffSide = menuSections(terms, TODAY, off, { people: 'staff' });
    expect(isActiveNav(item('staff', staffSide), '/compat')).toBe(true);
    expect(isActiveNav(item('clients', staffSide), '/compat')).toBe(false);
    expect(isActiveNav(item('clients', staffSide), '/basics')).toBe(true);
    const clientSide = menuSections(terms, TODAY, off, { people: 'clients' });
    expect(isActiveNav(item('clients', clientSide), '/compat')).toBe(true);
    expect(isActiveNav(item('staff', clientSide), '/compat')).toBe(false);
  });
  it('切った機能の画面の項目は出さない（切っていない機能だけ）', () => {
    const items = menuSections(terms, TODAY, { expert: false, vacancy: false }).flatMap((x) => x.items);
    expect(items.map((i) => i.key)).toEqual(['schedule', 'clients', 'staff', 'settings']);
  });
  it('下のタブは 予定・空き状況・〈利用者さん〉・〈スタッフ〉（そのあとに「探す」「メニュー」は画面で足す。設定は引き出し。ADR-0080）。入は 予定・〈利用者さん〉・〈スタッフ〉・組む', () => {
    expect(bottomTabs(g, off).map((t) => t.key)).toEqual(['schedule', 'vacancy', 'clients', 'staff']);
    expect(bottomTabs(groups, {}).map((t) => t.key)).toEqual(['schedule', 'clients', 'staff', 'arrange']);
    expect(bottomTabs(g, off).map(tabLabel)).toEqual(['予定', '空き状況', '利用者さん', 'スタッフ']);
    expect(bottomTabKeys(applyTemplate('basic'))).toEqual(['schedule', 'vacancy', 'clients', 'staff']);
    expect(bottomTabKeys(applyTemplate('all'))).toEqual(['schedule', 'clients', 'staff', 'arrange']);
  });
  it('空き状況を切ると、空き状況の代わりに設定（ADR-0080）。入は空き状況の入切に関わらず同じ', () => {
    const noVacancy = { expert: false, vacancy: false };
    const g2 = menuSections(terms, TODAY, noVacancy);
    expect(bottomTabs(g2, noVacancy).map((t) => t.key)).toEqual(['schedule', 'clients', 'staff', 'settings']);
    expect(bottomTabs(g2, noVacancy).map(tabLabel)).toEqual(['予定', '利用者さん', 'スタッフ', '設定']);
    expect(bottomTabKeys({ expert: true, vacancy: false })).toEqual(['schedule', 'clients', 'staff', 'arrange']);
  });
  it('homePath：入切とも予定の画面（繰り返しを使うなら月、使わないなら週。最初に開く画面と同じ）。ホームは無い（PRD D401）', () => {
    expect(homePath({})).toBe('/month');
    expect(homePath(applyTemplate('all'))).toBe('/month');
    expect(homePath(applyTemplate('basic'))).toBe('/month');
    expect(homePath(applyTemplate('oneOff'))).toBe('/week');
  });
  it('画面の一覧：ホームは無く、担当を組む・空き状況は予定のグループ、基本情報の区分名は無く〈利用者さん〉・〈スタッフ〉は呼び名そのまま', () => {
    const s = screenSections(terms, off);
    expect(s.some((x) => x.items.some((i) => i.to === '/home'))).toBe(false);
    expect(s.some((x) => x.title === '組む')).toBe(false);
    expect(s.find((x) => x.title === '予定')?.items.map((i) => i.to)).toEqual([
      '/month',
      '/week',
      '/plan',
      '/arrange',
      '/vacancy',
    ]);
    expect(navTitleParts(s, '/arrange')).toEqual({ group: null, item: '担当を組む' });
    expect(navTitleParts(s, '/vacancy')).toEqual({ group: null, item: '空き状況' });
    expect(s.some((x) => x.title === '基本情報')).toBe(false);
    expect(s.some((x) => x.title === '人')).toBe(false);
    const people = s.find((x) => x.items.some((i) => i.to === '/clients'));
    expect(people?.title).toBeUndefined();
    expect(people?.items.find((i) => i.to === '/clients')?.label).toBe('利用者さん');
    expect(people?.items.find((i) => i.to === '/staff')?.label).toBe('スタッフ');
    expect(navTitleParts(s, '/staff')).toEqual({ group: null, item: 'スタッフ' });
    // 入：ホームは無く、空き状況は予定のグループ、〈利用者さん〉・〈スタッフ〉は呼び名そのまま、組むに条件の重み・担当を組む
    const on = screenSections(terms, {});
    expect(on.some((x) => x.items.some((i) => i.to === '/home'))).toBe(false);
    expect(on.find((x) => x.title === '予定')?.items.map((i) => i.to)).toEqual([
      '/month',
      '/week',
      '/plan',
      '/vacancy',
    ]);
    // 予定と相性・相性・勤務は人のグループ（入切で同じ。ADR-0099）
    expect(on.some((x) => x.title === '基本情報')).toBe(false);
    expect(on.find((x) => x.items.some((i) => i.to === '/clients'))?.items.map((i) => i.to)).toEqual([
      '/basics',
      '/clients',
      '/staff',
      '/compat',
      '/availability',
      '/workload',
    ]);
    expect(on.find((x) => x.title === '組む')?.items.map((i) => i.to)).toEqual(['/rules', '/arrange']);
  });
});
