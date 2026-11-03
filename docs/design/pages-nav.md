# pages（画面）：メニュー・ナビゲーション・コマンドパレット

> この画面のファイル：`src/lib/nav.ts`・`src/app/App.tsx`（`shellBars.tsx`・`shellNav.tsx`・`useAdminShell.ts`）・`src/app/NavDrawer.tsx`・`components/ViewSwitch.tsx`・`components/SettingsTabs.tsx`・`lib/commandPalette.ts`・`components/CommandPalette.tsx`。
> 画面全体の決まり・ルート一覧は [pages.md](pages.md)。

## メニューとナビゲーション

関連 ADR：0024・0027・0045・0054・0055・0063・0067・0073・0074・0077・0078。関連 PRD：D132〜D135・D179〜D183・D237・D239・D270・D273・D275・D326・D336・D347・D349・D360・D394・D400〜D404。

- メニューは見出しなしの1グループ。エキスパート機能（`expert`）切：予定・空き状況・〈利用者さん〉・〈スタッフ〉・設定 の5つ。入：〈スタッフ〉と設定のあいだに「組む」を足した6つ。左のメニュー・スマホの引き出しで同じ。下のタブは 切が 予定・空き状況・〈利用者さん〉・〈スタッフ〉、入が 予定・〈利用者さん〉・〈スタッフ〉・組む
- 要対応は予定の上の要対応の帯、欠勤・キャンセルは予定の操作の行（その他 ▾）から開く。担当を組む（`/arrange`）は切ではメニューに出さず、日の予定などから開く
- 子の項目を持つのは入の「組む」だけ：基本情報・組み方の標準（標準が無い間だけ）・担当を組む（作業の順。条件の重みは組み方の標準の寄り道）。子は親の下の字下げした小さな行（`.nav-sub`・`.nav-child`）。親の行の右の ▾（`button.nav-toggle`・data-testid `nav-toggle`・`aria-expanded`・`aria-controls`＝`nav-sub-<key>`・名前「◯の項目を畳む／開く」）で畳める。設定は子を持たず、押すと最後に開いたタブ
- 畳み：既定は `NAV_OPEN_DEFAULT`＝組むを開く。開け閉めは localStorage の `visit-route-demo:nav-open`（`store/navOpen` の `navOpenMemory`。`{ 親の key: boolean }` の JSON。読めなければ既定）。今の画面の親が畳んであれば、画面を移ったときに開く（自分で畳んだ開け閉めは、移るまで変えない）
- 今の画面の印（`aria-current="page"`・`.active`）：親が開いていれば子に、畳んでいれば親に付ける。子のどれにも当たらなければ親。親の行は子が今の画面のとき太字だけ（`.has-current`）。基本情報の子は予定と相性だけ（相性・勤務は〈利用者さん〉・〈スタッフ〉に付く）
- 件数の印は「組む」の1つだけ（`span.nav-badge`・data-testid `nav-badge`・見える文字と `.sr-only` の読み上げ。`arrangeBadge`）：「変更」（標準を登録したあと、基本情報が最後に組んだあとに変わった）か「N日」（組む月の担当なしの訪問がある日の数。0なら出さない）。親の行に付くので畳んでも見える。数えるのは `lib/scheduleMode` の `menuBadges`
- 広い画面の左のメニュー（`.side-nav`）：項目（`.nav-link`）は `min-height: 34px`（上下 5px・行の高さ 1.4）、グループの間 10px、メニューの上下 14px・16px。1440×900 で最後の項目（設定）まで巻かずに見える。タッチできる端末（`any-pointer: coarse`）では `.nav-link` を `min-height: 44px`、［月｜週｜日］のタブ（見た目 36px）は `::before` で上下 4px 広げて 44px
- 高さ 860px 以下の広い画面（1366×768 など）：項目 30px（上下 3px・行の高さ 1.3・0.92rem）・グループの間 4px・見出しの下の余白 0・ロゴ 32px・子の項目（`.nav-child`）26px。1366×768 で既定の開け閉めのまま設定まで巻かずに収まる（`scripts/e2e-nav.cjs`）。入らないときは `.side-nav` の背景（下の端の影 `scroll` と、中身の終わりで影を隠す `local` の重ね）で続きを示す
- 上の帯の日付の選択（`DateSwitcher`）は `lib/nav` の `showsDateSwitch(pathname)` の画面（`DATE_PAGES`：案を比べる・勤務の見込み・勤務時間（シフト））だけ。日・週・月の予定は画面の中のナビの行（`ScheduleNav`）で送る。選んでいる日付は覚えたままで、外枠 `.app-shell` の `data-date` で読める

