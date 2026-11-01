# 月の予定と月の印刷

> この画面のファイル：`src/pages/MonthPage.tsx`（`month.css`。組み立てだけ。状態と処理は `useMonthNav`・`useMonthFocus`・`useMonthDays`・`useMonthFocusDays`・`useMonthOff`・`useMonthAside`・`useMonthBatch`・`useMonthMenu`（`useMonthPanels`・`monthMore`）・`useMonthDayList`・`useMonthVisitRows`・`useMonthListRows`、見た目は `monthSections.tsx`（区画）・`monthParts.tsx`（見出しの欄・凡例）・`monthGrid.tsx`（カレンダーの表・日ごとの一覧）・`monthCell.tsx`（`DayCell`）・`monthCellTip.tsx`（`MonthCellTip`）・`monthAside.tsx`（右の欄・下から出る欄）、計算は `src/lib/monthCell.ts`（`dayCellText`）・`monthView.ts`（表示の選択・日ごとの集計・一覧の行））・`MonthPrintPage.tsx`（`monthPrint.css`）、`src/lib/month.ts`・`monthList.ts`・`monthGuide.ts`・`monthPrint.ts`・`monthRest.ts`・`requestedOff.ts`・`dayStatuses.ts`・`confirmDay.ts`・`settledView.ts`・`attentionBand.ts`、`src/components/useDayStatuses.ts`・`useBulkConfirm.ts`（週と共通）・`visitParts.tsx`（マスの選ぶ・その日の回の一覧の行・ドラッグ）・`scheduleParts.tsx`（選択の帯の「別の日へ」）。関連 ADR：0012〜0015・0031・0032・0042・0051〜0053・0056・0057・0063・0073・0074・0079。関連 PRD：D36〜D44・D53〜D55・D65・D69・D70・D151〜D154・D176・D189〜D192・D201〜D204・D223・D228・D256・D257・D278・D295・D313・D321・D332・D334・D339〜D343・D347・D382・D384・D393・D400〜D404・D410。
> 3段のバー・混み具合の塗りは [pages-bars.md](pages-bars.md)、進み具合の帯は [pages-progress.md](pages-progress.md)、操作の行・訪問の札・選ぶ・キー・`VisitRow`・落とし先の判定は [pages-common.md](pages-common.md)。
> 担当は訪問に持ち、日の状態は「まだ伝えていない／確定済み／未連絡の変更あり」、要対応は訪問ごとの検査。

### 月の予定（`#/month`）

#### URL とクエリ

| クエリ | 意味 |
|---|---|
| `?ym=2026-11` | 月。無ければ選んでいる日の月 |
| `?staff=`・`?client=` | 表示の選択（1人）。URL に残す |
| `?layout=calendar|list` | 見せ方。押したら必ず書く。無ければ狭い画面（`(max-width: 600px)`）は一覧、ほかはカレンダー |
| `?do=attention|unconfirmed|batch` | 1回だけ行い URL から消す（replace）。「`?do=`」 |

#### 並び

