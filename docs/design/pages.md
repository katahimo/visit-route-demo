# pages（画面）：共通事項と索引

> この画面のファイル：`src/app/App.tsx`（`shellBars.tsx`・`shellNav.tsx`・`useAdminShell.ts`）・`src/app/NavDrawer.tsx`・`src/components/`・`src/lib/`（画面横断の部品）。関連 ADR：0009・0019・0022〜0028・0033・0036・0037・0039・0050・0053。関連 PRD：D59・D102・D122〜D126・D132〜D135・D146〜D150・D173〜D183・D189〜D197・D201〜D204・D210〜D216・D220〜D222。
> 画面ごとの詳細は下の「画面別ファイルの索引」から。画面共通の部品（右の欄・名前から開く詳細・用語・ツアー・リンク・メール）は [pages-common.md](pages-common.md)。
> 担当は訪問に持ち（`Visit` の `staffId`・`start`・`pinned`）、AI は提案を出すだけ、確定は〈スタッフ〉に伝えた内容（`snapshots`）。AI で組むのは予定を組む（担当を組む・組み方の標準）と欠勤の振り直し・自動の組みで、予定（月・週・日）は手で直す

### 責務・持つデータ・依存

- 責務：PoC本体の管理者画面（予定・稼働時間帯・〈スタッフ〉・訪問先）を Firebase なしで動かす。加えて 月・週・担当を組む・組み方の標準・提案を比べる・空き状況・勤務の見込み・項目・条件（重みのスライダー 0〜5・必須の切り替え。ClassClassify の Setup にならう）・訪問の種類・相性の表・データ・管理者設定・〈スタッフ〉の今日の順番を見る画面（D16。表示だけ）
- 最初に開く画面：予定の画面（繰り返しを使うなら月、使わないなら週。`lib/nav` の `homePath`）。`#/home`・`#/`・知らない URL・切った機能の URL もここへ移る
- 持つデータ（持ち主）：画面の一時状態のみ。`DemoData` を書き換えるのは store だけで、画面は `update(fn)` を通す
- 提供するAPI：なし（ルートは下の表）
- 依存するもの：store・matching・solver（Worker）・evaluate・reassign・patterns・vacancy・features、Leaflet（PoC本体 `RouteMap.tsx` を写す）
- 配置：`src/pages/`、`src/components/`、画面用の純粋関数は `src/lib/`（テストあり）

### ルート一覧

ルーティングは HashRouter。`AdminShell`（メニュー・上の帯・下のタブ）の中に置くルートと、外に置くルートがある。

| ルート | ページのファイル | 役割 | 詳細 |
|---|---|---|---|
| `#/plan` | `pages/PlanPage.tsx` | 日の予定（訪問と担当を手で直す・確定（伝えた）・欠勤の振り直し）。`?date=`・`?do=absence|unassigned`・`&staff=` | [pages-plan.md](pages-plan.md)・[pages-plan-absence.md](pages-plan-absence.md) |
| `#/schedule` | （`Navigate`） | 古いリンク。`#/plan` へ移す | — |
| `#/month` | `pages/MonthPage.tsx` | 月の予定（カレンダー／日ごとの一覧・希望休・まとめて確定）。`?ym=`・`?staff=`・`?client=`・`?layout=`・`?do=` | [pages-month.md](pages-month.md) |
| `#/month/print` | `pages/MonthPrintPage.tsx` | 月の予定の印刷（A4横）。`AdminShell` の外（`Guarded`） | [pages-month.md](pages-month.md) |
| `#/week` | `pages/WeekPage.tsx` | 週の予定（時間軸・〈スタッフ〉×曜日・〈利用者さん〉×曜日・ドラッグ）。`?d=`・`?view=`・`?by=`・`?staff=`・`?client=`・`?cf=` | [pages-week.md](pages-week.md) |
| `#/compare` | `pages/ComparePage.tsx` | 提案を比べる（今の担当とその場で作った提案。保存しない）。`?date=` | [pages-rules.md](pages-rules.md) |
| `#/vacancy` | `pages/VacancyPage.tsx` | 空き状況と問い合わせの試算・仮押さえ・案内文 | [pages-vacancy.md](pages-vacancy.md) |
| `#/basics` | `pages/BasicsPage.tsx` | 基本情報の予定と相性の表（行＝繰り返し・列＝曜日。マスで時刻を直す。予定を組むの 1 の段） | [pages-basics.md](pages-basics.md) |
| `#/clients` | `pages/ClientsPage.tsx` | 〈利用者さん〉一覧。行・「開く」で人の画面へ。`?id=` は人の画面へ移る | [pages-clients.md](pages-clients.md) |
| `#/clients/:id` | `pages/ClientPage.tsx` | 〈利用者さん〉の画面（全画面）：タブ［予定｜基本情報｜担当・相性｜休み］（`?tab=`）・予定のカレンダー（`?cal=`・`?d=`）・節の「直す → 保存」（`?edit=` で節を開いて消す）。`new` は新しい人 | [pages-clients.md](pages-clients.md) |
| `#/compat` | `pages/CompatPage.tsx` | 相性の表（訪問先×〈スタッフ〉）。`?sf=`・`?cf=` | [pages-compat.md](pages-compat.md) |
| `#/staff` | `pages/StaffPage.tsx` | 〈スタッフ〉一覧・最終勤務日のある人の振り直し。`?id=` は人の画面へ移る | [pages-staff.md](pages-staff.md) |
| `#/staff/:staffId` | `pages/StaffPersonPage.tsx` | 〈スタッフ〉の画面（全画面）：タブ［予定｜基本情報｜勤務時間｜相性］・担当している訪問のカレンダー・欠勤と希望休・勤務の見込みの要約・節。`new` は新しい人 | [pages-staff.md](pages-staff.md) |
| `#/availability` | `pages/AvailabilityPage.tsx` | 勤務時間（シフト）（〈スタッフ〉×日の稼働時間帯） | [pages-staff.md](pages-staff.md) |
| `#/workload` | `pages/WorkloadPage.tsx` | 勤務の見込み（拘束・移動・待ち・交通費）。`?ym=`・`?staff=` | [pages-staff.md](pages-staff.md) |
| `#/staff-view/:staffId` | `pages/StaffViewPage.tsx` | 〈スタッフ〉のスマホ画面（今日の順番。見本）。`AdminShell` の外（`Guarded`） | [pages-staff.md](pages-staff.md) |
| `#/arrange` | `pages/ArrangePage.tsx` | 担当を組む（範囲を選んで AI で組む・提案の帯・案を比べるへ） | [pages-arrange.md](pages-arrange.md) |
| `#/standard` | `pages/StandardPage.tsx` | 組み方の標準（案の表・下書きの表・標準にする） | [pages-standard.md](pages-standard.md) |
| `#/rules` | `pages/RulesPage.tsx` | 条件の重みとプリセット・点数の基準 | [pages-rules.md](pages-rules.md) |
| `#/types` | `pages/TypesPage.tsx` | 訪問の種類 | [pages-rules.md](pages-rules.md) |
| `#/items` | `pages/ItemsPage.tsx` | 特性の項目 | [pages-rules.md](pages-rules.md) |
| `#/data` | `pages/DataPage.tsx` | データ（控え・Excel・初期状態に戻す・案内をもう一度見る） | [pages-data.md](pages-data.md) |
| `#/settings` | `pages/SettingsPage.tsx` | 管理者設定（ひな形と機能の入・切。だれでも開ける。ADR-0092） | [pages-data.md](pages-data.md) |
| `#/start` | `pages/StartGuidePage.tsx` | 登録の案内（自分のデータで始めたあとの3段。`?step=`） | [pages-common.md](pages-common.md) |
| `*`（`#/` を含む） | （`Navigate`） | 予定の画面（`homePath`。月か週）へ（replace）。`#/home` も同じ | — |

ルートの URL は変えない（古いリンクを壊さない）。メニューの並び・タブ・予定を組むの段は [pages-nav.md](pages-nav.md)。

### 画面別ファイルの索引

