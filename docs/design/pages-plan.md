# 日の予定（予定と手直し）

> この画面のファイル：`src/pages/PlanPage.tsx`（区画を並べるだけ）・フック `usePlanPage.ts`（まとめ）・`usePlanData.ts`（計算）・`usePlanView.ts`（表示の状態）・`usePlanNav.ts`（移動・フォーカス・URL の入口）・`usePlanEdits.ts`（手直し・取り消し・確定）・`usePlanDrag.ts`（ドラッグ）・`usePlanShown.ts`（地図・日ごとのリスト・担当ごとの1日・一覧の行）・区画 `planLayout.tsx`・`planToolbar.tsx`（`PlanProgressText`）・`planColumns.tsx`（列・`PlanBoard`）・`planCards.tsx`（カード・帯・印）・`planReassignMenu.tsx`（`ReassignMenu`）・`visitList.tsx`（`VisitList`）・`planParts.tsx`・`planHeader.tsx`（`PlanConfirmActions`・`PlanOneLine`・`PlanHelp`）・`planBands.tsx`（`PlanBands`）・`planDetail.tsx`（`PlanDetailPanel`・`PlanSummary`・`BalanceChips`）・`cancelVisitPanel.tsx`・`mailPanels.tsx`（`DayMailPanel`）・`plan.css`、`src/components/routeView.tsx`・`routeTimeline.tsx`・`MapDock.tsx`・`MenuButton.tsx`・`dayLines.tsx`・`visitType.tsx`・`VisitRules.tsx`・`mapsLinks.tsx`・`useDayModel.ts`・`useRouteSelection.ts`・`PlanIssueCount.tsx`・`openTold.ts`、`src/lib/dayModel.ts`・`dayPlan.ts`・`planView.ts`（`planColumns`・`hardLabelsOf`・`toldMarksOf`・`unplacedReasons`・`droppedRowsOf`・`hardRowsOf`）・`dayMail.ts`（`dayMailRows`・`dayMailProgress`）・`chatText.ts`（`dayChatText`）・`clipboard.ts`・`reassignMenu.ts`・`unassignedReason.ts`・`scoreReason.ts`・`routeView.ts`・`timeline.ts`・`dayLine.ts`・`confirmDay.ts`・`settled.ts`・`settledView.ts`・`detailsHeading.ts`・`exceptionView.ts`、`src/components/Toast.tsx`。関連 ADR：0004・0007〜0010・0012・0013・0015・0017・0018・0030・0031・0051・0053・0054・0055・0058〜0060・0063・0073・0074・0098。関連 PRD：D12・D16〜D18・D25・D58・D63・D84・D91〜D101・D173〜D174・D201〜D209・D217・D219・D224・D229・D237・D266・D269・D300・D307・D314〜D319・D323・D329・D330・D333・D334・D339〜D347・D382・D384・D385・D402・D403・D419・D430。
> 担当は訪問に持ち（`Visit` の `staffId`・`start`・`pinned`）、その日の担当の並び（今の担当）は `lib/dayPlan` の `dayRoutes`。
> 欠勤・キャンセルの欄と振り直しは [pages-plan-absence.md](pages-plan-absence.md)、バーの塗りは [pages-bars.md](pages-bars.md)、操作の行・範囲の提案の帯・訪問の札・訪問の詳細の欄は [pages-common.md](pages-common.md)。

### 日の予定（`#/plan`）

その日の訪問の担当・手直し（ドラッグ・「担当を変える ▾」）・ピン・「確定（伝えた）」を1画面で扱う。AI では組まない（担当を組むの画面）。`#/schedule` は `#/plan` へ移す。

#### URL とクエリ

| クエリ | 動き |
|---|---|
| `?date=YYYY-MM-DD`（`?do=` なし） | その日を選び `?date=` を消す（`dateParam` の effect） |
| `?date=…&do=absence`（`SUDDEN_DO`）［`&staff=`］ | その日を選び「欠勤・キャンセル」の欄を開く。`&staff=` の人がその日に働く（`slotsOf` の `baseSlots` がある＝`staffChoices` に出る）ときだけ `open({ kind: 'staff', staffId })`（その人を選んで開く）、ほかは人を選ばずに開く。`?do=`・`?date=`・`staff` を消す。開く日を覚えて日付が変わってから開く（日付を変えると欄を閉じる effect より後） |
| `?date=…&do=unassigned`（`UNASSIGNED_DO`） | 「`?do=unassigned`」 |
| `?date=…&do=told` | その日の連絡の一覧を開く |

選んでいる日付は `useDay`（`DayProvider`）。

#### 並び

1. 見出し（`PageHeader`）：題名・1行の説明。すぐ下にナビの行（`ScheduleNav`）：「今日」・‹ 日付（`.date-switch select`）›・［月｜週｜日］・右に状態の印（「状態の印と確定」）。進み具合の帯は出さない（月の予定だけ）
2. 操作の行（`ScheduleToolbar zoom="day"`・`plan-toolbar`）と、開いていれば使い方の説明（`plan-help`）
3. 「詳しく ▾」（`day-details`。閉じて始まる）：1行のまとめと担当ごとの1日（`DayLines`）
4. あるときだけの帯（ドラッグ中には増減しない）：問題を作れない・採点できない・範囲の提案の帯（`RangeProposalBand`。`data-kind="range"`）・入らない訪問（`band-unassigned`・「見る」）・欠勤の振り直し（`band-reassign`・「差の欄へ」）・休み（`band-leave`）・拘束超え（`band-over-span`）
5. 欠勤の差の欄（本体のすぐ上。[pages-plan-absence.md](pages-plan-absence.md)）
6. 本体（時間軸か順番か一覧。600px 以下は日ごとのリストが既定）と、その下に全幅の地図（`plan-map`。1280px 以上は高さ 600px、狭い画面は 420px。比較の画面と同じ形）。画面の外にあるあいだは `MapDock` で右下に浮かせ、〈スタッフ〉・区間・訪問を選ぶと開く

