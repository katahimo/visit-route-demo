# 週の予定

> この画面のファイル：`src/pages/WeekPage.tsx`（`week.css`。区画 `weekParts.tsx`・表 `weekTables.tsx`・時間軸 `weekTimeline.tsx`、フック `useWeekNav`・`useWeekModel`・`useWeekPrep`・`useWeekClients`・`useWeekVisits`・`useWeekTodayScroll`。まとめて確定は `components/useBulkConfirm`、空き時間に入れる知らせは `components/useInsertNotice`）・`mailPanels.tsx`（`WeekMailPanel`）、`src/components/PickChips.tsx`・`staffBar.tsx`・`visitParts.tsx`（札 `VisitChip`・マスに積む `ChipStack`）、`src/lib/week.ts`・`weekOps.ts`・`weekView.ts`・`weekPrep.ts`・`weekScreen.ts`・`timelineClients.ts`・`fold.ts`・`clientFilter.ts`。関連 ADR：0012・0013・0014・0021・0024・0033・0042・0046・0053・0055〜0057・0063・0073。関連 PRD：D49〜D51・D56・D57・D62・D65・D75・D93・D108・D136〜D140・D175・D188・D221・D222・D228・D280・D282・D285・D301〜D304・D327・D332・D333・D339〜D342・D346・D347・D382・D384・D402。
> 3段のバーの塗りは [pages-bars.md](pages-bars.md)、操作の行・札の3段と入れ物（`VisitChip`・`ChipStack`）・印・選ぶ・キー・落とし先の判定は [pages-common.md](pages-common.md)、`ClientFilter` は [pages-clients.md](pages-clients.md)。
> 担当は訪問に持つ。週の帯・表の担当は訪問の担当（`weekDay` は `visitsOn` の訪問から）。

### 週の予定（`#/week`）

#### URL とクエリ

| クエリ | 意味 |
|---|---|
| `?d=YYYY-MM-DD` | その日を含む週（月曜はじまり）。無ければ選んでいる日の週 |
| `?view=`・`?by=` | 表示（`weekViewOf`） |
| `?staff=s1,s2` | 時間軸の〈スタッフ〉のチップ（無ければ全員） |
| `?client=` | 時間軸の〈利用者さん〉（無ければこの週の先頭8人。空なら0人） |
| `?cf=` | 〈利用者さん〉×曜日の表の絞り込み（`encodeFilter`。既定のままなら消す） |

URL は `replace` で書く（表示の切り替えは除く）。

#### 見出しと並び

- 見出しは題名と `lead`「この週の担当を見て、日時をドラッグでずらし、〈スタッフ〉に伝えたら確定します」だけ。すぐ下にナビの行（`ScheduleNav`）：週の前後の送り・「今日」・週を選ぶ欄（`week-title`）・［月｜週｜日］・入は右にまとめて確定（「この週の準備」）
- 操作の行（`ScheduleToolbar zoom="week"`）：入＝主「予定を入れる」（`toolbar-add-plan`）＋「担当を組む」（`toolbar-assign`。`/arrange?ym=`）、切＝主「予定を入れる」＋「欠勤・キャンセルを登録」（`sudden-open`。選んでいる日（今日より前なら今日）の日の予定で欄を開くリンク）。「その他 ▾」（`week-more`）：元に戻す・やり直す・入は欠勤・キャンセルを登録・予定をメールで送る（`week-mail`。`mail` が入のとき。右の欄 `WeekMailPanel`：最終勤務日が週の初めより前の人は出さない。宛先ごとに `MailButton`。週のメールは見通しで、送っても確定にしない）・「連絡を貼り付けて入れる」（`paste-open`。[pages-plan-absence.md](pages-plan-absence.md)）
- 「詳しく ▾」（`week-details`。閉じて始まり、開け閉めは端末に覚える＝鍵 `details:week`）：1行の状態（`week-status`。今日以降に訪問がある週だけ）「この週の今日以降：確定済み N日・まだ伝えていない N日・未連絡の変更 N日（あるときだけ）・要対応 N件」と時間軸の凡例・使い方。入は見出しの1行に「未確定 N日（まだ伝えていない日＋未連絡の変更のある日）・要対応 M件」（`weekHeading`）。進み具合の帯は出さない
- 範囲の提案の帯（`RangeProposalBand`）
- 表示の切り替え `week-views` は週のカードの1行目
- 空の画面（`week-empty`。時間軸の上に横1行の帯 `compact`。主ボタンにしない）：`periodEmptyGuide({ period: 'この週', dates, today, visitDays })`（「この週には訪問がありません」と［日の予定で訪問を足す］）
- 複数選択の帯（`SelectionBar`。時間軸の帯・表の札・「+N」の一覧の行を Shift・Ctrl＋クリック／Enter で選ぶ（スマホは長押し・「選ぶ」）。週を送ると外す）