1. 見出し：`lead`「一月の担当を見て、担当なしや要対応を手で直し、確定します」。すぐ下にナビの行（`ScheduleNav`）：「今日」・‹ 月を選ぶ欄（`month-title`）›・［月｜週｜日］。下に要対応の帯 `AttentionBand`
2. 操作の行（`ScheduleToolbar zoom="month"`）：入＝主「予定を入れる」（`toolbar-add-plan`）＋「担当を組む」（`toolbar-assign`。`/arrange?ym=`）、切＝主「予定を入れる」＋「欠勤・キャンセルを登録」（`sudden-open`。選んでいる日（今日より前なら今日）の日の予定で欄を開くリンク）。「その他 ▾」（`month-more`）：見せ方（`month-layout-calendar`・`month-layout-list`）・元に戻す／やり直す・入は欠勤・キャンセルを登録・「表示を選ぶ」・「印刷」・「勤務の見込み」・「マスの見方の説明」（空き状況はメニュー。ADR-0078）
3. 範囲の提案の帯（`RangeProposalBand`）
4. 操作の欄 `month-head`：
   - 「その他 ▾」の項目：「表示を選ぶ（〈スタッフ〉・〈利用者さん〉・混み具合）」（`month-more-pickers`。開いていれば「表示の選択をたたむ」、選んでいる間・休みの入力中は押せず理由「表示を「全体」・混み具合を「すべて」に戻すと、たためます」）・「印刷」（`month-print`。選んでいる〈スタッフ〉があれば `&staff=`。`monthPrint` が入のとき）・「勤務の見込み」（`month-workload`。`/workload?ym=`。`workload` が入のとき）・「マスの見方の説明」（`month-more-help`。開いていれば「…を閉じる」）。印刷・勤務の見込みには1行の説明
   - 「詳しく ▾」（`DetailsFold`・`month-details`。閉じて始まり、開け閉めは端末に覚える＝鍵 `details:month`。入は見出しの1行に「担当 a/b日・確定 c/d日」＝`lib/detailsHeading` の `monthHeading`）：進み具合の帯 `ProgressBand`（次の一手は主ボタンにせず、`onOp` で要対応・確定していない日は右の欄を開き、「担当を AI で組む」は `/arrange?ym=` へ）・要約 `month-summary`（「月全体：入らない N件（・当日キャンセル N件）」。今日より前の日も数える）・凡例 `month-legend`
   - 表示の選択の段 `month-pickers`（「表示を選ぶ」で開くか、選んでいる間・休みの入力中に出す。開いたら `month-focus` へフォーカス。段の中で選び直したら出したまま。保存しない）：
     - 表示の選択 `month-focus`（「表示」：全体／〈スタッフ〉（optgroup）／〈利用者さん〉（名前・よみで探す））。〈利用者さん〉なら `ClientPicker`（1人。`month-client-picker`。近道：この月・〈スタッフ〉が担当する人・最近選んだ人・仮押さえの人（`tentativeShortcut`））
     - 〈スタッフ〉を選んでいれば「休みを入れる」（`month-off-toggle`）
     - 全体なら「混み具合：」と `Term`（`loadCount`）と選ぶ欄 `month-load-type`（数える人：すべて／〈種類〉。名前は aria-labelledby）
   - 訪問の無い月は「定期パターンが無いか、この月の訪問がありません」
   - マスの見方の説明 `month-help`（開くとフォーカスを移す。文は `lib/monthGuide` の `monthHelpLines(staffTerm, only)`。マスの押し方・右の欄の行の押し方と「別の日へ」・赤い枠と「要対応 N」の札。入はさらにマスの色と印（凡例）・「未連絡 N」・混み具合のバーと端の印、切は印の意味を見出しの ⓘ（`monthCellHint`）へ案内する。「説明を閉じる」）
5. 本体：カレンダー（`month-grid`）か日ごとの一覧（`month-list`）
6. 右の欄 `month-aside`：その日の回の一覧（先頭）・要対応・確定していない日、選んだ人の集計
7. 選択の帯 `SelectionBar`（`moveDay`。画面の下）と、キーで動かした先の読み上げ・範囲の帯 `KeyMoveBand`

#### 日の計算（`useDayStatuses`）

- 日ごとの compile と採点は点数の基準の条件で行い、日付・`compileInput`・その日の訪問で覚える（8人・約17件／日の一月で 500ms 以内）
- `DayStatus`（`lib/month` の `dayStatus`）＝`{ date, count, state, unassigned, issues, care, changes, absence, overSpan, needsCare }`。`issues` は `visitIssues`（訪問 ID → 要対応）、`told` は伝えた内容との違い（`toldChanges`。訪問ごとの未連絡の変更の印の元。伝えていない日は null）、`state` は `toldStateOf`、`changes` は未連絡の変更の件数、`overSpan` は拘束が上限を超える人
- 数える割当はその日の訪問の担当（`dayPlanOf`＝`dayRoutes`）

#### カレンダー（日のマス `DayCell`）

- 日曜はじまりの6週×7日（`calendarWeeks`）。今日より前の日は薄く。今日は「今日」の印
- マスはボタン（`month-cell-btn`・`month-day`・`data-date`）
- 状態は背景・枠と印で（点数は出さない）：

