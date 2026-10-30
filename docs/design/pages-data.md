# データの画面と管理者設定

> この画面のファイル：`src/pages/DataPage.tsx`（画面は組み立てだけ。状態と処理は同じディレクトリの `useDataBackup`（`useLastExport`・`useDataBackup`・`useDataRestore`）・`useDataExcel`・`useDataTidy`・`useDataTerms`、見た目は `dataParts.tsx`（保存の誤り・直前の状態に戻す・呼び方・控え（JSON）・古い訪問を片づける・使い方の案内・初期状態に戻す）・`dataExcel.tsx`（Excel の欄。全体のブック）、文と判定は `src/lib/dataScreen.ts`）・`SettingsPage.tsx`（`settings.css`）、`src/components/FilePick.tsx`（`filePick.css`）・`Tour.tsx`、`src/lib/filePick.ts`・`features.ts`・`backupReminder.ts`・`tidy.ts`・`dirtyForms.ts`、`src/components/DataNotices.tsx`（`dataNotices.css`）・`dirtyForms.ts`（`useDirtyMark`）。関連 ADR：0006・0020・0025 追記・0028・0032・0043・0068。関連 PRD：D191〜D193・D210〜D216・D227・D260。
> Excel の変換は design.md の「excel」、機能の表と判定は design.md の「features」。

### データ（`#/data`）

メニューの「設定」の「データ」のタブ（土台。切れない。見出しの下に設定のタブ。PRD D275）。

#### 注意書き・呼び方

- 「データは**このブラウザの中だけ**に保存し、サーバーには送りません。実在の人の名前・住所などの個人情報は入れないでください。」（〈利用者さん〉の決まりごとの注意書きと同じ文）。保存できなければ「保存できませんでした：…。書き出して保管してください。」
- 画面での呼び方（`Term` `terms`）：訪問する人・訪問先（各10文字まで）と「変える」。同じ呼び方は使えない。呼び方もデータに保存され、書き出しに入る
- 容量超過（`QUOTA_MESSAGE`）のときは、保存できなかった文の下に「古い訪問を片づける」（`data-tidy-go`）。押すと片づけの欄へ巻いてフォーカス（枠が見える）

#### 直前の状態に戻す（PRD D227。ADR-0032）

- 1世代の控えがあるときだけ、注意書きの下に欄（`data-prev-card`・aria-label「直前の状態に戻す」）。文（`data-prev-text`）「10/19 14:03 の『初期状態に戻す』の前の状態に戻せます」（`lib/backupReminder` の `previousText`。日本時間）
- 控えを残す操作（操作の名前）：初期状態に戻す（「初期状態に戻す」）・控えの読み込み（「控えの読み込み」）・Excel 全体の読み込み（「Excel 全体の読み込み」）・名簿の読み込み（「〈呼び方〉の名簿の追加・更新／総入れ替え」）。確認の本文の最後に見込み（`canKeepPrevious()`）で「いまのデータは控えとして1つだけ残し、この画面の「直前の状態に戻す」で戻せます。」（名簿は一覧から読むので「データの画面の」）、残せない見込み（保存が使えない・最後の保存が容量超過）なら「控えを残せません：容量不足。」。確認で OK になってから `keepPrevious(reason)` で残す（取り消す・確認中に閉じると控えは変わらない）。見込みに反して残せなければ、操作は止めずに完了のトーストに理由を添える（「初期状態に戻しました（控えを残せません：容量不足）」）。名簿が入らなかったら `cancel()` で前の世代に戻す
- 「直前の状態に戻す」（`data-prev-restore`）：独自の確認（危険の色。本文「〈文〉。いまのデータは控えと入れ替わり、もう一度「直前の状態に戻す」で戻せます。」）。確定で `restorePrevious()`（いまのデータを「直前の状態に戻す」として控え、控えのデータにする）とトースト「直前の状態に戻しました」。控えが無くなっていた・読めない・いまのデータを控えに残せない（「いまのデータを控えに残せないため戻せません：容量不足」。戻さず、控えは元のまま）ときはトーストで理由
- 別のタブで控えが変わったら（storage イベント）欄を読み直す
- 保存の容量が足りず控えを捨てたら（`previousDrops`）欄を消し、トースト「容量が足りないため、直前の状態の控えを消しました」（`DataWatch`）

