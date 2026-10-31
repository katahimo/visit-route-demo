# pages（画面）：メニュー・ナビゲーション・コマンドパレット

> この画面のファイル：`src/lib/nav.ts`・`src/app/App.tsx`（`shellBars.tsx`・`shellNav.tsx`・`useAdminShell.ts`）・`src/app/NavDrawer.tsx`・`components/ViewSwitch.tsx`・`components/SettingsTabs.tsx`・`lib/commandPalette.ts`・`components/CommandPalette.tsx`。
> 画面全体の決まり・ルート一覧は [pages.md](pages.md)。

## メニューとナビゲーション（ADR-0024・ADR-0027・ADR-0045・ADR-0054・ADR-0055・ADR-0063・ADR-0067・ADR-0073。PRD D132・D133・D135・D179〜D183・D239・D273・D275・D326・D336・D348・D349・D364・D383）

- メニューは、エキスパート機能（`expert`。ADR-0072）が入なら ホーム・予定を組む・予定・空き状況・設定 の5項目（見出しなし。「人」は無い。PRD D326・D349・D355・D364）。**切のときは 予定・〈利用者さん〉・〈スタッフ〉・設定 の4つ**（PRD D383。ADR-0073）：ホームは無く、見出し・子の項目・件数の印も無い（左のメニュー・スマホの引き出し・下のタブで同じ）。ホームの代わりは予定の上の要対応の帯（下の「要対応の帯」）、空き状況は予定の「その他 ▾」から開く。担当を組む（`/arrange`）は切でも日の予定などから開けるがメニューには出さない。予定・予定を組む・設定は子の項目を持つ親で、親の行の右の ▾（`button.nav-toggle`・data-testid `nav-toggle`・`aria-expanded`・`aria-controls`＝`nav-sub-<key>`・名前「◯の項目を畳む／開く」）で畳める。子は親の下の字下げした小さな行（`.nav-sub`・`.nav-child`）。予定の子はリンク（今日の予定・◯月の予定・欠勤・キャンセル）、予定を組むの子は基本情報・組み方の標準・担当を組む（作業の順。条件の重みは組み方の標準の寄り道。標準を登録したあとは基本情報と担当を組むだけ。PRD D360・D364）、設定の子は設定のタブ
- 畳み：既定は `NAV_OPEN_DEFAULT`＝予定・予定を組むを開き、設定を畳む。開け閉めは localStorage の `visit-route-demo:nav-open`（`store/navOpen` の `navOpenMemory`。`{ 親の key: boolean }` の JSON。この端末に残す。読めなければ既定）に覚える。今の画面の親が畳んであれば、画面を移ったときに開く（開いたまま自分で畳んだ開け閉めは、移るまで変えない）
- 今の画面の印（`aria-current="page"`・`.active`）：親が開いていれば子に付け（今日の予定は日の予定、◯月の予定は月・週の予定、基本情報は基本情報のタブの画面と〈利用者さん〉・〈スタッフ〉の画面、担当を組むは担当を組む・案を比べる（標準があれば組み方の標準・条件の重みも））、畳んでいれば親に付ける。開いていても子のどれにも当たらなければ親に付ける。親の行は子が今の画面のとき太字だけ（`.has-current`）
- 件数の印（`span.nav-badge`・data-testid `nav-badge`・見える文字と `.sr-only` の読み上げ）：担当を組む に「変更」（基本情報が最後に組んだあとに変わった。ADR-0067。担当なしの日の数より先）か「N日」（組む月の担当なしの訪問がある日の数。0なら出さない）、今日の予定 に「未確定」（今日に訪問があってまだ伝えていない）。数えるのは `lib/scheduleMode` の `menuBadges`
- 広い画面の左のメニュー（`.side-nav`）は詰める：項目（`.nav-link`）は `min-height: 34px`（上下 5px・行の高さ 1.4）、グループの間 10px、メニューの上下 14px・16px。1440×900 で最後の項目（設定。既定は畳む）まで巻かずに見える。タッチできる端末（`any-pointer: coarse`。主の入力がマウスでもタッチ・ペンがあれば当たる）では `.nav-link` を `min-height: 44px`、［月｜週｜日］のタブ（見た目 36px）は `::before` で上下 4px 広げて 44px（PRD D237・D239）
- 高さ 860px 以下の広い画面（1366×768 など）ではさらに詰める：項目 30px（上下 3px・行の高さ 1.3・0.92rem）・グループの間 4px・見出しの下の余白 0・ロゴ 32px。子の項目（`.nav-child`）は 26px に詰める。1366×768 で既定の開け閉め（予定・予定を組むを開き、設定を畳む）のまま最後の項目（設定）まで巻かずに収まる（`scripts/e2e-nav.cjs` の 1366×768 の段）。それでも入らないときは、`.side-nav` の背景（下の端の影 `scroll` と、中身の終わりで影を隠す `local` の重ね）で下に続きがあると示す（PRD D270）
- 上の帯の日付の選択（`DateSwitcher`）は `lib/nav` の `showsDateSwitch(pathname)` の画面（`DATE_PAGES`：案を比べる・勤務の見込み・勤務時間（シフト））だけに出す。日・週・月の予定は画面の中のナビの行（`ScheduleNav`。PRD D347。ADR-0060）で送るので出さない。選んでいる日付は覚えたままで、外枠 `.app-shell` の `data-date` で読める（PRD D267）

