# 〈スタッフ〉の一覧と画面・勤務時間（シフト）・勤務の見込み・スマホ画面

> この画面のファイル：`src/pages/StaffPage.tsx`（行とカード `staffList.tsx`）・`StaffPersonPage.tsx`（見出しとタブ `staffPersonHeader.tsx`・タブ `staffSections.tsx`・`staffFields.tsx`・`staffScheduleTab.tsx`・節の編集と保存 `useStaffEdit.ts`・予定 `useStaffSchedule.ts`）・`OffboardPanel.tsx`（`offboardParts.tsx`・`useOffboardFlow.ts`）・`AvailabilityPage.tsx`（`availabilityParts.tsx`・`useAvailabilityEdit.ts`）・`WorkloadPage.tsx`（`workload.css`・`workloadHead.tsx`・`workloadTables.tsx`・`useWorkloadSettings.ts`）・`StaffViewPage.tsx`（`staffViewParts.tsx`）、`src/components/workBars.tsx`・`mapsLinks.tsx`・`personPage.tsx`・`PersonCalendar.tsx`・`personView.tsx`・`placeLookup.tsx`、`src/lib/offboard.ts`・`offboardView.ts`・`staffEdit.ts`・`workload.ts`・`workloadView.ts`・`links.ts`・`personPage.ts`・`peopleView.ts`・`visitLists.ts`・`visitOps.ts`・`viewMode.ts`。関連 ADR：0011・0014・0015・0016・0017・0018・0050・0052・0073・0083・0095。関連 PRD：D16・D68・D75〜D77・D91〜D101・D118〜D121・D201〜D209・D220・D221・D230・D241・D272・D275・D298・D299・D308〜D312・D326・D385・D394・D417・D428。
> 画面の殻（ルート・見出し・タブ・節・変更の確認）と予定のカレンダーは [pages-clients.md](pages-clients.md) と共通。

### 〈スタッフ〉一覧（`#/staff`）

- 題名「〈スタッフ〉」（「一覧」を付けない）。下に入切とも小さいタブ 一覧・勤務（勤務時間（シフト）・勤務の見込み）・相性（`PeopleTabs`。`lib/peopleTabs`）。右に主ボタン「〈スタッフ〉を追加」（`staff-add`。`#/staff/new`）。名前の前は〈スタッフ〉の印（`StaffMark` の md。[pages.md](pages.md) の「〈スタッフ〉の印」）
- 行（`staff-row`）はどこを押してもその人の画面（`#/staff/:id`。行の中のボタン・リンク・文字の選択は除く）。右端に文字のボタン「詳しく」（その人の画面。`Eye` を文字の前に。`staff-open`）と「今日の画面」（今日のスマホ画面 `staffViewHref(id, 今日)`。`Smartphone`。`staff-view-open`）。読み上げの名前は文字から始める（「詳しく（〈名前〉）」「今日の画面（〈名前〉）」。PRD D417）。`?id=` はその人の画面へ移る
- 列（`lib/peopleView` の `staffColumns(detailed)`）：名前・勤務日（`staff-days`）・勤務時間（`staff-hours`）と右端の「詳しく」「今日の画面」（状態の列が無い間は休止中だけ名前のそばに印＝`staffNameNote`）。**エキスパート機能が入のときだけ**表の上に「くわしい列」のチェック（`people-columns-toggle`。`components/DetailColumns`）。入れると 特性・求めること・自宅の緯度・経度・状態の列を足す。一覧ごとに端末に覚える（`store/navOpen` の鍵 `columns:staff`）。切は見出しの下の説明を初回だけ（`useIntro('staff')`。`peopleIntro`）
- 見出しの右に「Excel・CSV」（`roster-toggle`）。押すと名簿の欄（[pages-clients.md](pages-clients.md)「名簿の欄」。`kind="staff"`）
- 一覧の上に「最終勤務日のある〈スタッフ〉」のカード（`leaving-card`。振り直しが残っていれば件数、残っていなければ「振り直すものはありません」。最初から無かった場合と、振り直して0になった場合はデータから区別できないので同じ文にする。「担当の振り直しを開く」`leaving-open`）。名簿の読み込みで最終勤務日が入った人も出る（トーストでこの欄を指す）
- 一覧の上に「自宅の緯度・経度が未登録の〈スタッフ〉」のカード（[pages-clients.md](pages-clients.md)「住所から緯度・経度をまとめて入れる」。`usePlaceAllRun('staff')`。休止を除き、住所だけで探す）と、絞り込みのチップ「緯度・経度なし N」（`staff-filter-chip`。画面の状態）。名前のセルに、自宅の位置の無い人は「緯度・経度なし」と［住所から探す］［緯度・経度を編集］（`?edit=home` で自宅の節を開いた形で移る。PRD D427。ADR-0094）。名簿を読み込んだら、`geocode` が入なら自動で緯度・経度をまとめて探し始める
- 状態に「最終 M/D」（`staff-lastday`）
- 狭い画面（600px 以下）：表（`narrow-staff`）は1人1枚のカード（[pages.md](pages.md) の「狭い画面の表」）。1行目に名前と状態、続けて「勤務日」・「勤務時間」（くわしい列なら「特性」・「〈利用者さん〉に求めること」・「自宅の緯度・経度」）、「詳しく」「今日の画面」は右下（文字のまま）

