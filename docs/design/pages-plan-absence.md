# 日の予定：欠勤・キャンセルと振り直し

> この画面のファイル：`src/pages/SuddenPanel.tsx`・`absenceParts.tsx`（`AbsenceFields`・`ReassignBar`・`ReassignResultBox`・`ReassignSummary`・`ReassignMoves`・`CandidateBox`）・`useSuddenSteps.ts`・`suddenSteps.tsx`・`suddenContactStep.tsx`・`reassignParts.tsx`（`AnnealBox`・`StayWeight`・`ContactButton`・`ReassignDock`）・`contactPanel.tsx`（`ContactPanel`）・`useReassignFlow.ts`・`useSuddenFlow.tsx`・`usePlanRun.ts`・`PlanPage.tsx`・`plan.css`、`src/lib/sudden.ts`・`absences.ts`・`planReassign.ts`・`contacts.ts`・`firstVisit.ts`・`clipboard.ts`、貼り付けは `src/components/PastePanel.tsx`・`usePasteNotices.ts`・`pastePanel.css`・`src/lib/pasteNotices.ts`・`pasteRows.ts`。関連 ADR：0011・0015・0036・0038・0044・0053・0054・0073・0082・0084。関連 PRD：D26〜D29・D31・D32・D34・D35・D167・D169〜D172・D238・D244〜D246・D264・D265・D296・D325・D329・D382・D414・D415・D418。
> 日の予定の全体は [pages-plan.md](pages-plan.md)。計算（`reassign`・`targetsOf`・`prepareAnneal`・`settleAnneal`）は design.md の「reassign」。
> 振り直しは `writeRoutes` で訪問に書き（今の担当になる）、振り直す前の担当は `reassigns[date]`。確定は2段目の「連絡したので確定」（伝えた内容 `snapshots`）。

### 「欠勤・キャンセル」の欄

急な欠勤（遅刻・早退を含む）と当日キャンセルを1つの欄の2段で扱う（1 休み・キャンセルを選ぶ → 2 連絡・確定。ADR-0082）。1段目で種類・人（訪問）・時間を選んだ時点で見込みとおすすめを出し、［この案で決める］で欠勤の登録と振り直しを1手で書く。

#### 入口

| 入口 | 開き方 |
|---|---|
| 操作の行の「欠勤・キャンセルを登録」（`sudden-open`。切は行に、入は「その他 ▾」の中） | 種類を選ばずに開く。主ボタンにしない（`.plan-sudden-btn` は印刷で隠すためだけ）。訪問も働く人もいない日は押せない。印刷では出さない |
| 列の見出しの「この人の欠勤を登録」「欠勤を直す」 | `useSuddenState` の `open({ kind: 'staff', staffId })`。〈スタッフ〉が休む・その人を選んで開く（その日の欠勤があれば入力はその値。開くたびに差の欄へ移る印 `toBar` を戻す） |
| `/plan?date=…&do=absence`（週・月の操作の行・パレット・月の要対応・勤務時間（シフト）の右の欄・〈スタッフ〉の画面） | 種類を選ばずに開く（`&staff=` の人がその日に働けばその人を選んで開く、知らない人・働かない人は選ばない）。`?do=`・`?date=`・`staff` を消す |

下のタブは変えない。メニューの項目に印を付けない。

#### `pages/SuddenPanel.tsx`

- `SuddenPanel`：`SidePanel` の narrow（見出し「欠勤・キャンセル」・`sudden-panel`・`data-step`＝`1|2`）。`init`＝`{ kind?, staffId? }`
- 段の状態と処理は `useSuddenSteps`（props の型 `SuddenPanelProps`・`SuddenInit` もここ。欠勤の入力と見込みは中の `useAbsenceInput`）、段ごとの中身と下の帯は `suddenSteps.tsx` の `whatStep`（1段目）と `suddenContactStep.tsx` の `contactStep`（2段目）（どちらも `{ body, footer }` を返す）
- 段・起きたこと・人・欠勤の入力・訪問・取り消しの種類・済んだこと・2段目の［連絡した］の印は欄の中の状態（［連絡した］はデータに残さない）
- 段の表示は無い。段の見出し（`h3.sudden-step-title`・`data-return-focus`。1段目「休み・キャンセルを選ぶ」・2段目「変更を伝えて確定する」＝`SUDDEN_HEADINGS`）へ `focusKey`（段）でフォーカス
- 1段目は `onSubmit` を渡して form にする（欠勤のメモの Enter で主ボタンと同じ：［この案で決める］、担当のある訪問が無い日は［欠勤だけ登録］。`lib/sudden` の `suddenPrimary`。PRD D251）。種類を選んでも form のまま（form と div を切り替えると中身が作り直され、押したボタンのフォーカスが消える）
- 閉じる（`sudden-close`。1段目の帯）。Esc で閉じると入口へフォーカス。`onClose(toBar)`：振り直したあと Esc で閉じれば差の欄へ（`returnFocus` と `goToBar`）。「あとで確定する」「連絡したので確定」は差の欄へ移らない。戻る段は無い（決めたあとは「振り直す前に戻す」）
- 振り直し・欠勤だけ登録・欠勤の取り消し・取り消し・確定・振り直す前に戻すは日の予定の関数を呼ぶだけ。2段目の振り直しの結果（`ReassignResultBox`＝`ReassignSummary`・`ReassignMoves`・`AnnealBox`）は `result`、連絡の一覧は `contacts`（`ContactRow[]`。差を出せなければ null）、〈スタッフ〉あてのメールは `contactMail`（メールが切なら渡さない）、案B の「変更を減らす」は `weight`・`onWeight`（差の欄の案B と同じ値）で受ける
- エキスパート機能が切なら確定の段階を出さない：2段目の「連絡したので確定」「あとで確定する」と確定の状態の文は出さず（`confirmNote` の `confirmStep`。変更ありのときだけ「連絡の一覧で『連絡した』を押す」案内）、帯は「終わる」だけ。振り直しは store の `update` が自動で伝えた記録を付ける／伝えた日なら「変更あり」になる
- 決める・確定のボタンは欄の下の帯（`footer`）。600px 以下は幅いっぱい、2段目の表は欄の中で横に巻く
- `plan.css`：`.plan-sudden-btn`（入口）・`.sudden-kind`（種類の選び。390px ではアイコンを隠して名前を1行に）・`.sudden-alt`（ほかのやり方）・`.sudden-result-box`（2段目の振り直しの結果）・`.sudden-contacts`・`.sudden-contact`（2段目の1人1枚）