### エキスパート機能が切のときのメニュー・ホーム・要対応の帯（PRD D383。ADR-0073 段(4)の1）

- 判定は `lib/nav` の `isSimpleMenu(features)`（`expert` が切）。メニューの4つは `menuSections` が `simpleMenuItems` で返す（`key`：`schedule`・`clients`・`staff`・`settings`。名前は 予定・`terms.client`・`terms.staff`・設定。`to`＝予定は `scheduleHref(last.schedule)`・`/clients`・`/staff`・設定は `settingsHref`。今の画面の印（`match`）：予定は 月・週・日・比較・空き状況・担当を組む、〈利用者さん〉は 一覧・予定と相性・相性、〈スタッフ〉は 一覧・勤務時間（シフト）・勤務の見込み、設定は設定のタブ。〈利用者さん〉・〈スタッフ〉の画面（`/clients/:id`・`/staff/:id`）は `activeNavPath` で一覧に当てる）。切った機能の項目は出さない
- 下のタブ：`bottomTabs(groups, simple)`。`simple` なら `SIMPLE_BOTTOM_TABS`（予定・〈利用者さん〉・〈スタッフ〉・設定）のあとに画面のボタンの「探す」「メニュー」（引き出しも同じ4つ）。欠勤のタブは出さない（欠勤・キャンセルは予定の操作の行）
- ホームは無い：`homePath(features)`（入は `/home`、切は `startGuidePlanPath(features)`＝繰り返しを使うなら `/month`、使わないなら `/week`。最初に開く画面と同じ）。`#/home`・起動（`#/`）・知らない URL・切った機能の URL（知らせは `homePath` の画面の上に出す。`FeatureOffNotice`）はここへ移す（`Navigate replace`。`App.tsx`）。入のときはホームを今どおり残す
- 画面の一覧（`screenSections`。パレットの画面）：切のときはホームの項目が無く、担当を組む・空き状況は「予定」のグループに置く（空き状況は「その他 ▾」から開くため）
- 要対応の帯（`components/attentionBand.tsx`・`attentionBand.css`・フック `useAttentionBand`）：月・週・日の予定の上のナビの行のすぐ下に1本（切のときだけ。無ければ出さない。印刷で出さない）。中身の判定は `lib/attentionBand` の `attentionBand(statuses, today)`（純粋関数。テストあり）：今日以降の日（`bandDays(today)`＝今日〜翌月末。自動の組みの範囲 `autoRange` と同じで、「その他 ▾」の「担当なしの訪問を組む」と範囲をそろえる）の `DayStatus.issues`（訪問ごとの検査）から、**担当なし**（`unassigned`）・**重なり**（`late`＝時間の約束に間に合わない・働ける時間に収まらない（前の訪問と重なるとき）を数える）・**休みの人**（`off`＝休みの人・休止の人に割り当てた訪問）の訪問を件数で数える。条件に合わない（`notAllowed`）は数えない。1つの訪問は1つの種類（担当なし → 休みの人 → 重なり）。1行は「要対応 担当なし N件・重なり N件・休みの人 N件」（0件の種類は書かない）。押すと、いちばん早い日の、開始（`ProblemVisit.earliest`）がいちばん早い該当の訪問を開く（日付 → 時刻の順。`attentionBand` の `startOf`）：`setDate(日)` のうえ `navigate('/plan', { state: { visitId } })`（週の帯から開くのと同じ仕組み。日の予定の `usePlanNav` が、その日にその訪問があれば選んで（担当のある訪問）見える所へ巻く。日の予定を開いたまま押しても受ける。そのときは履歴を積まず置き換える）。下書きのある画面からは `confirmLeave` で確かめる
- 「予定を入れる」と人の小さいタブ（切。PRD D388・D389。ADR-0073 第4段）：月・週の主ボタン「予定を入れる」は `SimpleToolbar`（`mainTools` の `plan`）から `components/AddPlanPanel` を開く（詳しくは [design.md](../design.md) の「予定を入れる」）。〈スタッフ〉・〈利用者さん〉の小さいタブは `lib/peopleTabs`（`peopleTabs`・`peopleTabsLabel`・`peopleSideOf`・`rememberedSide`・`peopleMatch`）と `components/SettingsTabs` の `PeopleTabs`（`BasicsNav` が切のときこちらを出す。`data-testid="people-tabs"`）、相性でどちらから来たかは `components/peopleSide`。メニューの4つ（D383）のまま、`simpleMenuItems` の〈利用者さん〉・〈スタッフ〉の `match` に `peopleMatch(side, last.people)`（相性は来た側の1つに印）
- 予定の「その他 ▾」：`ScheduleToolbar`（日・週・月で共通）が `useSimpleMore` の項目を足す（切のときだけ。出し分けは `lib/simpleMore` の `simpleMoreKinds`（テストあり）。月・週では「担当なしの訪問を組む N件」はここにだけある（主ボタンは「予定を入れる」）。足す項目は「予定まわり」のまとまり（`group`）にして、スマホの日の予定の「そのほか」に入れない）：「担当なしの訪問を組む N件」（ホームの［組む］の代わり。今日〜翌月末の担当なしの訪問を、いまの条件で自動で組む。`requestUnassignedArrange`。ADR-0072 第2段。計算中は押せない）と「空き状況」（`/vacancy`）。入のときは足さない

