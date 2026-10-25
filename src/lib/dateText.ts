// 日付・年月・時刻の短い書式（画面・メールの文で同じ形にする。純粋関数）。
// 同じ書式を画面ごとに書き直さず、ここから使う
import { timeText } from '../domain/availability';
import { minutesToHhmm, weekday } from '../domain/time';
import { WEEKDAY_LABELS } from './common';

/** 日付の短い文（「11/14」） */
export const mdText = (date: string): string => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 日付と曜日（「10/12（月）」） */
export const dateText = (date: string): string => `${mdText(date)}（${WEEKDAY_LABELS[weekday(date)]}）`;

/** 年月の文（「2026年11月」。日付 YYYY-MM-DD を渡してもその月） */
export const ymText = (ym: string): string => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`;

/** 月の名前（「10月」。日付を渡してもその月） */
export const monthLabel = (ym: string): string => `${Number(ym.slice(5, 7))}月`;

/** 0時からの分の時刻の文（「9:05」。先頭の0を付けない。分は丸める） */
export const hmText = (minutes: number): string => timeText(minutesToHhmm(minutes));