### メニューの並び・下のタブ・要対応の帯

- 判定は `lib/nav` の `menuSections`（`expert` の入切だけで分ける）。項目の `key`：`schedule`・`vacancy`・`clients`・`staff`・（入）`arrange`・`settings`。名前は 予定・空き状況・`terms.client`・`terms.staff`・組む・設定。`to`＝`scheduleHref(last.schedule)`・`/vacancy`・`/clients`・`/staff`・`/arrange`（子つき）・`settingsHref`。今の画面の印（`match`）：予定は 月・週・日（切はさらに比較・担当を組む）、空き状況は空き状況、〈利用者さん〉・〈スタッフ〉は `lib/peopleTabs` の `peopleMatch(side, last.people, !expert)`（一覧と人のタブの画面。相性は来た側の1つ。予定と相性は切だけ〈利用者さん〉、入は「組む」の基本情報）、組むは `ARRANGE_PATHS`、設定は設定のタブ。〈利用者さん〉・〈スタッフ〉の画面（`/clients/:id`・`/staff/:id`）は `activeNavPath` で一覧に当てる。切った機能の項目は出さない
- 下のタブ：`bottomTabs(groups, features)`。並びは `bottomTabKeys(features)`：入は 予定・〈利用者さん〉・〈スタッフ〉・組む（設定・空き状況は引き出しとパレット）、切は 予定・空き状況・〈利用者さん〉・〈スタッフ〉（設定は引き出しとパレット。空き状況（`vacancy`）が切なら空き状況の代わりに設定。ADR-0080）。そのあとに画面のボタンの「探す」「メニュー」
- 起動先：`homePath(features)`＝`startGuidePlanPath(features)`（繰り返しを使うなら `/month`、使わないなら `/week`）。`#/home`・`#/`・知らない URL・切った機能の URL（知らせ `FeatureOffNotice` を上に出す）はここへ移す（`Navigate replace`。`App.tsx`）
- 画面の一覧（`screenSections`。パレットの画面・上の帯の名前）：予定（月・週・日・空き状況。切はさらに担当を組む）／見出しなしの人のグループ（切は先頭に予定と相性・〈利用者さん〉・〈スタッフ〉・相性・勤務時間（シフト）・勤務の見込み）／組む（入だけ。予定と相性・条件の重み・組み方の標準・担当を組む）／設定
- 要対応の帯（`components/attentionBand.tsx`・`attentionBand.css`・フック `useAttentionBand`。data-testid `attention-band`）：月・週・日の予定のナビの行のすぐ下に1本（入切とも。無ければ出さない。印刷で出さない）
  - 判定は `lib/attentionBand` の `attentionBand(statuses, today, startOf, expert?)`（純粋関数。テストあり）。見る日は `bandDays(today)`＝今日〜翌月末（自動の組みの範囲 `autoRange` と同じ）
  - `DayStatus.issues` から訪問を件数で数える（分け方は `lib/bandIssues`。ADR-0089）：**担当なし**（`unassigned`）・**間に合わない**（`late`＝その訪問だけでも時間の約束・働ける時間に収まらない）・**重なり**（`overlap`＝その訪問だけなら収まるが前の訪問のあとでは間に合わない。`lib/dayPlan` の `visitIssues` が `scheduleRoute` をその訪問1件で数え直して分ける）・**休みの人**（`off`＝休み・休止の人に割り当てた訪問）。1つの訪問は1つの種類（担当なし → 休みの人 → 間に合わない → 重なり）。条件に合わない（`notAllowed`）は切では数えない
  - 入だけの種類（`expert`＝`ExpertBandInput`：`hasStandard`・`basisChanged`・`planYm`・`isOn`）：条件に合わない N件・拘束超 N日・組み方の標準が無い・基本情報が変わった（組み直す）・未確定 N日（訪問があって `state` が told でない日。`monthProgress` の `unconfirmed` と同じ数え方）。行き先の機能が切なら出さない（`isOn(href)`）
  - 1行は「要対応 担当なし N件・間に合わない N件・重なり N件・休みの人 N件・…」（0件の種類は書かない。並びは `BAND_KINDS`）
  - ［見に行く ›］（`attention-band-go`）の先 `go`（`BandGo`＝`{ to, date?, visitId? }`）は並びの先頭の種類：訪問の種類は、間に合わない・重なり・休みの人の訪問があればそのうち、無ければ担当なしのうち、いちばん早い日の開始（`startOf`）がいちばん早い訪問（並び `visits`＝間に合わない・重なり・休みの人 → 担当なし、それぞれ日付 → 開始。同じなら検査の並び）。**順番に見に行く**（ADR-0089）：押すたびに `bandStep(visits, seen, 1)` で最後に見た訪問の次へ（最後の次は最初）。2回目からは［‹ 前へ］（`attention-band-prev`。`bandStep(…, -1)`）と「n/N」（`attention-band-place`。`bandPlace`）を出し、見に行くの読み上げの名前は「見に行く（n/N）」。見た位置（`BandSeen`＝最後に見た訪問と押した回数）は `components/useBandStep` のモジュールの入れ物に画面の間だけ覚える（保存しない）。並びは押したときの帯から作り直し、見た訪問が直して消えていれば並びの同じ位置（組・日付・開始）から次・前を探す。`setDate(日)` のうえ `navigate('/plan', { state: { visitId, band: true } })`。日の予定の `usePlanNav` が、担当のある訪問は選んで見える所へ巻き、担当なしは `band` のときだけ欄（受けられる人）を開く（日の予定を開いたまま押しても `location.key` で受け直す。履歴は置き換え）。標準が無いは `/standard`、組み直しは `/arrange?ym=<組む月>`、未確定は1日だけならその日の `/plan`・2日以上なら `/month?ym=…&do=unconfirmed`。下書きのある画面からは `confirmLeave` で確かめる
  - ［要対応を組む］（`attention-band-arrange`。`components/useBandArrange`）：切で、今日〜翌月末の組める要対応の訪問（担当なしと、間に合わない・重なり・休みの人。`targetCount(bandTargets(…))`）が1件以上か組んでいる間だけ。`btn btn-small` の従のボタン。押すと `requestBandArrange`（担当・順番・開始を組み直す。ほかの訪問は固定、減らない訪問は元のまま。知らせは「N件の担当を組みました」）、組んでいる間は「組んでいます…」で `aria-disabled`
