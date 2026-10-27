# docs の索引

AI・人が「何を知りたいときに、どのファイルを読むか」を選ぶための地図。全部を読まず、該当するファイル・節だけ読む。

- どの文書も**今の仕様だけ**を書く。変更の経緯は git のコミット、判断の理由は ADR にある
- 食い違ったら：契約は `src/contracts/`、要件は `prd.md`（＋ `prd/`）、設計は `design.md`（＋ `design/`）が正

## 目的別

| 知りたいこと | 読むファイル |
|---|---|
| 作業のルール・コマンド・ディレクトリ構成 | [../AGENTS.md](../AGENTS.md) |
| 何を作るか・やらないこと・D番号の要件 | [prd.md](prd.md) §3 の索引 → テーマ別の `prd/*.md` を1つだけ |
| 全体図・コンポーネントの責務・データの持ち主 | [design.md](design.md) §3・§4 |
| 型・データの版・エラー・費用の物差し（契約） | [design.md](design.md) §5（一覧・費用・エラー）→ 各型の詳細は [design/contracts.md](design/contracts.md)。正は `src/contracts/` |
| 画面の仕様（ルート・部品・文言・data-testid） | [design/pages.md](design/pages.md) のルート一覧 → 画面別の `design/pages-*.md` |
| なぜその案にしたか・捨てた案 | [adr/](adr/)（下の一覧） |
| まだ決まっていないこと | [design.md](design.md) §8・[prd.md](prd.md) §8 |
| 焼きなまし法と OR-Tools の比較の実測 | [optimization-benchmark.md](optimization-benchmark.md) |
| e2e の走らせ方・書き方・環境変数・各スクリプトで確かめること | [e2e.md](e2e.md) |

## 画面別の設計（design/）

| ファイル | 中身 |
|---|---|
| [pages.md](design/pages.md) | 共通事項（〈スタッフ〉の印を含む）・ルート一覧・確認ダイアログ・機能の入り切り（画面側） |
| [pages-nav.md](design/pages-nav.md) | メニュー（5項目と畳める子の項目）・下のタブ・引き出し・設定のタブ・基本情報のタブ・予定を組むの段・Ctrl+Z・コマンドパレット |
| [pages-common.md](design/pages-common.md) | 右の欄・予定の共通の部品（モードの切り替え・操作の行・AI で組む ▾ の範囲・提案の帯・複数選択・全体の元に戻す）・訪問の札の共通の部品（札の3段と入れ物・見た目の印・選ぶ・1行1訪問の行・表のマスの札と「+N」・ドラッグの落とし先の判定）・スマホの日ごとのリスト・帯をキーで動かす・訪問の詳細の欄（VisitPanel・visitOps）・名前の詳細の吹き出し・用語・ツアー・作り直しの帯・リンク・メール・道順 |
| [pages-bars.md](design/pages-bars.md) | 3段の時間帯のバー・ひと目で分かる表示（月・週・日・空き状況・稼働で共通） |
| [pages-home.md](design/pages-home.md) | ホーム（今日やること） |
| [pages-plan.md](design/pages-plan.md) | 日の予定（予定と AI案・手直し・確定） |
| [pages-plan-absence.md](design/pages-plan-absence.md) | 欠勤・キャンセル・振り直し（案A・案B）・連絡の一覧 |
| [pages-month.md](design/pages-month.md) | 月の予定（マスを押すと右の欄のその日の行・マスのキー・別の日へ・スマホの下から出る欄）・まとめて作る・まとめて確定・希望休・印刷 |
| [pages-week.md](design/pages-week.md) | 週の予定（時間軸・〈スタッフ〉×曜日・〈利用者さん〉×曜日の表のマスの札と「+N」） |
| [pages-vacancy.md](design/pages-vacancy.md) | 空き状況・問い合わせの試算・案内文 |
| [pages-basics.md](design/pages-basics.md) | 基本情報の予定と相性の表（行＝繰り返し・列＝曜日・マスで時刻を直す・相性の列。予定を組むの1段目） |
| [pages-clients.md](design/pages-clients.md) | 〈利用者さん〉の一覧・〈利用者さん〉と〈スタッフ〉の画面（タブ・予定のカレンダー・節）・住所の入力・絞り込み |
| [pages-compat.md](design/pages-compat.md) | 相性の表 |
| [pages-staff.md](design/pages-staff.md) | 〈スタッフ〉の一覧と画面・勤務時間（シフト）・勤務の見込み・スマホ画面 |
| [pages-rules.md](design/pages-rules.md) | 条件・プリセット・訪問の種類・項目・案の比較 |
| [pages-arrange.md](design/pages-arrange.md) | 担当を組む（範囲・AI で組む・提案の帯・基本情報が変わったときの組み直しの知らせ。予定を組むの最後の段） |
| [pages-standard.md](design/pages-standard.md) | 組み方の標準（1段ずつ進む段・標準の週の期間・考え方ごとの案の比較（表と日で見る時間軸・地図）・登録・`lib/standard`。予定を組むの2〜3段目） |
| [pages-data.md](design/pages-data.md) | データ（控え・直前の状態・Excel・初期化・片づけ・データを守る知らせ）・管理者設定 |
| [mail-schedule.md](design/mail-schedule.md) | メールの予約送信（事業所の Google Apps Script とのやりとりの契約・送る時刻・この端末の覚え・GAS のシート） |
| [contracts.md](design/contracts.md) | 契約の詳細（design.md §5 から分けた節）：データの形・版・条件・Problem・振り直し・繰り返し・空き状況・住所の検索・メール・道順・Excel のブックの形 |

