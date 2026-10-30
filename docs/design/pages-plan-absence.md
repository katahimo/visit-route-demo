# 日の予定：欠勤・キャンセルと振り直し

> この画面のファイル：`src/pages/SuddenPanel.tsx`・`absenceParts.tsx`（`AbsenceFields`・`AbsenceTargets`・`ReassignBar`・`ReassignResultBox`・`ReassignSummary`・`ReassignMoves`・`CandidateBox`・`previewOf`）・`useSuddenSteps.ts`・`suddenSteps.tsx`・`suddenContactStep.tsx`・`reassignParts.tsx`（`AnnealBox`・`ContactButton`・`ReassignDock`）・`contactPanel.tsx`（`ContactPanel`）・`useReassignFlow.ts`・`useSuddenFlow.tsx`・`usePlanRun.ts`・`PlanPage.tsx`・`plan.css`、`src/lib/sudden.ts`・`absences.ts`・`planReassign.ts`・`contacts.ts`・`clipboard.ts`。関連 ADR：0011・0015・0025・0038・0044・0053。関連 PRD：D26〜D29・D31・D32・D34・D35・D167〜D172・D244〜D246・D264・D265・D325。
> 日の予定の全体は [pages-plan.md](pages-plan.md)。計算（`reassign`・`targetsOf`・`prepareAnneal`・`settleAnneal`）は design.md の「reassign」。
> 版2（ADR-0053）：振り直しは `writeRoutes` で訪問に書き（今の担当になる）、振り直す前の担当は `reassigns[date]`。確定は5段目の「連絡したので確定」（伝えた内容 `snapshots`）

### 「欠勤・キャンセル」の欄（PRD D167〜D172・D244〜D246・D325）

急な欠勤（遅刻・早退を含む）と当日キャンセルを1つの欄で段階に分けて扱う（起きたこと→人→影響→確定→連絡の5段。ADR-0038）。

#### 入口

| 入口 | 開き方 |
|---|---|
| 日の予定の操作の行の先頭「欠勤・キャンセルを登録」（`sudden-open`） | 1段目。主ボタンにしない・枠のボタン（`.plan-sudden-btn` は印刷で隠すためだけ。PRD D238。前は赤い縁）。訪問も働く人もいない日は押せない。印刷では出さない |
| 列の見出しの「この人の欠勤を登録」「欠勤を直す」 | `useSuddenState` の `open({ kind: 'staff', staffId })`。その人を選んだ2段目（開くたびに差の欄へ移る印 `toBar` を戻す） |
| `/plan?date=…&do=absence`（ホーム・メニュー・パレットの「欠勤・キャンセルを登録」・月の要対応・勤務時間（シフト）の右の欄） | 1段目（`&staff=` の人がその日に働けば2段目）。`?do=`・`?date=`・`staff` を消す |

下のタブは変えない（5つのまま）。日の予定で欠勤・キャンセルのメニューの項目に印を付けない。

#### `pages/SuddenPanel.tsx`

- `SuddenPanel`：`SidePanel` の narrow（見出し「欠勤・キャンセル」・data-testid `sudden-panel`）。`init`＝`{ kind?, staffId? }`（人があれば2段目から）
- 段階の状態と処理は `useSuddenSteps`（`pages/useSuddenSteps.ts`。props の型 `SuddenPanelProps`・`SuddenInit` もここ）、段ごとの中身と下の帯は `suddenSteps.tsx` の `kindStep`・`staffStep`・`visitStep`・`absenceImpactStep`・`cancelImpactStep`・`doneStep` と `suddenContactStep.tsx` の `contactStep`（どれも `{ body, footer }` を返す関数）
- 段階・何が起きたか・人・欠勤の入力・訪問・取り消しの種類・済んだこと・5段目の［連絡した］の印は欄の中の状態（［連絡した］はデータに残さない。ADR-0038）
- 段階の表示は `ol.sudden-steps`（aria-label「段階」。今の段階に `aria-current="step"`）。段階の見出し（`h3`・`data-return-focus`）へ `focusKey` でフォーカス
- 戻る（`sudden-back`）・閉じる（`sudden-close`）。Esc で閉じると入口へフォーカス。閉じる `onClose(toBar)`：閉じたあと、振り直していれば差の欄へ（`returnFocus` と `goToBar`）。5段目からは差の欄へ移らない
- 振り直し・欠勤だけ登録・欠勤の取り消し・取り消し・確定・元に戻すは日の予定の関数を受けて呼ぶだけ。4段目の振り直しの結果（まとめ `ReassignSummary`・担当が移る訪問 `ReassignMoves`・`AnnealBox`）は日の予定が `result` で、5段目の連絡の一覧は `contacts`（`ContactRow[]`。差を出せなければ null）で、〈スタッフ〉あてのメールは `contactMail`（メールを切っていれば渡さない）で渡す
- エキスパート機能（`expert`）が切のとき（ADR-0073・PRD D382）は確定の段階を出さない：5段目の「連絡したので確定」「あとで確定する」と確定の状態の文は出さず（`confirmNote` の `confirmStep`。変更ありのときだけ「連絡の一覧で『連絡した』を押す」案内）、帯は「終わる」だけ。振り直しは store の `update` が自動で伝えた記録を付ける／伝えた日なら「変更あり」になる
- 確定のボタンは欄の下の帯（`footer`）。600px 以下は幅いっぱい、4段目の表は欄の中で横に巻く
- `plan.css`：`.plan-sudden-btn`（入口）・`.sudden-steps`（段階の表示）・`.sudden-choice`（1段目の選択肢）・`.sudden-option`（3段目の案）・`.sudden-contacts`・`.sudden-contact`（5段目の1人1枚）