- 来月の確認（PRD D413。ADR-0081。`components/nextMonthCheck.tsx`・フック `useNextMonthCheck`・CSS は `attentionBand.css`。data-testid `next-month-check`）：月・週・日の予定の要対応の帯のすぐ下に1行（帯が無くても出す。印刷で出さない）
  - 出す条件は `lib/nextMonthCheck` の `nextMonthTarget(today, expert, stored)`（純粋関数。テストあり）：エキスパート機能が切・今日が月の `NEXT_MONTH_FROM_DAY`（20）日以降・`store/navOpen` の鍵 `nextMonthCheckKey(today)`＝`nextMonth:<今月>` が false でない。当てはまれば来月（YYYY-MM）
  - 中身は `nextMonthCheck(statuses, ym)`：来月の日ごとの状態（`useDayStatuses`。要対応の帯・月の画面と同じ覚え）の `count` の合計と、訪問ごとに `visitBandKind`（要対応の帯と同じ：担当なし → 休みの人 → 間に合わない → 重なり）で数えた件数。合計が0なら null（出さない）
  - 1行は「12月の予定 N件はできています・担当なし a件・間に合わない b件・重なり c件・休みの人 d件」（0件の種類は書かない。`next-month-check-text`）。右に［12月を見る ›］（`next-month-check-go`。`/month?ym=<来月>` へのリンク）と［×］（`next-month-check-close`。読み上げ「12月の確認を閉じる（今月は出しません）」）。箱は `section` で読み上げの名前「12月の確認」。色は地の文（急ぎではない）。狭い幅は折り返す
  - ［×］は `navOpenMemory.write(nextMonth:<今月>, false)`（端末に覚える。データ・書き出しに入れない）。閉じたらフォーカスを見出しへ移す。翌月の20日には鍵が変わるのでまた出す。ボタンは足さない（来月の要対応を組むのは帯の［要対応を組む］。今日〜翌月末）
