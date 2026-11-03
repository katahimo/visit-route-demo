# 〈利用者さん〉の一覧と、〈利用者さん〉・〈スタッフ〉の画面・住所の入力・絞り込み（共通部品）

> この画面のファイル：`src/pages/ClientsPage.tsx`（表 `clientsTable.tsx`・状態 `useClientsList.ts`。名簿の欄 `src/components/RosterCard.tsx`・`useRosterCard.ts`・`useRosterImport.ts`）・`ClientPage.tsx`（見出しとタブ `clientPageHeader.tsx`・タブ `clientBasicTab.tsx`・`clientBasicSections.tsx`・`clientStaffingTab.tsx`・`clientScheduleTab.tsx`・節の編集 `useClientEdit.ts`・保存 `useClientSave.ts`・カレンダーの URL `useClientCal.ts`）・`PatternsSection.tsx`（`patternsList.tsx`・`patternsForm.tsx`・`usePatternsFlow.ts`）・`ClientLeavesSection.tsx`（`clientLeaveParts.tsx`・`useClientLeaves.ts`）・`PlaceAllPanel.tsx`、`src/components/usePlaceAllRun.ts`・`useRosterAutoPlace.ts`・`useNoPlaceRow.ts`・`NoPlaceActions.tsx`・`personPage.tsx`（`personPage.css`）・`PersonCalendar.tsx`（`personCalendar.css`。区画 `personCalendarParts.tsx`・状態 `usePersonCalendar.ts`・ドラッグの影 `usePcalGhost.ts`・空き時間に入れる知らせ `useInsertNotice.ts`）・`personView.tsx`（`personView.css`）・`placeLookup.tsx`（`placeLookup.css`・`useAddressLookup.ts`）・`ClientFilter.tsx`（`clientFilter.css`・`useClientFilterModel.ts`）・`useImeQuery.ts`・`ClientPicker.tsx`（`clientPicker.css`・`ClientPickerParts.tsx`・`useClientPicker.ts`・`usePickerLookups.ts`・`clientPickerKeys.ts`・`clientPickerTypes.ts`）・`VisitRules.tsx`・`PickChips.tsx`、`src/lib/personPage.ts`・`peopleView.ts`・`viewMode.ts`・`visitLists.ts`・`visitOps.ts`・`clientFilter.ts`・`area.ts`・`search.ts`・`leaves.ts`・`patternText.ts`・`tentative.ts`・`clientStage.ts`・`addressLookup.ts`・`geocode.ts`・`postalCode.ts`・`placeAll.ts`・`clientEdit.ts`・`newClient.ts`・`patternForm.ts`・`patternConfirm.ts`。関連 ADR：0012〜0017・0020・0021・0026・0051・0052・0056・0068・0072・0073・0075・0094。関連 PRD：D36〜D40・D47・D60〜D62・D64〜D66・D68・D86〜D92・D103〜D112・D118〜D121・D209・D220・D230・D285・D308〜D313・D333・D339〜D341・D365・D385〜D387・D394・D397・D427。
> 〈スタッフ〉の画面の中身は [pages-staff.md](pages-staff.md)。訪問の詳細の欄は [pages-common.md](pages-common.md)。

### 〈利用者さん〉一覧（`#/clients`）

- 題名「〈利用者さん〉」（「一覧」を付けない）。下に入切とも小さいタブ 一覧・相性（`PeopleTabs`。`lib/peopleTabs`。予定を組むの段・基本情報のタブは出さない）。右に「Excel・CSV」（`roster-toggle`。「名簿の欄」）と主ボタン「〈利用者さん〉を追加」（`client-add`。`#/clients/new`）
- 一覧の上に `ClientFilter`（`clients-filter`。画面の状態。URL に残さない。既定 `EMPTY_FILTER`）。期間は選んでいる日（`useDay`）を含む週（月〜日）で、`weekDay` を7日分作って `filterFacts` に渡す。終了の人は「終了の人も出す」のときだけ
- 狭い画面（600px 以下）：絞り込みの中身を「絞り込み（N）」のボタン（`narrow-filter-toggle`。`aria-expanded`・`aria-controls`）の下に畳み、横に「N人を表示」（`narrow-filter-count`）。N は `activeFilterCount`。はじめは畳み、開いたかは画面の中だけ。広い画面はいつも開いたまま
- 一覧の上に「緯度・経度が未登録の〈利用者さん〉」のカード（下の「住所から緯度・経度をまとめて入れる」）。絞り込みに足すチップ「緯度・経度なし」（`extraChips`・`lib/placeAll` の `NO_PLACE_CHIP`。判定は `noPlaceIds`）。住所のセルに、位置の無い人（終了を除く）は「緯度・経度なし」の印と［住所から探す］（`no-place-search`）・［緯度・経度を編集］（`no-place-map`）（`components/NoPlaceActions` の `NoPlaceCell`・値は `useNoPlaceRow`。PRD D427）
- 列（`lib/peopleView` の `clientColumns(detailed)`）：名前・住所（`client-address`）・いつもの予定（`client-plan`。終わっていない繰り返しを `patternWhenText` でつないだ文）と右端の「開く」。名前のセルは仮の印と休み中の印（`clientNameNote`。状態の列があれば列に出す）。**エキスパート機能が入のときだけ**絞り込みの下に「くわしい列」のチェック（`people-columns-toggle`。`components/DetailColumns`）。入れると 位置・特性・求めること・いつもの担当・状態の列を足し（名前のセルによみ・紹介元も）、「状態の印で見分けられます」の説明。一覧ごとに端末に覚える（`store/navOpen` の鍵 `columns:clients`）。切は見出しの下の説明を初回だけ（`useIntro('clients')`）
- 行（`client-row`）：状態に段階（`client-stage`）・「いつもの担当」の列に担当できる人の印「限 山田、佐藤」（`client-limit`。title に全員の名前）・「仮」の印。右端は「〈名前〉を開く」（`Eye`。`client-open`）
- 行のどこを押してもその人の画面へ（`lib/rowOpen` の `shouldOpenRow`：行の中のボタン・リンク・入力欄・文字の選択・二度押しの2回目は除く。`.row-open` で指のカーソルと地の色）
- 狭い画面：表（`narrow-clients`）は1人1枚のカード（[pages.md](pages.md) の「狭い画面の表」）。1行目に名前（くわしい列ならよみ・紹介元）と状態（くわしい列なら段階・仮）、続けて「住所」・「いつもの予定」（くわしい列なら 位置・特性・求めること・いつもの担当（限の印も））、開くは右下
- `?id=`：その人がいればその人の画面へ `replace`。いなければ URL から消すだけ