#### 段階

| 段階 | 〈スタッフ〉が休む（kind `staff`） | 〈利用者さん〉のキャンセル（kind `client`） |
|---|---|---|
| 短い名前（`suddenSteps`） | 起きたこと・休む人・影響・選ぶ・連絡・確定 | 起きたこと・訪問・影響・確認・連絡・確定 |
| 1 見出し「何が起きましたか？」 | `sudden-kind-staff`（「急な欠勤・遅刻・早退。休む人の訪問を、ほかの人へ振り直します」） | `sudden-kind-client` |
| 2 | 「休む〈スタッフ〉と時間帯を選ぶ」：人（`sudden-staff`）と `AbsenceFields`。人を選ぶまで「次へ」（`sudden-next`）を押せない。時間帯の誤りは理由を出して押せない。既にある欠勤は `sudden-existing` | 「キャンセルの訪問を選ぶ」：訪問（`sudden-visit`）と当日キャンセルか（`sudden-same-day`。既定は当日キャンセル） |
| 3 | 「影響を確かめて振り直す」：見込み（`absence-preview`・`sudden-impact`）と振り直しのボタン | 「影響を確かめて取り消す」：`cancelImpact` の文（`sudden-cancel-impact`）と「当日キャンセルとして取り消す」／「取り消す」（`sudden-cancel-ok`） |
| 4 | 「振り直し方を選ぶ」：済んだこと（`sudden-done`「〈欠勤〉を登録して振り直しました」）・`ReassignSummary`・`ReassignMoves`（PRD D265）・`AnnealBox`（案B を作って選ぶ）。帯は「次へ：連絡」（`sudden-to-contacts`。主ボタン）・「振り直す前に戻す」（`sudden-revert`）・「日の予定で差を見る」（`sudden-to-bar`） | 「取り消した結果を確かめる」：済んだこと。帯は「次へ：連絡」 |
| 5 見出し「変更を伝えて確定する」 | 連絡の一覧（下の「5段目の連絡」）。振り直しの差から。確定の状態の文（`sudden-confirm-note`）。帯は「連絡したので確定」（`sudden-adopt`。主ボタン。独自の確認のあと `tellDay` で伝えた内容を書き、欄を閉じる）と「あとで確定する」（`sudden-finish`。確定済みなら主ボタン「終わる」だけ） | 連絡の一覧。取り消した訪問の担当に「中止」と、取り消したときの伝えた内容との差から |

#### 5段目の連絡（PRD D244〜D246・D325。ADR-0038）

