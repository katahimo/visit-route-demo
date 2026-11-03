// 入口（matching：項目・条件 → Problem と理由）
export {
  ABSENCE_OVERLAP,
  ABSENT_ALL_DAY,
  ABSENT_NO_HOURS,
  AFTER_LAST_DAY,
  ALLOWED_STAFF_RULE_ID,
  type CompileInput,
  compile,
  PIN_LABEL,
  PIN_RULE_ID,
  VISIT_TYPE_RULE_ID,
} from './compile';
export { conditionText, matches, yearsSince } from './conditions';
export { balanceOff, balancePoints, dropPointsOf, overCap, totalPoints } from './cost';
export { bestInsertion } from './insertion';
export { naiveSeqs } from './naive';
export { EPS, fitStart, routeCost, scheduleRoute, soloBroken } from './timing';
export {
  FAR_TRIP_LABEL,
  FAR_TRIP_RULE_ID,
  TRAVEL_TOO_FAR_RULE_ID,
  TRAVEL_TOO_FAR_WORD,
  travelTooFarLabel,
} from './travel';