| 状態 | 見た目 |
|---|---|
| まだ伝えていない（`is-state-none`） | 白 |
| 確定済み（`is-state-told`） | 濃い緑＋鍵（`month-lock`） |
| 未連絡の変更あり（`is-state-changed`） | 淡い黄＋鉛筆 |
| 要対応（`needsCare`、今日以降。`is-care`） | 赤い太枠＋日付の横の赤い札「要対応 N」（`month-attn`。N は右の欄の行の数） |

- `aria-label` に状態の文字を入れる。`title` は付けず、入は `data-tip="cell"` で読み方の吹き出し（切は吹き出しを出さない。下の「エキスパート機能が切のとき」）
- 中身（全体の表示。エキスパート機能が入のとき。切は下の「エキスパート機能が切のとき」）：
  - 件数（取り消し・休みを除く。`month-count`）
  - 種類ごとの件数の積み上げバー（種類の色。`title` に内訳）
  - 印 `month-marks`（`lib/month` の `dayMarks`）：「休 N」（勤務の無い人＋希望休の人。同じ月の同じ曜日の最頻値より多い日だけ出し、希望休のある日は常に出す。`lib/monthRest` の `usualRestByWeekday`・`showRestMark`。読み上げ・吹き出しには人数を残す。希望休がいれば紫。title「休む〈スタッフ〉 N人（内訳）」）・「欠 名前」（希望休でない欠勤だけ。`month-absent`。欠勤の人に担当の訪問が残れば要対応に出る）・その日に始まる（▶）・終わる（■）定期パターンのある〈利用者さん〉・〈利用者さん〉の休み（ベッドのアイコンと、1人なら名前の頭・2人以上なら人数。`dayMarks.leaves`）・「最終 名前」（title「最終勤務日（翌日から勤務なし）：…」）
  - 旗 `month-flags`：「担当なし N」（赤。`month-unassigned`）・ほかの要対応の内訳（担当が休み N・条件に合わない N・間に合わない N。`month-issue`）・「未連絡 N」（黄。`month-changed`。切は「変更あり N」。`changedFlagText`）・「拘束超 N」（`month-over-span`）
  - 混み具合バー `month-load`（`LoadBar`）
- 始まる・終わるの印：始まるは基準日（`baseDate`＝データの最初の日）より後に始まり、前日にその〈利用者さん〉のどのパターンの期間でもないもの。終わるは翌日にどのパターンの期間でもないもの（継ぎ目を印にしない）

#### マスを押す・キー・その日の回の一覧・まとめて選ぶ・別の日へ

