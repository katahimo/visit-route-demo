// iCalendar（.ics）を読む（Google カレンダーの書き出しから休みを読み込む。PRD D440。ADR-0107）。
// 予定（VEVENT）の 件名・開始・終了・繰り返し（RRULE の DAILY・WEEKLY・MONTHLY・YEARLY と INTERVAL・COUNT・UNTIL・
// BYDAY・BYMONTHDAY）・除く日（EXDATE）・1回だけ直した回（RECURRENCE-ID）・取り消し（STATUS:CANCELLED）を見る。
// 時刻は日本時間にそろえる（末尾 Z の UTC は +9 時間、TZID 付き・TZID 無しはその時刻のまま。業務は日本時間だけ。domain/time）。
// UTC の繰り返しは UTC の日付で曜日・日を当ててから日本時間に直す。週の頭は WKST（無ければ月曜）。
// 読めない繰り返し（BYSETPOS など）の予定は数えて飛ばす。どれも純粋関数（データを書き換えない）
import { addDays, weekday } from '../domain/time';
import { daysBetween } from './ym';

/** 日本時間の日付と時刻（終日の予定は time が null） */
export type IcsTime = { date: string; time: string | null };

/** 予定1件（繰り返しは開く前のまま） */
export type IcsEvent = {
  uid: string;
  summary: string;
  cancelled: boolean;
  start: IcsTime;
  /** 開始が UTC（末尾 Z）なら UTC の日付と時刻（繰り返しはこちらで当てる）。ほかは null */
  startUtc: IcsTime | null;
  /** 終了（終日は次の日＝含まない日。無ければ null） */
  end: IcsTime | null;
  rrule: string | null;
  /** 除く回（日本時間の日付） */
  exdates: string[];
  /** 1回だけ直した回なら、元の回の日付（日本時間） */
  recurrenceId: string | null;
};

/** カレンダー1つ（名前は X-WR-CALNAME） */
export type IcsCalendar = { name: string; events: IcsEvent[] };

/** 開いた1回（終了は必ずある。終日は含まない日） */
export type IcsOccurrence = { summary: string; start: IcsTime; end: IcsTime };

/** 回数（COUNT）のある繰り返しを最初の回から数える上限の日数（約30年） */
const MAX_SCAN_DAYS = 11000;

/** 日付と時刻を分だけずらす */
function shiftMinutes(t: IcsTime, minutes: number): IcsTime {
  const [h = 0, m = 0] = (t.time ?? '00:00').split(':').map(Number);
  const iso = new Date(
    Date.UTC(+t.date.slice(0, 4), +t.date.slice(5, 7) - 1, +t.date.slice(8, 10), h, m) + minutes * 60000,
  ).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** 2つの時刻の差（分） */
const minutesBetween = (a: IcsTime, b: IcsTime): number => {
  const ms = (t: IcsTime) => {
    const [h = 0, m = 0] = (t.time ?? '00:00').split(':').map(Number);
    return Date.UTC(+t.date.slice(0, 4), +t.date.slice(5, 7) - 1, +t.date.slice(8, 10), h, m);
  };
  return Math.round((ms(b) - ms(a)) / 60000);
};

/** 1行（折り返しを戻したあと）を 名前・パラメータ・値 に分ける（パラメータの中の引用符の : は区切りにしない） */
function splitLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name = '', ...rest] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rest) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** 文の値の \n・\,・\;・\\ を戻す */
const unescapeText = (v: string): string =>
  v.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** 日付・日時の値 → 日本時間（読めなければ null）。20261105・20261118T000000Z・20261118T090000 */