- 一覧は1人に1枚（`sudden-contacts` の `sudden-contact`。`data-to`＝`staff|client`・`data-kinds`＝種類）：宛名・種類の印（担当が外れる・新しく入る（`chip-move`）・時刻が変わる（`chip-warn`）・中止、〈利用者さん〉は「〈利用者さん〉あて」）・連絡文（`sudden-contact-text`）・［文をコピー］（`sudden-contact-copy`。`copyText` とトースト）・〈スタッフ〉あての「メール」（`MailButton`・`MailLengthNote`。`sudden-contact-mail`。件名は `contactMailText`）・［連絡した］（`sudden-contact-sent`。印の鍵は宛先と文なので、確定し直して文が変われば消える）
- 上に説明（欠勤とキャンセルで分ける）と、欠勤の人に残る訪問があれば「欠勤の人に残る訪問 N件（連絡文には入りません。日の予定で確かめてください）」（`sudden-contacts-left`。日の予定が `leftCount` で渡す）、「連絡した N/M人」（`sudden-contacts-count`。`aria-live`）。行が無ければ「連絡が要る変更はありません。」、差を出せなければ「日の予定の「連絡の一覧」で確かめてください」（`sudden-contacts-none`）
- 帯は「連絡したので確定」（`sudden-adopt`。塗り＝欄の主ボタンはこれ1つ）・「あとで確定する」（`sudden-finish`。枠。確定済みなら「終わる」が主ボタン）と「戻る」（4段目。枠）。行の［文をコピー］・メールは枠の小さなボタン、［連絡した］はチェック（ボタンの3段。PRD D238・ADR-0036）
- 日の予定（`PlanPage`）が作る：
  - 伝えた日：伝えた内容 → 今の担当の差（`toldChanges`。欠勤の振り直しのほか手で変えた訪問も）。欄で取り消した訪問は差から外す（`withoutVisit`）
  - 伝えていない日の欠勤：差の欄と同じ `contacts`（`contactsOf`。振り直す前の担当 → 今の担当）
  - 伝えていない日のキャンセル：欄の取り消し（`useSuddenFlow` の `onCancelVisit`）が、取り消す前の担当・開始（今の担当の並びの時刻、無ければ約束の開始）と、取り消す訪問を除いた担当の並びを覚えてから `applyCancel`。差は `contactsOf(取り消す前の並び, 今の担当の並び)`
  - 行は `contactRows(差, 取り消した訪問, contactWords)`。欄を開き直すと覚えた取り消しを消す

#### 2段目の欠勤の入力（`AbsenceFields`）

- 終日／時間帯のラジオ。時間帯は開始・終了（30分刻みの選択。空＝始業から・終業まで）と早道のボタン：午前だけ＝始業〜12:00、午後だけ＝12:00〜終業、〇時から（早退）＝開始だけ、〇時まで（遅刻）＝終了だけ
- メモ（100字まで）。「いまの時刻」の入力は無い（当日に終日の欠勤を登録しても、その日の訪問はすべて振り直す）
- 人の選択肢は `staffChoices`（その日にもともと働く人。「名前（稼働時間帯・訪問 N件・欠勤）」）。その日の稼働時間帯がもともと無い人は出さない
- 時間帯が正しくない（終了 ≤ 開始）・開始も終了も無いときは理由を出して進めない（`draftError`）

#### 3段目の見込みと振り直しのボタン

- 見込みは `previewOf`（3段目のときだけ計算。メモは key に入れない＝メモの入力では計算し直さない）。読み上げは `aria-live="polite"`
- `impactText(targets)`：「入らなくなる訪問 N件」と内訳「欠勤と重なる a件・間に合わない b件（・ほかの必須の条件 c件）」。無ければ「入らなくなる訪問はありません」。訪問の一覧は `AbsenceTargets`
- 「ほかの人の担当・順番・時刻は変えず、空き時間に入れます（〈名前〉さんの残りの訪問は、欠勤明けの移動で開始が遅れることがあります）」
- `targetsOf` に続けて案A（`reassign`）の見込みも出し、入らない見込みがあれば案B を勧める（`recommendAnneal({ hasBase, unplacedA })`。「少し動かしてよい（案B）」の箱 `anneal-suggest` に「おすすめ」）
- 上に「おすすめ：…」の1行（`sudden-recommend`）。おすすめの案の説明カード（`.sudden-option.is-recommended`）に縁と札「おすすめ」（PRD D264）
- ボタン（主ボタンは1つ。PRD D264・ADR-0044）：
  - 帯の主ボタン「登録して振り直す（おすすめ）」：勧めるとき（案A で入らない見込み）は `sudden-anneal`（押すと「登録して振り直す」と同じに案A を反映し、続けて案B を作り始める）、勧めないときは `sudden-reassign`（案A）
  - 本文の「ほかのやり方」（`sudden-alt`。文字のボタン `.btn-text`）：もう一方の案（「案A だけで振り直す」`sudden-reassign`／「登録して、案B も作る」`sudden-anneal`）と「欠勤だけ登録（振り直さない）」（`sudden-save-only`。計算中は押せない）
  - 振り直しの元が無い（`hasBase` が false：担当のある訪問が無い日・計算中・見込みを出せない）ときは、振り直しのボタン（`sudden-reassign`・`sudden-anneal`）と「ほかのやり方」を出さず、帯の主ボタンを「欠勤だけ登録（振り直さない）」にする（主ボタンは1つ）
  - 帯：既存の欠勤なら「欠勤を取り消す」（`sudden-remove`）・「戻る」
