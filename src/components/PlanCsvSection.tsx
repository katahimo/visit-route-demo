// 「定期の予定を入れる」の引き出しの「CSV でまとめて」の欄（ADR-0090。PRD D423）：テンプレート・見ている月の単発の訪問の書き出し・読み込み。
// 名簿の読み込み（登録の案内）と同じく、Excel の入出力（機能 excel）の入り切りにかかわらず出す。ふだんは畳む。状態と処理は usePlanCsv
import { Download, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BOOKING_FORMS } from '../excel/bookingForms';
import { VISIT_CSV_COLS } from '../excel/visitCsv';
import { FieldError } from './FieldError';
import { FilePick } from './FilePick';
import { WithIcon } from './ui';
import { usePlanCsv } from './usePlanCsv';

/** 読める形の名前（「・」でつなぐ） */
const FORM_LABELS = BOOKING_FORMS.map((f) => f.label).join('・');
/** 必ず入れる列（ほかの列は空でよい。担当は書き出すだけ） */
const COLS_TEXT = [VISIT_CSV_COLS.date, VISIT_CSV_COLS.start, VISIT_CSV_COLS.minutes, VISIT_CSV_COLS.client].join('・');

export function PlanCsvSection({ clientTerm, onImported }: { clientTerm: string; onImported: () => void }) {
  const c = usePlanCsv(onImported);
  return (
    <details className="add-plan-csv" data-testid="plan-csv">
      <summary className="add-plan-csv-title" data-testid="plan-csv-open">
        CSV でまとめて入れる
      </summary>
      <p className="sub">
        {`単発の訪問を CSV で読み込みます。必ず入れる列は ${COLS_TEXT}（${clientTerm}の名前）。読める形：${FORM_LABELS}。`}
        {`${clientTerm}は名前で突き合わせるので、先に`}
        <Link to="/clients">{clientTerm}一覧</Link>
        {'に入れておきます。書き出したファイルを直して読むと、同じ訪問（訪問ID）を直します。'}
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={c.busy} onClick={c.template} data-testid="plan-csv-template">
          <WithIcon icon={FileText}>テンプレート</WithIcon>
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
      <FilePick
        caption="読み込む予定の CSV"
        accept=".csv,.tsv,.txt,text/csv"
        disabled={c.busy}
        onPick={c.load}
        testId="plan-csv-file"
      />
      <FieldError style={{ whiteSpace: 'pre-line' }}>{c.error}</FieldError>
    </details>
  );
}
