// データの画面の Excel の欄（ADR-0006・ADR-0020。PRD D103・D104・D209）：対象の切り替え・名簿の読み込み方・
// 書き出し・読み込み・最終勤務日の知らせ。状態と処理は useDataExcel が持つ
import { CalendarClock, FileSpreadsheet, RotateCcw, X } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { FieldError } from '../components/FieldError';
import { FilePick } from '../components/FilePick';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import type { Terms } from '../contracts/documents';
import { EXCEL_STALE_TEXT } from '../lib/dataScreen';
import type { LastDayPerson } from '../lib/personLinks';
import type { DataExcel } from './useDataExcel';

type TermsPair = Pick<Terms, 'client' | 'staff'>;

/** Excel の欄。offboardOn は退職・担当替えの機能（ADR-0028 の offboard）が入（切っていれば最終勤務日の知らせを出さない） */
export function ExcelCard({ excel, t, offboardOn }: { excel: DataExcel; t: TermsPair; offboardOn: boolean }) {
  /** Excel の欄の見出し（欄の名前。aria-labelledby） */
  const titleId = useId();
  const { kind, rosterTerm } = excel;
  return (
    <section
      className="card stack data-excel"
      ref={excel.cardRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      data-testid="excel-card"
    >
      <SectionTitle icon={FileSpreadsheet}>
        <span id={titleId}>Excel</span>
      </SectionTitle>
      <Hint>
        {kind === 'all' ? (
          <>
            {t.staff}・{t.client}
            ・項目・条件・相性・勤務時間・訪問を、シートごとの一覧（Excel）にします。Excel
            で直して読み込むと、いまのデータがその内容に置き換わります。訪問の担当と確定（伝えた内容）は消えます。
            書き方は、ブックの「使い方」のシートにあります。
          </>
        ) : (
          <>
            {`${rosterTerm}の一覧（シート1枚）だけを書き出し・読み込みます。列は全体のブックの「${rosterTerm}」シートと同じで、全体のブックも名簿として読めます。`}
            {
              '読み込むと、ID か名前で同じ人を探して直し、いない人は足します。訪問の担当・確定（伝えた内容）・訪問は消えません。'
            }
          </>
        )}
      </Hint>
      <fieldset className="segmented" aria-label="Excel の対象" data-testid="excel-kind">
        {(
          [
            ['all', '全体'],
            ['client', `${t.client}の名簿`],
            ['staff', `${t.staff}の名簿`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={kind === k ? 'is-on' : undefined}
            aria-pressed={kind === k}
            onClick={() => excel.setKind(k)}
          >
            {label}
          </button>
        ))}
      </fieldset>
      {kind !== 'all' && <RosterModeFields excel={excel} />}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={excel.busy} onClick={() => void excel.download()}>
          <WithIcon icon={FileSpreadsheet}>Excel に書き出す</WithIcon>
        </button>
      </div>
      <FilePick
        // 種類を切り替えたら、選んだファイルの文を消す（前の種類で選んだ名前を残さない）
        key={kind}
        caption={kind === 'all' ? '読み込む Excel（全体）' : `読み込む${rosterTerm}の名簿（Excel）`}
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={excel.busy}
        onPick={(f) => void excel.load(f)}
        testId="excel-file"
      />
      {/* 退職・担当替えを切っていれば最終勤務日の知らせを出さない（ADR-0028 の offboard。PRD D209） */}
      {offboardOn && excel.lastDay && (
        <LastDayNotice people={excel.lastDay} staffTerm={t.staff} onClose={excel.closeLastDay} />
      )}
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

/** 名簿の読み込み方（PRD D104）：追加・更新（既定）か総入れ替え */
function RosterModeFields({ excel }: { excel: DataExcel }) {
  return (
    <fieldset className="stack" style={{ gap: 6 }} data-testid="roster-mode">
      <legend>名簿の読み込み方</legend>
      <label className="check">
        <input
          type="radio"
          name="roster-mode"
          checked={excel.rosterMode === 'merge'}
          onChange={() => excel.setRosterMode('merge')}
          style={{ width: 'auto' }}
        />
        追加・更新（ブックに無い人はそのまま）
      </label>
      <label className="check">
        <input
          type="radio"
          name="roster-mode"
          checked={excel.rosterMode === 'replace'}
          onChange={() => excel.setRosterMode('replace')}
          style={{ width: 'auto' }}
        />
        総入れ替え（ブックに無い人を{excel.kind === 'staff' ? '休止' : '段階「終了」'}にします。消しはしません）
      </label>
    </fieldset>
  );
}

/** 名簿の読み込みで最終勤務日が入った〈スタッフ〉の知らせ（PRD D209）。名前からその人の画面へ */
function LastDayNotice({
  people,
  staffTerm,
  onClose,
}: {
  people: LastDayPerson[];
  staffTerm: string;
  onClose: () => void;
}) {
  return (
    <section className="data-notice" aria-label="最終勤務日の知らせ" data-testid="lastday-notice">
      <p className="data-notice-text">
        <CalendarClock size={16} strokeWidth={2.2} aria-hidden="true" />
        <span>
          最終勤務日の入った{staffTerm}がいます。{staffTerm}の画面（名前から開く）で担当の振り直しを確かめてください
        </span>
      </p>
      <ul className="data-notice-list">
        {people.map((x) => (
          <li key={x.id}>
            <Link to={`/staff/${encodeURIComponent(x.id)}`} data-testid="lastday-link">
              {x.name}
            </Link>
            （最終勤務日 {x.lastDay}）
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-small data-notice-close"
        onClick={onClose}
        aria-label="最終勤務日の知らせを閉じる"
        data-testid="lastday-close"
      >
        <WithIcon icon={X}>閉じる</WithIcon>
      </button>
    </section>
  );
}
