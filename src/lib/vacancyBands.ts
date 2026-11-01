// 空き状況の段階1のチップ（PRD D411。ADR-0080）：時間帯（午前・午後・夕方。複数可）と所要。
// 時間帯は訪問の開始の時刻の幅。終わりの時刻は含まない（午前は 11:30 開始まで、12:00 開始は午後。帯が重ならない）。
// 問い合わせの契約（InquiryWish）は開始の幅1つなので、選んだ時間帯の外の開始時刻のマスを結果から除き（時刻の列は残す）、
// 幅は選んだ時間帯の端から端にして渡す。つながらない時間帯（午前と夕方）の間の時刻はマスが無いので答えに入らない
import type { Terms } from '../contracts/documents';
import type { InquiryWish, VacancyResult } from '../contracts/vacancy';
import { hhmmToMinutes, minutesToHhmm } from '../domain/time';
import { inquirySummary } from '../vacancy';
import { clockTime } from './dateText';
import { type HoldSlot, holdSlots } from './hold';
import { type AnswerCard, answerCard } from './vacancyView';

/** 時間帯の id（覚える入力の形。lib/vacancyInput） */
export const WISH_BAND_IDS = ['am', 'pm', 'eve'] as const;
export type WishBand = (typeof WISH_BAND_IDS)[number];

/** 時間帯のチップ（並びは時刻の順） */
export const WISH_BANDS: readonly { id: WishBand; label: string; from: string; to: string }[] = [
  { id: 'am', label: '午前', from: '08:00', to: '12:00' },
  { id: 'pm', label: '午後', from: '12:00', to: '17:00' },
  { id: 'eve', label: '夕方', from: '17:00', to: '20:00' },
];

/** 所要のチップ（分。ほかの分はくわしい条件） */
export const DURATION_CHIPS: readonly number[] = [30, 45, 60, 90];

/** 時間帯のチップの文（「午前 8:00〜12:00」） */
export const bandText = (b: (typeof WISH_BANDS)[number]): string =>
  `${b.label} ${clockTime(hhmmToMinutes(b.from))}〜${clockTime(hhmmToMinutes(b.to))}`;

/** 時間帯を押したあとの選び方（押した帯を足すか外す。並びは時刻の順） */
export function toggleBand(bands: readonly WishBand[], id: WishBand): WishBand[] {
  const next = bands.includes(id) ? bands.filter((x) => x !== id) : [...bands, id];
  return WISH_BANDS.map((b) => b.id).filter((x) => next.includes(x));
}

/** 選んだ時間帯の開始の幅（分。from ≦ 開始 < to。接する帯はつなぐ。時刻の順）。選ばなければ空 */
export function bandSpans(bands: readonly WishBand[]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (const b of WISH_BANDS) {
    if (!bands.includes(b.id)) continue;
    const from = hhmmToMinutes(b.from);
    const to = hhmmToMinutes(b.to);
    const last = out[out.length - 1];
    if (last && from <= last.to) last.to = Math.max(last.to, to);
    else out.push({ from, to });
  }
  return out;
}

/**
 * 問い合わせに渡す開始の幅（HH:mm。両端を含む）：時間帯を選べばその端から端（終わりの時刻ちょうどのマスは inBands が除く）、
 * 選ばなければくわしい条件の幅
 */
export function wishWindow(
  bands: readonly WishBand[],
  fallback: { from: string; to: string },
): { from: string; to: string } {
  const spans = bandSpans(bands);
  if (spans.length === 0) return fallback;
  return { from: minutesToHhmm(spans[0]!.from), to: minutesToHhmm(spans[spans.length - 1]!.to) };
}

/**
 * 時間帯の外の開始時刻のマスを除いた結果（答え・要約・仮押さえ・週ごとのマスに使う。表は除かない元の結果）。
 * 時刻の列（times）は残すので、つながらない帯の時刻が続いた範囲にまとまらない。選ばなければそのまま
 */
export function inBands(result: VacancyResult, bands: readonly WishBand[]): VacancyResult {
  const spans = bandSpans(bands);
  if (spans.length === 0) return result;
  return { ...result, cells: result.cells.filter((c) => spans.some((s) => c.start >= s.from && c.start < s.to)) };
}

/** 開始の幅の文（要約の行。「8:00〜12:00・17:00〜20:00」）。時間帯を選ばなければくわしい条件の幅 */
export function startRangeText(bands: readonly WishBand[], fallback: { from: string; to: string }): string {
  const spans = bandSpans(bands);
  if (spans.length === 0) return `${clockTime(hhmmToMinutes(fallback.from))}〜${clockTime(hhmmToMinutes(fallback.to))}`;
  return spans.map((s) => `${clockTime(s.from)}〜${clockTime(s.to)}`).join('・');
}

/**
 * 問い合わせの答え（PRD D258・D411・D412）：時間帯のチップを開始の幅にして、答えのカード・要約・仮押さえの開始時刻を作る。
 * くわしい条件の幅が逆（から＞まで）で時間帯も選ばなければ wishOk は false（答えを出さない）
 */
export function bandInquiry(
  result: VacancyResult | null,
  q: { weekdays: number[]; from: string; to: string; bands: readonly WishBand[]; perWeek: number; startDate: string },
  terms: Terms,
): {
  wish: InquiryWish;
  wishOk: boolean;
  /** 時間帯の外のマスを除いた結果（週ごとのマスにも使う） */
  answerResult: VacancyResult | null;
  answer: AnswerCard | null;
  summary: string | null;
  slots: HoldSlot[];
} {
  const w = wishWindow(q.bands, { from: q.from, to: q.to });
  const wish = { weekdays: q.weekdays, from: w.from, to: w.to, perWeek: q.perWeek, startDate: q.startDate };
  const wishOk = q.bands.length > 0 || hhmmToMinutes(q.from) <= hhmmToMinutes(q.to);
  const answerResult = result && wishOk ? inBands(result, q.bands) : null;
  if (!answerResult) return { wish, wishOk, answerResult, answer: null, summary: null, slots: [] };
  return {
    wish,
    wishOk,
    answerResult,
    answer: answerCard(answerResult, wish),
    summary: inquirySummary(answerResult, wish, terms),
    slots: holdSlots(answerResult, q.weekdays, wish.from, wish.to, q.perWeek),
  };
}
