// 人の画面は畳む（PRD D385・D394。ADR-0073・ADR-0074）の決まり：〈利用者さん〉・〈スタッフ〉の一覧に出す列（入切とも3列で始め、
// 入は「くわしい列」の切り替えで専門の列を足す）、画面（詳細）で出す欄と「詳しく ▾」へ畳む欄（切のとき）、切のときに出さないタブ、
// 一覧・見出しに出す短い文。画面（一覧・人の画面）はここを読み、切／入の判定を画面ごとに持たない。データは書き換えない
import type { ClientPlace, Pattern, Staff } from '../contracts/documents';
import { WEEKDAY_LABELS } from './common';
import { patternWhenText } from './patternText';
import type { ClientTab, StaffTab } from './personPage';
import { formatPostalCode } from './postalCode';

// ---- 一覧の列 ----

/**
 * 「くわしい列」を出せるか（エキスパート機能が入のとき。PRD D394）：切は3列だけで切り替えを出さない。
 * 入は3列で始め、表の上の切り替えで専門の列を出す（出すかは一覧ごとに端末に覚える。components/useDetailColumns）
 */
export const hasDetailColumns = (expert: boolean): boolean => expert;

/** 専門の列を出すか：出せる（入）うえで、切り替えを入れているとき */
export const detailColumnsShown = (expert: boolean, switchedOn: boolean): boolean =>
  hasDetailColumns(expert) && switchedOn;

/** 切り替えのラベル（入の一覧の表の上） */
export const DETAIL_COLUMNS_LABEL = 'くわしい列';

/** 〈利用者さん〉一覧の列：名前・住所・いつもの予定の3列／くわしい列を出すと、さらに 位置・特性・求めること・いつもの担当・状態 */
export type ClientCol = 'name' | 'address' | 'plan' | 'place' | 'traits' | 'requires' | 'usual' | 'state';

const CLIENT_COLS: readonly ClientCol[] = ['name', 'address', 'plan'];
const CLIENT_COLS_DETAIL: readonly ClientCol[] = [...CLIENT_COLS, 'place', 'traits', 'requires', 'usual', 'state'];

export const clientColumns = (detailed: boolean): readonly ClientCol[] => (detailed ? CLIENT_COLS_DETAIL : CLIENT_COLS);

/** 〈スタッフ〉一覧の列：名前・勤務日・勤務時間の3列／くわしい列を出すと、さらに 特性・求めること・自宅の位置・状態 */
export type StaffCol = 'name' | 'days' | 'hours' | 'traits' | 'requires' | 'home' | 'state';

const STAFF_COLS: readonly StaffCol[] = ['name', 'days', 'hours'];
const STAFF_COLS_DETAIL: readonly StaffCol[] = [...STAFF_COLS, 'traits', 'requires', 'home', 'state'];

export const staffColumns = (detailed: boolean): readonly StaffCol[] => (detailed ? STAFF_COLS_DETAIL : STAFF_COLS);

// ---- 人の画面の欄 ----

/** 〈利用者さん〉の画面の欄（節）：基本・段階・住所・特性・決まりごと・担当（担当を限る・求めること・相性） */
export type ClientPart = 'basic' | 'stage' | 'place' | 'traits' | 'rules' | 'staffing';

/** 〈スタッフ〉の画面の欄（節）：基本・自宅・特性・求めること・最終勤務日・相性（担当）・ふだんの勤務・日ごとに変えた勤務（勤務の見込み） */
export type StaffPart = 'basic' | 'home' | 'traits' | 'conds' | 'lastDay' | 'compat' | 'hours' | 'overrides';

/** 「詳しく ▾」へ畳む〈利用者さん〉の欄（切）。名前（基本）・住所は畳まない。予定（繰り返し）は予定のタブ */
const CLIENT_FOLDED: readonly ClientPart[] = ['stage', 'traits', 'rules', 'staffing'];

/** 「詳しく ▾」へ畳む〈スタッフ〉の欄（切）。名前（基本）・勤務日・勤務時間（ふだんの勤務）は畳まない */
const STAFF_FOLDED: readonly StaffPart[] = ['home', 'traits', 'conds', 'lastDay', 'compat', 'overrides'];

/** 畳む〈利用者さん〉の欄（入のときは空＝今の画面のまま） */
export const clientFolded = (only: boolean): readonly ClientPart[] => (only ? CLIENT_FOLDED : []);

/** 畳む〈スタッフ〉の欄（入のときは空＝今の画面のまま） */
export const staffFolded = (only: boolean): readonly StaffPart[] => (only ? STAFF_FOLDED : []);

/** 欄を、出す欄と畳む欄に分ける（並びはそのまま） */
export function splitFolded<P extends string, T>(
  parts: readonly { part: P; node: T }[],
  folded: readonly P[],
): { shown: T[]; folded: T[] } {
  return {
    shown: parts.filter((x) => !folded.includes(x.part)).map((x) => x.node),
    folded: parts.filter((x) => folded.includes(x.part)).map((x) => x.node),
  };
}

// ---- タブ ----

/** 〈利用者さん〉の画面のタブ（切は「担当・相性」のタブを出さず、中身は基本情報の「詳しく」へ） */
export function clientTabKeys(all: readonly ClientTab[], only: boolean): readonly ClientTab[] {
  return only ? all.filter((t) => t !== 'staffing') : all;
}

