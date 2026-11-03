// データの画面の区画の部品：保存の誤り・直前の状態に戻す・呼び方・控え（JSON のファイル）・古い訪問を片づける・使い方の案内（最初からやり直すは RestartCard）。
// 状態と処理は画面専用のフック（useData*）が持ち、ここは表示と押したときだけ
import { ArchiveRestore, CircleHelp, Download, Eraser, Save, Tags } from 'lucide-react';
import { useId } from 'react';
import { FieldError, invalidAttrs, submitHandler } from '../components/FieldError';
import { FilePick } from '../components/FilePick';
import { Term } from '../components/Term';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import { jstDate } from '../domain/time';
import { exportAgoText, previousText } from '../lib/backupReminder';
import { tidyHasAny, tidyPreviewText } from '../lib/dataScreen';
import { tidyMonthLabel } from '../lib/tidy';
import { type LastExport, QUOTA_MESSAGE } from '../store';
import { useDataTerms } from './useDataTerms';
import type { DataTidy } from './useDataTidy';

/** 保存できなかったときの欄（容量が足りなければ、古い訪問の片づけへ移るボタン） */
export function SaveErrorCard({ saveError, onTidy }: { saveError: string; onTidy: () => void }) {
  return (
    <div className="card stack">
      {/* 画面の上の帯（App の save-error）が読み上げるので、ここは読み上げない */}
      <FieldError live={false}>保存できませんでした：{saveError}。書き出して保管してください。</FieldError>
      {saveError === QUOTA_MESSAGE && (
        <button
          type="button"
          className="btn"
          style={{ alignSelf: 'flex-start' }}
          onClick={onTidy}
          data-testid="data-tidy-go"
        >
          <WithIcon icon={Eraser}>古い訪問を片づける</WithIcon>
        </button>
      )}
    </div>
  );
}

/** 直前の状態に戻す（PRD D227。1世代の控えがあるときだけ出す） */
export function PrevCard({ previous, onRestore }: { previous: { at: number; reason: string }; onRestore: () => void }) {
  return (
    <section className="card stack" aria-label="直前の状態に戻す" data-testid="data-prev-card">
      <SectionTitle icon={ArchiveRestore}>直前の状態に戻す</SectionTitle>
      <p className="data-prev-text" data-testid="data-prev-text">
        {previousText(previous)}
      </p>
      <Hint>置き換える前のデータを1つだけ残しています。戻すと、いまのデータと入れ替わります。</Hint>
      <button
        type="button"
        className="btn"
        style={{ alignSelf: 'flex-start' }}
        onClick={onRestore}
        data-testid="data-prev-restore"
      >
        <WithIcon icon={ArchiveRestore}>直前の状態に戻す</WithIcon>
      </button>
    </section>
  );
}

/** 呼び方（各10文字まで。PRD D250・D251） */
export function TermsCard() {
  const { terms, setTerms, check, save } = useDataTerms();
  /** 呼び方の誤りの文の id（入力欄の aria-describedby。PRD D250） */
  const errId = useId();
  return (
    <div className="card stack">
      <SectionTitle icon={Tags}>
        <Term k="terms" testId="term-terms" />
      </SectionTitle>
      <Hint>画面に出る呼び方です（10文字まで）。</Hint>
      {/* Enter で「変える」（PRD D251。押せないときは何もしない） */}
      <form
        className="row"
        style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}
        onSubmit={submitHandler(() => {
          if (check.ok && check.changed) save();
        })}
        noValidate
      >
        <label>
          訪問する人
          <input
            value={terms.staff}
            maxLength={10}
            {...invalidAttrs(check.same, errId)}
            onChange={(e) => setTerms({ ...terms, staff: e.target.value })}
          />
        </label>
        <label>
          訪問先
          <input
            value={terms.client}
            maxLength={10}
            {...invalidAttrs(check.same, errId)}
            onChange={(e) => setTerms({ ...terms, client: e.target.value })}
          />
        </label>
        <button type="submit" className="btn" disabled={!check.ok || !check.changed}>
          変える
        </button>
      </form>
      <FieldError id={errId} live={false}>
        {check.same && '訪問する人と訪問先に、同じ呼び方は使えません'}
      </FieldError>
    </div>
  );
}