export function icsTime(value: string, params: Record<string, string> = {}): IcsTime | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] === undefined || params.VALUE === 'DATE') return { date, time: null };
  if (m[7] === undefined) return { date, time: `${m[4]}:${m[5]}` };
  const ms = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4], +m[5]!, +m[6]!) + 9 * 3600000;
  const iso = new Date(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** .ics の文 → カレンダー（予定の中の通知（VALARM）などは読まない） */
export function parseIcs(text: string): IcsCalendar {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  let name = '';
  const events: IcsEvent[] = [];
  let ev: Partial<IcsEvent> | null = null;
  let depth = 0;
  for (const raw of lines) {
    const l = splitLine(raw);
    if (!l) continue;
    if (l.name === 'BEGIN') {
      if (l.value.toUpperCase() === 'VEVENT' && ev === null)
        ev = { exdates: [], recurrenceId: null, rrule: null, startUtc: null };
      else if (ev) depth++;
      continue;
    }
    if (l.name === 'END') {
      if (ev && depth > 0) depth--;
      else if (ev && l.value.toUpperCase() === 'VEVENT') {
        if (ev.start) events.push({ uid: '', summary: '', cancelled: false, end: null, ...ev } as IcsEvent);
        ev = null;
      }
      continue;
    }
    if (!ev) {
      if (l.name === 'X-WR-CALNAME') name = unescapeText(l.value).trim();
      continue;
    }
    if (depth > 0) continue;
    readProp(ev, l);
  }
  return { name, events };
}

/** 予定の中の1行を ev に入れる */
function readProp(ev: Partial<IcsEvent>, l: { name: string; params: Record<string, string>; value: string }) {
  switch (l.name) {
    case 'UID':
      ev.uid = l.value;
      break;
    case 'SUMMARY':
      ev.summary = unescapeText(l.value).trim();
      break;
    case 'STATUS':
      ev.cancelled = l.value.toUpperCase() === 'CANCELLED';
      break;
    case 'DTSTART': {
      ev.start = icsTime(l.value, l.params) ?? undefined;
      const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})\d{2}Z$/.exec(l.value.trim());
      ev.startUtc = utc ? { date: `${utc[1]}-${utc[2]}-${utc[3]}`, time: `${utc[4]}:${utc[5]}` } : null;
      break;
    }
    case 'DTEND':
      ev.end = icsTime(l.value, l.params);
      break;
    case 'RRULE':
      ev.rrule = l.value;
      break;
    case 'EXDATE':
      for (const v of l.value.split(',')) {
        const t = icsTime(v, l.params);
        if (t) ev.exdates?.push(t.date);
      }
      break;
    case 'RECURRENCE-ID':
      ev.recurrenceId = icsTime(l.value, l.params)?.date ?? null;
      break;
  }
}

/** 繰り返しの決まり（読めない部分があれば null） */
type Rule = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number | null;
  /** 日本時間の 'YYYY-MM-DDTHH:MM'（終日の UNTIL は 'YYYY-MM-DDT23:59'） */
  until: string | null;
  /** 曜日（0=日〜6=土）と何番目（0＝毎週。-1＝最後） */
  byDay: { day: number; nth: number }[];
  byMonthDay: number[];
  /** 週の頭の曜日（WKST。0=日〜6=土。無ければ月曜） */
  wkst: number;
};

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** RRULE の値を読む（読めない部分（BYSETPOS・BYMONTH・BYHOUR など）があれば null） */
export function parseRule(value: string): Rule | null {
  const parts = Object.fromEntries(
    value.split(';').map((p) => {
      const [k = '', v = ''] = p.split('=');
      return [k.toUpperCase(), v.toUpperCase()];
    }),
  );
  const known = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'WKST']);
  if (Object.keys(parts).some((k) => !known.has(k))) return null;
  const freq = parts.FREQ;
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;
  const byDay: Rule['byDay'] = [];
  for (const d of parts.BYDAY ? parts.BYDAY.split(',') : []) {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d);
    if (!m) return null;
    byDay.push({ day: DAYS.indexOf(m[2]!), nth: m[1] ? Number(m[1]) : 0 });
  }
  const byMonthDay = parts.BYMONTHDAY ? parts.BYMONTHDAY.split(',').map(Number) : [];
  if (byMonthDay.some((n) => !Number.isInteger(n) || n === 0 || Math.abs(n) > 31)) return null;
  if ((freq === 'YEARLY' || freq === 'DAILY') && (byDay.length > 0 || byMonthDay.length > 0)) return null;
  if (freq === 'WEEKLY' && (byMonthDay.length > 0 || byDay.some((b) => b.nth !== 0))) return null;
  const until = parts.UNTIL ? icsTime(parts.UNTIL) : null;
  if (parts.UNTIL && !until) return null;
  const wkst = parts.WKST ? DAYS.indexOf(parts.WKST) : 1;
  if (wkst < 0) return null;
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : null,
    until: until ? `${until.date}T${until.time ?? '23:59'}` : null,
    byDay,
    byMonthDay,
    wkst,
  };
}

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const dayOf = (date: string) => Number(date.slice(8, 10));
const daysInMonth = (date: string) =>
  new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate();

/** その日が月の何番目の曜日か（前から n・後ろから -n）に当たるか */
function nthMatches(date: string, nth: number): boolean {
  if (nth === 0) return true;
  const d = dayOf(date);
  return nth > 0 ? Math.ceil(d / 7) === nth : Math.ceil((daysInMonth(date) - d + 1) / 7) === -nth;
}