### `lib/nav.ts`（純粋関数。テストあり）

- `menuSections(terms, today, features, last, badges)`：メニューの並びの1か所（PRD D273〜D275・D326・D349・D355・D359・D360・D364・D383。ADR-0054・ADR-0063・ADR-0065〜ADR-0067・ADR-0073）。見出しの無い1つのグループに、入なら5項目（ホーム・予定を組む・予定・空き状況・設定）、切なら4つ（予定・〈利用者さん〉・〈スタッフ〉・設定。`isSimpleMenu`。上の節）。項目は `MenuItem`＝`{ key, to, label, short?, match?, icon, children?, badge? }`（`key` は下のタブで引く名前、`match` はその項目が受け持つ画面のパス（今の画面の印。無ければ `to`）、アイコンは名前 `NavIcon`、`short` は下のタブの短い名前、`children` は畳める子の項目、`badge` は件数の印 `{ text, label }`）。`last`（`LastViews`＝`{ schedule?, settings? }`。人のタブは覚えない）は最後に開いた予定の表示・設定のタブ。`badges`（`MenuBadges`＝`{ planUnassignedDays?, todayUntold?, hasStandard?, basisChanged? }`）は `menuBadges` の値（`hasStandard` は組み方の標準があるか。ADR-0066 追記）と `useBasisChanged` の値（`basisChanged`＝基本情報が最後に組んだあとに変わったか。`app/useAdminShell`。ADR-0067）。切った機能の項目・子は出さない。`expert` が切なら予定を組むの代わりに「人」（`peopleMenuItem`）を出す（`NAV_OPEN_DEFAULT` は人も開く）

| 項目（`key`・`to`。下のタブは `short`） | 子の項目 |
|---|---|
| ホーム（`home`・`/home`。short「ホーム」） | なし |
| 予定（`schedule`・`scheduleHref(last.schedule)`＝最後に開いた `/month`・`/week`・`/plan`、無ければ `/plan`。short「予定」。`match`＝`SCHEDULE_PATHS`：月・週・日） | 下の3つ |
| 予定を組む（`arrange`・`/arrange`。short「組む」。`match`＝`ARRANGE_PATHS`：`BASICS_PATHS`・条件の重み・組み方の標準・担当を組む・比較） | 基本情報（`arrange:basics`・`/basics`・`match`＝`BASICS_PATHS` から一覧を除いたもの。アイコンは `people`）・〈利用者さん〉一覧（`arrange:clients`・`/clients`。〈利用者さん〉の画面も）・〈スタッフ〉一覧（`arrange:staff`・`/staff`。〈スタッフ〉の画面も。ADR-0067 追記）・組み方の標準（`arrange:standard`・`/standard`・`match` 組み方の標準・条件の重み。`badges.hasStandard` なら出さない）・担当を組む（`arrange:assign`・`/arrange?ym=<planYm(today)>`・`match` 担当を組む・比較（標準があれば組み方の標準・条件の重みも）・件数の印「変更」（`badges.basisChanged`。title「基本情報が最後に組んだあとに変わった（組み直す）」）か「N日」） |
| 空き状況（`vacancy`・`/vacancy`。short「空き状況」） | なし |
| 設定（`settings`・`settingsHref(features, last.settings)`＝最後に開いた設定のタブ、無ければ先頭の訪問の種類。`match`＝切っていない設定のタブ） | 設定のタブ（`settingsTabs`。key `settings:<to>`） |

予定の子（PRD D349）：