| ファイル | 中身 |
|---|---|
| [pages-nav.md](pages-nav.md) | メニュー・`lib/nav.ts`（基本情報のタブ・予定を組むの段）・上の帯と下のタブ・引き出し・予定の切り替え・設定のタブ・コマンドパレット |
| [pages-common.md](pages-common.md) | 画面共通の部品：右の欄 `SidePanel` と確定のボタンの帯・浮いている部品とトースト・名前から開く詳細（`PersonPopover`）・用語の説明（`Term`）・空の画面（`EmptyNext`）・初回の案内ツアー・行き先のリンク（`lib/links`）・メールと道順のリンク・画面横断の e2e |
| [pages-progress.md](pages-progress.md) | 月の予定の進み具合の帯（`ProgressBand`）・`useDayStatuses` |
| [pages-plan.md](pages-plan.md) | 日の予定：並び・状態の印と確定（伝えた）・1行のまとめ・手で直す・右の欄（詳しく）・時間軸／順番／一覧・担当ごとの1日・地図・入らなかった訪問・担当を変える ▾・訪問の欄・取り消し・点数の理由・日の予定のメール・道順のリンク |
| [pages-plan-absence.md](pages-plan-absence.md) | 日の予定の「欠勤・キャンセル」の欄（5段階）・振り直し（案A・案B）・差の欄・左下の帯・連絡の一覧・比較の画面の「欠勤前」 |
| [pages-month.md](pages-month.md) | 月：カレンダーと日ごとの一覧・日のマスと読み方の吹き出し・マスを押すと右の欄のその日の行（スマホは下から出る欄）・別の日へ・凡例・表示の選択・担当を組んでいる間・希望休・要対応・まとめて確定・月の印刷 |
| [pages-week.md](pages-week.md) | 週：表示の切り替え・時間軸・ドラッグ・〈スタッフ〉×曜日・〈利用者さん〉×曜日（マスに積む札・「+N」）・時間軸の〈利用者さん〉の初期値・週の予定のメール |
| [pages-bars.md](pages-bars.md) | 時間帯のバー（3段・30分）と一目で分かる表示：`barRows`・`staffBar`・`loadBar`・`barMarks.css`・`glance`・`dayLine`・`workBars` |
| [pages-vacancy.md](pages-vacancy.md) | 空き状況：4つの段階・表・試算・仮押さえ・案内文・紹介元へのメール |
| [pages-basics.md](pages-basics.md) | 基本情報の予定と相性の表（`#/basics`。行＝繰り返し・列＝曜日・マスで時刻を直す・相性の列・予定を組むの 1 の段） |
| [pages-clients.md](pages-clients.md) | 〈利用者さん〉：一覧と絞り込み（`ClientFilter`・`area`）・人の画面（〈スタッフ〉と共通の殻・タブ・節・予定のカレンダー `PersonCalendar`）・繰り返し・休み・決まりごと・担当できる人・段階と仮押さえ・住所の入力（`AddressField`）・住所から緯度・経度をまとめて入れる欄・`ClientPicker`・訪問の欄 |
| [pages-staff.md](pages-staff.md) | 〈スタッフ〉：一覧・人の画面（予定・基本情報・勤務時間・相性）・最終勤務日と担当の振り直し・自宅・勤務時間（シフト）・勤務の見込み・スマホ画面（見本） |
| [pages-compat.md](pages-compat.md) | 相性の画面：表・絞り込み（`StaffFilter`・相性のチップ）・吹き出し |
| [pages-rules.md](pages-rules.md) | 条件の重みとプリセット・点数の基準・特性と条件の入力・訪問の種類・特性の項目・比較の画面 |
| [pages-data.md](pages-data.md) | データの画面（控え・Excel・名簿・最終勤務日の知らせ・ファイル選択）・管理者設定 |

### 画面に共通の決まり

- 主ボタン（塗り）は1画面1つ、濃い朱1色（下の「色・フォーカス・動き・タッチ」）。ボタンは塗り＝主／枠＝副／文字＝ついでの3段（[pages-common.md](pages-common.md) の「画面の見出しとボタンの3段」）。メール・リンク・地図のボタンは主ボタンにしない
- 呼び方は `org.terms` から引き、「お客様」「シッター」を直書きしない。表記は常用漢字
- データを書くのは `update(fn)` だけ（1つの操作は1回の `update` にまとめる）
- 外部送信は地図タイルと、ボタンを押したときの郵便番号・住所の検索（`lib/geocode.ts` の1か所）と日の予定のメールの予約送信（`lib/mailSchedule.ts` の1か所）だけ。Google マップのリンク・mailto は人が押すので外部送信に当たらない
- 印刷では、メニュー・下のタブ・引き出し・トースト・浮いている帯・確認ダイアログ・ツアー・用語の説明・名前の i・進み具合の帯を出さない
- 用語の説明（`Term`）の目印は用語の後ろの小さな ⓘ（下線は付けない）。同じ画面の同じ語は最初の1か所だけ説明を付ける（[pages-common.md](pages-common.md)）
- 画面の文はふつうの言葉で：説明（`Hint`）・用語の説明・帯・空の画面の案内・確認の本文・トースト・`title`・ツアー・`lead` に内部の言葉（費用・点の内訳・稼働時間（帯）・必須の違反・点数の基準のプリセット・固定・記録）を使わない。言い換えは 固定 → ピン、必須の違反 → 守れない条件、点数の基準のプリセット「X」→「X」の重み、稼働時間 → 働ける時間。どうしても要る語は用語の説明に1か所だけ。1文を短く、括弧の中に括弧を重ねない。いくつもあることは `Hint` の中を `<ul className="hint-list">`（`styles.css`）の箇条書きにし、要点を1行ずつ。仕組み（なぜそうなるか）は用語の説明か「使い方」へ寄せ、帯・確認にはその場で要ることだけ書く。機能の名前（ボタン・メニューの項目）を変えたら e2e の文字の確かめも直す
- 確認はブラウザの `confirm`・`alert`・`prompt` を使わず、独自の確認ダイアログ（下）。src の画面に `confirm(`・`alert(`・`prompt(` は0。例外は `beforeunload`（〈スタッフ〉・〈利用者さん〉の変更があるとき）だけ
- 画面の見出しは `PageHeader`（左に題名と `lead`＝「この画面でやること」の1行、右に主ボタン1つ。予定の3画面は見出しには主ボタンを置かず、すぐ下のナビの行（`ScheduleNav`）の中に［月｜週｜日］と主ボタン）、節は `SectionTitle`（h2）
- 狭い画面の境目：860px 以下でスマホのメニュー（左のメニューを隠す・下のタブ）。600px 以下で帯・欄のボタンを詰める

### 〈スタッフ〉の印（`components/StaffMark.tsx`・`staffMark.css`・`lib/staffMark.ts`。PRD D298・D299）

- 〈スタッフ〉が名前つきで出る所は `StaffMark`（`staff` を渡す）か `StaffMarkById`（id を渡す）を名前の前に置く。自前の色の点・`UserRound` のアイコン・〈利用者さん〉の `.dot` を〈スタッフ〉に使わない
- 形：角の丸い四角（`border-radius: 28%`）。〈利用者さん〉は丸（`.dot`・週のチップの色も丸）で、形で見分ける
- 色：`staffColorMap(data.staff)`＝全員（休止中も）を名前の順（`byName`）に並べた位置の `staffColor`。地図の線・時間軸の帯の縁・列の上の線（`useDayModel` の `colorOfStaff`）も同じ関数から引く。〈スタッフ〉のデータに色の欄は無い（名前を変えると並びが変わり色も変わる）
- 文字：`staffMarkText`＝`icon`（1〜2文字）があればそれ、無ければ `surnameInitial`（名前を空白（全角も）で区切った先頭の語の最初の1文字。書記素で切る）。2文字は字を小さくする（`.is-two`）
- 大きさ：`xs` 16px（細い行・チップ・表の中・凡例・パレット）・`sm` 20px（列の見出し・表の行の見出し・比較）・`md` 28px（一覧・相性の列・吹き出しの見出し・月の見出し）・`lg` 44px（〈スタッフ〉の画面の基本の節・アイコンの入力の見本）
- 読み上げ・文字：`aria-hidden`。文字は `::before { content: attr(data-text) }` で描き、DOM の文字にしない（周りの `textContent`・コピー・e2e の文字の確かめを変えない）。e2e は `[data-staff-mark="〈ID〉"]` の `data-text` を見る
- 名前は必ず文字で出す（色だけに頼らない）。並べるときは `.with-staff-mark`（inline-flex・gap 6px・min-width 0）
- 置かない所：select の選択肢、文の中に名前を並べる所（空き状況の「N人：…」・拘束の上限の文・トースト・確認の文）、週の時間軸の帯（色の縁と文字の名前だけ）
- 印刷：`print-color-adjust: exact` で色を残す

### 狭い画面の表（`styles.css` の末尾。PRD D220〜D222）

