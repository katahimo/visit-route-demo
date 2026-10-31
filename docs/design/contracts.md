# 契約の詳細（design.md §5 から分けた節）

型・既定値・データの版・ブックの形の詳細。正は `src/contracts/` の型。§5 の一覧・費用の物差し・エラー方針・冪等性は [../design.md](../design.md) §5。
コード・文書の「design.md §5「〈節の名前〉」」はこのファイルの同じ名前の節を指す。

## データの1件ずつ（`src/contracts/documents.ts`。ADR-0002・ADR-0011〜ADR-0017・ADR-0028・ADR-0050）

PoC本体の documents.ts からログイン・事業所の分離（email・uid・orgId）を除き、特性と条件を足した（`requiredGender` は性別＋必要条件、`ngStaffIds` は相性 × に）。共通：`hhmmSchema`・`hhmm30Schema`（30分単位）・`dateSchema`・`idSchema`（1〜100字）・`placeSchema`＝`{ address ≤200, lat, lng（null 可） }`・`termsSchema`＝`{ client ≤10, staff ≤10 }`。（　）の既定は無い古いデータの読み方。

| 型 | フィールド |
|---|---|
| `Org` | `name` 1〜100・`industry`（`sitter`/`care`/`nursing`/`other`）・`terms`・`fareYenPerKm` 0〜1000（0＝交通費なし）・`spanLimitHours` 0〜24・0.5刻み（10。0＝注意しない）・`features`（`{}`） |
| `Staff` | `id`・`name` 1〜50・`home`・`travelMode`（`DRIVE`/`BICYCLE`/`WALK`/`TRANSIT`）・`workDays`（0=日〜6=土）・`shiftStart`・`shiftEnd`・`active`・`traits`・`requirements`・`preferences`（訪問先の特性に対して。各20まで）・`lastDay`（最終勤務日。翌日から勤務なし。null）・`email`（''）・`icon`（印の中の1〜2文字。絵文字も可。''＝未設定で苗字の最初の1文字。無い古いデータは ''。版は上げない。schema は形だけ＝前後の空白なし・32コード単位まで。見た目で2文字まで（書記素）は画面の `staffIconError` と Excel の `readStaffIcon` で見る。ADR-0050） |
| `Client` | `id`・`displayName` 1〜50・`kana` ≤50（''）・`place`（＋`postalCode` 空か7桁。''）・`note` ≤500・`color` 0〜7・`active`・`traits`・`requirements`・`preferences`・`tentative`（仮押さえ。false）・`entryNote`・`keyNote`・`parkingNote`・`cautionNote`（各 ≤200。''）・`allowedStaffIds` ≤50（`[]`＝限らない）・`stage`・`referrer`（`name` ≤50・`contact` ≤100・`note` ≤200・`email`。空＝`EMPTY_REFERRER`） |
| `VisitType` | `id`・`name` 1〜20・`color` 0〜7・`durationMinutes` 5〜720（新しい訪問・パターンの初期値だけ）・`requirements` ≤20（常に必須）・`note` ≤200。20まで（`MAX_VISIT_TYPES`） |
| `Pattern` | `id`・`clientId`・`typeId`（null＝問わない）・`weekdays` 1〜7個・`everyWeeks` 1〜4・`repeat`（`'weekly'`/`'monthly'`。`'weekly'`）・`monthWeeks` 1〜5（`[]`）・`dayTimes`（曜日・開始（早）・開始（遅）。7まで。`[]`）・`windowKind`・`earliestStart`・`latestStart`・`durationMinutes`・`from`・`to`（null＝続く）・`usualStaffId`（繰り返しの担当。null＝担当なし。ADR-0053）・`usualStarts`（曜日ごとの標準の開始 `{ weekday, start: HH:mm }`。7まで・同じ曜日は1つ。`[]`。ADR-0062）・`note` |
| `Visit` | `id`・`date`・`clientId`・`windowKind`（`fixed`/`window`）・`earliestStart`・`latestStart`・`durationMinutes` 5〜720・`staffId`（担当。null＝担当なし）・`start`（組んだ開始。null＝開始（早）で並べる）・`pinned`（AI で組み直しても担当を変えない。false）・`cancelled`・`note` ≤200・`typeId`（null）・`pattern`＝`{ id, date: 元の日, edited }`（null＝単発）・`cancelKind`（`'sameDay'`＝当日キャンセル。null）。保存するのは単発と、繰り返しの変えた回だけ（ADR-0053） |
| `Availability` | `staffId`・`date`・`slots`（30分単位。空＝休み）。その日だけの上書き |
| `Absence` | `id`・`staffId`・`date`・`from`・`to`（30分単位。null＝始業から／終業まで、両方 null＝終日）・`note` ≤100。同じ人・同じ日は1件 |
| `ClientLeave` | `id`・`clientId`・`from`・`to`（両端を含む）・`note` ≤100 |

- 検査の文：「終了日は開始日以降にしてください」（パターン・休み）、「開始（遅）は開始（早）以降にしてください」、「毎月のときは第何週かを1つ以上選んでください」、「同じ曜日の時刻が2つあります」、「終了は開始より後にしてください」（欠勤）、稼働時間帯は `slotsError`
- メール：`EMAIL_PATTERN`（空白・@・「,;」・山かっこ・「"?&=%#/」を含まない「文字@文字」）、`emailSchema` は空かこの形・254字まで（入力は `normalizeEmail` で直してから）
- 段階 `CLIENT_STAGES`：`inquiry` 相談受付・`meeting` 顔合わせ・`contract` 契約・`active` 利用中・`ended` 終了。段階が正で `stageFlags(stage, tentative)` が active・tentative を決める（利用中＝true/false、終了＝false/false、その前＝仮押さえしているときだけ予定の対象）。予定・AI で組むは active だけを見る
- 休みの訪問は消さず、取り消しとも別（`edited` も立てない）。compile・画面が `isOnLeave` で外す
- 希望休：終日かつ `note` が `'希望休'`（`REQUESTED_OFF_NOTE`）の欠勤（`isRequestedOff`）
- `'monthly'` では `everyWeeks` を使わない（1にする）。`'fixed'` の `dayTimes` は `latestStart`＝`earliestStart`

