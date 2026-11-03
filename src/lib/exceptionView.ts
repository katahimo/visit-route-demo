// 例外だけ見せる（エキスパート機能が切のとき。PRD D384。ADR-0073）の決まり：何を目立たせるか・何を「詳しく」へ畳むか・
// 操作の行のどのボタンを残すか・画面の上の説明の文と出し分け。画面（月・週・日）はここを読み、切／入の判定を画面ごとに持たない。
// 入も同じ骨組み（操作の行・「詳しく」・説明1行）を使い、入の差（2つ目のボタン・「詳しく」の見出しの数・日の要対応の帯）だけを足す。データは書き換えない
import type { Features } from '../contracts/features';
import { isOn } from './features';

/** エキスパート機能が切か（切のときだけ、例外だけを見せる） */
export const exceptionsOnly = (features: Features): boolean => !isOn(features, 'expert');

/** 予定の拡大率（日・週・月） */
export type ScheduleZoom = 'day' | 'week' | 'month';

// ---- 操作の行 ----

/**
 * 操作の行に出せるボタン：定期の予定を追加・予約を追加（週・月。引き出し）・訪問の欄を開く「訪問を1件追加」（日）・
 * 欠勤・キャンセルを登録（切）・担当を組む（入。担当を組むの画面へ）・確定（伝えた）（入の日）
 */
export type MainTool = 'add' | 'plan' | 'absence' | 'assign' | 'confirm';

/**
 * 主ボタンにする候補（先に使えるもの）。日は「訪問を1件追加」（その日の訪問の欄を開く。スマホは出さないので、切は主ボタン無し・入は「確定（伝えた）」）、
 * 週・月は「定期の予定を追加」（単発のみは「予約を追加」。lib/addPlan の planAddLabel）（〈利用者さん〉・日時を選ぶ引き出し）。
 * 「担当なしの訪問を組む」は操作の行に置かず、上の要対応の帯の従のボタン「要対応を組む」（PRD D402・D403。ADR-0077・ADR-0089）
 */
const PRIMARY: Record<ScheduleZoom, readonly MainTool[]> = {
  day: ['add'],
  week: ['plan'],
  month: ['plan'],
};

/** 入の主ボタン：日はスマホで「訪問を1件追加」を出さないとき「確定（伝えた）」が主ボタンになる（PRD D402） */
const PRIMARY_EXPERT: Record<ScheduleZoom, readonly MainTool[]> = {
  day: ['add', 'confirm'],
  week: ['plan'],
  month: ['plan'],
};

/** 主ボタンのほかに並べるボタン（1つだけ）。切は欠勤・キャンセルを登録（当日の変更の入口。ほかに入口が無い） */
const SECOND: readonly MainTool[] = ['absence'];

/** 入の2つ目：月・週は「担当を組む」（AI で組む入の要の操作）、日は「確定（伝えた）」。欠勤・キャンセルは「その他 ▾」（PRD D402） */
const SECOND_EXPERT: Record<ScheduleZoom, readonly MainTool[]> = {
  day: ['confirm'],
  week: ['assign'],
  month: ['assign'],
};

/** 日の主ボタンの言葉と、開いた新規の訪問の欄の見出し（入切とも「訪問を1件追加」。中の欄は同じ。PRD D402） */
export const ADD_VISIT_LABEL = '訪問を1件追加';

/**
 * 操作の行に残すボタン：主ボタン1つ＋最大1つ。ほかの操作（元に戻す・やり直す・表示の切り替え・使い方・
 * メールで送る・印刷など、入はさらに欠勤・キャンセル）は「その他 ▾」へ。avail は今その画面で使えるか（スマホの日は訪問を1件追加を出さない、など）。
 * 入と切の差はここ1か所（expert＝エキスパート機能が入）
 */
export function mainTools(
  zoom: ScheduleZoom,
  avail: Readonly<Record<MainTool, boolean>>,
  expert = false,
): { primary: MainTool | null; second: MainTool | null } {
  const primary = (expert ? PRIMARY_EXPERT : PRIMARY)[zoom].find((t) => avail[t]) ?? null;
  const second = (expert ? SECOND_EXPERT[zoom] : SECOND).find((t) => t !== primary && avail[t]) ?? null;
  return { primary, second };
}

// ---- 「詳しく」 ----

/**
 * 「詳しく」へ畳むもの：進み具合の帯・月全体の件数・凡例・1行の状態・今の担当の1行（点数・理由・移動）・担当ごとの1日・
 * 日の要対応の訪問の件数の帯（入だけ。切は上の要対応の帯が知らせる）
 */
export type DetailItem = 'progress' | 'summary' | 'legend' | 'status' | 'oneLine' | 'dayLines' | 'care';

const DETAILS: Record<ScheduleZoom, readonly DetailItem[]> = {
  month: ['progress', 'summary', 'legend'],
  week: ['status', 'legend'],
  day: ['oneLine', 'dayLines'],
};

/**
 * 「詳しく」に入れるもの（入切とも畳む。PRD D393）。入はさらに日の要対応の訪問の帯を入れる。
 * 切の月は凡例を入れない（マスに出す印が少なく、読み方は見出しの ⓘ。PRD D410）
 */
export function detailItems(zoom: ScheduleZoom, only: boolean): readonly DetailItem[] {
  if (zoom === 'day' && !only) return [...DETAILS.day, 'care'];
  if (zoom === 'month' && only) return DETAILS.month.filter((i) => i !== 'legend');
  return DETAILS[zoom];
}

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

/** 「詳しく」の見出し */
export const DETAILS_LABEL = '詳しく';