#### 名簿の欄（〈利用者さん〉一覧・〈スタッフ〉一覧）

- 部品 `components/RosterCard`（見出しのボタン `RosterButton`・欄 `RosterCard`）、状態と処理 `components/useRosterCard`、読み込みの確かめ `components/useRosterImport`。`excel` が切ならボタンも欄も出さない
- 「Excel・CSV」（`aria-expanded`・`aria-controls`）で一覧の上に欄（`section.roster-card`・`roster-card`）を開け閉めする（画面の中だけ）。右上に「閉じる」（`roster-close`）
- 「Excel に書き出す」（`roster-export-xlsx`。`exportRosterWorkbook`）・「CSV に書き出す」（`roster-export-csv`。`exportRosterCsv`。BOM 付きの UTF-8）。ファイル名は `rosterFileName`（`staff-assign-demo-clients-YYYY-MM-DD.csv` など英字だけ）。「最後に書き出した日」に数えない
- 読み込み方 `roster-mode`：追加・更新（ファイルに無い人はそのまま）／総入れ替え（ファイルに無い人を〈スタッフ〉は休止、〈利用者さん〉は段階「終了」にする。消さない）。一覧が0人なら出さず、追加・更新で読む（PRD D104）
- 読み込み `FilePick`（`roster-file`・caption「読み込む〈呼び方〉の名簿（Excel・CSV）」・.xlsx・.csv・.tsv・.txt）。.xlsx か CSV かは中身で、CSV の文字コードは `lib/csv` の `decodeText` で見分ける。列名がほかのソフトの形（`excel/rosterForms`。予約システムのスタッフ・顧客）なら、その形の列を名簿の列に写して読む。顧客台帳の形なら、名前・よみ（カタカナはひらがな・空白を詰める）・郵便番号・住所（都道府県＋市区町村＋町名以下＋建物名）・電話（備考の先頭に1行）・状態（利用中＝利用中、ほか＝終了）・備考だけを読み、請求・口座・生年月日・性別・続柄・顧客番号は読まずデータに残さない。確認の本文に読んだ形（ほかのソフトの形なら「〈形の名前〉の形として読みました」と「読まなかった列：…」も。`rosterConfirmBody`。控えの文は「データの画面の「直前の状態に戻す」」）。確認の後にデータが変わっていないかを見直す（入らなければ控えを前の世代に戻す）
- 〈スタッフ〉の名簿で最終勤務日が入れば、トーストで「最終勤務日のある〈スタッフ〉」の欄を指す（`offboard` が切なら指さない）
- 名簿を読み込むとき（PRD D427。ADR-0094）、`RosterCard` に `onPlace` を渡していれば（`components/useRosterAutoPlace`。`geocode` が切なら渡さない）、`useRosterImport` が `lib/placeAll` の `autoPlaceAfterRoster`（読み込んだあとのデータに `placeAllTargets` の対象がいるか）で決め、確認の本文（`rosterConfirmBody` の `autoPlace`）の最後に「読み込んだあと、住所から緯度・経度を探します（住所を郵便番号の検索と国土地理院の地図の検索に使います）」を足す。入ったと見届けたら（`usePendingImport` の `onDone`）名簿の欄を閉じ、まとめて置く欄（`place-all`）へ移してフォーカスし、`run` を始める（［名簿を読み込む］を押した続き）。〈スタッフ〉一覧・登録の案内①②も同じ

### 〈利用者さん〉・〈スタッフ〉の画面の殻

#### ルートと状態

- `#/clients/:id`（`pages/ClientPage`）・`#/staff/:staffId`（`pages/StaffPersonPage`）。`new` は新しい人。メニューの印・上の帯の名前（呼び名そのまま）は一覧と同じ（`lib/nav` の `activeNavPath` が `/clients/:id` を `/clients` に当てる。`tabClick` は一覧の項目を押すと一覧へ）
- 外側の部品が「URL の人」と「開いている人」を分けて持つ。URL の人が替わったら（パレット・吹き出し・hash の書き換え）、変更があれば確かめ（画面の移動で待っている確認を取り消す処理のあとに出す）、断れば元の人の URL（クエリも）へ `replace` で戻す。中身は開いている人の ID を key にして作り直す。App の `Guarded` の ErrorBoundary の key は `/clients/:id` にそろえる
- いない人の URL は一覧へ `replace`（`state.missing`）し、「その〈利用者さん〉は見つかりません（消されたか、URL が違います）」と知らせる
- 外枠 `person-view`（`data-kind`＝client／staff・`data-id`。新しい人は空）。`.person-view` の dl の並び（`personView.css`）

#### 見出しとタブ

- `PageHeader`：題名は名前（〈利用者さん〉は色の丸、〈スタッフ〉は `StaffMark`）。説明の所に状態（`person-state`：〈利用者さん〉は段階・仮押さえ・休み中・いつもの担当、〈スタッフ〉は利用中／休止中・最終勤務日・ふだんの勤務）。右に一覧へ戻る文字のボタン（`person-back`）、〈スタッフ〉はスマホ画面へのリンク（`to-staff-view`）
- タブ（`components/personPage` の `PersonTabs`。`person-tabs`。リンクのナビ `.view-switch`。今のタブは `aria-current`。`data-tab`）：〈利用者さん〉は［予定（`schedule`）｜基本情報（`basic`）｜担当・相性（`staffing`。相性が切なら「担当」）｜休み（`leaves`。休みの機能が切なら出さない）］、〈スタッフ〉は［予定｜基本情報｜勤務時間（`hours`）｜相性（`compat`。相性が切なら「担当」）］。URL の `?tab=`（予定は書かない。`lib/personPage` の `tabOf`・`tabSearch`。`replace`・節の `edit` を消す）。変更があれば確かめ、替えると決めたら直している節・繰り返し・休みの入力を捨てる。新しい人は予定・担当などのタブを押せない（`aria-disabled`・title「保存してから見られます」）。狭い画面では横に巻き、今のタブを見える所へ
- `?edit=〈節〉` で節を開いて消す（節の無いタブで開いたら節のタブへ移す）
- 印刷ではタブ・節の「直す」・一覧へ戻る・繰り返しと休みの操作・予定のタブの左のリンクを出さない

