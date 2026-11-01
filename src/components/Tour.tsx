import { Compass } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Terms } from '../contracts/documents';
import { jstDate } from '../domain/time';
import { confirmLeave } from '../lib/leaveGuard';
import { dayHref } from '../lib/links';
import { TOUR_TODAY_LABEL, type TourMove, tourCountText, tourMove, tourNextLabel, tourSteps } from '../lib/tour';
import { useBodyScrollLock } from './useBodyScrollLock';
import { useFeatures } from './useFeature';
import { useTourModal } from './useTourModal';
import './tour.css';

/** 案内を開く関数（データの画面の「案内をもう一度見る」） */
const Ctx = createContext<() => void>(() => {});
export const useTour = () => useContext(Ctx);

/**
 * 案内ツアー（PRD D192・D193。ADR-0025）。管理の画面（AdminShell）で1つ。
 * 初めて開いたときには出さない（最初の2問が入口。PRD D379。ADR-0073）。データの画面の「案内をもう一度見る」だけで開く
 */
export function TourProvider({ terms, children }: { terms: Pick<Terms, 'client' | 'staff'>; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openTour = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const navigate = useNavigate();
  /** 最後の枚の「今日の予定を開く」：閉じて今日の日の画面へ（PRD D226） */
  const openToday = useCallback(() => {
    close();
    // 下書きのある画面（条件の重み）から移るときは確かめる（断れば留まる。PRD D286）
    void confirmLeave().then((ok) => {
      if (ok) navigate(dayHref(jstDate(Date.now())));
    });
  }, [close, navigate]);
  return (
    <Ctx.Provider value={openTour}>
      {children}
      {open && <TourDialog terms={terms} onClose={close} onToday={openToday} />}
    </Ctx.Provider>
  );
}

/**
 * 画面の中央のカード（PRD D192）。確認ダイアログ（ADR-0026）と同じ流儀：body の直下に出し、body のほかの子を inert（inertLock）、
 * 裏を巻かない、Tab は中で回す、Esc は「とばす」と同じ、閉じたら開く前の要素へフォーカスを戻す。
 * 最初のフォーカスは「次へ」。枚が変わってフォーカスが外れたら（最初の枚で「戻る」が押せなくなったとき）「次へ」へ。
 * 最後の枚は「次へ」が「閉じる」になり、主ボタン「今日の予定を開く」を添える（「とばす」は出さない。PRD D226）。
 * 最後の枚に入ったらフォーカスは「今日の予定を開く」へ
 */
function TourDialog({
  terms,
  onClose,
  onToday,
}: {
  terms: Pick<Terms, 'client' | 'staff'>;
  onClose: () => void;
  onToday: () => void;
}) {
  const features = useFeatures();
  // 切った機能の枚は出さない（PRD D213）
  const steps = tourSteps(terms, features);
  const [rawIndex, setIndex] = useState(0);
  // 開いている間に別のタブで機能を切って枚が減っても、ある枚に収める
  const index = Math.min(rawIndex, steps.length - 1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  /** 最後の枚の主ボタン「今日の予定を開く」（最後の枚に入ったらここへフォーカス。PRD D226） */
  const todayRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const bodyId = useId();
  useBodyScrollLock();
  useTourModal({ wrapRef, boxRef, nextRef, closeRef });
  // biome-ignore lint/correctness/useExhaustiveDependencies: 枚が変わったときだけ
  useEffect(() => {
    // 最後の枚は次の一手の主ボタン「今日の予定を開く」へ
    if (index === steps.length - 1 && todayRef.current) {
      todayRef.current.focus();
      return;
    }
    const at = document.activeElement;
    if (!(at instanceof Node) || !boxRef.current?.contains(at) || (at as HTMLButtonElement).disabled)
      nextRef.current?.focus();
  }, [index]);
  const go = (move: TourMove) => {
    const to = tourMove(index, steps.length, move);
    if (to === null) onClose();
    else setIndex(to);
  };
  const step = steps[index]!;
  const last = index === steps.length - 1;
  return createPortal(
    <div ref={wrapRef} className="tour-wrap" data-testid="tour-wrap">
      <div className="tour-backdrop" aria-hidden="true" />
      <div
        ref={boxRef}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="tour"
        data-step={step.key}
      >
        <div className="tour-head">
          <span className="tour-icon" aria-hidden="true">
            <Compass size={20} strokeWidth={2.2} />
          </span>
          <span className="tour-count" data-testid="tour-count">
            使い方の案内 {tourCountText(index, steps.length)}
          </span>
        </div>
        {/* 枚が変わったら読み上げる（見出しと本文） */}
        <div className="tour-main" aria-live="polite">
          <h2 id={titleId} data-testid="tour-title">
            {step.title}
          </h2>
          <div id={bodyId} className="tour-body" data-testid="tour-body">
            <p>{step.body}</p>
            {step.points && (
              <ol className="tour-points" data-testid="tour-points">
                {step.points.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            )}
          </div>
          <p className="tour-where">
            <strong>場所：</strong>
            {step.where}
          </p>
        </div>
        <ol className="tour-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <li key={s.key} className={i === index ? 'is-on' : undefined} />
          ))}
        </ol>
        <TourActions
          last={last}
          index={index}
          label={tourNextLabel(index, steps.length)}
          nextRef={nextRef}
          todayRef={todayRef}
          onGo={go}
          onToday={onToday}
        />
      </div>
    </div>,
    document.body,
  );
}

/** カードの下のボタンの行（とばす・戻る・次へ・今日の予定を開く） */
function TourActions({
  last,
  index,
  label,
  nextRef,
  todayRef,
  onGo,
  onToday,
}: {
  last: boolean;
  index: number;
  /** 「次へ」ボタンの文字（最後の枚は「閉じる」） */
  label: string;
  nextRef: RefObject<HTMLButtonElement | null>;
  todayRef: RefObject<HTMLButtonElement | null>;
  onGo: (move: TourMove) => void;
  onToday: () => void;
}) {
  return (
    <div className="tour-actions">
      {!last && (
        <button type="button" className="btn btn-small tour-skip" onClick={() => onGo('skip')} data-testid="tour-skip">
          とばす
        </button>
      )}
      <span className="tour-spacer" />
      <button
        type="button"
        className="btn btn-small"
        disabled={index === 0}
        onClick={() => onGo('back')}
        data-testid="tour-back"
      >
        戻る
      </button>
      <button
        ref={nextRef}
        type="button"
        className={last ? 'btn btn-small' : 'btn btn-small btn-primary'}
        onClick={() => onGo('next')}
        data-testid="tour-next"
      >
        {label}
      </button>
      {last && (
        <button
          ref={todayRef}
          type="button"
          className="btn btn-small btn-primary"
          onClick={onToday}
          data-testid="tour-today"
        >
          {TOUR_TODAY_LABEL}
        </button>
      )}
    </div>
  );
}