## データ一式・伝えた内容・振り直し（`src/contracts/data.ts`。ADR-0008・ADR-0010・ADR-0011・ADR-0020・ADR-0028・ADR-0053）

`STORAGE_KEY = 'vrdemo:data:v1'`（版2も同じキー）、`DATA_VERSION = 2`、`ImportError = { code: 'INVALID_ARGUMENT'; message }`。

```ts
DemoData = { version: 2, baseDate /* seed の基準日 */, seed /* 乱数の種 */, org, items,
  rules /* 重み・必須はいつも点数の基準のプリセットにそろえる */, staff, clients, compat,
  visits /* 保存した訪問：単発と、繰り返しの変えた回 */, availability, absences /* ≤2000 */, visitTypes /* ≤20 */,
  patterns /* ≤2000 */, clientLeaves /* ≤2000 */,
  snapshots /* date → DaySnapshot＝伝えた内容（確定） */, reassigns /* date → ReassignInfo（反映した振り直しの日だけ） */,
  presets /* 1〜6 */, scorePresetId?, standard? /* 組み方の標準を登録した記録。ADR-0062 */ }
StandardInfo = { at /* 登録した時刻 ms */, presetId /* 登録したときの点数の基準 */, from /* いつから */, weeks /* 周期 1〜4 */ }
DaySnapshot = { date, at /* 確定した時刻 ms */, visits: ToldVisit[] /* ≤500。取り消し・休みは入れない */ }
ToldVisit = { id, clientId, staffId /* null＝担当なし */, start /* HH:mm。null 可 */ }
ReassignInfo = { method: 'insert' | 'anneal', stayWeight? /* 案B 0〜5 */, insertRoutes? /* 案A の結果 */,
  baseRoutes /* 振り直す前の担当の並び */, basePins /* 振り直す前のピン */,
  absenceIds /* 取り消されても残し、続けて振り直すと累積 */ }
RosterKind = 'client' | 'staff'; RosterMode = 'merge' /* 既定 */ | 'replace' /* ブックに無い人を終了・休止 */
RosterImportResult = { data /* migrate 済み */, added /* 行の順。「名前（終了）」など */, updated, unchanged: number,
  retired, allowedRemoved /* 休止で担当できる人から外れる〈利用者さん〉 */, allowedEmptied /* 限らないに戻る */,
  lastDaySet, activeBefore /* 外せる人の数 */, source /* ADR-0068 */,
  otherForm /* ほかのソフトの形で読んだときだけ OtherFormRead。名簿の形・.xlsx は null（ADR-0073・ADR-0075） */ }
OtherFormRead = { label /* 形の名前。例「顧客台帳」「予約システムの顧客」 */, skippedColumns: string[] /* 読まなかった列 */ }
BookingImportResult = { data /* migrate 済み */, added, updated, unchanged, cancelledSkipped /* まだ入れていない取り消し済みの予約 */: number,
  unmatched /* 入れなかった予約「名前（N件）」 */, badRows /* 「N行目：理由」 */, source, otherForm: OtherFormRead /* ADR-0075 */ }
```

- その日の割当は訪問から決まる（`lib/dayPlan` の `dayRoutes`：計算に入れる訪問を担当ごとに組んだ開始の順。担当なしは `unassignedOf`）。AI の提案・ドラッグ・担当の変更・振り直し・月や週の AI で組むは `writeRoutes` で担当と開始を訪問に書く
- 日の状態（`toldStateOf`）：`snapshots` に無ければ `'none'`（まだ伝えていない）、伝えた内容と今の差（`toldChanges`。担当が変わる・開始が四捨五入で1分以上変わる訪問）が無ければ `'told'`（確定済み）、あれば `'changed'`（未連絡の変更あり）
- 要対応は訪問ごとの検査（`visitIssues`）：担当なし・担当が休み・条件に合わない・時間に間に合わない（担当が休みの訪問には重ねない）。重みだけを変えても要対応にしない（「条件が変わった」の判定は無い）
- 標準のピン（`lib/dayPlan` の `standardPinsOf`・`aiPinsOf`。ADR-0062）：AI で組む（範囲・日・比べる）ときは、担当できる計算した回の担当をピンにする
- 提案・比較の提案は保存しない（画面の状態）。比較の画面は提案を点数の基準の物差し（`scoreRulesOf`）で採点する

### 版と移行

版2（ADR-0053）。版1（`version: 1`）のデータは移さない：`loadWithStatus` は版1を見つけたら初期データで始め（`outdated: true`）、画面が「データの形が変わったので初期データで始めます」（`OUTDATED_MESSAGE`）と知らせる。控えのファイル（JSON）の読み込みも版1なら同じ文で断る。版2の中で無いものは zod の既定値・`migrate` で読む：`absences`・`visitTypes`・`patterns`・`clientLeaves` は `[]`（null も）、`snapshots`・`reassigns` は `{}`、`presets` は `INITIAL_PRESETS`、`scorePresetId` は repair が先頭、`Visit.start` は null・`pinned` は false、`Pattern.usualStarts` は `[]`、`standard` は無し（登録していない）、〈利用者さん〉の `stage` は `stageOfLegacy`、`org.features` は知らない ID・真偽でない値を捨てオブジェクトでなければ `{}`。ほかは上の表の（　）。

## 項目・条件・プリセット（`src/contracts/rules.ts`。ADR-0002・ADR-0008・ADR-0010・ADR-0035・ADR-0070）

