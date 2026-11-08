// 新しい〈スタッフ〉の勤務日・勤務時間の既定（PRD D428。ADR-0095）。使い方（機能のひな形）で決める純粋関数。
// 単発の予約（繰り返し patterns が切）は夜・土日の予約が多いので、毎日（月〜日）・7:00〜22:00 の広い既定にする。それ以外は月〜金 9:00〜18:00

import type { Staff } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { timeText } from '../domain/availability';
import { WEEKDAY_LABELS } from './common';
import { isOn } from './features';

/** 勤務日・勤務時間の既定 */
export type StaffHours = Pick<Staff, 'workDays' | 'shiftStart' | 'shiftEnd'>;

/** 定期の使い方の既定：月〜金 9:00〜18:00 */
export const REGULAR_STAFF_HOURS: StaffHours = { workDays: [1, 2, 3, 4, 5], shiftStart: '09:00', shiftEnd: '18:00' };

/** 単発の予約の使い方の既定：毎日（月〜日）7:00〜22:00（根拠は ADR-0095） */
export const ONE_OFF_STAFF_HOURS: StaffHours = {
  workDays: [1, 2, 3, 4, 5, 6, 0],
  shiftStart: '07:00',
  shiftEnd: '22:00',
};

/** 単発の予約の使い方か（繰り返しが切。lib/addPlan の addPlanKind と同じ見分け方） */
export const isOneOffUse = (features: Features): boolean => !isOn(features, 'patterns');

/** 新しい〈スタッフ〉の既定の勤務日・勤務時間（呼び出し側が書き換えても既定が変わらないよう、毎回新しい配列を返す） */
export function defaultStaffHours(features: Features): StaffHours {
  const h = isOneOffUse(features) ? ONE_OFF_STAFF_HOURS : REGULAR_STAFF_HOURS;
  return { ...h, workDays: [...h.workDays] };
}

/** 既定が広い既定（単発の予約）か。確認の文に既定を使ったと知らせる要るか */
export const hasWideDefaultHours = (features: Features): boolean => isOneOffUse(features);

/** 勤務日の文（「毎日」「月火水木金」。月曜から並べる） */
export function workDaysText(workDays: readonly number[]): string {
  if (workDays.length === 7) return '毎日';
  return [...workDays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => WEEKDAY_LABELS[d])
    .join('');
}

/** 勤務日・勤務時間の文（「毎日 7:00〜22:00」「月火水木金 9:00〜18:00」） */
export function staffHoursText(h: StaffHours): string {
  return `${workDaysText(h.workDays)} ${timeText(h.shiftStart)}〜${timeText(h.shiftEnd)}`;
}
