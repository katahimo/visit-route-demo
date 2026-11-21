// 空き状況の「週の空きの帯」（PRD D472）：曜日ごとに、開始時刻の30分ごとの空きを1本の帯の色（人数の段階）で見せる。
// 計算（vacancyOf・verdictOf）は src/vacancy のまま。ここは結果の並べ替えと、行の一言（印・時刻・人数）を決める純粋関数
import type { VacancyResult, Verdict } from '../contracts/vacancy';
import { verdictOf } from '../vacancy';
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from './common';
import { clockTime } from './dateText';
import { type VacancyLevel, vacancyLevel } from './glance';
import { VACANCY_MARK } from './vacancyView';

/** 帯の1区画（開始時刻1つ）。cell が無い時刻は level が null */
export type StripSegment = {
  start: number;
  level: VacancyLevel | null;
  /** 区画に載せる短い文字：○ は人数、△ は △、？ は ？、× と無しは空 */
  face: string;
  /** 答えの範囲（希望の曜日・時間帯）の内か。外は薄く描く */
  inRange: boolean;
  /** 読み上げ・title の文 */
  label: string;
};

/** 行の判定：範囲内の区画の一番良い判定。範囲内に区画が無ければ 'none' */
export type StripVerdict = Verdict | 'none';

export type StripRow = {
  weekday: number;
  /** 曜日の1文字（月〜日） */
  dayLabel: string;
  /** 希望の曜日か（希望を選ばなければすべて true）。希望でない曜日の行は薄く描く */
  wished: boolean;
  segments: StripSegment[];
  verdict: StripVerdict;
  /** 行の一言（「○ 10:00〜12:00・約3人」「△ 受けられない週がある」「× 受けられない」） */
  text: string;
};

export type VacancyStrip = {
  rows: StripRow[];
  /** 時刻の目盛り（segments の何番目か・「9:00」） */
  ticks: { index: number; label: string }[];
};

/** 目盛りの間隔（分）：3時間ごと */
const TICK_MINUTES = 180;

const VERDICT_RANK: Record<Verdict, number> = { ok: 3, partial: 2, ng: 1, unknown: 0 };

const VERDICT_WORD: Record<Verdict, string> = {
  ok: 'どの週も受けられる',
  partial: '受けられない週がある',
  ng: '受けられない',
  unknown: '数えられない日',
};

/** 続いた開始時刻（times の並びで隣）を範囲にまとめる（「9:00〜12:30」。1つなら「9:00」） */
function runsText(starts: number[], times: number[]): string {
  const idx = new Map(times.map((t, i) => [t, i]));
  const runs: number[][] = [];
  for (const s of starts) {
    const last = runs[runs.length - 1];
    if (last && idx.get(s) === (idx.get(last[last.length - 1] as number) ?? -2) + 1) last.push(s);
    else runs.push([s]);
  }
  return runs
    .map((r) => {
      const first = clockTime(r[0] as number);
      return r.length === 1 ? first : `${first}〜${clockTime(r[r.length - 1] as number)}`;
    })
    .join('、');
}

/** 人数の幅の文（「約3人」「2〜3人」） */
function peopleText(people: number[], about: string): string {
  const lo = Math.min(...people);
  const hi = Math.max(...people);
  return `${about}${lo === hi ? lo : `${lo}〜${hi}`}人`;
}

/**
 * 週の空きの帯を作る。result は表と同じ（時間帯の外も含む）、answerResult は時間帯のチップの外を除いた結果
 * （null なら全部を範囲内とみなす）、weekdays は希望の曜日（空＝どの曜日でも）
 */
export function vacancyStrip(
  result: VacancyResult,
  answerResult: VacancyResult | null,
  weekdays: readonly number[],
): VacancyStrip {
  const cellOf = new Map(result.cells.map((c) => [`${c.weekday}-${c.start}`, c]));
  const inSet = answerResult ? new Set(answerResult.cells.map((c) => `${c.weekday}-${c.start}`)) : null;
  const about = result.exact ? '' : '約';
  const rows = WEEKDAY_ORDER.map((weekday): StripRow => {
    const dayLabel = WEEKDAY_LABELS[weekday] ?? '';
    const wished = weekdays.length === 0 || weekdays.includes(weekday);
    const okStarts: number[] = [];
    const people: number[] = [];
    let best = null as Verdict | null;
    const segments = result.times.map((start): StripSegment => {
      const cell = cellOf.get(`${weekday}-${start}`);
      if (!cell) {
        return { start, level: null, face: '', inRange: false, label: `${clockTime(start)}から：始められません` };
      }
      const verdict = verdictOf(cell);
      const inRange = inSet ? inSet.has(`${weekday}-${start}`) : true;
      if (inRange && (best === null || VERDICT_RANK[verdict] > VERDICT_RANK[best])) best = verdict;
      if (inRange && verdict === 'ok') {
        okStarts.push(start);
        people.push(cell.min);
      }
      const face =
        verdict === 'ok' ? String(cell.min) : verdict === 'partial' ? '△' : verdict === 'unknown' ? '？' : '';
      const count = verdict === 'ok' ? `（${about}${cell.min}人）` : '';
      return {
        start,
        level: vacancyLevel(cell),
        face,
        inRange,
        label: `${dayLabel} ${clockTime(start)}から：${VACANCY_MARK[verdict]} ${VERDICT_WORD[verdict]}${count}`,
      };
    });
    const verdict: StripVerdict = best ?? 'none';
    let text = '— 範囲の外';
    if (verdict === 'ok') text = `○ ${runsText(okStarts, result.times)}・${peopleText(people, about)}`;
    else if (verdict !== 'none') text = `${VACANCY_MARK[verdict]} ${VERDICT_WORD[verdict]}`;
    return { weekday, dayLabel, wished, segments, verdict, text };
  });
  const ticks = result.times.flatMap((t, index) => (t % TICK_MINUTES === 0 ? [{ index, label: clockTime(t) }] : []));
  return { rows, ticks };
}
