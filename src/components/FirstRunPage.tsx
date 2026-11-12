import { Download } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FIRST_RUN_BACKUP_BUTTON,
  FIRST_RUN_BACKUP_LEAD,
  FIRST_RUN_CANCEL,
  FIRST_RUN_ENTRY,
  FIRST_RUN_NOTE,
  FIRST_RUN_Q1,
  FIRST_RUN_Q2,
  FIRST_RUN_START_CHOICES,
  FIRST_RUN_SUBMIT,
  FIRST_RUN_TITLE,
  FIRST_RUN_USE_CHOICES,
  type FirstRunAnswer,
  type FirstRunChoice,
  type FirstRunStart,
  type FirstRunUse,
  firstRunBackupDone,
  firstRunGuard,
  firstRunLanding,
  isFirstRunEntry,
} from '../lib/firstRun';
import {
  RELEASE_CHANGES,
  RELEASE_KEEP_DESC,
  RELEASE_KEEP_LABEL,
  RELEASE_KEEP_SUBMIT,
  RELEASE_TITLE,
  RELEASE_WARN,
  type ReleaseNote,
  releaseQ1,
} from '../lib/releaseNotes';
import { useDemoData } from '../store';
import './firstRun.css';
import { WithIcon } from './ui';
import { type BackupDownload, useBackupDownload } from './useBackupDownload';
import { useFirstRunBack } from './useFirstRunBack';

/**
 * 最初の2問の門（PRD D379〜D381・D437。ADR-0073・ADR-0102）：保存データが無く初めて開いたとき・データの画面・登録の案内の「最初の設定をやり直す」のあと・
 * ブラウザの「戻る」で最初の設定を出していた履歴の項目へ戻ったとき（useFirstRunBack）・
 * まだ見ていないデモの更新があるとき（問1のいちばん上に「今のデータを使い続ける」）は、
 * 本体の画面の代わりに2問の画面を出す。答えると store がデータを作って書き、最初の画面（デモ＝予定の週／月、
 * 自分のデータ＝登録の案内）へ移る。ルーターの中で使う
 */
export function FirstRunGate({ children }: { children: ReactNode }) {
  const { needsFirstRun } = useDemoData();
  const backToFirstRun = useFirstRunBack();
  return needsFirstRun || backToFirstRun ? <FirstRunPage /> : children;
}

/** 問1の答え：更新の知らせのときは「今のデータを使い続ける」（keep）も選べる */
type StartPick = FirstRunStart | 'keep';

const KEEP_CHOICE: FirstRunChoice<StartPick> = {
  value: 'keep',
  label: RELEASE_KEEP_LABEL,
  description: RELEASE_KEEP_DESC,
};

/**
 * 1画面に2問（問2は使い方＝ひな形の4つ。ADR-0092）と主ボタン「はじめる」（主ボタンは1つ）。選び直しは矢印（ネイティブのラジオ）。
 * 更新の知らせ（PRD D437）は見出しを「デモを更新しました」にし、変わったところを出し、問1のいちばん上の「今のデータを使い続ける」を選んでおく
 * （選んでいるあいだは問2を出さない。主ボタン「開く」で今の画面のまま開く）
 */
