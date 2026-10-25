// 欠勤の振り直し（ADR-0011。1回目＝案A「空き時間に入れるだけ」）。design.md §4 reassign・§5「欠勤と振り直し」。
// どれも純粋関数で決定的（乱数・Date.now を使わない。いまの時刻は扱わない＝過去の欠勤は登録しない前提。2026-10-14 利用者が決定）。
// DemoData は読まない・書かない
// 中身は greedy（案A）・candidates（候補）・diff（差分）・anneal（案B）・contacts（連絡の一覧）・shared（共通の下請け）に分けてあり、
// ここは外へ見せる名前をまとめて再 export するだけ（呼び出し側は `from '.../reassign'` のまま）

export type {
  AnnealOptions,
  AnnealPrep,
  AnnealSettled,
  ContactList,
  ContactVisit,
  FitOf,
  ReassignCandidate,
  ReassignDiff,
  ReassignLeft,
  ReassignPlan,
  ReassignResult,
  ReassignTarget,
  Routes,
  StaffContact,
} from '../contracts/reassign';
export {
  STAY_WEIGHT_DEFAULT,
  STAY_WEIGHT_MAX,
  STAY_WEIGHT_MIN,
  STAY_WEIGHT_STEP,
} from '../contracts/reassign';

export { annealCost, finishAnneal, prepareAnneal, settleAnneal, stayPointsOf } from './anneal';
export { candidatesFor, fitsOf, placeVisit } from './candidates';
export { contactsOf } from './contacts';
export { reassignDiff } from './diff';
export { leftOf, reassign, targetsOf } from './greedy';