#### 段

| 段 | 〈スタッフ〉が休む（kind `staff`） | 〈利用者さん〉のキャンセル（kind `client`） |
|---|---|---|
| 1 見出し「休み・キャンセルを選ぶ」 | 種類（`sudden-kind-staff`・`sudden-kind-client`。`fieldset.segmented.sudden-kind`・`aria-pressed`。変えたら前の選択を消す）→ 人（`sudden-staff`）→ その日の欠勤があれば「この日の欠勤：欠勤（終日）（メモ）」と「欠勤を取り消す」（`sudden-existing`・`sudden-remove`）→ 時間（`AbsenceFields`）→ 見込み（下の「1段目の見込みとボタン」）。帯は［この案で決める］（`sudden-decide`。主ボタン）・閉じる。人を選ぶまで決めるボタンは出さない。時間の誤りは理由を出して見込みもボタンも出さない | 種類 → 訪問（`sudden-visit`）と当日キャンセルか（`sudden-same-day`。既定は当日キャンセル）→ 訪問を選ぶと `cancelImpact` の文（`sudden-cancel-impact`）。帯は「当日キャンセルとして取り消す」／「取り消す」（`sudden-cancel-ok`。訪問を選ぶまで押せない）・閉じる |
| 2 見出し「変更を伝えて確定する」 | 済んだこと（`sudden-done`「〈欠勤〉を登録して振り直しました」）・「振り直す前に戻す」（`sudden-revert`）・「日の予定で差を見る」（`sudden-to-bar`）・振り直しの結果（`sudden-result-box`。はじめ畳み、案B も作るときは開く）・連絡の一覧（「2段目の連絡」）・確定の状態の文（`sudden-confirm-note`）。帯は「連絡したので確定」（`sudden-adopt`。主ボタン。独自の確認のあと `tellDay` で伝えた内容を書き、欄を閉じる）と「あとで確定する」（`sudden-finish`。確定済みなら主ボタン「終わる」だけ） | 済んだこと（「〈利用者さん〉 時刻 を当日キャンセルとして取り消しました」）と連絡の一覧。取り消した訪問の担当に「中止」と、取り消したときの伝えた内容との差から |

#### 1段目の欠勤の入力（`AbsenceFields`）

- 時間の選び方（`absence-time`。`fieldset.segmented`）：終日／午前だけ（始業〜12:00）／午後だけ（12:00〜終業）／時間帯（`ABSENCE_TIMES`・`absenceTimeOf`・`draftOfTime`）。時間帯は開始・終了（30分刻み。空＝始業から・終業まで）と早道「〇時から（早退）」「〇時まで（遅刻）」。「時間帯」を押したかは部品の中の状態（午前だけと同じ値でも時間帯の欄を出したまま）なので、呼ぶ側は `key` に人を入れて人を替えたら作り直す
- メモ（100字まで）。「いまの時刻」の入力は無い（当日に終日の欠勤を登録しても、その日の訪問はすべて振り直す）
- 人の選択肢は `staffChoices`（その日にもともと働く人。「名前（稼働時間帯・訪問 N件・欠勤）」）
- 終了 ≤ 開始・開始も終了も無いときは理由を出す（`draftError`）

#### 1段目の見込みとボタン（PRD D264・D265・D414）

