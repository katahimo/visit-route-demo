# データの画面と管理者設定

> この画面のファイル：`src/pages/DataPage.tsx`（組み立てだけ。状態と処理は `useDataBackup`（`useLastExport`・`useDataBackup`・`useDataRestore`）・`useDataExcel`・`useDataTidy`・`useDataTerms`、見た目は `dataParts.tsx`（保存の誤り・直前の状態に戻す・呼び方・控え（JSON）・古い訪問を片づける・初期状態に戻す）・`dataExcel.tsx`（Excel の欄）・`dataBookings.tsx`（予約の CSV の欄）、文と判定は `src/lib/dataScreen.ts`・`bookingScreen.ts`）・`SettingsPage.tsx`（`settings.css`）・`RestartCard.tsx`・`mailScheduleSettings.tsx`、`src/components/FilePick.tsx`（`filePick.css`）・`DataNotices.tsx`（`dataNotices.css`）・`dirtyForms.ts`（`useDirtyMark`）、`src/lib/filePick.ts`・`features.ts`・`backupReminder.ts`・`tidy.ts`・`dirtyForms.ts`。関連 ADR：0006・0028・0032・0068・0069・0073・0075・0090・0095。関連 PRD：D191・D210〜D216・D227・D260・D275・D322・D366・D379・D381・D395・D408・D428。
> Excel の変換は design.md の「excel」、機能の表と判定は design.md の「features」。

### データ（`#/data`）

メニュー「設定」の「データ」のタブ（土台。切れない。見出しの下に設定のタブ）。

#### 注意書き・呼び方

- 「データは**このブラウザの中だけ**に保存し、サーバーには送りません。実在の人の名前・住所などの個人情報は入れないでください。」。保存できなければ「保存できませんでした：…。書き出して保管してください。」
- 呼び方（`Term` `terms`）：訪問する人・訪問先（各10文字まで）と「変える」。同じ呼び方は使えない。データに保存し、書き出しに入る
- 容量超過（`QUOTA_MESSAGE`）なら、保存できなかった文の下に「古い訪問を片づける」（`data-tidy-go`。片づけの欄へ巻いてフォーカス）

#### 直前の状態に戻す

- 1世代の控えがあるときだけ欄（`data-prev-card`・aria-label「直前の状態に戻す」）。文（`data-prev-text`）「10/19 14:03 の『初期状態に戻す』の前の状態に戻せます」（`lib/backupReminder` の `previousText`。日本時間）
- 控えを残す操作（操作の名前）：初期状態に戻す・控えの読み込み・Excel 全体の読み込み・名簿の読み込み（「〈呼び方〉の名簿の追加・更新／総入れ替え」）・予約の読み込み。確認の本文の最後に見込み（`canKeepPrevious()`）で「いまのデータは控えとして1つだけ残し、この画面の「直前の状態に戻す」で戻せます。」（名簿は「データの画面の」）、残せない見込みなら「控えを残せません：容量不足。」。OK のあと `keepPrevious(reason)`（取り消す・閉じると控えは変わらない）。見込みに反して残せなければ操作は止めず、完了のトーストに理由を添える（「初期状態に戻しました（控えを残せません：容量不足）」）。名簿が入らなかったら `cancel()` で前の世代に戻す
- 「直前の状態に戻す」（`data-prev-restore`）：独自の確認（危険の色。「〈文〉。いまのデータは控えと入れ替わり、もう一度「直前の状態に戻す」で戻せます。」）。確定で `restorePrevious()`（いまのデータを控え、控えのデータにする）とトースト「直前の状態に戻しました」。控えが無い・読めない・いまのデータを控えに残せない（「いまのデータを控えに残せないため戻せません：容量不足」。戻さない）ときはトーストで理由
- 別のタブで控えが変わったら（storage イベント）欄を読み直す
- 容量が足りず控えを捨てたら（`previousDrops`）欄を消し、トースト「容量が足りないため、直前の状態の控えを消しました」（`DataWatch`）

#### 最後に書き出した日