#### エキスパート機能が切のとき

- 確定の段階を出さない：まとめて確定なし（`weekNext` の `confirmStep`）・1行の状態は「変更あり N日・要対応 N件」だけ（`weekStatusText`）。訪問の「変更あり」の印を押すとその日の日の予定で連絡の一覧が開く（`/plan?date=…&do=told`）
- 訪問の帯・マスの札は時刻・名前・担当と、担当なし・間に合わない・重なり・休みの人・「変更あり」の印だけ（`dayLooks` の `exceptionsOnly`）。説明は1行で初回だけ

#### この週の準備（入のとき）

- 主ボタン `week-next`（`data-kind`）を状態で1つ。`lib/weekPrep.ts` の `weekNext`（純粋関数。テストあり）：
  1. 今日以降に訪問が無い →「この週の今日以降に訪問はありません」（`none`。ボタンなし）
  2. 問題の無い伝えていない日がある →「この週の問題の無い日をまとめて確定（N日）」（`confirm`）
  3. 問題のある日・未連絡の変更のある日だけ残る →「未確定 N日」（`rest`。ボタンなし。下に短い理由「要対応の日／未連絡の変更の日は日の予定で確かめて確定」）
  4. 何も残っていない →「確定済み」（`done`。✓）
  - 担当を組んでいる間（`monthBatch.run` が null でない。`weekNext` の `running`）は 2 を押せず（`aria-disabled`）、理由「担当を組んでいる間は確定できません」（`week-next-why`。`useId` で `aria-describedby`）
  - 600px 以下は短い文（確定は「この週をまとめて確定（N日）」。状態の文は同じ）。印刷では出さない
- 担当を組むのは担当を組むの画面（`/arrange?d=`）。出た提案は範囲の提案の帯で反映
- 数え方：週の今日以降の日を `useDayStatuses` で数え、`bulkConfirmTargets(unconfirmed, statusOf, attentionList(…))`（月と同じ決まり）に通す
- 確定（`confirmWeek`）：組んでいる間は何もしない。確認 `bulkConfirmDialog`（月と同じ）。1回の `update`（手の名前「N日をまとめて確定」）で日ごとに `confirmDay`
- 月をまたぐ週も1度に確定する

#### 日の見出しの件数

- `week-day-count` は `weekDayCountText({ count, unassigned })`：「N件」、担当なしがあれば「N件・担当なしM」、無ければ「0件」

#### 表示の切り替え

- `lib/weekView.ts`（純粋関数。テストあり）：
  - `WeekView`＝`timeline-staff`・`timeline-client`・`table`・`clients`（`WEEK_VIEWS` の順）
  - `weekViewOf(view, by, narrow)`：view が `table`・`clients` ならその表（by は見ない）、それ以外は時間軸で、`by=client` なら〈利用者さん〉、ほかは〈スタッフ〉。narrow（600px 以下。`components/useMedia` の `COMPACT_QUERY`）で view も by も無ければ〈スタッフ〉×曜日の表
  - `weekViewParams(v, narrow)`：時間軸は `view` を消す、`timeline-client` は `by=client`、表は `by` を消す。narrow の `timeline-staff` だけは `view=timeline` を書く（押したら必ず書く。書いた URL は広い画面でも同じ表示）。`?staff=`・`?client=`・`?cf=` は触らない
  - `weekViewLabel(v, terms)`：「時間軸：〈スタッフ〉」「時間軸：〈利用者さん〉」「〈スタッフ〉×曜日」「〈利用者さん〉×曜日」
  - `isTimeline`