/** 控え（JSON）の書き出し・読み込み（PRD D2・D3・D227） */
export function BackupCard(x: {
  /** Excel の入出力が入か（ADR-0028 の excel。切っていれば Excel との使い分けの行を出さない） */
  excelOn: boolean;
  lastExport: LastExport | null;
  error: string | null;
  onDownload: () => void;
  onPick: (file: File) => void;
}) {
  return (
    <div className="card stack">
      <SectionTitle icon={Save}>
        <Term k="backup" testId="term-backup" />
      </SectionTitle>
      <Hint>
        <ul className="hint-list">
          <li>全部のデータを1つのファイルに書き出します。控えや、別の端末へ移すときに使います。</li>
          {x.excelOn && <li>中身を見て直すときは、下の「Excel」を使います。</li>}
          <li>書き出したファイルを読み込むと、いまのデータと置き換わります。</li>
        </ul>
      </Hint>
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={x.onDownload}>
        <WithIcon icon={Download}>ファイルに書き出す</WithIcon>
      </button>
      <p className="sub data-last-export" data-testid="data-last-export">
        最後に書き出した日：{exportAgoText(x.lastExport?.date ?? null, jstDate(Date.now()))}
        {x.lastExport?.kind === 'excel' ? '（Excel 全体）' : ''}
      </p>
      <FilePick
        caption="読み込む控えのファイル"
        accept="application/json,.json"
        onPick={x.onPick}
        testId="backup-file"
      />
      <FieldError>{x.error}</FieldError>
    </div>
  );
}

/** 古い訪問を片づける（PRD D227。ADR-0032・ADR-0053） */
export function TidyCard({ tidy }: { tidy: DataTidy }) {
  const titleId = useId();
  return (
    <section
      className="card stack data-tidy"
      ref={tidy.cardRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      data-testid="data-tidy-card"
    >
      <SectionTitle icon={Eraser}>
        <span id={titleId}>古い訪問を片づける</span>
      </SectionTitle>
      <Hint>
        保存の容量が足りなくなったときに使います。選んだ月より前の日の、担当を組んだ・変えた訪問と確定した内容を消します。人・繰り返し・条件は消えません。消す前に控えを書き出してください。
      </Hint>
      <label className="data-tidy-month">
        消す範囲
        <select value={tidy.ym} onChange={(e) => tidy.setYm(e.target.value)} data-testid="data-tidy-month">
          {tidy.options.map((ym) => (
            <option key={ym} value={ym}>
              {tidyMonthLabel(ym)}の訪問
            </option>
          ))}
        </select>
      </label>
      <p className="sub" data-testid="data-tidy-preview">
        {tidyPreviewText(tidy.ym, tidy.preview)}
      </p>
      <button
        type="button"
        className="btn"
        style={{ alignSelf: 'flex-start' }}
        disabled={!tidyHasAny(tidy.preview)}
        onClick={() => void tidy.run()}
        data-testid="data-tidy-run"
      >
        <WithIcon icon={Eraser}>古い訪問を消す</WithIcon>
      </button>
    </section>
  );
}

/** 使い方の案内をもう一度見る */
export function TourCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="card stack">
      <SectionTitle icon={CircleHelp}>使い方の案内</SectionTitle>
      <Hint>初めて開いたときの短い案内（3枚）を、もう一度見られます。</Hint>
      <button
        type="button"
        className="btn"
        style={{ alignSelf: 'flex-start' }}
        onClick={onOpen}
        data-testid="tour-again"
      >
        <WithIcon icon={CircleHelp}>案内をもう一度見る</WithIcon>
      </button>
    </div>
  );
}
