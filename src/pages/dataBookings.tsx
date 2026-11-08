// データの画面・登録の案内③の「予約の CSV」の欄（ADR-0075・ADR-0090。PRD D408）：ほかのソフトの予約の CSV・このアプリの予定の CSV を、
// 単発の訪問（担当なし）として読み込む。テンプレート（このアプリの予定の CSV の列名の行）もここから出す。状態と処理は useBookingImport
import { CalendarPlus, FileText } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { FieldError } from '../components/FieldError';
import { FilePick } from '../components/FilePick';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import { useBookingImport } from '../components/useBookingImport';
import { useVisitCsvTemplate } from '../components/useVisitCsvTemplate';
import type { Terms } from '../contracts/documents';
import { BOOKING_FORMS } from '../excel/bookingForms';
import { VISIT_CSV_REQUIRED } from '../excel/visitCsv';

/** 読める予約の形の名前（「・」でつなぐ） */
const BOOKING_FORM_LABELS = BOOKING_FORMS.map((f) => f.label).join('・');

export function BookingCard({ t }: { t: Pick<Terms, 'client' | 'staff'> }) {
  const titleId = useId();
  const booking = useBookingImport();
  const tpl = useVisitCsvTemplate();
  return (
    <section className="card stack" aria-labelledby={titleId} data-testid="booking-card">
      <SectionTitle icon={CalendarPlus}>
        <span id={titleId}>予約の CSV</span>
      </SectionTitle>
      <Hint>
        {BOOKING_FORM_LABELS}の CSV を、日付のある訪問（単発）として入れます。担当は空のままです。
        テンプレートの必ず入れる列は {VISIT_CSV_REQUIRED.join('・')}です。
        {t.client}は名前で探すので、先に<Link to="/clients">{t.client}一覧</Link>
        の「Excel・CSV」で名簿を読み込んでください。同じ予約は二重に入りません。
      </Hint>
      <button
        type="button"
        className="btn"
        style={{ alignSelf: 'flex-start' }}
        disabled={booking.busy}
        onClick={tpl.template}
        data-testid="booking-template"
      >
        <WithIcon icon={FileText}>テンプレートをダウンロード（CSV）</WithIcon>
      </button>
      <FilePick
        caption="読み込む予約の CSV"
        accept=".csv,.tsv,.txt,text/csv"
        disabled={booking.busy}
        onPick={(f) => {
          tpl.clearError();
          void booking.load(f);
        }}
        testId="booking-file"
      />
      <FieldError style={{ whiteSpace: 'pre-line' }}>{tpl.error ?? booking.error}</FieldError>
    </section>
  );
}
