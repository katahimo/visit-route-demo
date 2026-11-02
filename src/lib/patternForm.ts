// 〈利用者さん〉の繰り返し（定期パターン。ADR-0012・0013・0062）の入力欄の中身：パターンから欄を作る・欄を確かめてパターンにする
import type { DemoData } from '../contracts/data';
import { type Pattern, patternSchema, type VisitType } from '../contracts/documents';
import type { PatternChange } from '../contracts/patterns';
import { hhmmToMinutes, minutesToHhmm } from '../domain/time';
import { timesOn } from '../patterns';
import { newId, WEEKDAY_LABELS } from './common';
import { EVERY_WEEKS_LABELS } from './patternText';

/** 繰り返しの入力欄（足す・直す） */
export type PatternForm = {
  /** 直すパターン（null は足す） */
  id: string | null;
  typeId: string;
  weekdays: number[];
  everyWeeks: number;
  /** 繰り返し方（ADR-0013） */
  repeat: Pattern['repeat'];
  /** 毎月の第N（1〜5） */
  monthWeeks: number[];
  /** 曜日ごとに時刻を変える */
  perDay: boolean;
  /** 曜日 → 開始（早・遅）。perDay のとき、選んだ曜日のうち入れたものだけを使う */
  dayTimes: Record<number, { earliestStart: string; latestStart: string }>;
  /** 曜日 → 標準の開始（ADR-0062。空＝なし）。選んだ曜日のうち入れたものだけを使う */
  usualStarts: Record<number, string>;
  windowKind: Pattern['windowKind'];
  earliestStart: string;
  latestStart: string;
  durationMinutes: string;
  /** 開始日（足すとき） */
  from: string;
  /** いつから変えるか（直すとき） */
  since: string;
  to: string;
  usualStaffId: string;
  note: string;
};

/** 入力欄の初めの値（p が null なら足す欄） */
export const patternFormOf = (p: Pattern | null, today: string, defaultDuration: number): PatternForm =>
  p
    ? {
        id: p.id,
        typeId: p.typeId ?? '',
        weekdays: [...p.weekdays],
        everyWeeks: p.everyWeeks,
        repeat: p.repeat,
        monthWeeks: [...p.monthWeeks],
        perDay: p.dayTimes.length > 0,
        dayTimes: Object.fromEntries(
          p.dayTimes.map((t) => [t.weekday, { earliestStart: t.earliestStart, latestStart: t.latestStart }]),
        ),
        usualStarts: Object.fromEntries((p.usualStarts ?? []).map((u) => [u.weekday, u.start])),
        windowKind: p.windowKind,
        earliestStart: p.earliestStart,
        latestStart: p.latestStart,
        durationMinutes: String(p.durationMinutes),
        from: p.from,
        since: today,
        to: p.to ?? '',
        usualStaffId: p.usualStaffId ?? '',
        note: p.note,
      }
    : {
        id: null,
        typeId: '',
        weekdays: [],
        everyWeeks: 1,
        repeat: 'weekly',
        monthWeeks: [],
        perDay: false,
        dayTimes: {},
        usualStarts: {},
        windowKind: 'fixed',
        earliestStart: '10:00',
        latestStart: '10:00',
        durationMinutes: String(defaultDuration),
        from: today,
        since: today,
        to: '',
        usualStaffId: '',
        note: '',
      };

/** くり返しの選択肢（1つの選択。ADR-0083）：'1'〜'4'＝毎週〜4週ごと（repeat 'weekly' と everyWeeks）、'monthly'＝毎月の第N（monthWeeks） */
export type RepeatChoice = '1' | '2' | '3' | '4' | 'monthly';

/** くり返しの選択肢の並び（monthly は毎月の第N の機能 patternMonthly が入のときだけ出す） */
export const repeatChoices = (monthlyOn: boolean): RepeatChoice[] =>
  monthlyOn ? ['1', '2', '3', '4', 'monthly'] : ['1', '2', '3', '4'];

