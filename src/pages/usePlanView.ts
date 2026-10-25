// 日の予定の表示の状態（PRD D58・D63・D334・D344）：時間軸／順番／一覧（スマホは日ごとのリスト）・狭い幅と印刷・
// スマホの「選ぶ」・使い方・右の欄・複数選択。どれも画面の中だけの状態（保存しない）
import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { COMPACT_QUERY, useMedia } from '../components/useMedia';
import { useVisitSelection } from '../components/visitParts';

/** 時間軸をやめて順番にする幅（PRD D58） */
const TIMELINE_NARROW_QUERY = '(max-width: 900px)';

/** 地図を時間軸の横に並べる幅（PRD D63） */
const WIDE_MAP_QUERY = '(min-width: 1280px)';

/** 狭い幅（900px 以下）か印刷中か。印刷は beforeprint の中ですぐ描き直す（印刷の画像に間に合わせる） */
function useNarrowOrPrint(): boolean {
  const narrow = useMedia(TIMELINE_NARROW_QUERY);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return narrow || printing;
}

export type ShownView = 'timeline' | 'order' | 'list' | 'day';

/** 表示の状態（日付を変えたら、スマホの「選ぶ」を抜け、右の欄を閉じる） */
export function usePlanView(date: string) {
  /** スマホの幅（600px 以下）は訪問を足さない（ADR-0051 の決定5） */
  const compact = useMedia(COMPACT_QUERY);
  /** 操作の行の「使い方」（スマホは「その他 ▾」の中）で開いた説明（PRD D279・D344。保存しない） */
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (helpOpen) helpRef.current?.focus();
  }, [helpOpen]);
  /** 表示（PRD D58・D63）：時間軸／順番／一覧（訪問の一覧の表）。画面の状態（初期値：時間軸） */
  const [colView, setColView] = useState<'timeline' | 'order' | 'list'>('timeline');
  /** 狭い幅（900px 以下）・印刷では時間軸の代わりに順番にする（一覧はそのまま） */
  const narrowOrPrint = useNarrowOrPrint();
  /**
   * スマホ（600px 以下）の表示（PRD D334）：日ごとのリスト（既定）・順番・一覧。「その他 ▾」の「表示」で選ぶ（操作の行を1段にする）
   */
  const [mView, setMView] = useState<'day' | 'order' | 'list'>('day');
  const shownView: ShownView = compact ? mView : narrowOrPrint && colView === 'timeline' ? 'order' : colView;
  /** 表示を替える（スマホは時間軸の代わりに順番） */
  const setView = (v: 'timeline' | 'order' | 'list') => {
    if (compact) setMView(v === 'timeline' ? 'order' : v);
    else setColView(v);
  };
  /** スマホの日ごとのリストの「選ぶ」（長押しでも入る。日付を変えたら抜ける） */
  const [selecting, setSelecting] = useState(false);
  /** 右の欄（PRD D63）：'detail'＝詳しく、'mail'＝予定をメールで送る */
  const [panel, setPanel] = useState<'detail' | 'mail' | null>(null);
  /** 地図は本体の下に全幅で大きく置く（PRD D300）。広い画面は地図を高くする */
  const wideMap = useMedia(WIDE_MAP_QUERY);
  /** ページの中の地図のカード（画面の外なら右下に浮かせる） */
  const mapCardRef = useRef<HTMLDivElement>(null);
  /** 「担当なしの訪問」の列（帯の近道の行き先） */
  const noneColId = useId();
  /** 複数選択（Shift・Ctrl＋クリック。日付を変えたら外す。PRD D330） */
  const multi = useVisitSelection(date);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたらスマホの「選ぶ」を抜ける（選んだ訪問は useVisitSelection が外す）
  useEffect(() => {
    setSelecting(false);
  }, [date]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたら開いた欄を閉じる
  useEffect(() => {
    setPanel(null);
  }, [date]);
  return {
    compact,
    helpOpen,
    setHelpOpen,
    helpRef,
    setColView,
    mView,
    setMView,
    narrowOrPrint,
    shownView,
    setView,
    selecting,
    setSelecting,
    panel,
    setPanel,
    wideMap,
    mapCardRef,
    noneColId,
    multi,
  };
}

export type PlanView = ReturnType<typeof usePlanView>;