- 見込みは `lib/planReassign` の `absencePreviewOf(data, date, absence)`（人と時間を選んだ時点で計算。メモは key に入れない。`attempt` で包む）：振り直す訪問（`targetsOf`）・元の案の有無・案A（`reassign`）で入らない件数・案A の差（`reassignDiff`）。読み上げは前から置いておく小さな欄（`sudden-live`。`.sr-only`・`aria-live="polite"`）に見込みの1行（`lib/sudden` の `previewLine`）だけを出す（ボタン・「ほかのやり方」を含む中身 `absence-preview` は読み上げの欄にしない）。［この案で決める］の計算中（`busy`・`running`）は種類・人・訪問の選択・欠勤の時間とメモ（`AbsenceFields` の `fieldset disabled`）を押せない
- `impactText(targets).title`：「入らなくなる訪問 N件」（`sudden-impact`）。無ければ「入らなくなる訪問はありません」
- おすすめの1行（`sudden-recommend`。振り直す訪問があるとき）：案A で入らない見込みがあれば（`recommendAnneal({ hasBase, unplacedA })`）「おすすめ：案A では N件入りません。決めたあと、ほかの人の訪問も少し動かす案B を作って比べます」、無ければ「おすすめ：空き時間に入れます（案A。ほかの人の担当・順番・時刻は変えません）」
- 担当が移る訪問の一覧（`ReassignMoves`。案A の差。入らない訪問は赤い縁）
- 「ほかのやり方」（`details.sudden-alt`。はじめ畳む）：もう一方の案（「案A だけで振り直す」`sudden-reassign`／「案B も作る」`sudden-anneal`）と「欠勤だけ登録（振り直さない）」（`sudden-save-only`。計算中は押せない）は `.btn-text`、案B の「変更を減らす」（`StayWeight`。差の欄の案B と同じ部品・同じ値）
- 帯の主ボタン［この案で決める］（`sudden-decide`）：勧めるときは案A を書いて続けて案B を作り始め（2段目の振り直しの結果を開いておく）、勧めないときは案A。欠勤の登録（「欠勤を登録」）と振り直し（「欠勤の振り直し」）は別の手で、全体の「元に戻す」1回で振り直す前、もう1回で欠勤も戻る
- 振り直しの元が無い（`hasBase` が false：担当のある訪問が無い日・見込みを出せない）ときは見込みの代わりに `noPlanText(running)`（`sudden-no-plan`。計算中は「担当を組んでいます。終わると振り直せます」）を出し、主ボタンを「欠勤だけ登録（振り直さない）」にする
- 押せない理由（`reassignBlocked({ error, running, hasPreview, hasBase })`。見込みの下に「押せません：…」）：「計算中は押せません（終わるまで待ってください）」・「見込みを出せませんでした」・「この日はまだ担当のある訪問がありません。欠勤だけ登録できます」

#### 2段目の連絡

- 1人に1枚（`sudden-contacts` の `sudden-contact`。`data-to`＝`staff|client`・`data-kinds`）：宛名・種類の印（担当が外れる・新しく入る（`chip-move`）・時刻が変わる（`chip-warn`）・中止、〈利用者さん〉は「〈利用者さん〉あて」）・初めての訪問先の印「初めて」（`sudden-contact-first`。`ContactRow.first`）・連絡文（`sudden-contact-text`）・［文をコピー］（`sudden-contact-copy`。`copyText` とトースト）・〈スタッフ〉あての「メール」（`MailButton`・`MailLengthNote`。`sudden-contact-mail`。件名は `contactMailText`）・［連絡した］（`sudden-contact-sent`。印の鍵は宛先と文なので、文が変われば消える）
- 初めての訪問先（PRD D415）：新しく入る〈スタッフ〉がその〈利用者さん〉を過去8週（前日まで）に担当していなければ、「お願いします」の行の末に「初めての訪問先です。」、下の行に決まりごと（「　入り方：…」「　鍵：…」「　駐車場：…」「　注意：…」。入っている項目だけ。訪問先の決まりごとの機能が切なら印だけ）。判定は `lib/firstVisit` の `servedPairsBefore(data, date)`（`visitsIn` の取り消していない担当のある回）と `isFirstVisit`、行は `visitRuleLines`。`usePlanPage` が `served` を作り、欄の連絡にだけ `withFirstNotes(dayContactWords(…), { served, clientById, notesOn })`（`firstNotes` は `lib/firstVisit` の `firstVisitNotes`）を渡す。日の予定の連絡の一覧・すべての連絡文のコピー・メールは `dayContactWords` のままで決まりごとを添えない。項目と名前の並びは `lib/visitRules` の `VISIT_RULES`（`components/VisitRules`・`lib/mail` も同じ）
- 上に説明（欠勤とキャンセルで分ける）と、欠勤の人に残る訪問があれば「欠勤の人に残る訪問 N件（連絡文には入りません。日の予定で確かめてください）」（`sudden-contacts-left`。`leftCount`）、「連絡した N/M人」（`sudden-contacts-count`。`aria-live`）。行が無ければ「連絡が要る変更はありません。」、差を出せなければ「日の予定の「連絡の一覧」で確かめてください」（`sudden-contacts-none`）
- 帯は「連絡したので確定」（`sudden-adopt`。塗り）・「あとで確定する」（`sudden-finish`。枠。確定済みなら「終わる」が主ボタン）。行の［文をコピー］・メールは枠の小さなボタン、［連絡した］はチェック
- 日の予定（`PlanPage`）が作る：
  - 伝えた日：伝えた内容 → 今の担当の差（`toldChanges`。手で変えた訪問も）。欄で取り消した訪問は差から外す（`withoutVisit`）
  - 伝えていない日の欠勤：差の欄と同じ `contacts`（`contactsOf`。振り直す前の担当 → 今の担当）
  - 伝えていない日のキャンセル：欄の取り消し（`useSuddenFlow` の `onCancelVisit`）が、取り消す前の担当・開始（今の並びの時刻、無ければ約束の開始）と、取り消す訪問を除いた並びを覚えてから `applyCancel`。差は `contactsOf(取り消す前の並び, 今の並び)`
  - 行は `contactRows(差, 取り消した訪問, contactWords)`。欄を開き直すと覚えた取り消しを消す

#### 日の予定の関数（まとめは `pages/usePlanPage.ts`）