- 境目は 600px（`components/useMedia` の `COMPACT_QUERY`＝`lib/monthList` の `MONTH_LIST_QUERY`＝CSS の `@media (max-width: 600px)`）。新しい境目は作らない。広い画面の見た目は変えない
- **一覧の表をカードに**：`table.narrow-cards` を付けた表は、600px 以下で行（`tr`）を1枚のカードにする。表の印（`table`・`tr`・`td`・data-testid）は変えず CSS で組み替える。`thead` は読み上げにだけ残す（見えない形）。列は隠さない
  - role：`table` を block、`tbody`・`tr` を flex にすると WebKit は表の role を落とすので、`table`・`thead`／`tbody`・`tr`・`td`・`th` に `table`・`rowgroup`・`row`・`cell`・`columnheader` を明示する（`lib/narrowRoles` の `narrowRole` を展開。`role="cell"` と直に書くとリントの noRedundantRoles に止められる）
  - `td::before` の見出し（data-label）は読み上げでも読まれ、見出しの行（`thead`）の列の名前と二重になる。見出しの行は表として読むために残し、`::before` の二重は許す（CSS の生成内容は aria-hidden にできない。見た目の見出しを消すと目で読めなくなる）
  - `td.narrow-title`：1行目の名前（残りの幅・太字）。`td.narrow-head`：1行目の右に置く大事な値（必須・状態・A／B）。どちらも見出しを出さない
  - ほかの `td[data-label]`：左に見出し（`::before { content: attr(data-label) }`。6rem）・右に値。`td.narrow-block` は見出しを上に置く（選択肢の一覧など広い中身）
  - `td.narrow-act`：操作（開く・消す）を右下
  - 付けた表：条件の重み（`narrow-rules`）・プリセットの重み・特性の項目・〈スタッフ〉一覧（`narrow-staff`）・〈利用者さん〉一覧（`narrow-clients`）・比較の表（`narrow-runs`）。中身は各画面のファイル
  - `.narrow-stack`：ボタンの行を縦に幅いっぱいで並べ、文字を折り返さない
- **格子の表の端**：`components/EdgeScroll`（`className` 既定 `table-scroll`・`scrollRef`）が巻く箱を外の枠 `.scroll-edge` で包み、右に続きがあるあいだ枠に `has-more-right` を付ける（`components/useScrollEdge`。巻く・幅・中身の大きさが変わるたびに測る。判定は `lib/scrollEdge` の `moreRight`（純粋関数。端の余り 2px））。600px 以下では枠の `::after` で右の端を 28px ぼかし、`has-more-right` が外れると消す（印刷では出さない）。使う所：相性・稼働時間・勤務の見込み・空き状況・週の2つの表
  - 1列目と見出しの行を止める：相性・勤務時間（シフト）と勤務の見込み（600px 以下で箱の高さを画面の中に収め、見出しの行と名前の列を止める）・空き状況（曜日の列だけ。行は7つ）・週の表（名前の列）・週の時間軸（時刻の列）
  - はじめの巻き位置は `scrollLeftToShow(box, targetLeft, stickyRight)`（純粋関数。ある列を止めた列のすぐ右に見せる。巻ける範囲に収める）：空き状況の 9:00 の列（[pages-vacancy.md](pages-vacancy.md)）・週の今日の列（[pages-week.md](pages-week.md)）

### 色・フォーカス・動き・タッチ（`styles.css` の `:root`）

色は役割で引く。背景のベージュ（`--bg`）と白いカード、暖かい色合いは変えない。比は WCAG のコントラスト比（文字は 4.5 以上、枠・アイコン・フォーカスの輪は 3 以上）。

| 変数 | 色 | 使う所 | 比 |
|---|---|---|---|
| `--primary` | `#b8503e`（濃い朱） | 主ボタンの地（白い文字）・選んだ印の枠・今の画面の印 | 白い文字 4.9 |
| `--primary-dark` | `#9c4232` | 主ボタンの影・選んだ印の文字（淡い朱の地 `--primary-soft` の上） | 白で 6.5・淡い朱で 5.5 |
| `--primary-hover` | `#a64838` | 主ボタンを重ねたときの地（`.btn-primary:hover`） | 白い文字 5.8 |
| `--accent` | `#e8735f`（明るい朱） | 飾りの帯・線だけ（確認ダイアログとツアーの上の帯、振り直しの帯の左の線）。文字・枠の印には使わない | — |
| `--focus` | `--primary-dark` | フォーカスの輪 | 白で 6.5・`--bg` で 5.8 |
| `--ink` | `#3b2f2a` | 本文 | 白で 12.9 |
| `--sub` | `#6f6058` | 補足の文字・表の見出し・メニューの見出し・パレットの種類の見出し・比較の A の札 | 白で 6.0・`--bg` で 5.4 |
| `--line` | `#eadfd6` | カードの区切り・飾りの線・ボタンの枠 | — |
| `--line-strong` | `#968478` | 入力欄・選ぶ欄の枠（`input`・`select`・`textarea`） | 白で 3.6・`--bg` で 3.2 |

状態の色は 緑＝済み・よい／黄＝注意／赤＝要対応・戻せない操作 の3つ。〈スタッフ〉の色（`lib/common` の `STAFF_COLORS`）とは別に扱う。

| 変数 | 色 | 使う所 | 比 |
|---|---|---|---|
| `--ok` | `#5aa57a` | 枠・帯・塗り（文字を載せない） | — |
| `--ok-ink` | `#37734f` | 緑の文字とアイコン（`.chip-ok`・`.ok-text`・進み具合の帯の済みなど）・白い文字の札（担当できる） | 白で 5.6・淡い緑 `#e1f1e7` で 4.8 |
| `--warn` | `#d99a2b` | 枠・帯・塗り（文字を載せない） | — |
| `--warn-ink` | `#8a5a00` | 黄の文字とアイコン（`.chip-warn`・`.warn-text`・押せない理由・注意の箱のアイコンなど） | 白で 5.9・淡い黄 `#fbefd6` で 5.2 |
| `--warn-line` | `#b07a12` | 注意の線（条件の重みの下書きの行の左の帯・確定の帯の枠、キーで動かした繰り返しの回の小さな帯 `key-move-band` の枠、組み方の標準の下書きの注意。PRD D228） | 地 `#fffaf0` で 3.6・白で 3.7 |
| `--danger` | `#b8393a` | 赤の文字・枠（`.btn-danger`・`.error`）、消す・捨てる確認の確定の塗り | 白で 5.7・`--bg` で 5.1 |

- 主ボタン（`.btn-primary`）は塗り、副（`.btn`）は枠、ついで（`.btn btn-text`）は文字だけ、戻せない操作（`.btn-danger`）は白地に赤い枠と文字で、形でも分ける
- フォーカスの輪は `outline: 3px solid var(--focus)`（`:focus-visible`。リストの候補の `is-active` も）。枠の中に描く所（`.segmented` は `overflow: hidden` で外側が切れる・帯の中のボタン）は `outline-offset: -3px`
- 書体は Mac の丸ゴシック・ヒラギノの次に Windows の BIZ UDPゴシック・游ゴシック（Regular は細いので Medium を先）・メイリオ、その後ろに Noto Sans JP・`system-ui`。本文の行の高さは 1.5
- 高さの決まった1行の帯・バー（進み具合の帯 `.progress-band`。390px で1行・高さ 50px 以内）は `line-height: 1.25` を帯に固定し、中のボタンにも継がせる（`button` は親の行の高さを継がないので `.btn { line-height: inherit }`）。本文の 1.5 や、書体が無い環境の既定の行の高さで帯が太らない。a と button のボタンの高さもそろう
- 動きを減らす設定（`prefers-reduced-motion: reduce`）では、出てくる動き・点滅・なめらかな巻き取りをやめる（CSS は動きと移り変わりを一瞬で終える。`animationend` を待つ所があるので消さない）。`scrollIntoView` の `behavior` は `lib/motion` の `scrollBehavior()`（設定があれば `auto`、ほかは `smooth`。テストあり）
- 浮かせた地図（`.map-dock`）は専用の `map-dock-in`（薄い所から少し下から出る）。トーストの `toast-in` は横の中央寄せを含むので使わない
- タッチの端末（`pointer: coarse`）では、押せる所を見た目と並びを変えずに `::before` で広げる：アイコンだけのボタン（`.icon-btn` 32px・`.icon-btn-sm` 26px・項目の選択肢のチップの中の 24px）は 44px、名前の i（`.person-info`）と〈利用者さん〉の選択の ×（`.client-picker-remove`）は 32px。隣に押せる要素が並ぶ側は間の半分だけ（アイコンのボタンは 2px、i は 1px）広げ、隣の押せる所に掛けない。担当ごとの1日の行の i は上下の行に掛けず右へ（32×24px）、チップの中の i は名前に掛からないよう縦に（25×29px）。選択肢のチップの「名前を変える」と「消す」は、タッチの端末でだけ間を 16px 広げて 44×44px ずつにする（消すの押し間違いを防ぐ）。390px で広げた所がほかの押せる要素に掛からない（上の帯・下のタブなど前に重なる部品は除く）
- 860px 以下では入力欄の文字を 16px 以上にする（iPhone で押したときに画面が拡大されない）。クラスで小さくしている欄（`ClientPicker`・`ClientFilter` の〈スタッフ〉の選択）はそれぞれの CSS で 16px

### メニュー・ナビゲーション・コマンドパレット