#### 「詳しく ▾」と操作の行

- 「詳しく ▾」（`day-details`）：開け閉めは日の画面として端末に覚える（鍵 `details:day`）。中は1行のまとめ（訪問・入らない・守れない条件・移動・点数・理由）と担当ごとの1日。入は見出しの1行に「点数・移動 N分・入らない N・守れない条件 N」（0 は出さない。`lib/detailsHeading` の `dayHeading`）を出し、中の先頭に「要対応の訪問 N件」の帯（`band-care`。`CareBand`）。切は要対応の訪問の帯を出さない（上の要対応の帯が知らせる）
- 操作の行（共通の部品は [pages-common.md](pages-common.md) の `ScheduleToolbar`）：入＝主「訪問を1件追加」（`plan-visit-add`。`ADD_VISIT_LABEL`。〈利用者さん〉がいなければ `aria-disabled` と title に理由。開く欄の見出しも同じ）＋「確定（伝えた）」（`adopt`。確定済みの日は枠）、切＝主「訪問を1件追加」＋「欠勤・キャンセルを登録」（`sudden-open`）。スマホは「訪問を1件追加」を「その他 ▾」に入れ（`tb-keep-label`）、入は主が「確定（伝えた）」、切は主ボタン無し。要対応を組むのは要対応の帯
- 「その他 ▾」（`MenuButton`・`plan-more`）：訪問を1件追加（スマホ）・表示（`plan-view-〈k〉`。広い画面は時間軸・順番・一覧、スマホは日ごとのリスト・順番・一覧。訪問のある日だけ）・入は欠勤・キャンセルを登録・使い方（`plan-more-help`。操作の行の下に `plan-help` を開きフォーカスを移す。開いていれば「使い方を閉じる」）・**書き出し**（見出し「書き出し」。行き先ごとに1つずつ。`planToolbar.tsx` の `exportItemsOf`。PRD D419・ADR-0085）：「チャット用にコピー」（`day-chat-copy`。文に出す訪問のある日＝`lib/dayPlan` の `activeDayVisits` が1件以上。取り消し・休み・休止中の〈利用者さん〉の訪問だけの日は出さない。`usePlanPage` の `contact.hasShownVisits`）・「メールで送る」（`day-mail`。`mail` が入で、訪問のある日・未連絡の変更のある日）・「印刷」（`day-print`。チャット用にコピーと同じ日。`window.print()` で今の日の予定を印刷。印刷では時間軸の代わりに順番）・連絡を貼り付けて入れる（`paste-open`。いちばん最後。[pages-plan-absence.md](pages-plan-absence.md)）
- 欠勤の振り直しの案B の計算中は、行に進み具合と止める（回数とバーは `PlanProgressText` が外の入れ物 `lib/valueStore` から `useValueStore` で読み、画面全体は描き直さない）

#### エキスパート機能が切のとき

- 札は時刻・名前（担当は列）の1行。時間軸の移動・待ちは入と同じに出し（PRD D431）、担当なしの札に入れられない理由の札も出さない。ピン・条件に合わないの印は出さない（目立たせるのは担当なし・間に合わない・重なり・休みの人と「変更あり」）。使い方の文にピン・移動の説明を書かない
- 説明は入切とも1行で初回だけ（閉じたら端末に覚える）。入は担当なしの札の入れられない理由を札ごとに「理由 N ▾」（`unplaced-reasons-fold`。閉じて始める）
- 地図は入と同じ全幅のカード（`plan-map`）・〈スタッフ〉ごとの凡例。画面の外のときだけ右下に浮かせる（`MapDock`。ADR-0103）
- 「一覧で見る」の表にもピン・条件に合わないの札を出さない。欠勤・キャンセルのあとの振り直しは 反映・ピン・点数の言葉を使わず（`reassignWords`。「今の案」「〜にする」「決めた振り直し」）、点数は「詳しく」の中

#### 状態の印と確定

切（既定）は確定の段階を出さない（`lib/settledView` の `showConfirmStep`・`headerToldChip`）：

- 主ボタン「確定（伝えた）」・「確定済み」「まだ伝えていない」の印・「次の確定していない日へ」は出さない。今日から1か月先は、手で直す・組むと store の `update` が自動で伝えた記録を付ける（`lib/settled` の `autoTell`。`confirmDay`・`tellDay` と同じ書き方）。伝えた記録のある日は書き換えず、そのあとの変更が「変更あり」になる
- 決まったあとの変更は、日の上の「変更あり N件」（`confirm-state`。押すと連絡の一覧）と、訪問の「変更あり」の印（`visitLook` の `told`。`data-told-date`。押すとその日の連絡の一覧。日の画面はその場、週・月は `/plan?date=…&do=told` で開く。札の選択・ドラッグは壊さず、クリックの中で印を見分ける＝`components/openTold`）
- 連絡の一覧（未連絡の変更）に「連絡した」（`contacted`。メール機能の入り切りに関係なく）。押すと今の担当・開始を伝えた記録にし（確認なし・「元に戻す」で戻る。`useConfirmDay` の `contacted`）、「変更あり」が消える
- メールで送る・予約したときの伝えた記録（`confirmByMail`）は入切とも同じ

入：