- 「訪問を1件追加」：日の主ボタン（`ADD_VISIT_LABEL`。開くのは訪問の欄）。月・週は別の言葉（`planAddLabel`＝「定期の予定を追加」／単発のみは「予約を追加」）で、 `ToolbarRow`（`mainTools` の `plan`）から `components/AddPlanPanel` を開く（[design.md](../design.md) の「定期の予定を追加」）
- 人の小さいタブ：`lib/peopleTabs`（`peopleTabs`・`peopleTabsLabel`・`peopleSideOf`・`rememberedSide`・`peopleMatch`）と `components/SettingsTabs` の `PeopleTabs`（一覧・相性・勤務の画面。`data-testid="people-tabs"`）。相性でどちらから来たかは `components/peopleSide`。予定と相性は別の `BasicsNav`
- 予定の「その他 ▾」：画面ごとの項目（表示の切り替え・使い方・印刷など）と元に戻す・やり直す・連絡を貼り付けて入れる（PRD D418）だけ

### `lib/nav.ts`（純粋関数。テストあり）

- `menuSections(terms, today, features, last, badges)`：メニューの並びの1か所（上の節）。項目は `MenuItem`＝`{ key, to, label, short?, match?, icon, children?, badge? }`（`key` は下のタブで引く名前、`match` は受け持つ画面のパス（無ければ `to`）、`icon` は名前 `NavIcon`、`short` は下のタブの短い名前、`children` は畳める子、`badge` は `{ text, label }`）。`last`（`LastViews`＝`{ schedule?, settings?, people? }`）は最後に開いた予定の表示・設定のタブ・人の側。`badges`（`MenuBadges`＝`{ planUnassignedDays?, hasStandard?, basisChanged? }`）は `menuBadges` の値と `useBasisChanged` の値（`app/useAdminShell`）

| 項目（`key`・`to`。下のタブは `short`） | 子の項目 |
|---|---|
| 予定（`schedule`・`scheduleHref(last.schedule)`＝最後に開いた `/month`・`/week`・`/plan`、無ければ `/plan`。short「予定」。`match`＝`SCHEDULE_PATHS`） | なし |
| 空き状況（`vacancy`・`/vacancy`） | なし |
| 〈利用者さん〉（`clients`・`/clients`）・〈スタッフ〉（`staff`・`/staff`）。short は呼び名 | なし |
| 組む（入のとき。`arrange`・`/arrange`。short「組む」。`match`＝`ARRANGE_PATHS`＝`/basics`・`/rules`・`/standard`・`/arrange`・`/compare`。件数の印つき） | 基本情報（`arrange:basics`・`/basics`。アイコン `people`）・組み方の標準（`arrange:standard`・`/standard`・`match` に `/rules`。`badges.hasStandard` なら出さない）・担当を組む（`arrange:assign`・`/arrange?ym=<planYm(today)>`。`match` は `/arrange`・`/compare`（標準があれば `/standard`・`/rules` も）） |
| 設定（`settings`・`settingsHref(features, last.settings)`＝最後に開いた設定のタブ、無ければ先頭の訪問の種類。`match`＝切っていない設定のタブ） | なし（設定のタブは画面の上） |

欠勤・キャンセルを登録する URL は `absenceHref(today)`＝`/plan?date=今日&do=absence`（メニューには出さず、操作の行・パレットから）。

