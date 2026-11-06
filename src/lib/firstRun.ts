// 最初の2問（PRD D379〜D381。ADR-0073・ADR-0092）の純粋な部分：画面の文、答え → 決まるもの（呼び名・ひな形・機能の入り切り・最初に開く画面）、
// 答え → 作るデータ。画面は components/FirstRunPage、保存は store（localStorage を触るのは store だけ）。
// 初めて開いたとき（保存データが無い）と、データの画面の「最初の設定をやり直す」で同じ2問を出す。データは書き換えない（新しいデータを返す）

import type { Industry } from '../contracts/codes';
import type { DemoData } from '../contracts/data';
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { DEFAULT_TERMS } from '../domain/terms';
import { createBlankData, ONE_OFF_VISIT_TYPES, REGULAR_VISIT_TYPES } from '../seed/blank';
import { createOneOffDemoData } from '../seed/oneOff';
import { createInitialData } from '../seed/plans';
import { applyTemplate, type TemplateId, templateDef } from './features';
import { START_GUIDE_PATH } from './startGuide';

/** 問1：デモで試す／自分のデータで始める */
export type FirstRunStart = 'demo' | 'own';
/** 予約のかたち（単発の予約が中心／定期の訪問が中心）。問2の答えから決まる。初期状態に戻すときの印（store/start）にも使う */
export type FirstRunBooking = 'oneOff' | 'regular';
/** 問2：使い方（ひな形のうち、すべての機能を除く4つ。PRD D379。ADR-0092） */
export type FirstRunUse = Exclude<TemplateId, 'all'>;
/** 2問の答え */
export type FirstRunAnswer = { start: FirstRunStart; use: FirstRunUse };

/** 選択肢1つ（値と、画面に出す名前・1行の説明） */
export type FirstRunChoice<T extends string> = { value: T; label: string; description: string };

/** 画面の見出し・問い・主ボタン（主ボタンは1つ） */
export const FIRST_RUN_TITLE = '最初の設定';
export const FIRST_RUN_SUBMIT = 'はじめる';
/** やり直しのときだけ出す従のボタン（今のデータのまま戻る） */
export const FIRST_RUN_CANCEL = '閉じる';
export const FIRST_RUN_NOTE =
  'あとから「データ」の画面の「最初の設定をやり直す」で選び直せます。機能は「管理者設定」で変えられます。';
export const FIRST_RUN_Q1 = '1. どちらで始めますか';
export const FIRST_RUN_Q2 = '2. 使い方の近いものはどれですか';

export const FIRST_RUN_START_CHOICES: readonly FirstRunChoice<FirstRunStart>[] = [
  { value: 'demo', label: 'デモで試す', description: '架空のデータが入った状態で、操作を試します' },
  {
    value: 'own',
    label: '自分のデータで始める',
    description: '空の状態から始めます。名簿や予約の Excel・CSV を読み込むか、1人ずつ入れます',
  },
];

/** 問2の選択肢の並び（ひな形の並びと同じ。ADR-0092） */
const FIRST_RUN_USES: readonly FirstRunUse[] = ['oneOff', 'basic', 'laborContract', 'monthlyField'];

/** 問2の選択肢：名前はひな形の名前、説明は近い業種の例と、選ぶと入る機能の要点（呼び名は決まる前なので使わない） */
const USE_POINTS: Record<FirstRunUse, string> = {
  oneOff: '日ごとの単発の予約に担当を組む',
  basic: '毎週・毎月の決まった訪問に担当を組み、休み・欠勤・空き状況に対応',
  laborContract: '定期の訪問に、勤務の見込み（拘束・稼働）・交通費・契約の段階と紹介元を足す',
  monthlyField: '定期の訪問に、希望休のまとめ入力・月の予定の印刷・空き枠の案内文・担当を限るを足す',
};

export const FIRST_RUN_USE_CHOICES: readonly FirstRunChoice<FirstRunUse>[] = FIRST_RUN_USES.map((value) => {
  const t = templateDef(value);
  return {
    value,
    label: t.label,
    description: t.example ? `例：${t.example}。${USE_POINTS[value]}` : USE_POINTS[value],
  };
});