- 押せない理由（`reassignBlocked({ error, running, hasPreview, hasBase })`）：「計算中は押せません（終わるまで待ってください）」・「見込みを出せませんでした」・「この日はまだ担当のある訪問がありません。欠勤だけ登録できます」
- 担当のある訪問が無い日（`sudden-no-plan`。`noPlanText(running)`）：計算中は「担当を組んでいます。終わると振り直せます」、ほかは欠勤だけ登録できる

#### 日の予定の関数（状態と処理のフック。まとめは `pages/usePlanPage.ts`）

- 欄の状態は `useSuddenState(date)`（`sudden`・開く `open(init)`・欄で取り消した訪問）、`?do=absence` の入口は `useSuddenEntry`、欄に渡すもの（選択肢・5段目の連絡・欠勤だけ登録・欠勤の取り消し・欄からの取り消し・閉じる）は `useSuddenFlow`（`pages/useSuddenFlow.tsx`）
- 振り直しは `useReassignFlow`（`pages/useReassignFlow.ts`）：差・印・欠勤の人に残る訪問・案A／案B（`useAnneal`）・比べる数（`useReassignOptions`）・差の欄へ移る（`useBarFocus`）。計算（Worker）は `usePlanRun`（`pages/usePlanRun.ts`）
- `registerAndReassign(absence, anneal, stay)`（`useReassignFlow`）：欄から呼ぶとき（`stay`）は欄を閉じず差の欄へも移らず、振り直せたかを返す。手順は `lib/planReassign.ts` の `planReassign(data, date, absence)`（欠勤を足して compile・振り直しの元の案・`targetsOf`・`reassign`。見込みの `previewOf` も前半 `absenceBaseOf` と後半 `reassignFrom` で同じ手順）
- `adopt`（確定。`usePlanEdits`）・`revertToBase`・欠勤の取り消し（`onRemoveAbsence`）：済んだか（確認で取り消したら false）を返す
- 訪問の取り消しは `applyCancel(visitId, sameDay)`（`usePlanEdits`。一覧の取り消しの欄と共通）

#### `lib/sudden.ts`（純粋関数。テストあり）

- `SUDDEN_DO`（`'absence'`）・`SuddenKind`（`'staff' | 'client'`）
- `suddenSteps(kind)`・`suddenHeading(kind, step, staffWord)`（段階の見出し。短い名前と重ねない）
- `noPlanText(running)`・`recommendAnneal({ hasBase, unplacedA })`
- `draftOf(existing)`・`absenceOfDraft(draft, staffId, date, existing)`・`draftError(draft)`（欠勤の入力の決まり）
- `staffChoices(staff, slotsOf, visitCount)`・`visitChoices(visits, clientName, window, ownerName)`（時刻の順。「9:00〜10:00 名前（担当：担当の名前さん／担当なし）」）
- `impactText(targets)`・`reassignBlocked(...)`
- `cancelImpact({ owner, sameDay, clientWord, hasPlan })`：担当がいれば「担当の〈名前〉さんの予定からこの訪問が外れ、その時間が空きます。ほかの訪問の担当・順番・時刻は変えません」、担当が決まっていなければ「この訪問はまだ担当が決まっていません。ほかの訪問は変わりません」。当日キャンセルは「月の予定と〈利用者さん〉ごとの月の集計に回数が出ます（請求はしません）」、ふつうの取り消しは「ふつうの取り消しは回数に数えません」
- `suddenHeading(kind, 5, …)`：「変更を伝える」
- `confirmNote(state)`：told「今の担当は伝えた内容と同じです（確定済み）」・changed「伝えたあとに変わった訪問があります（未連絡の変更）。連絡してから「確定」を押してください」・none「まだ確定していません。連絡したら「確定」を押してください」
- `absenceSummary(name, absence, slots)`

#### 確かめ

`scripts/e2e-absence.cjs`：ホームのカードから今日の日の予定で1段目が開き `?do=`・`?date=` が消える・段階の表示（aria-current）と見出しへのフォーカス・人を選ぶまで次へが押せない・時間帯の誤り・影響（入らなくなる訪問 N件・主ボタンは「登録して振り直す（おすすめ）」の1つ・ほかのやり方は文字のボタン・おすすめのカードに縁と札）・戻る・案A で4段目（担当が移る訪問の一覧・「変更を減らす」は「詳しく」に畳む）・案B を作って選ぶ・確定（独自の確認）で5段目（連絡。段階の名前・見出し・休む人あての文・新しく入る人あての文・〈利用者さん〉あては敬語でほかの人の名前なし・メールは mailto:・［連絡した］で「連絡した 1/N人」・［文をコピー］の知らせ）→「終わる」で確定済み・当日キャンセル（既定・影響の文・cancelKind・5段目で担当に「中止です」）・Esc で入口へフォーカス・列の見出しの「欠勤を直す」から2段目・欠勤の取り消し・担当のある訪問が無い日は欠勤だけ・390px で入口と欄が収まり下のタブは5つ・4段目の一覧が欄に収まる・印刷で入口を出さない。