| 子（`key`） | `to` | `match` | 件数の印 |
|---|---|---|---|
| 今日の予定（`today`） | `/plan?date=今日` | 日の予定 | 「未確定」（`todayUntold`。title「今日はまだ伝えていない」） |
| ◯月の予定（`month-view`。`planLabel(today)`） | `/month?ym=<planYm(today)>`（月の後半は来月、前半は今月） | 月・週の予定 | なし |
| 欠勤・キャンセル（`absence`。short「欠勤」） | `absenceHref(today)`＝`/plan?date=今日&do=absence`（日の予定で欄を開く。操作の項目） | — | なし |

- `screenSections(terms, features)`：画面の一覧（上の帯の名前・パレットの画面。タブでまとめた画面も1つずつ）。（なし）ホーム（入のときだけ）／予定（`SCHEDULE_GROUP`）月の予定・週の予定・日の予定（切なら担当を組む・空き状況も）／予定を組む 条件の重み・組み方の標準・担当を組む（入のときだけ）／（なし）空き状況（入のときだけ）／基本情報（`expert` が切なら区分の名前は無し。〈利用者さん〉・〈スタッフ〉は呼び名そのまま＝上の帯は「スタッフ」）予定と相性（`#/basics`）・〈利用者さん〉一覧・〈スタッフ〉一覧・相性・勤務時間（シフト）・勤務の見込み／設定 訪問の種類・特性の項目・管理者設定・データ。案を比べるは出さない（担当を組むの「案を比べる」から開く。上の帯の名前は `navTitleParts` の `EXTRA_TITLES` の「提案を比べる」。PRD D331）。切った機能の画面は出さない
- `BASICS_PATHS`・`BASICS_TABS`・`basicsTabs(terms, features)`：基本情報のタブの並び（予定と相性 `/basics`・〈利用者さん〉 `/clients`・〈スタッフ〉 `/staff`・相性 `/compat`・勤務時間（シフト） `/availability`（`match` に `/workload` も））。ADR-0054 の人のタブを予定を組むの 1 の段へ移したもの（ADR-0067）。`BASICS_PATHS` は `/basics`・`/clients`・`/staff`・`/compat`・`/availability`・`/workload`（`/clients/:id`・`/staff/:id` は `activeNavPath` で一覧に当てる）。名前は呼び方だけ（「一覧」は付けない）。切った機能のタブは出さない。画面の部品は `components/SettingsTabs.tsx` の `BasicsNav`（上に `ArrangeSteps`（1 基本情報が今の段）、下に設定のタブと同じ `TabNav`。`div.stack.basics-nav`、タブは `nav.view-switch.settings-tabs.people-tabs`・`aria-label="基本情報の切り替え"`・data-testid `people-tabs`・項目の `data-tab`＝`clients` など。今のタブは `aria-current="page"`）を予定と相性・〈利用者さん〉一覧・〈スタッフ〉一覧・相性・勤務時間（シフト）・勤務の見込みの `PageHeader` の `nav` に置く（〈利用者さん〉・〈スタッフ〉の人の画面には置かない）
- `SETTINGS_TABS`・`settingsTabs(features)`：設定のタブの並び（訪問の種類 `/types`・特性の項目 `/items`・管理者設定 `/settings`・データ `/data`）。切った機能のタブは出さない。`isSettingsPath(pathname)`
- `SCHEDULE_VIEWS`（`/month`・`/week`・`/plan`）・`isScheduleView(pathname)`（古い `#/schedule` も）・`SCHEDULE_DEFAULT`（`/plan`）・`scheduleHref(last)`（比較は覚えない）
- `isNavAction(to)`：`?do=` を持つ＝操作の項目（欠勤・キャンセル）。日付・月だけのクエリ（今日の予定・◯月の予定・担当を組む）は画面の項目
- `ARRANGE_PATHS`・`ARRANGE_STEPS`：予定を組むの画面（`BASICS_PATHS`・条件の重み・組み方の標準・担当を組む・比較）と段（`ArrangeStepKey`＝`basics|proposals|register|arrange`。基本情報（`/basics`）・案をくらべる・標準にする（どちらも `/standard`）・担当を組む（`/arrange`）の4段。表で直すは標準にするの中）。`arrangeSteps(full)`：出す段。`full`（標準が無い・組み方の標準の画面）なら4段、標準があれば 基本情報 → 担当を組む の2段。`nextArrangeStep(steps, key)`・`prevArrangeStep(steps, key)`（出す段の並びを渡して前後を引く）。部品は `components/SettingsTabs` の `ArrangeSteps({ current, full? })`（`nav`「予定を組むの段」の `ol.arrange-steps`。`full` を省くと標準の有無で決める。今の段は `aria-current="step"` の文字、ほかは押せるリンクで、組み方の標準の段なら `setStandardStep`）。段の表示は予定を組むのどの画面にもいつも出す（基本情報の各タブ・組み方の標準・担当を組む・案を比べる）。比較の画面では担当を組むに印。条件の重みは段に入れない。ADR-0066・ADR-0067
- `activeNavPath(pathname)`：`#/schedule` は `/plan`
- `isActiveNav(item, pathname)`：操作の項目はいつも false。そのほかは `match`（無ければ `to`）に今の画面が入るか
- `tabLabel(item)`：下のタブの名前（`short`、無ければ `label`）。`tabClick(item, pathname)`：今開いている画面そのもの（`to` が今の画面）なら `stay`（何もしない）、ほかは `go`（比較から「予定」は覚えた表示へ、欠勤は日の予定の上でも欄を開く）
- `navTitleParts(groups, pathname)`：groups は `screenSections`。上の帯の名前のグループの見出しと項目名（帯では「基本情報・利用者さん一覧」「予定を組む・条件の重み」と並べる。`.m-screen-group`・`.m-screen-item` の inline-block で、入りきらなければ項目名を次の行へ）。見出しの無いグループと予定のグループは項目名だけ（「日の予定」。「予定・日の予定」と重ねない）。一覧に無い画面は null
- `isSimpleMenu(features)`・`homePath(features)`・`SIMPLE_BOTTOM_TABS`：上の節。
- `NAV_OPEN_DEFAULT`：畳める親の `key` と既定で開くか（`{ schedule: true, arrange: true, settings: false }`）。`MenuBadges`・`LastViews`・`MenuItem` の型もここ
- `bottomTabs(groups, simple)`：`BOTTOM_TABS`＝`['home', 'schedule', 'absence']`（`simple` なら `SIMPLE_BOTTOM_TABS`＝予定・〈利用者さん〉・〈スタッフ〉・設定）の順にメニュー（親と子の項目を平らにして）から `key` で引く（欠勤は予定の子 `absence` から引く。メニューに無い項目は出さない。名前は `tabLabel`＝ホーム・予定・欠勤）。「探す」「メニュー」は画面のボタン。下のタブは今のまま（PRD D349）
- 画面の見出し（`PageHeader` の h1）は画面の一覧の項目名と同じ（PRD D179・D230）：ホーム（見出しの下の文は「今日やること：…」）・月の予定・週の予定・日の予定・勤務時間（シフト）・勤務の見込み（`fare` の入り切りで変えない）ほか。本文・行き先の文の画面名もこれにそろえる（人の稼働時間・Excel のシート名・［月｜週｜日］は変えない）。「今日」は画面の呼び名に使わない（PRD D273）

