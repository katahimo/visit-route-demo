# 担当を組むの画面

> この画面のファイル：`src/pages/ArrangePage.tsx`（`arrange.css`。区画 `arrangeParts.tsx`・始める処理 `useArrangeStart.ts`）、`src/lib/arrange.ts`（範囲の読み取り・見込み・担当なしと要対応の数え方）、`src/lib/monthBatch.ts`（計算の入れ物）・`monthBatchDay.ts`（1日分の計算の純粋関数）、`src/components/batchBand.tsx`（上の帯の進み具合・`MonthBatchHost`）・`scheduleParts.tsx`（`RangeProposalBand`・`confirmDropProposal`）・`SettingsTabs.tsx`、`src/lib/month.ts`（`batchTargets`）。関連 ADR：0042・0053・0063・0065〜0067・0072・0088。関連 PRD：D256・D257・D268・D328・D355・D356・D359〜D363。
> 予定（月・週・日）では AI で組まない（手で直す）。AI で組むのはこの画面と組み方の標準（[pages-standard.md](pages-standard.md)）。予定を組むの最後の段で、標準で埋まらない所を点数の基準で埋める。

### 担当を組む（`#/arrange`）

範囲（月・週・日）を選び、その範囲の担当を AI で組んで提案を出し、見て反映する画面。メニュー「予定を組む」の子「担当を組む」（3つ目。標準があれば2つ目）。

- 予定を組むの段（`ArrangeSteps current="arrange"`）は**いつも出す**（比較の画面 `#/compare` は寄り道なので段を出さない。ADR-0088）：標準が無い間は4段（1 基本情報・2 案をくらべる・3 標準にする・4 担当を組む。2・3 は組み方の標準のその段へ）、標準があれば2段（1 基本情報・2 担当を組む）
- 標準があれば見出しの右に［標準の組み方を変える］（`arrange-change-standard`。枠のボタン。`/standard` の 2 案をくらべるの段）
- エキスパート機能（`expert`）が切なら、段・標準の案内・［標準の組み方を変える］・案を比べるを出さず、標準が無くても点数の基準のプリセットで「AI で組む」を出す。メニューには出さず、日の予定の［この日の担当を組む］から開く

#### URL とクエリ

| クエリ | 意味 |
|---|---|
| `?date=YYYY-MM-DD` | 範囲は日（その日） |
| `?d=YYYY-MM-DD` | 範囲は週（その日の週。月曜からの7日。選ぶと月曜の日付を書く） |
| `?ym=YYYY-MM` | 範囲は月 |
| どれも無い | 範囲は月で、月の後半なら来月・前半なら今月（`lib/scheduleMode` の `planYm`） |

読む順は `?date=` → `?d=` → `?ym=`。選び直すと URL を書き換える（replace。ほかのクエリは残さない）。進み具合の帯・要対応の帯の「基本情報が変わった（組み直す）」は `?ym=`、上の帯・終わった知らせは組んだ範囲（`batchHref`）で開く。

#### 並び

1. 見出し（`PageHeader`。nav は `ArrangeSteps`、標準があれば actions に［標準の組み方を変える］）：題名「担当を組む」・`lead`「範囲を選んで AI で担当を組み、提案を見て反映します。予定（月・週・日）では手で直します」
2. 組み直しの知らせ（`arrange-basis-changed`。下の「組み直しの知らせ」）
3. 範囲のカード（`arrange-range`）：
   - ［月｜週｜日］（`fieldset.segmented`・`arrange-scope`・`aria-pressed`・`data-scope`）
   - 月なら月の欄（`arrange-month`。今月から6か月と見ている月）、週・日なら日付の欄（`arrange-date`）。横に範囲の呼び名（`arrange-range-label`：「2026年11月」「11/2〜11/8の週」「11/3（火）」）
   - 「今日以降：担当なしの訪問 N件（M日）・要対応 N件」（`arrange-counts`。`arrange-unassigned`・`arrange-care` の `data-count`）。数え方は月の予定と同じ `useDayStatuses`（範囲の今日以降の日だけ）