- 状態の印（`confirm-state`）は `lib/dayPlan` の `toldStateOf`：まだ伝えていない（`'none'`）／確定済み（`'told'`）／未連絡の変更あり N件（`'changed'`。押すと連絡の一覧）。ほかに「変更あり N件」
- 主ボタン「確定（伝えた）」（未連絡の変更があれば「確定し直す（伝えた）」、確定済みなら枠で押せない）：独自の確認（「この担当と時刻を伝えたので、確定しますか？」／「変更を伝えたので、確定し直しますか？」。要対応の訪問があれば本文の先頭に「要対応の訪問が N件あります。」）のあと `lib/confirmDay` の `confirmDay(d, date, problem, at)`（＝`tellDay`）で今の担当・開始を `snapshots[date]` に書く
- 連絡の一覧の帯（`band-told`）：未連絡の変更があるとき「伝えたあとに変わった訪問 N件」と［連絡の一覧］（`toldChanges`。担当が外れる・入る・時刻が変わる。〈スタッフ〉ごと）
- 確定済みのとき、印の横に「次の確定していない日へ（10/23）」（`planParts` の `NextUnconfirmed`・`plan-next-unconfirmed`・`data-date`）：その日より後の最初の確定していない日へ
- すべての訪問を取り消すと担当の欄・列は出ず「確定（伝えた）」も出さない

#### 1行のまとめと点数の理由

- 1行のまとめ：訪問 N件・入らない N・守れない条件 N・移動 N分・点数 N点（`plan-oneline-score`・`plan-score`。`Term k="score"`。title「「〈名前〉」の重みで付けた点数」。地の色で、入らない・必須の違反があるときだけ `.is-alert` で赤）・点数の理由（`plan-reason`）・次の一手（`reason-next`。理由のすぐ後ろ）
- 入らない・守れない条件の数（1件以上）は押すと吹き出しの一覧（`components/PlanIssueCount`・`plan-dropped`・`plan-hard`。行の「見る」`-look`・「開く」`-open`・関連の画面 `-link`（`lib/hardLinks`）。入らないの下に「担当なしの列へ」`plan-dropped-none`）
- 点数は 100点満点。点数・必須の違反・条件ごとの達成は、いつも点数の基準のプリセットの重みで付ける（`useDayModel` の `scoreProblem`）。必須の違反がある案の点には「参考」の印（`RefMark`・`score-ref`。`HARD_NOTE`）
- `lib/scoreReason.ts`（純粋関数。テストあり）：`scoreReason(parts, score, { achievements, rules, ruleLower })`
  - 必須の違反があれば「守れない条件 N件」、入らない訪問があれば「入らない訪問 N件」を先に
  - 減点の合計が0.5点未満なら null
  - ほかは減点の内訳（evaluate の `hundredBreakdown`）のいちばん大きい成分を短い文に：移動が長め（N分）・空き時間（待ち）が長め（N分）・担当の条件（`perRule` の points の下限 `ruleLower`（evaluate の `ruleLowerBounds`）からの超過が最大の条件。必須は外す。相性△が N件・いつもの担当でない訪問 N件・「名前」に合わない訪問 N件、外れが無ければ「相性◎を取り逃した訪問がある」など）・件数の偏り（目安から外れた人 N人）
  - `scoreReasonLabel`（読み上げ・title）
  - `reasonOfRoutes({ problem, scale }, score, { achievements, rules, ruleLower })`：担当の並びの理由。日の予定の今の担当と比較の画面の案ごとで使う
  - evaluate の `ruleLowerBounds(problem)`：normalize の割当の下限を条件ごとに分けたもの（各訪問で割当費用が最小の担当の理由の点の和。和は lowerAssign と同じ）
  - 次の一手 `nextStep`（`NEXT_STEP_TEXT`）：移動が長め＝「「移動を短く」で組む」（`shortTravel`）、入らない訪問＝「受けられる人を見る」（`candidates`）、相性△・×・◎の取り逃し＝「相性の表を開く」（`compat`）。ほかは無し
- `useDayModel` は `scoreRules`（点数の基準の条件。名前と重みを理由の文に使う）を返す
- `planParts.tsx` の `ScoreReasonText`：↘ と短い文。前置き「点を下げているいちばんの理由：」は sr-only。使う所は `plan-reason` と比較の画面の `compare-reason`
- `planParts.tsx` の `ScoreNextStep`：「次の一手：［…］」（`span.score-next`・`reason-next`・`data-kind`、操作は `reason-next-action`）。`shortTravel` は日の予定では出さない、`candidates` は `unassignedHref(date)`、`compat` は `#/compat`（`compat` が切なら出さない）。印刷では出さない
- 点数の説明（`HundredHint`）は決め方と減点の内訳だけ（`hint-list` の箇条書き。「下がった点：移動 −N点・…」）。内部の費用は出さない
- 文：`SCORE_TEXT`（「理想の割当を100点として、訪問1件あたり余計にかかった分だけ引いた点」）・`rulerText(name)`（「点数はいつも「〈名前〉」の重みで付けます。条件を変えても、点の付け方は変わりません」）・`HARD_NOTE`（「必須を守れていない案の点は、ほかの案と比べられません。参考の点です」）

#### 手で直す

- 担当は手で替える（ドラッグ・「担当を変える ▾」・入らない訪問の「受けられる人」・複数選択の帯）。替えた訪問には自動でピン（担当を組むでも担当を変えない）。ピンは訪問ごとに外す（`unpin`）。「次からもこの人に」の記憶は無い（繰り返しの担当を直す）
- 範囲の提案（[pages-arrange.md](pages-arrange.md)）がその日を含めば同じ帯（`RangeProposalBand`）が出て、反映・捨てるができる
- 開いても自動では組まない（担当なしの訪問は要対応で見える）

#### 右の欄（`SidePanel`）

- 「詳しく」：今の担当の点数の内訳（「空き時間（待ち）」「点数の基準」は `Term`）・条件ごとの達成の件数・件数の偏り