/** 〈スタッフ〉の画面のタブ（切は「相性」のタブを出さず、中身は基本情報の「詳しく」へ） */
export function staffTabKeys(all: readonly StaffTab[], only: boolean): readonly StaffTab[] {
  return only ? all.filter((t) => t !== 'compat') : all;
}

// ---- 短い文（一覧・見出し） ----

/** 住所の1行（住所が無ければ郵便番号。どちらも無ければ空） */
export function addressLine(place: Pick<ClientPlace, 'address' | 'postalCode'>): string {
  if (place.address) return place.address;
  return place.postalCode ? `〒${formatPostalCode(place.postalCode)}` : '';
}

/**
 * 一覧の「住所」の列の文：入は「〒郵便番号 住所」（どちらかだけならその一方）、切は addressLine（main の切と同じ。切は〒を添えない）
 */
export function addressCellText(place: Pick<ClientPlace, 'address' | 'postalCode'>, expert: boolean): string {
  if (!expert) return addressLine(place);
  const postal = place.postalCode ? `〒${formatPostalCode(place.postalCode)}` : '';
  return [postal, place.address].filter(Boolean).join(' ');
}

/** 勤務日の文（例「月火水木金」） */
export const workDaysText = (s: Pick<Staff, 'workDays'>): string =>
  [...s.workDays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join('');

/** 勤務時間の文（例「9:00〜17:00」） */
export const shiftText = (s: Pick<Staff, 'shiftStart' | 'shiftEnd'>): string => `${s.shiftStart}〜${s.shiftEnd}`;

/**
 * いつもの予定の文：〈利用者さん〉の繰り返しのうち today に終わっていないものを、始まりの早い順に「、」でつなぐ（例「月・木 10:00」）。
 * 無ければ空
 */
export function usualPlanText(
  patterns: readonly Pick<
    Pattern,
    | 'clientId'
    | 'from'
    | 'to'
    | 'weekdays'
    | 'everyWeeks'
    | 'repeat'
    | 'monthWeeks'
    | 'dayTimes'
    | 'windowKind'
    | 'earliestStart'
    | 'latestStart'
  >[],
  clientId: string,
  today: string,
): string {
  return patterns
    .filter((p) => p.clientId === clientId && (p.to === null || p.to >= today))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
    .map((p) => patternWhenText(p))
    .join('、');
}

/** 〈スタッフ〉の名前のそばに出す印：状態の列を出さないとき（3列）だけ、例外の休止中を名前のそばへ（状態の列があるときは列に出すので二重にしない） */
export const staffNameNote = (s: Pick<Staff, 'active'>, cols: readonly StaffCol[]): string =>
  cols.includes('state') || s.active ? '' : '休止中';

/** 〈利用者さん〉の名前のそばに出す印：状態の列を出さないとき（3列）だけ、休み中を名前のそばへ（状態の列があるときは列に出す） */
export const clientNameNote = (onLeave: boolean, cols: readonly ClientCol[]): string =>
  !cols.includes('state') && onLeave ? '休み中' : '';

/** 一覧の見出しの下の説明（切の1行。入は入の文を画面が出す。PRD D385） */
export const peopleIntro = (kind: 'clients' | 'staff'): string =>
  kind === 'clients'
    ? '名前・住所・いつもの予定です。行を押すと、その人の画面を開きます'
    : '名前・勤務日・勤務時間です。行を押すと、その人の画面を開きます';

/** 一覧の上の「状態の印で見分けられます」の説明を出すか（状態の列を出しているときだけ） */
export const showStageNote = (detailed: boolean): boolean => detailed;

/** 節の鍵 → 欄（担当の節と求めることの節は「担当」の欄にまとめる）。新しい人（new）は null */
export function clientPartOf(key: string | undefined): ClientPart | null {
  if (!key || key === 'new') return null;
  if (key === 'conds' || key === 'staffing') return 'staffing';
  return (['basic', 'stage', 'place', 'traits', 'rules'] as const).find((p) => p === key) ?? null;
}

/** 開いて始める節が「詳しく」の中か（その節を直しているとき、「詳しく」を開く） */
export const editInFold = (folded: readonly ClientPart[], key: string | undefined): boolean => {
  const part = clientPartOf(key);
  return part !== null && folded.includes(part);
};

/** 節のあるタブ（切は担当・相性のタブを出さないので基本情報へ） */
export const clientTabFor = (tab: ClientTab, only: boolean): ClientTab => (only && tab === 'staffing' ? 'basic' : tab);

/** 新しい〈利用者さん〉：切は段階を聞かず、名前だけ（段階は保存した先で「詳しく」から） */
export const newClientShowsStage = (only: boolean): boolean => !only;
export const newClientLead = (only: boolean, client: string): string =>
  only ? `${client}の名前を入れて保存します` : `${client}の名前と段階を入れて保存します`;
export const newClientHint = (only: boolean): string =>
  only
    ? '住所・繰り返し（決まった曜日の訪問）・休みは、保存してから入れられます。'
    : '住所・特性・担当・繰り返し（決まった曜日の訪問）・休みは、保存してから入れられます。';

// ---- 相性の画面の説明 ----

/**
 * 相性の凡例の横の説明（「点のしくみ」）を出すか。切は出さない（記号の意味は凡例の1行と、マスを押すと出る欄で足りる。
 * 点・「条件の重み」の画面の話は切では言わない）。入は点の話と条件の重みの話（PRD D384・D394・D420）
 */
export const compatHintLabel = (only: boolean): string | null => (only ? null : '点のしくみ');
