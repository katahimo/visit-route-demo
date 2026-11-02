// 決まった予定（ADR-0073。PRD D382）：エキスパート機能（expert）が切のとき、自動で組んだ日・手で直した日は、
// 今日から1か月先まで決まった（伝えた）扱いにする＝自動で伝えた記録（snapshots[日]。tellDay と同じ書き方）を付ける。
// ただし帯の種類（担当なし・間に合わない・重なり・休みの人。lib/bandIssues）の訪問が残る日は付けず、無くなった時点で付ける（ADR-0089）。
// 「どの操作のあとに記録するか」はこの autoTell の1か所だけが決める（呼ぶのは store の update の1か所）。
// 純粋関数（データは書き換えず新しい DemoData を返す。at は引数）
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { addDays, jstDate } from '../domain/time';
import { autoRange, autoTargets, isFree } from './autoArrange';
import { hasBandIssues } from './bandIssues';
import { own } from './common';
import { dayProblemOf, tellDay } from './dayPlan';
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

/** 日ごとの保存した訪問（data.visits のその日の分。繰り返しの回の上書きも含む）。範囲（今日〜until）の外の日は入れない */
function savedByDate(visits: readonly Visit[], today: string, until: string): Map<string, Visit[]> {
  const out = new Map<string, Visit[]>();
  for (const v of visits) {
    if (v.date < today || v.date > until) continue;
    const list = out.get(v.date);
    if (list) list.push(v);
    else out.set(v.date, [v]);
  }
  return out;
}

/** 同じ中身の訪問か（参照が同じなら速く、違えば中身で比べる） */
const sameVisit = (a: Visit, b: Visit): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/** before から after で変わった訪問（増えた・中身が変わった。after 側）と、消えた訪問があるか */
function diffVisits(before: readonly Visit[], after: readonly Visit[]): { changed: Visit[]; removed: boolean } {
  const was = new Map(before.map((v) => [v.id, v]));
  const changed = after.filter((v) => {
    const x = was.get(v.id);
    return x === undefined || !sameVisit(x, v);
  });
  const now = new Set(after.map((v) => v.id));
  return { changed, removed: before.some((v) => !now.has(v.id)) };
}

/**
 * その日に伝えた記録を付ける（付いている日・計算に入れる訪問が無い日は変えない）。帯の種類の訪問が残る日も付けない
 * （連絡していない日に「未連絡の変更」を出さない。直して無くなったときの操作で付く。ADR-0089）
 */
function tellIfNeeded(data: DemoData, date: string, at: number): DemoData {
  if (own(data.snapshots, date)) return data;
  const problem = dayProblemOf(data, date);
  if (!problem || problem.visits.length === 0 || hasBandIssues(data, date, problem)) return data;
  return tellDay(data, date, problem, at);
}

/**
 * 日のリストを決まった扱いにする（expert 切のとき。範囲内で伝えた記録の無い日に、その日の問題で tellDay。帯の種類の訪問が残る日は除く）。
 * 自動の組みの仕事が終わったとき（反映した・何も書かなかったに関わらず）に、その仕事の対象の日へ呼ぶ（待っていた日を終わらせる。
 * 繰り返しの保存からの自動の組みで visits が変わらない日もここで拾う）
 */
export function settleDates(
  data: DemoData,
  dates: readonly string[],
  today: string,
  at: number = Date.now(),
): DemoData {
  if (isOn(data.org.features, 'expert')) return data;
  const until = settledUntil(today);
  return dates.reduce((d, date) => (date >= today && date <= until ? tellIfNeeded(d, date, at) : d), data);
}

/**
 * 操作のあとの自動の伝えた記録。エキスパート機能が切のとき、範囲 [today, today の1か月後の同じ日]（両端を含む）の日のうち、
 * 保存した訪問（data.visits のその日の分）が before と after で変わり、after にその日の伝えた記録が無い日を、
 * その日の問題で tellDay する（at は記録の時刻）。呼ぶのは store の update の1か所。
 * - 拾う：data.visits を変える操作すべて（入れた分の自動の組み・AI の提案の反映・手の直し・まとめて直す（multiEdit）・ドラッグ・
 *   取り消し・欠勤の振り直し・空き時間に入れる・訪問の追加・〈利用者さん〉の終了・仮押さえの取り消しなど）。
 *   自動の組みも担当・開始を visits に書くだけなので同じ規則で拾える
 * - 拾わない（待つ）：その update のあとに自動の組みの依頼が出る訪問（autoTargets と同じ条件＝今回増えた・日時が変わった担当なし・ピンなしの訪問）が
 *   ある日。先に記録すると組む前の担当なしが伝えた内容に入るので、組んだあとの update（または自動の組みの終わりの settleDates）で記録する。
 *   opts.wait が false の update（settleNow。依頼を出さない保存）は待たない
 * - 拾わない：今日より前の日・範囲の外の日、すでに伝えた記録がある日（書き換えない。その後の変更は未連絡の変更＝「変更あり」になる）、
 *   帯の種類（担当なし・間に合わない・重なり・休みの人）の訪問が残る日（その日の訪問を直して無くなったときに付く。ADR-0089）、
 *   expert 入のとき、訪問が変わらない操作（〈スタッフ〉の勤務・繰り返しパターン・〈利用者さん〉の休みなど visits の外だけを変える操作。
 *   繰り返しの回は上書きするまで保存した訪問にならない）、計算に入れる訪問が無い日
 * - 止める update（UpdateOptions.tell:false）：名簿の読み込み・古い記録を消す・設定の操作（訪問の種類を消す・項目・条件・プリセット・呼び名・
 *   機能の入り切りなど、予定の直しでないもの）
 */
export function autoTell(
  before: DemoData,
  after: DemoData,
  today: string,
  at: number = Date.now(),
  opts: { wait?: boolean } = {},
): DemoData {
  if (before.visits === after.visits || isOn(after.org.features, 'expert')) return after;
  const until = settledUntil(today);
  const was = savedByDate(before.visits, today, until);
  const now = savedByDate(after.visits, today, until);
  const dates = [...new Set([...was.keys(), ...now.keys()])].sort();
  let out = after;
  for (const date of dates) {
    if (own(after.snapshots, date)) continue;
    const { changed, removed } = diffVisits(was.get(date) ?? [], now.get(date) ?? []);
    if (changed.length === 0 && !removed) continue;
    if (opts.wait !== false && changed.some((v) => !v.staffId && isFree(after, v, today))) {
      // 組む対象になる訪問がある日だけ、依頼が出る条件（autoTargets）で確かめる
      const day = { from: date, to: date };
      if (autoTargets(before, after, today, day).length > 0 && autoRange(today).to >= date) continue;
    }
    out = tellIfNeeded(out, date, at);
  }
  return out;
}

/** store の update が使う設定（UpdateOptions のうち決まった予定に関わるもの） */
export type SettleOptions = { tell?: false; settleNow?: true };

/**
 * update の1回の結果に自動の伝えた記録を付ける（store の update から呼ぶ1か所。now は今の時刻 ms）。
 * tell が false の update（名簿の読み込み・古い記録を消す・設定の操作）は付けない。settleNow は待たずに付ける
 */
export function settleUpdate(before: DemoData, made: DemoData, opts: SettleOptions | undefined, now: number): DemoData {
  if (opts?.tell === false) return made;
  return autoTell(before, made, jstDate(now), now, { wait: !opts?.settleNow });
}