- 切り替え `week-views`（`fieldset.segmented`・`aria-label="表示"`。ボタンは `by-staff`・`by-client`・`tab-table`・`tab-clients`）。600px 以下は2列×2段
- `goView(v)`：今の表示なら何もしない。〈利用者さん〉×曜日の表から時間軸へは `handoffFromTable`

#### 狭い画面の既定

- 600px 以下で `?view=`・`?by=` が無ければ〈スタッフ〉×曜日の表で開く（URL に書かない）。1人1行・小さい3段バーで、名前の列を止めれば今日の列を名前と並べて見られるため
- 今日を見せる：今日を含む週なら、表示と週ごとに1回だけ、表の箱（時間軸は枠）を今日の列（`th.is-today`・`.week-day-head.is-today`）が止めた列のすぐ右に来るまで横に巻く（`lib/scrollEdge` の `scrollLeftToShow`）。開いて最初の1回だけ、今日の列の見出しが下のタブの裏・画面の下にあれば上の帯のすぐ下まで縦にも巻く（表示を切り替えたときは巻かない）。空の画面の案内が出ているときは縦には巻かない
- 600px 以下：表は名前の列（`z-index: 4`。マスの中の重なり（`.load-slot`・`.load-bar-cover` など。1〜3）より上）、時間軸は時刻の列（`.week-corner`・`.week-gutter`）を止め、今日の列の見出しの地を淡い朱に。表の箱は `EdgeScroll`（[pages.md](pages.md) の「狭い画面の表」）
- 表では長押しか凡例の行の「選ぶ」（`week-select`。`SelectToggle`）で選び、キー・ドラッグはしない。操作の行は1段（アイコン中心）

#### 時間軸

- 列＝月〜日、縦＝`DAY_START` 07:00〜`DAY_END` 20:00（1時間ごとの目盛り。`lib/spans`）
- 訪問の帯：その日の担当の並び（`dayRoutes`）の lenient の開始〜終了の位置（並びに入らない訪問は開始（早））に種類の色で（時刻・〈利用者さん〉・担当の名前）。縁は〈スタッフ〉で見るとき担当の色、〈利用者さん〉で見るとき〈利用者さん〉の色
- 全員のとき、重なる帯は列の中で横に並べる（`laneLayout`）
- 担当の無い帯は「担当なし」・赤い破線（`is-unassigned`）。凡例も「担当なし（要対応）」。印は共通の判定（`useVisitLooks`・`VisitMarks`。大の札 `data-size="l"`・`data-marks`）。担当が種類の必要条件・担当できる人に合わなければ赤い枠と「資格✗」「限✗」。今日より前の日の帯には要対応・資格✗／限✗を出さない
- 休みの訪問は薄い破線の帯で「休みのため無し」（ドラッグしない。押すと訪問の詳細の欄）
- 帯を押すと訪問の詳細の欄（`useVisitItem`。Shift／Ctrl＋クリックは選ぶ）。今日より前の訪問は見るだけ。日の見出しを押すとその日の日の予定へ
- 〈スタッフ〉で見る：`PickChips`（複数・全員・全解除。`?staff=`）。資格のチップ（項目「資格」の選択肢。押すとその資格を持つ人を選ぶ。`staffWithQualification`）と名前の資格バッジ（`QualificationBadges`。選択肢の頭文字を2字まで。`title` に正式名。`qualificationBadges`）。チップの i（`detailKind="staff"`）
- 〈利用者さん〉で見る：「時間軸の〈利用者さん〉」

#### キーボード

