// 空き状況の仮押さえ（PRD D45〜D47。ADR-0012）の純粋関数：曜日と開始時刻を選び、〈利用者さん〉（仮）と定期パターンを入れた DemoData を作る。
// データを書き換えるのは store（画面は update(fn) で holdData を通す）
import type { DemoData } from '../contracts/data';
import { type Client, type Pattern, patternSchema } from '../contracts/documents';
import type { VacancyResult } from '../contracts/vacancy';
import { addDays, hhmmToMinutes, minutesToHhmm } from '../domain/time';
import { visitsIn } from '../patterns';
import { verdictOf } from '../vacancy';
import { newId, WEEKDAY_ORDER } from './common';
import { insertAllIntoPlans } from './weekOps';

/** 仮押さえで担当を入れる日数（今日から。それより後の回は繰り返しの担当で出る） */
export const HOLD_DAYS = 28;

export type HoldSlot = { weekday: number; start: number };

/** 仮押さえで作る定期パターンの曜日と開始時刻（選んだ曜日（無ければ全曜日）のうち ○ のある曜日の最初の ○。月〜日の順に週の回数まで） */
export function holdSlots(
  result: VacancyResult,
  weekdays: number[],
  from: string,
  to: string,
  perWeek: number,
): HoldSlot[] {
  const days = weekdays.length > 0 ? WEEKDAY_ORDER.filter((w) => weekdays.includes(w)) : WEEKDAY_ORDER;
  const lo = hhmmToMinutes(from);
  const hi = hhmmToMinutes(to);
  const out: HoldSlot[] = [];
  for (const wd of days) {
    const first = result.cells
      .filter((c) => c.weekday === wd && c.start >= lo && c.start <= hi && verdictOf(c) === 'ok')
      .sort((a, b) => a.start - b.start)[0];
    if (first) out.push({ weekday: wd, start: first.start });
  }
  return out.length >= perWeek ? out.slice(0, perWeek) : [];
}

/** 仮押さえの定期パターン（毎週・開始時刻の固定。曜日ごとに1つ）。契約の形に合わないものがあれば null */
export function holdPatterns(
  clientId: string,
  slots: readonly HoldSlot[],
  opts: { typeId: string | null; durationMinutes: number; from: string },
): Pattern[] | null {
  const patterns: Pattern[] = [];
  for (const s of slots) {
    const r = patternSchema.safeParse({
      id: newId('pt'),
      clientId,
      typeId: opts.typeId,
      weekdays: [s.weekday],
      everyWeeks: 1,
      windowKind: 'fixed',
      earliestStart: minutesToHhmm(s.start),
      latestStart: minutesToHhmm(s.start),
      durationMinutes: opts.durationMinutes,
      from: opts.from,
      to: null,
      usualStaffId: null,
      note: '',
    });
    if (!r.success) return null;
    patterns.push(r.data);
  }
  return patterns;
}

export type HoldResult = {
  data: DemoData;
  /** 今日から HOLD_DAYS 日の、足した回の数 */
  added: number;
  /** 空き時間に入れた回の数 */
  inserted: number;
  /** 空き時間に入らなかった日（日付の順・重複なし） */
  failedDates: string[];
};

/**
 * 仮押さえの DemoData：〈利用者さん〉（仮）と定期パターンを足し、今日から4週の回を空き時間に入れてピン（lib/weekOps の insertAllIntoPlans。
 * 入らない日は failedDates）。いちばん多く入った人を繰り返しの担当にする（版2。それより後の回はその担当で出る）
 */
export function holdData(d: DemoData, client: Client, patterns: readonly Pattern[], today: string): HoldResult {
  const clients = [...d.clients, client];
  const next = { ...d, clients, patterns: [...d.patterns, ...patterns] };
  const ids = new Set(patterns.map((p) => p.id));
  const added = visitsIn(next, { from: today, to: addDays(today, HOLD_DAYS - 1) })
    .filter((v) => v.pattern && ids.has(v.pattern.id))
    .map((v) => ({ visitId: v.id, date: v.date }));
  const r = insertAllIntoPlans(next, added);
  const count = new Map<string, Map<string, number>>();
  for (const v of r.data.visits) {
    if (!v.pattern || !ids.has(v.pattern.id) || !v.staffId) continue;
    const m = count.get(v.pattern.id) ?? new Map<string, number>();
    m.set(v.staffId, (m.get(v.staffId) ?? 0) + 1);
    count.set(v.pattern.id, m);
  }
  const best = (pid: string) => {
    const m = count.get(pid);
    if (!m) return null;
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  };
  const out = {
    ...r.data,
    patterns: r.data.patterns.map((p) => (ids.has(p.id) ? { ...p, usualStaffId: best(p.id) } : p)),
  };
  return { added: added.length, ...r, data: out };
}