function FirstRunPage() {
  const { startFirstRun, redoingFirstRun, releaseNotice, cancelFirstRun } = useDemoData();
  const navigate = useNavigate();
  // 初めに選んでおく：更新の知らせは今のデータ、ほかはデモで試す・定期の訪問（基本）（今までの初期データと同じ。あとからデータの画面で選び直せる）
  const [start, setStart] = useState<StartPick>(releaseNotice ? 'keep' : 'demo');
  const keep = start === 'keep';
  // 答えるとデータが消えるとき（やり直し・更新の知らせでデモ／自分のデータを選んだ）は注意を出す
  const warn = redoingFirstRun || (releaseNotice !== null && !keep);
  // 今のデータがあるのに作り直すとき（warn と同じ条件）は、この画面で控えを書き出すまで主ボタンを押せない（PRD D448。ADR-0113）
  const downloadBackup = useBackupDownload();
  const [backup, setBackup] = useState<BackupDownload | null>(null);
  const guard = firstRunGuard({
    hasData: redoingFirstRun || releaseNotice !== null,
    keep,
    backedUp: backup !== null && 'name' in backup,
  });
  const [kind, setKind] = useState<FirstRunUse>('basic');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const warnId = useId();
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  // 答えたら、先に最初の画面へ移ってから（ルーターの移動が済んでから）データを作る。
  // 逆にすると、本体の画面が今の URL（`#/`）のまま先に出て、知らない URL の予定への移動に上書きされる
  const [answer, setAnswer] = useState<FirstRunAnswer | null>(null);
  const { pathname, search, state } = useLocation();
  const landing = answer ? firstRunLanding(answer) : null;
  useEffect(() => {
    if (answer && landing === pathname) startFirstRun(answer);
  }, [answer, landing, pathname, startFirstRun]);
  // 閉じる（今のデータのまま）：印の項目なら印を外す（外さないと、あとでこの項目へ戻るたびに2問が出る）
  const close = () => {
    cancelFirstRun();
    if (isFirstRunEntry(state)) navigate({ pathname, search }, { replace: true, state: null });
  };
  const submit = () => {
    if (start === 'keep') {
      close();
      return;
    }
    if (!guard.canSubmit) return;
    const a: FirstRunAnswer = { start, use: kind };
    setAnswer(a);
    // 2問の画面の項目に印を付けてから先へ進む（ブラウザの「戻る」で最初の設定へ戻れる。PRD D381・D438）
    navigate({ pathname, search }, { replace: true, state: FIRST_RUN_ENTRY });
    navigate(firstRunLanding(a));
  };
  return (
    <main className="first-run" data-testid="first-run">
      <form
        className="card first-run-card"
        aria-labelledby={titleId}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h1 id={titleId} ref={headingRef} tabIndex={-1}>
          {releaseNotice ? RELEASE_TITLE : FIRST_RUN_TITLE}
        </h1>
        {releaseNotice && <ReleaseChanges notes={releaseNotice} />}
        <ChoiceGroup<StartPick>
          title={releaseNotice ? releaseQ1(!keep) : FIRST_RUN_Q1}
          describedBy={warn ? warnId : undefined}
          choices={releaseNotice ? [KEEP_CHOICE, ...FIRST_RUN_START_CHOICES] : FIRST_RUN_START_CHOICES}
          value={start}
          onPick={setStart}
          testKey="start"
        />
        {!keep && (
          <ChoiceGroup
            title={FIRST_RUN_Q2}
            choices={FIRST_RUN_USE_CHOICES}
            value={kind}
            onPick={setKind}
            testKey="use"
          />
        )}
        {warn && (
          <p id={warnId} className="first-run-warn" data-testid="first-run-warn">
            {RELEASE_WARN}
          </p>
        )}
        {guard.needsBackup && <BackupFirst result={backup} onDownload={() => setBackup(downloadBackup())} />}
        <p className="first-run-note">{FIRST_RUN_NOTE}</p>
        <div className="first-run-actions">
          {/* やり直しのときだけ：今のデータのまま戻る（従のボタン。主ボタンは「はじめる」1つ） */}
          {redoingFirstRun && (
            <button type="button" className="btn" onClick={close} data-testid="first-run-cancel">
              {FIRST_RUN_CANCEL}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={!guard.canSubmit} data-testid="first-run-submit">
            {keep ? RELEASE_KEEP_SUBMIT : FIRST_RUN_SUBMIT}
          </button>
        </div>
      </form>
    </main>
  );
}

/** 作り直す前の控え（PRD D448）：案内と［控えを書き出す］、書き出したあとはファイル名と戻し方（書き出せなければ理由） */
function BackupFirst({ result, onDownload }: { result: BackupDownload | null; onDownload: () => void }) {
  return (
    <div className="first-run-backup" data-testid="first-run-backup">
      <p>{FIRST_RUN_BACKUP_LEAD}</p>
      <button type="button" className="btn" onClick={onDownload} data-testid="first-run-backup-button">
        <WithIcon icon={Download}>{FIRST_RUN_BACKUP_BUTTON}</WithIcon>
      </button>
      <output className="first-run-backup-result" data-testid="first-run-backup-result">
        {result === null ? '' : 'name' in result ? firstRunBackupDone(result.name) : result.error}
      </output>
    </div>
  );
}

/** 更新の変わったところ（新しい順に、更新の日と箇条書き。PRD D437）。場所を取るので畳んで始め、見出しに更新の件数を出す */
function ReleaseChanges({ notes }: { notes: readonly ReleaseNote[] }) {
  return (
    <details className="first-run-release" data-testid="first-run-release">
      <summary data-testid="first-run-release-summary">
        {RELEASE_CHANGES}（{notes.length}件の更新）
      </summary>
      {notes.map((n) => (
        <div key={n.id}>
          <p className="first-run-release-date">{n.id}</p>
          <ul>
            {n.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

/** 1問の選択肢（ネイティブのラジオ。Tab は選んだ方だけ、矢印で選び直す） */
function ChoiceGroup<T extends string>({
  title,
  choices,
  value,
  onPick,
  testKey,
  describedBy,
}: {
  title: string;
  choices: readonly FirstRunChoice<T>[];
  value: T;
  onPick: (v: T) => void;
  /** data-testid の元（`first-run-<testKey>-<値>`） */
  testKey: string;
  /** 選んだ答えで出る注意の id（選び直したときに読み上げで伝える） */
  describedBy?: string;
}) {
  const name = useId();
  const titleId = useId();
  return (
    <fieldset
      className="first-run-choice"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      data-testid={`first-run-${testKey}`}
    >
      <legend id={titleId} className="first-run-choice-title">
        {title}
      </legend>
      {choices.map((c) => (
        <label key={c.value} className={`first-run-choice-item${value === c.value ? ' is-on' : ''}`}>
          <input
            type="radio"
            name={name}
            value={c.value}
            checked={value === c.value}
            onChange={() => onPick(c.value)}
            data-testid={`first-run-${testKey}-${c.value}`}
          />
          <span>
            <strong>{c.label}</strong>
            <span className="first-run-choice-desc">{c.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