- 「ファイルに書き出す」の下に「最後に書き出した日：10/12（7日前）」（`data-last-export`。同じ日は「今日」、まだなら「まだ書き出していません」、Excel 全体なら「（Excel 全体）」。`exportAgoText`）
- 控え（JSON）と Excel 全体の書き出しで更新（名簿だけは数えない）。このブラウザの記録（`store/backup.ts` の `backupMemory`）で、データには入れない

#### 控え（バックアップ。JSON）

- `Term` `backup`。「ファイルに書き出す」（データ一式（担当・伝えた内容・振り直しの記録も）を1つの JSON に）。説明は「丸ごとの控え・別の端末へ移す用。中身を直すファイルではない」と「人が見て直すなら Excel（確定などの記録は入らない）」。版1の控えは「データの形が変わったので初期データで始めます」で読み込まない
- 読み込みは `FilePick`（`backup-file`・caption「読み込む控え（JSON）」）。置き換える前に確認する

#### Excel

- 欄 `section.data-excel`（`excel-card`・`aria-labelledby` は見出し）。いつも出す（入り切りしない。ADR-0106）
- 全体のブックだけ：〈スタッフ〉・〈利用者さん〉・項目・条件・相性・稼働時間・訪問のシート。読み込むといまのデータがその内容に置き換わる（担当もブックのとおり。伝えた内容・振り直しの記録はブックに無いので残し、変わった所は「未連絡の変更」になる）。説明の最後に、丸ごとの控え・移すときは JSON と書く。書き方はブックの「使い方」のシート
  - 別の事業所のブック：事業所名が違えば（`lib/dataScreen` の `otherOrgOf`。名前で見る）確認の題名を「別の事業所の…」にし、両方の名前と、いまの確定・振り直しの記録を消すことを書く（`workbookConfirmBody`）。OK なら `withoutOrgState` で外してから置き換える
- 名簿（Excel・CSV）は各一覧の名簿の欄（[pages-clients.md](pages-clients.md)「名簿の欄」）。欄の中に一覧へのリンク（`excel-roster-note`）
- 「Excel に書き出す」と読み込み `FilePick`（`excel-file`・caption「読み込む Excel（全体）」）

#### 予約の CSV（`BookingCard`。`booking-card`）

- Excel の欄の次。予約を1回ずつの訪問（担当なし）として入れる。読める形は `BOOKING_FORMS`（予約システムの予約・このアプリの予定）。同じ読み込みは単発の「予約を追加」の引き出しにもある（書き出しつき。PRD D423）。登録の案内③にも同じ欄を出す
- 「テンプレートをダウンロード（CSV）」（`booking-template`。名簿の欄と同じ言葉。`components/useVisitCsvTemplate`：予定の CSV の列名の行だけ。引き出しのテンプレートと同じ）。説明に必ず入れる列（`VISIT_CSV_REQUIRED`）を出す
- `FilePick`（`booking-file`・caption「読み込む予約の CSV」・.csv・.tsv・.txt）で選ぶと `useBookingImport` が `importBookings` で読み、確認（題「訪問を読み込みますか？」・本文 `lib/bookingScreen` の `bookingConfirmBody`：形と文字コード・件数（追加・更新・削除・変更なし）・総入れ替えの説明（ファイルの最初の日〜最後の日の単発の訪問をファイルに合わせ、ファイルに無い訪問と取り消しの予約の訪問を消す。PRD D441）（アプリで取り消した訪問も、ファイルで有効なら有効に戻す）・足さない取り消し済みの予約・入れなかった予約・読めなかった行・勤務日・時間に入らない予約の文（`lib/bookingFit` の `bookingsOutsideHours`・`outsideHoursNote`。足す・直す予約のうち、どの〈スタッフ〉の勤務（日ごとの上書きを含む。休止・最終勤務日後は除く）にも入らないもの。内訳は担当なしの組めない理由と同じ言葉で勤務日外（その日に勤務する人がいない）・勤務時間外、直すものも内訳に合わせて「勤務する曜日・勤務時間」。PRD D428・D430。ADR-0095）・読まなかった列・担当なし（担当・ピンは残す）・控えの文。主ボタン「読み込む」）のあと、1世代の控えを残して入れる（`usePendingImport`。入ったと見届けたら `requestImportArrange` で担当なし・要対応を自動で組む。名簿の読み込みも同じ。PRD D442）
- 知らせは担当の組み方を案内する（エキスパート機能が入なら「担当を組む」、切なら予定の上の要対応の帯の「要対応を組む」）
- 足す・直す訪問が無ければ確認を出さず、入れなかった予約・読めなかった行があれば欄の誤りに「入れる訪問はありませんでした」と一緒に、無ければ「変更はありませんでした」の知らせ。読み込みの部品を読めなかった（新しい版の公開）ときは Excel の欄と同じ「画面を読み直す」の文