#### 節（`EditSection`）

- `card person-sec`（`person-sec`・`data-section`）：見出し h2（アイコン＋名前）。読むときは中身と右上に「直す」（`sec-edit`。枠のボタン。aria-label「〈節の名前〉を直す」）、直すときは `<form noValidate>`（`sec-form`）に入力欄と「保存」（`sec-save`。主ボタン。直せる節は同時に1つ）・「取り消し」（`sec-cancel`）・誤りの文（`FieldError`）。Enter で保存（`submitHandler`）、Esc で取り消し
- 直すと最初の入力欄へ、保存・取り消しのあとは「直す」へフォーカス
- 誤りの文の id は画面が持ち（`useId`）、`EditSection` の `errorId` と入力欄の `aria-describedby` を同じにする
- 画面は `edit = { key, form, opened }` を1つ持つ。`lib/clientEdit` の `CLIENT_SECTIONS`（〈スタッフ〉は `lib/staffEdit` の `STAFF_SECTIONS`。節 → 保存する項目）で、変更は `pickFields` の項目だけを `lib/viewMode` の `isDirty` で比べ、保存は保存した中身に `mergeFields` でその項目だけ重ねる（ほかの節の項目・まとめて置いた位置を古い入力で上書きしない）。検査も直している節の項目だけ。新しい人は `key: 'new'` で全部の項目
- 変更の確認（`components/personPage` の `useAskDiscard`・`discardChanges`）：取り消し・Esc は「変更を捨てますか？」（確定「捨てる」）、別の節は「変更を捨てて、ほかの節を直しますか？」、タブは「変更を捨てて、タブを替えますか？」、別の人は「変更を捨てて、〈名前〉を開きますか？」、メニュー・リンク・パレットで移るときは `useLeaveGuard`（「変更を捨てて移りますか？」「捨てて移る」。確定すると `onLeave` で入力を捨ててから移る。行き先は止めた時点で持ち、確認の間にリンクが外れたら行き先へ `navigate`）。訪問の詳細の欄の「日の予定で見る」・休みの注意の「…の予定を開く」も移る前に `confirmLeave`。取り消し側はどれも「編集を続ける」・危険の色。再読込・タブを閉じるは `beforeunload`（変更があるときだけ）。繰り返し・休みの入力の変更も数える（`onDirty`）。別のタブの変更の知らせにも変更ありを知らせる
- 担当できる人は、比べる前に保存のときと同じ値（限らなければ空・限るなら利用中の人だけ）にそろえる。特性は `cleanTraits` で未入力を取り除いて比べる

#### エキスパート機能が切のとき（`lib/peopleView`）

- 〈利用者さん〉の画面：見出しの状態の行に 住所・いつもの予定（`person-brief`）を出し（段階・いつもの担当は出さない。仮押さえ・休み中の印は残す）、タブは［予定｜基本情報｜休み］（`?tab=staffing` は予定へ）
- 基本情報のタブは 基本・住所の節を出し、段階・特性・決まりごと（`visitNotes` が入のとき）と担当・相性（担当を限る・求めること・相性）を「詳しく ▾」（`person-details`。閉じて始まる。`components/DetailsFold`）に畳む。開いた中で直せる。新しい人は段階の欄を出さず（説明・案内文も段階・特性・担当に触れない。`newClientLead`・`newClientHint`）、基本の節だけ。`?edit=` で「詳しく」の中の節を指すと「詳しく」を開いて始める（`clientTabFor`・`editInFold`）

#### 予定のタブの形

- `person-schedule`：左に `person-schedule-side`（360px まで）、右に `person-schedule-main`（カード）。1100px 以下は縦に並べ、600px 以下は右（日ごとのリスト）を先に

### 予定のカレンダー（`components/PersonCalendar.tsx`）