- 欄の状態は `useSuddenState(date)`（`sudden`・`open(init)`・欄で取り消した訪問）、`?do=absence` の入口は `useSuddenEntry`、欄に渡すもの（選択肢・2段目の連絡・欠勤だけ登録・欠勤の取り消し・欄からの取り消し・閉じる）は `useSuddenFlow`
- 振り直しは `useReassignFlow`：差・印・欠勤の人に残る訪問・案A／案B（`useAnneal`）・比べる数（`useReassignOptions`）・差の欄へ移る（`useBarFocus`）。計算（Worker）は `usePlanRun`
- `registerAndReassign(absence, anneal, stay)`：欄から（`stay`）は欄を閉じず差の欄へも移らず、振り直せたかを返す。手順は `lib/planReassign.ts` の `planReassign(data, date, absence)`（欠勤を足して compile・元の案・`targetsOf`・`reassign`。見込みの `absencePreviewOf` も前半 `absenceBaseOf` と同じ後半の手順）
- `adopt`（確定。`usePlanEdits`）・`revertToBase`・欠勤の取り消し（`onRemoveAbsence`）：済んだか（確認で取り消したら false）を返す
- 訪問の取り消しは `applyCancel(visitId, sameDay)`（一覧の取り消しと共通）

#### `lib/sudden.ts`（純粋関数。テストあり）

- `SUDDEN_DO`（`'absence'`）・`SuddenKind`（`'staff' | 'client'`）・`SuddenStep`（`1 | 2`）・`SUDDEN_HEADINGS`
- `ABSENCE_TIMES`・`absenceTimeOf(draft)`・`draftOfTime(draft, time)`（終日／午前だけ／午後だけ／時間帯）
- `noPlanText(running)`・`recommendAnneal({ hasBase, unplacedA })`
- `draftOf(existing)`・`absenceOfDraft(draft, staffId, date, existing)`・`draftError(draft)`
- `staffChoices(staff, slotsOf, visitCount)`・`visitChoices(visits, clientName, window, ownerName)`（時刻の順。「9:00〜10:00 名前（担当：担当の名前さん／担当なし）」）
- `impactText(targets)`・`reassignBlocked(...)`・`reassignMoveRows(diff, visitLabel)`
- `cancelImpact({ owner, sameDay, clientWord, hasPlan })`：担当がいれば「担当の〈名前〉さんの予定からこの訪問が外れ、その時間が空きます。ほかの訪問の担当・順番・時刻は変えません」、いなければ「この訪問はまだ担当が決まっていません。ほかの訪問は変わりません」。当日キャンセルは「月の予定と〈利用者さん〉ごとの月の集計に回数が出ます（請求はしません）」、ふつうは「ふつうの取り消しは回数に数えません」
- `confirmNote(state)`：told「今の担当は伝えた内容と同じです（確定済み）」・changed「伝えたあとに変わった訪問があります（未連絡の変更）。連絡してから「確定」を押してください」・none「まだ確定していません。連絡したら「確定」を押してください」
- `absenceSummary(name, absence, slots)`

#### 確かめ

`scripts/e2e-absence.cjs`：入口から1段目が開き `?do=`・`?date=` が消える・見出し「休み・キャンセルを選ぶ」と段の表示が無いこと・種類を選んでもフォーカスが残る・人を選ぶまで決めるボタンが出ない・時間帯の誤り・午前だけですぐ見込み・同じ段に見込み（入らなくなる訪問 N件・担当が移る訪問の一覧）・主ボタンは［この案で決める］の1つ・「ほかのやり方」ははじめ畳みで文字のボタンと「変更を減らす」・案A で決めて2段目（振り直しの結果・「変更を減らす」は「詳しく」に畳む）・案B を作って選ぶ・連絡（休む人あて・新しく入る人あて・初めての訪問先の印と文・〈利用者さん〉あては敬語でほかの人の名前なし・メールは mailto:・［連絡した］で「連絡した 1/N人」・［文をコピー］の知らせ）→「連絡したので確定」で確定済み・決めて Esc で差の欄へ・開き直して欠勤だけ登録・種類を変えると選択を消す・当日キャンセル（既定・影響の文・2段目で担当に「中止です」）・Esc で入口へフォーカス・「欠勤を直す」で人を選んで開き「この日の欠勤：…」から取り消す・担当のある訪問が無い日は欠勤だけが主ボタン・案A で入らない日のおすすめは案B・390px で入口・種類・欄・一覧・2段目が収まる・印刷で入口を出さない・「元に戻す」で振り直し → 欠勤の順に戻る・別の日の振り直しのあとの「振り直す前に戻す」。

### 「連絡を貼り付けて入れる」の欄（PRD D418。ADR-0084）

届いた連絡（LINE WORKS などの文）を貼り、欠勤・訪問の取り消し・〈利用者さん〉の休みをまとめて入れる。読むのは決まりだけ（AI・OCR は使わない。外へ送らない）。振り直さない（PRD §4）。

