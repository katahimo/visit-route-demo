// データの画面の「予約の CSV」の欄（ADR-0075。PRD D398）：ほかのソフトの予約の CSV を、単発の訪問（担当なし）として読み込む。
// 状態と処理は useBookingImport が持つ
import { CalendarPlus } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { FieldError } from '../components/FieldError';
import { FilePick } from '../components/FilePick';
import { Hint, SectionTitle } from '../components/ui';
import { useBookingImport } from '../components/useBookingImport';
import type { Terms } from '../contracts/documents';
import { BOOKING_FORMS } from '../excel/bookingForms';

/** 読める予約の形の名前（「・」でつなぐ） */
const BOOKING_FORM_LABELS = BOOKING_FORMS.map((f) => f.label).join('・');

export function BookingCard({ t }: { t: Pick<Terms, 'client' | 'staff'> }) {
  const titleId = useId();
  const booking = useBookingImport();
  return (
    <section className="card stack" aria-labelledby={titleId} data-testid="booking-card">
      <SectionTitle icon={CalendarPlus}>
        <span id={titleId}>予約の CSV</span>
      </SectionTitle>
      <Hint>
        ほかのソフトから書き出した予約の CSV（読める形：{BOOKING_FORM_LABELS}
        ）を、1回ずつの訪問（担当なし）として入れます。
        {t.client}は名前で突き合わせるので、先に<Link to="/clients">{t.client}一覧</Link>
        の「Excel・CSV」で{t.client}の名簿を読み込んでください。同じ予約番号は直し、二重には入れません。
      </Hint>
      <FilePick
        caption="読み込む予約の CSV"
        accept=".csv,.tsv,.txt,text/csv"
        disabled={booking.busy}
        onPick={(f) => void booking.load(f)}
        testId="booking-file"
      />
      <FieldError style={{ whiteSpace: 'pre-line' }}>{booking.error}</FieldError>
    </section>
  );
}
