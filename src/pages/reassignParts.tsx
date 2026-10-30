// 欠勤の振り直しの2回目（PRD D34・D35。ADR-0011）：案B「少し動かしてよい」の欄と、連絡の一覧
import { ArrowUpToLine, MessageSquareText, Play, Square, UserRoundCheck } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DetailsFold } from '../components/DetailsFold';
import { FLOATING_EVENT, useFloatingEdge } from '../components/floating';
import { WeightSlider } from '../components/parts';
import { Hint, WithIcon } from '../components/ui';
import { useExceptionsOnly } from '../components/useFeature';
import { useValueStore } from '../components/valueStore';
import type { ReassignDiff } from '../contracts/reassign';
import { deltaText, r0 } from '../lib/common';
import { reassignWords } from '../lib/exceptionView';
import type { ReadableStore } from '../lib/valueStore';
import { STAY_WEIGHT_DEFAULT } from '../reassign';

/** 案A・案B の比べる数（元の案との差と点数） */
export type ReassignOption = {
  key: 'insert' | 'anneal';
  title: string;
  diff: ReassignDiff | null;
  /** 点数（点数の基準の物差し） */
  hundred: number | null;
  /** 今の担当と同じか */
  current: boolean;
};

/** 担当が変わる訪問のうち、欠勤の人以外の訪問（案B が動かした分） */
function othersMoved(d: ReassignDiff, absent: ReadonlySet<string>): number {
  return d.moved.filter((m) => m.from !== null && m.to !== null && !absent.has(m.from)).length;
}

/** 案B の進み具合のバーと回数（外の入れ物から読み、変わってもここだけ描き直す。PRD D249） */
function AnnealProgress({ store }: { store: ReadableStore<{ iteration: number; total: number } | null> }) {
  const progress = useValueStore(store);
  return (
    <>
      <progress
        value={progress?.iteration ?? 0}
        max={progress?.total ?? 1}
        style={{ width: '100%' }}
        aria-label="案B の進み具合"
      />
      <span className="sub" data-testid="anneal-progress">
        案B を作っています：
        {progress ? `${progress.iteration.toLocaleString()} / ${progress.total.toLocaleString()} 回` : '準備中…'}
      </span>
    </>
  );
}