/** その日が繰り返しの回か（start は最初の回の日付） */
function ruleHits(rule: Rule, start: string, date: string): boolean {
  switch (rule.freq) {
    case 'DAILY':
      return daysBetween(start, date) % rule.interval === 0;
    case 'WEEKLY': {
      // 週の頭は WKST（無ければ月曜）。隔週などはその週の数で数える
      const head = (d: string) => addDays(d, -((weekday(d) - rule.wkst + 7) % 7));
      if ((daysBetween(head(start), head(date)) / 7) % rule.interval !== 0) return false;
      const days = rule.byDay.length > 0 ? rule.byDay.map((b) => b.day) : [weekday(start)];
      return days.includes(weekday(date));
    }
    case 'MONTHLY': {
      if ((monthIndex(date) - monthIndex(start)) % rule.interval !== 0) return false;
      if (rule.byDay.length > 0) return rule.byDay.some((b) => b.day === weekday(date) && nthMatches(date, b.nth));
      const days = rule.byMonthDay.length > 0 ? rule.byMonthDay : [dayOf(start)];
      const last = daysInMonth(date);
      return days.some((n) => (n > 0 ? n : last + n + 1) === dayOf(date));
    }
    case 'YEARLY':
      return (
        (Number(date.slice(0, 4)) - Number(start.slice(0, 4))) % rule.interval === 0 && date.slice(5) === start.slice(5)
      );
    default: {
      const _: never = rule.freq;
      return _;
    }
  }
}

/** 予定の終了（無ければ、終日は次の日、時刻つきは開始と同じ） */
function endOf(e: Pick<IcsEvent, 'start' | 'end'>): IcsTime {
  if (e.end) return e.end;
  return e.start.time === null ? { date: addDays(e.start.date, 1), time: null } : e.start;
}

/** 開いた1回が from〜to（日付。両端を含む）にかかるか */
function overlaps(o: IcsOccurrence, from: string, to: string): boolean {
  const lastDay = o.end.time === null || o.end.time === '00:00' ? addDays(o.end.date, -1) : o.end.date;
  return o.start.date <= to && (lastDay >= from || o.start.date >= from);
}

/**
 * from〜to（日本時間の日付。両端を含む）にかかる回を開く（取り消した予定・除く回・直した回の元の回は除き、直した回はその内容で）。
 * keep があれば、件名が当たる予定だけを開く（ほかの予定は開かず、読めない繰り返しにも数えない）。
 * unsupported は読めない繰り返しの予定の数
 */
export function occurrencesIn(
  cal: Pick<IcsCalendar, 'events'>,
  from: string,
  to: string,
  keep: (summary: string) => boolean = () => true,
): { list: IcsOccurrence[]; unsupported: number } {
  const moved = new Set(cal.events.filter((e) => e.recurrenceId !== null).map((e) => `${e.uid}@${e.recurrenceId}`));
  const list: IcsOccurrence[] = [];
  let unsupported = 0;
  for (const e of cal.events) {
    if (e.cancelled || !keep(e.summary)) continue;
    const end = endOf(e);
    if (!e.rrule || e.recurrenceId !== null) {
      const o = { summary: e.summary, start: e.start, end };
      if (overlaps(o, from, to)) list.push(o);
      continue;
    }
    const rule = parseRule(e.rrule);
    if (!rule) {
      unsupported++;
      continue;
    }
    list.push(...expand(e, rule, end, from, to, moved));
  }
  return { list, unsupported };
}

/**
 * 繰り返しの予定を開く。曜日・日は開始の時間帯（UTC の開始なら UTC の日付）で当て、回は日本時間に直す。
 * 回数（COUNT）があれば最初の回から数え、無ければ見る範囲の少し前から当てる（古い開始日でも速く、範囲に届く）
 */
function expand(
  e: IcsEvent,
  rule: Rule,
  end: IcsTime,
  from: string,
  to: string,
  moved: ReadonlySet<string>,
): IcsOccurrence[] {
  const base = e.startUtc ?? e.start;
  const toLocal = (date: string): IcsTime =>
    e.startUtc ? shiftMinutes({ date, time: base.time }, 9 * 60) : { date, time: base.time };
  const allDay = e.start.time === null;
  const spanDays = daysBetween(e.start.date, end.date);
  const spanMinutes = allDay ? 0 : minutesBetween(e.start, end);
  const ex = new Set(e.exdates);
  const out: IcsOccurrence[] = [];
  // 回数が無ければ、範囲の初めから予定の長さと時差（1日）だけ前から当てる
  const skip = rule.count === null ? Math.max(0, daysBetween(base.date, from) - spanDays - 2) : 0;
  const limit = rule.count === null ? daysBetween(base.date, to) + 2 : MAX_SCAN_DAYS;
  let n = 0;
  for (let i = skip; i <= limit; i++) {
    const date = addDays(base.date, i);
    const start = toLocal(date);
    if (start.date > to) break;
    if (rule.until !== null && `${start.date}T${start.time ?? '00:00'}` > rule.until) break;
    if (i > 0 && !ruleHits(rule, base.date, date)) continue;
    n++;
    if (rule.count !== null && n > rule.count) break;
    if (ex.has(start.date) || moved.has(`${e.uid}@${start.date}`)) continue;
    const o = {
      summary: e.summary,
      start,
      end: allDay ? { date: addDays(start.date, spanDays), time: null } : shiftMinutes(start, spanMinutes),
    };
    if (overlaps(o, from, to)) out.push(o);
  }
  return out;
}