#### 表示の切り替え［時間軸｜順番｜一覧］

選択は画面の状態（初期値：時間軸）。印刷・900px 以下は順番に切り替える。600px 以下は別の画面の状態（初期値：日ごとのリスト）で、「その他 ▾」の「表示」で選ぶ。

##### スマホの日ごとのリスト（600px 以下。`components/dayList.tsx`。[pages-common.md](pages-common.md) の「スマホの日ごとのリスト」）

- その日の訪問（取り消し・休みの回も）を開始の順に1行ずつ。行は共通の `VisitRow`（印は `dayLooks`）。押すと訪問の詳細の欄（下から出る欄）、長押し・「選ぶ」で複数選択（`SelectionBar` は下から出る置き場所）、左右にスワイプで前・次の日。日付を変えると選ぶ形を抜ける
- 見出し：説明（`page-lead`）とアイコンを出さず題名を小さく。1行のまとめは訪問・入らない・点数・詳しくだけ。担当ごとの1日は出さない。「担当なしを見る」（帯）は最初の担当なしの行へ巻く
- 390×844 で操作の行が1段で、最初の画面に訪問が見える

##### 時間軸（`components/routeTimeline.tsx`）

- 担当ごとの列を時刻の位置で描く。時刻は今の担当の並びの lenient の `scheduleRoute`
- 列の最小幅 `TL_COL_MIN_PX`（128px）。見出しの名前（`.col-head-name`）は空白で折り返して切らず、件数の札は入らなければ次の行。箱は `EdgeScroll`（`edgeClass="is-tl"`・`route-timeline`）で、右に続きの列がある間は端に影（印刷では出さない）
- 1分＝`TL_PX_PER_MIN`（1.1px）、`lib/spans` の `DAY_START` 07:00〜`DAY_END` 20:00（稼働時間帯・訪問がはみ出せば広げる）
- 列の背景は稼働時間帯（`slotsOf`。欠勤を差し引いたもの）の外を灰、欠勤の時間を斜線と「欠勤」
- 帯は押すと理由（`VisitCard` と同じ選択・地図の強調）。印は共通の判定（`dayLooks`・`lib/visitLook`。大の札 `data-size="l"`・`data-marks`。今日より前の日は要対応・資格✗／限✗を出さない）。代行・+N分・違反の赤い枠はこの画面の印
- 移動は次の帯の始まりに接して（その前に待ち。担当ごとの1日の横棒・`spanParts` と同じ並び）細い線と「移動 N分」（押すと区間を地図で強調）、待ちは点線の枠。「自宅まで N分」は列の最後の帯の下。分数は組みの結果の時刻（`legsOf`）で、`markLegs` が見込み（片方の位置が未登録。ADR-0093）と間に合わない（着く時刻が訪問の `latest` を過ぎる）の印を付ける（`columnLegs`・`homeTravel(…, withEstimate)`）。入切とも同じ（PRD D431・ADR-0097）。見込みは「30分（見込み）」の斜めの文字、間に合わないは `--warn-ink` と三角の印（title に「着く時刻が間に合わない」）。隙間が14px 未満の区間は文字を出さず（`is-short`。読み上げと title には分数）線だけ。スマホ（390px）は日ごとのリストで時間軸が無い。印刷は色を残す
- キー（[pages-common.md](pages-common.md) の「訪問の帯をキーで動かす」）：↑↓ 15分・←→ 1日（その日へ移りフォーカスは動かした帯）・Shift+←→ 隣の担当の列・Enter で訪問の詳細の欄・Delete で取り消し（確認）・Space は帯の詳細・Shift+Enter は複数選択。帯の `aria-keyshortcuts` と title にキーの説明
- ドラッグは順番と同じ担当の移し方（`bestInsertion`・ピン）。ドラッグ中は落とす列の earliest〜latest の位置に影（strict の可否で緑／赤）

##### 順番（担当ごとの列）

- `components/routeView.tsx`：`VisitCard`（来る区間・時間・訪問先・押すと理由。ドラッグ・ピン・違反・「→ Bでは（担当の名前）」は差し込む）・`LegLine`（自宅から・移動・自宅まで N分と待ち。押すと区間を強調）・`StaffLegend`（地図の凡例から担当を選ぶ）
- 列の最後に「自宅まで N分」（`problem.travel[訪問先の点][自宅の点]`。`lib/routeView` の `homeTravel`）。押すと地図でその区間を強調
- 訪問を押すと詳細（〈利用者さん〉・担当・「担当を変える ▾」・決まりごと・道順・理由）
- 理由の欄（`ReasonBox`・`reason-box`）：理由1つを1行（`reason-line`。`is-good`／`is-bad`）。「✓ 相性◎（選ばれやすい）」「! 移動12分（やや遠い）」。`lib/scoreReason` の `reasonFace(reason)`：相性◎＝選ばれやすい・○＝やや選ばれやすい・△＝選ばれにくい、移動は `TRAVEL_NEAR_MINUTES`（10分）以下＝近い・`TRAVEL_FAR_MINUTES`（20分）超＝遠い・間＝やや遠い、待ち＝空き時間がある、担当にできない（Infinity）、条件は名前だけ。読み上げは「よい点：」「気になる点：」（sr-only）。内部の値は行の `title` にだけ（「内部の値 −30（移動1分＝1。小さいほど選ばれやすい）」）

##### 一覧

- 表（時刻・訪問先・所要・担当・注意・開く/取消）。見出し「訪問の一覧（N件・休みのため無し N件）」
- 休みの訪問は表の後ろに薄い行と「休みのため無し（理由）」（開ける・計算には入らない）

#### 列の見出し