### 振り直し（案A。ADR-0011。PRD D26〜D32）

#### 登録して振り直す

- 欠勤を足したデータで compile した問題、振り直しの元（`lib/absences` の `baseOf`：その日の訪問の担当の並びとピン）、`targetsOf`（`base.problem` はその日の欠勤を除いたデータで compile した問題）→ `reassign`（`lib/planReassign` の `planReassign`）
- `applyReassign(d, date, { problem, result, base, absenceIds })`：結果を `writeRoutes` で訪問に書き（振り直した訪問と動かしていない担当のある訪問はピン）、`reassigns[date]` に振り直す前の担当（`baseRoutes`・`basePins`）・案A の結果（`insertRoutes`）・使った欠勤（`absenceIds`）を残す。続けて振り直すときは振り直す前の担当は最初のものを引き継ぎ、`absenceIds` は累積。欠勤の保存とは別の手（「欠勤を登録」「欠勤の振り直し」）
- 担当のある訪問が無い日は振り直せない（欠勤だけは登録できる）。計算中（Worker）は押せない
- 振り直したあとの訪問はピンなので、担当を組むで組み直しても担当が変わらない

#### 欠勤の取り消し

- `removeAbsence`：今の担当は変えない（列の稼働時間帯は戻る）。差の欄の「振り直す前に戻す」で振り直す前の担当・ピンに戻る
- 振り直しに使った欠勤が取り消されていたら差の欄にその旨と「振り直す前に戻す」

#### 列とカードの印

- 差の欄があるとき、変わらない人の列は薄く（押せる。文字のコントラストは保ち、背景・枠線・見出しの印だけを薄くする。透明度は使わない）
- 振り直した訪問のカードに「代行」の印（元の担当の名前を title・読み上げに）、開始が変わった訪問に「+N分」（早まったら「−N分」）
- 地図は振り直した訪問へ来る区間を太くする（`buildRouteMap` に強調する訪問の集まりを渡す）
- 欠勤の人に残る訪問に「欠勤と重なる：振り直していない（対応が必要）」などの赤い印（理由は `leftOf` の reason。`leftOf` は欠勤のせいの訪問（absence・unreachable）だけで、欠勤と関係ない元からの違反（notAllowed）は含めない＝必須の違反の赤い枠で出る）
- 欠勤の人の列の見出しの下に近道：「振り直し済み・入らない（全体） N件」（差の欄へ）・「欠勤の人のまま N件」（あれば）・「案B を作る」（案A で入らない訪問があり案B をまだ作っていないとき。作り始めて差の欄へ）
- 日の予定のあるときだけの帯（`band-reassign`）：「欠勤の振り直し：入らない N件・欠勤の人のまま N件」と「差の欄へ」

### 差の欄（`ReassignBar`）

その日に振り直しの情報（`reassigns[date]`）があるとき、担当ごとの順番の欄（本体）のすぐ上（欠勤の人の列の近く）。`tabIndex=-1`・見出しで名前づけ。

#### 中身