#### 初期状態に戻す

- 「初期状態に戻す」：デモの架空の事業所のデータ（今日から7日分の担当を含む）に戻す（独自の確認。危険の色）。機能の入り切りはそのまま。最初の2問の問2の答え（単発／定期。`store/start.ts` の印 `vrdemo:booking:last`）が残っていれば「デモ×その答え」のデータ（単発＝単発のデモ・お客様／シッター、定期＝初期データ）、無ければ（印 `all` のときも）定期の初期データ。説明と確認の本文に「機能の入り切り（管理者設定）はそのまま」。取り消すと知らせなし、確定で知らせ。戻したあと、今日〜翌月末の要対応（担当なし・間に合わない・重なり・休みの人）を1回自動で組む（要対応の帯の［要対応を組む］と同じ処理・知らせ・［元に戻す］。印 `all` のときは組まない。PRD D409）
- 「画面を読み直す」

#### 保存領域（`?space=`。D447。ADR-0112）

- 起動時の `location.search` に `space=<英小文字・数字・ハイフン>` があれば、localStorage・sessionStorage のキーに `vrdemo:space:<space>:` を付けて読み書きする（`store/storageSpace`。`appLocalStorage()`・`appSessionStorage()`。store・lib・画面は `globalThis.localStorage` を直接触らず、これを使う。lib は Storage を引数で受ける）
- 領域のときの別のタブの同期（`storage` イベント）は接頭辞付きのキーだけ、普段は接頭辞付きのキーを無視する。書き出し・初期状態に戻す・片づけは、その領域のキーの中だけに効く
- 領域のときは上の帯に小さく「説明用のデータ」（`space-badge`）を出す

#### 古い訪問を片づける

- 欄 `section.data-tidy`（`data-tidy-card`・`tabIndex=-1`・`:focus` で枠）。説明「保存の容量が足りなくなったときに使います。選んだ月より前の、担当を組んだ・変えた訪問と確定した内容を消します」
- 消す範囲（`data-tidy-month`。今月〜12か月前。既定は3か月前。`lib/tidy` の `tidyMonthOptions`）
- 見込み（`data-tidy-preview`。`tidyPreview`・`tidyPreviewText`。保存した訪問・`snapshots`・`reassigns`）「N日分の訪問 N件・確定した内容 N日分（約 NKB 空きます）」／無ければ「〈年〉年〈月〉月より前に消せる訪問の記録はありません」
- 押すと独自の確認（危険の色。件数・空く見込み・繰り返しの回は繰り返しのとおりに戻る・単発の訪問は消える・戻せない）。確定で `tidyOld` を1回の `update`、トースト「〈年〉年〈月〉月より前の訪問の記録を消しました」。0件なら押せない

#### データを守る知らせ（画面全体。`components/DataNotices.tsx`）