- 担当の名前・その日の稼働時間帯と「この日だけ変更」・欠勤の印（「欠勤 9:00〜12:00」「欠勤（終日）」、メモは title）・小さな「この人の欠勤を登録」（aria-label「この人の欠勤を登録（〈名前〉さん）」）／欠勤があれば「欠勤を直す」（aria-label「〈名前〉さんの欠勤を直す」）
- 2行目の右端に名前の i（`col-info`）。時間軸・順番とも
- 休み・休止中の人の列は出さない（担当になっている人と、欠勤で稼働時間帯が無くなったもともと働く人は出す）

#### 手直し（ドラッグ・担当を変える）とピン

- 別の担当の列へドラッグして移すとピン。「入らなかった訪問」（ドラッグ中は0件でも出る）へ落とすと担当なしになりピンが外れる
- ドラッグ中の予告は必須の条件に合わないことだけ。列の下に「ここに移すと：必須の条件に合わない（必要条件：入浴 ✗・相性× など）」と外れる理由（`problem.reasons` の Infinity の理由の名前。`lib/reassignMenu` の `hardReasonLabels`・`notAllowedText`）。時間の約束・稼働時間帯の違反は、移したあとに必須の違反として赤い枠
- 必須の条件に合わない担当にすると赤い枠と違反の印
- ドラッグの始まりは `lib/dragStart` の `deferredDragStart`（つかんでから DOM を変えない）
- 移すとトースト「〈名前〉さんへ移しました」（合わなければ「〈名前〉さんへ移しました。〈合わない理由〉ので、要対応に出ます」）、入らなかった訪問へは「入らなかった訪問へ移しました」。どちらも「元に戻す」付き

##### 担当を変える ▾（`pages/planReassignMenu.tsx` の `ReassignMenu`）

ドラッグと同じ手直しを、押す・キーボード・タッチで。訪問の詳細（時間軸の `tl-detail`・順番のカードの詳細）の「担当：」の下に置く。

- 部品は `components/MenuButton`（role="menu"・role="menuitem"・まとまりは role="group"＋aria-label・説明は aria-describedby・押せない項目もフォーカスは移り理由を出す・開くと先頭・↑↓・Home・End・Esc・Tab）。ボタン `plan-reassign`（ArrowRightLeft・「担当を変える ▾」）・一覧 `plan-reassign-list`

| まとまり | 項目 | 押すと |
|---|---|---|
| 今の担当 | 今の担当の名前（`cur-〈ID〉`・`plan-reassign-current`。ピンなら補足「ピン」。説明「今の担当です」・押せない・`aria-current`） | 何もしない |
| ほかの〈スタッフ〉へ移す | 列のある人ごと（`to-〈ID〉`・`plan-reassign-item`）。押せる人を先に（`candidatesFor` の並び）、必須の条件に合わない人は後ろで押せない | `moveTo`（ドラッグと同じ `bestInsertion`・ピン・トースト） |
| そのほか | 「入らなかった訪問へ」（`none`・`plan-reassign-none`。説明「担当なしにします（ピンも外れます）」。担当のいる訪問だけ） | `unassign` |

- 候補は `candidatesFor`（reassign）を列を出している人に絞ったもの（`reassignChoices`）。計算は一覧を開いているときだけ（`onOpenChange`）。担当の無い訪問で移せる人がいなければ「移せる〈スタッフ〉がいません」（`plan-reassign-empty`。押せない）
- 説明の1行（`reassignItemText`。テストあり）：いまの予定に必須の違反があれば「いまの予定に守れない条件あり」、件数の上限を超えれば「件数の上限を超える」、空き時間に入れば「移動 +N分・時間の約束 ✓」、入らなければ「時間の約束 ✗（N分遅らせれば入る）」か「時間の約束 ✗」。続けて相性の記号・「いつもの担当」・重みの違反の名前（2つまで）
- 押せない理由（`problem.allowed` が false）：「必須の条件に合いません（〈理由の名前〉・…）」。計算中は「計算中は選べません」
- 担当の無い訪問にも出す（今の担当・「入らなかった訪問へ」は無し）。欠勤の振り直しで「受けられる人」（`CandidateBox`）を出している訪問には出さない
- 一覧は浮かせて出す（`menu-list`。右からはみ出せば左へずらす）。390px でも収まる
- 選んだあとのフォーカス（`focusAfterMove`）：移した先の帯・カード（`.tl-band-btn`・`.route-btn`）、無ければ操作の行の［元に戻す］（`undo-btn`。アイコンだけのボタン）、それも無ければ移した先の列の見出し

##### 戻す（全体の履歴）

- 手直し・提案を反映する・振り直し・確定は、どれも store の `update(fn, 手の名前)` の1手（「担当を替える」「担当なしにする」「受けられる人に入れる」「ピンを外す」「AI の提案を反映（…）」「欠勤を登録」「欠勤の振り直し」「案A を反映する」「確定（伝えた）」など）。戻すのは全体の「元に戻す」（`undo-btn`・`toast-undo`・Ctrl+Z）で、50手まで。日付を問わない
- 複数選択（Shift・Ctrl＋クリック）は時間軸の帯と順番のカード（`useVisitSelection`）。下に `SelectionBar`

#### 入らなかった訪問