- 入口：予定（月・週・日）の「その他 ▾」の最後の項目「連絡を貼り付けて入れる」（`paste-open`。入切とも。`components/toolbarRow` の `ToolbarRow` が `PastePanel` を開く）。機能 `sudden` と `clientLeave` がどちらも切なら出さない（D213）。下のタブ・メニューは変えない
- `components/PastePanel.tsx`：`SidePanel`（見出し「連絡を貼り付けて入れる」・`paste-panel`。スマホは下から出る）。テキストの欄（`paste-text`。開くとここへフォーカス）・1行の説明（〈スタッフ〉・〈利用者さん〉の呼び方で言葉の例）・件数（`paste-count`「読めた N行・読めない M行」。`aria-live`）・一覧（`paste-rows`。行 `paste-row`・`data-state`＝`ok|ng`）。読めた行はチェック（`paste-row-check`。初めは入）と読んだ内容（「11/6（金）市役所 まち子 欠勤 〜12:00」）、読めない行は内容（名前・日付まで読めた行は読んだ内容、ほかは元の行）と理由（`paste-row-reason`）。帯は主ボタン［N件を入れる］（`paste-apply`。0件は `aria-disabled`）と［やめる］（`paste-close`）。Esc・閉じると「その他 ▾」へ戻る
- `components/usePasteNotices.ts`：入力のたびに 250ms 待って読み直す（`PASTE_READ_DELAY_MS`）。外したチェックは行の文と同じ文の何回目かで覚える（`lib/pasteRows` の `pasteRowKeys`。上に行を足しても外したチェックが戻らない）。［N件を入れる］は待ちの間でも今の文で読み直し、`applyPasteRows` を1回の `update`（手の名前「連絡を貼り付けて入れる」。元に戻せる）。知らせ `pasteDoneText`「N件を入れました。要対応 M件」（［元に戻す］付き）で欄を閉じる
- `lib/pasteNotices.ts`（読み。純粋関数・テストあり）：`noticePeople`（利用中の〈スタッフ〉・〈利用者さん〉の 名前・姓・よみ・よみの姓を `noticeForm` の形で。`noticeForm`＝`lib/search` の `normalizeKana` を空白で区切った語ごとに当て、空白は1つ残す。名前を探す文も同じ形にし、境目をまたいで別の名前に当てない（「上田 中止」の中の「田中」））・`readNotices`／`readNotice`（1行ずつ。空の行は飛ばす）・`resolveDate`（年が無ければ base の `PAST_WINDOW_DAYS`＝60日前以降でいちばん早い日（その幅の過去は過ぎた日のまま。今日 11/2 の「11/1」は過ぎた日）、日だけなら今月（過ぎていれば過ぎた日）かその日のある次の月。期間の終わりは始まりの日を base に）・`absenceSpan`／`timeOf`（時刻〜時刻（区切りは 〜・-・から・より。「15時から17時まで」）・〇時から・〇時まで・午前＝〜12:00・午後＝12:00〜。午後3時は15:00）・`findPerson`（鍵の中の空白は有無を問わない。かなだけの2文字以下の鍵（よみの姓など）は前後が区切り・漢字・行の端（あとは さん・さま も可）のときだけ（「お願いします」の中の「いし」に当てない）。いちばん長く当たった名前。長い名前の中の短い名前は捨てる。同じ文字が2人＝同じ名前が2人、別の名前が2つ＝名前が2つある）。言葉：〈スタッフ〉＋休・欠勤＝欠勤（希望休は終日・メモ「希望休」）、〈利用者さん〉＋入院・ショート＝休み（日付2つか「〜日付」「日付まで」。メモ「入院」「ショートステイ」。終わりが始まりより前か `LEAVE_MAX_DAYS`＝93日（両端を含む）を超えれば 期間が長すぎる・向きが逆。年またぎ 12/30〜1/2 は通す）、＋中止・キャンセル・休＝その日の取り消し。「出勤」を含む行（「午後から出勤」）は意味が逆なので読まない。読めない理由 `READ_REASONS`（日付が無い・日付が読めない・日付が2つある・終わりの日が無い・名前が見つからない・同じ名前が2人・名前が2つある・休み・中止などの言葉が無い・時刻が読めない・過ぎた日・期間が長すぎる・向きが逆・出勤の時刻は読めません（休む時間帯で書く））
- `lib/pasteRows.ts`（照らし合わせと書き込み。純粋関数・テストあり）：`pasteRows(data, text, today)`＝読む → `pasteRowsOf`。理由 `ROW_REASONS`：欠勤は `requestedOff` の `offDayState`（勤務の無い日・すでに入っている）と `absenceError`（時刻は30分単位）、取り消しは `activeDayVisits` のその〈利用者さん〉の訪問（無ければ、取り消し済み・休みの訪問があれば すでに入っている、無ければ その日に訪問が無い）、休みは同じ〈利用者さん〉の重なる休み（すでに入っている）、同じ人・同じ日（休みは同じ期間）の2行目は「上の行と同じ」、上の行で受け入れた休みと期間が重なる同じ〈利用者さん〉の休みは「上の行と重なる」。一覧の文（`actionText`）は今日と年が違う日に年を付ける（`lib/dateText` の `dateTextFrom`「2027/1/5（火）」）。機能 `sudden` が切なら欠勤・取り消しの行は「欠勤・キャンセルの機能が切」、`clientLeave` が切なら休みの行は「〈利用者さん〉の休みの機能が切」（`leaveOffReason`）。`applyPasteRows`＝欠勤 `saveAbsence`・取り消し `cancelVisitOp`（その日の訪問すべて。今日なら当日キャンセル。繰り返しの回は「この回だけ」）・休み `saveLeave`。`pasteCareCount`＝欠勤・取り消しの日（今日以降）の要対応の帯と同じ種類（`visitBandKind`）の訪問の数（その日の要対応の合計）

### 振り直し（案A）

#### 登録して振り直す（［この案で決める］）