### `AdminShell`（`src/app/App.tsx`）

- ファイル：殻は `App.tsx`、上の帯 `AppHeader`・下のタブ `BottomTabs`・日付の切り替え `DateSwitcher` は `shellBars.tsx`、`NavGroups`・`Brand`・`NAV_ICONS` は `shellNav.tsx`、メニューの並び `useShellNav`・パレットと引き出しの開け閉め `useShellOverlays`・帯の高さ `useHeaderHeight` は `useAdminShell.ts`

- `groups = menuSections(terms, today, features, last, badges)`（`badges = { ...menuBadges(data, today), basisChanged }`。`basisChanged = useBasisChanged(data)`。ADR-0067）・`screens = screenSections(terms, features)`、アイコンは `NAV_ICONS`。`last` はモジュールの `lastViews`（描くたびに今の画面が予定の表示・設定のタブなら覚える `rememberView`。開いている間だけ・保存しない。印刷・〈スタッフ〉のスマホ画面から戻っても残る）
- `NavGroups({ groups, pathname, onPick? })`：左のメニューと引き出しで共通。全部 `Link`（`aria-current` は `isActiveNav` で自分で付ける。data-testid `nav-link`・`data-key`）。中の nav の名前は「画面の一覧」。子を持つ項目は `div.nav-parent[data-parent]`（`.is-open`）の中に、親の行 `.nav-parent-row`（親の `Link`＋`.nav-toggle`）と `.nav-sub#nav-sub-<key>`（畳めば `hidden`。開いていれば子の `Link`＝`.nav-link.nav-child`）。`.nav-toggle` の名前は「◯の項目」で、開け閉めは `aria-expanded` だけ。開け閉めの覚え（`store/navOpen` の `NAV_OPEN_KEY`＝`visit-route-demo:nav-open`。`navOpenMemory` の1つの覚えを `useSyncExternalStore` で読み、左のメニューと引き出しで同じ）と、今の画面の親へ移ったときにその親を開いて見せる（`auto`。覚えない。同じ親の中で画面を移っても開き直さない。押して畳めば外す）はここ。子の項目もタッチできる端末では押せる所 44px。印は親が開いていて子が今の画面なら子、そうでなければ親。`badge` は `span.nav-badge`
- 上の帯 `.app-header`：狭い画面だけ ロゴと今の画面の名前（`.m-head-title`・data-testid `screen-name`。`navTitleParts(screens, …)`。一覧に無い画面は事業所の名前）。広い画面では `display: none`
- 上の帯に「探す・移動」（`cmdk-open`。`aria-haspopup="dialog"`・`aria-expanded`・`aria-keyshortcuts`）。860px 以下では上の帯に出さず、下のタブの「探す」で開く（PRD D336。上の帯はロゴ・今の画面の名前・日付の切り替えの1段。名前は内容の幅だけ取り、日付の切り替えが入らなければ2段目へ）
- 上の帯の右端に全画面の切り替え（`components/FullscreenButton`・`fullscreen`。`IconButton`・`aria-pressed`。Fullscreen API。`fullscreenchange` で表示を合わせる。`document.fullscreenEnabled` が偽なら出さない。印刷では出さない。PRD D358）
- 帯の高さ：狭い画面では2段に折り返すことがあるので `ResizeObserver` で測って `--header-h` に出す（広い画面では消して styles.css の 72px のまま）
- 本文の後ろに下のタブ（`nav.bottom-tabs`・`aria-label="よく使う画面"`・data-testid `bottom-tab`・`data-tab`＝`key`・今の画面は `aria-current="page"`（`isActiveNav`））：`BOTTOM_TABS`（ホーム・予定・欠勤）、「探す」ボタン（`button.bottom-tab`・data-testid `bottom-search`・`data-tab="search"`・`aria-haspopup="dialog"`・`aria-expanded`。コマンドパレットを開く）、最後に「メニュー」ボタン（`button.bottom-tab.m-menu-btn`・data-testid `menu-btn`・`aria-haspopup="dialog"`・`aria-expanded`・`aria-controls` は開いているときだけ）。空き状況はメニューとパレットの画面から（PRD D336）
- 画面を移ったら引き出しとコマンドパレットを閉じる（パレットは開いたときの URL の hash の画面のパスを覚え、移った先の画面で開き直していれば閉じない。`keepPaletteOn`）。`matchMedia('(max-width: 860px)')` が外れたら（広い画面へ戻ったら）引き出しを閉じ、フォーカスは左のメニューの今の項目へ
- 全体の「元に戻す・やり直す」のキー（PRD D329。ADR-0054）：殻に `components/undo` の `HistoryKeys` を1つ。window の keydown で `lib/history` の `historyKey`（Ctrl+Z＝戻す、Ctrl+Shift+Z・Ctrl+Y＝やり直す。mac は ⌘）なら、入力欄・テキストエリア・選ぶ欄・書ける要素の中（`isTextTarget`）と `[aria-modal="true"]` が開いている間は何もしない（その欄の文字の取り消しに任せる）。ほかは `preventDefault` して store の `undo()`・`redo()` を呼び、トースト「元に戻しました（手の名前）」に「やり直す」（`toast-redo`）／「やり直しました（…）」に「元に戻す」（`toast-undo`）。戻せる手が無ければ「戻せる操作がありません」
- window の keydown で `isPaletteShortcut` なら `preventDefault` し、`[aria-modal="true"]` が無ければコマンドパレットを開く（右の欄・確認・ツアーの上では開かない）
- main の `Guarded` は `Suspense`（`fallback` は `PageLoading`：`.empty.page-loading`・`output`・data-testid `page-loading`・「画面を読み込んでいます…」）の中。`Outlet` の後ろに `PreloadWhenShown`（画面が出て手が空いたら分けたチャンクを先に読む。PRD D248・ADR-0039。`src/app/lazyPages.tsx`）
- 今の画面の項目（引き出し）は閉じるだけ、今の画面の下のタブは何もしない（どちらも `tabClick` が `stay` なら `preventDefault`）。URL のクエリ＝画面の状態を消さない