- 入らない訪問の列。理由の札の行 `unplaced-reasons` の先頭に〈利用者さん〉の i（`unplaced-info`。押してもカードを選ばない）
- 理由の札（`unplaced-reason`）は `reasonFace` の名前と（　）の言葉（「担当にできない」の言葉は付けない。例「さくら：9:00〜9:45 の訪問と時間が合わない」）。符号つきの数・「必須」を付けず、内部の値は `title` にだけ
- カードの下に組めない理由の短い内訳「組めない理由：勤務時間外 9人・欠勤 2人」（`unplaced-why`。入切とも控えめ。`title` に案内。`usePlanData` の `whyOf`＝`lib/unassignedReason` の `unassignedReasons(problem, routes, terms)`。PRD D430）。「入らない N」の一覧の行（`droppedRowsOf`）には同じ理由の直す画面のリンク（切った機能は外す）。「担当を変える ▾」で移せる人がいない担当なしの訪問は「移せる〈スタッフ〉がいません」に内訳と案内（`plan-reassign-empty` の説明。訪問の詳細の枠と同じ）
- 「受けられる人」で候補（`candidatesFor`。先頭5人＋「すべて見る」）。行ごとに：
  - 名前（`candidate-name`。`PersonButton`。押しても入れない。`.candidate-name` は `min-width:0`、名前は `span.ellipsis` で「…」（フォーカスの枠を切らない））
  - 移動 +N分・「時間の約束を守れる」／「N分ずらせば入る」／「空き時間に入らない」・「いまの予定に守れない条件があるため、空き時間に入れられません」・「入れると後ろの N件が最大 +M分 遅れる」・条件の違反・「件数の上限を超える」（札は折り返す）
  - 「この人に入れる」（`placeVisit` で入れてピン。後ろが遅れるときだけ確認「〈名前〉さんの訪問 N件の開始が最大 +M分 遅れます。入れますか？」。守れないときは赤い枠）
- 注記：「入れる訪問の時間の約束は変えません。空き時間に入らない人に入れると、その人の後ろの訪問の開始が遅れることがあり（押すと確認します）…」
- 390px で候補の一覧がはみ出さない

#### `?do=unassigned`

- `?date=` を読んで選び、`?date=`・`?do=` を消す（`usePlanNav` の `useUrlEntry`。`?date=` だけのリンクは `components/useDateEntry`＝〈スタッフ〉のスマホ画面と共通。巻く日は `pendingNone`）
- その日の並びが出たら1回だけ `goToNone`（「入らなかった訪問」の列へ巻く。担当なしが無ければ巻かずに終える。ほかの日へ移ったら忘れる）
- `?do=` 無しでは巻かない。同じ文書の中で hash を変えても同じ

#### 担当ごとの1日（`components/dayLines.tsx`）

- `DayLines`：1人1行（名前・横棒・件数）。横棒は `components/workBars` の `PartsBar`（塗りは [pages-bars.md](pages-bars.md)）
- 計算は `lib/dayLine.ts`：`dayLines(problem, routes, staffIds)`（勤務の時間帯（欠勤を差し引く）・件数・区間（`spanParts` に自宅からの移動を足す）・訪問・移動・待ち・空きの分）、`dayLineRange(lines)`（8〜20時。はみ出せば1時間単位で広げる）、`dayLineText(line)`（title・読み上げ）
- 行のボタンを押すとその人を選び（`focusOn`。列を強調・地図を絞る）、その人の列（`.route-col` の data-staff）へ巻いて列の見出しにフォーカス（一覧なら時間軸に切り替えてから）
- 横棒の訪問の所をマウス・タッチで押すと（`PartsBar` が data-visit-id に書く）その訪問を選び（`togglePick`。選んだままなら `focusOn` で絞り直す）、列の中のカード（data-visit）へ巻く。キーボード・訪問の外を押したときは人を選ぶ
- `detailName` で行のボタンの外の右に名前の i
- 訪問のある日だけ（600px 以下は出さない）。900px 以下・印刷は details で畳む（`collapsed`）。`--header-h` は触らない
- マウスだけの端末（`screen and (pointer: fine) and (not (any-pointer: coarse))`）は行を詰める（上下の余白0・行の高さ 1.25・i は 18px）。タッチできる端末と印刷は i の押せる所 32×24px。1行のまとめとの間は `--plan-gap`＋1px。1440×900 で本体の列の見出しと最初の訪問が初期表示に入る

#### 地図と強調（`lib/routeView.ts`。比較の画面と共通）

- `buildRouteMap`：ルートの集まり（予定は1つ、比較は A 点線・B 実線）から点・線を作る。線は担当の色。担当の絞り込み・選んだ訪問先・区間（来る移動と「自宅まで」）の強調・強調する訪問の集まり（振り直した訪問へ来る区間を太く）
- `homeTravel`・`MapPoint`・`MapLine`（`components/RouteMap` が描く）
- `routeSelect`（テストあり）と `useRouteSelection`：地図で見る担当・強調する区間・選んだ訪問。担当を変える・訪問や区間を押すとその人のものでない選択を外し、担当を移した訪問を選んでいたら絞り込みを新しい担当に合わせ、案が入れ替わった・比べる案を変えた・日付が変わったら外す
- 画面の外の地図は `components/MapDock.tsx`

#### 帯：休み・拘束超え

- 休み（`band-leave`）：「〈利用者さん〉の休みのため無し N件：」と名前（`leave-name`。`lib/personLinks` の `leavePeople(visits, leaves, date, nameOf)`。理由を添える）・「一覧で見る」。文は `band-text` の1つの要素（`with-icon` の中で折り返す）
- 拘束超え（`band-over-span`。`workload` が入のとき）：出勤〜退勤（最初の訪問の開始〜最後の訪問の終わり）が `org.spanLimitHours` を超える人。名前（`over-span-name`）と拘束の時間（1人ぶんは `over-span-item` で折り返さない）。1人なら帯のボタン「勤務の見込み」、2人以上なら人ごとのリンク `over-span-link`（`workloadHref(年月, ID)`。aria-label「〈名前〉さんの勤務の見込み」）。印刷ではリンクを出さない

