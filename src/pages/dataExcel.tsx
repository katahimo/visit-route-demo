// データの画面の Excel の欄（ADR-0006。PRD D103）：全体のブックの書き出し・読み込み。状態と処理は useDataExcel が持つ。
// 名簿（〈利用者さん〉・〈スタッフ〉の一覧だけ。Excel・CSV）は各一覧の「Excel・CSV」（ADR-0068）
import { FileSpreadsheet, RotateCcw } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { FieldError } from '../components/FieldError';
import { FilePick } from '../components/FilePick';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import type { Terms } from '../contracts/documents';
import { EXCEL_STALE_TEXT } from '../lib/dataScreen';
import type { DataExcel } from './useDataExcel';

type TermsPair = Pick<Terms, 'client' | 'staff'>;

/** Excel の欄（全体のブック） */
export function ExcelCard({ excel, t }: { excel: DataExcel; t: TermsPair }) {
  /** Excel の欄の見出し（欄の名前。aria-labelledby） */
  const titleId = useId();
  return (
    <section className="card stack data-excel" aria-labelledby={titleId} data-testid="excel-card">
      <SectionTitle icon={FileSpreadsheet}>
        <span id={titleId}>Excel</span>
      </SectionTitle>
      <Hint>
        {t.staff}・{t.client}
        ・項目・条件・相性・勤務時間・繰り返し・訪問（担当を含む）を、シートごとの一覧（Excel）にします。 Excel
        で見て直し、読み込むと、いまのデータがその内容に置き換わります。確定（伝えた内容）・振り直し・
        組み方の標準の記録は Excel
        に入らず、読み込んでもいまのものが残ります（別の事業所のブックなら確かめてから消します）。
        データを丸ごと控える・別の端末へ移すときは、上の「控え（JSON）」を使います。書き方は、ブックの「使い方」のシートにあります。
      </Hint>
      <p className="sub" data-testid="excel-roster-note">
        {t.client}・{t.staff}の名簿だけを出し入れするときは、
        <Link to="/clients">{t.client}一覧</Link>・<Link to="/staff">{t.staff}一覧</Link>
        の「Excel・CSV」から（CSV も使えます。訪問の担当・確定は消えません）
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={excel.busy} onClick={() => void excel.download()}>
          <WithIcon icon={FileSpreadsheet}>Excel に書き出す</WithIcon>
        </button>
      </div>
      <FilePick
        caption="読み込む Excel（全体）"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={excel.busy}
        onPick={(f) => void excel.load(f)}
        testId="excel-file"
      />
      <FieldError style={{ whiteSpace: 'pre-line' }}>{excel.error}</FieldError>
      {excel.error === EXCEL_STALE_TEXT && (
        <button
          type="button"
          className="btn"
          style={{ alignSelf: 'flex-start' }}
          // 保存は間引いているので、書き終わるのを少し待ってから読み直す
          onClick={() => setTimeout(() => location.reload(), 500)}
        >
          <WithIcon icon={RotateCcw}>画面を読み直す</WithIcon>
        </button>
      )}
    </section>
  );
}