### 引き出し（`src/app/NavDrawer.tsx`）

- 左から出す。body の直下（`createPortal`）、`role="dialog"`・`aria-modal`・名前「メニュー」。開いているあいだ `#root` を `inert`
- 開いたら今の画面の項目（`aria-current`）へフォーカス。Esc・外（背景）・× で閉じる。項目を押すと閉じる
- Tab は中で回す（`components/ui.tsx` の `FOCUSABLE`。`SidePanel` と同じやり方）。閉じたら `returnFocus`（「メニュー」ボタン）へ
- 裏のスクロールは `components/useBodyScrollLock`（`lib/scrollLock` の `createScrollLock`。数を数え、html と body の overflow を最後の解除で戻す。テストあり）。`SidePanel` と共通。右の欄と重なっても最後の1つが閉じるまで戻さない
- z-index 1100（`SidePanel` と同じ。地図・下のタブより前、トーストより後ろ）

### スマホの CSS（`styles.css`）

- `--bottom-tabs-h`：広い画面 0px、860px 以下で `58px + env(safe-area-inset-bottom)`、印刷で 0px
- 860px 以下：左のメニューは `display: none`、上の帯は折り返し可・日付の切り替えは右寄せ、本文の下の余白に `--bottom-tabs-h` を足す、下のタブは `position: fixed`・高さ `--bottom-tabs-h`・タブの数で等分（ふつう5列：ホーム・予定・欠勤・探す・メニュー。下の余白は safe-area。「メニュー」の `button` は地と枠を消してほかのタブと同じ見た目）
- 浮いている部品は `--bottom-tabs-h` の上に出す：
  - 地図（`.map-dock`）の bottom に足す。地図のボタン `.map-dock-fab` は `right: max(12px, env(safe-area-inset-right))`・`bottom: calc(12px + var(--bottom-tabs-h))`。`body:has(.map-dock-fab) .app-main` は下の余白をボタンの分（56px）足す
  - 欠勤の振り直しの帯（`plan.css` の `.reassign-dock`）は `max(12px + タブ, --map-dock-top + 8px)`
  - トーストは `max(96px, タブ + 12px, 帯・地図の上)`