- `screenSections(terms, features)`：画面の一覧（上の節）。タブでまとめた画面も1つずつ持つ。案を比べるは出さない（担当を組むから開く。上の帯の名前は `EXTRA_TITLES` の「提案を比べる」、`/start` は「登録の案内」）。切った機能の画面は出さない
- `BASICS_TABS`・`basicsTabs(features)`：基本情報のタブ（予定と相性 `/basics`・相性 `/compat`・勤務時間（シフト） `/availability`（`match` に `/workload` も））。部品は `components/SettingsTabs.tsx` の `BasicsNav`（上に `ArrangeSteps`、下に `TabNav`。`div.stack.basics-nav`、タブは `nav.view-switch.settings-tabs.people-tabs`・`aria-label="基本情報の切り替え"`・data-testid `people-tabs`・項目の `data-tab`＝`basics`・`compat` など。今のタブは `aria-current="page"`）を予定と相性の `PageHeader` の `nav` に置く。〈利用者さん〉一覧・〈スタッフ〉一覧・相性・勤務時間（シフト）・勤務の見込みの `nav` は `PeopleTabs`（人の画面には置かない）
- `SETTINGS_TABS`・`settingsTabs(features)`：設定のタブ（訪問の種類 `/types`・特性の項目 `/items`・管理者設定 `/settings`・データ `/data`）。`isSettingsPath(pathname)`
- `SCHEDULE_VIEWS`（`/month`・`/week`・`/plan`）・`isScheduleView(pathname)`（`#/schedule` も）・`SCHEDULE_DEFAULT`（`/plan`）・`scheduleHref(last)`（比較は覚えない）
- `isNavAction(to)`：`?do=` を持つ＝操作の項目。日付・月だけのクエリは画面の項目
- `ARRANGE_STEPS`：予定を組むの段（`ArrangeStepKey`＝`basics|proposals|register|arrange`。基本情報 `/basics`・案をくらべる・標準にする（どちらも `/standard`）・担当を組む `/arrange`。表で直すは標準にするの中。条件の重みは段に入れない）。`arrangeSteps(full)`：`full`（標準が無い・組み方の標準の画面）なら4段、標準があれば 基本情報 → 担当を組む の2段。`nextArrangeStep(steps, key)`・`prevArrangeStep(steps, key)`。部品は `components/SettingsTabs` の `ArrangeSteps({ current, full? })`（`nav`「予定を組むの段」の `ol.arrange-steps`。`full` を省くと標準の有無で決める。今の段は `aria-current="step"` の文字、ほかはリンクで、組み方の標準の段なら `setStandardStep`）。予定を組むのどの画面にも出す（基本情報の各タブ・組み方の標準・担当を組む）。寄り道の条件の重み・案を比べるには出さない（ADR-0088）
- `activeNavPath(pathname)`：`#/schedule` は `/plan`、人の画面は一覧
- `isActiveNav(item, pathname)`：操作の項目はいつも false。ほかは `match`（無ければ `to`）に今の画面が入るか
- `tabLabel(item)`：`short`、無ければ `label`。`tabClick(item, pathname)`：今の画面そのものなら `stay`、ほかは `go`
- `navTitleParts(groups, pathname)`：上の帯の名前のグループの見出しと項目名（「組む・条件の重み」など。`.m-screen-group`・`.m-screen-item` の inline-block で、入りきらなければ項目名を次の行へ）。見出しの無いグループと予定のグループは項目名だけ。一覧に無い画面は null
- `homePath(features)`・`bottomTabKeys(features)`・`bottomTabs(groups, features)`：上の節
- `NAV_OPEN_DEFAULT`（`{ arrange: true }`）。`MenuBadges`・`LastViews`・`MenuItem` の型もここ
- 画面の見出し（`PageHeader` の h1）は画面の一覧の項目名と同じ（月の予定・週の予定・日の予定・勤務時間（シフト）・勤務の見込みほか。`fare` の入り切りで変えない）。本文・行き先の文の画面名もこれにそろえる（人の稼働時間・Excel のシート名・［月｜週｜日］は変えない）。「今日」は画面の呼び名に使わない

### `AdminShell`（`src/app/App.tsx`）