/** 使い方 → 予約のかたち（単発の予約だけ単発。ほかは定期） */
export const bookingOfUse = (use: FirstRunUse): FirstRunBooking => (use === 'oneOff' ? 'oneOff' : 'regular');

/** 予約のかたち → 使い方（初期状態に戻すときの既定。単発＝単発の予約、定期＝基本） */
export const firstRunUseOf = (booking: FirstRunBooking): FirstRunUse => (booking === 'oneOff' ? 'oneOff' : 'basic');

/** 答えから決まるもの */
export type FirstRunSetup = {
  /** 呼び名（単発＝お客様／シッター、定期＝利用者さん／スタッフ。org.terms に書く） */
  terms: Terms;
  industry: Industry;
  /** 機能のひな形（問2で選んだもの。エキスパート機能は切）を当てた入り切り（22の ID を明示） */
  features: Features;
  /** 最初に開く予定の画面（単発＝週、定期＝月） */
  firstPath: '/week' | '/month';
};

/** 答え（の問2）から、呼び名・ひな形・最初の画面を決める */
export function firstRunSetup(use: FirstRunUse): FirstRunSetup {
  const booking = bookingOfUse(use);
  switch (booking) {
    case 'oneOff':
      return {
        terms: { ...DEFAULT_TERMS.sitter },
        industry: 'sitter',
        features: applyTemplate(use),
        firstPath: '/week',
      };
    case 'regular':
      return {
        terms: { client: DEFAULT_TERMS.nursing.client, staff: DEFAULT_TERMS.nursing.staff },
        industry: 'care',
        features: applyTemplate(use),
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
  const s = firstRunSetup(answer.use);
  const f = features ?? s.features;
  const oneOff = bookingOfUse(answer.use) === 'oneOff';
  if (answer.start === 'own') {
    const types = oneOff ? ONE_OFF_VISIT_TYPES : REGULAR_VISIT_TYPES;
    return createBlankData(today, { industry: s.industry, terms: s.terms, features: f }, types);
  }
  return oneOff ? createOneOffDemoData(today, f) : createInitialData(today, f);
}

/** 2問に答えたあとに最初に開く画面：デモ＝予定の画面（単発＝週、定期＝月）、自分のデータ＝登録の案内 */
export function firstRunLanding(answer: FirstRunAnswer): string {
  return answer.start === 'own' ? START_GUIDE_PATH : firstRunSetup(answer.use).firstPath;
}

/** データの画面・登録の案内の「最初の設定をやり直す」（確認のあと2問へ戻り、答えでデータを作り直す。PRD D381。ADR-0092） */
export const RESTART_TITLE = '最初の設定をやり直す';
export const RESTART_HINT =
  '最初の設定の2つの質問に答え直して、データを作り直します。デモのデータに戻すときも、ここで「デモで試す」を選びます。';
/** 畳まずに出す注意（答えたあとデータが作り直される） */
export const RESTART_WARN = 'いまのデータは消えます。';
export const RESTART_CONFIRM_TITLE = '最初の設定をやり直しますか？';
/** 確認の本文：元に戻す（Ctrl+Z）の対象外なので、先にデータを書き出す案内（keep は1世代の控えの文） */
export const restartConfirmBody = (keep: string): string =>
  `最初の設定へ戻り、データを作り直します。いまのデータはすべて消え、「元に戻す」でも戻せません。\n必要なら、先にデータの画面で控えを書き出してください。\n${keep}`;
export const RESTART_CONFIRM_LABEL = '最初の設定へ戻る';

/**
 * 最初の設定を出していた履歴の項目に付ける印（location.state）。答えて最初の画面へ移るとき、2問の画面の項目に付けてから先へ進む。
 * ブラウザの「戻る」でこの項目へ戻ったら、最初の設定をもう一度出す（答えるまでは今のデータのまま。PRD D381・D438）
 */
export const FIRST_RUN_ENTRY = { firstRun: true } as const;

/** 履歴の項目が最初の設定を出していたものか（FIRST_RUN_ENTRY の印があるか） */
export function isFirstRunEntry(state: unknown): boolean {
  return (state as { firstRun?: unknown } | null)?.firstRun === true;
}