```ts
Item = { id ≤50, name 1〜30, target: 'staff' | 'client', kind: 'flag' | 'choice' | 'multi' | 'number' | 'startYear', options /* 1〜30字・30個 */ }
TraitValue = boolean | string | string[] | number | null   // traits: itemId → 値（null＝未入力）。startYear は西暦の整数
START_YEAR_MIN = 1900; START_YEAR_MAX = 2100; isStartYear(n)   // 西暦の整数でその範囲か
Condition = { itemId, op: 'is' | 'not' | 'in' | 'hasAny' | 'hasAll' | 'gte' | 'lte', value }
  // not は未入力も満たす。未入力はほかの op を満たさない
  // startYear の項目の value は年数で、その日の年 − 開始年（0 未満は 0）と比べる（matches の date。年単位）
RuleType = 'clientRequirement' | 'clientPreference' | 'staffRequirement' | 'staffPreference'
         | 'compatibility' | 'continuity' | 'balance' | 'wait'          // wait 以外は hard にできる（HARDABLE）
Rule = { id ≤50, type, label 1〜40, weight /* 0..5・0.5刻み */, hard }  // 同じ型は複数可（重みは足す）。0 かつ hard でなければ無効
compat[clientId][staffId] = 2 ◎ | 1 ○ | 0 未入力 | -1 △ | -2 ×
Preset = { id ≤50, name 1〜20, note ≤60, weights: RuleType → { weight, hard } }   // 無い型は 0・必須でない
POINTS_PER_WEIGHT = 10; DROP_POINTS = 10000; KEEP_DROP_POINTS = DROP_POINTS * 10; MAX_PRESETS = 6
```

- プリセットはデータ。型ごとの重み・必須を条件の同じ型に上書きする（`applyPreset`）。プリセットの重み・必須は変えず、条件の重みの表で変えた重みは新しいプリセットとして足す（`saveDraftAsPreset`。ADR-0065）。初期の3つと最後の1つは消せない
- 点数の基準のプリセット（`scorePresetId`）＝ふだんの考え方（ADR-0035。PRD D233）：点数はいつもこのプリセットを当てた物差し（`scoreRulesOf`）で付ける。担当を組む・訪問ごとの検査もこれで計算する。組み方の標準の案はすべてのプリセットで作り、案から作った表を登録するとそのプリセットを点数の基準にする（ADR-0065）。条件の重みの画面の表はこのプリセットの重み・必須から始め、変えた重みは新しいプリセットとして足して基準にする（`saveDraftAsPreset`）
- `data.rules` の重み・必須はいつも点数の基準のプリセットと同じ（ADR-0053）。基準が替わる（基準を選ぶ・新しい考え方を保存する・基準のプリセットを消して基準が移る）と `withBasisRules` で基準にそろえ、store の repair も読み込みのたびにそろえる（`lib/presets` の `setScorePreset`・`saveDraftAsPreset`・`removePreset`）。ほかのプリセットは組み方の標準の案・案を比べるの提案を作るときだけ当てる（`applyPreset`）

| 初期のプリセット | 必要条件 | 訪問先の希望 | スタッフの希望 | 相性 | いつもの担当 | 負担の均等 | 待ち |
|---|---|---|---|---|---|---|---|
| `balance` バランス（初期の条件と同じ） | 必須 | 3 | 2 | 3 | 2 | 3 | 3 |
| `travel` 移動を短く | 必須 | 1 | 1 | 1 | 0.5 | 1 | 3 |
| `people` 人の組み合わせ重視 | 必須 | 5 | 4 | 5 | 4 | 3 | 2 |

## 問題・結果・Worker（`src/contracts/problem.ts`。ADR-0003・ADR-0007・ADR-0010）

時刻は0時からの分、移動1分＝1点。

```ts
Problem = { date, staff: { id, name, point, slots /* 欠勤・最終勤務日を引いた時間帯。空＝休み */ }[],
  visits: { id, clientId, point, earliest, latest, duration }[], travel, meters /* [from][to] 自宅と訪問先 */,
  allowed, assignCost, reasons /* [visit][staff]。reasons は点の大きい順 */, waitPerMinute,
  balance: { perVisit, lo, hi, cap /* 必須なら hi+1、ほか null */ } | null, infeasible: { visit, reasons }[], stay? }
Reason = { ruleId, label, points /* 可否の原因は Infinity */, level? /* 相性だけ 2|1|-1|-2 */ }
  // ruleId：Rule.id・'travel'・'wait'・'slot'・'time'・'noPlace'・'visitType'・'allowedStaff'・'pin'
ProblemStay = { staff /* [visit] 元の担当の添字 | null */, start /* [visit] 元の開始 | null */, keep: boolean[], movePoints, minutePoints }
SolveOptions = { seed, iterations, initial?: Routes }
SolveResult = { routes, unassigned, score /* evaluate.score と一致 */, seed, iterations, stopped }
WorkerRequest = { type: 'solve', requestId, problem, options } | { type: 'stop', requestId }
WorkerResponse = { type: 'progress', requestId, iteration, total, bestScore, bestRoutes? /* 最良が変わったときだけ */ }
  | { type: 'done', requestId, result } | { type: 'error', requestId, message }
PlanScore = { total, travelMinutes, waitMinutes, meters, assignPoints, balancePoints, dropped,
  perRule: ruleId → { hits, misses, points }, hardViolations: { visitId, staffId, kind: 'time'|'slot'|'notAllowed', label }[] }
VisitExplain = { visitId, staffId, reasons /* 3つまで */, timing }; PlanDiff = { changedVisits, travelDelta, scoreDelta }
ScoreScale = { lowerBound, visits, lowerAssign, lowerTravel, lowerDropped }; SCORE_MAX = 100
HundredPart = { key: 'travel'|'wait'|'assign'|'balance'|'dropped', label, points }
RuleAchievement = { ruleId, unit: 'visit' | 'staff', total, met, compat: { great, good, poor, ng } | null }
```