- 時間軸の帯（`week-band`）と「+N」の一覧の行（`week-list-visit`）は時間軸のキー（`useVisitKeys`）：↑↓ 15分・←→ 1日（週の外へ出たらその週へ `goWeek`）・Shift+←→ 隣の担当（利用中の〈スタッフ〉の順。担当なしから → は先頭）・Enter は欄・Delete で取り消し（確認）
- 表の札（`week-tvisit`・`week-citem`）は表のキー（`useVisitKeys({ layout: 'table' })`）：←→ 曜日（時刻はそのまま。週の外へ出たらその週へ）・↑↓ 隣の担当（`nextStaffFor(…, 'row')`。〈スタッフ〉×曜日は表の行の順、〈利用者さん〉×曜日は利用中の〈スタッフ〉の順。担当できない人は飛ばし、端・いなければ「これより下に担当の行はありません」などの理由）・Shift+←→ は読まない・Enter は欄・Delete で取り消し（確認。取り消したらフォーカスは「元に戻す」）
- Shift・Ctrl＋Enter は選ぶ・外す。今日より前・休み・取り消しの札は動かさない。動かしたあとフォーカスは動かした札（`focusVisitItem`。開いている「+N」の一覧の中なら一覧の行のまま）で、その札は「+N」に隠さない（`keepId`）。「+N」の一覧の端の Tab・Shift+Tab は一覧を閉じて「+N」へ。繰り返しの回は範囲の帯（[pages-common.md](pages-common.md) の「訪問の帯をキーで動かす」）。スマホではキーを読まない

#### ドラッグ

- 落とし先の判定・影の文・色は共通（`lib/visitDrop`・`useVisitDrag`・`DropShadow`。[pages-common.md](pages-common.md) の「ドラッグの落とし先」）。置けない（取り消し・休み・今日より前の訪問・今日より前の日・ほかの人の行・7:00〜20:00 の外）は灰の斜線と理由「置けません：…」で落とせず、入らない（入れる人が0人・担当できない人）は赤い点線で落とせる（落とすと要対応）
- 帯を別の日の列・時刻へ（15分刻みに丸める `SNAP_MINUTES`。範囲外は「置けません：07:00〜20:00 の中に置いてください」）。取り消し・休み・今日より前は動かさない（`canMoveVisit`）
- ドラッグの始まりは `deferredDragStart`
- ドラッグ中は担当できる人（compile の allowed。`allowedStaffOf`）の名前のチップを強調し（チップの畳みは測り直さない）、落とす先の列に「入れる人 N人」（落とす日・時刻の問題で reassign の `fitsOf` の人数。15分刻みのマスごとに memo。`fitCountAt`）
- 離すと訪問の詳細の欄が落とした日付・開始（幅は保つ）を入れた形で開き、繰り返しの回なら範囲（この回だけ（初期値）／これ以降／すべて）を選んで「保存」
  - この回だけ：`lib/visitEdit` の `savedVisit`（担当・ピンは引き継ぎ、日時を変えたら組んだ開始を外し `pattern.edited` を true）
  - これ以降・すべて：`lib/weekOps` の `moveFollowing`（元の日以降の同じ曜日の回を新しい曜日・時刻に分ける。すべては今日以降で最初の回から）。確定した日が含まれれば確認
- 保存で日時が変わり担当なしになったら知らせ（`week-notice`）「〈日〉 へ動かしました。担当なしです」と主ボタン［M/D の空き時間に入れる］（`insertIntoPlan`：その日の問題で `fitsOf` の先頭の人に `placeVisit` で入れ、ピン。他の人の開始は変わらない。入らなければ「空き時間に入りません。「担当を組む」の画面の「AI で組む」か、手で担当を選んでください」）と［その日を開く］
- キーボード：帯で Enter で欄を開き、日付・時刻を変えて保存できる。閉じるとフォーカスは帯

#### 〈スタッフ〉×曜日