/** 選択肢の呼び方（毎週・隔週・3週ごと・4週ごと・毎月（第N）） */
export function repeatChoiceLabel(c: RepeatChoice): string {
  switch (c) {
    case 'monthly':
      return '毎月（第N）';
    case '1':
    case '2':
    case '3':
    case '4':
      return EVERY_WEEKS_LABELS[Number(c)] ?? `${c}週ごと`;
    default: {
      const _: never = c;
      return _;
    }
  }
}

/** 欄の値 → 選択肢（毎週系で 1〜4 の外の間隔は毎週に寄せる） */
export function repeatChoiceOf(f: Pick<PatternForm, 'repeat' | 'everyWeeks'>): RepeatChoice {
  if (f.repeat === 'monthly') return 'monthly';
  return f.everyWeeks === 2 || f.everyWeeks === 3 || f.everyWeeks === 4 ? (String(f.everyWeeks) as RepeatChoice) : '1';
}

/** 選択肢 → 欄の値（毎月は repeat だけを変え、間隔と第N は残す。毎週系は repeat 'weekly' と everyWeeks） */
export function withRepeatChoice<F extends Pick<PatternForm, 'repeat' | 'everyWeeks'>>(f: F, c: RepeatChoice): F {
  return c === 'monthly' ? { ...f, repeat: 'monthly' } : { ...f, repeat: 'weekly', everyWeeks: Number(c) };
}

/** 文字の値が選択肢か（select の値を受けるとき） */
export const isRepeatChoice = (v: string): v is RepeatChoice =>
  v === '1' || v === '2' || v === '3' || v === '4' || v === 'monthly';

/** 数の並びに入れる・外す（小さい順にそろえる。曜日・第N のチップ） */
export const toggleNumber = (list: readonly number[], n: number): number[] =>
  (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]).sort((a, b) => a - b);

/** 第N の誤りの文（毎月で第N を選んでいない。足す・直す欄と「予定を入れる」で同じ） */
export const MONTH_WEEKS_ERROR = '第何週かを1つ以上選んでください';

/** 選んだ曜日（日曜はじまりの順） */
export const sortedWeekdays = (f: Pick<PatternForm, 'weekdays'>): number[] => [...f.weekdays].sort((a, b) => a - b);

/** 曜日ごとの時刻（ADR-0013）：選んだ曜日のうち時刻を入れたものだけ。ちょうどなら開始（遅）＝開始（早） */
function dayTimesOf(f: PatternForm): Pattern['dayTimes'] {
  if (!f.perDay) return [];
  return sortedWeekdays(f).flatMap((w) => {
    const t = f.dayTimes[w];
    if (!t?.earliestStart) return [];
    // 幅のパターンで開始（遅）が空なら、共通の時刻の幅（開始（遅）− 開始（早））を保った時刻にする
    const width = Math.max(0, hhmmToMinutes(f.latestStart) - hhmmToMinutes(f.earliestStart));
    const l =
      f.windowKind === 'fixed'
        ? t.earliestStart
        : t.latestStart || minutesToHhmm(Math.min(hhmmToMinutes(t.earliestStart) + width, 23 * 60 + 59));
    return [{ weekday: w, earliestStart: t.earliestStart, latestStart: l }];
  });
}

/**
 * 入力を確かめてパターンの中身にする（だめなら理由の文）。from は開始日（直すときは分けたあとの開始日）。
 * 種類は今ある種類のときだけ入れる。足すときの ID はここで作る
 */
