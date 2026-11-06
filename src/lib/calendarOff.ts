// カレンダーの休みを取り込む（PRD D440。ADR-0107）：〈スタッフ〉ごとの Google カレンダーの書き出し（.ics。lib/icsRead）から、
// 件名に「休み」などのある予定をその日の欠勤（absences。ADR-0011）にする。毎日取り込み直す前提の入れ替え（PRD D441。ADR-0108）：
// カレンダーに当たった〈スタッフ〉の、今日から CAL_OFF_DAYS 日の欠勤を、手で入れたものも含めてカレンダーの内容に入れ替える
// （入れる・直す・外す）。入れる欠勤の ID は `cal-〈スタッフ〉-日付`。
// カレンダーの名前（X-WR-CALNAME）を〈スタッフ〉の名前に当てる（空白・全角半角・かなの違いは問わない）。
// 見る日は今日から CAL_OFF_DAYS 日。過ぎた日は変えない。振り直さない（ADR-0084 と同じ）。どれも純粋関数（データを書き換えない）
import type { DemoData } from '../contracts/data';
import type { Absence, Staff } from '../contracts/documents';
import { addDays, hhmmToMinutes, minutesToHhmm } from '../domain/time';
import { removeAbsence, saveAbsence } from './absences';
import type { IcsCalendar, IcsOccurrence } from './icsRead';
import { occurrencesIn } from './icsRead';
import { actionText } from './pasteRows';
import { offDayState, REQUESTED_OFF_NOTE } from './requestedOff';
import { normalizeKana } from './search';

/** 見る日数（今日を含む。約3か月） */
export const CAL_OFF_DAYS = 93;

/** 休みとみなす件名（「休眠」などは当たらない） */
const OFF_RE = /休み|休業|産休|育休|欠勤|希望休|有休|有給|公休/;
/** 終日の予定の、午前だけ・午後だけ（境12:00。D26） */
const AM_RE = /AM|午前/i;
const PM_RE = /PM|午後/i;

/** カレンダーから入れた欠勤の ID（〈スタッフ〉と日付で決まる。取り込み直すと同じ ID を直す） */
export const calAbsenceId = (staffId: string, date: string): string => `cal-${staffId}-${date}`;

/** 休みの件名か */
export const isOffSummary = (summary: string): boolean => OFF_RE.test(summary.normalize('NFKC'));

/** その日の欠勤の時間帯とメモ */
export type OffSpan = Pick<Absence, 'from' | 'to' | 'note'>;

/** 30分単位に広げる（始まりは切り下げ・終わりは切り上げ。0:00 始まり・24:00 終わりは null＝始業から・終業まで） */
const floor30 = (t: string): string | null => {
  const m = Math.floor(hhmmToMinutes(t) / 30) * 30;
  return m === 0 ? null : minutesToHhmm(m);
};
const ceil30 = (t: string): string | null => {
  const m = Math.ceil(hhmmToMinutes(t) / 30) * 30;
  return m === 0 || m >= 24 * 60 ? null : minutesToHhmm(m);
};

/** 1回の休みの予定 → 日ごとの時間帯（終日は件名の AM・PM で午前・午後。時刻つきはその時刻、日をまたげば日ごと） */
export function offDaysOf(o: IcsOccurrence): { date: string; from: string | null; to: string | null }[] {
  const out: { date: string; from: string | null; to: string | null }[] = [];
  if (o.start.time === null) {
    const s = o.summary.normalize('NFKC');
    const span = AM_RE.test(s) ? { from: null, to: '12:00' } : PM_RE.test(s) ? { from: '12:00', to: null } : null;
    for (let d = o.start.date; d < o.end.date || d === o.start.date; d = addDays(d, 1))
      out.push({ date: d, from: span?.from ?? null, to: span?.to ?? null });
    return out;
  }
  // 終わりが 0:00 ちょうどなら前の日まで
  const endTime = o.end.time ?? '00:00';
  const last = endTime === '00:00' && o.end.date > o.start.date ? addDays(o.end.date, -1) : o.end.date;
  for (let d = o.start.date; d <= last; d = addDays(d, 1)) {
    const from = d === o.start.date ? floor30(o.start.time) : null;
    const to = d === o.end.date ? ceil30(endTime) : null;
    if (from !== null && to !== null && from >= to) continue;
    out.push({ date: d, from, to });
  }
  return out;
}