4. AI で組むのカード（`arrange-run`）：
   - 組む日（ラジオ）：「要対応のある日だけ（N日）」（`arrange-mode-care`。既定）／「伝えていない日をすべて組み直す（N日）」（`arrange-mode-all`）。日は `batchTargets(data, dates, today, mode, statusOf)`（今日以降・伝えていない・計算に入れる訪問がある日。care はそのうち要対応のある日）
   - 「考え方：〈点数の基準のプリセット名〉（点数の基準。替えるのは［標準の組み方を変える］）」（`arrange-basis`。選ぶ欄は置かない）
   - 「組む日：N日（見込み 約a〜b秒／分）」（`arrange-count`。1日 約3〜5秒）
   - 主ボタン「AI で組む」（`arrange-start`。組んでいる間・0日なら `aria-disabled`。組んでいる間は「組んでいます…」）と「元に戻す」「やり直す」（`UndoButtons`）
   - 進み具合（`arrange-progress`。「〈名前〉：M/D・3/22日（組めた日 N日）」とバー）と［止める］（`arrange-stop`）
   - 止まった理由（`FieldError`。`monthBatch.done.error`）
   - 注記：ピンの訪問（手で替えた訪問・組み方の標準の担当）はそのまま・今日より前の日と確定した日は組まない・1日ずつ組み終わったら提案・見て「反映する」と担当が変わる・ほかの画面へ移っても組み続ける
   - 組み方の標準が無いとき（`needsStandard(expert, hasStandard(data))`。範囲にかかわらず）：上の欄を出さず、文（`arrange-need-standard`）「組み方の標準がまだありません。先に「組み方の標準」で、考え方ごとの案をくらべて標準の週を決めてください。標準を決めると、この画面では標準で埋まらない所を AI で埋めます」と主ボタン［組み方の標準を決める］（`arrange-to-standard`。`/standard` の 2 案をくらべるの段）
5. 範囲の提案の帯（`RangeProposalBand`。[pages-common.md](pages-common.md) の「予定の共通の部品」）：［反映する］［捨てる］。日・週・月の予定にも出る
6. 案を比べるのカード（`arrange-compare`。`compare` が切なら出さない）：［〈日〉の案を比べる］（`arrange-compare-open`。`/compare?date=`。日は範囲の今日以降の最初の訪問のある日）だけ。日は比べる画面の上の帯の日付で選び直し、日の予定へは提案の帯の日のリンクかメニューから（日付の欄・［日の予定を見る］は置かない。ADR-0088）

#### 組み直しの知らせ（`lib/arrangeBasis`・`store/arrangeBasis`・`components/useArrangeBasis`）

- 基本情報の鍵（`basisKey(data)`。FNV-1a の短い文字列）：繰り返しの曜日・時刻・所要・繰り返し方・期間（〈利用者さん〉×曜日に開いて見る）、〈利用者さん〉の段階・休み、相性、〈スタッフ〉の休止・勤務日・勤務時間・最終勤務日、勤務時間の上書き。組んだ結果（訪問の担当・いつもの担当・標準の開始）は入れない。AI の提案を反映したとき（`scheduleParts` の反映）と標準を登録したとき（`useStandardRegister`）に覚える（`saveArrangeBasis`。`arrangeBasisMemory`＝localStorage の `vrdemo:arrange:basis`。この端末だけ）
- `useBasisChanged(data)`：覚えた鍵があり今の鍵と違えば真。覚えていなければ偽。メニューの「変更」の印（`MenuBadges.basisChanged`。[pages.md](pages.md)）と知らせで使う
- 知らせ（`ArrangeBasisNotice`・`section.arrange-basis`・`arrange-basis-changed`。標準があるときだけ）：「基本情報が、最後に組んだあとに変わりました（予定・相性・勤務時間（シフト）など）。組み直すと今の基本情報で担当を組みます」・［〈範囲の呼び名〉を組み直す（伝えていない N日）］（`arrange-basis-redo`。組む日を「すべて」にして `start`。組んでいる間・0日なら押せない）・「基本情報を見る」（`arrange-basis-link`。`/basics`）。反映すると鍵を覚え直すので消える

#### 組み始める（`start`）

- 0日なら「組む日がありません（今日より前の日・確定した日は組みません）」
- 反映していない提案があれば `confirmDropProposal`（「反映していない提案（〈名前〉）を捨てて、組み始めますか？」）。残せば組み始めない
- `monthBatch.start({ ym, label, mode, days, today, source: 範囲, rangeStart })`。名前は「11月」「11/2〜11/8の週」「11/3」。組んでいれば始めず知らせ
- 上の帯（`BatchBand`）は担当を組むと月の予定では出さない。ほかの画面では「〈名前〉の担当を組んでいます N/M日」（行き先 `batchHref`）と［止める］
- 終わった知らせ（`batchDoneText`）：提案の帯が見える画面（担当を組む・日・週・月の予定）にいれば［担当を組むを開く］を出さない。担当を組むにいれば提案が無くても出さない

