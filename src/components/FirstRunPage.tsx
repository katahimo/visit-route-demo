import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FIRST_RUN_BOOKING_CHOICES,
  FIRST_RUN_NOTE,
  FIRST_RUN_Q1,
  FIRST_RUN_Q2,
  FIRST_RUN_START_CHOICES,
  FIRST_RUN_SUBMIT,
  FIRST_RUN_TITLE,
  type FirstRunAnswer,
  type FirstRunBooking,
  type FirstRunChoice,
  type FirstRunStart,
  firstRunLanding,
} from '../lib/firstRun';
import { useDemoData } from '../store';
import './firstRun.css';

/**
 * 最初の2問の門（PRD D379〜D381。ADR-0073）：保存データが無く初めて開いたとき・設定の「最初の設定をやり直す」のあとは、
 * 本体の画面の代わりに2問の画面を出す。答えると store がデータを作って書き、最初の画面（デモ＝予定の週／月、
 * 自分のデータ＝登録の案内）へ移る。ルーターの中で使う
 */
export function FirstRunGate({ children }: { children: ReactNode }) {
  const { needsFirstRun } = useDemoData();
  return needsFirstRun ? <FirstRunPage /> : children;
}

/** 1画面に2問と主ボタン「はじめる」（主ボタンは1つ）。選び直しは矢印（ネイティブのラジオ） */
function FirstRunPage() {
  const { startFirstRun } = useDemoData();
  const navigate = useNavigate();
  // 初めに選んでおく：デモで試す・定期（今までの初期データと同じ。あとから設定でやり直せる）
  const [start, setStart] = useState<FirstRunStart>('demo');
  const [booking, setBooking] = useState<FirstRunBooking>('regular');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  // 答えたら、先に最初の画面へ移ってから（ルーターの移動が済んでから）データを作る。
  // 逆にすると、本体の画面が今の URL（`#/`）のまま先に出て、知らない URL のホームへの移動に上書きされる
  const [answer, setAnswer] = useState<FirstRunAnswer | null>(null);
  const { pathname } = useLocation();
  const landing = answer ? firstRunLanding(answer) : null;
  useEffect(() => {
    if (answer && landing === pathname) startFirstRun(answer);
  }, [answer, landing, pathname, startFirstRun]);
  const submit = () => {
    const a: FirstRunAnswer = { start, booking };
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
          {FIRST_RUN_TITLE}
        </h1>
        <ChoiceGroup
          title={FIRST_RUN_Q1}
          choices={FIRST_RUN_START_CHOICES}
          value={start}
          onPick={setStart}
          testKey="start"
        />
        <ChoiceGroup
          title={FIRST_RUN_Q2}
          choices={FIRST_RUN_BOOKING_CHOICES}
          value={booking}
          onPick={setBooking}
          testKey="booking"
        />
        <p className="first-run-note">{FIRST_RUN_NOTE}</p>
        <div className="first-run-actions">
          <button type="submit" className="btn btn-primary" data-testid="first-run-submit">
            {FIRST_RUN_SUBMIT}
          </button>
        </div>
      </form>
    </main>
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