- マスは「その日のまとめ」（訪問の札は描かない）。訪問を描くのは右の欄（スマホは下から出る欄）に出した1日だけ
- 押す（`pickDay`。マスと日ごとの一覧の行で同じ）：1回目はその日を右の欄の先頭に出す（フォーカスはマスのまま。`is-listed`）。出している日をもう一度押すと `openDay`（日の予定）。吹き出しの文の後ろは「（押すとこの日の訪問を右の欄に出します。もう一度押すと「日の予定」）」、出している日は「（もう一度押すとこの日の「日の予定」を開きます）」。「休みを入れる」の間は `toggleOff`
- キー（`cellKeyOf`。`lib/visitKeys`）：←→ 前・次の日、↑↓ 前・次の週（月の外へ出たら `goMonth` してフォーカスを移す）、Enter でその日の回の一覧（`openList`。最初の行へ、無ければ見出しへフォーカス）、Shift／Ctrl＋Enter・Shift／Ctrl＋クリックでその日の選べる訪問をまとめて選ぶ・外す（`toggleGroup`）。`aria-keyshortcuts`。「休みを入れる」の間の Enter は `toggleOff`
- 選ぶのは `useVisitSelection(ym)`（月を送ったら外す）。`canSelectVisit`（今日より前・取り消し・休みは選ばない）。表示の選択が人ならその人の回だけ（`dayItems`）。選んだ日のマスに「選択 N」（`month-selected`・`data-selected`・`aria-label` に「選択中 N件」）。選んだ訪問は画面の下の `SelectionBar`（担当を替える・時刻をずらす・別の日へ・取り消す・選択を外す。`dates` は月のマスの日）
- その日の回の一覧（`DayVisits`・`section.month-day-visits`・`month-day-visits`・`data-date`）：見出し「M月D日（曜）の訪問 N件」・閉じる（`month-day-visits-close`。Esc でも閉じ、フォーカスはマスへ。選んでいれば Esc は先に選択を外す）・行（`VisitRow`＝中の札。`month-visit`・`data-size="m"`。開始の順）・説明「行を押すと訪問の詳細。Shift・Ctrl＋クリックで選び、↑↓ で15分・←→ で1日動かせます。行を別の日のマスへドラッグするか、選んで下の「別の日へ」で日付を移せます（時刻はそのまま）」・「この日の日の予定を開く」（`month-day-visits-plan`）。Enter で開いたとき〈利用者さん〉を選んでいてその日の回が1つなら、その回の訪問の詳細の欄（閉じたらフォーカスはマス）。訪問が無い日は「この日の訪問はありません。」。月を送ると閉じる
- 一覧の行：押す・Enter で訪問の詳細の欄、Shift・Ctrl＋クリック／Enter で選ぶ・外す、キーで動かす（↑↓ 15分・←→ 1日・Shift+←→ 隣の担当・Delete 取り消し。月の外へ動いたらその月へ移って一覧もその日にし、フォーカスは動かした行）。印は `useVisitLooks`（`data-marks`）
- ドラッグ（広い画面）：一覧の行を別の日のマスへ（日付だけ）。`useVisitDrag`・`dropVerdict`（今日より前・取り消し・休みは灰の斜線と理由、入れる人が0人は赤い点線）。影はマスの中（`month-drop`・`is-drop-ok|warn|ng`）。落とすとその日を入れた訪問の詳細の欄。マスの訪問はつかめない
- 別の日へ（`SelectionBar` の `moveDay`。広い画面だけ）：［別の日へ］（`selection-move`・`aria-expanded`）で日付の欄（`selection-move-date`。`input type="date"`・既定と最小は今日。Esc で閉じフォーカスは［別の日へ］）と［移す］（`selection-move-go`。日付が無い・今日より前なら押せない）。`lib/multiEdit` の `moveManyToDate` の結果で、確定した日（移す前・先。`toldDaysChanged`）が変わるなら確認「確定した日の訪問も変えますか？」（本文に日付）。1回の update（手の名前「M/D（曜）へ移しました」）、知らせ「N件のM/D（曜）へ移しました」（できなかった訪問は理由）。移したら選択を外す
- スマホ（600px 以下。`MONTH_LIST_QUERY`）：マス・一覧の行を押す・Enter で下から出る欄（`SidePanel` の `sheet`。見出し「M月D日（曜）の訪問 N件」・`month-day-sheet`（`data-date`））。中は「選ぶ」（`month-select`。`SelectToggle`）と「長押しでも選べます」・行（`VisitRow`・`month-visit`。押すと欄を閉じて訪問の詳細の欄・選ぶ形の間は選ぶ・外す。キー・ドラッグは無い）・欄の中の選択の帯（`SelectionBar` の `inline`：担当を替える・取り消す・選択を外す）・「この日の日の予定を開く」（`month-day-visits-plan`）。欄が開いている間は画面の下の選択の帯を出さない。月を送ると閉じる

#### 表示の選択

数えるのはその日の担当の並び（`dayPlanOf`）。`lib/month` の `staffDay`・`clientDay`・`staffMonth`・`attentionList`。

- 〈スタッフ〉を選んだとき：
  - マスは短い文字（休・欠勤・欠勤あり・希望休（紫）・最終勤務日の後のときだけ。`month-shift`）＋3段バー（`StaffDay.bar`。問題を作れない日は勤務内を「分からない」）。勤務の無い日の「休」は `isAllRest` のとき `sr-only`
  - 件数・目安・移動・勤務時間は `aria-label`・title に
  - 凡例はその人の状態の凡例（`month-staff-bar-note`）
  - 右の欄の集計 `month-staff-sum`：最終勤務日（`month-staff-lastday`）・「希望休 N日」「欠勤 N日」（`absenceDays` は希望休を除く）など