- 行＝稼働中の〈スタッフ〉、列＝月〜日。行の名前は `PersonButton`
- マス（`week-cell`・`data-date`・`data-staff`）：3段バー（`WeekCell.bar`）の下に、その人のその日の訪問の札を時刻の順に積む（`ChipStack`・`week-tchips`）。そのあとに件数（小さく）。稼働時間・移動・種類ごとの件数の内訳は title と読み上げ。表の上に凡例。担当なし・休みの訪問は札にしない
- 札（`VisitChip`・`week-tvisit`・`data-visit`・`data-size="s"`・`data-marks`）：時刻と〈利用者さん〉の頭文字（「9:00 図」）と印（`VisitMarks`）。左の線は種類の色。読み上げ「9:00 〈名前〉さん・印の説明（選択中）（押すと訪問の詳細）」、title「9:00〜10:00 〈名前〉（印の説明）」
- 1マス3件まで（`CHIPS_PER_CELL`）。残りは「+N」（`chip-more`）でそのマスの一覧（`chip-list`。見出し「M/D（曜） 〈名前〉さんの訪問 N件」。行は `VisitRow`・`week-list-visit`・`hideStaff`）。一覧の動きは [pages-common.md](pages-common.md) の `ChipStack`
- 札：押す・Enter で欄（開いた札は「+N」に隠さない）、Shift・Ctrl＋クリック／Enter で選ぶ・外す（今日より前・休みは選ばない）、キーで動かす
- ほかの人・日のマスへドラッグ（札と一覧の行。広い画面だけ）：担当（行）と曜日（列）が変わり、時刻はそのまま（担当できない人のマス（`staffWhyOf`）は赤い影と理由・同じマスは何もしない）。落とすと、その日・その人を担当に選んだ欄（`VisitPanelRequest.staff`。担当できなければ「変えない」）。影は `week-tdrop`。ドラッグ中は「+N」の一覧を薄くしてマウスを受けない
- 印刷では札と「+N」（文字だけ）を出し、一覧は出さない
- 休み（稼働時間帯が無い日）はマスの地 `td.is-off` を淡く。訪問の無い終日の休みはマスの下の「休み」を `sr-only`（バーの「休み」と二重にしない）
- 行の端に週の合計（件数・稼働時間・移動）と、全員の平均との差（±N件。30%を超えると強調）。下の行に日ごとの合計

#### 〈利用者さん〉×曜日

- 表の上に `ClientFilter`（`?cf=`。既定 `WEEK_TABLE_FILTER`（chips＝period）。既定のままなら消す。`replace`）。「訪問の種類」のチップ（`visitTypes={data.visitTypes}`、`?cf=` に `type:`）。種類で絞ったまま時間軸へ移るときの `?client=` の引き継ぎも絞った人に効く（時間軸の `ClientPicker` に種類の絞り込みは無い）
- 行は `filterClients` の結果を `clientWeekTable` に（0人なら「当てはまる〈利用者さん〉がいません」）。`filterFacts(..., showEndedInPeriod: true)` で、この週に訪問がある人は終了でも出す。行の名前は `PersonButton`
- 凡例の行に札の読み方（`week-chip-legend`）「札は「時刻・担当の印」です。代＝いつもの担当でない・なし＝担当なし（要対応）・休＝休みのため無し・取消＝取り消し」
- マス（`week-ccell`・`data-date`・`data-client`）：その人のその日の訪問（取り消し・休みの回も）の札を時刻の順に積む（`ChipStack`・`week-cchips`）。時刻の位置は描かない
- 札（`VisitChip`・`week-citem`・`data-visit`・`data-size="s"`・`data-marks`）：時刻と担当の印（`StaffMark` の xs。いつもの担当でなければ「代」）・担当なしは「なし」（赤。`is-unassigned`）・休・取消・当日取消（薄く。`is-off`）と印。左の線は種類の色（種類なしは灰）。読み上げと title「9:00〜10:00 種類・担当の名前さん（いつもの担当でない）・印の説明」（`clientItemMark`）
- 1マス3件まで、残りは「+N」の一覧（担当・取り消し・休みの札も出す）
- 札：押す・Enter で欄、選ぶ、キー、ドラッグ。取り消し・休み・今日より前は動かさない・選ばない
- 同じ行の別の日のマスへドラッグすると時間軸と同じ欄（範囲を選ぶ。時刻はそのまま）。今日より前の日・ほかの人の行・取り消し・休みは落とせない（影は `week-cdrop`）
- `clientWeekTable`：取り消した訪問も入れ（`cancelled`・`sameDay`）、`substitute`（担当が定期パターンのいつもの担当、無ければ〈利用者さん〉のいつもの担当と違う）、`leave`、`unassigned`
- `clientItemMark(item, names)`：印の種類（`visit`・`leave`・`cancelled`・`sameDay`・`unassigned`）と短い文字・読み上げの文

