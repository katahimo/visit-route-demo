// 時刻の区間（0時からの分）の小さい部品。予定の画面の時間軸（timeline）・3段バー（staffBar）・担当ごとの1日（dayLine）で使う
import { hhmmToMinutes } from '../domain/time';

/** 時間軸の縦の範囲（0時からの分）：07:00〜20:00（週の時間軸の範囲・日の時間軸の初期値） */
export const DAY_START = 7 * 60;
export const DAY_END = 20 * 60;

/** 時刻の区間（0時からの分。[start, end)） */
export type Span = { start: number; end: number };

/** 'HH:mm' の時間帯を分の区間に */
export const spansOf = (slots: readonly { start: string; end: string }[]): Span[] =>
  slots.map((x) => ({ start: hhmmToMinutes(x.start), end: hhmmToMinutes(x.end) }));