- 欠勤を足したデータで compile した問題、振り直しの元（`lib/absences` の `baseOf`：その日の担当の並びとピン）、`targetsOf`（`base.problem` はその日の欠勤を除いたデータで compile した問題）→ `reassign`（`planReassign`）
- `applyReassign(d, date, { problem, result, base, absenceIds })`：`writeRoutes` で訪問に書き（振り直した訪問と動かしていない担当のある訪問はピン）、`reassigns[date]` に振り直す前の担当（`baseRoutes`・`basePins`）・案A の結果（`insertRoutes`）・使った欠勤（`absenceIds`）を残す。続けて振り直すときは振り直す前の担当は最初のものを引き継ぎ、`absenceIds` は累積。欠勤の保存とは別の手（「欠勤を登録」「欠勤の振り直し」）
- 担当のある訪問が無い日は振り直せない（欠勤だけは登録できる）。計算中は押せない
- 振り直した訪問はピンなので、担当を組むで組み直しても担当が変わらない

#### 欠勤の取り消し

- `removeAbsence`：今の担当は変えない（列の稼働時間帯は戻る）。差の欄の「振り直す前に戻す」で振り直す前の担当・ピンに戻る
- 振り直しに使った欠勤が取り消されていたら差の欄にその旨と「振り直す前に戻す」

#### 列とカードの印

- 差の欄があるとき、変わらない人の列は薄く（押せる。文字のコントラストは保ち、背景・枠線・見出しの印だけを薄く。透明度は使わない）
- 振り直した訪問のカードに「代行」の印（元の担当の名前を title・読み上げに）、開始が変わった訪問に「+N分」（早まったら「−N分」）
- 地図は振り直した訪問へ来る区間を太くする
- 欠勤の人に残る訪問に「欠勤と重なる：振り直していない（対応が必要）」などの赤い印（理由は `leftOf` の reason。`leftOf` は欠勤のせいの訪問（absence・unreachable）だけで、元からの違反（notAllowed）は含めない＝必須の違反の赤い枠で出る）
- 欠勤の人の列の見出しの下に近道：「振り直し済み・入らない（全体） N件」（差の欄へ）・「欠勤の人のまま N件」（あれば）・「案B を作る」（案A で入らない訪問があり案B をまだ作っていないとき。作り始めて差の欄へ）
- 帯（`band-reassign`）：「欠勤の振り直し：入らない N件・欠勤の人のまま N件」と「差の欄へ」

### 差の欄（`ReassignBar`）

その日に `reassigns[date]` があるとき、本体のすぐ上。`tabIndex=-1`・見出しで名前づけ。

#### 中身

- 見出し「（案A：空き時間に入れた案）／（案B：少し動かした案）」。案B なら注記「ほかの人の訪問も少し動かしています」
- まとめ（`ReassignSummary`。欄の2段目でも使う）：「変わる人 N人・振り直し N件・入らない N件・（あれば）欠勤の人のまま N件・移動 +N分」
- 担当が移る訪問（`ReassignMoves`。欄の1段目の見込み・2段目の振り直しの結果と、差の欄の畳んだ「担当が変わった訪問を見る（N件）」（`reassign-bar-moves`。1件以上のとき。案を比べるが切でも出す））：`reassignMoveRows(diff, visitLabel)` で `moved` と `unplaced` を1訪問1行・訪問の文の順に（`visitLabel`＝受けられる時間帯の初め（`earliestStart`）と名前。振り直したあとの開始時刻ではない）。行は「10:00 〈利用者さん〉」と「〇〇さん → △△さん」（読み上げは「から」）、入らない訪問は「入らない（〇〇さんから外れる）」（赤い縁）。無ければ「担当が変わる訪問はありません」。`reassign-moves`・`reassign-move`（`data-to`）
- 入らない訪問の理由：「入らない訪問（N件）：ほかの人の空き時間に入らない」と一覧・案B か「受けられる人」へ
- 欠勤の人に残る訪問（`leftOf`。今の担当に targetsOf を当てたもの）の理由（`leftReasonText`）と「対応が必要」・「もう一度振り直す」。〈利用者さん〉の名前は `PersonButton`（`visitNode`。`left-client`）
- 「振り直す前に戻す」：欠勤の登録（「欠勤を登録」）と振り直し（「欠勤の振り直し」）は別の手。直前の手が振り直し（「案A を反映する」「案B を反映する」も）なら全体の「元に戻す」で1手戻す（欠勤は残る。確認なし）。あとにほかの操作をしていたら、確認を出して `revertReassign`（routes・pins を `baseRoutes`・`basePins` に戻し、あとで足した訪問は今のまま。手の名前「振り直す前に戻す」。元に戻せる）
- 「比較の画面で見る」（A＝欠勤前、B＝今の担当。案を比べるが切なら出さない）
- 「連絡の一覧（訪問N件）」（`ContactButton`）
- 少し動かしてよい（案B）の欄（`AnnealBox`）
- 差は `reassignDiff`（before＝振り直す前の担当を、振り直しに使った欠勤を除いたデータで compile した問題で、after＝今の担当をいまの問題で）

#### 残り方・消え方

- 手直し・提案の反映をしても差の欄は残る（振り直す前の担当との差を出し直す）。2人を順に欠勤にして振り直すと、差は最初の振り直す前の担当との差。「振り直す前に戻す」で消える
- 機能を切っても、振り直した案の差の欄・帯・連絡の一覧は残す

#### 差の欄へ移る動き

- 欄の外から振り直したあと（差の欄の「もう一度振り直す」など）、振り直した担当が出たら差の欄へ巻き、フォーカスする（列の見出しへいったん巻かない）
- 欄を閉じたときは戻り先を差の欄に差し替える（`SidePanel.returnFocus`。preventScroll でフォーカスし、差の欄への巻きだけ）。戻り先が消えていたら、その人の列の見出しへ
- 差の欄へ移る予約は、日付を変えたとき・1.5秒経っても差の欄が出ないときに消す

