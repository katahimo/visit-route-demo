// 月の画面（pages/MonthPage.tsx）のための純粋関数：表示の選択（?staff= ?client=）・日ごとの集計・日ごとの一覧の行・
// その日の回の並び・範囲の AI で組む（担当を組む）の進み具合の文など。データは書き換えない（PRD D53〜D61・D69・D189・D256）
import type { ClientLeave, Visit } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { isOnLeave } from '../domain/leaves';
import { hhmmToMinutes } from '../domain/time';
import { clockTime, mdText } from './dateText';
import { isOn } from './features';
import { type ClientDay, type DayMarks, type DayPlan, type DayStatus, type StaffDay, shortName } from './month';
import type { BatchRun } from './monthBatch';
import { OFF_STATE_TEXT } from './monthCell';
import { type MonthListRow, monthListRow } from './monthList';
import { usualRestByWeekday } from './monthRest';
import { type OffDayState, REQUESTED_OFF_NOTE } from './requestedOff';
import { ymOf } from './ym';

/**
 * 月の画面で効く機能の入・切（ADR-0028）。print・workload：切ならその画面へ移る項目を出さない（PRD D213）。
 * requested（希望休のまとめ入力）：切なら「休みを入れる」の入力だけ出さない（希望休そのものは事実で効き、
 * 「休 N」の印も欠勤・最終勤務日の分を含む事実の表示なので出す）。sudden（欠勤・キャンセル）：切なら希望休を入れたときの
 * 知らせで「欠勤を直す」の入口を案内しない
 */
export function monthFeatures(f: Features): { print: boolean; requested: boolean; workload: boolean; sudden: boolean } {
  return {
    print: isOn(f, 'monthPrint'),
    requested: isOn(f, 'requestedOff'),
    workload: isOn(f, 'workload'),
    sudden: isOn(f, 'sudden'),
  };
}

/** 表示の選択：全体／〈スタッフ〉1人／〈利用者さん〉1人 */
export type MonthFocus = { kind: 'all' } | { kind: 'staff'; id: string } | { kind: 'client'; id: string };

/** URL の ?staff= ?client= から表示の選択を決める（稼働していない人・いない人は全体） */
export function monthFocusOf(
  staffParam: string | null,
  clientParam: string | null,
  activeStaff: readonly { id: string }[],
  activeClients: readonly { id: string }[],
): MonthFocus {
  if (staffParam && activeStaff.some((s) => s.id === staffParam)) return { kind: 'staff', id: staffParam };
  if (clientParam && activeClients.some((c) => c.id === clientParam)) return { kind: 'client', id: clientParam };
  return { kind: 'all' };
}

/** 表示の選ぶ欄の値（all・staff:ID・client。〈利用者さん〉は検索欄で選ぶので1つの値） */
export function monthFocusValue(clientMode: boolean, focus: MonthFocus): string {
  if (clientMode || focus.kind === 'client') return 'client';
  return focus.kind === 'all' ? 'all' : `${focus.kind}:${focus.id}`;
}

/**
 * 表示の選ぶ欄で選んだときの URL の変え方（null＝変えない）。〈利用者さん〉は検索欄で選ぶので、〈スタッフ〉の選択は外して
 * 全体の表示のまま待つ（すでに〈利用者さん〉を選んでいれば変えない）
 */
export function monthFocusPatch(value: string, current: MonthFocus['kind']): Record<string, string | null> | null {
  if (value === 'client') return current === 'client' ? null : { staff: null, client: null };
  const [kind, ...rest] = value.split(':');
  const id = rest.join(':');
  return { staff: kind === 'staff' ? id : null, client: kind === 'client' ? id : null };
}

/** 印刷の画面へのリンク（〈スタッフ〉を選んでいればその人の分） */
export function monthPrintHref(ym: string, focus: MonthFocus): string {
  return `/month/print?ym=${ym}${focus.kind === 'staff' ? `&staff=${encodeURIComponent(focus.id)}` : ''}`;
}

/**
 * 見出しの下の要約（月全体。今日より前の日も数える）：帯に無いものだけ（入らない訪問・当日キャンセル。PRD D154）
 */
