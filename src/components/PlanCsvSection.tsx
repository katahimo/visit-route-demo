// 「定期の予定を追加」「予約を追加」の引き出しの CSV の欄（ADR-0090。PRD D408・D423）：テンプレート・見ている月の単発の訪問の書き出し・読み込み。
// 名簿の読み込み（登録の案内）と同じく、Excel の入出力（機能 excel）の入り切りにかかわらず出す。状態と処理は usePlanCsv。
// 単発（予約を追加）は毎日の予約の取り込みが主なので、引き出しのいちばん上に開いて出す。定期は下に畳んで出す
import { Download, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BOOKING_FORMS } from '../excel/bookingForms';
import { VISIT_CSV_REQUIRED } from '../excel/visitCsv';
import type { AddPlanKind } from '../lib/addPlan';
import { FieldError } from './FieldError';
import { FilePick } from './FilePick';
import { WithIcon } from './ui';
import { usePlanCsv } from './usePlanCsv';

/** 読める形の名前（「・」でつなぐ） */
const FORM_LABELS = BOOKING_FORMS.map((f) => f.label).join('・');
/** 必ず入れる列（ほかの列は空でよい。担当は書き出すだけ） */
const COLS_TEXT = VISIT_CSV_REQUIRED.join('・');

export function PlanCsvSection({
  kind,
  clientTerm,
  onImported,
}: {
  kind: AddPlanKind;
  clientTerm: string;
  onImported: () => void;
}) {
  const c = usePlanCsv(onImported);
  const oneOff = kind === 'oneOff';
  return (
    <details className="add-plan-csv" open={oneOff || undefined} data-testid="plan-csv" data-kind={kind}>
      <summary className="add-plan-csv-title" data-testid="plan-csv-open">
        {oneOff ? '予約の CSV を読み込む' : 'CSV でまとめて追加（単発の訪問）'}
      </summary>
      <p className="sub">
        {`日付のある訪問（単発）を CSV で読み込みます。必ず入れる列は ${COLS_TEXT}（${clientTerm}の名前）。読める形：${FORM_LABELS}。`}
        {`${clientTerm}は名前で突き合わせるので、先に`}
        <Link to="/clients">{clientTerm}一覧</Link>
        {
          'に入れておきます。同じ予約は二重に入りません。書き出したファイルを直して読むと、同じ訪問（訪問ID）を直します。'
        }
        {oneOff ? '' : '定期（繰り返し）の予定は CSV では読めません。上の欄で足します。'}
      </p>
      <FilePick
        caption="読み込む予約・予定の CSV"
        accept=".csv,.tsv,.txt,text/csv"
        disabled={c.busy}
        onPick={c.load}
        testId="plan-csv-file"
      />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={c.busy} onClick={c.template} data-testid="plan-csv-template">
          <WithIcon icon={FileText}>テンプレートをダウンロード（CSV）</WithIcon>
        </button>
        <button
          type="button"
          className="btn"
          disabled={c.busy || c.count === 0}
          onClick={c.exportMonth}
          data-testid="plan-csv-export"
        >
          <WithIcon icon={Download}>{c.exportLabel}</WithIcon>
        </button>
      </div>
      <FieldError style={{ whiteSpace: 'pre-line' }}>{c.error}</FieldError>
    </details>
  );
}
