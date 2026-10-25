// 〈利用者さん〉・〈スタッフ〉の画面の予定のカレンダー（components/PersonCalendar。PRD D309・D310。ADR-0052）の
// 回の文・行の中身・時間軸の位置の計算。データは書き換えない
import type { Client, Staff, VisitType } from '../contracts/documents';
import { minutesToHhmm } from '../domain/time';
import { colorOf } from './colors';
import { clockTime, dateText } from './dateText';
import { typeOf } from './patternText';
import { CAL_STATE_TEXT, type CalItem, type CalView } from './personPage';
import { DAY_END, DAY_START } from './spans';
import { hourMarks, toY } from './timeline';
import { type Lane, snapMinutes } from './week';
import { ymOf } from './ym';

// ---- 時間軸（週） ----

/** 時間軸の1分の高さ（px。週の予定と同じ） */
export const PCAL_PX_PER_MIN = 0.8;
const RANGE = { start: DAY_START, end: DAY_END };
/** 時間軸の目盛り（1時間ごと。始まりと終わりを含む） */
export const PCAL_HOURS = hourMarks(RANGE);
/** 時間軸の列の高さ（px） */
export const PCAL_HEIGHT = (DAY_END - DAY_START) * PCAL_PX_PER_MIN;

/** 時刻 → 列の上端からの px（07:00〜20:00 の外は端に寄せる） */
export const pcalY = (minutes: number): number => toY(minutes, RANGE, PCAL_PX_PER_MIN);

/** 空き枠を押した位置（列の上端からの px）の15分の枠の始まり（07:00〜19:45 に収める） */
export function slotMinuteAt(offsetY: number): number {
  const m = Math.floor((DAY_START + offsetY / PCAL_PX_PER_MIN) / 15) * 15;
  return Math.min(Math.max(m, DAY_START), DAY_END - 15);
}

/** 回を落とした位置（列の上端から、つかんだ位置を引いた px）の15分刻みの開始 */
export const dropStartAt = (offsetY: number): number => snapMinutes(DAY_START + offsetY / PCAL_PX_PER_MIN);

/** 時間軸の回の位置（重なる回は横に並べる。高さは 20px 以上） */
export function itemBox(it: Pick<CalItem, 'start' | 'end'>, l: Lane) {
  return {
    top: pcalY(it.start),
    height: Math.max(20, (Math.min(it.end, DAY_END) - Math.max(it.start, DAY_START)) * PCAL_PX_PER_MIN),
    left: `calc(${(l.lane / l.lanes) * 100}% + 2px)`,
    width: `calc(${100 / l.lanes}% - 4px)`,
  };
}

/** 空き枠を押している間の範囲の位置（a は押した枠、b は今の枠。どちらも15分の枠の始まり） */
export function ghostBox(a: number, b: number): { top: number; height: number } {
  return {
    top: pcalY(Math.min(a, b)),
    height: Math.max(12, (Math.abs(b - a) + 15) * PCAL_PX_PER_MIN),
  };
}

/** 落とし先の影の位置（高さは所要の長さ。24px 以上） */
export function dropBox(start: number, duration: number): { top: number; height: number } {
  return { top: pcalY(start), height: Math.max(24, duration * PCAL_PX_PER_MIN) };
}

// ---- 回の文 ----

/** 回の文に要るもの（どちらの画面か・人と種類の引き当て） */
export type CalTextCtx = {
  isClient: boolean;
  staffById: ReadonlyMap<string, Staff>;
  clientById: ReadonlyMap<string, Client>;
  visitTypes: readonly VisitType[];
};

/** 回の「だれ」：〈利用者さん〉の画面は担当（担当がいなければ様子）、〈スタッフ〉の画面は〈利用者さん〉 */
export function calWho(it: CalItem, c: CalTextCtx): string {
  if (!c.isClient) return c.clientById.get(it.visit.clientId)?.displayName ?? '（不明）';
  if (it.state !== 'assigned') return CAL_STATE_TEXT[it.state];
  return c.staffById.get(it.staffId ?? '')?.name ?? '（不明）';
}

/** 回の札の「だれ」（〈利用者さん〉の画面の担当は名字だけ） */
export function calShortWho(it: CalItem, c: CalTextCtx): string {
  const t = calWho(it, c);
  return c.isClient && it.state === 'assigned' ? (t.split(/\s+/)[0] ?? t) : t;
}

/** 回の読み上げの文（日付・時刻・だれ・様子・種類・この回だけ変更・固定） */
export function calItemText(it: CalItem, c: CalTextCtx): string {
  const type = typeOf(c.visitTypes, it.visit.typeId);
  const extra = [
    c.isClient ? null : CAL_STATE_TEXT[it.state] || null,
    type?.name ?? null,
    it.edited ? 'この回だけ変更' : null,
    it.pinned ? '固定' : null,
  ].filter(Boolean);
  return `${dateText(it.visit.date)} ${it.visit.earliestStart}〜${minutesToHhmm(it.end)} ${calWho(it, c)}${
    extra.length > 0 ? `（${extra.join('・')}）` : ''
  }`;
}

/** 強調する繰り返しの見た目（強調する回は is-hl、ほかは is-dim。強調しなければ無し） */
export const calHlClass = (it: CalItem, highlight: string | null): string =>
  highlight ? (it.visit.pattern?.id === highlight ? ' is-hl' : ' is-dim') : '';

/** 強調する繰り返しの回の数 */
export const highlightCount = (items: readonly CalItem[], highlight: string | null): number =>
  highlight ? items.filter((it) => it.visit.pattern?.id === highlight).length : 0;

/** 狭い画面の日ごとのリストの行の中身（印 look は画面で足す。components/visitParts の VisitRowData） */
export function calRowOf(it: CalItem, c: CalTextCtx) {
  const t = typeOf(c.visitTypes, it.visit.typeId);
  const s = it.staffId ? c.staffById.get(it.staffId) : undefined;
  return {
    visitId: it.visit.id,
    time: `${it.visit.earliestStart.replace(/^0/, '')}〜${clockTime(it.end)}`,
    title: c.isClient ? (t?.name ?? '訪問') : (c.clientById.get(it.visit.clientId)?.displayName ?? '（不明）'),
    staff: c.isClient ? (s ?? null) : null,
    staffName: c.isClient && it.state === 'assigned' ? (s?.name ?? '（不明）') : '',
    state: it.state === 'cancelled' || it.state === 'sameDay' || it.state === 'leave' ? CAL_STATE_TEXT[it.state] : null,
    color: t ? colorOf(t.color) : null,
    hideStaff: !c.isClient,
  };
}

/**
 * 狭い画面の日ごとのリストに出す日：週は7日とも、月はその月の日のうち回がある日と今日
 */
export function calListDays(
  view: CalView,
  anchor: string,
  dates: readonly string[],
  byDate: ReadonlyMap<string, readonly CalItem[]>,
  today: string,
): string[] {
  const shown = view === 'month' ? dates.filter((d) => ymOf(d) === ymOf(anchor)) : dates;
  return shown.filter((d) => view === 'week' || (byDate.get(d)?.length ?? 0) > 0 || d === today);
}
