// 「予約を追加」（単発）の引き出しのいちばん上の「予約の CSV を読み込む」（ADR-0090。PRD D408・D423）：読み込み・テンプレート・
// 見ている月の単発の訪問の書き出し。毎日の予約の取り込みが主なので開いたまま出す。定期の引き出しには出さない（CSV は単発の訪問だけ読む）。
// 名簿の読み込み（登録の案内）と同じく、Excel の入出力（機能 excel）の入り切りにかかわらず出す。状態と処理は usePlanCsv
import { Download, FileText } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_FORMS } from '../excel/bookingForms';
import { VISIT_CSV_REQUIRED } from '../excel/visitCsv';
import { FieldError } from './FieldError';
import { FilePick } from './FilePick';
import { WithIcon } from './ui';
import { usePlanCsv } from './usePlanCsv';

/** 読める形の名前（「・」でつなぐ） */
const FORM_LABELS = BOOKING_FORMS.map((f) => f.label).join('・');
/** 必ず入れる列（ほかの列は空でよい。担当は書き出すだけ） */
const COLS_TEXT = VISIT_CSV_REQUIRED.join('・');

export function PlanCsvSection({ clientTerm, onImported }: { clientTerm: string; onImported: () => void }) {
  const c = usePlanCsv(onImported);
  const titleId = useId();
  return (
    <section className="add-plan-csv" aria-labelledby={titleId} data-testid="plan-csv">
      <h3 id={titleId} className="add-plan-csv-title">
        予約の CSV を読み込む
      </h3>
      <p className="sub">
        {`予約を CSV でまとめて読み込みます。必ず入れる列は ${COLS_TEXT}（${clientTerm}の名前）。読める形：${FORM_LABELS}。`}
        {`${clientTerm}は名前で突き合わせるので、先に`}
        <Link to="/clients">{clientTerm}一覧</Link>
        {
          'に入れておきます。同じ予約は二重に入りません。書き出したファイルを直して読むと、同じ訪問（訪問ID）を直します。'
        }
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
    </section>
  );
}