#### `lib/monthBatch.ts`（計算の入れ物。テストあり）

画面は始める・止めるだけを頼み、計算はモジュールの入れ物で続ける（画面を移っても止めない。閉じる・読み直すと止まり、提案は消える）。

- `createMonthBatch(solve = runSolve)`：`run`（`BatchRun`＝`{ ym, label, mode, source, rangeStart, targets, index, made, iteration, total }`。組んでいなければ null）・`done`（`BatchDone`＝`{ ym, label, source, rangeStart, made, unassignedDays, stopped, error, aborted, proposal }`。`proposal` は `{ moved, shifted }`）・`proposal`（`BatchProposal`＝`{ id, ym, label, source, rangeStart, days: ProposalDay[], stopped }`。`ProposalDay`＝`{ date, problem, visits, inputs, routes, diff, unassigned }`）・`start`（前の提案は捨てる）・`apply`・`discard`・`stop`・`abort`・`running`・`connect`（`BatchHost`＝`{ get, update(fn, label?) }`）
- `BatchJob`＝`{ ym, label, mode, days: { date, mode }[], source: 'month' | 'week' | 'day', rangeStart?, today }`。条件は点数の基準にそろえた `data.rules`
- 1日ずつ：組んでいる間に確定した日は飛ばす。手のピンと標準のピン（`aiPinsOf`）を渡して compile し、Worker で解いて日ごとの提案（組み始めたときの訪問・入力 `dayInputsOf`・担当の並び・差）にする。訪問には書かない
- `proposalCounts(p)`・`proposalDayFresh(data, day)`（訪問が組み始めたときのまま・入力（欠勤・希望休・稼働時間の上書き・〈利用者さん〉の休み、人・条件・種類・相性・繰り返し）が同じ・伝えていない）・`applyProposal(data, p)`（そのままの日だけ `writeRoutes`）
- 反映する（`apply({ label? })`）：1回の update（手の名前「AI の提案を反映（〈名前〉）」）。全体の「元に戻す」で1手戻る
- `proposalDayChanges(day)`：変わる訪問（`{ visitId, clientId, at, kind: 'staff' | 'time', from, to, minutes }`。提案での開始の順）
- `batchBandText`・`batchDoneText`・`weekLabel`（「11/2〜11/8の週」。1日は `lib/dateText` の `mdText`「11/3」）・`batchHref`（月 `/arrange?ym=`・週 `/arrange?d=〈月曜〉`・日 `/arrange?date=`）
- `components/batchBand.tsx` の `MonthBatchHost`（App の直下に1つ）：store の data と update をつなぎ、データを丸ごと差し替えたら止めて提案を捨てる（`abort`）。終わったら知らせ

#### 完了の条件

- [ ] 範囲の既定は月（今月か来月）。［月｜週｜日］で `?ym=`・`?d=`（月曜）・`?date=` に書き、URL から開ける。担当なし・要対応の件数が出る（`scripts/e2e-arrange.cjs`）
- [ ] 「AI で組む」で提案の帯が出て、反映するまで訪問は変わらない。［反映する］で担当が入り、「元に戻す」で1手戻る。［捨てる］で何も変えない。考え方の選ぶ欄は無く「考え方：〈点数の基準〉」（`scripts/e2e-arrange.cjs`）
- [ ] 段がいつも出る。標準があれば［標準の組み方を変える］で 2 案をくらべるの段へ。基本情報が変わると知らせと［組み直す］が出て、組み直すと消える（`scripts/e2e-arrange.cjs`・`scripts/e2e-standard.cjs`）
- [ ] 「案を比べる」で比較の画面へ移り、戻れる（`scripts/e2e-arrange.cjs`）
- [ ] 組み始めるとほかの画面へ移っても続き、上の帯に進み具合と［止める］。止めるとそこまでの日の提案。知らせから担当を組むへ（`scripts/e2e-progress.cjs`・`scripts/e2e-week.cjs`）
- [ ] 標準が無いと AI で組む欄を出さず［組み方の標準を決める］で `#/standard` へ。標準を登録すると「AI で組む」が出る（`scripts/e2e-arrange.cjs`）
- [ ] 390px で横にはみ出さない（`scripts/e2e-arrange.cjs`）