- ファイル：殻は `App.tsx`、上の帯 `AppHeader`・下のタブ `BottomTabs`・日付の切り替え `DateSwitcher` は `shellBars.tsx`、`NavGroups`・`Brand`・`NAV_ICONS` は `shellNav.tsx`、メニューの並び `useShellNav`・パレットと引き出しの開け閉め `useShellOverlays`・帯の高さ `useHeaderHeight` は `useAdminShell.ts`
- `groups = menuSections(terms, today, features, last, badges)`（`badges = { ...menuBadges(data, today), basisChanged: useBasisChanged(data) }`）・`screens = screenSections(terms, features)`、アイコンは `NAV_ICONS`。`last` はモジュールの `lastViews`（描くたびに `rememberView` で覚える。保存しない。印刷・〈スタッフ〉のスマホ画面から戻っても残る）
- `NavGroups({ groups, pathname, onPick? })`：左のメニューと引き出しで共通。全部 `Link`（`aria-current` は `isActiveNav`。data-testid `nav-link`・`data-key`）。中の nav の名前は「画面の一覧」。子を持つ項目は `div.nav-parent[data-parent]`（`.is-open`）の中に、親の行 `.nav-parent-row`（親の `Link`＋`.nav-toggle`）と `.nav-sub#nav-sub-<key>`（畳めば `hidden`。子は `.nav-link.nav-child`）。開け閉めの覚え（`NAV_OPEN_KEY`。`navOpenMemory` を `useSyncExternalStore` で読み、左のメニューと引き出しで同じ）と、今の画面の親を開いて見せる（`auto`。覚えない。押して畳めば外す）はここ。子の項目もタッチできる端末では 44px
- 上の帯 `.app-header`：狭い画面だけ ロゴと今の画面の名前（`.m-head-title`・data-testid `screen-name`。一覧に無い画面は事業所の名前）。広い画面では `display: none`
- 上の帯に「探す・移動」（`cmdk-open`。`aria-haspopup="dialog"`・`aria-expanded`・`aria-keyshortcuts`）。860px 以下では出さず、下のタブの「探す」で開く（上の帯はロゴ・今の画面の名前・日付の切り替えの1段。名前は内容の幅だけ取り、日付の切り替えが入らなければ2段目へ）
- 上の帯の右端に全画面の切り替え（`components/FullscreenButton`・`fullscreen`。`IconButton`・`aria-pressed`。Fullscreen API・`fullscreenchange`。`document.fullscreenEnabled` が偽なら出さない。印刷では出さない。PRD D358）
- 帯の高さ：狭い画面では `ResizeObserver` で測って `--header-h` に出す（広い画面では styles.css の 72px）
- 下のタブ（`nav.bottom-tabs`・`aria-label="よく使う画面"`・data-testid `bottom-tab`・`data-tab`＝`key`・今の画面は `aria-current="page"`）：`bottomTabKeys` の4つ、「探す」（`button.bottom-tab`・data-testid `bottom-search`・`data-tab="search"`・`aria-haspopup="dialog"`・`aria-expanded`）、最後に「メニュー」（`button.bottom-tab.m-menu-btn`・data-testid `menu-btn`・`aria-haspopup="dialog"`・`aria-expanded`・`aria-controls` は開いているときだけ）
- 画面を移ったら引き出しとコマンドパレットを閉じる（パレットは開いたときの画面のパスを覚え、移った先で開き直していれば閉じない。`keepPaletteOn`）。`matchMedia('(max-width: 860px)')` が外れたら引き出しを閉じ、フォーカスは左のメニューの今の項目へ
- 全体の「元に戻す・やり直す」のキー（PRD D329）：殻に `components/undo` の `HistoryKeys` を1つ。window の keydown で `lib/history` の `historyKey`（Ctrl+Z＝戻す、Ctrl+Shift+Z・Ctrl+Y＝やり直す。mac は ⌘）なら、入力欄などの中（`isTextTarget`）と `[aria-modal="true"]` が開いている間は何もしない。ほかは `preventDefault` して store の `undo()`・`redo()`、トースト「元に戻しました（手の名前）」に「やり直す」（`toast-redo`）／「やり直しました（…）」に「元に戻す」（`toast-undo`）。戻せる手が無ければ「戻せる操作がありません」
- window の keydown で `isPaletteShortcut` なら `preventDefault` し、`[aria-modal="true"]` が無ければコマンドパレットを開く
- main の `Guarded` は `Suspense`（`fallback` は `PageLoading`：`.empty.page-loading`・`output`・data-testid `page-loading`・「画面を読み込んでいます…」）の中。`Outlet` の後ろに `PreloadWhenShown`（手が空いたら分けたチャンクを先に読む。`src/app/lazyPages.tsx`）
- 今の画面の項目（引き出し）は閉じるだけ、今の画面の下のタブは何もしない（`tabClick` が `stay` なら `preventDefault`）。URL のクエリ＝画面の状態を消さない

### 引き出し（`src/app/NavDrawer.tsx`）

- 左から出す。body の直下（`createPortal`）、`role="dialog"`・`aria-modal`・名前「メニュー」。開いているあいだ `#root` を `inert`
- 開いたら今の画面の項目へフォーカス。Esc・外（背景）・× で閉じる。項目を押すと閉じる
- Tab は中で回す（`components/ui.tsx` の `FOCUSABLE`）。閉じたら「メニュー」ボタンへ
- 裏のスクロールは `components/useBodyScrollLock`（`lib/scrollLock` の `createScrollLock`。数を数え、最後の解除で html と body の overflow を戻す。テストあり。`SidePanel` と共通）
- z-index 1100（`SidePanel` と同じ。地図・下のタブより前、トーストより後ろ）