[pages-nav.md](pages-nav.md)：メニュー（5〜6項目と畳める子の項目）・`lib/nav.ts`（基本情報のタブ・予定を組むの段）・上の帯と下のタブ（`AdminShell`）・引き出し・スマホの CSS・予定の切り替え・設定のタブ・コマンドパレット。

### 確認ダイアログ（PRD D146〜D150）

#### `lib/confirmDialog.ts`（純粋関数。テストあり）

- `ConfirmOptions`：`title`（問い）・`body`（何が起きるか。`\n` は改行）・`confirmLabel`（動詞）・`cancelLabel`（既定 `CANCEL_LABEL`「取り消す」）・`tone`（`danger`＝赤の塗り／`primary`＝濃い朱の塗り。既定 primary。消す・捨てるは danger）
- `toRequest(id, options)`（既定を埋め前後の空白を落とす）・`enqueue`／`settle`（待っている確認の並び。出すのは先頭の1つ。無い ID の settle は同じ並びを返す）
- `trapTarget(count, index, shift)`：Tab で端から出るときだけ反対の端、ほかは null、何も無ければ -1（コマンドパレット・ツアーも使う）

#### `components/ConfirmDialog.tsx`（`confirmDialog.css`）

- `ConfirmDialog`：body の直下。`role="alertdialog"`・`aria-modal`・`aria-labelledby`（見出し）・`aria-describedby`（本文があるとき）。画面の中央
- 開いたら取り消しへフォーカス、閉じたら開く前の要素へ（消えていれば戻さない）
- body のほかの子を inert（`lib/inertLock` の要素ごとに数えるロック。`components/useBodyScrollLock` の `inertLock` を引き出し・パレット・ツアーと共通に使い、閉じる順が逆でも最後の1つが閉じるまで戻さない。テストあり）、`useBodyScrollLock`
- キーは window の捕捉の段で受け、Esc は取り消し・Tab は `trapTarget` で回し、どちらも右の欄・引き出しへ渡さない（右の欄の上の Esc は確認だけを閉じる）
- 背景を押すは取り消し（開いてから300ms のあいだと `e.detail > 1` は無視。ダブルクリックの2回目で閉じない）
- z-index 1300。480px 以下はボタンを縦に幅いっぱい（確定が上）。印刷では出さない
- `ConfirmProvider`：`main.tsx` でトーストの内側（Router の内側）に1つ。並びと答え（Promise の resolve）を持ち、外れるとき・画面（`useLocation().pathname`）が変わったときは残りを取り消しで答えて並びを空にする
- `useConfirm()`：`const ok = await confirmDialog({...})`。Provider の外では例外
- `app/ErrorBoundary`：分けた画面のチャンクを読めない例外（`isChunkLoadError`）は別の表示（data-testid `chunk-error`。「画面を読み込めませんでした」・［再読み込み］（主ボタン。`reloadPage`）・［もう一度表示する］（`retryFailedChunks`）。初期状態に戻すボタンは出さない）。ほかは、状態 `asking` で `ConfirmDialog` を直に出す（Provider・ルーターに頼らない。main.tsx の外側の ErrorBoundary でも出る）。ボタンは［控え（バックアップ）を書き出す］（主ボタン。store の `backup()` のファイルを `lib/download` の `saveBlob` で書き出す。いまのデータは `backupFileName(date)`＝データの画面と同じ名前、壊れて退避したデータは `-broken.json` の別のファイル。結果は `backupNote` の文を `output` で知らせる（保存に失敗していたら「画面で使っていた最新の状態」か「最後に保存できた状態」かと理由を区別する。トーストは Provider の外で出せない。テストあり））・［もう一度表示する］・［データを初期状態に戻す］（`.btn-danger`。確認の本文で先に控えを書き出せることを添える）

#### 呼ぶ側の決まり

- 確認を出す関数は async。確認の後に計算中なら何もしない（日の予定は `usePlanRun` の `busy()`：`usePlanEdits` の確定・受けられる人に入れる（`placeCandidate`）、`useReassignFlow` の振り直し・案A／案B を選ぶ・振り直す前に戻す（`revertToBase`）。担当を組むの `start` は `monthBatch.running()`）
- 名簿の読み込みは確認の後にデータが変わっていないかを見直す
- e2e で確認に答えるときは `scripts/lib/confirmDialog.cjs` の `answerConfirms(page)`（出た確認の見出しと本文を記録し `answer` のボタンを押す。ネイティブのダイアログは記録して失敗に、beforeunload だけ受ける）

### 機能の入り切り（画面側。PRD D210〜D216）

機能の表・ひな形・判定（`lib/features.ts` の `FEATURES`・`isOn`・`featureOfLocation`・`featureOfHref`・`TEMPLATES`・`applyTemplate`・`matchTemplate`・`templateDiff`・`turnOffImpact`）は design.md の「features」。画面での出し分け：

- `components/useFeature.ts` の `useFeature(id): boolean`（`org.features` を読むだけ。依存も見る）。欄・ボタンを出すかは部品の中で `useFeature` を見て決める
- URL は機能の表から引く：`menuSections`（下のタブもここから）・`screenSections`（上の帯の名前・パレットの画面）・`settingsTabs`（設定のタブ）、`app/App.tsx` のルート（切った機能の URL（`?do=` も）は予定の画面（`homePath`）へ移し（replace。`state.featureOff`）、知らせ（トースト）と `#/settings` へのリンク。管理者設定と土台の画面は開ける）、`lib/commandPalette.ts` の操作、`lib/attentionBand.ts` の帯の種類、`lib/tour.ts` の枚、`lib/links.ts`、画面の中の欄・ボタン（`useFeature`）。切った機能の URL を開いたときの知らせは `components/FeatureOffNotice`
- `rules` が切なら、条件の重みの画面は開けず（組み方の標準の 2 の寄り道のリンクにも出さない）、担当を組む・組み方の標準は点数の基準のプリセットの重み（`scoreRulesOf`）で作る。組み方の標準の案はプリセットごとのまま
- 切っても事実の表示（月の「休みの人に N」・すでに振り直した案の差の欄・帯・連絡の一覧）は残し、隠すのは入力・操作の入口だけ
- 切ったまま保存しても、データ（段階・担当できる人・メールアドレス・毎月のパターンの `repeat` と `monthWeeks`）は残す（毎月のパターンは読むだけと注記）。`clientStage` が切なら段階は「利用中／終了」の2つで選ばせる
- 管理者設定の画面は [pages-data.md](pages-data.md)

### 読み込みの分け方（PRD D248）

日の予定・空き状況・案を比べる・相性・月の予定は `src/app/lazyPages.tsx` の `React.lazy` で別のチャンク、地図は `RouteMap`（読み込み中の枠と `Suspense`）が本体 `LeafletMap`（Leaflet と leaflet.css）を `lazy` で読む。Excel（ExcelJS）はデータの画面で押したときの `import('../excel')`。`Suspense` は `AdminShell` の本文に1つ（画面ごとの ErrorBoundary の外。移るときは React Router の transition で前の画面のまま待つ）。分けた画面は URL（hash）で直接開いたら起動と並べてすぐ読み始め、地図を出す画面（日・比較・空き状況）は地図の本体も一緒に読み始める。開いた画面が出たら `PreloadWhenShown` が手の空いたとき（最長2秒）に残りのチャンクを1つずつ読む（1つ読み終わったら、また手が空くのを待つ）。読めないとき：`lib/chunkLoad` が失敗を見分け（`isChunkLoadError`）、`app/ErrorBoundary` は再読み込み（`lib/reloadPage`：渡された store の `flushSave` で保存を書いて 500ms 後に読み直す）と［もう一度表示する］（`retryFailedChunks` で lazy を作り直し、失敗の文の URL に `?retry=N` を付けて読み直す）を出す。地図は `RouteMap` の中の小さな境界で枠に「地図を読み込めませんでした」。`lazy` は `src/components/lazyComponent.tsx`（読み終わったあとは `React.lazy` を通さず直に描き、先読みが済んだ画面へ移るときに止まらない）。ほかの画面（週・〈利用者さん〉・〈スタッフ〉・データなど）は本体のまま

### 主な共通部品

#### `components/`