- 引数：`kind`（client／staff）・`personId`・`view`（week／month）・`anchor`（基準の日）・`onChange`（見せ方・期間を変えた）・`highlight`（強調する繰り返しの ID）・`dayNote`（日の見出しに添える印）。画面は `cal`（month のときだけ）・`d`（今日でないときだけ）を URL に `replace` で書く
- 回：`lib/personPage` の `clientCalItems`（`visitLists.clientVisitsIn`。取り消しも）・`staffCalItems`（`visitLists.staffVisitsIn`：担当がその人。取り消しは出さない）。様子（`CalState`）は 取り消し（`cancelled`・`sameDay`）→ 休みのため無し（`leave`）→ 担当あり（`assigned`）→ 担当なし（`unassigned`。赤）。時刻は開始（早）〜＋所要
- 回のボタン（大の札。`pcal-visit`・`data-visit`・`data-date`・`data-state`・`data-pattern`・`data-size="l"`・`data-marks`）：時刻・種類の色の点・印（`useVisitLooks`・`VisitMarks`：要対応・資格✗／限✗・未連絡の変更・ピン・「変」・仮押さえ）、〈利用者さん〉の画面は担当の `StaffMark` と苗字（無ければ様子の文）、〈スタッフ〉の画面は〈利用者さん〉の名前。aria-label「10/28（水） 09:00〜10:00 〈名前〉（種類・…）・印の説明（選択中）（押すと訪問の詳細）」。押す・Enter で `useOpenVisit()`（閉じたらフォーカスはその回）
- 強調：`highlight` の繰り返しの回は `is-hl`、ほかは `is-dim`（`aria-pressed` は選択を表す）。上に「選んだ繰り返しの回：この期間に N回」（`pcal-hl-note`）
- 道具の行（`pcal-tools`）：前／次（`pcal-prev`・`pcal-next`。週は7日・月は1か月）・見出し（`pcal-title`。「10/26（月）〜11/1（日）」「2026年10月」。aria-live）・今日・［週｜月］（`pcal-view`・`data-view`）・〈利用者さん〉の広い画面は「訪問を追加」（`pcal-add`。期間の今日以降の最初の日の 09:00・60分）
- 週（`data-layout="week"`）：見出しの行（日付・今日の印・`dayNote`）、左の時刻の目盛り（7:00〜20:00）、日ごとの列（`pcal-col`。1分 0.8px・1時間ごとの線。重なる回は `laneLayout` で横に並べる）。今日より前の列は薄い地
- 月（`data-layout="month"`）：月曜はじまりの週（`monthWeeksMon`）のマス（`pcal-cell`。日付・`dayNote`・回のボタン）。〈利用者さん〉の広い画面は今日以降のマスに「＋」（`pcal-cell-add`。その日の 09:00・60分）
- 足す（〈利用者さん〉の広い画面・今日以降の列）：空いている所を押すと押した枠（15分刻みに切り捨て）・所要60分。縦にドラッグすると影（`pcal-ghost`）を出し、押した枠と離した枠を両方含む長さ（`slotOf`）で `useOpenVisit({ newVisit: { date, clientId, start }, draft: { durationMinutes } })`。回の上で押したときは足さない
- 選ぶ：`useVisitSelection(`${kind}|${personId}|${view}|${anchor}`)`（人・見せ方・期間が変わったら外す）。Shift・Ctrl＋クリック／Shift・Ctrl＋Enter で選ぶ・外す（今日より前・取り消し・休みは選ばない）。選んだ回は画面の下の `SelectionBar`（〈スタッフ〉の画面は `shift={false}`）。広い画面は道具の行に全体の「元に戻す」（`UndoButtons`。`undo-btn`）。狭い画面は長押しか「選ぶ」（`pcal-select`。`SelectToggle`。選べる回が無ければ押せない）で選ぶ形に入る（期間・見せ方・人を変えたら抜ける）
- キー（広い画面。[pages-common.md](pages-common.md) の「訪問の帯をキーで動かす」）：↑↓ 15分・←→ 1日（期間の外へ出たらその期間へ `onChange`）・Shift+←→ 隣の担当（利用中の〈スタッフ〉の順）・Enter は欄・Delete は取り消し（確認）。動かしたあとフォーカスは動かした回（`focusVisitItem`）、繰り返しの回は範囲の帯（`KeyMoveBand`）。〈スタッフ〉の画面は日時を動かさない（`useVisitKeys` の `move: false`。Shift+←→・Enter・Delete だけ）
- 動かす（〈利用者さん〉の広い画面・今日以降の取り消しでない・休みでない回）：HTML のドラッグ（`useVisitDrag`・`dropVerdict`。つかんだ位置の差を保つ・15分に丸める・影 `DropShadow`。置けない（今日より前・7:00〜20:00 の外など）は灰の斜線と理由で落とせず、入らないは赤い点線で落とせる）。週は落とした日時、月は落としたマスの日で同じ時刻を `draft`（開始（早）・（遅）は幅を保つ）に入れて欄を開く。範囲は欄で選ぶ。同じ日時なら何もしない。保存で日時が変わり担当を選ばなければ、上に「〈日〉へ動かしました。担当はそのままです（その日に入らなければ要対応に出ます）」と［M/D の空き時間に入る人を割り当てる］（`pcal-notice`・`pcal-insert`。`lib/weekOps` の `insertIntoPlan`。入らなければ理由）
- 下に1行の説明（足し方・動かし方）
- 狭い画面（600px 以下。`data-layout="list"`）：日ごとのリスト（`pcal-list`・`pcal-day`）。週は7日（無い日は「訪問なし」）、月はその月の訪問のある日と今日。行は共通の `VisitRow`（`ul.vrow-list`。`pcal-visit`・`data-marks`。〈利用者さん〉の画面は種類名と担当、〈スタッフ〉の画面は〈利用者さん〉の名前だけ。[pages-common.md](pages-common.md) の「1行1訪問の行」）。足す・動かす・キーは出さず、見る・取り消す・担当替えは下から出る欄で
- 印刷：道具の行のボタン・説明・「＋」・知らせを出さない（期間の見出しは出す）

### 〈利用者さん〉の画面の中身

#### 予定のタブ

- 左：繰り返し（`PatternsSection`。`patterns` が切なら欄ごと隠す。今ある回は残る）と休み（`schedule-leaves`。これからの休みを読むだけ。休みの機能が切でも出す。直すのは休みのタブ）。狭い画面では繰り返しは読むだけで「繰り返しを足す・直すのは広い画面でできます」
- 右：`PersonCalendar`（`kind="client"`。`dayNote` は休みなら「休み」）

#### 基本情報のタブ（節）

- 基本（`basic`：表示名・よみ（`client-kana`）・メモ・色）
- 段階と紹介元（`stage`：段階（`client-stage-select`）・枠を仮押さえする・紹介元（`client-referrer-name`）・連絡先・メールアドレス（任意。`client-referrer-email`。`normalizeEmail`）・メモ。`clientStage` が切なら段階は「利用中／終了」の2つ（ほかの段階の人はそのまま））。読むときに仮押さえの人は `tentative-box`：「本登録にする」（段階を利用中に）・「仮押さえを取り消す」（確認のうえ `store/tentative` の `cancelTentative` でその人の繰り返し・訪問・〈利用者さん〉を消し、一覧へ）
- 住所（`place`：`ClientPlaceEditor`。読むときは郵便番号・住所・地区・位置と、位置があれば `RouteMap`（1点・高さ 180））
- 特性（`traits`：`TraitsEditor`）
- 訪問先の決まりごと（`rules`。`visitNotes` が入のとき：入り方・鍵・駐車場・注意（各200字。`visit-rules-form`）。注意書き「実在の人の名前・住所などの個人情報は入れないでください。」）。表示は `components/VisitRules.tsx`（スマホ画面・日の予定の帯の詳細・訪問の詳細の欄）
- 新しい人（`#/clients/new`）は「基本」の節（`new`）に基本と段階の入力をまとめて開き、「住所・特性・担当・繰り返し・休みは、保存してから入れられます」。保存するとその人の基本情報へ（`replace`）、取り消すと一覧へ（何も入れていなければ確かめない）
- 保存の検査：郵便番号は `normalizePostalCode`（直せなければ保存しない）・紹介元のメール・同じ名前は保存しない（Excel で名前で引くため）・`clientSchema`。段階に合わせて予定の対象・仮押さえを `withStage` で決める。終了にしたら「一覧の「終了の人も出す」で出ます」と知らせる

