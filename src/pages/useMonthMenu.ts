// 月の画面の「その他 ▾」（PRD D327）：月送り・今月と主ボタン（進み具合の帯）のほかの、ときどき使う操作をたたむ。
// 表示の選択の段・マスの見方の説明を開く（保存しない）と、印刷・勤務の見込みの画面へ
import { Info, Printer, SlidersHorizontal, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MenuItem } from '../components/MenuButton';

/** 「その他 ▾」の開け閉めの状態（表示の選択の段・マスの見方の説明）と、開いたときのフォーカスの置き場所 */
export function useMonthPanels() {
  /** 「その他 ▾」の「表示を選ぶ」で開いた表示の選択の段（PRD D327。保存しない） */
  const [pickersOpen, setPickersOpen] = useState(false);
  /** 「その他 ▾」の「マスの見方」で開いた説明（PRD D327。保存しない） */
  const [helpOpen, setHelpOpen] = useState(false);
  /** 表示の選択の段の最初の欄（開いたらここへフォーカス） */
  const focusSelectRef = useRef<HTMLSelectElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  // 「表示を選ぶ」で開いたら最初の欄へ、「マスの見方の説明」で開いたら説明へフォーカス（メニューのボタンへ戻ったあと）
  /** 「表示を選ぶ」で開いたときだけ欄へフォーカスする（段の中で選び直して出したままにするときは動かさない） */
  const focusPickers = useRef(false);
  useEffect(() => {
    if (pickersOpen && focusPickers.current) focusSelectRef.current?.focus();
    focusPickers.current = false;
  }, [pickersOpen]);
  useEffect(() => {
    if (helpOpen) helpRef.current?.focus();
  }, [helpOpen]);
  /** 段を開く・たたむ（開くときだけ最初の欄へフォーカス） */
  const togglePickers = (shown: boolean) => {
    focusPickers.current = !shown;
    setPickersOpen(!shown);
  };
  return {
    pickersOpen,
    keepPickers: () => setPickersOpen(true),
    togglePickers,
    helpOpen,
    setHelpOpen,
    focusSelectRef,
    helpRef,
  };
}

export type MonthPanels = ReturnType<typeof useMonthPanels>;

/**
 * 「その他 ▾」の項目と、表示の選択の段を出すか（切った機能（印刷・勤務の見込み）の画面へ移る項目は出さない。PRD D213。ADR-0028）
 */
export function monthMore(x: {
  panels: MonthPanels;
  /** 表示の選択の段をたためない（表示の選択・混み具合を選んでいる間・休みの入力中。何を見ているかを隠さない） */
  forced: boolean;
  terms: { staff: string; client: string };
  /** 印刷・勤務の見込みの画面（切っていれば null） */
  printHref: string | null;
  workloadHref: string | null;
  navigate: (to: string) => void;
}): { items: MenuItem[]; pickersShown: boolean } {
  const { panels, terms, printHref, workloadHref, navigate } = x;
  const pickersForced = x.forced;
  const pickersShown = panels.pickersOpen || pickersForced;
  const items: MenuItem[] = [
    {
      key: 'pickers',
      label: pickersShown ? '表示の選択をたたむ' : `表示を選ぶ（${terms.staff}・${terms.client}・混み具合）`,
      icon: SlidersHorizontal,
      disabled: pickersShown && pickersForced ? '表示を「全体」・混み具合を「すべて」に戻すと、たためます' : false,
      onSelect: () => panels.togglePickers(pickersShown),
      testId: 'month-more-pickers',
    },
    ...(printHref !== null
      ? [
          {
            key: 'print',
            label: '印刷',
            icon: Printer,
            description: '紙のカレンダーの代わりに、この月の予定をA4横で印刷します',
            onSelect: () => navigate(printHref),
            testId: 'month-print',
          },
        ]
      : []),
    ...(workloadHref !== null
      ? [
          {
            key: 'workload',
            label: '勤務の見込み',
            icon: Timer,
            description: '予定から、この月の出勤〜退勤（拘束）・移動・空き時間（待ち）と交通費を見込みます',
            onSelect: () => navigate(workloadHref),
            testId: 'month-workload',
          },
        ]
      : []),
    {
      key: 'help',
      label: panels.helpOpen ? 'マスの見方の説明を閉じる' : 'マスの見方の説明',
      icon: Info,
      onSelect: () => panels.setHelpOpen(!panels.helpOpen),
      testId: 'month-more-help',
    },
  ];
  return { items, pickersShown };
}