/** 早い方・遅い方（null は始業から・終業まで＝いちばん広い） */
const minFrom = (a: string | null, b: string | null) => (a === null || b === null ? null : a < b ? a : b);
const maxTo = (a: string | null, b: string | null) => (a === null || b === null ? null : a > b ? a : b);

/**
 * カレンダー1つの休み：日付 → 時間帯とメモ（from〜to の日だけ。同じ日に2つあれば広げてまとめ、メモは件名を「・」でつなぐ。
 * 終日でメモに「希望休」があれば メモ「希望休」）
 */
export function offSpansOf(occurrences: readonly IcsOccurrence[], from: string, to: string): Map<string, OffSpan> {
  const out = new Map<string, OffSpan & { notes: string[] }>();
  for (const o of occurrences) {
    if (!isOffSummary(o.summary)) continue;
    for (const d of offDaysOf(o)) {
      if (d.date < from || d.date > to) continue;
      const cur = out.get(d.date);
      const note = o.summary.replace(/\s+/g, ' ').trim();
      if (!cur) out.set(d.date, { from: d.from, to: d.to, note: '', notes: [note] });
      else {
        cur.from = minFrom(cur.from, d.from);
        cur.to = maxTo(cur.to, d.to);
        if (!cur.notes.includes(note)) cur.notes.push(note);
      }
    }
  }
  return new Map(
    [...out].map(([date, s]) => {
      const joined = s.notes.join('・');
      const note =
        s.from === null && s.to === null && joined.includes(REQUESTED_OFF_NOTE)
          ? REQUESTED_OFF_NOTE
          : joined.slice(0, 100);
      return [date, { from: s.from, to: s.to, note }];
    }),
  );
}

/** 一覧の1行の種類：入れる・直す・外す */
export type CalOffKind = 'add' | 'change' | 'remove';

/** 一覧の1行 */
export type CalOffRow = {
  key: string;
  kind: CalOffKind;
  staffId: string;
  date: string;
  text: string;
  /** 入れる・直すときの欠勤 */
  absence: Absence | null;
  /** 直す・外すときの今の欠勤の ID */
  currentId: string | null;
};

/** 種類の名前（一覧の行の頭） */
export const CAL_OFF_KIND_LABEL: Record<CalOffKind, string> = {
  add: '入れる',
  change: '直す',
  remove: '外す',
};

/** 読んだカレンダーのまとめ */
export type CalOffSummary = {
  calendars: number;
  /** 〈スタッフ〉に当たったカレンダーの名前 */
  matched: string[];
  /** 当たらなかったカレンダーの名前（同じ名前が2人も） */
  unmatched: string[];
  /** 変わらない欠勤の数 */
  unchanged: number;
  /** 勤務の無い日なので入れない休みの数 */
  noShift: number;
  /** 読めない繰り返しの予定の数 */
  unsupported: number;
};

/** 名前を比べる形（空白・全角半角・かなの違いを問わない。lib/search） */
const nameKey = (name: string): string => normalizeKana(name);

/** カレンダーの名前に当たる利用中の〈スタッフ〉（1人だけのとき） */
export function staffOfCalendar(staff: readonly Pick<Staff, 'id' | 'name' | 'active'>[], name: string): string | null {
  const k = nameKey(name);
  if (k === '') return null;
  const hits = staff.filter((s) => s.active && nameKey(s.name) === k);
  return hits.length === 1 ? hits[0]!.id : null;
}

const sameSpan = (a: OffSpan, b: OffSpan) => a.from === b.from && a.to === b.to && a.note === b.note;