### 〈スタッフ〉の画面（`#/staff/:staffId`。`pages/StaffPersonPage`）

- 見出しは印（md）と名前、状態（`person-state`：利用中／休止中・「最終 M/D」（`staff-lastday`）・ふだんの勤務「月火水木金 08:00〜18:00」）、右に「〈名前〉さんの画面で見る」（`to-staff-view`。`staffViewHref(id)`＝選んでいる日）と一覧へ戻る
- タブ［予定｜基本情報｜勤務時間｜相性］（相性が切なら「担当」）

#### 予定のタブ

- 左：
  - この期間の勤務の見込み（`staff-work`）：見ている期間（週は7日、月はその月）の `workDayOf` を `workTotals` で合わせ、件数（日数）・拘束（いちばん長い日）・移動・上限を超える日。案のある日だけ数える（無ければその旨）。「勤務の見込みで詳しく見る」（`to-workload`。`workloadHref(その月, その人)`。`workload` が切なら出さない）
  - 欠勤・希望休（これから60日。`staff-absences`。`staffAbsencesIn`）：日付と「希望休」／「欠勤 9:00〜12:00」とメモ。登録の場所の説明と「今日の欠勤を登録する」（`to-sudden`。`suddenHref(今日, その人)`。`sudden` が切なら出さない）
  - 最終勤務日があれば「担当の振り直しを開く」（`leaving-open`。`OffboardPanel`）
- 右：`PersonCalendar`（`kind="staff"`。担当している訪問。足す・動かすは出さない）。`dayNote` は欠勤（「希望休」／「欠勤」。メモは title）・`availabilityOf` で時間帯の無い日は「勤務なし」

#### 基本情報のタブ（節）

- 基本（`basic`）：名前（`staff-name`）・アイコン（`staff-icon`。左にその場の見本（`StaffMark` の lg。色は保存後の名前の並びの色）、空なら `placeholder` に苗字の最初の1文字。保存で前後の空白を落とし、見た目で2文字を超えれば保存しない）・メールアドレス（`staff-email`。`normalizeEmail`）・移動手段・利用中（外すと休止）。読むときは印と「アイコン「…」」／「アイコンは未設定（苗字の最初の1文字）」（`view-staff-mark`）・状態・メール・移動手段
- 自宅（`home`：`AddressField`（testId `staff-home`）。郵便番号は保存しない（「郵便番号（任意。住所を探すためだけで、保存しません）」））
- 特性（`traits`）・〈利用者さん〉に求めること（`conds`）
- 最終勤務日（`lastDay`。`offboard` が入のとき。`staff-lastday-input`・「最終勤務日を消す」・「M/D から勤務なし」）
- 新しい人（`#/staff/new`）は「基本」の節（`new`）に基本と勤務の入力をまとめて開く
- 保存の検査：同じ名前・メール・アイコン・`staffSchema`。休止にして保存するとき、その人を限った〈利用者さん〉（担当できる人）があれば確認（名前と、全員いなくなる人は「だれでも担当できるようになります」）を出し、同じ `update` で外す。最終勤務日を入れた・変えたら、振り直すものがあれば保存のあとに担当の振り直しの欄を開く

