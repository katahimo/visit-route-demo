// 最初の2問（PRD D379〜D381。ADR-0073）の純粋な部分：画面の文、答え → 決まるもの（呼び名・ひな形・機能の入り切り・最初に開く画面）、
// 答え → 作るデータ。画面は components/FirstRunPage、保存は store（localStorage を触るのは store だけ）。
// 初めて開いたとき（保存データが無い）と、設定の「最初の設定をやり直す」で同じ2問を出す。データは書き換えない（新しいデータを返す）

import type { Industry } from '../contracts/codes';
import type { DemoData } from '../contracts/data';
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { DEFAULT_TERMS } from '../domain/terms';
import { createBlankData, ONE_OFF_VISIT_TYPES, REGULAR_VISIT_TYPES } from '../seed/blank';
import { createOneOffDemoData } from '../seed/oneOff';
import { createInitialData } from '../seed/plans';
import { applyTemplate } from './features';
import { START_GUIDE_PATH } from './startGuide';

/** 問1：デモで試す／自分のデータで始める */
export type FirstRunStart = 'demo' | 'own';
/** 問2：単発の予約が中心／定期の訪問が中心 */
export type FirstRunBooking = 'oneOff' | 'regular';
/** 2問の答え */
export type FirstRunAnswer = { start: FirstRunStart; booking: FirstRunBooking };

/** 選択肢1つ（値と、画面に出す名前・1行の説明） */
export type FirstRunChoice<T extends string> = { value: T; label: string; description: string };

/** 画面の見出し・問い・主ボタン（主ボタンは1つ） */
export const FIRST_RUN_TITLE = '最初の設定';
export const FIRST_RUN_SUBMIT = 'はじめる';
/** やり直しのときだけ出す従のボタン（今のデータのまま戻る） */
export const FIRST_RUN_CANCEL = 'やめる';
export const FIRST_RUN_NOTE = 'あとから「設定」の「最初の設定をやり直す」で、もう一度選べます。';
export const FIRST_RUN_Q1 = '1. どちらで始めますか';
export const FIRST_RUN_Q2 = '2. 予約のかたちは、どちらが中心ですか';

export const FIRST_RUN_START_CHOICES: readonly FirstRunChoice<FirstRunStart>[] = [
  { value: 'demo', label: 'デモで試す', description: '架空のデータが入った状態で、操作を試します' },
  { value: 'own', label: '自分のデータで始める', description: '空の状態から、画面の案内に沿って登録します' },
];

export const FIRST_RUN_BOOKING_CHOICES: readonly FirstRunChoice<FirstRunBooking>[] = [
  { value: 'oneOff', label: '単発の予約が中心', description: '例：ベビーシッター' },
  { value: 'regular', label: '定期の訪問が中心', description: '例：訪問介護・看護、家事代行の定期' },
];

/** 答えから決まるもの */
export type FirstRunSetup = {
  /** 呼び名（単発＝お客様／シッター、定期＝利用者さん／スタッフ。org.terms に書く） */
  terms: Terms;
  industry: Industry;
  /** 機能のひな形（単発＝単発のみ、定期＝基本。エキスパート機能は切）を当てた入り切り（22の ID を明示） */
  features: Features;
  /** 最初に開く予定の画面（単発＝週、定期＝月） */
  firstPath: '/week' | '/month';
};

/** 答え（の問2）から、呼び名・ひな形・最初の画面を決める */
export function firstRunSetup(booking: FirstRunBooking): FirstRunSetup {
  switch (booking) {
    case 'oneOff':
      return {
        terms: { ...DEFAULT_TERMS.sitter },
        industry: 'sitter',
        features: applyTemplate('oneOff'),
        firstPath: '/week',
      };
    case 'regular':
      return {
        terms: { client: DEFAULT_TERMS.nursing.client, staff: DEFAULT_TERMS.nursing.staff },
        industry: 'care',
        features: applyTemplate('basic'),
        firstPath: '/month',
      };
    default: {
      const _: never = booking;
      return _;
    }
  }
}

/**
 * 答えから作るデータ（today は基準日。Date.now は使わない。features を渡すとひな形の代わりにその入り切りで作る）：
 * デモ＝単発は架空の単発の予約（今日から2週間分）、定期は今の初期データ。自分のデータ＝空のデータ（訪問の種類と呼び名だけ）
 */
export function createFirstRunData(answer: FirstRunAnswer, today: string, features?: Features): DemoData {
  const s = firstRunSetup(answer.booking);
  const f = features ?? s.features;
  if (answer.start === 'own') {
    const types = answer.booking === 'oneOff' ? ONE_OFF_VISIT_TYPES : REGULAR_VISIT_TYPES;
    return createBlankData(today, { industry: s.industry, terms: s.terms, features: f }, types);
  }
  return answer.booking === 'oneOff' ? createOneOffDemoData(today, f) : createInitialData(today, f);
}

/** 2問に答えたあとに最初に開く画面：デモ＝予定の画面（単発＝週、定期＝月）、自分のデータ＝登録の案内 */
export function firstRunLanding(answer: FirstRunAnswer): string {
  return answer.start === 'own' ? START_GUIDE_PATH : firstRunSetup(answer.booking).firstPath;
}

/** 設定の「最初の設定をやり直す」（確認のあと2問へ戻り、答えでデータを作り直す。PRD D381） */
export const RESTART_TITLE = '最初の設定をやり直す';
export const RESTART_HINT =
  '最初の2つの質問に答え直します。呼び名・機能のひな形・データが、答えで作り直されます（いまのデータは消えます）。';
export const RESTART_CONFIRM_TITLE = '最初の設定をやり直しますか？';
/** 確認の本文：元に戻す（Ctrl+Z）の対象外なので、先にデータを書き出す案内（keep は1世代の控えの文） */
export const restartConfirmBody = (keep: string): string =>
  `最初の2つの質問へ戻り、答えでデータを作り直します。いまのデータはすべて消えます。\n「元に戻す」（Ctrl+Z）の対象外です。必要なら、先にデータの画面でデータを書き出して控えを残してください。\n${keep}`;
export const RESTART_CONFIRM_LABEL = '2つの質問へ戻る';