export function monthSummary(
  days: readonly string[],
  statuses: ReadonlyMap<string, Pick<DayStatus, 'unassigned'>>,
  visitsByDate: ReadonlyMap<string, readonly Pick<Visit, 'cancelled' | 'cancelKind'>[]>,
): { unassigned: number; sameDay: number } {
  let unassigned = 0;
  for (const d of days) unassigned += statuses.get(d)?.unassigned ?? 0;
  // 当日キャンセル（ADR-0015）の回数
  let sameDay = 0;
  for (const d of days)
    for (const v of visitsByDate.get(d) ?? []) if (v.cancelled && v.cancelKind === 'sameDay') sameDay++;
  return { unassigned, sameDay };
}

/** この月に（取り消しでも〈利用者さん〉の休み（ADR-0013）でもない）訪問がある〈利用者さん〉 */
export function monthClientIds(
  days: readonly string[],
  visitsByDate: ReadonlyMap<string, readonly Visit[]>,
  clientLeaves: readonly ClientLeave[],
): Set<string> {
  const out = new Set<string>();
  for (const d of days)
    for (const v of visitsByDate.get(d) ?? []) if (!v.cancelled && !isOnLeave(clientLeaves, v)) out.add(v.clientId);
  return out;
}

/** この月の担当の並び（訪問の今の担当）の〈スタッフ〉と〈利用者さん〉の組（lib/search の staffClientMap へ） */
export function monthStaffClientPairs(
  days: readonly string[],
  dayPlans: ReadonlyMap<string, Pick<DayPlan, 'routes'>>,
  visitsByDate: ReadonlyMap<string, readonly Pick<Visit, 'id' | 'clientId'>[]>,
): [string, string | undefined][] {
  const clientOf = new Map([...visitsByDate.values()].flat().map((v) => [v.id, v.clientId]));
  const pairs: [string, string | undefined][] = [];
  for (const d of days)
    for (const [sid, ids] of Object.entries(dayPlans.get(d)?.routes ?? {}))
      for (const id of ids) pairs.push([sid, clientOf.get(id)]);
  return pairs;
}

/** 曜日ごとの「ふだん」の休みの人数（この月の日だけで数える。PRD D295） */
export function monthUsualRest(
  days: readonly string[],
  ym: string,
  marks: ReadonlyMap<string, Pick<DayMarks, 'off' | 'requested'>>,
): number[] {
  return usualRestByWeekday(
    days
      .filter((d) => ymOf(d) === ym)
      .map((d) => {
        const m = marks.get(d);
        return { date: d, resting: m ? m.off.length + m.requested.length : 0 };
      }),
  );
}

/** その日の回（表示の選択が〈スタッフ〉・〈利用者さん〉ならその人の回だけ。開始（無ければ開始（早））の順、同じなら ID の順） */
export function focusDayVisits(list: readonly Visit[], focus: MonthFocus): Visit[] {
  const mine = list.filter((v) =>
    focus.kind === 'staff' ? v.staffId === focus.id : focus.kind === 'client' ? v.clientId === focus.id : true,
  );
  const at = (v: Visit) => hhmmToMinutes(v.start ?? v.earliestStart);
  return [...mine].sort((a, b) => at(a) - at(b) || a.id.localeCompare(b.id));
}

/** 日ごとの選んだ訪問の件数（0件の日は入れない） */
export function selectedCountByDate(
  days: readonly string[],
  visitsByDate: ReadonlyMap<string, readonly Pick<Visit, 'id'>[]>,
  ids: readonly string[],
): Map<string, number> {
  const on = new Set(ids);
  const out = new Map<string, number>();
  for (const d of days) {
    const n = (visitsByDate.get(d) ?? []).filter((v) => on.has(v.id)).length;
    if (n > 0) out.set(d, n);
  }
  return out;
}

/** その日の回の一覧の行の時刻（「9:00〜10:00」。先頭の 0 は付けない） */
export function visitRowTime(v: Pick<Visit, 'start' | 'earliestStart' | 'durationMinutes'>): string {
  const at = hhmmToMinutes(v.start ?? v.earliestStart);
  return `${clockTime(at).replace(/^0/, '')}〜${clockTime(at + v.durationMinutes).replace(/^0/, '')}`;
}

/** その日の回の一覧の行の状態（取り消し・当日キャンセル・休みのため無し。ふつうは null） */
export function visitRowState(v: Pick<Visit, 'cancelled' | 'cancelKind'>, leave: boolean): string | null {
  if (v.cancelled) return v.cancelKind === 'sameDay' ? '当日キャンセル' : '取り消し';
  return leave ? '休みのため無し' : null;
}

/** 日ごとの一覧の1行と、行の下に出す補足（表示の選択・「休みを入れる」） */
export type MonthListEntry = { row: MonthListRow; extra: string[]; off: OffDayState | undefined };