/** 1人分の行（日付の順）と、変わらない数 */
function staffRows(
  data: DemoData,
  staffId: string,
  wanted: Map<string, OffSpan>,
  today: string,
  last: string,
): { rows: CalOffRow[]; unchanged: number; noShift: number } {
  const name = data.staff.find((s) => s.id === staffId)?.name ?? '';
  const mine = new Map(
    data.absences.filter((a) => a.staffId === staffId && a.date >= today && a.date <= last).map((a) => [a.date, a]),
  );
  const dates = [...new Set([...wanted.keys(), ...mine.keys()])].sort();
  const rows: CalOffRow[] = [];
  let unchanged = 0;
  let noShift = 0;
  for (const date of dates) {
    const want = wanted.get(date);
    const have = mine.get(date);
    const base = { key: `${staffId}:${date}`, staffId, date };
    if (!want) {
      // カレンダーに無い休み（手で入れたものも外す）
      const { id, from, to, note } = have!;
      const text = actionText({ kind: 'absence', staffId, date, from, to, note }, name, today);
      rows.push({ ...base, kind: 'remove', text, absence: null, currentId: id });
      continue;
    }
    const absence: Absence = { id: calAbsenceId(staffId, date), staffId, date, ...want };
    const text = actionText({ kind: 'absence', ...absence }, name, today);
    if (have) {
      if (have.id === absence.id && sameSpan(have, want)) unchanged++;
      else rows.push({ ...base, kind: 'change', text, absence, currentId: have.id });
    } else if (offDayState(data, staffId, date, today) === 'noShift') noShift++;
    else rows.push({ ...base, kind: 'add', text, absence, currentId: null });
  }
  return { rows, unchanged, noShift };
}

/**
 * 読んだカレンダーを今のデータに照らして一覧にする（〈スタッフ〉の並び・日付の順）。見るのは今日から CAL_OFF_DAYS 日。
 * 同じ〈スタッフ〉のカレンダーが2つあれば休みを合わせる
 */
export function calendarOffRows(
  data: DemoData,
  calendars: readonly IcsCalendar[],
  today: string,
): { rows: CalOffRow[]; summary: CalOffSummary } {
  const last = addDays(today, CAL_OFF_DAYS - 1);
  const wanted = new Map<string, Map<string, OffSpan>>();
  const summary: CalOffSummary = {
    calendars: calendars.length,
    matched: [],
    unmatched: [],
    unchanged: 0,
    noShift: 0,
    unsupported: 0,
  };
  for (const cal of calendars) {
    const staffId = staffOfCalendar(data.staff, cal.name);
    if (staffId === null) {
      summary.unmatched.push(cal.name === '' ? '（名前なし）' : cal.name);
      continue;
    }
    summary.matched.push(cal.name);
    const { list, unsupported } = occurrencesIn(cal, today, last);
    summary.unsupported += unsupported;
    const spans = offSpansOf(list, today, last);
    const prev = wanted.get(staffId);
    if (!prev) wanted.set(staffId, spans);
    else for (const [d, s] of spans) prev.set(d, prev.has(d) ? mergeSpan(prev.get(d)!, s) : s);
  }
  const rows: CalOffRow[] = [];
  for (const s of data.staff) {
    const w = wanted.get(s.id);
    if (!w) continue;
    const r = staffRows(data, s.id, w, today, last);
    rows.push(...r.rows);
    summary.unchanged += r.unchanged;
    summary.noShift += r.noShift;
  }
  return { rows, summary };
}

const mergeSpan = (a: OffSpan, b: OffSpan): OffSpan => ({
  from: minFrom(a.from, b.from),
  to: maxTo(a.to, b.to),
  note: a.note === b.note ? a.note : `${a.note}・${b.note}`.slice(0, 100),
});

/** 入れ替える（1回の update の中で呼ぶ）：直す・外すは今の欠勤を消し、入れる・直すは saveAbsence。振り直さない */
export function applyCalendarOff(d: DemoData, rows: readonly CalOffRow[]): DemoData {
  let out = d;
  for (const r of rows) {
    if (r.currentId !== null) out = removeAbsence(out, r.currentId);
    if (r.absence) out = saveAbsence(out, r.absence);
  }
  return out;
}

/** まとめの文（「カレンダー 10件を読みました。合う〈スタッフ〉8人」） */
export function calOffSummaryText(s: CalOffSummary, staffTerm: string): string {
  return `カレンダー ${s.calendars}件を読みました。${staffTerm}に合う ${s.matched.length}件`;
}

/** 主ボタンの文（変わる件数） */
export const calOffApplyLabel = (n: number): string => (n === 0 ? '変わる休みはありません' : `入れ替える（${n}件）`);

/** 入れ替えたあとの知らせ */
export const calOffDoneText = (rows: readonly CalOffRow[], care: number): string => {
  const n = (k: CalOffKind) => rows.filter((r) => r.kind === k).length;
  return `休みを入れ替えました（入れる ${n('add')}・直す ${n('change')}・外す ${n('remove')}）。要対応 ${care}件`;
};