- 〈利用者さん〉を選んだとき：
  - マスに訪問ごとの時刻・種類の色の点・担当（`month-cvisits`。「代」＝いつもの担当でない・「変」＝この回だけ変更・当日キャンセル）。休みの訪問は薄く「休み」
  - 右の欄は名前と「〈名前〉の予定（M月）を開く」（`month-client-open`。`/clients/:id?cal=month&d=YYYY-MM-01`）だけ
- 右の欄の見出しの名前は `PersonButton`

#### マスの読み方の吹き出し（カレンダーで、エキスパート機能が入のときだけ）

- `lib/monthGuide.ts`（純粋関数。テストあり）：`cellGuide(input)`＝そのマスに出ている印だけの読み方の行（背景の色・赤い点・赤い枠・「要対応 N」の札（`attention`）・件数・種類の帯・休 N（希 N。`restShown` が偽なら書かない）・欠・▶■・ベッド・最終・担当なし（`unassigned`）・ほかの要対応（`issues`）・未連絡（`changed`）・拘束超・3段の棒（`barRowsText()`）・人の表示の棒・代・変）。`createTipStore`
- 描いたあと（`useLayoutEffect`）に日付をキーに文を置き場に置き、吹き出しは `useSyncExternalStore` で日付から引く（描画中に DOM を読まない）
- `MonthCellTip`：表の要素に1回だけ `pointerover`・`pointerout`・`focusin`・`focusout`。マウスは 300ms 止まったら出し、出ていれば隣のマスへすぐ移す。離れて 120ms で消す。キーボードは `:focus-visible` のときだけで、そのあいだはマウスの出入りを見ない。出しているマスは日付で持ち、描き直しでも閉じない。Esc・フォーカスが外れると消える。吹き出しはマウスを受けない（`.is-passive`）。タッチでは出さない

#### 凡例（`MonthLegend`。エキスパート機能が入のときだけ）

- `details`（`month-legend-fold`）。閉じているときは「凡例を見る」（`month-legend-toggle`）と1行の要約（`month-legend-line`。狭い画面は省略記号）、開くと `MonthLegendBody`（`month-legend`）。はじめ畳み、保存しない。印刷では「凡例を見る」を出さない
- 要約：「色＝日の状態・赤い枠と「要対応 N」の札＝要対応・▶■＝始まる／終わる」
- 中身：状態の見本（まだ伝えていない・確定済み・未連絡の変更あり。後の2つは `Term`）・「要対応（担当なし・担当が休み・条件に合わない・時間に間に合わない）」・「要対応 N」の札・混み具合（「空き 0人」は `Term`）・`staffSlots` と `dayLoad` の数え方の一言

#### 日ごとの一覧

- `lib/monthList.ts`（純粋関数。テストあり）：`MonthLayout`（`calendar`・`list`）・`MONTH_LIST_QUERY`（`(max-width: 600px)`）・`monthLayoutOf(param, narrow)`・`monthListFocusDate`・`DAY_STATE_TEXT`・`monthListRow`（日付・件数・状態の文・`care`・旗。`reasons` が偽（切）なら旗は空で状態の印と文を出さない。読み上げの `label` には残す）
- 今月の一覧の上に「今日へ」（`month-list-today`）
- `month-list`（`ul`）。開いたとき `monthListFocusDate` の行へ巻く。行は `scroll-margin` で上の帯・下のタブを避ける
- 行は `button.month-list-btn`（`month-list-day`・`data-date`・`data-state`・`data-off`）。押すとマスと同じ（`pickDay`。「休みを入れる」のときは `toggleOff`・押せない日は `aria-disabled`）
- 表示の選択が〈スタッフ〉なら勤務の状態と担当の件数、〈利用者さん〉なら訪問の時刻と担当、休みを入れるときはその日の扱いを行の下に
- 390px で土曜も見え、はみ出さない。600px 以下の操作の行は1段で、見せ方の切り替え（`month-layout`）はアイコンだけ（名前は読み上げ）

#### エキスパート機能が切のとき（マスは例外だけ。PRD D410。ADR-0079）

何を出すかは `lib/exceptionView` の `monthCellView(only)`（`bars`・`otherMarks`・`reasons`・`guide`・`attentionList`）の1か所で決め、マス（`DayCell`）・日ごとの一覧の行（`monthListRow` の `reasons`）・右の欄・見出しが読む。入はいまのまま。