- `index.html` の viewport に `viewport-fit=cover`。860px 以下の上の帯・本文・下のタブ・引き出し・地図、〈スタッフ〉のスマホ画面（`.staff-shell`）の上と左右を safe-area で避ける
- 印刷：下のタブ・引き出しは出さない。`print and (max-width: 860px)` では上の帯も出さない

### 予定の切り替え（`components/ViewSwitch.tsx`）・設定のタブ（`components/SettingsTabs.tsx`）

- 月・週・日の見出しのすぐ下のナビの行（`ScheduleNav`。PRD D347）に［月｜週｜日］（リンクのナビ。今の画面を `aria-current`。PRD D237。[pages-common.md](pages-common.md) の「画面の見出しとボタンの3段」）。押すと選んでいる日付（`useDay`）で移る：月は `?ym=` にその日の月、週は `?d=` にその日、日はその日
- 月・週で日付を変えたら（月のマスを押して日の予定へ移る・帯・日の見出しを押す、週・月を送る）選んでいる日付も合わせる（月を送ったときはその月の1日、ただし今月なら今日）
- 各画面の `lead`：月「一月の担当を見て、担当なしや要対応を手で直し、確定します」、週「この週の担当を見て、日時をドラッグでずらし、〈スタッフ〉に伝えたら確定します」、日「その日の担当を見て直し、〈スタッフ〉に伝えたら確定します」
- 予定の日・週・月は「拡大率」として同じ部品を並べる（PRD D327〜D332。ADR-0054。詳細は [pages-common.md](pages-common.md) の「予定の共通の部品」）：見出し（題名・1行の説明）→ ナビの行（今日・‹ 期間 ▾ ›・［月｜週｜日］・状態・主ボタン。PRD D347）→（月だけ）進み具合の帯／（週）1行の状態 → 操作の行 `ScheduleToolbar` → 本体 → 複数選択の帯（日・週・月・人の予定表。札の3段（大＝時間軸の帯・中＝リストの行・小＝表のマスの札）と入れ物（時間軸・表・リスト）、印・選ぶ・キー・ドラッグの落とし先の判定は共通の部品。日・週・月は同じ札をどの入れ物で何日分見せるか。PRD D339〜D343。ADR-0056・ADR-0057。[pages-common.md](pages-common.md) の「訪問の札の共通の部品」）
- 設定のタブ（PRD D275・D283）：訪問の種類・特性の項目・管理者設定・データの見出しの題名の下（`PageHeader` の `nav`）に、`settingsTabs(features)` のタブ（`nav.view-switch.settings-tabs`・`aria-label="設定の切り替え"`・data-testid `settings-tabs`・各タブ `data-tab`。今の画面を `aria-current`。見た目は［月｜週｜日］と同じ）。狭い画面では横に巻き（`overflow-x: auto`・折り返さない）、画面を開いたら今のタブを真ん中へ巻く（ページは縦に巻かない）

## コマンドパレット（ADR-0027。PRD D180〜D183）

### `lib/commandPalette.ts`（純粋関数。テストあり）

