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
 * 入ったかの見届け（トースト・控えを戻す）が続くように）。
 * onPlace を渡すと、読み込みの確認に「読み込んだあと、住所から地図の位置を探します」の1文を足し、名簿が入ったと
 * 見届けたら呼ぶ（位置の無い人を自動でまとめて置き始める。PRD D427。ADR-0094）。郵便番号・住所の検索が切なら渡さない。
 * inline（登録の案内の①②。PRD D381）：開け閉めせずいつも出し、見出し・「閉じる」・カードの枠を出さない（画面の見出しが同じことを言う）
 */
/** 開け閉めする欄（一覧の画面）は open と onClose が要る。inline（登録の案内）は要らない */
type RosterCardShow = { inline: true } | { inline?: false; open: boolean; onClose: () => void };

export function RosterCard(props: { kind: RosterKind; id: string; onPlace?: () => void } & RosterCardShow) {
  const { kind, id, onPlace } = props;
  const inline = props.inline === true;
  const open = props.inline === true || props.open;
  const onClose = props.inline === true ? undefined : props.onClose;
  const roster = useRosterCard(kind, onPlace);
  const titleId = useId();
  const { term } = roster;
  return (
    <section
      id={id}
      className={inline ? 'stack roster-card' : 'card stack roster-card'}
      aria-labelledby={inline ? undefined : titleId}
      aria-label={inline ? `${term}の名簿（Excel・CSV）` : undefined}
      hidden={!open}
      data-testid="roster-card"
    >
      {!inline && (
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
      )}
      <Hint ariaLabel="名簿の説明">
        {roster.empty
          ? 'テンプレートをダウンロードし、1行に1人ずつ書き足して保存し、そのファイルを読み込みます。'
          : `${term}の名簿を Excel・CSV で書き出し・読み込みます。読み込むと、同じ人は直し、新しい人は足します。訪問の予定は消えません。`}
      </Hint>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          disabled={roster.busy}
          onClick={() => void roster.download('xlsx')}
          data-testid="roster-export-xlsx"
        >
          <WithIcon icon={FileSpreadsheet}>
            {roster.empty ? 'テンプレートをダウンロード（Excel）' : 'Excel に書き出す'}
          </WithIcon>
        </button>
        <button
          type="button"
          className="btn"
          disabled={roster.busy}
          onClick={() => void roster.download('csv')}
          data-testid="roster-export-csv"
        >
          <WithIcon icon={FileText}>{roster.empty ? 'テンプレートをダウンロード（CSV）' : 'CSV に書き出す'}</WithIcon>
        </button>
      </div>
      {/* 0人なら追加・更新と総入れ替えは同じ結果なので、読み込み方は出さない（PRD D104） */}
      {!roster.empty && <RosterModeFields roster={roster} />}
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

/** 名簿の読み込み方（PRD D104・D441）：総入れ替え（既定。予約システムなどの名簿を写す）か追加・更新 */
function RosterModeFields({ roster }: { roster: RosterCardModel }) {
  const name = useId();
  return (
    <fieldset className="stack" style={{ gap: 6 }} data-testid="roster-mode">
      <legend>名簿の読み込み方</legend>
      <label className="check">
        <input
          type="radio"
          name={name}
          checked={roster.rosterMode === 'replace'}
          onChange={() => roster.setRosterMode('replace')}
          style={{ width: 'auto' }}
          data-testid="roster-mode-replace"
        />
        総入れ替え（ファイルに無い人を{roster.kind === 'staff' ? '休止' : '段階「終了」'}にします。消しはしません）
      </label>
      <label className="check">
        <input
          type="radio"
          name={name}
          checked={roster.rosterMode === 'merge'}
          onChange={() => roster.setRosterMode('merge')}
          style={{ width: 'auto' }}
          data-testid="roster-mode-merge"
        />
        追加・更新（ファイルに無い人はそのまま）
      </label>
    </fieldset>
  );
}