#### 担当・相性のタブ

- 担当（`staffing`）：いつもの担当は繰り返しの担当で予定のタブで替える旨（`client-usual-note`）と、`allowedStaff` が入なら「担当できる人を限る」と利用中の〈スタッフ〉のチップ（`PickChips`・`client-allowed`・`bulk={false}`）。入れたとき誰も選んでいなければいつもの担当（`usualStaffOf`）を選んでおく。1人も選ばなければ保存しない。保存のとき休止中の人は外す。読むときは `ClientStaffRows`（`PersonNames`：押すと詳細の吹き出し。`view-allowed-staff`・`view-usual-staff`）
- 〈スタッフ〉に求めること（`conds`：必要条件・希望の `ConditionsEditor`。読むときは `CondRows` と条件のチップ）
- 相性（読むだけ。`compat` が入のとき）：`ClientCompatRows`（記号ごとの利用中の〈スタッフ〉。`view-compat-*`）と「相性の表で直す」（`?cf=` でその人に絞って開く）

#### 休みのタブ（`pages/ClientLeavesSection.tsx`）

- 一覧（期間・理由・その期間の訪問 N件・確定した日の数・終わった休みは「（終わった休み）」）と「休みを追加」（`leave-add`）・行の「直す」（`leave-edit`）
- 入力（`leave-form`）：開始日（`leave-from`）・終了日（`leave-to`。初期値は今日〜今日）・理由（`leave-note`。100字まで）と「保存」（`leave-save`）・「取り消し」（`leave-cancel`）・直すときは「この休みを消す」（`leave-remove`。確認してから）
- 休みと重なる確定した日（`leaveConfirmedDates`）があれば「確定した日（10/20・10/27）に〈名前〉の訪問があります。休みを入れた日が確定済みなら「未連絡の変更」になります。その日の「日の予定」の連絡の一覧で確かめてください」とその日へのリンク（`leave-warn`。注意。保存はできる）
- 休みの訪問は AI で組む・空き状況・要対応の検査から外れる。スマホ画面は休みの訪問を出さない

#### 繰り返し（`pages/PatternsSection.tsx`・`patternsList.tsx`・`patternsForm.tsx`・`usePatternsFlow.ts`、`lib/patternForm.ts`・`patternConfirm.ts`）

- 見出し「繰り返し」と「繰り返しを追加」（`pattern-add`）。説明は箇条書き（押すとカレンダーで目立たせる・足すと作ってある最後の日まで作る・その先は月の予定）
- 行（`pattern-row`・`data-pattern`）：押せる文（`pattern-pick`。`aria-pressed`。種類・`patternWhenText`・所要・`periodText`・いつもの担当・「標準の開始：月 10:00・水 11:00」（無ければ出さない。`pattern-usual-starts`））と「直す」（`pattern-edit`）・「終わらせる」（`pattern-end`）
- 入力（`pattern-form`）：種類（選ぶと所要の初期値）・繰り返し（毎週／隔週／3週ごと／4週ごと／毎月（第N）。選択肢と値の変換は `lib/patternForm` の `repeatChoices`・`withRepeatChoice`＝「定期の予定を追加」と共通。`pattern-repeat`）・曜日（`pattern-weekdays`）・第何週（`pattern-month-weeks`。チップは `components/MonthWeekChips`＝「定期の予定を追加」と共通）・時間の決め方・開始（早・遅）・曜日ごとの時刻（`pattern-per-day`・`pattern-daytimes`）・曜日ごとの標準の開始（`pattern-usual-starts-form`。開始（早）〜（遅）の外なら文を出して保存させない）・所要・開始日／いつから変えますか・終了日・いつもの担当・メモ。「保存」（`pattern-save`）・「取り消し」（`pattern-cancel`）・直すときは「この繰り返しを消す」（`pattern-remove`）
- 足す：繰り返しを足し（回は見るときに計算する）、保存の直後に増えた担当なしの回を自動で組む（`lib/autoArrangeBatch` の `requestAutoArrange`。`usualStaffId` も書く。トースト「繰り返しを追加しました（担当を自動で組みます）」。対象が無ければ「（担当なし）」。知らせ「N件の担当を組みました」と［元に戻す］は `AutoArrangeHost`）。直す：日時が変わった・増えた担当なしの回を同じく自動で組む（トースト「繰り返しを直しました（担当を自動で組みます）」）。`splitPattern`（`patternSplitConfirm`：繰り返しのとおりに戻る担当を組んだ回 N件・「未連絡の変更」になる確定した日 M日を確かめる）。消す：`removePattern`（`patternRemoveConfirm`。確定した日を確かめる）
- 終わらせる（`pattern-end-form`）：最後の日（`pattern-end-last`。初期値は今日。終わっていればその終了日、まだ始まっていなければ開始日で「開始日の回も要らないときは「直す」の「この繰り返しを消す」で消します」（`pattern-end-before`））と「保存」（`pattern-end-save`）。`visitOps` の `endPatternOp`（終了日を入れ、最後の日より後で今日以降の、この回だけ変えていない・取り消していない回を消す。確定した日の数）を確かめてから入れる
- `patternMonthly` が切でも `repeat` と `monthWeeks` を残し、読むだけと注記（`pattern-monthly-off`）
- 入力の変更（終わらせるは最後の日を変えたとき）を `onDirty` で画面へ知らせる