#### 訪問の詳細の欄と取り消し

- 欄は [pages-common.md](pages-common.md) の「訪問の詳細の欄」。日の予定から開く所（`useOpenVisit`）：
  - 時間軸の帯・順番のカード・入らなかった訪問のカードの詳細の先頭の「詳細・変更」（`visit-open`）
  - 一覧の行の「開く」（`visit-row-open`。休みのため無しの行も）。行の「取り消す」はそのまま
  - 操作の行の「訪問を1件追加」（`plan-visit-add`）：その日を入れた新規の形
- 閉じたあとのフォーカス：開いた訪問の帯（`.tl-band .tl-band-btn`）・カード（`.route-btn`）・一覧の「開く」の順に探し（作り直した回・足した訪問は新しい ID）、無ければ開く前の要素、新規で何も無ければ `plan-visit-add`（600px 以下は `plan-more`）
- 「担当を変える ▾」の候補は欄と同じ `reassignChoices`。欄で担当を替えると `bestInsertion` の位置に入れてピン
- 取り消しは欄（ふつう／当日キャンセル）と一覧の行の「取り消す」（`applyCancel(visitId, sameDay)`。欠勤・キャンセルの欄と共通）。取り消すとその日の列・点から消え、足すと「入らなかった訪問」に出る

#### 種類・仮・決まりごとの表示

- カード・一覧に種類の色の印と名前（`components/visitType.tsx`。`title`・読み上げにも）。種類の必要条件で外れる理由は理由の欄に
- 仮押さえの〈利用者さん〉の訪問に「仮」の印
- 帯・カードの詳細に決まりごと（`components/VisitRules.tsx`）と道順のリンク。今の担当がその〈利用者さん〉を過去8週に担当していなければ（`lib/firstVisit` の `servedPairsBefore`・`isFirstVisit`。`usePlanPage` の `served`）、詳細の先頭に「初めて」の印と決まりごと（`VisitRules first`・`visit-first`。PRD D415）。移動時間か遠方（出張）のある〈利用者さん〉は、決まりごとの下に控えめな1行「遠方（出張）・移動 片道N分・家を出る目安 H:MM」（`components/clientTravel` の `TravelFact`・`visit-travel`。目安は組んだ開始−移動。PRD D429）
- 詳細の名前は `PersonButton`：時間軸は見出しの〈利用者さん〉と「担当：」、順番は `visit-who` の「〈利用者さん〉：」「担当：」。一覧の名前も

#### 日の予定のメール（`pages/mailPanels.tsx` の `DayMailPanel`）

- 「その他 ▾」の「メールで送る」（`day-mail`）→ 右の欄（見出し「〈日付〉の予定をメールで送る」）。訪問のある人と欠勤・希望休の人（`PrintDay.off`）を並べ、行に「欠勤」「希望休」。宛先ごとに `MailButton`
- 確定：「メールを作る」を押した人に「作成済み」（`mail-sent`）、欄に「メールを作った人 N/M人」（`day-mail-progress`）。送れる人（アドレスがあり長すぎない）全員分を作ると1回だけ確定（`confirmByMail`。確認なし・知らせに「元に戻す」と要対応の件数）。欄の下に「確定（伝えた）にする」（`day-mail-confirm`。見出しの確定と同じ確認）。数えるのは欄を開いている間だけ。本文は「確定した担当」と書く。伝えたあとに訪問が無くなった人も行に出し「訪問はありません」を送れる。送れる人がいない日・元に戻したあとは自動で確定せず、欄の文で「確定（伝えた）にする」へ案内する
- 「鍵の情報も入れる」（`mail-include-keys`）は React の状態だけ（保存しない）。日の予定では `usePlanView` の `includeKeys` に持ち、欄（`DayMailPanel` の `keys`）とチャット用にコピーで同じ選択（既定は入れない）
- 行は `lib/dayMail.ts` の `dayMailRows`、確定の文は `dayMailProgress`、数えて確定するのは `useDayMailConfirm`
- 本文に道順のリンク（`dayMailText`）。データは書き換えない
- 予約送信は [mail-schedule.md](mail-schedule.md)

#### チャット用にコピー（PRD D419。ADR-0085）

- 「その他 ▾」の「チャット用にコピー」（`day-chat-copy`）→ その日の全員分の文をクリップボードへ（`lib/clipboard` の `copyText`）。知らせ「チャット用の文をコピーしました」、コピーできなければ「コピーできませんでした。文を選んでコピーしてください」（`usePlanPage` の `contact.copyChat`・`onCopied`）。送るのは人
- 文は `lib/chatText.ts` の `dayChatText(data, date, { notesOn, includeKeys })`：「11/3（火）の予定」→ 担当ごとに「■〈名前〉」（名前の順）→「 9:00 〈利用者さん〉様（60分）」（時刻は5桁にそろえる）、最後に「■担当なし」。訪問の無い日は「訪問はありません」
- 担当ごとの並びはメールと同じ `lib/mail` の `dayByStaff`（伝えた内容、無ければ今の担当。担当なしは `unassigned`）。決まりごと（入り方・駐車場・注意）は初めての訪問先（`lib/firstVisit` の `servedPairsBefore`・`isFirstVisit`）の行の下だけ「   入り方：…」（`lib/visitRules` の `visitRuleLines`。訪問先の決まりごとを切れば入れない）。鍵は「鍵の情報も入れる」のときだけ。住所は入れない

#### 道順のリンク

- 順番のカード・時間軸の帯の詳細に `VisitRouteLinks`（その担当の今の順番。担当の無い訪問は出さない）。未連絡の変更がある日（`toldState === 'changed'`）は `note`「今の順番（未連絡の変更あり）」