### スマホの CSS（`styles.css`）

- `--bottom-tabs-h`：広い画面 0px、860px 以下で `58px + env(safe-area-inset-bottom)`、印刷で 0px
- 860px 以下：左のメニューは `display: none`、上の帯は折り返し可・日付の切り替えは右寄せ、本文の下の余白に `--bottom-tabs-h` を足す、下のタブは `position: fixed`・タブの数で等分（ふつう6列。「メニュー」の `button` はほかのタブと同じ見た目）
- 浮いている部品は `--bottom-tabs-h` の上に出す：
  - 地図（`.map-dock`）の bottom に足す。地図のボタン `.map-dock-fab` は `right: max(12px, env(safe-area-inset-right))`・`bottom: calc(12px + var(--bottom-tabs-h))`。`body:has(.map-dock-fab) .app-main` は下の余白を 56px 足す
  - 欠勤の振り直しの帯（`plan.css` の `.reassign-dock`）は `max(12px + タブ, --map-dock-top + 8px)`
  - トーストは `max(96px, タブ + 12px, 帯・地図の上)`
- `index.html` の viewport に `viewport-fit=cover`。860px 以下の上の帯・本文・下のタブ・引き出し・地図、〈スタッフ〉のスマホ画面（`.staff-shell`）の上と左右を safe-area で避ける
- 印刷：下のタブ・引き出しは出さない。`print and (max-width: 860px)` では上の帯も出さない

### 予定の切り替え（`components/ViewSwitch.tsx`）・設定のタブ（`components/SettingsTabs.tsx`）

- 月・週・日のナビの行（`ScheduleNav`）に［月｜週｜日］（リンク。今の画面を `aria-current`。[pages-common.md](pages-common.md) の「画面の見出しとボタンの3段」）。押すと選んでいる日付（`useDay`）で移る：月は `?ym=` にその日の月、週は `?d=` にその日、日はその日
- 月・週で日付を変えたら（マスを押して日の予定へ・日の見出しを押す・週・月を送る）選んでいる日付も合わせる（月を送ったときはその月の1日、今月なら今日）
- 各画面の `lead`：月「一月の担当を見て、担当なしや要対応を手で直し、確定します」、週「この週の担当を見て、日時をドラッグでずらし、〈スタッフ〉に伝えたら確定します」、日「その日の担当を見て直し、〈スタッフ〉に伝えたら確定します」
- 予定の日・週・月は同じ部品を並べる（[pages-common.md](pages-common.md) の「予定の共通の部品」「訪問の札の共通の部品」）：見出し → ナビの行（今日・‹ 期間 ▾ ›・［月｜週｜日］・状態・主ボタン）→（月）進み具合の帯／（週）1行の状態 → 操作の行 `ScheduleToolbar` → 本体 → 複数選択の帯
- 設定のタブ：訪問の種類・特性の項目・管理者設定・データの `PageHeader` の `nav` に `settingsTabs(features)` のタブ（`nav.view-switch.settings-tabs`・`aria-label="設定の切り替え"`・data-testid `settings-tabs`・各タブ `data-tab`。今の画面を `aria-current`）。狭い画面では横に巻き（`overflow-x: auto`・折り返さない）、開いたら今のタブを真ん中へ巻く

## コマンドパレット

関連 ADR：0027・0051・0055。関連 PRD：D180〜D183・D304・D337。

### `lib/commandPalette.ts`（純粋関数。テストあり）