#### `lib/personPage.ts`（純粋関数。テストあり）

`tabOf`・`tabSearch`・`pickFields`・`mergeFields`・`calViewOf`・`monthWeeksMon`・`calDates`・`shiftAnchor`・`calTitle`・`clientCalItems`・`staffCalItems`・`itemsByDate`・`staffAbsencesIn`・`slotOf`・`clientStaffGroups`

#### `lib/viewMode.ts`（純粋関数。テストあり）

`isDirty(form, base, extra)`（JSON で比べる。`traits` は `cleanTraits`。元が無ければ変更あり）・`orDash`（空なら「—」）

#### `lib/leaves.ts`（純粋関数。テストあり）

`leavesOf(data, clientId)`（開始の順）・`saveLeave(d, leave)`（同じ ID は置き換え）・`removeLeave(d, id)`・`leaveConfirmedDates(data, leave)`（伝えた内容にその〈利用者さん〉の担当の決まった訪問がある日）・`leaveVisits(data, leave)`（取り消しでない訪問）

#### 確かめ

`scripts/e2e-view.cjs`（節の形・変更の確認・`?id=`・追加・吹き出しの名前・行を押す・アイコン）・`scripts/e2e-person-page.cjs`（タブ・カレンダー・欄・空き枠から足す・ドラッグ・繰り返し・休み・〈スタッフ〉の画面・390px・印刷）・`scripts/e2e-shared-parts.cjs`（複数選択・キー・〈スタッフ〉の画面は日時を動かさない・帯の見た目・落とし先の判定・390px の行）。

### 住所の入力

外部を呼ぶのはボタンを押したときだけ（`lib/geocode.ts` の1か所）。開いた・打っただけでは送らず、送るのは zipcode・q だけ。

#### `lib/postalCode.ts`・`lib/geocode.ts`

- `postalCode.ts`（純粋関数。画面と Excel で使う）：`normalizePostalCode`・`formatPostalCode`
- `geocode.ts`（外部を呼ぶ**ただ1か所**）：`lookupPostalCode`・`searchAddress`・`jsonp`・`lookupMessage`（design.md §5「郵便番号と住所の検索」）。fetch・JSONP・待ち時間は引数で差し替えられ、テストは偽物で行う

#### `lib/addressLookup.ts`（純粋関数）

- 押せない理由（`postalBlockReason`・`addressBlockReason`）、郵便番号の欄のエラー（`postalInputError`）
- 見つけた住所の当て方（`applyFoundAddress(current, found, hasPin)`。いまの住所が見つけた住所で始まるならそのまま）と「元に戻す」の先（`nextUndoAddress`・`canUndoAddress`）
- 状態の知らせ（`busyStatus`・`failStatus`・`pinStatus`・`statusClass`）、候補（`postalCandidates`・`geoCandidates`）
- `toPlace`（郵便番号を落として `Place` に）

#### `components/placeLookup.tsx` の `AddressField`

- 型の引数は場所の型 T。`value`・`onChange`。郵便番号は `postalCode`・`onPostalCodeChange` で渡す（渡さなければ部品の中だけで持つ）
- 中身：郵便番号・住所・「住所を探す」「住所から緯度・経度を入れる」（この部品のボタン。まとめて入れる欄とは別）・注記・状態・候補・`PlacePin`（地図とピン）。`postalLabel`・`noticeNote`（注記の後ろ）
- 主ボタンではない。押せないときは aria-disabled＋理由（title と文字）
- `testId`（`client`／`vacancy`／`staff-home`）。中の data-testid は `${testId}-notice`・`${testId}-status`・`${testId}-postal-candidate` などの頭付き。〈利用者さん〉だけは `client-postal`・`place-notice`・`place-lookup-status`・`postal-candidate`・`geo-candidate`
- 探している途中に欄を書き換えた・ピンを動かしたら、呼び出しを止めて「探しています」を解く。応答のあとも送った値と今の欄の値（ref）を比べ、違えば捨てる（`sameQuery`）。押したことは ref でも持ち、連打しても1回だけ。途中で閉じたら書かない
- ピンがある状態で郵便番号から住所を差し替えたら、ピンは残し、知らせに「緯度・経度は前のままです。『住所から入れ直す』を押してください」を足す
- 郵便番号のエラーと押せない理由は aria-describedby で結ぶ（.sr-only）。郵便番号の欄は16文字まで（空白の多い貼り付けも7桁に直す）
- 見つからない・つながらない・時間切れは知らせてデータを変えない
- `ClientPlaceEditor`：`place.postalCode` を持たせた〈利用者さん〉用（住所の節を直すたびに作り直す）
- 使う所：〈利用者さん〉の住所の節・空き状況の場所（[pages-vacancy.md](pages-vacancy.md)）・〈スタッフ〉の自宅（[pages-staff.md](pages-staff.md)）

#### 住所から緯度・経度をまとめて入れる（`lib/placeAll.ts`・`pages/PlaceAllPanel.tsx`・`components/usePlaceAllRun.ts`）