#### `components/useDayModel.ts`（計算は `lib/dayModel.ts`）

- `useDayModel`：その日の問題・今の担当の並び・採点など。`compileInput` に `absences`。`slotsOf`（`lib/dayModel` の `daySlotsOf`。テストあり）は欠勤を差し引いた時間帯と、その日の欠勤（`absence`。無ければ null）を返す。`scoreRules` を返す
- `useCompileInput(data)`：compile が読むデータだけ（要対応の帯・進み具合の帯も使う）

#### `lib/dayPlan.ts`（日の割当と確定。純粋関数。テストあり）

- `dayProblemOf(data, date)`・`activeDayVisits`（取り消し・休み・利用中でない人を除く）・`routesOf(problem, visits)`・`dayRoutes`・`pinsOf`・`unassignedOf`
- `writeRoutes(data, date, problem, routes, { pins? })`：担当と lenient の開始を訪問に書く（変わる回だけ。計算した回は保存した回に）。pins を渡さなければピンは今のまま（担当なしにした訪問のピンは外す）。`settleDay` は今の並びで開始を書き直す
- `visitIssues(problem, routes, visits)`：訪問 ID → 要対応（`unassigned`・`off`・`notAllowed`・`late`。`off` には `late` を重ねない）
- `tellDay`・`toldChanges`・`toldStateOf`・`changeCount`・`contactsBetween`

#### 完了の条件

- [ ] 操作の行に AI で組む入口が無い。担当を組むの「案を比べる」で比較の画面へ（`scripts/e2e-plan-menu.cjs`）
- [ ] 日・週・月で同じ操作の行・範囲の提案の帯・全体の元に戻す（Ctrl+Z／やり直し・入力欄の中では効かない）・複数選択の帯（`scripts/e2e-schedule-tools.cjs`）
- [ ] 一覧は表示の「一覧」で出る。訪問を押すと理由と「担当を変える ▾」。列の最後の「自宅まで N分」を押すと地図でその区間を強調。`#/schedule` は `#/plan` へ移る
- [ ] 取り消すとその日の列・点から消え、足すと「入らなかった訪問」に出る。すべて取り消すと担当の欄・列と「確定（伝えた）」が出ない
- [ ] 列の見出しに稼働時間帯と「この日だけ変更」。「入らなかった訪問」（ドラッグ中は0件でも出る）へドラッグすると担当なしになりピンが外れる
- [ ] 休み・休止中の人の列は出さない（担当になっている人を除く）。時間の約束・稼働時間帯の違反は移したあとに赤い枠
- [ ] エキスパート機能が切なら：操作の行は主ボタン1つ＋1つ。点数・移動・凡例は「詳しく」の中。札は時刻・名前の1行で、待ち・理由・ピンの印が無く、時間軸の移動は点線と薄い文字だけ（見込み・間に合わないの印つき）。操作の行に［元に戻す］［やり直す］のアイコンだけのボタンがある。地図は入と同じ全幅のカード（1366px・390px）。確定のボタン・「確定済み」「まだ伝えていない」の印が無く、手で直すと伝えた記録が自動で付き、もう一度直すと「変更あり」の印と日の上のチップ。印から連絡の一覧が開き、「連絡した」で消える（`lib/settled` のテスト・`scripts/e2e-simple-menu.cjs`・`scripts/e2e-basic-auto.cjs`）
- [ ] 「確定（伝えた）」で `snapshots[date]` に今の担当・開始が入り「確定済み」。あとで変えると「未連絡の変更あり N件」と連絡の一覧（`lib/dayPlan` のテスト）
- [ ] 確定すると「次の確定していない日へ（M/D）」が出て、押すとその日が開く（`scripts/e2e-home.cjs`）
- [ ] 必須の条件に合わない担当にすると赤い枠と違反の印
- [ ] 「受けられる人」の「この人に入れる」でその人の列に入りピン。後ろの訪問が遅れるときだけ確認
- [ ] 390px は日ごとのリスト（日付送り・スワイプ・下から出る欄の4つのボタン・日時の変更が出ない・長押しと「選ぶ」の複数選択）、1400px は帯の ↑↓←→・Shift+←→・Enter・Delete が全体の元に戻すの1手、範囲の提案が画面を移っても残る（`lib/visitKeys` のテスト・`scripts/e2e-day-ops.cjs`・`scripts/e2e-schedule-tools.cjs`）
- [ ] 「担当を変える ▾」の項目（role=menuitem・説明・今の担当・担当なしにする）、キーボードで移すと担当が変わりピン、トーストと「元に戻す」で担当とピンが戻る、確定の確認に要対応の件数、390px で押せる（`lib/reassignMenu` のテスト・`scripts/e2e-plan-menu.cjs`）
- [ ] 点数の理由・次の一手・訪問ごとの理由の言葉（入らなかった訪問の札も。符号・「費用」を出さない）（`lib/scoreReason` のテスト・`scripts/e2e-words.cjs`）
- [ ] `?do=unassigned` で入らなかった訪問へ巻く（`scripts/e2e-links.cjs`）
- [ ] 名前から開く詳細（列の見出しの i・訪問の詳細・担当ごとの1日・一覧・入らなかった訪問・受けられる人・休みの帯・拘束超えの帯）（`scripts/e2e-details.cjs`・`scripts/e2e-details2.cjs`）
- [ ] 「その他 ▾」の書き出しは「チャット用にコピー」・「メールで送る」・「印刷」の順。コピーした文は見出し・■名前・時刻・様・所要・担当なし、決まりごとは初めての訪問先の行の下だけ、鍵は「鍵の情報も入れる」のときだけ、住所なし（`lib/chatText` のテスト・`scripts/e2e-mail.cjs`）