#### 最後に書き出した日（PRD D227）

- 「ファイルに書き出す」の下に「最後に書き出した日：10/12（7日前）」（`data-last-export`。同じ日は「今日」、まだなら「まだ書き出していません」、Excel 全体なら「（Excel 全体）」を添える。`exportAgoText`）
- 控え（JSON）と Excel 全体の書き出しで更新（名簿だけの書き出しは数えない）。このブラウザの記録（`store/backup.ts` の `backupMemory`）で、データには入れない

#### 控え（バックアップ。JSON）

- `Term` `backup`。「ファイルに書き出す」（データ一式（訪問の担当・伝えた内容・振り直し・組み方の標準の記録も）を1つの JSON に）。説明は「丸ごとの控え・別の端末へ移す用。中身を直すファイルではない」と、`excel` が入なら「人が見て直すなら Excel（確定などの記録は入らない）」。版1の控えのファイルは「データの形が変わったので初期データで始めます」で読み込まない（ADR-0053）
- 読み込みは `FilePick`（`backup-file`・caption「読み込む控え（JSON）」）。選ぶと、置き換える前に確認する

#### Excel（ADR-0006・ADR-0068）

- 欄 `section.data-excel`（data-testid `excel-card`・`aria-labelledby` は見出し）。`excel` を切っていれば欄ごと出さない（控えは残す）
- 全体のブックだけ：〈スタッフ〉・〈利用者さん〉・項目・条件・相性・稼働時間・訪問のシートごとの一覧。読み込むといまのデータがその内容に置き換わる（訪問の担当もブックのとおり。伝えた内容・振り直し・組み方の標準の記録はブックに無いので今のものを残し、変わった所は「未連絡の変更」になる）。説明の最後に、丸ごとの控え・移すときは JSON と書く。書き方はブックの「使い方」のシート
  - 別の事業所のブック：ブックの事業所名がいまと違えば（`lib/dataScreen` の `otherOrgOf`。事業所に ID は無いので名前で見る）、確認の題名を「別の事業所の…」にし、本文で両方の名前と、いまの確定・振り直し・組み方の標準の記録を消すことを書く（`workbookConfirmBody`）。OK なら `withoutOrgState` で外してから置き換える
- 名簿（〈利用者さん〉・〈スタッフ〉の一覧だけ。Excel・CSV）は各一覧の名簿の欄（[pages-clients.md](pages-clients.md)「名簿の欄」）。欄の中に一覧へのリンク（`excel-roster-note`）
- 「Excel に書き出す」と読み込み `FilePick`（`excel-file`・caption「読み込む Excel（全体）」）

#### 使い方の案内・初期状態に戻す

- 「案内をもう一度見る」（`tour-again`。`useTour()`）：短い案内（3枚）を1枚目から開く。初めて開いたときには自動で出さない（最初の2問に置き換えた。PRD D379）ので、ここだけが入口。見たかは覚えない
- 「初期状態に戻す」：デモの架空の事業所のデータ（今日から7日分の担当を含む。PRD D322）に戻す（独自の確認。危険の色）。機能の入り切り（管理者設定）はそのまま（PRD D216）。最初の2問の問2の答え（単発／定期。`store/start.ts` の印 `vrdemo:booking:last`。個人の情報は持たない）が残っていれば「デモ×その答え」のデータ（単発＝単発のデモ・お客様／シッター、定期＝今の初期データ）で作り直し、無ければ（印 `all` のときも）定期の初期データ。説明と確認の本文に「機能の入り切り（管理者設定）はそのまま」と書く。取り消すと知らせなし、確定で知らせ
- 「画面を読み直す」

#### 古い訪問を片づける（PRD D227。ADR-0032・ADR-0053）

