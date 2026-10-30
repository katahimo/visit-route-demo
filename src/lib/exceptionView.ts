// 例外だけ見せる（エキスパート機能が切のとき。PRD D384。ADR-0073）の決まり：何を目立たせるか・何を「詳しく」へ畳むか・
// 操作の行のどのボタンを残すか・画面の上の説明の文と出し分け。画面（月・週・日）はここを読み、切／入の判定を画面ごとに持たない。
// 入のときは今の画面のまま（何も畳まず、ボタンも今のまま）。データは書き換えない
import type { Features } from '../contracts/features';
import { isSimpleMenu } from './nav';

/** エキスパート機能が切か（切のときだけ、例外だけを見せる） */
export const exceptionsOnly = (features: Features): boolean => isSimpleMenu(features);

/** 予定の拡大率（日・週・月） */
export type ScheduleZoom = 'day' | 'week' | 'month';

// ---- 操作の行 ----

/** 操作の行に出せるボタン：訪問を追加（日だけ）・担当なしの訪問を組む・欠勤・キャンセルを登録 */
export type MainTool = 'add' | 'arrange' | 'absence';

/** 主ボタンにする候補（先に使えるもの）。日は「訪問を追加」（試作の「予定を入れる」）、日が使えないとき（スマホ）と週・月は「担当なしの訪問を組む」 */
const PRIMARY: Record<ScheduleZoom, readonly MainTool[]> = {
  day: ['add', 'arrange'],
  week: ['arrange'],
  month: ['arrange'],
};

/** 主ボタンのほかに並べるボタン（1つだけ）：欠勤・キャンセルを登録（当日の変更の入口） */
const SECOND: readonly MainTool[] = ['absence'];

/**
 * 操作の行に残すボタン（切のとき）：主ボタン1つ＋最大1つ。ほかの操作（元に戻す・やり直す・表示の切り替え・使い方・メールで送る・
 * 空き状況・印刷など）は「その他 ▾」へ。avail は今その画面で使えるか（担当なしが無ければ組むは出さない、など）
 */
export function mainTools(
  zoom: ScheduleZoom,
  avail: Readonly<Record<MainTool, boolean>>,
): { primary: MainTool | null; second: MainTool | null } {
  const primary = PRIMARY[zoom].find((t) => avail[t]) ?? null;
  const second = SECOND.find((t) => t !== primary && avail[t]) ?? null;
  return { primary, second };
}

// ---- 「詳しく」 ----

/** 「詳しく」へ畳むもの：進み具合の帯・月全体の件数・凡例・1行の状態・今の担当の1行（点数・理由・移動）・担当ごとの1日 */
export type DetailItem = 'progress' | 'summary' | 'legend' | 'status' | 'oneLine' | 'dayLines';

const DETAILS: Record<ScheduleZoom, readonly DetailItem[]> = {
  month: ['progress', 'summary', 'legend'],
  week: ['status', 'legend'],
  day: ['oneLine', 'dayLines'],
};

/** 「詳しく」に入れるもの（入のときは空＝今の画面のまま、すべてそのまま出す） */
export const detailItems = (zoom: ScheduleZoom, only: boolean): readonly DetailItem[] => (only ? DETAILS[zoom] : []);

/**
 * 「詳しく」に今入れるもの：畳む項目のうち、いま中身があるもの（present で渡す。省略は無し）。空なら「詳しく」を出さない
 * （例：訪問の無い週は1行の状態が無いので、凡例の無い表の表示では「詳しく」ごと出さない）
 */
export function foldedParts(
  zoom: ScheduleZoom,
  only: boolean,
  present: Partial<Record<DetailItem, boolean>>,
): DetailItem[] {
  return detailItems(zoom, only).filter((i) => present[i] === true);
}

/** その部品を「詳しく」へ畳むか */
export const isFolded = (items: readonly DetailItem[], item: DetailItem): boolean => items.includes(item);

/** 「詳しく」の見出し */
export const DETAILS_LABEL = '詳しく';

/** 時間軸の凡例の項目のうち、資格✗・限✗（条件に合わない）は切では外す（札に出さないので凡例も要らない） */
export const showUnfitLegend = (only: boolean): boolean => !only;

/** 日の予定で、時間軸に移動・待ちの分数の区間を出すか（切は出さない：移動の分数は例外ではない） */
export const showLegs = (only: boolean): boolean => !only;

/** 担当なしの札の下の「入れられない理由」の札を出すか（切は出さない：理由は例外の知らせの外） */
export const showUnplacedReasons = (only: boolean): boolean => !only;

// ---- 画面の上の説明 ----