- `PaletteItem`：`id`・`kind`（`action|screen|client|staff|visit`）・`label`・`hint`・`to`・`date?`・`visitId?`・`op?`（`'visit-add'`）・`keys`（`lib/search` の `normalizeKana` でそろえた名前・よみ・別名）。`paletteItem` で作る
- `paletteActions(today, { features })`：欠勤・キャンセルを登録・日の予定（今日）を開く・今月／来月の担当を組む（`/arrange?ym=`）・要対応を見る（`?do=attention`）・確定していない日を見る（`unconfirmed`）・訪問を1件追加（`op: 'visit-add'`）・問い合わせに答える。切った機能の操作は出さない
- `paletteScreens(sections, terms)`：sections は `screenSections`。補足はグループの見出し（見出しも語に入るので「設定」「予定」で引ける）。読み・言い換え `SCREEN_WORDS`、〈利用者さん〉一覧・〈スタッフ〉一覧には呼び方のよみ `TERM_READINGS`（既定の呼び方の漢字だけ）
- `palettePeople(clients, staff, terms)`：`/clients/:id`・`/staff/:id`。段階・休止中を補足に
- `filterPalette(items, query, limit=8)`：語に分けて AND、種類の順・先頭一致を前に、人は種類ごと limit まで（`rest`）。空なら操作と画面だけ
- 訪問：`visitIndex(visits)`（`byClient`・`byStaff`・`all`。日付・開始の順）・`paletteDate(term, today)`（「10/28」「10月28日」「2026-10-28」「今日」「明日」「あさって」。年の無い日付は去年・今年・来年のうち今日に近い方）・`paletteVisits(query, people, index, today, describe, limit=6, attention?)`
  - 語を日付・「担当なし」（担当なし・担当無し・たんとうなし・未割当）・「要対応」（要対応・ようたいおう）・名前に分ける
  - 名前の語がすべて〈利用者さん〉の名前・よみに含まれる人（20人まで）の回と、すべて〈スタッフ〉に含まれる人（20人まで）が担当の回。名前の語が無く「担当なし」「要対応」があれば全部の回から
  - 日付があればその日の回（取り消しも）、無ければ今日以降の近い回（取り消しを除く）。「担当なし」は担当の無い回、「要対応」は `attention`（無ければ担当なし）で当たる回で、日付が無ければ今日から `PALETTE_ATTENTION_DAYS`（31）日先まで
  - どの語も無ければ出さない。かなの日付の語（「あす」など）しか無ければ名前として読む。名前の表示は〈利用者さん〉の名前。種類の見出しは「訪問」で、`filterPalette` の結果の後ろに足す
- `paletteTerms`・`moveActive`（端で回る）・`isPaletteShortcut(e, isMac)`（mac は ⌘K、ほかは Ctrl+K。Shift・Alt・変換中は違う）・`isMacPlatform`・`paletteKindLabel`・`hashPathname(hash)`・`keepPaletteOn(openFor, pathname)`

### `components/CommandPalette.tsx`（`commandPalette.css`。区画の部品 `CommandPaletteParts.tsx`・閉じ込めとフォーカス `usePaletteModal.ts`・選んだあとの動き `usePalettePick.ts`・「要対応」の検査 `usePaletteCare.ts`）

- body の直下の `role="dialog"`・`aria-modal`（名前「探す・移動」）。開いたら body のほかの子を `inertLock`、`useBodyScrollLock`、入力欄へフォーカス
- window の捕捉の段で Esc・Ctrl+K（閉じる）・Tab（`trapTarget` で中で回す）を受け、右の欄・引き出しへ渡さない。入力欄の中の Ctrl+K も閉じる
- 閉じたら開く前の要素へフォーカス（つながっていなければ `cmdk-open`）。吹き出しの中から開いて閉じても body に落とさない
- 入力欄は `role="combobox"`（`aria-expanded`・`aria-controls`・`aria-autocomplete="list"`・`aria-activedescendant`）、候補は `role="listbox"` の中の `role="group"`（種類の見出し）と `role="option"`（`aria-selected`。押してもフォーカスは入力欄）。↑↓・Enter。件数は打ってから `aria-live`
- 選んでいる候補は見える位置へ（先頭なら scrollTop=0、種類の先頭なら見出しごと）
- 候補の語は `useMemo`（開いたとき・データが変わったとき）でそろえ、打つたびは `filterPalette` だけ（300人×60人で1文字 100ms 以内）
- 訪問の索引は打ってから作り、開いている間は使い回す。訪問の補足は担当・「担当なし」・取り消し。「要対応」の `attention` は日の予定と同じ検査（`dayProblemOf` → `routesOf` → `visitIssues`）を候補の日だけ計算し、日ごとに覚える（データが変わったら捨てる）
- 選ぶと閉じて、訪問（`visitId`）・「訪問を1件追加」（`op`）は画面を移らずに訪問の詳細の欄（`useOpenVisit`）を開く。ほかは `date` があれば `setDate`、今の画面なら移らない、ほかは `navigate(to)`
- z-index 1150（引き出し 1100 とトースト 1200 の間）。印刷で出さない。860px 以下は上に寄せ、下の案内（↑↓ Enter Esc）を隠す
