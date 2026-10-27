// 名簿の欄（ADR-0068。PRD D103〜D107）：〈利用者さん〉一覧・〈スタッフ〉一覧の見出しの「Excel・CSV」で開く。
// その一覧の人だけを Excel のブックか CSV に書き出し、直したものを読み込む（CSV の文字コードは見分ける）。
// 全体のブック（すべてのシート）はデータの画面に残す。状態と処理は useRosterCard
import { FileSpreadsheet, FileText, RotateCcw, Sheet, X } from 'lucide-react';
import { useId } from 'react';
import type { RosterKind } from '../contracts/data';
import { EXCEL_STALE_TEXT } from '../lib/dataScreen';
import { reloadPage } from '../lib/reloadPage';
import { flushSave } from '../store';
import { FieldError } from './FieldError';
import { FilePick } from './FilePick';
import { Hint, SectionTitle, WithIcon } from './ui';
import { type RosterCardModel, useRosterCard } from './useRosterCard';

/** 読み込めるファイル（.xlsx・CSV・タブ区切り） */
const ROSTER_ACCEPT =
  '.xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain';

/** 見出しの「Excel・CSV」のボタン（名簿の欄を開け閉めする） */
export function RosterButton({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  return (
    <button
      type="button"
      className="btn"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      data-testid="roster-toggle"
    >
      <WithIcon icon={Sheet}>Excel・CSV</WithIcon>
    </button>
  );
}

/**
 * 名簿の欄。id は見出しのボタンの aria-controls が指す。閉じても消さずに隠す（読み込みの途中で閉じても、
 * 入ったかの見届け（トースト・控えを戻す）が続くように）
 */
export function RosterCard({
  kind,
  id,
  open,
  onClose,
}: {
  kind: RosterKind;
  id: string;
  open: boolean;
  onClose: () => void;
}) {
  const roster = useRosterCard(kind);
  const titleId = useId();
  const { term } = roster;
  return (
    <section
      id={id}
      className="card stack roster-card"
      aria-labelledby={titleId}
      hidden={!open}
      data-testid="roster-card"
    >
      <SectionTitle
        icon={FileSpreadsheet}
        aside={
          <button
            type="button"
            className="btn btn-small"
            onClick={onClose}
            aria-label="名簿の欄を閉じる"
            data-testid="roster-close"
          >
            <WithIcon icon={X} size={14}>
              閉じる
            </WithIcon>
          </button>
        }
      >
        <span id={titleId}>{term}の名簿（Excel・CSV）</span>
      </SectionTitle>
      <Hint ariaLabel="名簿の説明">
        {`${term}の一覧だけを書き出し・読み込みます。Excel が無いときは CSV を使えます（表計算のアプリやメモ帳で開けます）。列はデータの画面の全体のブックの「${term}」シートと同じで、全体のブックも名簿として読めます。`}
        {
          '読み込むと、ID か名前で同じ人を探して直し、いない人は足します。訪問の担当・確定（伝えた内容）・訪問は消えません。CSV の文字コード（UTF-8・Shift_JIS など）は自動で見分けます。'
        }
      </Hint>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          disabled={roster.busy}
          onClick={() => void roster.download('xlsx')}
          data-testid="roster-export-xlsx"
        >
          <WithIcon icon={FileSpreadsheet}>Excel に書き出す</WithIcon>
        </button>
        <button
          type="button"
          className="btn"
          disabled={roster.busy}
          onClick={() => void roster.download('csv')}
          data-testid="roster-export-csv"
        >
          <WithIcon icon={FileText}>CSV に書き出す</WithIcon>
        </button>
      </div>
      <RosterModeFields roster={roster} />
      <FilePick
        caption={`読み込む${term}の名簿（Excel・CSV）`}
        accept={ROSTER_ACCEPT}
        disabled={roster.busy}
        onPick={(f) => void roster.load(f)}
        testId="roster-file"
      />
      <FieldError style={{ whiteSpace: 'pre-line' }}>{roster.error}</FieldError>
      {roster.error === EXCEL_STALE_TEXT && (
        <button
          type="button"
          className="btn"
          style={{ alignSelf: 'flex-start' }}
          // 保存は間引いているので、待っている保存を書いてから読み直す
          onClick={() => reloadPage(flushSave)}
        >
          <WithIcon icon={RotateCcw}>画面を読み直す</WithIcon>
        </button>
      )}
    </section>
  );
}

/** 名簿の読み込み方（PRD D104）：追加・更新（既定）か総入れ替え */
function RosterModeFields({ roster }: { roster: RosterCardModel }) {
  const name = useId();
  return (
    <fieldset className="stack" style={{ gap: 6 }} data-testid="roster-mode">
      <legend>名簿の読み込み方</legend>
      <label className="check">
        <input
          type="radio"
          name={name}
          checked={roster.rosterMode === 'merge'}
          onChange={() => roster.setRosterMode('merge')}
          style={{ width: 'auto' }}
        />
        追加・更新（ファイルに無い人はそのまま）
      </label>
      <label className="check">
        <input
          type="radio"
          name={name}
          checked={roster.rosterMode === 'replace'}
          onChange={() => roster.setRosterMode('replace')}
          style={{ width: 'auto' }}
        />
        総入れ替え（ファイルに無い人を{roster.kind === 'staff' ? '休止' : '段階「終了」'}にします。消しはしません）
      </label>
    </fieldset>
  );
}