#### 勤務時間のタブ

- 新しい〈スタッフ〉（`#/staff/new` の `blankStaff(features)`）の勤務日・勤務時間の初期値は使い方で決まる：単発の予約（`patterns` が切）は毎日 7:00〜22:00、ほかは月〜金 9:00〜18:00（`lib/staffDefaultHours` の `defaultStaffHours`。名簿で勤務の列が無い新しい人も同じ。PRD D428。ADR-0095）
- ふだんの勤務（`hours`：勤務する曜日・勤務開始（`staff-shift-start`）・勤務終了（`staff-shift-end`）。読むときは `StaffHoursRow`）
- 日ごとに変えた勤務（これから。読むだけ。`overrides`）と「勤務時間（シフト）で直す」（`to-availability`）

#### 相性のタブ

- 相性・担当（読むだけ）：`StaffClientRows`（いつもの担当の〈利用者さん〉（`view-usual-clients`）と記号ごとの利用中の〈利用者さん〉（`view-compat-〈記号のキー〉`。12人を超えたら「あと N人」（`…-more`。`aria-expanded`）。名前は詳細の吹き出し）。相性が切ならいつもの担当だけ）と「相性の表で直す」（相性の画面をその人の名前で絞って開く `?sf=`）

#### エキスパート機能が切のとき（`lib/peopleView`）

- タブは［予定｜基本情報｜勤務時間］（`?tab=compat` は予定へ）
- 基本情報のタブは基本の節を出し、自宅・特性・求めること・最終勤務日（`offboard` が入のとき）と相性（担当）を「詳しく ▾」（`person-details`。閉じて始まる）に畳む。勤務時間のタブはふだんの勤務を出し、日ごとに変えた勤務を「詳しく ▾」に畳む

### 最終勤務日と担当の振り直し

- 最終勤務日を保存して振り直すものがあれば、または一覧の「最終勤務日のある〈スタッフ〉」・予定のタブの「担当の振り直しを開く」で、「担当の振り直し」の欄（`pages/OffboardPanel.tsx`・`offboard-panel`）を開く（`lib/offboard` の `offboardScope`・`applyOffboard`）
- 〈利用者さん〉ごと（`offboard-clients`・`offboard-client`）：いまの持ち方は 繰り返しの担当・担当できる人・訪問の担当（繰り返しの担当・担当できる人ではないが、数え始める日からの保存した回の担当がその人。自動の組みが一部の曜日だけその人に付けたときなど。選べないと適用で替わらず訪問が残る）。名前は `PersonButton`（`offboard-client-name`。select の option には置かない）。代わりの候補（入れる回・受け持ち。`offboard-choice`）。入れる回は、退職する人が担当できる人に入っている〈利用者さん〉だけ担当できる人の決まりを外して数える（入っていない〈利用者さん〉は決まりのまま数え、決まりの外の人は 0 回。既定の選びに出ない）。退職する人が担当できる人に入っている〈利用者さん〉で、選んだ人がまだ入っていないときは、選びの下に「〈名前〉さんを担当できる人に足します」（`offboard-adds-allowed`。判定は `lib/offboard` の `addsAllowed`で、適用と同じ決まり）。担当できる人を限っていて退職する人がその中にいない〈利用者さん〉で、決まりの外の人を選んだときは「〈名前〉さんは担当できる人に入っていないため、訪問は要対応に残ります」（`offboard-outside-allowed`。判定は `staysOutsideAllowed`。適用は担当できる人を変えない。機能「担当を限る」が切のときは決まりが効かないので出さない）。無ければ `offboard-no-clients`
- 翌日以降にその人が担当している訪問（`offboard-visits`。日ごとの件数と日の予定へのボタン）。無ければ `offboard-no-visits`
- 主ボタン「まとめて適用」（`offboard-apply`）：いつもの担当・パターンの担当・担当できる人を置き換える。訪問の案は作り直さない
- 月の予定では最終勤務日に「最終」、後の日のその人の訪問は要対応の「担当が休み」（`lib/dayPlan` の訪問ごとの検査）、〈スタッフ〉を選ぶと後の日は「最終勤務日の後」

