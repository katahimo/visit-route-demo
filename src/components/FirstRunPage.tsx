import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FIRST_RUN_CANCEL,
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
  firstRunLanding,
} from '../lib/firstRun';
import {
  RELEASE_CHANGES,
  RELEASE_KEEP_DESC,
  RELEASE_KEEP_LABEL,
  RELEASE_KEEP_SUBMIT,
  RELEASE_Q1,
  RELEASE_TITLE,
  RELEASE_WARN,
  type ReleaseNote,
} from '../lib/releaseNotes';
import { useDemoData } from '../store';
import './firstRun.css';

/**
 * 最初の2問の門（PRD D379〜D381・D437。ADR-0073・ADR-0102）：保存データが無く初めて開いたとき・データの画面の「始め方を選び直す」のあと・
 * まだ見ていないデモの更新があるとき（問1のいちばん上に「今のデータを使い続ける」）は、
 * 本体の画面の代わりに2問の画面を出す。答えると store がデータを作って書き、最初の画面（デモ＝予定の週／月、
 * 自分のデータ＝登録の案内）へ移る。ルーターの中で使う
 */
export function FirstRunGate({ children }: { children: ReactNode }) {
  const { needsFirstRun } = useDemoData();
  return needsFirstRun ? <FirstRunPage /> : children;
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
  const [kind, setKind] = useState<FirstRunUse>('basic');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  // 答えたら、先に最初の画面へ移ってから（ルーターの移動が済んでから）データを作る。
  // 逆にすると、本体の画面が今の URL（`#/`）のまま先に出て、知らない URL の予定への移動に上書きされる
  const [answer, setAnswer] = useState<FirstRunAnswer | null>(null);
  const { pathname } = useLocation();
  const landing = answer ? firstRunLanding(answer) : null;
  useEffect(() => {
    if (answer && landing === pathname) startFirstRun(answer);
  }, [answer, landing, pathname, startFirstRun]);
  const submit = () => {
    if (start === 'keep') {
      cancelFirstRun();
      return;
    }
    const a: FirstRunAnswer = { start, use: kind };
    setAnswer(a);
    navigate(firstRunLanding(a), { replace: true });
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
          title={releaseNotice ? RELEASE_Q1 : FIRST_RUN_Q1}
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
        {releaseNotice && !keep && (
          <p className="first-run-warn" data-testid="first-run-warn">
            {RELEASE_WARN}
          </p>
        )}
        <p className="first-run-note">{FIRST_RUN_NOTE}</p>
        <div className="first-run-actions">
          {/* やり直しのときだけ：今のデータのまま戻る（従のボタン。主ボタンは「はじめる」1つ） */}
          {redoingFirstRun && (
            <button type="button" className="btn" onClick={cancelFirstRun} data-testid="first-run-cancel">
              {FIRST_RUN_CANCEL}
            </button>
          )}
          <button type="submit" className="btn btn-primary" data-testid="first-run-submit">
            {keep ? RELEASE_KEEP_SUBMIT : FIRST_RUN_SUBMIT}
          </button>
        </div>
      </form>
    </main>
  );
}

/** 更新の変わったところ（新しい順に、更新の日と箇条書き。PRD D437） */
function ReleaseChanges({ notes }: { notes: readonly ReleaseNote[] }) {
  const headingId = useId();
  return (
    <section className="first-run-release" aria-labelledby={headingId} data-testid="first-run-release">
      <h2 id={headingId}>{RELEASE_CHANGES}</h2>
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
    </section>
  );
}

/** 1問の選択肢（ネイティブのラジオ。Tab は選んだ方だけ、矢印で選び直す） */
function ChoiceGroup<T extends string>({
  title,
  choices,
  value,
  onPick,
  testKey,
}: {
  title: string;
  choices: readonly FirstRunChoice<T>[];
  value: T;
  onPick: (v: T) => void;
  /** data-testid の元（`first-run-<testKey>-<値>`） */
  testKey: string;
}) {
  const name = useId();
  const titleId = useId();
  return (
    <fieldset className="first-run-choice" aria-labelledby={titleId} data-testid={`first-run-${testKey}`}>
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