- 壊れたデータの知らせ（`BrokenDataNotice`・`data-broken-notice`。管理者の画面の本文の先頭）：保存していたデータが読めず初期データで開いたら（`useDemoData().broken`）、注意の色の帯「保存していたデータを読めなかったため、初期データで開きました。元のデータはこのブラウザに残しています。…」（退避できなかった（`brokenKept` が false）なら「元のデータを退避できませんでした。今すぐ書き出してください。」）と「読めなかったデータを書き出す」（`data-broken-download`。`brokenText()`＝`vrdemo:data:broken` の元の文字（退避できなければ開いたときに覚えた文字）を `staff-assign-demo-broken-YYYY-MM-DD.json` に。`saveBlob`）と結果（`data-broken-message`）。閉じる（`data-broken-close`・aria-label「読めなかったデータの知らせを閉じる」）でフォーカスは画面の見出し。閉じたことは保存しない。印刷で出さない
- 控えの知らせ（`DataWatch`）：起動したとき1回だけ、確定した日が1日以上あり、最後に書き出した日から14日以上（まだなら常に）、今日まだ知らせていなければトースト「控え（バックアップ）を2週間以上書き出していません。データの画面で書き出せます」（`shouldRemindBackup`。1日1回まで）
- 別のタブの変更（`DataWatch`）：読み直したらトースト「別のタブで変わったので読み直しました」。人の画面の節・繰り返し・休みに変更があるとき（`useDirtyMark`。数は `lib/dirtyForms` の `hasDirtyForm`）は「別のタブで変わりました。保存すると上書きします」（入力はそのまま。描き直したあと（`setTimeout` 0）に見る）

#### ファイル選択（`components/FilePick.tsx`）

- `lib/filePick.ts`（テストあり）：`fileNameText(name)`（「選んだファイル：〈名前〉」・未選択は「ファイルを選んでいません」）、`FILE_PICK_LABEL`（「ファイルを選ぶ」）
- 見出し（`caption`）・見えない形の `input type="file"`（`opacity: 0`。見た目のボタンと同じ大きさで重ねる `.file-pick-hit`。`display: none` にしない）・見た目のボタンの `label`（`htmlFor`・`aria-hidden`）・選んだファイルの文
- 名前は `aria-labelledby`＝見出し＋ボタンの文、説明は `aria-describedby`＝選んだファイルの文。フォーカスの枠は `input:focus-visible + label`。Space で選ぶ画面
- 選んだら `onPick(file)` を呼び、input の値を空に戻す（同じファイルをもう一度選べる）。`testId` で `-input`・`-name` も付ける
- 使う所：控え・Excel・予約の CSV・名簿の欄（`RosterCard`）

### 管理者設定（`#/settings`）