### 勤務時間（シフト）（`#/availability`）

- 題名の下に人のタブ（`PeopleTabs`。勤務に印）。〈スタッフ〉×日の稼働時間帯。セルの時間帯の文は上書き・基本のまま。保存は `availability-save`
- 見出しの右に「勤務の見込み」（枠のボタンの `Link`・`avail-workload`・`/workload?ym=選んでいる日付の月`。`workload` が入のとき）
- 欠勤のある日のセルに「欠勤」の印（「欠勤（終日）」「欠勤 9:00〜12:00」。メモは title。`avail-absence`）
- 右の欄：同じ欠勤の文と `Link`（`availability-absence-link`。`suddenHref(日付, 人)`。`setDate` しない）。その日に働く人（`availabilityOf` の slots があり `retiredWhy` が無い＝`pickedWorks`）だけ。欠勤があれば「この日の欠勤を直す・取り消す」、無ければ「この日の欠勤を登録する」＋「（日の予定の「欠勤・キャンセル」で開く）」。休みの日・最終勤務日の後（`availability-retired`）は出さない
- 欠勤・キャンセルが切なら凡例に登録の場所を出さない
- 狭い画面：表は `EdgeScroll`（`avail-scroll`）。箱の高さを上の帯と下のタブの間に収めて中で巻き、見出しの行と名前の列を止める。右の端をぼかす。600px 以下は名前の列を 7em に詰めて折り返す

### 勤務の見込み（`#/workload?ym=&staff=`）

- 入口（メニューには出さない。人のタブは勤務に印。メニューの印は〈スタッフ〉）：勤務時間（シフト）の「勤務の見込み」・月の予定の「その他 ▾」・日の予定の拘束超えの帯・月の要対応（`workloadHref`）・パレット
- `lib/workload` の `workMonth`・`workTotals`・`workloadTsv`、画面の計算は `lib/workloadView`（`pickedDaysOf`・`workAxis`・`statTitle`・`spanNum` など）
- 見出し（`work-title`）・「表をコピー」（`work-copy`。タブ区切り）・要約（`work-summary`）。主ボタンは無し
- 事業所の設定（`org`）をこの画面で直す：交通費の単価（`work-fare`。0 で交通費の列が消える）・拘束の上限（`work-limit`。`Term` `span`＝出勤〜退勤（拘束））
- 空（`work-empty`。`periodEmptyGuide`。`onOpenDay`）
- 月の合計の表（`work-totals`。見出しの空き時間（待ち）は `Term`、出勤〜退勤（拘束）は文字だけ。日ごとの表の見出しも文字だけ）
- 〈スタッフ〉×日の表（`work-grid`）：拘束の時間と横棒 `SpanMini`（長さと上限の線）。マスの中は `button.work-cell-in.work-cell-btn`（`data-date`・title は内訳・aria-label は見えている数字（`spanNum`。上限超えは「!」）を先頭に内訳＋「（日の予定で開く）」。訪問の無いマスはボタンにしない）。上限を超える日は斜線と「!」。表の下（`work-grid-note`）「マスを押すと…。内訳は下の「日ごと」の表で見られます」
- 狭い画面：表は `EdgeScroll`（`work-grid-scroll`）。勤務時間（シフト）と同じ
- 選んだ人（`work-staff`）の日ごとの表（`work-detail`）：横棒 `SpanBar`（`WorkStat.parts`＝`spanParts`。拘束の中を訪問・移動・待ちに塗り分け、上限を超える日は太い橙の枠。行の注意の印と文字）。日付は `link-btn`（`work-day-open`・`data-date`・aria-label「M/D（曜）（日の予定で開く）」）。名前の吹き出しは付けない
- `openDay(d)`：`setDate` → `/plan`
- 上限を下げると、超える日に月の「拘束超」・要対応・日の予定の帯が出る