- 欄 `section.data-tidy`（`data-tidy-card`・`tabIndex=-1`・`:focus` で枠）。説明「保存の容量が足りなくなったときに使います。選んだ月より前の、担当を組んだ・変えた訪問と確定した内容を消します」
- 消す範囲（`data-tidy-month`。今月〜12か月前。既定は3か月前。`lib/tidy` の `tidyMonthOptions`）
- 見込み（`data-tidy-preview`）「N日分の訪問 N件・確定した内容 N日分（約 NKB 空きます）」／無ければ「〈年〉年〈月〉月より前に消せる訪問の記録はありません」（`lib/dataScreen` の `tidyPreviewText`）（`tidyPreview`。保存した訪問・`snapshots`・`reassigns`）
- 押すと独自の確認（危険の色。件数・空く見込み・繰り返しの回は繰り返しのとおりに戻ること・単発の訪問は消えること・戻せないこと）。確定で `tidyOld` を1回の `update`、トースト「〈年〉年〈月〉月より前の訪問の記録を消しました」。0件なら押せない

#### データを守る知らせ（画面全体。`components/DataNotices.tsx`。PRD D227）

- 壊れたデータの知らせ（`BrokenDataNotice`・`data-broken-notice`。管理者の画面の本文の先頭）：起動したとき保存していたデータが読めず初期データで開いたら（`useDemoData().broken`）、注意の色の帯「保存していたデータを読めなかったため、初期データで開きました。元のデータはこのブラウザに残しています。…」（退避できなかったとき（`brokenKept` が false）は「元のデータを退避できませんでした。今すぐ書き出してください。」）と「読めなかったデータを書き出す」（`data-broken-download`。`brokenText()`＝`vrdemo:data:broken` の元の文字（退避できなければ開いたときに覚えた元の文字）をそのまま `visit-route-demo-broken-YYYY-MM-DD.json` に。`saveBlob`）と結果（`data-broken-message`）。閉じる（`data-broken-close`・aria-label「読めなかったデータの知らせを閉じる」）でフォーカスは画面の見出し。閉じたことは保存しない（次に読めれば出ない）。印刷で出さない
- 控えの知らせ（`DataWatch`）：起動したとき1回だけ、確定した日（担当の決まった訪問のある伝えた内容）が1日以上あり、最後に書き出した日から14日以上（まだなら常に）、今日まだ知らせていなければトースト「控え（バックアップ）を2週間以上書き出していません。データの画面で書き出せます」（`shouldRemindBackup`。知らせた日を覚え1日1回まで）
- 別のタブの変更（`DataWatch`）：別のタブでデータが変わり読み直したらトースト「別のタブで変わったので読み直しました」。〈スタッフ〉・〈利用者さん〉の画面の節・繰り返し・休みに変更があるとき（`components/dirtyForms` の `useDirtyMark`。数は `lib/dirtyForms` の `hasDirtyForm`）は「別のタブで変わりました。保存すると上書きします」（入力はそのまま。変更があるかは、読み直したデータで描き直したあと（`setTimeout` 0）に見る）

#### ファイル選択（`components/FilePick.tsx`。PRD D192）

- `lib/filePick.ts`（純粋関数。テストあり）：`fileNameText(name)`（「選んだファイル：〈名前〉」・未選択は「ファイルを選んでいません」）、`FILE_PICK_LABEL`（「ファイルを選ぶ」）
- 見出し（`caption`）・見えない形の `input type="file"`（`opacity: 0`。見た目のボタンと同じ大きさで重ねる `.file-pick-hit`。`display: none` にしない）・見た目のボタンの `label`（`htmlFor`・`aria-hidden`）・選んだファイルの文
- 入力欄の名前は `aria-labelledby`＝見出し＋ボタンの文、説明は `aria-describedby`＝選んだファイルの文。フォーカスの枠は `input:focus-visible + label`。Space で選ぶ画面
- 選んだら `onPick(file)` を呼び、input の値を空に戻す（同じファイルをもう一度選べる）。`testId` で `-input`・`-name` も付ける
- src のファイル選択は控えと Excel の2つだけ

### 管理者設定（`#/settings`。ADR-0028。PRD D210〜D216）