/** 時間軸の凡例の項目のうち、資格✗・限✗（条件に合わない）は切では外す（札に出さないので凡例も要らない） */
export const showUnfitLegend = (only: boolean): boolean => !only;

/**
 * 日の予定の順番の表示で、移動の分数の行を出すか（切は出さない：移動の分数は例外ではない）。
 * 時間軸の移動は切でも控えめに出す（components/routeTimeline の quietLegs。PRD D431）
 */
export const showLegs = (only: boolean): boolean => !only;

/** 担当なしの札の下の「入れられない理由」の札を出すか（切は出さない：理由は例外の知らせの外） */
export const showUnplacedReasons = (only: boolean): boolean => !only;

// ---- 月のマス・日ごとの一覧（PRD D410。ADR-0079） ----

/** 月のマス・日ごとの一覧の行・右の欄に出すもの。切は例外だけ（日付・訪問の件数・要対応の札・休 N・今日の印）、入は今のまま */
export type MonthCellView = {
  /** 種類の積み上げの帯と混み具合の棒（全体のとき。PRD D53・D54） */
  bars: boolean;
  /** 「休 N」のほかの印（欠勤・始まる▶／終わる■・〈利用者さん〉の休み・最終勤務日） */
  otherMarks: boolean;
  /** 理由の行（担当なし N・担当が休み N・変更あり N・拘束超 N）と日の状態の印（確定の鍵・変更ありの印・状態の言葉） */
  reasons: boolean;
  /** マスの読み方：マスの吹き出し（入）か見出しの ⓘ（切）。読み上げの文はどちらも同じ */
  guide: 'tip' | 'hint';
  /** 右の欄の要対応の一覧（切は出さず、日を押す前は1行の案内。件数の正は上の要対応の帯。PRD D404） */
  attentionList: boolean;
};

const MONTH_CELL_EXPERT: MonthCellView = {
  bars: true,
  otherMarks: true,
  reasons: true,
  guide: 'tip',
  attentionList: true,
};
const MONTH_CELL_EXCEPTIONS: MonthCellView = {
  bars: false,
  otherMarks: false,
  reasons: false,
  guide: 'hint',
  attentionList: false,
};

/** 月のマスの見せ方（入と切の差はここ1か所） */
export const monthCellView = (only: boolean): MonthCellView => (only ? MONTH_CELL_EXCEPTIONS : MONTH_CELL_EXPERT);

/** 切の右の欄で、日を押す前に出す1行 */
export const MONTH_ASIDE_PICK_TEXT = '日を押すとその日の訪問が出ます';

// ---- 画面の上の説明 ----

/** 画面の上の説明を持つ画面：予定の月・週・日と、〈利用者さん〉・〈スタッフ〉の一覧 */
export type IntroScreen = ScheduleZoom | 'clients' | 'staff';

/** 画面の上の説明（見出しの下の1行）。入は expertText（入の言葉）、切は確定の段階の言葉を使わない1行（月・週・日。一覧は exceptionText を渡す） */
export function introText(zoom: IntroScreen, only: boolean, expertText: string, exceptionText?: string): string {
  if (!only) return expertText;
  if (zoom === 'clients' || zoom === 'staff') return exceptionText ?? expertText;
  const text: Record<ScheduleZoom, string> = {
    month: '一月の予定です。担当なしや重なりは、日を押して直せます',
    week: 'この週の予定です。訪問をドラッグで動かせます',
    day: 'その日の担当を見て直します。決まったあとに変えた訪問は「変更あり」に出ます',
  };
  return text[zoom];
}

/** 説明を閉じたかを覚える鍵（store/navOpen の「開け閉め」に流用：開＝出している・閉＝閉じた。画面ごと） */
export const introKey = (zoom: IntroScreen): string => `intro:${zoom}`;

/** 説明を出すか：入切とも初回だけ（閉じたら覚えて、読み直しても出さない。PRD D384・D402） */
export const introShown = (stored: Readonly<Record<string, boolean>>, zoom: IntroScreen): boolean =>
  stored[introKey(zoom)] !== false;

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

/** 担当を組むの画面の言葉：切は「提案・反映・ピン」を使わず、proposalWords と同じ言い方（案・この案にする・手で替えた訪問）にする */
export type ArrangeWords = {
  /** 見出しの下の1行 */
  lead: string;
  /** 「AI で組む」の下の注記。pinned は手で替えた訪問などの言い方（入はピンの訪問・標準の担当、切は手で替えた訪問・繰り返しの担当） */
  note: (pinned: string) => string;
};

export function arrangeWords(only: boolean): ArrangeWords {
  if (!only)
    return {
      lead: '範囲を選んで AI で担当を組み、提案を見て反映します。予定（月・週・日）では手で直します',
      note: (pinned) =>
        `ピンの訪問（手で替えた訪問・${pinned}）はそのままで、ほかの訪問の担当と時刻を組みます。今日より前の日・確定した日は組みません。1日ずつ組み、終わったら提案を出します。見て「反映する」と担当が変わります（「元に戻す」で戻せます）。ほかの画面へ移っても組み続けます。`,
    };
  return {
    lead: '範囲を選んで AI で担当を組み、案を見て「この案にする」。予定（月・週・日）では手で直します',
    note: (pinned) =>
      `手で替えた訪問・${pinned}はそのままで、ほかの訪問の担当と時刻を組みます。今日より前の日・決まった日は組みません。1日ずつ組み、終わったら案を出します。見て「この案にする」と担当が変わります（「元に戻す」で戻せます）。ほかの画面へ移っても組み続けます。`,
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