| ファイル | 主なもの | 詳細 |
|---|---|---|
| `ui.tsx` | `PageHeader`・`SectionTitle`・`Hint`・`Stat`・`IconButton`・`WithIcon`・`Empty`・`FOCUSABLE`・`SidePanel` | [pages-common.md](pages-common.md) |
| `usePanelFoot.ts`・`useBodyScrollLock.ts`・`floating.ts` | 欄の帯・ロック・浮かせた部品の位置 | [pages-common.md](pages-common.md)（ロックはこのファイル） |
| `ConfirmDialog.tsx`・`CommandPalette.tsx`・`Tour.tsx`・`Term.tsx`・`Toast.tsx` | 画面横断の重なる部品 | 確認ダイアログ・パレットはこのファイル、ほかは [pages-common.md](pages-common.md) |
| `DetailPopover.tsx`・`PersonPopover.tsx`・`personDetail.tsx` | 名前から開く詳細 | [pages-common.md](pages-common.md) |
| `personPage.tsx`・`PersonCalendar.tsx`・`personView.tsx` | 人の画面のタブ・節（`EditSection`）・予定のカレンダー・読むときの名前の並び（`PersonNames`・`StaffClientRows`・`ClientCompatRows`） | [pages-clients.md](pages-clients.md) |
| `ViewSwitch.tsx` | ［月｜週｜日］ | このファイル |
| `day.tsx` | 選んでいる日付（`DayProvider`・`useDay`。App が渡す） | このファイル |
| `useDayModel.ts`・`useDayStatuses.ts` | 日のモデル（`useDayModel`・`useCompileInput`）・日ごとの状態（計算は `lib/dayModel`・`lib/dayStatuses`） | [pages-progress.md](pages-progress.md)・[pages-plan.md](pages-plan.md) |
| `useFeature.ts`・`useMedia.ts`・`useScrollEdge.ts` | 機能の入り切り・狭い画面の判定（`COMPACT_QUERY`・`NARROW_QUERY`）・横に巻く表の端 | このファイル |
| `useRouteSelection.ts` | 地図で選んだ担当・区間・訪問（遷移は `lib/routeView` の `routeSelect`） | [pages-plan.md](pages-plan.md) |
| `valueStore.ts`・`dirtyForms.ts`・`lazyComponent.tsx` | 外の入れ物を読む `useValueStore`・編集中の印 `useDirtyMark`・別のチャンクの部品 | このファイル・[pages-data.md](pages-data.md) |
| `ScheduleNav.tsx` | 予定の上のナビの行 | [pages-common.md](pages-common.md) |
| `EdgeScroll.tsx` | 横に巻く格子の表の箱（右に続きがある印 `has-more-right`） | このファイル（狭い画面の表） |
| `progressBand.tsx` | `ProgressBand`・`BandLive` | [pages-progress.md](pages-progress.md) |
| `PastePanel.tsx`・`usePasteNotices.ts` | 連絡を貼り付けて入れる（読みは `lib/pasteNotices`・`lib/pasteRows`） | [pages-plan-absence.md](pages-plan-absence.md) |
| `scheduleParts.tsx`・`undo.tsx` | 予定の共通の部品（`ScheduleToolbar`・`RangeProposalBand`・`confirmDropProposal`・`SelectionBar`）・全体の元に戻す（`UndoIconButtons`・`UndoButtons`・`useUndoAction`・`HistoryKeys`） | [pages-common.md](pages-common.md) |
| `visitParts.tsx`・`visitKeys.tsx`・`dayList.tsx` | 訪問の札の共通の部品（印 `VisitMarks`・選ぶ `useVisitSelection`・`useVisitItem`・`SelectToggle`・中の札＝1行1訪問の行 `VisitRow`・小の札 `VisitChip`・マスに積む `ChipStack`・ドラッグの `useVisitDrag`・`DropShadow`）・帯をキーで動かす（`useVisitKeys`）・スマホの日ごとのリスト | [pages-common.md](pages-common.md) |
| `EmptyNext.tsx` | 空の画面の次の一手 | [pages-common.md](pages-common.md) |
| `FeatureOffNotice.tsx` | 切った機能の URL を開いたときの知らせ | このファイル |
| `MenuButton.tsx` | キーボードで操作できる `menu`（「その他 ▾」・「担当を変える ▾」・複数選択の「担当を替える」） | [pages-plan.md](pages-plan.md) |
| `MapDock.tsx`・`RouteMap.tsx`（読み込み中の枠。本体は別のチャンクの `LeafletMap.tsx`）・`routeView.tsx`・`routeTimeline.tsx` | 地図・担当ごとの順番・時間軸 | [pages-plan.md](pages-plan.md) |
| `dayLines.tsx`・`loadBar.tsx`・`staffBar.tsx`・`workBars.tsx`・`glance.tsx`・`barMarks.css` | 時間帯のバー | [pages-bars.md](pages-bars.md) |
| `PickChips.tsx`・`useChipFold.ts`（畳みの計測） | 人のチップ（`bulk`・`detailKind`・`fold`・`actions`）・`QualificationBadges` | [pages-week.md](pages-week.md) |
| `ClientPicker.tsx`・`ClientFilter.tsx` | 〈利用者さん〉の検索・絞り込み | [pages-clients.md](pages-clients.md) |
| `StaffFilter.tsx` | 〈スタッフ〉の列の絞り込み | [pages-compat.md](pages-compat.md) |
| `placeLookup.tsx` | `AddressField`・`ClientPlaceEditor`・`PlacePin` | [pages-clients.md](pages-clients.md) |
| `conditions.tsx` | 特性と条件の入力 | [pages-rules.md](pages-rules.md) |
| `visitType.tsx` | 種類の色の印と名前 | [pages-plan.md](pages-plan.md) |
| `VisitRules.tsx` | 訪問先の決まりごとの表示 | [pages-clients.md](pages-clients.md) |
| `mailParts.tsx`・`mapsLinks.tsx` | メール・道順のリンク | [pages-common.md](pages-common.md) |
| `FilePick.tsx` | ファイル選択 | [pages-data.md](pages-data.md) |
| `parts.tsx` | `ClientName`・`ClientDot`（〈利用者さん〉の丸）など | — |
| `StaffMark.tsx` | 〈スタッフ〉の印 `StaffMark`・`StaffMarkById` | このファイル（〈スタッフ〉の印） |

#### `lib/`（画面用の純粋関数。テストあり）

| ファイル | 役割 | 詳細 |
|---|---|---|
| `scheduleMode.ts` | 組む月（月の後半は来月）・担当なしの日の数・メニューの件数 | [pages-common.md](pages-common.md) |
| `nav.ts`・`commandPalette.ts`・`confirmDialog.ts`・`inertLock.ts`・`scrollLock.ts`・`panelFit.ts`・`personPopover.ts`・`glossary.ts`・`emptyGuide.ts`・`tour.ts`・`firstRun.ts`・`startGuide.ts`・`links.ts`・`features.ts`・`mailto.ts`・`mail.ts`・`mapsLink.ts`・`clipboard.ts` | 画面横断 | このファイル（nav・パレット・確認・ロック・features）・[pages-common.md](pages-common.md)（ほか） |
| `dayModel.ts`・`dayStatuses.ts`・`progressBand.ts` | 日のモデルの計算（`daySlotsOf`・`ownerMap`）・日の状態の覚え（`createDayStatusMemo`）・帯 | [pages-progress.md](pages-progress.md)・[pages-plan.md](pages-plan.md) |
| `absences.ts`・`sudden.ts`・`pasteNotices.ts`・`pasteRows.ts`・`contacts.ts`・`dayPlan.ts`・`confirmDay.ts`・`scoreReason.ts`・`routeView.ts`・`timeline.ts`・`visitEdit.ts`・`dragStart.ts` | 日の予定 | [pages-plan.md](pages-plan.md)・[pages-plan-absence.md](pages-plan-absence.md) |
| `month.ts`・`monthList.ts`・`monthGuide.ts`・`monthPrint.ts`・`requestedOff.ts` | 月 | [pages-month.md](pages-month.md) |
| `week.ts`・`weekOps.ts`・`weekView.ts`・`timelineClients.ts`・`fold.ts` | 週（`weekOps` は動かす・空き時間に入れる操作） | [pages-week.md](pages-week.md) |
| `barRows.ts`・`staffBar.ts`・`glance.ts`・`dayLine.ts` | 時間帯のバー | [pages-bars.md](pages-bars.md) |
| `vacancyView.ts` | 空き状況 | [pages-vacancy.md](pages-vacancy.md) |
| `clientFilter.ts`・`area.ts`・`search.ts`・`leaves.ts`・`patternText.ts`・`tentative.ts`（伝えた日。取り消しは `store/tentative`）・`clientStage.ts`・`addressLookup.ts`・`geocode.ts`・`postalCode.ts`・`placeAll.ts`・`clientTravel.ts`・`travelReasons.ts`（移動時間・遠方（出張）。ADR-0096）・`viewMode.ts`・`personPage.ts`・`personLinks.ts` | 〈利用者さん〉・人の画面・住所 | [pages-clients.md](pages-clients.md) |
| `offboard.ts`・`workload.ts` | 〈スタッフ〉 | [pages-staff.md](pages-staff.md) |
| `compatView.ts` | 相性 | [pages-compat.md](pages-compat.md) |
| `presets.ts` | プリセット | [pages-rules.md](pages-rules.md) |
| `filePick.ts` | ファイル選択 | [pages-data.md](pages-data.md) |
| `scrollEdge.ts` | 横に巻く表の端と巻き位置（フックは `components/useMedia`・`components/useScrollEdge`） | このファイル（狭い画面の表） |
| `staffMark.ts` | 〈スタッフ〉の印の色（`staffColorMap`）・文字（`staffMarkText`・`surnameInitial`）・アイコンの検査（`staffIconError`） | このファイル（〈スタッフ〉の印） |
| `isDate.ts`・`common.ts`・`colors.ts`・`motion.ts`・`download.ts` | 小さな共通（動きを減らす設定・ファイルの保存） | — |
| `dateText.ts`・`ym.ts`・`spans.ts`・`condText.ts` | 日付・年月・時刻の短い書式（`mdText`「11/4」・`dateText`「11/4（水）」・`ymText`「2026年11月」・`monthLabel`「11月」・`clockTime`「9:05」）、年月・日付の計算（`isYm`・`ymOf`・`addMonths`・`monthDates`・`calendarWeeks`・`daysBetween`）、時刻の区間（`Span`・`spansOf`・時間軸の範囲 `DAY_START`・`DAY_END`）、条件の表示文 `condText`。同じ書式・計算を画面ごとに書き直さずここから使う | — |

