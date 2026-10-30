// 人の画面は畳む（エキスパート機能が切のとき。PRD D385。ADR-0073）の決まり：〈利用者さん〉・〈スタッフ〉の一覧に出す列、
// 画面（詳細）で出す欄と「詳しく ▾」へ畳む欄、切のときに出さないタブ、一覧・見出しに出す短い文。
// 画面（一覧・人の画面）はここを読み、切／入の判定を画面ごとに持たない。入のときは今の画面のまま（何も畳まない）。データは書き換えない
import type { ClientPlace, Pattern, Staff } from '../contracts/documents';
import { WEEKDAY_LABELS } from './common';
import { patternWhenText } from './patternText';
import type { ClientTab, StaffTab } from './personPage';
import { formatPostalCode } from './postalCode';

// ---- 一覧の列 ----

/** 〈利用者さん〉一覧の列：名前・住所・いつもの予定（切の3列）／名前・位置・特性・求めること・いつもの担当・状態（入） */
export type ClientCol = 'name' | 'address' | 'plan' | 'place' | 'traits' | 'requires' | 'usual' | 'state';

const CLIENT_COLS_SIMPLE: readonly ClientCol[] = ['name', 'address', 'plan'];
const CLIENT_COLS_FULL: readonly ClientCol[] = ['name', 'place', 'traits', 'requires', 'usual', 'state'];

export const clientColumns = (only: boolean): readonly ClientCol[] => (only ? CLIENT_COLS_SIMPLE : CLIENT_COLS_FULL);

/** 〈スタッフ〉一覧の列：名前・勤務日・勤務時間（切の3列）／名前・勤務・特性・求めること・自宅の位置・状態（入） */
export type StaffCol = 'name' | 'days' | 'hours' | 'work' | 'traits' | 'requires' | 'home' | 'state';

const STAFF_COLS_SIMPLE: readonly StaffCol[] = ['name', 'days', 'hours'];
const STAFF_COLS_FULL: readonly StaffCol[] = ['name', 'work', 'traits', 'requires', 'home', 'state'];

export const staffColumns = (only: boolean): readonly StaffCol[] => (only ? STAFF_COLS_SIMPLE : STAFF_COLS_FULL);

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

/** 〈スタッフ〉の名前のそばに出す印：休止中だけ（切の一覧は状態の列を出さない代わりに、例外の休止中は名前のそばへ） */
export const staffNameNote = (s: Pick<Staff, 'active'>): string => (s.active ? '' : '休止中');