- マスに出すのは 日付・訪問の件数（`month-count`）・要対応の札（`month-attn`。D295）・「休 N」（`month-resting`。D295 の決め方。希望休の「（希 N）」も）・今日の印・選んだ件数・組んでいる間の「組んでいます…」だけ。種類の積み上げ・混み具合の棒・ほかの印（欠・▶■・ベッド・最終）・旗（担当なし N・担当が休み N・変更あり N・拘束超 N）・鍵と鉛筆の印は出さない。背景・枠の色（`is-state-changed`・`is-care`）は残す。理由は押した日の右の欄（`DayVisits`）と日の予定で見る
- 読み上げ（`aria-label`）は入と同じ文（理由も読む）。マスに吹き出しは出さない（`data-tip` を付けず `MonthCellTip` も置かない）。マスの読み方は見出しの ⓘ（`PageHeader` の右。`MonthCellHint`＝`Hint`「マスの読み方」・`month-cell-hint`。文は `lib/monthGuide` の `monthCellHint`）
- 日ごとの一覧の行も同じ（旗・状態の印と文を出さない。要対応の札は出す）
- 右の欄は、日を押す前は「日を押すとその日の訪問が出ます」（`month-aside-pick`。`MONTH_ASIDE_PICK_TEXT`）の1行だけで、要対応の一覧（`MonthAttention`）は出さない（件数の正は上の要対応の帯。D404）。進み具合の帯の「要対応」・`?do=attention`・コマンドパレットの「要対応を見る」は、いちばん早い要対応の行き先（`attentionTarget`。一覧の行を押したのと同じ）へ移る（`useMonthAside` の `firstAttention`。要対応が無ければ右の欄へ移るだけ）
- 確定の段階を出さない（`lib/settledView` の `showConfirmStep`）：進み具合の帯の「確定 N/N日」と「確定していない日を見る」（`bandNext` の `confirmStep`）・右の欄の「確定していない日」とまとめて確定（`?do=unconfirmed` は要対応と同じ扱い）
- 決まったあとの変更は訪問の「変更あり」の印（右の欄の行・日の予定。押すとその日の連絡の一覧）。マスには出さない（変更ありの日は「要対応 N」に数える）
- 進み具合の帯・「月全体：担当なし N件」は「詳しく ▾」の中（凡例は入れない。`detailItems`）。説明は1行で初回だけ
- 要対応は帯と同じ分け方（担当なし・重なり・休みの人。`lib/attentionBand` の `exceptionStatus`。`useMonthDays` が日の状態を絞る）で数え、マスの赤枠・「要対応 N」・進み具合の数もそろう

#### 右の欄（要対応・確定していない日。入のとき）

- 確定していない日（`progress.unconfirmed`＝今日以降の訪問があって確定済みでない日）：
  - 上に「問題の無い日をまとめて確定（N日）」（`month-confirm-bulk`・`data-count`。主ボタンにしない（主ボタンは操作の行の「予定を入れる」））。0日なら出さない
  - 対象は `lib/confirmDay` の `bulkConfirmTargets(unconfirmed, statusOf, attention)`：まだ伝えていない日で、`care` が0で、`attentionList`（未連絡の変更は除く）に出ない日。残すのは問題のある日（`problem`）・未連絡の変更のある日（`changed`）
  - 押せなければ理由 `month-confirm-why`（aria-describedby。`bulkConfirmWhy`：問題のある日がある／未連絡の変更のある日がある／確定していない日は無い）。対象の決まりの1行（`month-confirm-note`）。組んでいる間は押せない。印刷では出さない
  - 押すと確認（`bulkConfirmDialog`）：「問題の無い N日を確定しますか？」、本文に日付（`datesText`：「10/22（水）・10/23（木）… 計 N日」。7日を超えたら先頭6日と「…」）・担当が書き換わる旨・「問題のある M日は残します（要対応で確認）：日付」・「前に確定した割当と違う M日も残します（日の予定で確定し直します）。」・「案の無い M日も残します。」、ボタン「N日を確定する」
  - 確定すると1回の `update` で日ごとに `confirmDay(d, date, problem)`。確認のあいだに案が消えた日は飛ばす。知らせ「N日を確定しました」。フォーカスは右の欄へ