### pages の実装の決まり（design.md「pages」節から移した詳細）
- 予定（日・週・月）の共通の部品：`components/scheduleParts`（操作の行・複数選択の帯 `SelectionBar`。月は「別の日へ」も。書くのは `lib/multiEdit`）と `components/undo`（元に戻す・Ctrl+Z。殻に1つ）。予定は手で直す（AI で組むのは担当を組む・自動の組み・欠勤の振り直し）。本体は3画面に残す
- 自動の組み：
  - 計算は `lib/autoArrange`（データを書き換えない関数。帯の種類は日ごとの覚えから引く。範囲 `autoRange(today, from?)`＝今日〜翌月末、繰り返しを足したときは開始日（今日より後なら。PRD D416）〜その翌月末・対象 `autoTargets`＝担当なし・ピンなし・伝えていない日・今日以降の訪問のうち今の入力で増えた・日時が変わったもの／`bandTargets`＝範囲の担当なしすべてと、切なら帯の種類（間に合わない・重なり・休みの人。`lib/dayStatuses` の `bandIssueIds`＝要対応の帯と同じ日ごとの状態の覚え `dayStatusMemo`）に当たる組み直してよい訪問（`isMovable`＝担当あり・ピンなし・取り消しでない・今日以降・伝えた記録の無い日。ADR-0089）・保存のあとは切なら `autoTargets` に `issueTargets`（その保存で変わった日 `changedDays` の、帯の種類に当たる組み直してよい担当のある訪問だけ。前からの担当なしは入れない）を足す（`mergeTargets`）、ほかの担当はピン扱い・日の問題 `autoDayPlan`（要対応の訪問は今も帯の種類に当たるかを確かめて担当を外す）・書く `applyAutoArrange`（対象を書くのは、書かずに元の担当へ戻す要対応の訪問も入れて遅れの無い列になった担当だけ。変わらなくなるまで確かめ直す。組み直しても要対応が減らない訪問は元の担当・開始のまま。書いても帯の種類の数が減らない日は書かない）。解く入れ物は `lib/autoArrangeBatch`（`autoArrange`＝モジュールの入れ物。依頼 `requestAutoArrange`・`requestBandArrange` を順に待たせるキュー、1日ずつ Worker で解き、終わったら `update` 1回（名前「自動で組む」）で書く。提案は出さない）。画面とつなぐのは `components/autoArrangeHost`（`AutoArrangeHost`＝知らせ「N件の担当を組みました」と［元に戻す］（要対応の組み直しだけで書けなかったときは出さない）・データの差し替えで捨てる。`AutoArrangeBand`＝計算が長引いたときだけの進み具合の帯）
  - 走らせるのは人が入力して保存したときだけ：〈利用者さん〉の繰り返しの足す・直す（`pages/usePatternsFlow`。`writeUsual: true`）・訪問の詳細の欄の保存（`components/useVisitPanel`。`writeUsual: false`）・「定期の予定を追加」・要対応の帯の［要対応を組む］と、デモを作った直後の1回（「デモで試す」で始めた・最初の設定をやり直した（デモ）・初期状態に戻した。PRD D409。印 `all` では組まない）。ドラッグ・複数選択・日の予定の手直し・開いただけ・基本情報の変更では走らせない
  - 計算中の次の依頼は順に待たせ（書いた結果の上に組む）、計算中にその日が変わったら（`proposalDayFresh`）その日は書かず知らせに添える。`monthBatch` とは同時に解けるが、同じ日に二重には書かない
  - `usualStaffId` は繰り返しの保存から（`writeUsual`）だけ書く（担当が決まっていない繰り返しだけ。書いた回で最も多く付いた担当）。範囲（今日〜翌月末）内で今回書かなかった回（組めない・過去・伝えた日・飛ばした日）は書く前のままの保存した回として残し、範囲より後の回だけが新しい担当になる
- 例外だけ見せる（expert 切）：判定は `lib/exceptionView`（`exceptionsOnly`・`mainTools`・`detailItems`・`monthCellView`・`introShown`・`proposalWords`・`arrangeWords`）と `lib/visitLook` の `exceptionsOnly`（`lib/bandIssues` の `isBandIssue`＝帯と同じ分け方）。入も同じ部品を使う
  - 訪問の札：正常は時刻・名前・担当の1行。目立たせるのは担当なし・間に合わない・重なり・休みの人と「変更あり」だけ（読み上げは検査の言葉「時間の約束に間に合わない」「働ける時間に収まらない」「前の訪問と重なる」など）。資格✗／限✗・ピン・この回だけ変更・仮押さえの印と、条件に合わない（notAllowed）の赤は出さない（`dayLooks` の `exceptionsOnly`。日・週・月・人の予定表で共通）。日の順番の札は1行（`VisitCard` の `oneLine`）、時間軸は移動・待ち・自宅の分数の区間を出さない（`showLegs`）、担当なしの札に入れられない理由を出さない（`showUnplacedReasons`）
  - 月のマスは例外だけ（`lib/exceptionView` の `monthCellView`。PRD D410）：日付・訪問の件数・要対応の札・休 N・今日の印だけを出し、種類の積み上げ・混み具合の棒・理由の札は出さない。マスの吹き出しの代わりに見出しの ⓘ（`lib/monthGuide` の `monthCellHint`）。右の欄は日を押す前は1行の案内だけで、要対応の一覧を出さない（日ごとの一覧の行も同じ。詳細は [design/pages-month.md](design/pages-month.md)）
  - 日の予定の地図：切はページに地図のカード（`plan-map`）を置かず、「地図」のボタン（`components/MapDock` の `map-dock-fab`。`target` が null）をいつも出す。入はカードを置き、画面の外のときだけ浮かせる