#### 左下の帯（`ReassignDock`）

- 差の欄が画面の外にあるあいだ左下に小さな帯：「欠勤の振り直し（案A／案B）」・入らない N件・欠勤の人のまま N件・「少し動かしてよい案（案B）を作る」（勧めるとき）・「連絡の一覧」・「差の欄へ」
- 左のメニューの右から出し、`MapDock`（右下）と重ならない幅（`--map-dock-left`）。1行に収め、入らなければボタンの文言を隠してアイコンだけ（aria-label・title で読める。見出しは省略記号）
- 1100px 以下は右下の地図の上に積む（`--map-dock-top`）。860px 以下は `max(12px + タブ, --map-dock-top + 8px)`
- 出すかは差の欄の実際の位置で決める。トーストは帯・地図より上（`--reassign-dock-top`・`--map-dock-top`。`components/floating.ts`）。印刷では出さない

### 少し動かしてよい（案B）

#### `AnnealBox`（`pages/reassignParts.tsx`）

- 振り直しが案A で入らない訪問があれば「おすすめ」
- 「変更を減らす」のスライダー（0〜5・0.5刻み・既定3。反映しているのが案B ならその重み）と「担当が変わる1件＝移動N分ぶん・時刻のずれ10分＝移動M分ぶん」「重みが大きいと案A のままになることがあります（変更の減点が、得より大きいとき）」。これらは「詳しく：変更を減らす（3.0・既定）」（`anneal-more`。details。はじめ畳む・保存しない）
- 「案B を作る」：Worker（`runSolve`。問題は `prepareAnneal`、`initial` は案A、種はデータの種、反復は `defaultIterations`）。進み具合（progress 要素は `aria-label="案B の進み具合"`）と「止める」（それまでの最良）
- 押せないとき（欠勤が取り消されている・案A が無い・ほかの計算中）は理由
- 日付を変えたら「案B も作る」の予約を消す
- 終わったら `settleAnneal` で確かめ、案A のままにしたときは理由（`anneal-note`）。案B として出せるときは画面の状態に置く（保存しない。日付・振り直しが変われば捨てる）
- 差の表（`anneal-table`。案A と案B）：点数（点数の基準）・入らない・担当が変わる訪問（うち欠勤の人以外）・時刻がずれる訪問・変わる人・移動。列ごとに「〈案〉を反映する」（反映している案の列は札「反映中」、ボタンは押せない「反映済み」）

#### 選ぶ（`lib/absences` の `chooseReassign`）

- 選んだ案を `writeRoutes` で書きピンに（手の名前「案A を反映する」「案B を反映する」）。`reassigns[date]` は振り直す前の担当を引き継ぎ `method`（案B なら `stayWeight`）だけ変える

### 連絡の一覧（`ContactPanel`。`pages/contactPanel.tsx`）

- 差の欄の「連絡の一覧（訪問N件）」で右から出る欄。N は担当が変わる訪問＋時刻だけ変わる訪問（同じ訪問は1件。`lib/contacts` の `contactCount`）
- いちばん上に「欠勤の人に残っている訪問（N件）：対応が必要」（時刻・訪問先・担当・理由。連絡文には入れない）を出し、件数に足す（差を出せないときも、残る訪問があれば開ける）
- `contactsOf`（before＝振り直す前、after＝今。確定前でも見られる）から：
  1. 担当が変わる〈利用者さん〉（時刻・前の担当 → 新しい担当、入らないは「入らない（調整中）」）
  2. 時刻だけ変わる〈利用者さん〉（〈利用者さん〉あての文にも「開始が〜に変わります（担当は〜さんのままです）」）
  3. 仕事が増える・減る〈スタッフ〉（増える・外れる・時刻が変わるの件数と、時刻・行き先（住所））
- 連絡文（〈スタッフ〉あて・N人／〈利用者さん〉あて・N件）：1件ずつ「コピー」、主ボタン「すべての連絡文をコピー」、「印刷」。〈スタッフ〉あての「コピー」の横に `MailButton`（`staffMail(staffId, text)`）
- 呼び方は `org.terms`（敬称「様」「さん」は固定）。日付は `dateWordOf`、所要は `durationMinutes`、名乗りは `org.name`
- コピーは `lib/clipboard` の `copyText`：`navigator.clipboard`（使えなければ textarea を選んで `execCommand('copy')`）、結果をトースト
- 印刷（`@media print`）はこの欄だけ（`.contact-sheet`。`.drawer-foot` は出さない）

#### `lib/contacts.ts`（純粋関数。テストあり）

差の欄の連絡の一覧と欄の2段目で同じ。