- `scheduleRoute`：自宅を出る時刻は自由（最初の稼働時間帯の開始以降）、最初の待ちは0。開始＝max(到着, earliest) から作業が時間帯の1つに収まる最も早い時刻。latest 超え・収まらない＝違反（strict は不可、lenient は記録して続ける）。帰りの移動も数える（帰着の超過は違反にしない）
- 画面は `bestRoutes` を点数の基準で採点して「いまの最良 N点」を出す（無ければ前の点）

## 欠勤の振り直し（`src/contracts/reassign.ts`。PRD D26〜D35。ADR-0011）

```ts
Routes = Record<staffId, visitId[]>; ReassignPlan = { problem, routes }
ReassignTarget = { visitId, fromStaffId, reason: 'absence' | 'unreachable' | 'notAllowed' }
ReassignResult = { routes, placed: { visitId, staffId, addedCost, addedTravel }[] /* 入れた順 */,
  unplaced /* 入らない振り直す訪問 */, unassigned /* どの列にも無い訪問 */, pins /* 担当のいる全訪問 */ }
ReassignCandidate = { staffId, fits, addedTravel, addedCost /* fits のとき */, shiftMinutes /* 正＝遅く。無ければ null */,
  overCap, violations /* 必須の原因と重みの違反 */, routeBroken, delayedCount, maxDelayMinutes /* 四捨五入 */ }
ReassignDiff = { moved: { visitId, from, to /* null＝未割当 */ }[], shifted: { visitId, minutes }[],
  unplaced, changedStaff, travelDelta }
ReassignLeft = { visitId, staffId, reason: 'absence' | 'unreachable' }; FitOf = { staffId, addedCost, addedTravel }
targetsOf(problem, base: ReassignPlan, absentStaffIds); reassign(problem, baseRoutes, targets)
candidatesFor(problem, routes, visitId) /* 問題に無ければ [] */; placeVisit(problem, routes, visitId, staffId) /* 無ければ bestInsertion */
reassignDiff(before, after) /* lenient */; leftOf(problem, plan, absentStaffIds); fitsOf(problem, routes, visitId)
STAY_WEIGHT_MIN = 0; STAY_WEIGHT_MAX = 5; STAY_WEIGHT_STEP = 0.5; STAY_WEIGHT_DEFAULT = 3
STAY_MOVE_POINTS_PER_WEIGHT = 10; STAY_MINUTE_POINTS_PER_WEIGHT = 0.2
AnnealPrep = { problem, initial, source, planA, held, targets }
stayPointsOf(weight) /* 0〜5 に収める */; prepareAnneal(problem, base, planA, targets, { weight }); finishAnneal(prep, solved)
annealCost(problem, routes) /* Σ routeCost（stay 込み）＋均等＋入らない訪問（10000、keep は 100000）。回れなければ Infinity */
AnnealSettled = { ok: true, reason: null, visitIds, result } | { ok: false, reason: 'keepDropped' | 'notBetter', visitIds, result /* 案A */ }
settleAnneal(prep, solved)
ContactVisit = { visitId, clientId, fromStaffId, toStaffId, fromStart, toStart }
ContactList = { staffChanged, timeChanged, staff: { staffId, added, removed, shifted }[] }; contactsOf(before, after)
```

- 実装は `TargetsOf` などの関数の型で注釈する。例外を投げない（問題・元の案に無いものは無視）
- `problem` は欠勤を差し引いたデータをいまの条件で compile したもの
- 画面側（`lib/absences`）：元の案は `baseOf`（その日の訪問の担当＝`dayRoutes`）。`applyReassign` で振り直した担当を `writeRoutes` で訪問に書き（振り直した訪問と動かしていない訪問はピン）、`reassigns[date]` に振り直す前の担当（`baseRoutes`・`basePins`）を残す（ADR-0053）。続けて振り直すときは `base*` は最初のもの、`absenceIds` は累積。`revertReassign` は振り直す前の担当・ピンへ戻して `reassigns[date]` を消す
- 案B の流れ（`pages/useReassignFlow`）：`prepareAnneal` → `runSolve(prep.problem, { seed: data.seed, iterations: defaultIterations(prep.problem), initial: prep.initial })` → `settleAnneal`（案A のままなら理由を知らせる）→ 作った案B は画面の状態（保存しない）で案A と並べ → 選ぶと `chooseReassign` で訪問に書く。作れないとき（欠勤が取り消された・案A が無い・計算中）はボタンを押せなくして理由
- 欠勤は1人1日1件・30分単位（境は 12:00。欄で丸め、Excel では止める）。振り直しで件数の上限は超えない
- 連絡文は `lib/contacts`（`staffMessage`・`clientMessages`・`allContactsText`・欠勤・キャンセルの欄の5段目の `contactRows`。コピー・メール・印刷だけ。ひな形と載せる範囲は ADR-0038・PRD D245・D246）

## 繰り返し（`src/contracts/patterns.ts`。ADR-0012・ADR-0013・ADR-0053）

```ts
PatternInput = Pick<DemoData, 'patterns' | 'visits' | 'clients'>; DateRange = { from, to }  // 両端を含む
PatternChange = { patterns, visits, removed: { visitId, date }[] /* 消した保存した回 */ }
occursOn(pattern, date); expandPattern(pattern, range) /* 計算した回。利用中か・保存した回は見ない。担当はパターンの担当 */
visitsOn(data, date) /* 保存した訪問＋保存した回の無い計算した回。開始・ID の順 */; visitsIn(data, range) /* 日付・開始の順 */
findVisit(data, id) /* 保存した回か計算した回。無ければ null */
splitPattern(data, patternId, next: Omit<Pattern, 'id' | 'from'>, since, today, newId) /* 無い id は同じデータ */
removePattern(data, patternId, today)
```