- メニューの「設定」の「管理者設定」のタブ（見出しの下に設定のタブ。PRD D275）。だれでも開ける。土台で切れない。`lead`「使う機能だけを入れると、メニューと画面がすっきりします。切った機能のデータは消えません」。主ボタンは置かない（スイッチはその場で保存）
- ひな形（`feature-templates`）：5つ（`feature-template`。今のひな形に「いまの設定」`feature-template-now`、どれとも違えば「カスタム」`feature-custom`）。「適用」（`feature-template-apply`・aria-label「ひな形「〈名前〉」を適用する」）は独自の確認ダイアログで `templateDiff`（入る機能・切れる機能）を出し、取り消すと変わらない。説明「よく使う組み合わせを一度に適用します。適用したあとも、下のスイッチで1つずつ直せます。」
- グループ（`FEATURE_GROUPS`＝予定／当日・問い合わせ／人／AI の条件／連絡／データ。メニューの項目とは別に、機能を探しやすい分け方）ごと（`feature-group`）の行（`feature-row`）：名前・1行の説明・「切ると隠れるもの：…」・依存の注記（依存先が切なら「「〈名前〉」を入れると使えます」で押せない、入なら「「〈名前〉」が入っているときに使えます」）とスイッチ（`feature-switch`。`role="switch"`・`aria-checked`。「入」「切」）
- 押すとすぐ保存（`update`）とトースト「〈機能〉を入れました／切りました」
- 切るときデータがあれば `turnOffImpact` の件数と効き方の確認（相性など）。データの無い機能は確認なし。取り消すと変わらない
- 切った機能の URL を開くとホームへ移り、閉じられる知らせと管理者設定へのリンク
- 390px で横にはみ出さない。印刷で知らせ・「適用」を出さない
- いちばん下に「メールの予約送信（Google）」のカード（`pages/mailScheduleSettings`・data-testid `mail-schedule-settings`。メールの機能が入のときだけ。PRD D366。ADR-0069）：説明、手順の4行（ひな型のコピーのリンク `mail-schedule-template`。`GAS_TEMPLATE_URL` が空なら「まだ用意されていません」の文）、欄 `mail-schedule-url`・`mail-schedule-token`（password）・`mail-schedule-time`（time）、`mail-schedule-test`「接続を試す」・`mail-schedule-save`「保存」・`mail-schedule-clear`「この端末の設定を消す」（確認つき。設定があるときだけ）。誤りは押したあとに欄ごと（`settingsErrors`）。つないでいれば見出しに「つないでいます」
- 「最初の設定をやり直す」のカード（メールの予約送信のカードの下、いちばん下。`pages/RestartCard`・data-testid `restart-first-run`・ボタン `restart-first-run-button`。PRD D381。ADR-0073）：独自の確認（危険の色。本文は `lib/firstRun` の `restartConfirmBody`：元に戻す（Ctrl+Z）の対象外なので先にデータの画面で書き出して控えを残す案内と、1世代の控えの文 `keepNote`）。OK で `askFirstRun()`（2問の画面 `components/FirstRunPage` へ。答えるまで今のデータのまま・読み直すと元のデータで開く）。答えると `startFirstRun(answer)` が1世代の控えを残してデータを作り直し、最初の画面（デモ＝週／月、自分のデータ＝登録の案内）へ移る。

### 完了の条件

- [ ] 控えと Excel が同じファイル選択の部品・日本語の「ファイルを選ぶ」と未選択の文・input は見えない形・名前・Tab と枠・Space・確認・同じファイルをもう一度・Excel の誤り・名簿は一覧へのリンク（`lib/filePick` のテスト・`scripts/e2e-tour.cjs`）
- [ ] 「案内をもう一度見る」でツアーが出る・閉じるとフォーカスがボタンへ戻る（`scripts/e2e-tour.cjs`）
- [ ] 初期状態に戻したあと「直前の状態に戻す」で戻る・書き出すと最後に書き出した日が今日になる・片づけで古い訪問と確定した内容が消え新しいものは残る・壊れたデータの知らせと書き出し（`store` と `lib/backupReminder`・`lib/tidy` のテスト・`scripts/e2e-tour.cjs`）
- [ ] 管理者設定：ひな形の5通りごとにメニュー・下のタブ・パレット・ホーム・画面の中の入口・ルートの移し先、相性を切るときの確認（`scripts/e2e-features.cjs`）