/** 画面の上の説明を持つ画面：予定の月・週・日と、〈利用者さん〉・〈スタッフ〉の一覧 */
export type IntroScreen = ScheduleZoom | 'clients' | 'staff';

/** 画面の上の説明（見出しの下の1行）。切は確定の段階の言葉を使わない1行（月・週・日。一覧は simpleText を渡す） */
export function introText(zoom: IntroScreen, only: boolean, expertText: string, simpleText?: string): string {
  if (!only) return expertText;
  if (zoom === 'clients' || zoom === 'staff') return simpleText ?? expertText;
  const text: Record<ScheduleZoom, string> = {
    month: '一月の予定です。担当なしや重なりは、日を押して直せます',
    week: 'この週の予定です。訪問をドラッグで動かせます',
    day: 'その日の担当を見て直します。決まったあとに変えた訪問は「変更あり」に出ます',
  };
  return text[zoom];
}

/** 説明を閉じたかを覚える鍵（store/navOpen の「開け閉め」に流用：開＝出している・閉＝閉じた。画面ごと） */
export const introKey = (zoom: IntroScreen): string => `intro:${zoom}`;

/** 説明を出すか：入は今のまま出す。切は初回だけ（閉じたら覚えて、読み直しても出さない） */
export const introShown = (stored: Readonly<Record<string, boolean>>, zoom: IntroScreen, only: boolean): boolean =>
  !only || stored[introKey(zoom)] !== false;

// ---- 言葉 ----

/** 範囲の提案の帯の言葉：切は「標準・提案・反映」を使わず「組んだ案」「この案にする」 */
export type ProposalWords = {
  aria: string;
  title: (label: string, days: number) => string;
  apply: string;
  discard: string;
  detailsLabel: (days: number) => string;
  applied: (label: string, days: number, skipped: number) => string;
  stale: (days: number) => string;
  staleOne: string;
};

export function proposalWords(only: boolean): ProposalWords {
  if (!only)
    return {
      aria: 'AI の提案',
      title: (label, days) => `提案（${label}・${days}日分）`,
      apply: '反映する',
      discard: '捨てる',
      detailsLabel: (days) => `変わる訪問を見る（${days}日）`,
      applied: (label, days, skipped) =>
        `${label}の提案を反映しました（${days}日${skipped > 0 ? `・変わった ${skipped}日は反映しません` : ''}）`,
      stale: (days) => `提案を出したあとに訪問が変わった日が ${days}日あります（その日は反映しません）`,
      staleOne: '提案を出したあとに訪問が変わったので、反映しませんでした。もう一度 AI で組んでください',
    };
  return {
    aria: 'AI が組んだ案',
    title: (label, days) => `組んだ案（${label}・${days}日分）`,
    apply: 'この案にする',
    discard: '捨てる',
    detailsLabel: (days) => `変わる訪問を見る（${days}日）`,
    applied: (label, days, skipped) =>
      `${label}の案にしました（${days}日${skipped > 0 ? `・変わった ${skipped}日はそのまま` : ''}）`,
    stale: (days) => `案を出したあとに訪問が変わった日が ${days}日あります（その日は変えません）`,
    staleOne: '案を出したあとに訪問が変わったので、案にしませんでした。もう一度 AI で組んでください',
  };
}

/** 欠勤・キャンセルのあとの振り直しの言葉：切は「反映・ピン」を使わず、点数の行は「詳しく」へ回す（PRD D384。proposalWords と同じ言い方） */
export type ReassignWords = {
  current: string;
  applied: string;
  choose: (title: string) => string;
  none: string;
  /** 「今の担当」に添える印（ピンの付いた訪問。切は出さない） */
  pinNote: string | undefined;
  resultTitle: string;
  hint: string;
  /** 比べる表に点数の行を出すか（切は「詳しく」の中） */
  scoreInTable: boolean;
};

export function reassignWords(only: boolean): ReassignWords {
  if (!only)
    return {
      current: '反映中',
      applied: '反映済み',
      choose: (title) => `${title}を反映する`,
      none: '担当なしにします（ピンも外れます）',
      pinNote: 'ピン',
      resultTitle: '反映した振り直し：',
      hint: '振り直した訪問に「代行」、開始が変わった訪問に「+N分」が付きます。担当が変わった訪問にはピンが付きます。担当なしの訪問は「受けられる人」から入れられます。',
      scoreInTable: true,
    };
  return {
    current: '今の案',
    applied: '案にした',
    choose: (title) => `${title}にする`,
    none: '担当なしにします',
    pinNote: undefined,
    resultTitle: '決めた振り直し：',
    hint: '振り直した訪問に「代行」、開始が変わった訪問に「+N分」が付きます。担当なしの訪問は「受けられる人」から入れられます。',
    scoreInTable: false,
  };
}