- 例外を投げない（いない〈利用者さん〉・パターンは無視）。種類は `Problem` の形を変えない。月・週の AI で組むは `writeRoutes` で訪問に書く

## 空き状況・試算・案内文（`src/contracts/vacancy.ts`。PRD D45〜D48・D54・D67・D82。ADR-0012・ADR-0013）

```ts
INQUIRY_CLIENT_ID = '__inquiry_client'; INQUIRY_VISIT_ID = '__inquiry_visit'   // データに入れない
VACANCY_MARGIN_DEFAULT = 15; VACANCY_DAY_START_DEFAULT = '07:00'; VACANCY_DAY_END_DEFAULT = '20:00'; VACANCY_STEP_DEFAULT = 30
VACANCY_WEEKS_DEFAULT = 4 /* 1〜8 */; VACANCY_DURATION_MIN = 5; VACANCY_DURATION_MAX = 720; DAY_LOAD_MINUTES = 1440
VacancyQuery = { typeId, durationMinutes, requirements, place /* null＝目安 */, marginMinutes, dayStart, dayEnd, stepMinutes }
VacancyRange = { from, weeks }; VacancyCell = { weekday, start, byDate: { date, staffIds }[], min, weeksOk, weeksTotal }
VacancyResult = { exact, dates, noPlanDates, times, cells /* 曜日（日〜土）× times */ }
Verdict = 'ok' | 'partial' | 'ng' | 'unknown'
InquiryWish = { weekdays, from, to /* 開始時刻の範囲 */, perWeek, startDate }
DayLoadSlot = { start, working, free }
vacancyOf(data, query, range); verdictOf(cell); inquirySummary(result, wish, terms)
dayLoad(data, date, { typeId }) /* 0:00〜24:00 の30分ごと。案の無い日は null */
VacancyNoticeInput = { orgName, terms, typeName, durationMinutes, period: { from, to }, mode: 'dates' | 'weekly', exact,
  notBefore?: { date, minutes } /* 'dates' だけ。今の時刻は画面が渡す */ }
vacancyNotice(result, input)
```

- 例外を投げない：いない種類は種類なし、範囲が空なら `times` が空。正確の問題は欠勤・上書き・条件をいまのまま使い、点数とは関係しない
- 仮押さえ（空き状況の画面。空き時間に入れるのは `lib/weekOps` の `insertAllIntoPlans`）：選んだ曜日のうち ○ のある曜日を月→日の順に週の回数まで（足りるときだけ）。足した訪問は日ごとに空き時間へ入れてピン（`insertIntoPlan`）。取り消し（`store/tentative` の `cancelTentative`。伝えた日は `lib/tentative` の `confirmedDatesOf`）はその〈利用者さん〉の訪問をすべて消し、同じ update で repair

## 機能の入り切り（`src/contracts/features.ts`。PRD D210〜D216。ADR-0028）

- `FEATURE_IDS`（22）：`patterns`・`patternMonthly`・`clientLeave`・`requestedOff`・`monthPrint`・`expert`・`compare`・`sudden`・`vacancy`・`vacancyNotice`・`compat`・`allowedStaff`・`clientStage`・`visitNotes`・`offboard`・`workload`・`fare`・`rules`・`mail`・`mapsLink`・`geocode`・`excel`
- `Features`＝ID → boolean の部分的な表（無い ID は入）。Excel には入れない
- 切ってもデータの形・検査・repair は変えない。`clientStage` が切なら段階は「利用中／終了」で選ばせ、ほかの段階の人はそのまま
- エラーは無い（検査で落ちない）

## 担当を限る・希望休・印刷・最終勤務日・勤務の見込み（`src/lib/`。PRD D68〜D74。ADR-0014・ADR-0015・ADR-0053）

```ts
// lib/requestedOff
REQUESTED_OFF_NOTE; isRequestedOff; offDayState; toggleRequestedOff; requestedOffDates
// lib/monthPrint
printDay(data, date, staffId, inMonth?)  // 担当はその日の訪問の担当（dayRoutes を lenient で並べた時刻）。source：伝えた日なら 'confirmed'、ほか 'plan'（訪問が無ければ null）。pending＝担当なしの件数
monthPrint(data, ym, staffId); staffLabels  // 名字。利用中の人で重なればフルネーム
// lib/workload（予定からの見込み）
WorkStat = { staffId, count, start, end, span, visit, travel, wait, home, meters, fareYen, over, parts }
  // span＝最後の終わり − 最初の開始＝visit＋travel＋wait。home（自宅との行き帰り）は span に入れず meters・fareYen に
WorkDay = { date, source: 'confirmed' | 'plan' | null, stats }  // source：伝えた日か
workDayOf(data, date, problem?) /* 担当はその日の訪問の担当（dayRoutes） */; workStats(problem, routes, { fareYenPerKm, spanLimitHours }, sortByStart?)
workMonth(data, ym, problemOf?); workTotals(days); workloadTsv(days, staff, opts); spanLimitMinutes; isOverSpan; fareOf
// lib/offboard（OFFBOARD_SAMPLE_DAYS = 28）
offboardScope(data, staffId, today, withCandidates = true)
  // { staffId, lastDay, from（翌日。今日より前なら今日）, visits: { date, visitId, clientId, confirmed /* 伝えた日 */, plan }[],
  //   clients: { clientId, roles: ('pattern'|'allowed')[], patternIds, sample, candidates: { staffId, fits, load }[] }[] }
applyOffboardWith(data, staffId, choices /* clientId → staffId | null */, from, today, newId) /* { data, renamed } */
applyOffboard(...); unlimitedBy(data, staffId, choices); defaultChoice
```

