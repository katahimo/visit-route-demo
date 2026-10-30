// 決まった予定（ADR-0073。PRD D382）：エキスパート機能（expert）が切のとき、自動で組んだ日・手で直した日は、
// 今日から1か月先まで決まった（伝えた）扱いにする＝自動で伝えた記録（snapshots[日]。tellDay と同じ書き方）を付ける。
// 「どの操作のあとに記録するか」はこの autoTell の1か所だけが決める（呼ぶのは store の update の1か所）。
// 純粋関数（データは書き換えず新しい DemoData を返す。at は引数）
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { addDays } from '../domain/time';
import { isFree } from './autoArrange';
import { own } from './common';
import { activeDayVisits, dayProblemOf, tellDay } from './dayPlan';
import { isOn } from './features';
import { addMonths, ymOf } from './ym';

/**
 * 決まった扱いにする範囲の終わり（今日の1か月後の同じ日。その月に無い日は月末：10-30→11-30、01-31→02-28/29、12-31→01-31）
 */
export function settledUntil(today: string): string {
  const ym = addMonths(ymOf(today), 1);
  const day = Number(today.slice(8, 10));
  const first = `${ym}-01`;
  const last = addDays(`${addMonths(ym, 1)}-01`, -1);
  const same = addDays(first, day - 1);
  return same > last ? last : same;
}

/** 決まった扱いの範囲の日か（今日から1か月後の同じ日まで。両端を含む） */
export const isSettledDate = (date: string, today: string): boolean => date >= today && date <= settledUntil(today);

/** 日ごとの保存した訪問（data.visits のその日の分。繰り返しの回の上書きも含む）。範囲の外の日は入れない */
function savedByDate(visits: readonly Visit[], today: string): Map<string, Visit[]> {
  const out = new Map<string, Visit[]>();
  for (const v of visits) {
    if (!isSettledDate(v.date, today)) continue;
    const list = out.get(v.date);
    if (list) list.push(v);
    else out.set(v.date, [v]);
  }
  return out;
}

/** 同じ保存した訪問の並びか（順は問わない。参照が同じなら速く、違えば中身で比べる） */
function sameVisits(a: readonly Visit[], b: readonly Visit[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((v) => [v.id, v]));
  return b.every((v) => {
    const x = byId.get(v.id);
    return x !== undefined && (x === v || JSON.stringify(x) === JSON.stringify(v));
  });
}

/**
 * 操作のあとの自動の伝えた記録。エキスパート機能が切のとき、範囲 [today, today の1か月後の同じ日]（両端を含む）の日のうち、
 * 保存した訪問（data.visits のその日の分）が before と after で変わり、after にその日の伝えた記録が無い日を、
 * その日の問題で tellDay する（at は記録の時刻）。
 * - 拾う：data.visits を変える操作すべて（入れた分の自動の組み・AI の提案の反映・手の直し・まとめて直す（multiEdit）・ドラッグ・
 *   取り消し・欠勤の振り直し・空き時間に入れる・訪問の追加など）。自動の組みも担当・開始を visits に書くだけなので同じ規則で拾える
 * - 拾わない：担当なし・ピンなしの訪問（自動の組みの対象）が残る日（組んだあとの update で拾う）、今日より前の日・範囲の外の日、すでに伝えた記録がある日（書き換えない。その後の変更は未連絡の変更＝「変更あり」になる）、
 *   expert 入のとき（今の確定の操作のまま）、訪問が変わらない操作（〈スタッフ〉の勤務・繰り返しパターン・〈利用者さん〉の休みなど
 *   visits の外のデータだけを変える操作。繰り返しの回は上書きするまで保存した訪問にならない）、
 *   計算に入れる訪問が無い日（全部取り消し・休みの日。伝える中身が無い）
 */
export function autoTell(before: DemoData, after: DemoData, today: string, at: number = Date.now()): DemoData {
  if (before.visits === after.visits || isOn(after.org.features, 'expert')) return after;
  const was = savedByDate(before.visits, today);
  const now = savedByDate(after.visits, today);
  const dates = [...new Set([...was.keys(), ...now.keys()])].sort();
  let out = after;
  for (const date of dates) {
    if (own(after.snapshots, date) || sameVisits(was.get(date) ?? [], now.get(date) ?? [])) continue;
    // 組む対象（担当なし・ピンなしの訪問）が残る日は、まだ決まっていない（自動の組みが担当を付けるまで待つ。
    // 先に伝えた記録を付けると、自動の組みは伝えた日を飛ばして組めなくなる）
    if (activeDayVisits(after, date).some((v) => isFree(after, v, today))) continue;
    const problem = dayProblemOf(after, date);
    if (problem && problem.visits.length > 0) out = tellDay(out, date, problem, at);
  }
  return out;
}
