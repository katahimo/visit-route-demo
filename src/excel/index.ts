// 入口（実装は excel 担当。ADR-0006・design.md §4 excel）
// DemoData ⇔ Excel のブックの変換。データは書き換えない。画面からは動的 import で読む（ExcelJS を初期表示に入れない）
export { exportRosterWorkbook, exportWorkbook, XLSX_MIME } from './exportBook';
export { importWorkbook } from './importBook';
// 予約の CSV（ほかのソフトの予約 → 単発の訪問。ADR-0075）
export { importBookings } from './importBookings';
// 名簿（〈利用者さん〉・〈スタッフ〉のシート1枚）の書き出し・読み込み（PRD D103〜D107。ADR-0020）
export { importRoster, rosterRetiresMost, rosterSummary, rosterWarning } from './importRoster';
// 名簿の CSV（ADR-0068）
export { exportRosterCsv } from './rosterCsv';
// 予定の CSV（単発の訪問の書き出し・テンプレート。読み込みは importBookings。ADR-0090）
export { exportVisitsCsv, visitCsvTemplate } from './visitCsv';