/** 選んだ〈スタッフ〉のその日の補足（休み・欠勤・担当の件数） */
function staffExtra(x: StaffDay): string[] {
  const extra: string[] = [];
  if (x.retired) extra.push('最終勤務日の後');
  else if (x.absence) extra.push(x.requested ? REQUESTED_OFF_NOTE : '欠勤');
  else if (x.off) extra.push('休み');
  if (x.count > 0) extra.push(`担当 ${x.count}件`);
  return extra;
}

/** 選んだ〈利用者さん〉のその日の補足（「9:00 消防、14:00 取り消し」） */
function clientExtra(c: ClientDay, staffName: (id: string) => string): string {
  return c.visits
    .map(
      (v) =>
        `${clockTime(v.start)} ${
          v.cancelled
            ? '取り消し'
            : v.leave
              ? '休み'
              : v.staffId
                ? shortName(staffName(v.staffId))
                : v.unassigned
                  ? '入らない'
                  : '担当未定'
        }`,
    )
    .join('、');
}

/**
 * 日ごとの一覧の行（PRD D189）。表示の選択（〈スタッフ〉・〈利用者さん〉）と「休みを入れる」の補足は行の下に出す。
 * 日の状態が無い日は出さない
 */
export function monthListEntries(x: {
  days: readonly string[];
  statuses: ReadonlyMap<string, DayStatus>;
  today: string;
  focus: MonthFocus['kind'];
  staffDays: ReadonlyMap<string, StaffDay>;
  clientDays: ReadonlyMap<string, ClientDay>;
  staffName: (id: string) => string;
  offStateOf: (date: string) => OffDayState | undefined;
  attentionByDate: ReadonlyMap<string, number>;
  /** 確定（伝えた）の段階を出すか（省略は出す。lib/settledView） */
  confirmStep?: boolean;
}): MonthListEntry[] {
  const out: MonthListEntry[] = [];
  for (const d of x.days) {
    const s = x.statuses.get(d);
    if (!s) continue;
    const extra: string[] = [];
    const sd = x.staffDays.get(d);
    if (x.focus === 'staff' && sd) extra.push(...staffExtra(sd));
    const c = x.clientDays.get(d);
    if (x.focus === 'client' && c && c.visits.length > 0) extra.push(clientExtra(c, x.staffName));
    const off = x.offStateOf(d);
    if (off) extra.push(OFF_STATE_TEXT[off]);
    out.push({
      row: monthListRow(s, x.today, extra, {
        attention: x.attentionByDate.get(d) ?? 0,
        confirmStep: x.confirmStep,
      }),
      extra,
      off,
    });
  }
  return out;
}

/** 範囲の AI で組む（担当を組む）の進み具合の値（作っている日の番号＋その日の計算の進み） */
export function batchProgressValue(batch: Pick<BatchRun, 'index' | 'iteration' | 'total'>): number {
  return batch.index + (batch.total > 0 ? Math.min(1, batch.iteration / batch.total) : 0);
}

/**
 * 希望休を付け外ししたときの知らせ（PRD D69）。付けた日にその人の訪問があれば、自動で組み直す（rearrange。エキスパート機能が切。
 * ADR-0111）ならそう書き、組み直さないなら注意（日の予定で振り直す。欠勤・キャンセルの機能が入なら「欠勤を直す」を案内する）
 */
export function offNoteOf(x: {
  result: 'added' | 'removed';
  date: string;
  name: string;
  count: number;
  suddenOn: boolean;
  rearrange: boolean;
}): { date: string; text: string; warn: boolean } {
  if (x.result === 'removed')
    return { date: x.date, warn: false, text: `${mdText(x.date)} の${REQUESTED_OFF_NOTE}を外しました` };
  const n = x.count;
  const done = `${mdText(x.date)} を${REQUESTED_OFF_NOTE}にしました`;
  if (n === 0) return { date: x.date, warn: false, text: done };
  const has = `${done}。${x.name}さんにこの日の訪問が ${n}件あります。`;
  if (x.rearrange) return { date: x.date, warn: false, text: `${has}ほかの人に自動で組み直します` };
  return {
    date: x.date,
    warn: true,
    text: `${has}${x.suddenOn ? '日の予定のその人の列の「欠勤を直す」から振り直してください' : '日の予定で担当を振り直してください'}`,
  };
}

/** 2つの並びの要素が同じ（同じ物）か */
export const sameList = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);