- 担当を限るは問題にいる（利用中の）人だけで数える。希望休を入れても訪問の担当・伝えた内容は変えない（希望休の日に担当のある訪問は訪問ごとの検査で要対応）
- 最終勤務日の後の人は問題に残る（時間帯が空）。その人が担当の訪問は訪問ごとの検査で要対応（担当が休み）になる。その人だけに限った〈利用者さん〉は入らなくなる（黙って限らないにしない）
- `offboardScope` の範囲：最終勤務日の後にその人が担当している訪問（見本の期間の回と、それより後の保存した回）と、その人を繰り返しの担当（`pattern`）・担当できる人（`allowed`）にしている〈利用者さん〉。候補は見本の期間（`from` から28日）のその〈利用者さん〉の訪問ごとに、担当を限るを外した問題とその日の担当の並び（`dayRoutes`。その人の列は除く）に `fitsOf` で入る人を数える。並びは入る回の多い順 → 受け持ちの少ない順 → 名前。候補は `from` に勤める利用中の人（本人を除く）
- `applyOffboardWith`：`from` から受け持ちを移す。繰り返しの担当がその人のものは、`from` より前から続くなら `splitPattern` で分け（前はその人・後ろは代わり）、`from` 以降に始まるならその場で代わりに、前に終わるならそのまま。分けた繰り返しの回は計算し直す（この回だけ変えた回は新しい繰り返しの回として ID を付け直し、その数が `renamed`）。`from` 以降の保存した回で担当がその人のものは代わりに替える（ピン・組んだ開始は外す。だれにもしないなら担当なし）。担当できる人は代わりを足す（null ならその人を外す）。`from` より前の訪問・伝えた内容は変えない
- 勤務の見込み：担当はその日の訪問の担当（`dayRoutes`）。伝えた日かを `source` で出す。時刻は lenient。拘束は分に丸めてから上限と比べる

## 郵便番号と住所の検索（`src/lib/geocode.ts`・`placeAll.ts`・`postalCode.ts`・`addressLookup.ts`。PRD D86〜D90・D118〜D121。ADR-0016）

```ts
normalizePostalCode(text) /* '' → ''、7桁にできなければ null */; formatPostalCode /* 123-4567 */
GEOCODE_TIMEOUT_MS = 8000
LookupFail = 'invalid' | 'notFound' | 'timeout' | 'network' | 'badResponse' | 'aborted'
LookupResult<T> = { ok: true, hits: T[] } | { ok: false, reason }; PostalHit = { address }; GeoHit = { title, lat, lng }
LookupOptions = { fetch?, jsonp?, timeoutMs?, signal? }
lookupPostalCode(code, opts?); searchAddress(address, opts?); jsonp(url, { timeoutMs, signal?, doc?, win? }); lookupMessage(reason, 'postal' | 'address')
placeAllTargets(clients) /* { targets, skipped } */
placeAll(targets, { search, lookup, wait, intervalMs? /* 400 */, signal?, onResult }) /* { stopped } */
PlaceAllResult = { clientId, ok: true, lat, lng, address, title, from } | { clientId, ok: false, reason, step: 'postal'|'address', foundAddress, from }
withFoundPlace(data, clientId, from, found); keepStorePlace(form, opened, stored)
postalBlockReason; addressBlockReason; applyFoundAddress(current, found, hasPin?); sameQuery(what, sent, now); pinnedAddressAfter; toPlace
```

- 呼ぶのは部品 `AddressField`（〈利用者さん〉・空き状況の場所・〈スタッフ〉の自宅）と「まとめて地図に置く」だけ、押したときだけ。空き状況・自宅の郵便番号は保存しない
- 郵便番号：`https://zipcloud.ibsnet.co.jp/api/search?zipcode=1234567`（fetch が TypeError のときだけ `&callback=` で JSONP）。`results` が null・空→notFound、`status` 400→invalid、ほかの非200・形違い→badResponse
- 住所：`https://msearch.gsi.go.jp/address-search/AddressSearch?q=住所`（fetch だけ）。Feature の `geometry.coordinates`＝[経度, 緯度]・`properties.title` を、範囲内のものから5件。空→notFound、配列でない→badResponse。HTTP エラー→network
- 時間切れは8秒（郵便番号は fetch と JSONP を合わせて。JSONP に切り替えない）。`signal` で aborted。JSONP の名前は `__vrdJsonp_連番_時刻`、終われば script と関数を消し遅れた応答は捨てる。onerror→network、onload で呼ばれていなければ badResponse
- まとめて置く：位置が無く・終了でなく・住所か郵便番号のある人（表示名の順）。住所が空なら先に郵便番号から。呼ぶごとに `intervalMs` あける。1人ずつ `withFoundPlace`（位置が無く住所・郵便番号が from のままの人だけ）。住所だけ見つかれば住所だけ書く
- 文言は `lookupMessage`（「見つかりませんでした。…」「時間内に応答がありませんでした（8秒）。…」「つながりませんでした。…」「応答の形が想定と違います。…」）

## メール（`src/lib/mailto.ts`・`mail.ts`。PRD D91〜D96。ADR-0017）

```ts
MAILTO_LIMIT = 2000; MAILTO_LIMIT_SAFE = 2000; MAILTO_LIMIT_LONG = 8000   // URL（エンコード後）の長さの目安
mailLimitFor(platform, userAgent) /* Windows・不明 2000、iOS・Android・macOS 8000 */; normalizeEmail(raw) /* 合わなければ null */
mailtoHref({ to, bcc?, subject, body }); uniqueRecipients(list)
BuiltMail = { href, mode: 'full' | 'short' | 'none', body, fullBody, length, tooLong }
buildMail({ to, bcc?, subject, full, short? }, limit = MAILTO_LIMIT); buildBccMails({ bcc, subject, full, short? }, limit)
dayByStaff(data, date); dayMailText(org, staff, date, source, visits, includeKeys) /* { subject, full, short[] } */; dayRouteLinks
weekByStaff(data, dates); weekMailText(org, staff, days); contactMailText(org, date, message); vacancySubject; referrerRecipients
mailTo(email, text, limit?) /* 宛先が '' なら null */
```