- 見出し「（案A：空き時間に入れた案）／（案B：少し動かした案）」。案B なら注記を「ほかの人の訪問も少し動かしています」に
- まとめ（`ReassignSummary`。4段目でも使う）：「変わる人 N人・振り直し N件・入らない N件・（あれば）欠勤の人のまま N件・移動 +N分」
- 担当が移る訪問（`ReassignMoves`。欄の4段目と、差の欄の畳んだ「担当が変わった訪問を見る（N件）」（`reassign-bar-moves`。1件以上のときだけ。案を比べるを切っていても出す。PRD D296）。PRD D265）：`reassignMoveRows(diff, visitLabel)` （`lib/sudden`。テストあり）で `moved` と `unplaced` を1訪問1行・訪問の文の順に（文は `visitLabel`＝受けられる時間帯の初め（`earliestStart`）と名前なので、並びも行の時刻も時間帯の初め。振り直したあとの開始時刻ではない）。行は「10:00 〈利用者さん〉」と「〇〇さん → △△さん」（読み上げは「から」）、入らない訪問は「入らない（〇〇さんから外れる）」（赤い縁）。無ければ「担当が変わる訪問はありません」。`reassign-moves`・`reassign-move`（`data-to`）
- 入らない訪問の理由：「入らない訪問（N件）：ほかの人の空き時間に入らない」と一覧・案B か「受けられる人」へ
- 欠勤の人に残る訪問（`leftOf`。今の担当に targetsOf を当てたもの。手直しで戻した等）の理由（`leftReasonText`）と「対応が必要」・「もう一度振り直す」。〈利用者さん〉の名前は `PersonButton`（`visitNode`。data-testid `left-client`）
- 「振り直す前に戻す」（PRD D31・D329。ADR-0054）：欠勤の登録（手の名前「欠勤を登録」）と振り直し（「欠勤の振り直し」）は別の手。直前の手が振り直し（「案A を反映する」「案B を反映する」も）なら全体の「元に戻す」で1手戻す（欠勤は残る。確認なし）。あとにほかの操作をしていたら、確認を出して `revertReassign`（routes・pins を `baseRoutes`・`basePins` に戻し、あとで足した訪問は今のまま。手の名前「振り直す前に戻す」。これも元に戻せる）
- 「比較の画面で見る」（A＝欠勤前、B＝今の担当。案を比べるを切っていれば出さない）
- 「連絡の一覧（訪問N件）」（`ContactButton`）
- 少し動かしてよい（案B）の欄（`AnnealBox`。下）
- 差は `reassignDiff`（before＝振り直す前の担当を、振り直しに使った欠勤を除いたデータで compile した問題で、after＝今の担当をいまの問題で）

#### 残り方・消え方

- 手直し・提案の反映をしても差の欄は残る（振り直す前の担当との差を出し直す）。2人を順に欠勤にして振り直すと、差は最初の振り直す前の担当との差。「振り直す前に戻す」で消える
- 切った機能でも、すでに振り直した案の差の欄・帯・連絡の一覧は残す

#### 差の欄へ移る動き

- 「登録して振り直す」のあと、欠勤の欄が閉じて振り直した担当が出たら差の欄へスクロールし、差の欄にフォーカスする（列の見出しへいったんスクロールしない）
- 欠勤の欄を閉じたときは、戻り先を差の欄に差し替える（`SidePanel.returnFocus`。preventScroll でフォーカスし、差の欄へのスクロールだけにする）。戻り先が消えていたら、その人の列の見出しへ
- 差の欄へ移る予約は、日付を変えたとき・1.5秒経っても差の欄が出ないときに消す

#### 左下の帯（`ReassignDock`）

- 差の欄が画面の外にあるあいだ、画面の左下に小さな帯：「欠勤の振り直し（案A／案B）」・入らない N件・欠勤の人のまま N件・「少し動かしてよい案（案B）を作る」（勧めるとき）・「連絡の一覧」・「差の欄へ」
- 左のメニューの右から出し、地図の `MapDock`（右下）と重ならない幅にする（地図の位置は `--map-dock-left`）。1行に収め、入らなければボタンの文言を隠してアイコンだけにする（aria-label・title で読める。見出しは省略記号）
- 幅 1100px 以下では右下の地図（開いた地図・地図のボタン）の上に積む（`--map-dock-top`。列の見出しを覆わないよう上には出さない）。860px 以下は `max(12px + タブ, --map-dock-top + 8px)`
- 初めに出すかは差の欄の実際の位置で決める。トーストは帯・地図より上（`--reassign-dock-top`・`--map-dock-top`。`components/floating.ts`）。印刷では出さない

### 少し動かしてよい（案B。ADR-0011。PRD D34・D35）

#### `AnnealBox`（`pages/reassignParts.tsx`）

- 振り直しが案A で、入らない訪問があれば「おすすめ」
- 「変更を減らす」のスライダー（0〜5・0.5刻み・既定3。反映しているのが案B ならその重み）と「担当が変わる1件＝移動N分ぶん・時刻のずれ10分＝移動M分ぶん」。近くに「重みが大きいと案A のままになることがあります（変更の減点が、得より大きいとき）」。スライダーと説明は「詳しく：変更を減らす（3.0・既定）」（`anneal-more`。details。はじめ畳む・保存しない。PRD D265）に畳む
- 「案B を作る」：Worker（`runSolve`。問題は `prepareAnneal` の問題、`initial` は案A、種はデータの種、反復は `defaultIterations`）。進み具合（回数。progress 要素は `aria-label="案B の進み具合"`）と「止める」（それまでの最良）
- 押せないとき（欠勤が取り消されている・案A が無い・ほかの計算中）は理由を出す
- 日付を変えたら「案B も作る」の予約を消す
- 終わったら `settleAnneal` で確かめ、案A のままにしたときは理由を欄に出す（`anneal-note`）。案B として出せるときは画面の状態に置く（保存しない。訪問は変えない。日付・振り直しが変われば捨てる）
- 差の表（`anneal-table`。案A と案B を並べる）：点数（点数の基準）・入らない・担当が変わる訪問（うち欠勤の人以外）・時刻がずれる訪問・変わる人・移動。列ごとに「〈案〉を反映する」（反映している案の列は見出しに札「反映中」、ボタンは押せない「反映済み」）