export function parsePatternForm(
  f: PatternForm,
  from: string,
  clientId: string,
  visitTypes: readonly Pick<VisitType, 'id'>[],
): Pattern | string {
  if (f.weekdays.length === 0) return '曜日を1つ以上選んでください';
  if (f.repeat === 'monthly' && f.monthWeeks.length === 0) return MONTH_WEEKS_ERROR;
  const latest = f.windowKind === 'fixed' ? f.earliestStart : f.latestStart;
  if (f.earliestStart > latest) return '開始（遅）は開始（早）以降にしてください';
  const dayTimes = dayTimesOf(f);
  const badDay = dayTimes.find((t) => t.earliestStart > t.latestStart);
  if (badDay) return `${WEEKDAY_LABELS[badDay.weekday]}曜の開始（遅）は開始（早）以降にしてください`;
  // 曜日ごとの標準の開始（ADR-0062）：選んだ曜日のうち入れたものだけ。その曜日の時間の約束（開始（早）〜（遅））の中
  const usualStarts: { weekday: number; start: string }[] = [];
  for (const w of sortedWeekdays(f)) {
    const start = f.usualStarts[w];
    if (!start) continue;
    const tw = timesOn({ earliestStart: f.earliestStart, latestStart: latest, dayTimes }, w);
    if (start < tw.earliestStart || start > tw.latestStart)
      return `${WEEKDAY_LABELS[w]}曜の標準の開始は、開始（${tw.earliestStart}〜${tw.latestStart}）の間にしてください`;
    usualStarts.push({ weekday: w, start });
  }
  if (f.to && f.to < from) return f.id ? '終了日は「いつから」以降にしてください' : '終了日は開始日以降にしてください';
  const r = patternSchema.safeParse({
    id: f.id ?? newId('pt'),
    clientId,
    typeId: f.typeId && visitTypes.some((t) => t.id === f.typeId) ? f.typeId : null,
    weekdays: sortedWeekdays(f),
    everyWeeks: f.repeat === 'monthly' ? 1 : f.everyWeeks,
    repeat: f.repeat,
    monthWeeks: f.repeat === 'monthly' ? [...f.monthWeeks].sort((a, b) => a - b) : [],
    dayTimes,
    windowKind: f.windowKind,
    earliestStart: f.earliestStart,
    latestStart: latest,
    durationMinutes: Number(f.durationMinutes),
    from,
    to: f.to || null,
    usualStaffId: f.usualStaffId || null,
    ...(usualStarts.length > 0 ? { usualStarts } : {}),
    note: f.note,
  });
  if (!r.success) {
    const where = r.error.issues[0]?.path[0];
    if (where === 'durationMinutes') return '所要は5〜720分で入れてください';
    if (where === 'from' || where === 'to') return '日付を正しく入れてください';
    if (where === 'earliestStart' || where === 'latestStart' || where === 'dayTimes' || where === 'usualStarts')
      return '時刻を正しく入れてください';
    return r.error.issues[0]?.message ?? '入力を確かめてください';
  }
  return r.data;
}

/** 「いつから変えますか」の誤り（よければ null）。今日より前の回は変えない */
export function patternSinceError(since: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return '「いつから変えますか」に日付を入れてください';
  if (since < today) return '「いつから変えますか」は今日以降にしてください（今日より前の回は変えません）';
  return null;
}

/** 終わらせる欄の既定の最後の日：終わっていればその日、まだ始まっていなければ開始日、ほかは今日 */
export const patternEndDefault = (p: Pick<Pattern, 'from' | 'to'>, today: string): string =>
  p.to !== null && p.to < today ? p.to : p.from > today ? p.from : today;

/** 確定した（伝えた）日のうち、since 以降でその繰り返しの回がある日の数（変えると「未連絡の変更」になる） */
export function patternConfirmedDays(
  d: Pick<DemoData, 'snapshots'>,
  patternId: string,
  since: string,
  c?: Pick<PatternChange, 'removed'>,
): number {
  const removed = new Set(c?.removed.map((x) => x.date) ?? []);
  return Object.values(d.snapshots).filter(
    (s) => s.date >= since && (removed.has(s.date) || s.visits.some((x) => x.id === `${s.date}_${patternId}`)),
  ).length;
}
