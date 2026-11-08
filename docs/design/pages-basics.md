# 予定と相性の画面

> この画面のファイル：`src/pages/BasicsPage.tsx`（`settings.css`・`basics.css`。表とマスの欄 `basicsParts.tsx`）、`src/lib/basicsView.ts`（行・マス・勤務時間の外・時刻の入力と書き換え。純粋関数。テストあり）、`src/components/SettingsTabs.tsx` の `PeopleTabs`。関連 ADR：0054・0100。関連 PRD：D326・D362・D394。
> タブの先は [pages-clients.md](pages-clients.md)・[pages-compat.md](pages-compat.md)。人のタブは [pages-nav.md](pages-nav.md)。

### 予定と相性（`#/basics`）

〈利用者さん〉の繰り返しの時刻・いつもの担当・相性・勤務時間を1枚の表で確かめて直す画面。入切とも〈利用者さん〉の小さいタブ（一覧・予定と相性・相性。`PeopleTabs`）の1つで、メニューの印は〈利用者さん〉。

- 見出し（`PageHeader`。`nav` は `PeopleTabs`）：題名「予定と相性」・`lead`「〈利用者さん〉の予定（繰り返し）と、いつもの担当・相性・勤務時間（シフト）を1枚の表で確かめて直します」
- 繰り返しが無ければ「繰り返しの予定がありません。〈利用者さん〉の画面で繰り返しを追加します」（`basics-empty`。〈利用者さん〉は `/clients` へのリンク）
- あれば要約（`basics-summary`）「繰り返し N件。時刻を押すと直せます。名前を押すと〈利用者さん〉・〈スタッフ〉の画面へ」。勤務時間の外のマスがあれば「。勤務時間の外の担当 N か所」（`basics-issue-count`。警告の色）
- 表（`basics-table`）の下に注記「相性を直すのは「相性」のタブ、勤務日・勤務時間を直すのは〈スタッフ〉の「勤務」のタブ」

#### 表（`BasicsTable`。`basicsRows(data, today, compatOn)`）

- 行＝利用中の〈利用者さん〉の、今日以降に続く繰り返し（`basicsPatterns`。「いつから」で分けた前の側は除く。`basics-row`・`data-pattern`）。並びは名前順（日本語）、同じなら最初の曜日。行の見出しは〈利用者さん〉の名前（`/clients/:id`。`basics-client-link`）と `patternWhenText`・所要（「月・木 10:00・60分」）。左の列は横に巻いても残る
- 列＝どれかの行にある曜日（月曜はじまり。`basicsWeekdays`）。繰り返しに無い曜日のマスは「—」（読み上げ「なし」）。右端に「相性」の列（`compat` が入のときだけ）。表は `.basics-grid-scroll` の中で横に巻く（390px ではみ出さない）
- マス（`basics-cell`・`data-pattern`・`data-weekday`・`data-issue`）：時間の約束（`timesOn`。ちょうどなら開始、幅なら「開始（早）〜開始（遅）」。`basics-time`）・いつもの担当（`usualStaffId`。〈スタッフ〉の画面へのリンク `basics-staff-link`。無ければ「担当なし」）・その組の相性の記号（◎○△×。色は相性の表と同じ。読み上げは意味）。担当が行けなければ札（`basics-issue`）：休止中（最終勤務日の後も）／勤務日でない／勤務時間外（開始（早）が勤務の始まりより前、または開始（遅）＋所要が勤務の終わりを超える）。判定は `shiftIssue`（基本の勤務日・勤務時間で見る。日ごとの上書きは見ない）。札のあるマスは `is-issue`
- 「相性」の列（`basics-compat`）：その〈利用者さん〉と相性を入れた〈スタッフ〉（◎○△×の順。名前は〈スタッフ〉の画面へ）。無ければ「未入力」。相性の機能が切なら列もマスの記号も出さない

#### マスの時刻を直す

- 時刻（`basics-time`。`aria-expanded`・名前「〈利用者さん〉 月曜の時刻 9:00。押して直す」）を押すと、行のすぐ下に欄（`basics-editor`。`basics-edit-row`）：開始（`basics-editor-early`。ちょうどは「開始」だけ、幅は「開始（早）」と「開始（遅）」（`basics-editor-late`））・［決める］（`basics-editor-ok`）・［閉じる］。開くとフォーカスは開始（早）、Esc・閉じる・決めるで閉じてフォーカスは時刻のマスへ。もう一度押しても閉じる
- 誤り（`basics-editor-error`。`role="alert"`。決めるのあと。`basicsTimeError`）：形が違えば「時刻は 9:30 のように入れてください」、開始（遅）が開始（早）より前なら「開始（遅）は開始（早）以降にしてください」。受け付けない
- 書き先（`changePatternTime`。〈利用者さん〉の画面と同じく今日から分ける `splitPattern`。今日より前の回は変えず、今日からの担当を組んだ回は繰り返しのとおりに戻す）：曜日が1つの繰り返しは共通の時刻（`earliestStart`・`latestStart`。`dayTimes` は空）、2つ以上は曜日ごとの時刻（`dayTimes`。`setPatternTime`）。共通の時刻と同じになればその曜日の上書きを消す。欄の下の文は「〈曜〉曜だけの時刻にします」／「この繰り返しの時刻にします」。担当を組んだ回が戻る・確定した日が変わるなら確認（`patternSplitConfirm`）。知らせ「時刻を直しました（今日から）」
- 毎月のパターンの機能（`patternMonthly`）が切なら、曜日が2つ以上の繰り返しのマスは押せない文字（title「曜日ごとの時刻は名前を押した先の繰り返しで直します」。`canEditTime`）
- store の `update` の1回（手の名前「繰り返しの時刻」）。全体の「元に戻す」で戻せる。自動の組みは走らせない（PRD D407）

#### 完了の条件

- [ ] 〈利用者さん〉のタブに「予定と相性」が入切とも出る。相性のタブで相性の画面へ移れる
- [ ] 表の行が今日以降の繰り返しで、マスに時間の約束・いつもの担当・相性・勤務時間外などの札、右に相性の〈スタッフ〉が出る。名前から人の画面へ移れる
- [ ] 時刻を直せる（曜日が1つは共通・2つ以上は曜日ごと。誤りは受け付けない・Esc で戻る）。1手の「元に戻す」で戻る。相性の機能が切なら相性の列と記号が無い
- [ ] 単体が通る（`lib/basicsView.test.ts`）