#### 選ぶ（`lib/absences` の `chooseReassign`）

- 選んだ案の担当を `writeRoutes` で訪問に書きピンにする（手の名前「案A を反映する」「案B を反映する」）。`reassigns[date]` は振り直す前の担当を引き継ぎ `method`（案B なら `stayWeight`）だけ変える

### 連絡の一覧（`ContactPanel`。`pages/contactPanel.tsx`）

- 差の欄の「連絡の一覧（訪問N件）」で右から出る欄。N は連絡が要る訪問の数＝担当が変わる訪問＋時刻だけ変わる訪問、同じ訪問は1件（`lib/contacts` の `contactCount`）
- いちばん上に「欠勤の人に残っている訪問（N件）：対応が必要」（時刻・訪問先・担当・理由。連絡文には入れない）を出し、件数に足す（差を出せないときも、残る訪問があれば開ける）
- `contactsOf`（before＝振り直す前の担当、after＝今の担当。確定前でも見られる）から：
  1. 担当が変わる〈利用者さん〉（時刻・前の担当 → 新しい担当、入らないは「入らない（調整中）」）
  2. 時刻だけ変わる〈利用者さん〉（件数。〈利用者さん〉あての連絡文にも「開始が〜に変わります（担当は〜さんのままです）」として入る）
  3. 仕事が増える・減る〈スタッフ〉（増える・外れる・時刻が変わるの件数と、時刻・行き先（住所））
- 連絡文（〈スタッフ〉あて・N人／〈利用者さん〉あて・N件）：1件ずつ「コピー」、主ボタン「すべての連絡文をコピー」、「印刷」。〈スタッフ〉あての「コピー」の横に `MailButton`（`staffMail(staffId, text)`）
- 呼び方は `org.terms`（連絡文の敬称「様」「さん」は固定）。日付は `dateWordOf`（「10月21日（水）」。「本日」と書かない）、所要は訪問の `durationMinutes`、名乗りは `org.name`
- コピーは `lib/clipboard` の `copyText`：`navigator.clipboard`（使えなければ textarea を選んで `execCommand('copy')`）、結果をトースト
- 印刷（`@media print`）はこの欄だけを出す（`.contact-sheet`。帯 `.drawer-foot` は出さない）

#### `lib/contacts.ts`（純粋関数。テストあり）

ひな形と載せる範囲は PRD D245・D246（ADR-0038）。差の欄の連絡の一覧と5段目で同じ。

- `dateWordOf(date)`：「10月15日（木）」（連絡文は「本日」と書かない）。`clock`：「9:00」。`promisedText`：約束の開始（「9:00」「9:00〜9:30の間」）。`familyName`：空白の前（〈利用者さん〉あての担当の名前）
- `staffMessage(c, w, cancelled?)`（丁寧語の短文）：「〈名前〉さん／10月21日（水）の予定の変更です。／・14:00 天文台ほしみ様の訪問をお願いします（住所・60分）。／・10:00 青葉様の訪問は、佐藤 一郎さんに代わりました。伺わなくて大丈夫です。（入らないなら「、代わりの〈スタッフ〉を調整中です。」）／・11:00 青葉様の訪問は、開始が11:20に変わりました。／・8:30 若林様の訪問は、中止です（キャンセル）。伺わなくて大丈夫です。」。行は元の時刻の順。住所・所要は「お願いします」の行だけ
- `clientMessages`（訪問先ごと。敬語）：「〈表示名〉様／いつもお世話になっております。〈事業所名〉です。／10月21日（水）の訪問について、変更をお知らせいたします。／・14:00の訪問は、担当が佐藤に代わります。（時刻も変われば「代わり、開始は14:20ごろになります。」）／・14:50〜15:10の間の訪問は、開始が15:20ごろに変わります（担当は変わりません）。／・16:00の訪問は、担当の調整がついておりません。あらためてご連絡いたします。／ご迷惑をおかけして申し訳ございません。どうぞよろしくお願いいたします。」。どの訪問かは約束の開始（`promised`）で書く。前の担当・住所・代わる理由は書かない
- `allContactsText`
- `contactRows(list, cancelled, w)`：5段目の行（`ContactRow`＝鍵・宛先・ID・宛名・種類・文）。〈スタッフ〉（差の一覧の順、続けて中止だけの人）→〈利用者さん〉。取り消した訪問は差から除き、担当にだけ「中止」。担当の無い取り消しは行なし。今の時刻は見ず、過ぎた時刻の行も除かない。`CONTACT_KIND_LABEL`