- 「詳しく ▾」（`components/DetailsFold`。入切とも）：閉じて始まり、開け閉めは月・週・日と空き状況の画面ごとに端末に覚える（`store/navOpen` の `detailsOpenKey`）。空き状況＝曜日×週のマス・凡例・曜日×開始時刻の表（PRD D412）、月＝進み具合の帯・月全体の件数・凡例、週＝1行の状態・時間軸の凡例と使い方、日＝今の担当の1行（点数・理由・移動）と担当ごとの1日。入は日の要対応の訪問の帯も中に入れ、見出しの1行に数（`lib/detailsHeading`。月＝担当 a/b日・確定 c/d日、週＝未確定 N日・要対応 M件、日＝点数・移動・入らない・守れない条件）
- 操作の行（入切とも）：主ボタン1つ＋ボタン1つまで、ほかは「その他 ▾」（`components/toolbarRow`。`mainTools(zoom, avail, expert)`）。入＝月・週は「定期の予定を追加」＋「担当を組む」、日は「訪問を1件追加」＋「確定（伝えた）」。切＝「定期の予定を追加」＋「欠勤・キャンセルを登録」（スマホの日は追加を出さず主ボタンなし）。「その他 ▾」の最後に入切とも「連絡を貼り付けて入れる」（PRD D418。`components/PastePanel`・読みは `lib/pasteNotices`・`lib/pasteRows`。振り直さない。[design/pages-plan-absence.md](design/pages-plan-absence.md)）。要対応を組むのは要対応の帯の［要対応を組む］（`components/useBandArrange`。切で、今日〜翌月末の組める要対応の訪問（担当なし・間に合わない・重なり・休みの人）が1件以上のときだけ。押すと `requestBandArrange`）。詳細は [design/pages-common.md](design/pages-common.md) の「予定の共通の部品」
- 来月の確認（PRD D413。ADR-0081）：切で今日が月の20日以降なら、予定（月・週・日）の要対応の帯の下に1行（`components/nextMonthCheck`。判定と数え方は `lib/nextMonthCheck`＝要対応の帯の `visitBandKind` と同じ。来月に訪問が無ければ出さない）。［×］で閉じたら `store/navOpen` の鍵 `nextMonth:` ＋今月（例 `nextMonth:2026-11`）に覚え、その月の間は出さない（データ・書き出しに入れない）。詳細は [design/pages-nav.md](design/pages-nav.md) の「要対応の帯」
- 画面の上の説明は入切とも1行・初回だけ（`components/useIntro`。閉じたら `store/navOpen` の鍵 `intro:month`・`intro:week`・`intro:day` に覚える）。範囲の案の帯・使い方は 標準・提案・反映・ピン・プリセット の言葉を使わない（`proposalWords`）
- 「定期の予定を追加」（入切とも）：月・週の主ボタン（`toolbar-add-plan`。言葉は `planAddLabel(features)`＝繰り返しを使う（機能 `patterns` が入）なら「定期の予定を追加」、使わない（単発）なら「予約を追加」。引き出しの見出しも同じ。スマホも文字を残す）が引き出し `components/AddPlanPanel`（`add-plan`。`SidePanel`。スマホは下から出る）を開く。〈利用者さん〉（利用中の人）と、定期（機能 `patterns` が入）＝曜日・くり返し（1つの選択で 毎週／隔週／3週ごと／4週ごと／毎月（第N）。毎月は機能 `patternMonthly` が入のときだけ。`add-plan-repeat`）・第何週（毎月のとき。第1〜第5 のチップ `components/MonthWeekChips`＝〈利用者さん〉の繰り返しの欄と共通。複数・1つ以上必須。`add-plan-month-weeks`）・開始日（既定は今日・今日より前は不可。`add-plan-from`。繰り返しの `from`。PRD D416）・時刻・所要、単発（切）＝日付・時刻・所要。くり返しの選択肢と契約の値（`repeat`・`everyWeeks`・`monthWeeks`）の変換は `lib/patternForm`（`repeatChoices`・`repeatChoiceOf`・`withRepeatChoice`。テストあり）。入れ方・初めの値・誤り（欄ごと。`aria-invalid`）・知らせの文は `lib/addPlan`（`addPlanKind`・`addPlanPatternForm`・`addPlanError`・`addPlanVisitDraft`。テストあり）、状態と保存は `components/useAddPlan`。定期は `components/usePatternAdd`（`parsePatternForm` で確かめて足し、`requestAutoArrange`（`writeUsual`・`from`＝開始日から翌月末）。`usePatternsFlow` と共通）、単発は `applyVisitEdit` の新しい訪問と `requestAutoArrange`（「元に戻す」付きの知らせ）。担当は選ばず自動の組みで付く。下に「CSV でまとめて追加」（`components/PlanCsvSection`・`plan-csv`。畳んだ `details`、開くのは `plan-csv-open`。`excel` の入り切りにかかわらず出す。状態は `usePlanCsv`）：テンプレート（`plan-csv-template`）・見ている月の単発の訪問の書き出し（`plan-csv-export`。文と件数は `lib/planCsv`。0件なら押せない）・読み込み（`plan-csv-file`。`useBookingImport` で予約の CSV と同じ確認・控え。入れたら引き出しを閉じる）。PRD D423・ADR-0090。日の予定の主ボタンも同じ言葉で、開くのは訪問の欄（`VisitPanel`）
- 人の画面（判定は `lib/peopleView`：`clientColumns`・`staffColumns`＝一覧の列、`clientFolded`・`staffFolded`＝「詳しく ▾」へ畳む欄、`clientTabKeys`・`staffTabKeys`＝出さないタブ、`splitFolded`、`usualPlanText`・`addressLine`・`addressCellText`（入は住所の列に〒郵便番号を添える）・`workDaysText`・`shiftText`）
  - 一覧の列は入切とも 〈利用者さん〉＝名前・住所・いつもの予定、〈スタッフ〉＝名前・勤務日・勤務時間の3列（休止中は名前のそばの印）。入だけ表の上の「くわしい列」（`people-columns-toggle`。`components/DetailColumns` の `DetailColumnsToggle`・`useDetailColumns`）で専門の列（〈利用者さん〉＝位置・特性・求めること・いつもの担当・状態、〈スタッフ〉＝特性・求めること・自宅の緯度・経度・状態）を足す（`hasDetailColumns`・`detailColumnsShown`。一覧ごとに `store/navOpen` の `columnsOpenKey`＝`columns:clients`・`columns:staff` に覚える）。見出しはメニューの名前と同じ（「一覧」を付けない）
  - 切の詳細の画面：〈利用者さん〉＝見出しに名前・住所・予定（繰り返し）、基本情報のタブは 基本・住所を出し、段階・特性・決まりごと・担当・相性を「詳しく ▾」（`person-details`）へ。〈スタッフ〉＝名前・勤務日・勤務時間を出し、自宅・特性・求めること・最終勤務日・相性・日ごとに変えた勤務を「詳しく ▾」へ。担当・相性のタブは出さない。新しい〈利用者さん〉は段階を聞かない。入の詳細の画面は畳まない
  - 人の小さいタブ（入切とも）：〈スタッフ〉＝一覧・勤務・相性、〈利用者さん〉＝一覧・相性（`PeopleTabs`。`lib/peopleTabs`。相性でどちらから来たかは `components/peopleSide`。保存しない）。予定と相性（`#/basics`）は `BasicsNav`。相性の画面の「点のしくみ」は入だけ（`compatHintLabel`。ADR-0087）
- メニュー（[design/pages-nav.md](design/pages-nav.md)）：機能 `expert`（既定は切）が入のときだけ「組む」（組み方の標準・案を比べる・条件の重みの入口を含む）を出す。ホームは無く、予定の上の要対応の帯と「その他 ▾」が受け持つ。機能 `patterns`（既定は入）を切ると〈利用者さん〉の画面から繰り返しの欄を隠す（今ある繰り返しの回は残る）
- 予定を組む：1段ずつ進む段（`components/SettingsTabs` の `ArrangeSteps`。並びは `lib/nav` の `arrangeSteps`）。1 基本情報は予定と相性の表 `pages/BasicsPage`（計算は `lib/basicsView`）と基本情報のタブ（`BasicsNav`）。標準が無い間は 2 案をくらべる → 3 標準にする（表で直す（下書き）と登録）を組み方の標準 `pages/StandardPage` で（今の段は `lib/standardDraft` の `standardWork.step`）、最後に 担当を組む `pages/ArrangePage`。標準があれば 基本情報 → 担当を組む で、［標準の組み方を変える］で組み方の標準へ戻る。条件の重み `pages/RulesPage` は案をくらべるからの寄り道。考え方（点数の基準）を替えるのは条件の重みと標準にするの登録だけ。基本情報の鍵（`lib/arrangeBasis`）を提案の反映・標準の登録で `store/arrangeBasis`（`vrdemo:arrange:basis`。DemoData の外）に覚え、変われば担当を組むに組み直しの知らせ（`components/useArrangeBasis`）
- 最初の2問・登録の案内：保存データが無く初めて開いたとき（印 `vrdemo:features:start` = `all` が無いとき）とデータの画面の「始め方を選び直す」のあと、本文の代わりに1画面2問（`components/FirstRunPage` の `FirstRunGate`）。答えから決まる呼び名・ひな形・最初の画面・データは `lib/firstRun`。自分のデータで始めると `#/start` の3段（`lib/startGuide`・`pages/StartGuidePage`）。案内ツアーはデータの画面の「案内をもう一度見る」だけ。詳細は [design/pages-common.md](design/pages-common.md)・[design/pages-data.md](design/pages-data.md)
- スマホ・キーボード：600px 以下の日の予定は `components/dayList` の日ごとのリスト（長押し・「選ぶ」で複数選択・スワイプで日を送る）、訪問の詳細の欄は `SidePanel` の `sheet`、帯・札をキーで動かすのは `components/visitKeys`（書くのは `lib/visitKeys` → `lib/visitOps`）
- 訪問の札の共通の部品：札は3段（大＝時間軸の帯・中＝行 `VisitRow`・小＝表の札 `VisitChip`。`data-size`）、入れ物は時間軸・表（`ChipStack`）・リスト。見た目・選ぶ・キー・落とし先の判定は `lib/visitLook`・`visitSelect`・`visitDrop`・`visitKeys` と `components/visitParts.tsx`。書くのは `lib/visitOps`・`lib/multiEdit`・訪問の詳細の欄だけ
- 訪問の詳細の欄：1件の訪問を見る・直す欄は `components/VisitPanel` の1つで、App の殻に置き、どの画面・コマンドパレットからも `useOpenVisit` で開く。データには `lib/visitOps`（純粋関数）越しにだけ触る
- 読み込みの分け方：重い画面5つ（日の予定・空き状況・案を比べる・相性・月の予定）と地図を `React.lazy` で分け、画面が出たら残りを先に読む（[design/pages.md](design/pages.md) の「読み込みの分け方」）
- よく変わる値：AI の計算の進み具合（日の予定の欠勤の振り直しの案B は `pages/usePlanRun`）は画面の state に置かず、`src/lib/valueStore.ts` の入れ物に置き（読むのは `src/components/valueStore.ts` の `useValueStore`。`useSyncExternalStore`）、バーと回数の部品（`pages/planToolbar` の `PlanProgressText`・`pages/reassignParts` の `AnnealProgress`）だけが読む

