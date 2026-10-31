// 入の「詳しく ▾」の見出しの1行（PRD D393）：閉じていても読めるように、畳んだものの要点の数（点数・移動・未確定など）を出す。
// 切は数を出さない（「詳しく ▾」だけ）。画面は数を渡して文を受け取る。データは書き換えない
import { r0 } from './common';

/** 月：担当が全部入った日・確定した日（確定（伝えた）の段階を出さないときは担当だけ）。今日以降に訪問のある日が無ければ空 */
export function monthHeading(p: { days: number; planned: number; confirmed: number }, confirmStep: boolean): string {
  if (p.days === 0) return '';
  const plan = `担当 ${p.planned}/${p.days}日`;
  return confirmStep ? `${plan}・確定 ${p.confirmed}/${p.days}日` : plan;
}

/** 週：確定していない日（まだ伝えていない日＋未連絡の変更のある日）・要対応の件数。今日以降に訪問が無ければ空 */
export function weekHeading(
  futureDays: number,
  line: { changed: number; notYet: number; care: number },
  confirmStep: boolean,
): string {
  if (futureDays === 0) return '';
  const parts = [
    ...(confirmStep
      ? [`未確定 ${line.notYet + line.changed}日`]
      : line.changed > 0
        ? [`変更あり ${line.changed}日`]
        : []),
    ...(line.care > 0 ? [`要対応 ${line.care}件`] : []),
  ];
  return parts.join('・');
}

/** 日：点数・移動（分）・入らない訪問・守れない条件（0 のものは出さない）。点数の物差しが無ければ点数は出さない */
export function dayHeading(x: {
  hundred: number | null;
  travelMinutes: number;
  dropped: number;
  hard: number;
}): string {
  return [
    ...(x.hundred === null ? [] : [`点数 ${x.hundred}`]),
    `移動 ${r0(x.travelMinutes)}分`,
    ...(x.dropped > 0 ? [`入らない ${x.dropped}`] : []),
    ...(x.hard > 0 ? [`守れない条件 ${x.hard}`] : []),
  ].join('・');
}