### 〈スタッフ〉のスマホ画面（`#/staff-view/:staffId`。見本・表示だけ）

- `AdminShell` の外（`Guarded`）。`.staff-shell` の上と左右を safe-area で避ける
- 日付は画面で共通の選んでいる日（`useDay`）。`?date=` で開くとその日を選んで URL から消す（`components/useDateEntry`。日の予定の `?date=` と共通）。名前と日付の横に［‹ 前の日］（`sv-prev`）［次の日 ›］（`sv-next`）と［今日］（`sv-today`。今日のときは出さない。押すとボタンが消えるのでフォーカスを［次の日 ›］へ移す）（`sv-day-nav`。`staffViewParts` の `StaffViewDayNav`。PRD D417）。名前と日付（`sv-date`）は `aria-live="polite"`（日送りで変わった日付を読み上げる）。見出しは今日なら「今日の訪問順」、ほかの日は「訪問順」
- その日の順番（時刻は欠勤を差し引いた `slotsOf`）。休みの訪問は担当でも出さない
- 各訪問の下に訪問先の決まりごと（`VisitRules`）。初めての訪問先（過去8週にその人が担当していない。`lib/firstVisit`）は名前のすぐ下に「初めて」の印と決まりごと（`visit-first`。PRD D415）
- 道順のリンク：地図の下に「1日の全行程を開く」（`sv-trip`・`maps-trip`。分けたときは「全行程 1/2を開く」…）、各訪問に `VisitRouteLinks`（前の場所は前の訪問先、1件目は自宅）。全行程の横に未登録の人・自宅・自転車の一言（`sv-trip-skipped`）。公共交通は全行程を出さず「訪問ごとの…を使ってください」（`sv-transit`）
- 名前の吹き出しは付けない

### 完了の条件

- [ ] 最終勤務日を入れて保存すると「担当の振り直し」の欄が開き、〈利用者さん〉ごとの代わりの候補と、翌日以降の担当の訪問（日ごと・日の予定へ）が出る。「まとめて適用」でいつもの担当・パターンの担当・担当できる人が置き換わり、案は変わらない
- [ ] 休止にすると、限った〈利用者さん〉の確認が出て外れる
- [ ] `#/workload` で月の合計・〈スタッフ〉×日の横棒・選んだ人の日ごとの横棒が出る。単価 0 で交通費の列が消え、上限を下げると斜線と「!」・月に「拘束超」・要対応・日の予定の帯。「表をコピー」でタブ区切り
- [ ] 勤務時間（シフト）の欠勤のある日のセルに「欠勤」の印。右の欄のリンクで日の予定の欠勤・キャンセルの欄（その人を選んだ状態）が開く（`scripts/e2e-links.cjs`）
- [ ] 人の画面の節（`scripts/e2e-view.cjs`）・予定のタブ（担当の回・欠勤・勤務の見込み。`scripts/e2e-person-page.cjs`）。自宅の郵便番号を保存しない（`scripts/e2e-address.cjs`）
- [ ] エキスパート機能が切なら一覧は 名前・勤務日・勤務時間の3列。画面は自宅・特性・求めること・相性・日ごとの勤務を「詳しく ▾」に閉じて始める（`scripts/e2e-simple-menu.cjs`）
- [ ] `lib/workload`・`lib/offboard` のテストが通る