### 完了の条件（共通）

- [ ] 呼び方は `org.terms` から引き、「お客様」「シッター」を直書きしない。主ボタンは濃い朱1色・1画面1〜2個
- [ ] 色は役割の変数から引き、文字は 4.5・枠とフォーカスの輪は 3 以上の比。フォーカスの輪は `--focus` の 3px。動きを減らす設定で動きが止まり、タッチの端末でアイコンのボタンの押せる所が 44px（`lib/motion` のテスト）
- [ ] 390×844 で左のメニューが出ず、上の帯に今の画面の名前（〈利用者さん〉一覧と〈スタッフ〉一覧を見分けられる）・日付の切り替えが出て横に巻かない。下のタブ（予定・〈利用者さん〉・〈スタッフ〉・組む・探す・メニュー。切は 予定・空き状況・〈利用者さん〉・〈スタッフ〉・探す・メニュー）の「探す」でパレットが開き、「メニュー」で左から見出し付きの引き出しが開き、画面を選ぶ・外を押す・Esc で閉じてフォーカスが「メニュー」に戻る。開いているあいだ裏は巻かず、Tab は中で回る。下のタブで移れ、今の画面（月・週・日・比較は「予定」）が `aria-current`。地図・欠勤の振り直しの帯・トーストがタブに重ならない。印刷に出ない。1400px の見た目（左のメニュー・上の帯 72px）は変わらない（`lib/nav` のテスト・`scripts/e2e-mobile.cjs`）
- [ ] 画面のどの確認もブラウザの確認でなく、画面の中央にアプリの見た目のダイアログで出る（見出しの問い・本文・動詞のボタン、消す・捨てるは赤）。最初のフォーカスは取り消し、Tab は中で回り、Esc・背景・取り消すでは何も変わらず、確定で進み、閉じたら押したボタンへ戻る。右の欄の上の Esc は確認だけを閉じる。390px で収まり、印刷では出ない（`scripts/e2e-dialog.cjs`）
- [ ] エキスパート機能が切のとき、メニュー（左・引き出し）は 予定・空き状況・〈利用者さん〉・〈スタッフ〉・設定 の5つ（見出し・子・件数の印なし。空き状況の画面は空き状況に印）、下のタブは 予定・空き状況・〈利用者さん〉・〈スタッフ〉（空き状況が切なら空き状況の代わりに設定）、`#/home`・`#/`・知らない URL は予定の画面へ移り、予定（月・週・日）の上に要対応の帯（担当なし・間に合わない・重なり・休みの人。無ければ出さない）。帯の［要対応を組む］で組め（知らせと元に戻す）、［見に行く ›］は重なり・休みの人を先にその訪問のある日の予定で選んで巻く（担当なしは欄を開く。日の予定でその日を見ていても動く）。エキスパート機能が入のメニューは下の項目（`scripts/e2e-simple-menu.cjs`）
- [ ] エキスパート機能が切で今日が月の20日以降なら、予定（月・週・日）の要対応の帯の下に「〈来月〉の予定 N件はできています」＋来月の担当なし・間に合わない・重なり・休みの人の数（0 は出さない）の1行と［〈来月〉を見る ›］（月の予定の来月）・［×］が出る。19日までと入では出さず、来月に訪問が無ければ出さない。［×］で消え、その月の間は読み直しても出さない（端末に覚え、データに入れない）。390px で折り返して収まる（`scripts/e2e-simple-menu.cjs` の 3c。時計を止め直す）
- [ ] エキスパート機能が切のとき、月・週の操作の行は主「定期の予定を追加」＋「欠勤・キャンセルを登録」の2つだけ（要対応を組むのは要対応の帯）。押すと引き出しが開き、定期は 曜日・くり返し（毎月なら第N）・開始日・時刻・所要、単発は 日付・時刻・所要 を入れて「追加」で、繰り返し（定期）／その日の訪問（単発）が1件増えて担当が自動で付く。〈スタッフ〉の一覧の上のタブ（一覧・勤務・相性）と〈利用者さん〉のタブ（一覧・相性）で行き来でき、メニューの印は〈スタッフ〉／〈利用者さん〉。相性・勤務の画面に禁句・点が出ない。入では変わらない
- [ ] エキスパート機能が入のとき、メニュー（左・引き出し）が 予定・空き状況・〈利用者さん〉・〈スタッフ〉・組む・設定 の6項目で、子の項目を持つのは組む（基本情報・組み方の標準・担当を組む。標準があれば基本情報と担当を組むだけ）だけ（▾ で畳める。既定は開く。開け閉めを覚え、今の画面の親へ移ると開く）。印は開いていれば子、畳んでいれば親。件数の印は組むの1つ（「変更」か「N日」）。`#/home`・`#/`・知らない URL は予定の画面へ移る。予定の上の要対応の帯に 担当なし・間に合わない・重なり・休みの人のほか 組み方の標準が無い・基本情報が変わった（組み直す）・未確定 N日 が出て、押すとそれぞれの行き先へ移る。下のタブは 予定・〈利用者さん〉・〈スタッフ〉・組む・探す・メニュー。1366×768 で巻かずに収まる。親を押すと最後に開いた表示・タブを開く。画面の見出しが上の帯・パレットの名前と同じ。Ctrl+K（上の帯の「探す・移動」、狭い画面は下のタブの「探す」）で開き、打って↑↓・Enter で画面・操作・人の画面（〈利用者さん〉・〈スタッフ〉）へ移り、Esc でフォーカスが戻る（`scripts/e2e-nav.cjs`・`scripts/e2e-home.cjs`）
- [ ] エキスパート機能が入のとき、予定の操作の行は 月・週＝「定期の予定を追加」＋「担当を組む」、日＝「訪問を1件追加」＋「確定（伝えた）」の2つと「その他 ▾」（欠勤・キャンセル・表示の切り替え・使い方・メールで送るなどはその中）。進み具合の帯・月全体の件数・凡例（月）、1行の状態・凡例（週）、今の担当の1行・担当ごとの1日・要対応の訪問の帯（日）は「詳しく ▾」に入り、閉じて始まる。見出しの1行に 月＝担当 a/b日・確定 c/d日、週＝未確定 N日・要対応 M件、日＝点数・移動・入らない・守れない条件 の数が読める。開け閉めは月・週・日の画面ごとに端末に覚え、読み直しても開いたまま（切の「詳しく ▾」も同じ）。担当なしの札の理由は「理由 N ▾」で開く。説明は入切とも1行で初回だけ
- [ ] 月・週・日の名前から詳細の吹き出しが開き、Esc・外を押す・もう一度押す・Tab で閉じてボタンへ戻る。同時に1つ、見出しが消えたら閉じる。リンクでその人の画面が開く。印刷では i を出さない（`lib/personPopover` のテスト・`scripts/e2e-details.cjs`・`scripts/e2e-details2.cjs`）
- [ ] 390×844 で条件の重み・特性の項目・〈スタッフ〉一覧・〈利用者さん〉一覧・比較が横に巻かず、行がカードになる。条件の重みのスライダーと必須が画面の中。〈利用者さん〉一覧の絞り込みが「絞り込み（N）」に畳まれる。比較の主ボタンがタブに隠れない。週は今日の列が見え、空き状況の表は 9:00 から（`lib/scrollEdge`・`lib/weekView`・`lib/clientFilter` のテスト・`scripts/e2e-mobile.cjs`）
- [ ] 右の欄の確定のボタンの帯：短い欄は帯が内容のすぐ下・区切りなし、長い欄は欄の下に貼り付き、内容が隠れている間だけ区切り。390px の並び・タブに隠れない・キーボード（`lib/panelFit` のテスト・`scripts/e2e-panel-foot.cjs`）
- [ ] 用語の説明・空の画面・ツアー（`lib/glossary`・`lib/emptyGuide`・`lib/tour` のテスト・`scripts/e2e-words.cjs`・`scripts/e2e-tour.cjs`）
- [ ] 行き先のリンク（`lib/links` のテスト・`scripts/e2e-links.cjs`）・機能の入り切り（`scripts/e2e-features.cjs`）