#### 時間軸の〈利用者さん〉

- この週の人 `weekChipIds`＝`filterClients(clients, WEEK_TABLE_FILTER, facts, '')`（表の既定と同じ人・順）
- `PickChips`（`bulk={false}`・`detailKind="client"`・`actions` に「全部外す」（`?client=` を空。`clientParamOf` を通さない）「先頭8人に戻す」（`?client=` を消す））
- チップの✓と時間軸は同じ8人（URL に9人以上あっても `timelineClients`＝先頭8人）
- 8人を超えるなら選ばず、`output`（`week-client-chips-message`）に「時間軸は8人まで。表（〈利用者さん〉×曜日）なら絞り込んだ全員を見られます」。`output` はいつも描き（空なら高さ0）、出すたびにいったん空にしてから入れ直す（60ms 後）。`?client=`・週（`anchor`）・見る人（`by`）が変わったら消す
- 畳む：`PickChips` の `fold`（`rows=2`）。選んでいる人と2行ぶん、外す人がいれば最後に「あと N人」（開くと「畳む」）。開いているかは `useWeekClients` の state（週を送っても、表と行き来しても残る。URL には書かない）
- その下に畳んだ details「ほかの人を探す」の中に `ClientPicker`（`showChips={false}`。近道は〈スタッフ〉が担当する人・最近選んだ人。候補は利用中の人と、休止中でもこの週に訪問がある人）。選んだ人はチップの後ろ。印刷では出さない
- 週を送っても `?client=` が無ければ初期値はその週から作り直す
- 表から時間軸へ移るとき（`handoffFromTable`）：`?client=` が無く表で絞り込んでいれば、絞り込んだ人のうち候補（`weekClients`）にいる先頭8人を `?client=` に書く。絞り込んでいなければ書かない

#### `lib/timelineClients.ts`（純粋関数。テストあり）

- `TIMELINE_CLIENT_MAX`（8）・`defaultTimelineClients(weekIds)`
- `timelineSelection(param, weekIds, known)`：`?client=` があればそれ（候補にいる人だけ）、無ければ初期値。`isDefault` を返す
- `clientParamOf(ids, weekIds)`：初期値と同じ人（順は問わない）なら null、ほかは「,」でつなぐ。0人は ''
- `timelineChipIds(weekIds, selected)`：この週の人のあとに、選んでいてそこにいない人
- `handoffFromTable({ hasParam, filtered, filteredIds, weekIds })`

#### `components/PickChips.tsx`

- 人のチップ（複数選ぶ）。`bulk`（既定 true。「全員・全解除」）・`detailKind`（名前の i）・`actions`（「全員」「全解除」の位置に置く小さなボタン）・`fold`
- `fold`（`{ rows, open, onOpenChange }`）：全員を並べて各項目（`data-fold-item`）の上端を測り（`useLayoutEffect`）、`lib/fold` の `foldHidden(items, keep, rows, firstTop)`（テストあり。見出しの行も1行目に数える）で rows 行に入らない選んでいない人を外す。計測は `components/useChipFold.ts`（`PickChips` から呼ぶ）。測り直す鍵は `lib/fold` の `chipFoldKey`：幅・中身の高さ・書体の読み込み（`loadingdone`）・見出し・チップの表示（id・名前・色・印の有無・バッジ・選んでいるか）。幅と高さは `ResizeObserver` で見て、高さは全員を並べているときだけ採る（`nextFullHeight`。畳んだ高さで測り直すと回り続けるため）。外す人がいれば最後に「あと N人」（`aria-expanded`）
- `QualificationBadges`
- 〈利用者さん〉の担当できる人でも使う（`bulk={false}`）

#### `lib/week.ts`（純粋関数。テストあり）