### `lib/absences.ts`（画面の純粋関数。テストあり）

- `absencesOn(data, date)`
- `saveAbsence(d, absence)`：同じ人・同じ日の欠勤はその1件を置き換える
- `removeAbsence(d, id)`：今の担当は変えない
- `baseOf(data, date, problem)`：振り直しの元（その日の訪問の担当の並び `routesOf` と、問題にある訪問のピン）
- `applyReassign(d, date, x)`・`chooseReassign(d, date, x)`・`revertReassign(d, date, problem)`（振り直す前の担当・ピンへ戻し、あとで足した訪問は今の担当のまま。`reassigns[date]` を消す）

### 比較の画面での振り直し

- その日に振り直しの情報があれば、選べる案に「欠勤前（振り直す前の担当）」を足す（`reassigns[date].baseRoutes`。いまの問題で採点するので、欠勤の人の訪問は必須の違反として出る。`lib/compareChoices`）。今の担当（振り直したあと）と比べられる

### 勤務時間（シフト）の画面での欠勤

[pages-staff.md](pages-staff.md) の「勤務時間（シフト）」。

### 完了の条件

- [ ] 列の見出しの「この人の欠勤を登録」（または操作の行の「欠勤・キャンセルを登録」で人を選ぶ）→ 午前だけ → 次へ →「登録して振り直す（おすすめ）」（案A）で、その人の午前の訪問が他の人へ移り「代行」の印が付き、他の人の訪問の担当・順番・時刻は変わらず、まとめの件数が出る。変わらない人の列は薄い。地図で振り直した訪問へ来る区間が太い
- [ ] 振り直した訪問はピンで、担当を組むで組み直しても担当が変わらない。比較の画面で「欠勤前」と比べられる
- [ ] 2人を順に欠勤にして振り直すと、差の欄は最初の振り直す前の担当との差で、「振り直す前に戻す」で最初の担当に戻る
- [ ] 欠勤の欄を閉じたとき、フォーカスの戻り先が消えていたら、その人の列の見出しにフォーカスが移る
- [ ] 欠勤を取り消すと列の稼働時間帯は戻るが今の担当はそのまま。差の欄の「振り直す前に戻す」で振り直す前の担当・ピンに戻る
- [ ] 当日に終日の欠勤を登録しても、その日の訪問はすべて振り直す（playwright）
- [ ] 登録すると差の欄へ移りフォーカスする。差の欄が画面の外なら左下の帯が出て1行に収まり、地図の浮かせた表示・トーストと重ならない（1280px・1100px・390px。地図を開いた状態でも）。欠勤の人の列の見出しから差の欄・案B へ行ける
- [ ] 終日の欠勤で案A に入らない訪問が出る日に、案B の勧めが出る。主ボタン「登録して振り直す（おすすめ）」（案B も作る）→ 差の欄に進み具合 → 案A と案B の差の表 →「案B を反映する」で担当が案B になる（ピン）。「案A を反映する」で戻せる
- [ ] 「変更を減らす」を強めて作り直すと、担当が変わる訪問が減る（または同じ）
- [ ] 差の欄の「連絡の一覧」で (1)〜(3) と連絡文が出て、コピー（1件・すべて）でクリップボードに入る。印刷の見た目は一覧だけ
- [ ] 比較の画面で 欠勤前／案A／案B を選んで比べられる（欠勤前は1つ）
- [ ] 欠勤・キャンセルの欄で確定すると5段目（連絡）に、休む人・新しく入る人・〈利用者さん〉あての文と［文をコピー］・メール・［連絡した］が出る。キャンセルでは担当に「中止です」（390px で欄の中が横にはみ出さない）
- [ ] `lib/absences`（同じ人・同じ日の置き換え・振り直す前の担当・戻す・`chooseReassign`）・`lib/contacts`・`lib/clipboard`（失敗の経路）・`lib/sudden` のテストが通る