- `dateWordOf(date)`：「10月15日（木）」（「本日」と書かない）。`clock`：「9:00」。`promisedText`：約束の開始（「9:00」「9:00〜9:30の間」）。`familyName`：空白の前
- `staffMessage(c, w, cancelled?)`（丁寧語）：「〈名前〉さん／10月21日（水）の予定の変更です。／・14:00 天文台ほしみ様の訪問をお願いします（住所・60分）。／・10:00 青葉様の訪問は、佐藤 一郎さんに代わりました。伺わなくて大丈夫です。（入らないなら「、代わりの〈スタッフ〉を調整中です。」）／・11:00 青葉様の訪問は、開始が11:20に変わりました。／・8:30 若林様の訪問は、中止です（キャンセル）。伺わなくて大丈夫です。」。行は元の時刻の順。住所・所要は「お願いします」の行だけ
- `clientMessages`（訪問先ごと。敬語）：「〈表示名〉様／いつもお世話になっております。〈事業所名〉です。／10月21日（水）の訪問について、変更をお知らせいたします。／・14:00の訪問は、担当が佐藤に代わります。（時刻も変われば「代わり、開始は14:20ごろになります。」）／・14:50〜15:10の間の訪問は、開始が15:20ごろに変わります（担当は変わりません）。／・16:00の訪問は、担当の調整がついておりません。あらためてご連絡いたします。／ご迷惑をおかけして申し訳ございません。どうぞよろしくお願いいたします。」。どの訪問かは約束の開始（`promised`）。前の担当・住所・代わる理由は書かない
- `allContactsText`
- `contactRows(list, cancelled, w)`：欄の2段目の行（`ContactRow`＝鍵・宛先・ID・宛名・種類・文・初めての印 `first`）。〈スタッフ〉（差の一覧の順、続けて中止だけの人）→〈利用者さん〉。取り消した訪問は差から除き、担当にだけ「中止」。担当の無い取り消しは行なし。今の時刻は見ず、過ぎた時刻の行も除かない。`CONTACT_KIND_LABEL`

### `lib/absences.ts`（純粋関数。テストあり）

- `absencesOn(data, date)`
- `saveAbsence(d, absence)`：同じ人・同じ日の欠勤はその1件を置き換える
- `removeAbsence(d, id)`：今の担当は変えない
- `baseOf(data, date, problem)`：振り直しの元（`routesOf` と、問題にある訪問のピン）
- `applyReassign`・`chooseReassign`・`revertReassign(d, date, problem)`（振り直す前の担当・ピンへ戻し、あとで足した訪問は今のまま。`reassigns[date]` を消す）

### 比較の画面での振り直し

- 振り直しの情報があれば、選べる案に「欠勤前」を足す（`reassigns[date].baseRoutes`。いまの問題で採点するので、欠勤の人の訪問は必須の違反として出る。`lib/compareChoices`）

勤務時間（シフト）の画面での欠勤は [pages-staff.md](pages-staff.md) の「勤務時間（シフト）」。

### 完了の条件

- [ ] 「この人の欠勤を登録」（または操作の行から人を選ぶ）→ 午前だけ → 同じ段に見込みと担当が移る訪問 →［この案で決める］（案A）で、その人の午前の訪問が他の人へ移り「代行」の印、他の人の訪問の担当・順番・時刻は変わらず、まとめの件数が出る。変わらない人の列は薄い。地図で振り直した訪問へ来る区間が太い
- [ ] 振り直した訪問はピンで、担当を組むで組み直しても変わらない。比較の画面で「欠勤前」と比べられる
- [ ] 2人を順に欠勤にして振り直すと、差は最初の振り直す前の担当との差で、「振り直す前に戻す」で最初の担当に戻る
- [ ] 欄を閉じたとき戻り先が消えていたら、その人の列の見出しにフォーカス
- [ ] 欠勤を取り消すと稼働時間帯は戻るが今の担当はそのまま。「振り直す前に戻す」で振り直す前の担当・ピンに戻る
- [ ] 当日に終日の欠勤を登録しても、その日の訪問はすべて振り直す
- [ ] 登録すると差の欄へ移りフォーカス。差の欄が画面の外なら左下の帯が1行で出て、地図の浮かせた表示・トーストと重ならない（1280px・1100px・390px。地図を開いた状態でも）。欠勤の人の列の見出しから差の欄・案B へ行ける
- [ ] 終日の欠勤で案A に入らない訪問が出る日に案B の勧め。［この案で決める］→ 進み具合 → 差の表 →「案B を反映する」で担当が案B に（ピン）。「案A を反映する」で戻せる
- [ ] 「変更を減らす」を強めて作り直すと、担当が変わる訪問が減る（または同じ）
- [ ] 「連絡の一覧」で (1)〜(3) と連絡文が出て、コピー（1件・すべて）でクリップボードに入る。印刷は一覧だけ
- [ ] 比較の画面で 欠勤前／案A／案B を比べられる（欠勤前は1つ）
- [ ] 決めると2段目に、休む人・新しく入る人・〈利用者さん〉あての文と［文をコピー］・メール・［連絡した］が出る。キャンセルでは担当に「中止です」（390px で横にはみ出さない）
- [ ] 新しく入る人がその〈利用者さん〉を過去8週に担当していなければ、「お願いします」の行に「初めての訪問先です。」と決まりごと（入っている項目だけ）、行に「初めて」の印。日の予定の訪問の詳細とスマホ画面にも「初めて」の印と決まりごとが先頭に出る
- [ ] 「その他 ▾」の「連絡を貼り付けて入れる」に3行（欠勤・取り消し・休み）と読めない行を貼ると、一覧に読んだ内容とチェック・理由が出て、［3件を入れる］1回で入り「3件を入れました。要対応 M件」。担当は変わらず、「元に戻す」1回で3件とも戻る。同じ文をもう一度貼ると「すでに入っている」
- [ ] `lib/pasteNotices`・`lib/pasteRows`・`lib/absences`・`lib/contacts`・`lib/clipboard`（失敗の経路）・`lib/sudden`・`lib/firstVisit`・`lib/planReassign` のテストが通る