## ADR 一覧

| 番号 | 決めたこと |
|---|---|
| [0001](adr/0001-browser-only-github-pages.md) | ブラウザ完結の静的サイト・GitHub Pages |
| [0002](adr/0002-flexible-matching-rules.md) | 相性・特性・希望を「項目＋条件の型＋重み0〜5＋必須」で表す |
| [0003](adr/0003-js-annealing-solver.md) | 最適化は Web Worker 上の焼きなまし |
| [0004](adr/0004-ai-plan-as-base-with-pins.md) | AI の提案を土台に手直しし、手で動かした訪問を固定として残す |
| [0005](adr/0005-compare-ai-runs-by-parameters.md) | 条件を変えた AI の提案どうしで比べる（手作業との比較はしない） |
| [0006](adr/0006-excel-template-import-export.md) | Excel の書き出し・読み込み |
| [0007](adr/0007-score-out-of-100.md) | 点数を100点満点で見せる |
| [0008](adr/0008-editable-presets-auto-runs.md) | プリセットを利用者が編集できるデータにする |
| [0009](adr/0009-merge-schedule-and-plan.md) | 日の予定の編集と割当の手直しを1画面にまとめる |
| [0010](adr/0010-score-ruler-fixed.md) | 点数の物差しを「点数の基準のプリセット」で固定する |
| [0011](adr/0011-same-day-absence-reassign.md) | 当日の欠勤を別の記録で持ち、他の人を変えずに空き時間へ振り直す（案A・案B・連絡の一覧） |
| [0012](adr/0012-monthly-plan-patterns-visit-types.md) | 訪問の種類と繰り返し（定期パターン）で一月分の訪問を持つ |
| [0013](adr/0013-monthly-nth-weekday-client-leaves-visit-notes-vacancy-notice.md) | 第N曜日・曜日ごとの時刻・〈利用者さん〉の休み・決まりごと・案内文 |
| [0014](adr/0014-allowed-staff-requested-off-month-print.md) | 担当を限る・希望休のまとめ入力・月の予定の印刷 |
| [0015](adr/0015-offboarding-workload-client-stage-same-day-cancel.md) | 退職の一括振り直し・稼働の見込み・段階・当日キャンセル |
| [0016](adr/0016-postal-code-and-address-search.md) | 郵便番号→住所の補完と住所→地図のピン（押したときだけ外部へ） |
| [0017](adr/0017-mail-via-mailto.md) | メールは mailto: でメールアプリを開くだけ |
| [0018](adr/0018-google-maps-route-links.md) | 道順は Google マップの公開リンクを作るだけ |
| [0019](adr/0019-nav-grouped-by-person.md) | 相性・稼働時間などを人ごとにまとめる（並びは ADR-0027 以降） |
| [0020](adr/0020-roster-excel-import-export.md) | Excel の名簿（シート1枚）で、予定を消さずに人を足す・直す（0068 で置き場所を各一覧へ・CSV を足す） |
| [0021](adr/0021-client-filter-area.md) | 〈利用者さん〉の絞り込みを共通の欄にし、地区は住所から取り出す |
| [0022](adr/0022-compat-page-details-and-filters.md) | 相性の画面の詳細の吹き出しと絞り込み、予定の名前からも詳細を開く |
| [0024](adr/0024-mobile-nav-and-week-client-default.md) | スマホのメニュー（上の帯・引き出し・下のタブ）と週の〈利用者さん〉の初期値 |
| [0025](adr/0025-task-first-navigation-home.md) | やりたいことから入る導線（ホーム・進み具合の帯・欠勤の欄・言葉の案内） |
| [0026](adr/0026-custom-confirm-dialog.md) | ブラウザ標準の確認をやめ、独自の確認ダイアログにする |
| [0027](adr/0027-task-ordered-menu-command-palette.md) | メニューを用途順にし、コマンドパレット（Ctrl+K）を足す |
| [0028](adr/0028-feature-toggles-by-admin.md) | 管理者設定で機能を入り切りし、要る機能だけの画面にする |
| [0029](adr/0029-e2e-playwright-test-runner-ci.md) | e2e を @playwright/test で包み、PR・夜間の CI で回す |
| [0030](adr/0030-reassign-and-undo-without-drag.md) | 担当替えをドラッグ以外（キーボード・タッチ）でもできるようにする |
| [0031](adr/0031-month-bulk-confirm-and-seed-plans.md) | 月の「問題の無い日をまとめて確定」と「次の確定していない日へ」 |
| [0032](adr/0032-protect-data.md) | データを守る（1世代の控え・書き出しの知らせ・片づけ・壊れたデータと別のタブ） |
| [0033](adr/0033-narrow-tables-as-cards.md) | 狭い画面では一覧の表をカードに組み替える |
| [0034](adr/0034-screen-names-and-five-menu-groups.md) | 画面名をメニューの名前にそろえ、欠勤の入口の呼び名を1つにする |
| [0035](adr/0035-rules-page-edits-score-basis.md) | 条件の重みの画面は点数の基準（ふだんの考え方）を直す画面 |
| [0036](adr/0036-page-header-and-button-tiers.md) | 画面の見出しを1つの型に、ボタンを塗り・枠・文字の3段に |
| [0037](adr/0037-term-hint-info-icon.md) | 用語の説明の目印を ⓘ に、同じ語の説明は1画面で1か所 |
| [0038](adr/0038-sudden-contact-step.md) | 欠勤・キャンセルの欄の「連絡」の段と連絡文のひな形 |
| [0039](adr/0039-split-heavy-pages-and-map.md) | 重い画面と地図を別のチャンクに分け、進み具合は外の入れ物で描き直す |
| [0041](adr/0041-e2e-steps-soft-checks-web-first-waits.md) | e2e を段・やわらかい確かめ・画面の状態での待ちにして揺れを止める |
| [0042](adr/0042-month-batch-outside-page.md) | AI で範囲を組む計算を画面の外の入れ物で回す（画面を移っても続ける） |
| [0044](adr/0044-next-step-first-and-show-result.md) | 次の一手を1つに絞り、押した結果を確定の前に見せる |
| [0045](adr/0045-show-less-menu-settings-tour.md) | 見せる量を減らす（初回は基本・設定はタブ・ツアー3枚・その他 ▾） |
| [0046](adr/0046-week-make-confirm-attention-unmade.md) | 週の予定で見ながら確定でき、月をまたぐ週は1度に扱う |
| [0047](adr/0047-compat-to-people-settings-order.md) | 相性を設定から「人」へ移し、設定の先頭を訪問の種類にする（0067 で「人」は予定を組むの基本情報へ） |
| [0048](adr/0048-rules-weight-draft-and-confirm.md) | 条件の重みの表は下書きにし、確定と確認のあとで保存する |
| [0050](adr/0050-staff-mark-and-icon.md) | 〈スタッフ〉の印を1つの部品にそろえ、任意のアイコン（1〜2文字）を持たせる |
| [0051](adr/0051-visit-panel-and-ux-stages.md) | 訪問の詳細の欄を1つにし、日時・担当・取り消し・範囲を同じ欄で扱う |
| [0052](adr/0052-person-page-schedule-and-sections.md) | 〈利用者さん〉・〈スタッフ〉の画面を全画面にし、予定のカレンダーと節ごとの「直す → 保存」にする |
| [0053](adr/0053-visit-owns-staff-proposals-and-told.md) | 担当は訪問に持ち、AI は提案だけ、確定は伝えた内容、繰り返しの回は見るときに計算する |
| [0054](adr/0054-schedule-shared-parts-menu-six-global-undo.md) | 予定の日・週・月を共通の部品に寄せ、人の画面をタブにまとめ、元に戻すを全体で1本にする |
| [0055](adr/0055-mobile-day-list-keyboard-search-five-stages-done.md) | スマホは日ごとのリストと下から出る欄、広い画面は帯をキーで動かし、パレットで担当と要対応を引く |
| [0056](adr/0056-shared-visit-parts-select-keys-drop.md) | 訪問の印・選ぶ・キー・落とし先の判定を共通の部品にする |
| [0057](adr/0057-visit-chip-sizes-and-containers.md) | 訪問の札を3段の大きさと3種類の入れ物にする |
| [0058](adr/0058-schedule-toolbar-same-place-more-month-only.md) | 予定の操作の行を日・週・月で同じ位置にし、その他 ▾ は月とスマホだけ |
| [0059](adr/0059-mail-confirms-day-keep-leg-routes.md) | 日のメールで確定にし、区間の道順を残す |
| [0060](adr/0060-schedule-nav-row-same-for-month-week-day.md) | 予定の日・週・月に同じナビの行を置く |
| [0062](adr/0062-standard-week-and-two-modes.md) | 組み方の標準を繰り返しの担当・開始で持ち、標準の担当は AI で組んでも動かさない |
| [0063](adr/0063-ai-only-in-standard-manual-schedule.md) | AI で組むのは「予定を組む」に集め、予定の画面は手で直す（メニューの子の項目） |
| [0064](adr/0064-day-three-choices-until-standard.md) | 標準が無い間は考え方ごとの日の案を並べて選ぶ（0065 で置き換え） |
| [0065](adr/0065-standard-flow-one-path-rules-under-arrange.md) | 予定を組むを 条件の重み → 組み方の標準 → 担当を組む の3段にし、標準を決める道を組み方の標準の1本に（段の出し方は 0066 で置き換え） |
| [0066](adr/0066-arrange-steps-one-at-a-time-rules-behind-standard.md) | 予定を組むを1段ずつ進む4段（案をくらべる → 表で直す → 標準にする → 担当を組む）にし、条件の重みを組み方の標準の寄り道に（0067 で段を置き換え） |
| [0067](adr/0067-arrange-basics-first-people-under-arrange.md) | 予定を組むの1段目を「基本情報」にし、メニュー「人」の項目を予定を組むへ移す（段は 基本情報 → 案をくらべる → 標準にする → 担当を組む。前提が変われば組み直しを知らせる） |
| [0068](adr/0068-roster-io-on-lists-with-csv.md) | 名簿の書き出し・読み込みを〈利用者さん〉一覧・〈スタッフ〉一覧へ移し、CSV（文字コードの自動判別）を足す |
| [0069](adr/0069-scheduled-mail-via-org-gas.md) | 日の予定のメールを、事業所の Google Apps Script に確定のときにまとめて預け、前日の決めた時刻に送る（mailto は残す） |
| [0070](adr/0070-trait-columns-per-option-and-start-year.md) | Excel・CSV の選択肢から複数の特性を選択肢ごとの列（○・×）にし、経験年数を開始年で持つ（条件はその日までの年数） |

## 文書の保ち方

`.claude/skills/solo-architecture-design/` の「設計書を育てる」に従う。追記を重ねず該当の節を書き直す・大きくなったら `design/` に分ける・実装が終わった作業指示書は残さない。
検査：`python3 .claude/skills/solo-architecture-design/scripts/check_design.py docs/design.md`