- 〈利用者さん〉一覧・〈スタッフ〉一覧（自宅）・登録の案内①②の上のカード（PRD D89・D427）。1行目は「緯度・経度が未登録の〈…〉：N人」（〈スタッフ〉は「自宅の緯度・経度が未登録の〈…〉」）・数え方（`place-all-count`。「住所・郵便番号あり N人・住所・郵便番号なし M人」、〈スタッフ〉は「住所あり／住所なし」。終了・休止を除くことは書かない）・ふつうのボタン［住所から緯度・経度を入れる（N人）］（`place-all-run`。0人のときは人数を付けない。一度探したあとは［続きを探す（N人）］。`placeAllRunLabel`。`geocode` が切なら出さない）・「止める」・［緯度・経度なしだけ見る］（`place-all-only`。押すと絞り込みの「緯度・経度なし」を付け外し。案内では出さない）。下に「緯度・経度が未登録の場合、移動30分で計算されます」（`place-all-note`。ADR-0093）・送る先の注記（「緯度・経度の検索は、国土地理院のサイトで行っています（住所のみ送信。住所が無い人は郵便番号を郵便番号検索へ送信）」。`geocode` が入のとき）・進み具合（「探しています… N／M人」。終わると「（入れた N人・見つからない M人）」）・結果（「見つからなかった〈…〉（編集の欄で住所を直すか、地図をクリックして緯度・経度を入れてください）」「入れた〈…〉」）。位置の無い人がいなくなり結果も無ければ出さない。画面を離れたら止める
- 状態と処理（`usePlaceAllRun(kind)`）は一覧の画面（案内は〈利用者さん〉・〈スタッフ〉の2つを画面が持ち、段を替えても続く）が持ち、カード・名簿のあと・行の［住所から探す］（`run([id])`。その人だけ）に同じものを渡す。`run` は呼ばれたときのデータで対象を数える（名簿の直後でも）。走っている最中に呼ばれたら（名簿を読み込んだ）、終わったあと残り（この続きでまだ探していない人）を続けて探す予約を持つ（`lib/placeRunQueue` の `createPlaceRunGate`。止めたら予約を捨てる）。案内は `usePlaceAllRun(kind, lane)` に1本の列（`createPlaceLane`）を渡し、〈利用者さん〉・〈スタッフ〉を同時に走らせない（片方が走っていれば、もう片方は待って始める。待つ間は「ほかの名簿の緯度・経度を探し終わるのを待っています」と［止める］。外部の検索は同時に1本。ADR-0016）。カードは見せるだけ（`ref` で名簿のあとに移ってフォーカスする。`tabIndex=-1`）
- 見つからなかった人のうち住所から緯度・経度が見つからなかった人（`hasAddressNotFound`）がいれば、見出しの下に1行「市区町村の名前が無い住所…」（`place-all-city-hint`）
- 種類ごとの違い（数える人＝〈利用者さん〉は終了を除く・〈スタッフ〉は休止を除く／書く先＝場所・自宅／文）は `placeAccess` の1か所（switch を never で網羅）。`placePeople(data, kind)`（そろえた形 `PlacePerson`。〈スタッフ〉の郵便番号は ''）、`placeAllTargets(data, kind)`（対象・住所も郵便番号もない人）、`placeAll(targets, opts)`（1人ずつ順に・間隔をあける・止める・1人ごとに結果）、`withFoundPlace(data, kind, id, from, place)`（位置の無いときだけ書く）
- 見つからなかった人の「編集」と行の［緯度・経度を編集］はその人の住所の節（`#/clients/:id?tab=basic&edit=place`。〈スタッフ〉は自宅の節 `#/staff/:id?tab=basic&edit=home`。畳んだ「詳しく ▾」は開く）

### 絞り込み

#### `lib/area.ts`（純粋関数。テストあり）

- `areaOf(address)` → `{ city, town } | null`
- 頭の郵便番号・都道府県を外し、政令市（20市の表）は 市＋区、郡は 郡＋町村、ほかは 市／区（東京の特別区）／町村 の順に探す
- 名前に「市」「郡」を含む市（四日市市・廿日市市・野々市市・大和郡山市・小郡市）と東京23区は表で、郡・市より先に照らす。郡の町村の名前の「市」は許す（余市郡余市町・中新川郡上市町）
- 町名は 数字（漢数字の丁目・番地を含む）・丁目・番地・括弧・空白 の前までで切る（無ければ ''。丁目だけなら「六丁目」のように）。見つからなければ null
- 郵便番号のハイフンは各種のダッシュ・長音も、市と区・郡と町村のあいだの空白も詰める

#### `lib/clientFilter.ts`（純粋関数。テストあり）

- `ClientFilterState`：query・cities・towns（`townKey(city, town)`）・chips・staffId・showEnded・`types?`（押している訪問の種類の id。複数は OR）・`extra?`（画面ごとに足すチップのうち押しているもの）
- 既定：`EMPTY_FILTER`（〈利用者さん〉の画面・相性）・`WEEK_TABLE_FILTER`（chips＝period。週の表）
- `filterFacts({ days, visits, clients, patterns, clientLeaves, staff, visitTypes? })`：週の `weekDay` の帯から、期間に訪問がある人・担当が決まっていない訪問（担当 null・休みでない帯）がある人・〈スタッフ〉が担当する人（帯の担当＋いつもの担当。`staffClientMap`）、期間にかかる休み・パターンのある人・働ける〈スタッフ〉（利用中で最終勤務日が無いか期間の終わり以降）・終了でも出す人 `endedShownIds`（`showEndedInPeriod` のとき期間に訪問がある人）。`extraTests?`（キー → 判定。無いキーは絞らない）。`visitTypes` を渡すと `typeClientIds`（種類の id → 期間にその種類の取り消しでない訪問がある人）と `typeIds` を作る（渡さなければ種類で絞らない）
- `chipMatches`・`matchArea`・`filterClients`（AND。終了の人は showEnded のときだけ。渡した順のまま）・`chipCounts`・`cityChips`・`townChips`（地区のほかの絞り込みをかけた人数。住所なしは最後）・`toggleChip`・`toggleCity`（外すと町名も外す）・`toggleTown`・`staffCounts`・`resolveStaffId`（`staffCounts` で `defaultStaffOf`）・`endedVisible`・`extraCounts`・`toggleExtra`・`matchTypes`（消えた種類の id・`typeIds` の無い facts は全員）・`typeChips`（種類を除いたほかの絞り込みをかけた、その種類の人数）・`toggleType`（並びは `visitTypes` の順）・`sameFilter`・`chipLabel`・`chipHelp`
- `activeFilterCount(state)`：効いている絞り込みの数＝検索の文字（空白だけでなければ1）＋市区＋町名＋チップ＋種類＋足すチップ＋「終了の人も出す」（入なら1）
- `encodeFilter`・`decodeFilter(raw, fallback, extraKeys)`：`?cf=` に `types` を押しているときだけ `type:t1,t2`、`extra` を押しているときだけ `x:k1,k2`（並びはそろえる）。`extraKeys` に無い値は捨てる