- `PaletteItem`：`id`・`kind`（`action|screen|client|staff|visit`）・`label`・`hint`・`to`・`date?`・`visitId?`・`op?`（`'visit-add'`）・`keys`（`lib/search` の `normalizeKana` でそろえた名前・よみ・別名）。`paletteItem` で作る
- `paletteActions(today, { features })`：欠勤・キャンセルを登録・日の予定（今日）を開く・今月／来月の担当を組む（`/arrange?ym=`）・要対応を見る（月の予定の `?do=attention`）・確定していない日を見る（`unconfirmed`）・訪問を追加（`op: 'visit-add'`）・問い合わせに答える。切った機能の操作は出さない
- `paletteScreens(sections, terms)`：sections は `screenSections`（タブでまとめた画面も1つずつ。案を比べるは無い。PRD D273・D275・D331）。操作でない項目。補足はグループの見出し（グループの見出しも語に入るので「設定」「予定」で各画面を引ける）。読み・言い換え `SCREEN_WORDS`、〈利用者さん〉一覧・〈スタッフ〉一覧には呼び方のよみ `TERM_READINGS`（既定の呼び方の漢字だけ）
- `palettePeople(clients, staff, terms)`：`/clients/:id`・`/staff/:id`（人の画面）。段階・休止中を補足に
- `filterPalette(items, query, limit=8)`：語に分けて AND、種類の順・先頭一致を前に、人は種類ごと limit まで（`rest`）。空なら操作と画面だけ
- 訪問（PRD D304・D337。ADR-0051・ADR-0055）：`visitIndex(visits)`（`byClient`・`byStaff`（担当の〈スタッフ〉ごと）・`all`。どれも日付・開始の順）・`paletteDate(term, today)`（「10/28」「10月28日」「2026-10-28」「今日」「明日」「あさって」。年の無い日付は去年・今年・来年のうち今日に近い方）・`paletteVisits(query, people, index, today, describe, limit=6, attention?)`（語を日付・「担当なし」（担当なし・担当無し・たんとうなし・未割当）・「要対応」（要対応・ようたいおう）・名前に分ける。名前の語がすべて〈利用者さん〉の名前・よみに含まれる人（20人まで）の回と、すべて〈スタッフ〉の名前・よみに含まれる人（20人まで）が担当の回。名前の語が無く「担当なし」「要対応」があれば全部の回から。日付があればその日の回（取り消しも）、無ければ今日以降の近い回（取り消しを除く）。「担当なし」は担当の無い回、「要対応」は `attention`（無ければ担当なし）で当たる回で、日付が無ければ今日から `PALETTE_ATTENTION_DAYS`（31）日先まで。どの語も無ければ出さない。かなの日付の語（「あす」など）しか無ければ名前として読む。名前の表示は〈利用者さん〉の名前）。種類の見出しは「訪問」で、`filterPalette` の結果の後ろに足す
- `paletteTerms`・`moveActive`（端で回る）・`isPaletteShortcut(e, isMac)`（mac は ⌘K、ほかは Ctrl+K。Shift・Alt・変換中は違う）・`isMacPlatform`・`paletteKindLabel`・`hashPathname(hash)`・`keepPaletteOn(openFor, pathname)`

### `components/CommandPalette.tsx`（`commandPalette.css`。区画の部品 `CommandPaletteParts.tsx`・閉じ込めとフォーカス `usePaletteModal.ts`・選んだあとの動き `usePalettePick.ts`・「要対応」の検査 `usePaletteCare.ts`）

- body の直下の `role="dialog"`・`aria-modal`（名前「探す・移動」）。開いたら body のほかの子を `inertLock`、`useBodyScrollLock`、入力欄へフォーカス
- window の捕捉の段で Esc・Ctrl+K（閉じる）・Tab（`trapTarget` で中で回す）を受け、右の欄・引き出しへ渡さない。入力欄の中の Ctrl+K も閉じる（文字はそのまま、閉じたら入力欄へ）
- 閉じたら開く前の要素へフォーカス（つながっていなければ上の帯の `cmdk-open`）。吹き出しの中から開いて閉じても body に落とさない
- 入力欄は `role="combobox"`（`aria-expanded`・`aria-controls`・`aria-autocomplete="list"`・`aria-activedescendant`）、候補は `role="listbox"` の中の `role="group"`（種類の見出し）と `role="option"`（`aria-selected`。押してもフォーカスは入力欄）。↑↓・Enter。件数は打ってから `aria-live`
- 選んでいる候補は見える位置へ（先頭なら scrollTop=0、種類の先頭なら見出しごと）
- 候補の語は `useMemo`（開いたとき・データが変わったとき）でそろえ、打つたびは `filterPalette` だけ（300人×60人で1文字 100ms 以内）
- 訪問の索引は打ってから作り（開いただけでは作らない）、開いている間は使い回す。訪問の補足は担当（訪問の担当）・「担当なし」・取り消し。「要対応」の `attention` は日の予定と同じ訪問ごとの検査（`dayProblemOf` → `routesOf` → `visitIssues`）を候補の日だけ計算し、日ごとに覚える（データが変わったら捨てる）
- 選ぶと閉じて、訪問（`visitId`）・「訪問を追加」（`op`）は画面を移らずに訪問の詳細の欄（`useOpenVisit`）を開く。ほかは `date` があれば `setDate`、今の画面なら移らない、ほかは `navigate(to)`
- z-index 1150（引き出し 1100 とトースト 1200 の間）。印刷で出さない。860px 以下は上に寄せ、下の案内（↑↓ Enter Esc）を隠す