- URL：`mailto:宛先?bcc=…&subject=…&body=…`、`encodeURIComponent`（宛先の @ はそのまま）、改行は CRLF、空の件名・本文は付けない。担当の決め方は `printDay` と同じ
- 件名：「10/18（日）の訪問予定」「10/19〜10/25 の予定」「10/18（日）の予定の変更」「空き枠のご案内（事業所名）」
- 本文：宛名「（名前）さん」→ 中身 → 事業所名。〈利用者さん〉は「（表示名）様」
  - 日：「…の訪問予定です（確定した担当｜今の担当（まだ確定していません）。N件）。」、各訪問「1. 9:00〜10:00 （表示名）様」＋住所・入り方・駐車場・注意＋鍵（`includeKeys` のときだけ。入れないときは「鍵の情報はメールに入れていません」）。要点1は住所まで、要点2は時刻と名前だけ（省いたものを「※…は省きました。」）
  - 週：「■10/19（月）」の下に時刻と名前。伝えていない日（訪問あり）があれば冒頭に1回だけ「※変わることがあります。確定した予定は前日のメールでお知らせします。」（日ごとには書かない）、訪問の無い日は「希望休｜欠勤｜休み｜予定はまだ決まっていません（担当なしの訪問がある）｜訪問なし」。要点は「10/19（月） 9:00・13:00（2件）」
  - 連絡は `staffMessage`＋事業所名、案内は `vacancyNotice` の文
- 長さ：full が `limit` 以内なら full、超えれば short を順に、それでも超えれば本文なし、それでも超えれば `tooLong`（ボタンは aria-disabled）。short・none では「本文をコピー」（fullBody）。案内は `buildBccMails` で分けて「宛先をコピー」も
- 宛先：日・週・連絡は To にその〈スタッフ〉、案内は BCC に紹介元。無ければ aria-disabled＋「メールアドレスが未登録です」（`NO_EMAIL`）

## メールの予約送信（`src/contracts/mailSchedule.ts`・`src/lib/mailSchedule.ts`・`gas/Code.gs`。PRD D366〜D369。ADR-0069）

- 責務：日の予定のメール（件名・全文）を、押したときに事業所の Google Apps Script へ預ける・取り消す・つながるか確かめる。接続の設定と預けた記録はこの端末だけ（`store/mailSchedule`。DemoData と別のキー）
- 契約・送り方・GAS のシートの形の詳細：[design/mail-schedule.md](mail-schedule.md)

## 道順のリンク（`src/lib/mapsLink.ts`・`mail.ts`。PRD D97〜D101。ADR-0018）

```ts
MAPS_DIR_BASE = 'https://www.google.com/maps/dir/?api=1'; MAPS_URL_LIMIT = 2048
MAPS_TRAVEL_MODE  /* DRIVE→driving・BICYCLE→bicycling・WALK→walking・TRANSIT→transit */
MAPS_MOBILE_WAYPOINTS = 3; MAPS_MAX_WAYPOINTS = 9 /* PC・アプリ用。今は使わない */
RouteStop = { label /* URL に入れない */, place, home? }
placeParam(p) /* 座標（小数6桁）、無ければ住所（「|」は全角に）、無ければ null */
directionsHref({ origin /* null＝今いる場所から */, destination, waypoints?, mode }); dayStops(home, visits) /* [自宅,…,自宅] */
legLinks(stops, mode) /* 場所の無い区間は href null */
tripLinks(stops, mode, maxWaypoints = 3) /* { links: { label: '全行程' | '全行程 k/n', href, from, to, waypoints }[], skipped, homeSkipped } */
BICYCLE_NOTE = '自転車の経路が出ないときは、Google マップで徒歩に切り替えてください。'
```

- 値はすべて `encodeURIComponent`（「,」は %2C、区切りは %7C）。入れるのは場所と移動手段だけ
- 全行程：場所のある地点を前から詰め、経由地は `maxWaypoints` まで（URL が上限を超えれば減らす）。次の1本は前の行き先から。公共交通は全行程なし
- 日の予定のメール：「■Google マップの道順」＋全行程 → 各訪問の下に「道順（自宅から｜…様から）」→「帰りの道順」。short は区間を残す段を先に、そのあと区間を外す段（詳細は ADR-0059）。`notes` に場所の無い地点・公共交通・自転車
- a 要素は `target="_blank" rel="noopener noreferrer"`。区間の分・km は直線距離の概算

## Excel のブックの形（`src/excel/`。ADR-0006・ADR-0011〜ADR-0017・ADR-0020・ADR-0070）

1行目が見出し。参照は名前（〈スタッフ〉の名前・〈利用者さん〉の表示名は一意、項目名は対象ごとに一意、条件名は重なってよい）。○＝はい。複数の値は「、」か改行で区切る（「・」「,」は区切らない）。見出しは全角半角・コロンの揺れを許す。呼び方は `org.terms`。（　）は列・シートが無い古いブックの読み方。

