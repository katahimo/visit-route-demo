# 月の進み具合の帯・日の状態の共通フック

> この画面のファイル：`src/components/progressBand.tsx`（`progressBand.css`）・`src/lib/progressBand.ts`・`src/lib/dayStatuses.ts`・`src/components/useDayStatuses.ts`。関連 ADR：0025（追記を含む）・0038・0044・0062。関連 PRD：D151〜D155（進み具合の帯）・D393（「詳しく ▾」）・D401・D404（ホームを無くした）・D161（条件が変わった）。
> 版2（ADR-0053）：日の状態は まだ伝えていない／確定済み／未連絡の変更あり、要対応は訪問ごとの検査。「案を作る」は「担当を AI で組む」

### ホームは無くした（PRD D401・D404。ADR-0074 段1）

`#/home`・起動（`#/`）・知らない URL は予定の画面（`homePath(features)`＝月か週。入切とも）へ移す（`Navigate replace`。`App.tsx`）。ホームの「今日やること」の代わりは予定の上の要対応の帯（担当なし・重なり・休みの人、入は 組み方の標準が無い・基本情報が変わった・未確定 N日。[pages-nav.md](pages-nav.md) の「要対応の帯」）と「その他 ▾」。ホームの部品（`pages/HomePage`・`homeParts`・`useHomeTasks`・`home.css`・`lib/home`）は消した（月の後半の日 15 は `lib/scheduleMode` の `LATE_MONTH_FROM_DAY`）。

### 日の状態の共通フック（`components/useDayStatuses.ts`。計算と日ごとの覚えは `lib/dayStatuses.ts` の `createDayStatusMemo`）

- 月の予定の「日の問題と状態」を切り出したフック。月の予定・進み具合の帯・週の準備・要対応・要対応の帯で共通（数え方が食い違わない）
- 点数の基準の条件で compile・採点し、訪問ごとの検査（`visitIssues`）・伝えた状態（`toldStateOf`）・拘束が上限を超える人を `dayStatus` に渡す
- 日ごとの覚えはモジュールの `MEMO`（日付ごとに最近3件・400日まで。点数の基準の条件は JSON で比べる）で、画面を移っても使う

### 月の進み具合の帯（PRD D151〜D155）

月の予定の「詳しく ▾」（D393）の中に置く。同じ月なら同じ数（要対応の帯の「未確定 N日」とは見る日の範囲が違う）。印刷では出さない。

#### `lib/progressBand.ts`（純粋関数。テストあり）

- `bandNext({ progress, emptyTargets, urgent })`：次の一手 `BandNext`＝種類 `batch|attention|unconfirmed|done|empty`・文・短い文。順は
  1. 担当なしの訪問がある日が2日以上 → 担当を AI で組む
  2. 手当てが要る要対応（要対応の訪問） → 要対応を見る
  3. 確定していない日 → 確定していない日を見る
  4. 見るだけの要対応（未連絡の変更・拘束超） → 要対応を見る
  5. 無ければ済み。今日以降に訪問が無ければ empty
- `urgentCount(attention)`：要対応の訪問のある日（`care`）
- `bandHref(ym, op)`：`batch` は担当を組むの画面 `/arrange?ym=…`（ADR-0063）、ほかは `/month?ym=…&do=…`
- `visitsText`：「N件」

#### `components/progressBand.tsx`（`progressBand.css`）

- `ProgressBand({ ym, model, onOp? })`：見た目だけ（月の予定だけで使う。主ボタンの引数・週・日の「この日」は無い。ADR-0054・ADR-0074 段2）
  - `model` は `BandModel`＝`monthProgress`・担当なしの訪問がある日の数・手当てが要る要対応の件数。null の間は同じ高さで「数えています…」
  - 数字は4つの `Link`：訪問・担当 → 担当を組むの画面（`/arrange?ym=`）、確定 → `do=unconfirmed`、要対応 → `do=attention`。`onOp` があれば移らずにそれを呼ぶ（修飾キー（Ctrl・⌘・Shift・Alt）と左以外のボタンでは横取りしない。Ctrl+クリックは新しいタブ）
  - 右に次の一手（`Link` の従のボタン。済み・訪問なしは文だけ。訪問の無い月はボタンなし。主ボタンは操作の行の1つ）
  - 下の縁に `prepParts` の細い積み上げ（`.prep-bar`・`.prep-part` の色）
  - 600px 以下は1行（訪問・「日」「件」を省き、ボタンは短い文）
  - 読み上げ：数字のリンクに aria-label（「担当が全部入った日 x/y日（済）。担当を組むの画面を開く」など）、✓ に sr-only の「済」、手当てが要る要対応に「要手当て」
- `BandLive`：aria-live。最初は空で置き、数え直して文が変わったときだけ中身を入れる
  - `useCompileInput`・`useDayStatuses`（その月の今日以降の日と、日の予定で選んでいる日）・`monthProgress`（statusOf）・`attentionList`・担当なしの訪問がある日の数
  - 数字とボタンは月の予定の欄（`?do=` は月の予定が消す）か担当を組むの画面へ移る
  - 速く出す（e2e の上限 `PERF_MS_PROGRESS` 既定 3000ms）

#### 置く所

| 画面 | 置き方 |
|---|---|
| 月（`pages/MonthPage`） | 「詳しく ▾」の中に `ProgressBand`（自分で数えた `progress`・`preview`・`attention` から作る）。次の一手は従のボタン、`onOp` で要対応・確定していない日は欄を画面の中で開く（URL は変えない）。「担当を AI で組む」は担当を組むの画面（その月）へ移る（ADR-0063）。詳しくは [pages-month.md](pages-month.md) |
| 週・日 | 出さない（PRD D332。ADR-0054）。週は1行の状態 `week-status`、日は見出しの状態の印と今の担当の1行。担当を組むのは担当を組むの画面（[pages-arrange.md](pages-arrange.md)） |

#### 確かめ

`scripts/e2e-progress.cjs`：月の帯・見出しに組むボタンが無い・入口が1つ・帯の「担当を AI で組む」で担当を組むの画面へ・古い `?do=batch` も同じ・帯の数字から右の欄（URL は変えない）・右の欄と同じ日数／来月も繰り返しの回から数える／担当を組むで組み始めると画面を移っても続く／帯の未確定（今月＋翌月）と同じ数／390px・印刷／週・日の帯が速く出る（AGENTS.md の e2e の説明）