- メニュー「設定」の「管理者設定」のタブ（見出しの下に設定のタブ）。だれでも開ける。土台で切れない。`lead`「使う機能だけを入れると、メニューと画面がすっきりします。切った機能のデータは消えません」。主ボタンは置かない（スイッチはその場で保存）。並びは ひな形 → 機能の入・切（1枚）→ メールの予約送信。データを作り直す操作は置かない（データの画面。ADR-0092）
- 長い説明は ⓘ（`Hint`。ラベル「説明」、読み上げ「〈名前〉の説明」）と「詳しく ▾」（`DetailsFold`）に畳み、閉じて始める（開閉は覚えない）
- ひな形（`feature-templates`）：見出しの横に「いま：〈名前〉」（`feature-template-current`。どれとも違えば「いま：カスタム」`feature-custom`。読み上げ「今のひな形：〈名前〉」）。5つは「詳しく ▾」（`feature-templates-fold`）の中（`feature-template`。今のひな形に「いまの設定」`feature-template-now`）。1つずつ 名前・例（`feature-template-example`「例：…」）・説明（呼び方を入れる）・基本との差の行（`feature-template-delta`「基本に足す：…」「基本から外す：…」。`lib/settingsView` の `templateCardText`）。「適用」（`feature-template-apply`・aria-label「ひな形「〈名前〉」を適用する」）は独自の確認で `templateDiff`（入る機能・切れる機能）を出し、取り消すと変わらない。説明「よく使う組み合わせを一度に適用します。適用したあとも、下のスイッチで1つずつ直せます。」
- 機能の入・切の1枚（`pages/featureRows` の `FeatureSwitchesCard`・`feature-switches`。見出し「機能の入・切」と説明1行）の中に、グループ（`FEATURE_GROUPS`＝予定の入れ方／当日・問い合わせ／担当の決め方／勤務・契約／現場との共有／入力の補助／上級（組み方の調整）。ADR-0092）ごと（`feature-group`。見出しに「N / M 入」`feature-group-count`）の行（`feature-row`）：名前・1行の説明・ⓘ・スイッチ（`feature-switch`。`role="switch"`・`aria-checked`。「入」「切」）。ⓘ は説明の下の行。中は「切ると隠れるもの：…」（`feature-hides`）と、依存先が入のときの注記「「〈名前〉」が入っているときに使えます」（`feature-req-note`）。依存先が切なら注記「「〈名前〉」を入れると使えます」を行に出し、スイッチは aria-disabled。スイッチの aria-describedby は説明・（押せないときの）依存の注記・hidden の写し（`feature-sr`）を指す（閉じた `<details>` の中は読まないため）
- 押すとすぐ保存（`update`）とトースト「〈機能〉を入れました／切りました」
- 切るときデータがあれば `turnOffImpact` の件数と効き方の確認。データが無ければ確認なし。取り消すと変わらない
- 切った機能の URL を開くと予定の画面（`homePath`）へ移り、閉じられる知らせと管理者設定へのリンク（`FeatureOffNotice`）
- 390px で横にはみ出さない。印刷で知らせ・「適用」を出さない
- 「メールの予約送信（Google）」のカード（`pages/mailScheduleSettings`・`mail-schedule-settings`。いつも出す。[mail-schedule.md](mail-schedule.md)）：1行の説明（確定するときにまとめて Google に預け、前日の時刻に自動で送る）と ⓘ（aria-label「メールの予約送信の説明」。中は `mail-schedule-notes`：遅れる分数・Google のアカウントを通ること・使わないときは「メールを作る」で送れること）、手順の4行は「詳しく ▾」（`mail-schedule-steps-fold`。見出しの横に「手順 4つ」。ひな型のコピーのリンク `mail-schedule-template`。`GAS_TEMPLATE_URL` が空なら「まだ用意されていません」）、欄 `mail-schedule-url`・`mail-schedule-token`（password）・`mail-schedule-time`（time）、`mail-schedule-test`「接続を試す」・`mail-schedule-save`「保存」・`mail-schedule-clear`「この端末の設定を消す」（確認つき。設定があるときだけ）。誤りは押したあとに欄ごと（`settingsErrors`）。つないでいれば見出しに「つないでいます」
- データの画面のいちばん下に「最初の設定をやり直す」のカード（`pages/RestartCard`・`restart-first-run`。ADR-0092）：畳まない注意「いまのデータは消えます。」（`restart-first-run-warn`）と［最初の設定をやり直す］（`restart-first-run-button`。説明1行 `RESTART_HINT`。デモのデータに戻すのもここで「デモで試す」を選ぶ）。「デモの初期状態に戻す」はデータの画面に置かない（画面が壊れたときの例外の画面の「初期状態に戻す」は残す）。最初の設定をやり直すは独自の確認（危険の色。本文は `lib/firstRun` の `restartConfirmBody`：元に戻す（Ctrl+Z）の対象外なので先に書き出す案内と、1世代の控えの文 `keepNote`）。OK で `askFirstRun()`（2問の画面 `components/FirstRunPage` へ。答えるまで今のデータのまま・読み直すと元のデータで開く）。答えると `startFirstRun(answer)` が1世代の控えを残してデータを作り直し、最初の画面（デモ＝週／月、自分のデータ＝登録の案内）へ移る

### 完了の条件

- [ ] 控えと Excel が同じファイル選択の部品・「ファイルを選ぶ」と未選択の文・input は見えない形・名前・Tab と枠・Space・確認・同じファイルをもう一度・Excel の誤り・名簿は一覧へのリンク（`lib/filePick` のテスト・`scripts/e2e-tour.cjs`）
- [ ] 初期状態に戻したあと「直前の状態に戻す」で戻る・書き出すと最後に書き出した日が今日になる・片づけで古い訪問と確定した内容が消え新しいものは残る・壊れたデータの知らせと書き出し（`store`・`lib/backupReminder`・`lib/tidy` のテスト・`scripts/e2e-tour.cjs`）
- [ ] 管理者設定：ひな形の5通りごとにメニュー・下のタブ・パレット・画面の中の入口・ルートの移し先、相性を切るときの確認（`scripts/e2e-features.cjs`）