/** 案A・案B の比べる表（振り直す前との差・点数）と、どちらかを反映するボタン */
function AnnealTable({
  options,
  absentStaff,
  onChoose,
  stopped,
  running,
}: {
  options: ReassignOption[];
  absentStaff: ReadonlySet<string>;
  onChoose: (key: ReassignOption['key']) => void;
  /** 案B を途中で止めた */
  stopped: boolean;
  /** 案B を計算中 */
  running: boolean;
}) {
  const words = reassignWords(useExceptionsOnly());
  const score = (o: ReassignOption) => (o.hundred === null ? '—' : `${o.hundred}点`);
  const rows: { label: string; value: (o: ReassignOption) => string }[] = [
    ...(words.scoreInTable ? [{ label: '点数', value: score }] : []),
    { label: '入らない', value: (o) => (o.diff ? `${o.diff.unplaced.length}件` : '—') },
    {
      label: '担当が変わる訪問',
      value: (o) =>
        o.diff ? `${o.diff.moved.length}件（うち欠勤の人以外 ${othersMoved(o.diff, absentStaff)}件）` : '—',
    },
    { label: '時刻がずれる訪問', value: (o) => (o.diff ? `${o.diff.shifted.length}件` : '—') },
    { label: '変わる人', value: (o) => (o.diff ? `${o.diff.changedStaff.length}人` : '—') },
    { label: '移動', value: (o) => (o.diff ? deltaText(r0(o.diff.travelDelta), '分') || '±0分' : '—') },
  ];
  return (
    <>
      <table className="anneal-table" data-testid="anneal-table">
        <thead>
          <tr>
            <th scope="col">振り直す前との差</th>
            {options.map((o) => (
              <th key={o.key} scope="col">
                {o.title}
                {o.current && <span className="chip chip-ok anneal-current">{words.current}</span>}
                {o.key === 'anneal' && stopped && <span className="sub">（途中で止めた）</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {options.map((o) => (
                <td key={o.key}>{r.value(o)}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td />
            {options.map((o) => (
              <td key={o.key}>
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={o.current || running}
                  onClick={() => onChoose(o.key)}
                >
                  {o.current ? words.applied : words.choose(o.title)}
                </button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {/* 切は点数を「詳しく」の中へ（PRD D384） */}
      {!words.scoreInTable && (
        <DetailsFold testId="anneal-details">
          <span className="sub">点数：{options.map((o) => `${o.title} ${score(o)}`).join('・')}</span>
        </DetailsFold>
      )}
    </>
  );
}

/**
 * 案B「少し動かしてよい」の欄（差の欄の中）：「変更を減らす」のスライダー（「詳しく」に畳む。PRD D265）・作る・進み具合・
 * 止める・案A と案B の比較・選ぶ。
 * 案A で入らない訪問があるときは「おすすめ」を出す
 */
export function AnnealBox({
  weight,
  onWeight,
  recommended,
  disabledWhy,
  running,
  progress,
  onStart,
  onStop,
  options,
  absentStaff,
  onChoose,
  stopped,
  note = null,
}: {
  weight: number;
  onWeight: (w: number) => void;
  recommended: boolean;
  /** 作れないときの理由（欠勤が取り消されている・計算中など）。null なら押せる */
  disabledWhy: string | null;
  /** 案B を計算中 */
  running: boolean;
  /** 計算の進み具合（外の入れ物。変わっても進み具合の部品だけ描き直す。PRD D249） */
  progress: ReadableStore<{ iteration: number; total: number } | null>;
  onStart: () => void;
  onStop: () => void;
  /** 案A・案B（案B を作ったあと） */
  options: ReassignOption[];
  absentStaff: ReadonlySet<string>;
  onChoose: (key: ReassignOption['key']) => void;
  /** 案B を途中で止めた */
  stopped: boolean;
  /** 案B を案A のままにした理由（案A に入っていた訪問を外した・案A を超えられなかった）。無ければ null */
  note?: string | null;
}) {
  const showTable = options.some((o) => o.key === 'anneal');
  return (
    <div className="stack anneal-box" style={{ gap: 6 }} data-testid="anneal-box">
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <strong>少し動かしてよい（案B）</strong>
        {recommended && <span className="chip chip-primary">おすすめ：案A で入らない訪問があります</span>}
        <Hint>
          <ul className="hint-list">
            <li>ほかの人の訪問の担当・順番・時刻も少し動かして、入らない訪問を入れる案を AI が作ります。</li>
            <li>変える訪問が少ない案を選びます。案A より悪い案にはなりません。</li>
            <li>変えた訪問の数は、下の表で見られます。</li>
          </ul>
        </Hint>
      </div>
      {/* 「変更を減らす」はふだん触らないので「詳しく」に畳む（PRD D265。開いたかどうかは保存しない） */}
      <details className="anneal-more" data-testid="anneal-more">
        <summary>
          詳しく：変更を減らす（{weight.toFixed(1)}
          {weight === STAY_WEIGHT_DEFAULT ? '・既定' : ''}）
        </summary>
        <div className="row anneal-weight" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="sub">変更を減らす</span>
          <WeightSlider value={weight} onChange={onWeight} label="変更を減らす" />
          <span className="sub">
            担当が変わる1件＝移動{r0(weight * 10)}分ぶん・時刻のずれ10分＝移動{r0(weight * 2 * 10) / 10}分ぶん
            {weight === STAY_WEIGHT_DEFAULT ? '（既定）' : ''}
          </span>
          <span className="sub">重みが大きいと案A のままになることがあります（変更の減点が、得より大きいとき）</span>
        </div>
      </details>
      <div className="row" style={{ gap: 6 }}>
        {running ? (
          <button type="button" className="btn btn-small" onClick={onStop}>
            <WithIcon icon={Square} size={14}>
              止める
            </WithIcon>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-small"
            disabled={disabledWhy !== null}
            title={disabledWhy ?? undefined}
            onClick={onStart}
          >
            <WithIcon icon={Play} size={14}>
              {showTable ? '案B を作り直す' : '案B を作る'}
            </WithIcon>
          </button>
        )}
        {disabledWhy && !running && <span className="sub">{disabledWhy}</span>}
      </div>
      {running && (
        <div className="stack" style={{ gap: 2 }} aria-live="polite">
          <AnnealProgress store={progress} />
        </div>
      )}
      {note && !running && (
        <p className="sub" data-testid="anneal-note">
          {note}
        </p>
      )}
      {showTable && (
        <AnnealTable
          options={options}
          absentStaff={absentStaff}
          onChoose={onChoose}
          stopped={stopped}
          running={running}
        />
      )}
    </div>
  );
}

/** 差の欄の「連絡の一覧」ボタン（件数は連絡が要る訪問の数） */
export function ContactButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button type="button" className="btn btn-small" onClick={onOpen}>
      <WithIcon icon={MessageSquareText} size={14}>
        連絡の一覧{count > 0 ? `（訪問${count}件）` : ''}
      </WithIcon>
    </button>
  );
}

/**
 * 差の欄が画面の外にあるとき、画面の左下に出す小さな帯（地図の MapDock は右下）：振り直しの状態と、
 * 差の欄へ・案B を作る・連絡の一覧への近道。差の欄が見えているあいだは出さない
 */
export function ReassignDock({
  targetId,
  unplaced,
  left,
  method,
  annealRecommended,
  annealRunning,
  contactCount,
  onGo,
  onAnneal,
  onContacts,
}: {
  /** 差の欄の要素の id */
  targetId: string;
  unplaced: number;
  /** 欠勤の人に残る訪問の件数 */
  left: number;
  method: 'insert' | 'anneal';
  /** 案B を勧める（押せる） */
  annealRecommended: boolean;
  annealRunning: boolean;
  contactCount: number;
  onGo: () => void;
  onAnneal: () => void;
  onContacts: () => void;
}) {
  const [inView, setInView] = useState(true);
  // 差の欄が見えているか。初めは実際の位置で決め（一瞬遅れて出ない）、あとは IntersectionObserver で
  useLayoutEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setInView(r.bottom > 0 && r.top < window.innerHeight);
    const io = new IntersectionObserver(([e]) => setInView(e?.isIntersecting ?? true), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);
  // 知らせ（トースト）が避けられるよう、位置を CSS の変数（--reassign-dock-top）に出す
  const edgeRef = useFloatingEdge('reassign-dock');
  const boxRef = useRef<HTMLElement | null>(null);
  // 1行に収まらなければ、ボタンの文言を隠してアイコンだけにする（中身・画面の幅・地図の位置が変わったら測り直す）
  const [tick, setTick] = useState(0);
  useEffect(() => {
    // 自分の位置の知らせでは測り直さない（測り直しで繰り返さない）
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== 'reassign-dock') setTick((t) => t + 1);
    };
    window.addEventListener('resize', on);
    window.addEventListener(FLOATING_EVENT, on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener(FLOATING_EVENT, on);
    };
  }, []);
  const sig = JSON.stringify([unplaced, left, method, annealRecommended, annealRunning, contactCount, inView, tick]);
  const [compactFor, setCompactFor] = useState<string | null>(null);
  const compact = compactFor === sig;
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || compact) return;
    if (el.scrollWidth > el.clientWidth + 1) setCompactFor(sig);
  }, [sig, compact]);
  if (inView) return null;
  const ref = (el: HTMLElement | null) => {
    boxRef.current = el;
    edgeRef(el);
  };
  const plan = method === 'anneal' ? '案B' : '案A';
  /** 文言（compact のときは隠し、aria-label と title で読める） */
  const label = (text: string) => (compact ? null : <span>{text}</span>);
  return (
    <section
      ref={ref}
      className={`reassign-dock no-print ${compact ? 'is-compact' : ''}`}
      aria-label="欠勤の振り直し（近道）"
      data-testid="reassign-dock"
    >
      <strong className="row reassign-dock-title" style={{ gap: 4 }} title={`欠勤の振り直し（${plan}）`}>
        <UserRoundCheck size={15} aria-hidden="true" />
        <span className="ellipsis">{compact ? `振り直し（${plan}）` : `欠勤の振り直し（${plan}）`}</span>
      </strong>
      <span className={unplaced > 0 ? 'chip chip-warn' : 'chip chip-ok'}>入らない {unplaced}件</span>
      {left > 0 && (
        <span className="chip chip-red" title={`欠勤の人のまま ${left}件`}>
          {compact ? '欠勤のまま' : '欠勤の人のまま'} {left}件
        </span>
      )}
      {annealRunning ? (
        <span className="sub">{compact ? '案B…' : '案B を作っています…'}</span>
      ) : (
        annealRecommended && (
          <button
            type="button"
            className="btn btn-small"
            onClick={onAnneal}
            aria-label="少し動かしてよい案（案B）を作る"
            title="少し動かしてよい案（案B）を作る"
          >
            <Play size={14} aria-hidden="true" />
            {compact ? <span>案B</span> : <span>案B を作る</span>}
          </button>
        )
      )}
      <button
        type="button"
        className="btn btn-small"
        onClick={onContacts}
        aria-label={`連絡の一覧${contactCount > 0 ? `（${contactCount}件）` : ''}`}
        title="連絡の一覧"
      >
        <MessageSquareText size={14} aria-hidden="true" />
        {compact
          ? contactCount > 0 && <span>{contactCount}</span>
          : label(`連絡${contactCount > 0 ? `（${contactCount}件）` : ''}`)}
      </button>
      <button type="button" className="btn btn-small" onClick={onGo} aria-label="差の欄へ" title="差の欄へ">
        <ArrowUpToLine size={14} aria-hidden="true" />
        {label('差の欄へ')}
      </button>
    </section>
  );
}