- 確定していない日の一覧 `month-unconfirmed`：行は `openDay`
- 要対応 `month-attention`（`attentionList`。`AttentionKind`＝`'care' | 'changed' | 'overSpan'`）：要対応の訪問のある日（「要対応 N件（担当なし…）」）・未連絡の変更のある日・拘束が上限を超える日。今日以降。欠勤があってもその人に訪問が無ければ出さない
- 行は `attentionTarget` の行き先へ（`openTarget`＝選んでいる日付をその日にしてから `navigate(to)`）。行は1つのボタンで、下に `.month-attention-go`（「（〜で開く）」）。`data-to` に行き先
- `Attention` の `staffIds?`（overSpan のときだけ。`names` と同じ順）

#### `?do=`（1回だけ。行ったら URL から消す）

| `?do=` | 動き |
|---|---|
| `batch` | 担当を組むの画面のその月（`/arrange?ym=`。replace）へ移す |
| `attention`・`unconfirmed` | 全体の表示にして右の欄へ移りフォーカス（切の `attention` は、いちばん早い要対応の行き先へ移る） |

#### 担当を組んでいる間

月の予定には組み始める入口は無い（[pages-arrange.md](pages-arrange.md)）。組んでいる間（`monthBatch.run` が null でない間）だけ：

- 操作の欄の下に進み具合（`month-progress`。「11/14：5/22日（組めた日 N日）」と［止める］）。上の帯の `BatchBand` は出さない
- 組んでいる日のマスに「組んでいます…」（`is-making`）
- まとめて確定・希望休は押せない
- 出た提案は帯（`RangeProposalBand`）で反映・捨てる。止まった理由は操作の欄に出す

#### 希望休

- 〈スタッフ〉を選ぶと選択の横に「休みを入れる」（`month-off-toggle`・`aria-pressed`。押すと「休みの入力を終わる」）。`requestedOff` が入のとき
- 入れているあいだ上に帯 `month-off-bar`（「〈名前〉さんの休みを入れる：勤務日のマスを押すと…」・この月の希望休 N日・最後の操作の結果 `month-off-note`（`aria-live`。訪問のある日に入れたら注意と「〈日〉の予定を開く」））
- マスを押すと `lib/requestedOff` の `toggleRequestedOff`（1回の `update`）
- `offDayState`：入れられる日は紫の点線の枠、希望休の日は紫の斜線（`aria-pressed`）、今日より前・勤務なし・ほかの欠勤は `disabled`（灰の枠。title と読み上げに理由）
- 〈スタッフ〉の選びを外すと終わる。組んでいる間は押せない
- 訪問のある日に入れても担当は変わらない（担当が休みの訪問として要対応に出る）。機能を切っても要対応の印は出る

#### `lib/month.ts`（純粋関数。テストあり）

- `monthDates(ym)`・`calendarWeeks(ym)`（日曜はじまりの6週。前後の月を含む）・`ymOf`・`addMonths`・`firstDayOf`
- `activeVisitsOn`：件数・状態は取り消し・休みの訪問を数えない（訪問は `visitsOn`）
- `dayStatus(data, date, view)`：`DayStatus`。`needsCare`＝要対応の訪問がある
- `batchTargets(data, dates, today, mode, statusOf)`：今日以降・伝えていない日のうち、`'care'` なら要対応の訪問がある日、`'all'` なら訪問のある日すべて
- `dayPlanOf`・`dayMarks`・`staffDay`・`staffMonth`・`clientDay`・`issueBreakdown`・`attentionList`
- `monthProgress(data, ym, today, statusOf)`：今日以降の訪問の件数・担当が全部入った日/訪問のある日・確定した日/訪問のある日・要対応の件数・確定していない日

#### `lib/requestedOff.ts`（純粋関数。テストあり）

`REQUESTED_OFF_NOTE`・`isRequestedOff`・`offDayState(data, staffId, date, today)`・`toggleRequestedOff(d, staffId, date, today, newId)`・`requestedOffDates(data, staffId, ym)`

### 月の印刷（`#/month/print?ym=&staff=`）

