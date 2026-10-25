// 勤務の見込みの画面の表示のための計算（PRD D72。ADR-0015）：選んだ人の日ごと・時間軸の範囲と目盛り・
// マスの数字と説明の文・設定（交通費の単価・拘束の上限）の入力の検査。純粋関数
import { clockTime, mdText } from './dateText';
import { hmText, type WorkDay, type WorkStat, type WorkTotal } from './workload';

/** 表に出す人の月の合計を足す（pick で足す数を選ぶ。合計の無い人は渡さない） */
export function sumWork(
  totals: ReadonlyMap<string, WorkTotal>,
  staff: readonly { id: string }[],
  pick: (t: WorkTotal) => number,
): number {
  return staff.reduce((m, s) => m + pick(totals.get(s.id)!), 0);
}

/** 選んだ人のその日の見込み */
export type PickedDay = { day: WorkDay; stat: WorkStat };

/** 選んだ人の、見込みのある日だけ（日付の順のまま。人がいなければ空） */
export function pickedDaysOf(days: readonly WorkDay[], staffId: string | undefined): PickedDay[] {
  if (staffId === undefined) return [];
  return days.flatMap((d) => {
    const x = d.stats.find((y) => y.staffId === staffId);
    return x ? [{ day: d, stat: x }] : [];
  });
}

/** 時間軸の範囲（7:00〜20:00。はみ出す日があれば時間の区切りまで広げる） */
export function workAxis(picked: readonly PickedDay[]): { start: number; end: number } {
  let start = 7 * 60;
  let end = 20 * 60;
  for (const { stat } of picked) {
    start = Math.min(start, Math.floor(stat.start / 60) * 60);
    end = Math.max(end, Math.ceil(stat.end / 60) * 60);
  }
  return { start, end };
}

/** 時間軸の目盛り（2時間ごと） */
export function axisMarks(axis: { start: number; end: number }): number[] {
  const out: number[] = [];
  for (let m = Math.ceil(axis.start / 120) * 120; m <= axis.end; m += 120) out.push(m);
  return out;
}

/** マスに出す拘束の時間（時間。小数1桁。読み上げの先頭にも同じ文字を置く） */
export const spanNum = (x: WorkStat): string => (Math.round((x.span / 60) * 10) / 10).toFixed(1);

/** マスの説明（title と読み上げ） */
export const statTitle = (name: string, d: string, x: WorkStat): string =>
  `${name}さん ${mdText(d)}：${clockTime(x.start)}〜${clockTime(x.end)}・出勤〜退勤（拘束） ${hmText(x.span)}（訪問 ${hmText(x.visit)}・移動 ${hmText(
    x.travel,
  )}・空き時間（待ち） ${hmText(x.wait)}）・訪問 ${x.count}件${x.over ? '・出勤〜退勤（拘束）が上限を超える' : ''}`;

/** 交通費の単価の入力の誤り（0〜1000。正しければ null） */
export function fareInputError(text: string): string | null {
  const n = Number(text);
  return text.trim() === '' || !Number.isFinite(n) || n < 0 || n > 1000 ? '0〜1000 の数にしてください' : null;
}

/** 拘束の上限の入力の誤り（0〜24 の 0.5刻み。正しければ null） */
export function limitInputError(text: string): string | null {
  const n = Number(text);
  return text.trim() === '' || !Number.isFinite(n) || n < 0 || n > 24 || !Number.isInteger(n * 2)
    ? '0〜24 の 0.5刻みにしてください'
    : null;
}

/** 数が全部 0 の見込み（月の合計の表の「一番長い日」の横棒に使う） */
export const emptyStat = (staffId: string): WorkStat => ({
  staffId,
  count: 0,
  start: 0,
  end: 0,
  span: 0,
  visit: 0,
  travel: 0,
  wait: 0,
  home: 0,
  meters: 0,
  fareYen: 0,
  over: false,
  parts: [],
});