- `weekDates(date)`（月曜はじまりの7日）
- `laneLayout(items)`
- `canMoveVisit`・`shiftedTimes`・`fitCountAt`・`allowedStaffOf`・`unfitMarks`
- `weekDay(data, date, problem?)`・`staffWeekTable(data, days)`（行・列・合計・平均との差・`WeekCell.bar`）・`clientWeekTable`・`clientItemMark`
- `qualificationBadges(items, staff)`・`staffWithQualification`
- データを書く操作は `lib/weekOps.ts`（テストあり）：`moveFollowing(d, visitId, date, start, today, newId)`（`splitPattern` を使う）・`insertIntoPlan(d, date, visitId)`・`insertAllIntoPlans`

#### 確かめ

- `scripts/e2e-drag.cjs`：6種類のドラッグと week-clients-ime（日本語の変換）。`?client=` なしで先頭8人が選ばれ URL に書かない・9人目で上限の文・「全部外す」「先頭8人に戻す」
- `scripts/e2e-mobile.cjs`：390px で `?view=` なしは〈スタッフ〉×曜日の表で今日の列が見える。訪問の無い週は案内が見え、縦に巻かない
- `scripts/e2e-week.cjs`：表示の切り替え（4つ・`?view=`・`?by=` の URL 9通り・押したときの URL・戻る・390px で2段まで）、表からの引き継ぎ、上限の文、戻るボタン、畳む・あと N人（1400px・390px）、週を送るとその週の先頭8人、「ほかの人を探す」
- `scripts/e2e-details.cjs`：チップの i・表の名前
- `scripts/e2e-shared-parts.cjs`：表の札の複数選択・帯の見た目・落とし先の判定、390px の長押し
- `scripts/e2e-chip-containers.cjs`：表の札（「時刻 頭文字」・3件まで・「+N」の一覧と Esc）・選ぶ・表のキー・ドラッグ・〈利用者さん〉×曜日の札・`data-marks`・390px の長押し・印刷で「+N」の一覧と選択の帯を出さない

#### 完了の条件

- [ ] 時間軸にその週の訪問が種類の色の帯で出て、〈スタッフ〉で絞れる。帯を押すと欄。別の日へドラッグすると欄がその日時で開き、「この回だけ」で保存するとその訪問だけ動く。「これ以降」で元の日以降の回が新しい曜日・時刻になる
- [ ] 担当なしで動かしたあと「M/D の空き時間に入れる」でその日の並びに入り、他の人の開始は変わらない
- [ ] 〈スタッフ〉×曜日の表に件数・稼働時間・移動・種類ごとの件数・週の合計・平均との差
- [ ] 担当できる人を限った〈利用者さん〉の訪問をドラッグすると「入れる人」はその人たちだけ
- [ ] 〈利用者さん〉×曜日の表にこの週に訪問がある人が全員出る（終了の人も）。地区・チップ・訪問の種類で減らせ、`?cf=` で開き直しても同じ
- [ ] `#/week?by=client` でこの週の人がチップで並び、先頭8人が選ばれ URL に `?client=` が無い。9人目は上限の文。「全部外す」「先頭8人に戻す」。週を送るとその週の先頭8人。「ほかの人を探す」で選んだ人がチップの後ろ。表で絞り込んで移るとその先頭8人。チップは選んでいる人と2行ぶんで「あと N人」
- [ ] 390px で `#/week` は〈スタッフ〉×曜日の表、URL に `?view=` が無く今日の列が見える。時間軸を押すと `?view=timeline` を書く
- [ ] 〈スタッフ〉×曜日のマスに札（「9:00 図」）が3件まで、4件目から「+N」（一覧・Esc で閉じフォーカスは「+N」）。札で欄・Ctrl＋クリックで選べ、→ で次の日・↓ で下の担当へ（Ctrl+Z で戻る）。動かした札は「+N」に隠れない。別の人・日のマスへドラッグするとその人を担当に選んだ欄。〈利用者さん〉×曜日も札で、選ぶ・キー・同じ行の別の日へドラッグ。390px は「選ぶ」と長押し
- [ ] `lib/week`・`lib/weekOps`・`lib/weekView`・`lib/timelineClients`・`lib/fold` のテストが通る