- `pages/MonthPrintPage.tsx`：`AdminShell` の外（`Guarded`）。ツアーは出ない
- 上の操作の帯（`.no-print`）：月の予定に戻る・前後の月・〈スタッフ〉の選択（全員／1人）・主ボタン「印刷する」＝`window.print()`
- 見出し：「2026年11月の予定（〈名前〉さん）」・事業所名・凡例・印刷日
- 日曜はじまりの週の表（その月の日が無い週は出さない）。マスは 日付・「確」／「案」・件数、行ごとに 種類の色の点・時刻・〈利用者さん〉・担当の名字（絞ったときは出さない。担当なしは「未定」）、下に「休：山田(希)・佐藤(欠)・鈴木」と「〈利用者さん〉休：…」
- CSS（`pages/monthPrint.css`）：`@page monthprint { size: A4 landscape; margin: 7mm }`・`.mprint { page: monthprint }`、週の行は `break-inside: avoid`、文字は 7.5pt
- `lib/monthPrint.ts`（純粋関数。テストあり）：`printDay(data, date, staffId, inMonth?)`（`PrintDay.pending`＝担当の決まっていない訪問の件数、`PrintDay.off`、`PrintEntry.staffLabel`・`staffId`、`PrintOff.label`・`staffId`。メールも使う）・`monthPrint(data, ym, staffId)`・`staffLabels(staff)`（名字。重なる人はフルネーム）

### 完了の条件

- [ ] 進み具合の帯の「担当を AI で組む」・`?do=batch` で担当を組むの画面（その月）へ。組んでいる間は月の予定に進み具合と［止める］、提案の帯で反映できる（`scripts/e2e-progress.cjs`）
- [ ] マスを押すとその日の訪問が右の欄に出て、もう一度押すと日の予定が開く
- [ ] 〈スタッフ〉を選び「休みを入れる」で勤務日のマスを押すと希望休が付き、もう一度で外れる。勤務の無い日・今日より前は押せない。訪問のある日に入れると注意とリンク、担当が休みの要対応（担当は変わらない）。全体の「休 N」に数が入る
- [ ] 「印刷」で `#/month/print` が開き、A4横の1か月の表（〈スタッフ〉で絞れる）。ナビ・操作の帯は印刷せず、週の途中で改ページしない
- [ ] 最終勤務日に「最終」、後の日の訪問は担当が休みの要対応。上限を超える日に「拘束超」・要対応
- [ ] 要対応の行き先（担当なし → 日の予定の担当なしの列・拘束の上限超え → 勤務の見込みのその月・その人・ほか → 日の予定）（`scripts/e2e-links.cjs`）
- [ ] 390px ははじめ日ごとの一覧（今日の行が画面に入る・「今日へ」）・`?layout=`・1400px ははじめカレンダー（`scripts/e2e-tour.cjs`）
- [ ] 凡例ははじめ畳む・マスに title を出さない・マウス／キーボードでマスの読み方（`scripts/e2e-words.cjs`）
- [ ] 「問題の無い日をまとめて確定（N日）」で確認に日付が並び、確定するとその日が確定済み・未確定が N日減る。担当が休みの訪問のある日・未連絡の変更のある日は外れて残る（`scripts/e2e-home.cjs`）
- [ ] マスで ←→ 日・↑↓ 週・Enter でその日の回の一覧（〈利用者さん〉でその日が1回なら欄）・Shift＋Enter でまとめて選ぶ（「選択 N」・選択の帯）。一覧の行を押すと欄・↓ で15分後へ・ほかの日のマスへドラッグ（今日より前は落とせない）（`scripts/e2e-shared-parts.cjs`）
- [ ] マスを1回押すと右の欄にその日の行・2回で日の予定、Enter で一覧の最初の行へフォーカス、行を別の日のマスへ落とすとその日の欄、2件選んで「別の日へ」で［移す］と日付が変わり（時刻・担当はそのまま）Ctrl+Z で1手戻る、確定した日なら確認。390px はマス・行を押すと下から出る欄（選ぶ・担当を替える・取り消す）（`scripts/e2e-chip-containers.cjs`）
- [ ] `lib/multiEdit`・`lib/month`・`lib/monthList`・`lib/monthGuide`・`lib/requestedOff`・`lib/monthPrint`・`lib/confirmDay` のテストが通る
