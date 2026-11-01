// 決まった予定（ADR-0073。PRD D382）の見せ方の決まり（純粋関数）：エキスパート機能（expert）が切のときは、確定（伝えた）の段階を
// 促す所（確定のボタン・「まだ伝えていない」「確定済み」の印・確定していない日の欄・まとめて確定・次の確定していない日へ・
// 要対応の帯の「未確定 N日」）を出さず、決まったあとの変更だけ「変更あり」で見せる。入のときは今の作りのまま。
// 画面はここを読み、expert の判定を画面ごとに持たない。データは書き換えない
import type { Features } from '../contracts/features';
import type { ToldState } from './dayPlan';
import { isOn } from './features';

/** 決まったあとの変更の言葉（expert 切のときの印・チップ・一覧の状態） */
export const CHANGED_WORD = '変更あり';

/** 確定（伝えた）の段階を出すか：エキスパート機能が入のときだけ（切のときは自動で決まる） */
export const showConfirmStep = (features: Features): boolean => isOn(features, 'expert');

/** 日の状態の見せ方：切のとき「まだ伝えていない」「確定済み」は区別せず（印・色とも出さない）、「変更あり」だけ残す */
export const shownDayState = (state: ToldState, confirmStep: boolean): ToldState =>
  confirmStep || state === 'changed' ? state : 'none';

/** 日の状態の言葉（日の状態の表示の元）。切のとき、「変更あり」以外は空 */
export function dayStateText(state: ToldState, confirmStep: boolean, words: Record<ToldState, string>): string {
  if (confirmStep) return words[state];
  return state === 'changed' ? CHANGED_WORD : '';
}

/** 日の画面の上の状態のチップ：入は今のとおり（3つ）、切は「変更あり」だけ（ほかは null＝出さない） */
export const headerToldChip = (state: ToldState, confirmStep: boolean): ToldState | null =>
  confirmStep ? state : state === 'changed' ? 'changed' : null;

/** 連絡の一覧の「連絡した」ボタンを出すか：expert 切で未連絡の変更があるとき（メール機能の入り切りに関係なく） */
export const showContactedButton = (state: ToldState, confirmStep: boolean): boolean =>
  !confirmStep && state === 'changed';

/** 未連絡の変更の件数の文（日・マスの読み上げ・一覧）。expert 切は「変更あり N件」 */
export const changesText = (n: number, confirmStep: boolean): string =>
  confirmStep ? `未連絡の変更 ${n}件` : `${CHANGED_WORD} ${n}件`;