| シート | 列 |
|---|---|
| 使い方 | 説明だけ |
| 事業所 | 項目・値：事業所名・業種（ベビーシッター・介護・訪問看護・その他）・呼び方2つ・1kmあたりの運賃・乱数の種・拘束の上限（10） |
| 項目 | ID・対象・名前・種類（あり/なし／選択肢から1つ／複数／数値／開始年）・選択肢 |
| 条件 | ID・名前・種類・重み・必須（重み・必須は読み込むとプリセットのシートの点数の基準の行にそろえる。重みは1組。使い方のシートにも書く。ADR-0035・ADR-0053） |
| プリセット | ID・名前・一言・重み：〈型〉…（空は0）・必須（型の名前）・点数の基準（○ は1行。無印なら先頭。ふだんの重み＝条件の重みの画面の重み）。1〜6行（いまのまま） |
| 〈スタッフ〉 | ID・名前・移動手段・勤務する曜日・勤務開始・勤務終了・利用中・住所・緯度・経度・最終勤務日・メールアドレス・アイコン（任意の1〜2文字・文字列の書式。列が無い古いブックは未設定・名簿の読み込みで列が無ければ今の値のまま。2文字・32コード単位を超えれば行付きで止める。ADR-0050）・特性：…・必要条件：…・希望：… |
| 〈利用者さん〉 | ID・表示名・よみ（50字）・色（1〜8）・利用中・仮押さえ・郵便番号（文字列）・住所・緯度・経度・いつもの担当・担当できる人（名前を「、」か改行で。限らない）・メモ・入り方・鍵・駐車場・注意・段階（空なら利用中・仮押さえから）・紹介元・紹介元の連絡先・紹介元のメモ・紹介元のメールアドレス・特性：…・必要条件：…・希望：… |
| 相性 | 行＝〈利用者さん〉、列＝〈スタッフ〉。◎○△×・空 |
| 稼働時間 | 〈スタッフ〉・日付・時間帯（例 9:00-12:00、13:00-18:00。「休み」） |
| 欠勤 | ID・〈スタッフ〉・日付・開始・終了（空＝始業から／終業まで）・メモ（欠勤なし。`base` から引き継がない） |
| 種類 | ID（新しい ID は `t-`）・名前・色・標準の所要・必要条件：…・メモ（なし） |
| 定期パターン | ID（`pt-`）・〈利用者さん〉・種類・曜日（例 月木）・間隔（毎週／隔週／3週ごと／4週ごと／毎月）・時間の決め方・開始（早）・開始（遅）・所要・開始日・終了日・いつもの担当・メモ・第N週（毎月のときだけ読む）・曜日ごとの時刻（例 月 9:30、木 15:00〜15:30。「月曜 9:30」「月 9:30-10:00」も）・標準の開始（例 月 10:00、水 11:00。曜日ごとに1つ。空＝なし。ADR-0062）（なし。後ろ3列は毎週系・上書きなし・標準の開始なし） |
| 訪問 | ID・日付・〈利用者さん〉・種類・時間の決め方・開始（早）・開始（遅）・所要・担当・取り消し・定期パターン（空＝単発）・元の日・この回だけ変更・メモ・当日キャンセル |
| 訪問先の休み | ID・〈利用者さん〉・開始日・終了日・理由（なし） |
| 稼働の見込み | 日付・名前・案の元・件数・最初の開始・最後の終わり・拘束・訪問・移動・待ち・自宅との行き帰り・距離・交通費（単価0なら空）・上限超え。書き出すだけ |

- 特性の列（`traitCols`）：あり/なし・選択肢から1つ・数値は `特性：〈項目名〉` の1列、開始年は `特性：〈項目名〉（開始年）` の1列に西暦（「2018年」も読む。1900〜2100 の整数）、選択肢から複数は選択肢ごとの列 `特性：〈項目名〉：〈選択肢〉`（項目の選択肢の順）
- 特性のセル：「あり」「なし」、空＝未確認、選択肢そのもの、数、開始年。選択肢ごとの列は「○」（持つ）・「×」（持たない）・空で、その項目の列が全部空なら未確認、どれかに印があれば ○ の選択肢（空の列は持たない）。書き出しは未確認なら全部空、確認済みなら持つ所に ○・ほかに ×。プルダウンは ○・×
- 条件のセル（空＝問わない）：「あり」「なし」「なし（未確認も可）」「あり（未確認も可）」（後ろ2つは `not`）、「A、B」（どれか。1つなら `is`）・「A以外」、「すべて：A、B」、「3以上」「5以下」「3〜5」「3」「3以外」（開始年の項目は年数。「3年以上」も読む）。同じ項目の条件が2つ以上ならセルの中で改行。セル全体が選択肢の名前と同じならその選択肢。読むと条件は項目の列の順
- 選択肢の名前に「、」・改行は使えない（書き出しで止める）。特性の列の見出しが対象の中で重なる（全角半角・空白の違いも同じ。例：項目「資格：看護師」と資格の選択肢「看護師」）と書き出しで止める。数は指数表記にしない
- メールは全角・空白・Excel のリンク（`prim`：文字、リッチテキストの連結、無ければ「mailto:」以降）を直して読む。郵便番号は数値のセルを0で埋め、ハイフン・全角を直す
- 止めるもの：必須の列が無い、項目の列の過不足（名簿は無い項目の列は今のままだが、選択肢ごとの列が一部だけなら止める）、同じ名前・同じ ID、ID が `__proto__`・`constructor`・`prototype`、いない名前・種類・パターンの参照、読めない値（時刻・日付・数・選択肢・曜日・間隔・第N週（1〜5以外、毎月で空）・曜日ごとの時刻・標準の開始（同じ曜日が2つ）・パターンの曜日に無い曜日・メール・郵便番号・数式のエラー・結果の無い数式・時刻の列の1以上の数）、1人20件を超える条件、contracts の長さの上限、稼働時間・欠勤の同じ人・同じ日の2行、欠勤の30分単位でない時刻・終了 ≤ 開始、終了日が開始日より前、開始（早）が開始（遅）より後、パターンの訪問の ID が `${元の日}_${パターンID}` でない、単発の訪問の元の日・この回だけ変更、「種類」「定期パターン」があるのに「訪問」に列が無い、取り消していない訪問の当日キャンセル、2つの呼び方が同じ、10MB・1シート1万行を超える