#### `components/ClientFilter.tsx`

- 検索欄：Esc で文字を消す。変換中（`compositionstart`〜`compositionend`）は呼ぶ側へ渡さず確定で渡す。ふつうの入力は `QUERY_DELAY_MS`（300ms）待って渡す（週は `replace` で URL へ）。呼ぶ側の値が外から変わったら入力欄を合わせる。チップを押したときは入力欄の文字もいっしょに渡す（`components/useImeQuery` の `useImeQuery(state, onChange)`。`StaffFilter` も同じ）
- 「終了の人も出す」（`hideEnded` で出さない）・件数「N人／M人」・「絞り込みを戻す」（既定と違うときだけ）
- 地区の1段目（市区）と選んだ市区ごとの2段目（町名）
- 訪問の種類（`visitTypes` が1件以上のとき。地区の下・「絞り込み」の上の欄「訪問の種類（どれか）」。`〈testId〉-type`・`data-key`＝種類の id）：種類ごとのチップ（人数つき・0人は `aria-disabled`）
- 絞り込みのチップ：「〈スタッフ〉が担当する人」を押すと〈スタッフ〉の select（人数は「その人で押したら何人か」。0人でも押せる）。`extraChips`（「絞り込み」の後ろ。判定は `facts.extraTests`、人数は `extraCounts`）
- チップ・地区は `aria-pressed` のボタンで人数を読み上げ、0人で押していないものは `aria-disabled`
- 状態は呼ぶ側が持つ
- 使う所：〈利用者さん〉一覧・週の〈利用者さん〉×曜日・相性

### 検索と `ClientPicker`

#### `lib/search.ts`（テストあり）

- `normalizeKana(text)`：カタカナ→ひらがな、全角半角・大文字小文字・空白の違いと、ハイフン・各種マイナス・ダッシュを長音「ー」にそろえる
- `matchClient(client, query)`：表示名・よみの部分一致
- `staffClientMap`（案の担当といつもの担当から〈スタッフ〉→〈利用者さん〉）・`defaultStaffOf`（担当する人が1人以上いる最初の人）・`countAmong`

#### `components/ClientPicker.tsx`

- 検索欄（`role="combobox"`・候補は `listbox`、上下キーと Enter）。候補は最大10件。変換中の Enter・↑↓ は何もしない
- 選んだ人のチップ（外すボタン付き。`showChips`（既定 true）。`details` で名前を `PersonButton` に）
- 近道：この週・月に訪問がある人（`period`）／〈スタッフ〉が担当する人（`byStaff`）／最近選んだ人（画面の状態に最大10人）／仮押さえの人（`tentativeShortcut` を渡す月だけ）
- `max` を超えたら理由を出して選ばない（「あと N人を選ぶ」は消さず `aria-disabled` にして理由の小さい文を近くに）
- 使う所：月（1人）・週の時間軸の「ほかの人を探す」（8人まで）

### 完了の条件

- [ ] 定期パターンを足すと、その日から先の週・月に回が出る（見るときに計算する）。1件だけ時刻を変えると「この回だけの変更」になり、パターンを「いつから」で直しても変わらない。ほかのいつから以降の訪問は新しい時刻、それより前は変わらない
- [ ] 「毎月・第3・第4・木」で第3・第4木曜だけに訪問が出る。曜日ごとに時刻を変えるとその曜日の訪問がその時刻になる
- [ ] 休みを入れると、その期間の訪問が日・週・月で薄く「休み」になり、AI で組む・空き状況から外れる。確定した日と重なれば注意。消すと元に戻り、訪問は増えない
- [ ] 決まりごとがスマホ画面と日の予定の訪問の詳細に出る。初めての訪問先は「初めて」の印と決まりごとが先頭に出る（PRD D415）
- [ ] 担当できる人を2人に限ると、AI で組む・振り直しでその2人以外に入らず、理由に「担当を限る：… ✗」が出る
- [ ] 段階を「終了」にすると予定・AI で組むに入らず、一覧は「終了の人も出す」のときだけ。仮押さえは「相談受付」で入り、「本登録にする」で利用中
- [ ] 一覧を地区・チップ・検索・訪問の種類（どれか）で絞れる
- [ ] 一覧の行・「開く」・`?id=` でその人の画面が開き、節は読むだけ。「直す」でその節だけ入力欄になり、保存・取り消しで戻る。変更があるまま取り消す・タブを替える・別の人を開く・画面を移ると確認。「追加」は新しい人の画面（`scripts/e2e-view.cjs`）
- [ ] 人の予定表の回を Ctrl＋クリックで選べ、↓ で15分後へ（Ctrl+Z で戻る）。〈スタッフ〉の画面は ↓ で動かず、帯に時刻をずらすが無い。390px は「選ぶ」・長押しで選べ、行は日ごとのリストと同じ形（`scripts/e2e-shared-parts.cjs`）
- [ ] カレンダーで回を押すと訪問の詳細の欄、空き枠の縦ドラッグで所要の長さの新しい訪問、回のドラッグで範囲を選んで動かせる。繰り返しを足す・直す・終わらせる（`scripts/e2e-person-page.cjs`）
- [ ] エキスパート機能が切なら一覧は 名前・住所・いつもの予定の3列。画面は段階・特性・決まりごと・担当・相性を「詳しく ▾」に閉じて始める（`scripts/e2e-simple-menu.cjs`）
- [ ] `scripts/e2e-address.cjs`：開いた・打っただけでは送らず送るのは zipcode・q だけ、郵便番号の正規化、候補と元に戻す、失敗で知らせてデータを変えない、連打で1回・途中で閉じたら書かない・古い応答を捨てる、〈利用者さん〉の data-testid と保存
- [ ] `lib/leaves`・`lib/patternText`・`lib/area`・`lib/clientFilter`・`lib/search`・`lib/viewMode`・`lib/personPage`・`lib/visitOps`・`lib/addressLookup`・`lib/postalCode`・`lib/geocode`（偽物）・`lib/clientStage` のテストが通る
