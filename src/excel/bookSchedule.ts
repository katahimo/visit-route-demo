// 全体のブックの、稼働時間・欠勤・種類・定期パターン・訪問・〈利用者さん〉の休みのシートを読む（importWorkbook から。ADR-0006）
import {
  type Absence,
  type Availability,
  type ClientLeave,
  MAX_VISIT_TYPES,
  type Pattern,
  type Visit,
  type VisitType,
} from '../contracts/documents';
import { slotsError } from '../domain/availability';
import { type BookCtx, clientId, staffId, typeId } from './bookContext';
import {
  absenceCols,
  availabilityCols,
  clientLeaveCols,
  PATTERN_EXTRA_COLS,
  patternCols,
  TYPE_COLS,
  VISIT_PIN_COL,
  VISIT_SAME_DAY_COL,
  VISIT_START_COL,
  type visitCols,
} from './layout';
import { idOf, personCols, type Row, readPerson, Sheet, sheetMsg, uniqueName } from './reader';
import {
  EVERY_WEEKS_LABELS,
  FIXED_SHEETS,
  lookup,
  MONTHLY_LABEL,
  nfkc,
  parseDayTimes,
  parseEveryWeeks,
  parseMonthWeeks,
  parseSlots,
  parseUsualStarts,
  parseWorkDays,
  WINDOW_LABELS,
} from './text';

/** 版1のブックの、繰り返しの担当の列の見出し（版2は「担当」） */
const LEGACY_PATTERN_STAFF_COL = 'いつもの担当';
/** 定期パターンの上限（contracts/data.ts の max） */
const MAX_PATTERNS = 2000;
/** 〈利用者さん〉の休みの上限（contracts/data.ts の max） */
const MAX_LEAVES = 2000;

/** 稼働時間のシート */
export function readAvailability(ctx: BookCtx, availSheet: Sheet): Availability[] {
  const ac = availabilityCols(ctx.terms);
  const availability: Availability[] = [];
  const availSeen = new Map<string, number>();
  for (const r of availSheet.rows()) {
    const sid = staffId(ctx, r, ac.staff, true);
    const date = r.date(ac.date);
    const text = r.text(ac.slots);
    const slots = text === '' ? null : parseSlots(text);
    if (slots === null) r.err(ac.slots, '時間帯は「9:00-12:00、13:00-18:00」の形か「休み」で書いてください');
    else {
      const bad = slots.some((s) => !/:[03]0$/.test(s.start) || !/:[03]0$/.test(s.end))
        ? '時間は30分単位で書いてください'
        : slotsError(slots);
      if (bad) r.err(ac.slots, bad);
      else if (sid && date) {
        const key = `${sid}\u0000${date}`;
        const before = availSeen.get(key);
        if (before !== undefined)
          r.err(ac.date, `同じ${ctx.terms.staff}・同じ日の行が ${before}行目にもあります（1日1行にしてください）`);
        else {
          availSeen.set(key, r.n);
          availability.push({ staffId: sid, date, slots });
        }
      }
    }
  }
  return availability;
}

/** 欠勤の開始・終了の時刻（空＝null。30分単位でなければエラーにして undefined） */
function halfHour(r: Row, h: string): string | null | undefined {
  if (r.text(h) === '') return null;
  const t = r.time(h, false);
  if (t === null) return undefined;
  if (!/:[03]0$/.test(t)) {
    r.err(h, '時間は30分単位で書いてください');
    return undefined;
  }
  return t;
}

/** 欠勤のシート（ADR-0011）。シートが無い古いブックは欠勤なし */
export function readAbsences(ctx: BookCtx): Absence[] {
  const absences: Absence[] = [];
  const absWs = ctx.wb.getWorksheet(FIXED_SHEETS.absences);
  if (!absWs) return absences;
  const sheet = new Sheet(FIXED_SHEETS.absences, absWs, ctx.errors);
  const bc = absenceCols(ctx.terms);
  if (!sheet.require(Object.values(bc))) return absences;
  const ids = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const r of sheet.rows()) {
    const id = idOf(r, bc.id, ids, 'a', ctx.used, 100);
    const sid = staffId(ctx, r, bc.staff, true);
    const date = r.date(bc.date);
    const from = halfHour(r, bc.from);
    const to = halfHour(r, bc.to);
    const note = r.optional(bc.note, 100);
    if (typeof from === 'string' && typeof to === 'string' && from >= to) {
      r.err(bc.to, '終了は開始より後にしてください');
      continue;
    }
    if (!sid || !date || from === undefined || to === undefined) continue;
    const key = `${sid}\u0000${date}`;
    const before = seen.get(key);
    if (before !== undefined) {
      r.err(bc.date, `同じ${ctx.terms.staff}・同じ日の行が ${before}行目にもあります（欠勤は1人1日1行にしてください）`);
      continue;
    }
    seen.set(key, r.n);
    absences.push({ id, staffId: sid, date, from, to, note });
  }
  return absences;
}

/** 種類のシート（ADR-0012）。シートが無い古いブックは種類なし。名前 → ID を ctx.typeByName に足し、ctx.hasTypes を決める */
export function readVisitTypes(ctx: BookCtx): VisitType[] {
  const visitTypes: VisitType[] = [];
  const typeWs = ctx.wb.getWorksheet(FIXED_SHEETS.visitTypes);
  ctx.hasTypes = typeWs !== undefined;
  if (!typeWs) return visitTypes;
  const sheet = new Sheet(FIXED_SHEETS.visitTypes, typeWs, ctx.errors);
  const C = TYPE_COLS;
  if (!sheet.require(Object.values(C))) return visitTypes;
  const cols = personCols(sheet, ctx.items, 'client', Object.values(C), ['reqs']);
  const rows = sheet.rows();
  if (rows.length > MAX_VISIT_TYPES)
    ctx.errors.add(sheetMsg(FIXED_SHEETS.visitTypes, `種類は${MAX_VISIT_TYPES}行までです（いま${rows.length}行）`));
  const ids = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const r of rows) {
    const id = idOf(r, C.id, ids, 't', ctx.used, 100);
    const name = r.required(C.name, 20);
    if (name !== null) {
      uniqueName(r, C.name, name, seen);
      ctx.typeByName.set(name, id);
    }
    const color = r.num(C.color, { int: true, min: 1, max: 8, required: true });
    const duration = r.num(C.duration, { int: true, min: 5, max: 720, required: true });
    const note = r.optional(C.note, 200);
    const { requirements } = readPerson(r, cols);
    if (name !== null && typeof color === 'number' && typeof duration === 'number')
      visitTypes.push({ id, name, color: color - 1, durationMinutes: duration, requirements, note });
  }
  return visitTypes;
}

type PatternColumns = ReturnType<typeof patternCols>;

/** 定期パターンの間隔（「毎月」なら第何週も。ADR-0013）。読めなければ everyWeeks・monthWeeks が null */
function readPatternEvery(
  r: Row,
  pc: PatternColumns,
): { monthly: boolean; everyWeeks: number | null; monthWeeks: number[] | null } {
  const eText = r.required(pc.every);
  // 間隔「毎月」（ADR-0013）は第N週の列で第何週かを読む（列が無い古いブックは毎週系だけ）
  const monthly = eText !== null && nfkc(eText).replace(/\s/g, '') === MONTHLY_LABEL;
  const everyWeeks = eText === null ? null : monthly ? 1 : parseEveryWeeks(eText);
  if (eText !== null && everyWeeks === null)
    r.err(
      pc.every,
      `「${[...Object.values(EVERY_WEEKS_LABELS), MONTHLY_LABEL].join('」「')}」のどれかで書いてください`,
    );
  const mText = r.text(PATTERN_EXTRA_COLS.monthWeeks);
  let monthWeeks: number[] | null = [];
  if (monthly) {
    monthWeeks = mText === '' ? null : parseMonthWeeks(mText);
    if (monthWeeks === null)
      r.err(PATTERN_EXTRA_COLS.monthWeeks, '間隔が「毎月」のときは、第何週かを「3、4」のように 1〜5 で書いてください');
  }
  return { monthly, everyWeeks, monthWeeks };
}

/**
 * 曜日ごとの時刻（ADR-0013）・標準の開始（ADR-0062）の列。読めなければそれぞれ null。
 * 曜日ごとの時刻：列が無い・空なら上書きなし。ちょうどの時刻は開始（遅）＝開始（早）。
 * 標準の開始：列が無い・空ならなし（usualStarts を付けない＝undefined）
 */
function readPatternDayCols(
  r: Row,
  weekdays: number[] | null,
  windowKind: Pattern['windowKind'] | null,
): { dayTimes: Pattern['dayTimes'] | null; usualStarts: Pattern['usualStarts'] | null } {
  const dtText = r.text(PATTERN_EXTRA_COLS.dayTimes);
  const dtParsed = dtText === '' ? [] : parseDayTimes(dtText);
  let dayTimes: Pattern['dayTimes'] | null = null;
  if (typeof dtParsed === 'string') r.err(PATTERN_EXTRA_COLS.dayTimes, dtParsed);
  else if (weekdays && dtParsed.some((t) => !weekdays.includes(t.weekday)))
    r.err(PATTERN_EXTRA_COLS.dayTimes, '「曜日」の列に無い曜日の時刻があります');
  else dayTimes = dtParsed.map((t) => (windowKind === 'fixed' ? { ...t, latestStart: t.earliestStart } : t));
  const usText = r.text(PATTERN_EXTRA_COLS.usualStarts);
  const usParsed = usText === '' ? [] : parseUsualStarts(usText);
  let usualStarts: Pattern['usualStarts'] | null = null;
  if (typeof usParsed === 'string') r.err(PATTERN_EXTRA_COLS.usualStarts, usParsed);
  else if (weekdays && usParsed.some((t) => !weekdays.includes(t.weekday)))
    r.err(PATTERN_EXTRA_COLS.usualStarts, '「曜日」の列に無い曜日の標準の開始があります');
  else usualStarts = usParsed.length > 0 ? usParsed : undefined;
  return { dayTimes, usualStarts };
}

/** 定期パターンの1行（読めなければエラーを積んで null） */
function readPatternRow(ctx: BookCtx, r: Row, pc: PatternColumns, id: string): Pattern | null {
  const cid = clientId(ctx, r, pc.client);
  const tid = typeId(ctx, r, pc.type);
  const wText = r.text(pc.weekdays);
  const parsedDays = parseWorkDays(wText);
  const weekdays = parsedDays === null ? null : [...parsedDays].sort((a, b) => a - b);
  if (wText === '' || weekdays === null || weekdays.length === 0) {
    r.err(pc.weekdays, '曜日は「月木」のように1つ以上書いてください');
  }
  const { monthly, everyWeeks, monthWeeks } = readPatternEvery(r, pc);
  const kText = r.required(pc.windowKind);
  const windowKind = kText === null ? null : lookup(WINDOW_LABELS, kText);
  if (kText !== null && windowKind === null) r.err(pc.windowKind, '「ちょうど」か「幅」で書いてください');
  const earliestStart = r.time(pc.earliest);
  const latestRaw = r.time(pc.latest, windowKind !== 'fixed');
  const latestStart = latestRaw ?? (windowKind === 'fixed' ? earliestStart : null);
  let timesOk = true;
  if (earliestStart && latestStart && latestStart < earliestStart) {
    r.err(pc.latest, '開始（遅）は開始（早）以降にしてください');
    timesOk = false;
  }
  const duration = r.num(pc.duration, { int: true, min: 5, max: 720, required: true });
  const from = r.date(pc.from);
  const to = r.text(pc.to) === '' ? null : r.date(pc.to);
  let datesOk = true;
  if (from && to && to < from) {
    r.err(pc.to, '終了日は開始日以降にしてください');
    datesOk = false;
  }
  const sid = staffId(ctx, r, pc.usualStaff, false);
  const note = r.optional(pc.note, 200);
  const { dayTimes, usualStarts } = readPatternDayCols(r, weekdays, windowKind);
  if (
    !(
      cid &&
      tid !== undefined &&
      weekdays &&
      weekdays.length > 0 &&
      everyWeeks &&
      windowKind &&
      earliestStart &&
      latestStart &&
      timesOk &&
      typeof duration === 'number' &&
      from &&
      (r.text(pc.to) === '' || to) &&
      datesOk &&
      sid !== undefined &&
      monthWeeks !== null &&
      dayTimes !== null &&
      usualStarts !== null
    )
  )
    return null;
  return {
    id,
    clientId: cid,
    typeId: tid,
    weekdays,
    everyWeeks,
    repeat: monthly ? 'monthly' : 'weekly',
    monthWeeks,
    dayTimes,
    windowKind,
    earliestStart,
    latestStart,
    durationMinutes: duration,
    from,
    to,
    usualStaffId: sid,
    ...(usualStarts ? { usualStarts } : {}),
    note,
  };
}

/** 定期パターンのシート（ADR-0012）。シートが無い古いブックはパターンなし。ctx.hasPatterns・ctx.patternIds を決める */
export function readPatterns(ctx: BookCtx): Pattern[] {
  const patterns: Pattern[] = [];
  const patternWs = ctx.wb.getWorksheet(FIXED_SHEETS.patterns);
  ctx.hasPatterns = patternWs !== undefined;
  if (!patternWs) return patterns;
  const sheet = new Sheet(FIXED_SHEETS.patterns, patternWs, ctx.errors);
  const pc0 = patternCols(ctx.terms);
  // 版1のブックは繰り返しの担当の列が「いつもの担当」（ADR-0053）。あればそれを担当の列として読む
  const pc =
    !sheet.has(pc0.usualStaff) && sheet.has(LEGACY_PATTERN_STAFF_COL)
      ? { ...pc0, usualStaff: LEGACY_PATTERN_STAFF_COL }
      : pc0;
  if (!sheet.require(Object.values(pc))) return patterns;
  const rows = sheet.rows();
  if (rows.length > MAX_PATTERNS)
    ctx.errors.add(sheetMsg(FIXED_SHEETS.patterns, `定期パターンは${MAX_PATTERNS}行までです（いま${rows.length}行）`));
  const ids = new Map<string, number>();
  for (const r of rows) {
    const id = idOf(r, pc.id, ids, 'pt', ctx.used, 100);
    ctx.patternIds.add(id);
    const p = readPatternRow(ctx, r, pc, id);
    if (p) patterns.push(p);
  }
  return patterns;
}

type VisitColumns = ReturnType<typeof visitCols>;

/** 訪問の定期パターン・元の日・この回だけ変更（パターンが空なら単発。読めなければエラーにして undefined） */
function visitPattern(ctx: BookCtx, r: Row, c: VisitColumns): Visit['pattern'] | undefined {
  const pid = r.text(c.pattern);
  if (pid === '') {
    if (r.text(c.patternDate) !== '' || r.yes(c.edited)) {
      r.err(c.pattern, `単発の訪問（${c.pattern}が空）では、${c.patternDate}・${c.edited}は空にしてください`);
      return undefined;
    }
    return null;
  }
  const date = r.date(c.patternDate);
  const edited = r.yes(c.edited);
  if (!ctx.patternIds.has(pid)) {
    r.err(c.pattern, `ID「${pid}」の定期パターンは、シート『${FIXED_SHEETS.patterns}』にありません`);
    return undefined;
  }
  return date ? { id: pid, date, edited } : undefined;
}

/** 訪問の1行（読めなければエラーを積んで null） */
function readVisitRow(ctx: BookCtx, r: Row, vc: VisitColumns, id: string): Visit | null {
  const date = r.date(vc.date);
  const cid = clientId(ctx, r, vc.client);
  const kText = r.required(vc.windowKind);
  const windowKind = kText === null ? null : lookup(WINDOW_LABELS, kText);
  if (kText !== null && windowKind === null) r.err(vc.windowKind, '「ちょうど」か「幅」で書いてください');
  const earliestStart = r.time(vc.earliest);
  const latestRaw = r.time(vc.latest, windowKind !== 'fixed');
  const latestStart = latestRaw ?? (windowKind === 'fixed' ? earliestStart : null);
  if (earliestStart && latestStart && latestStart < earliestStart)
    r.err(vc.latest, '開始（遅）は開始（早）と同じか後にしてください');
  const duration = r.num(vc.duration, { int: true, min: 5, max: 720, required: true });
  const sid = staffId(ctx, r, vc.staff, false);
  const cancelled = r.yes(vc.cancelled);
  // 当日キャンセル（ADR-0015）：列が無い古いブックはふつうの取り消し。取り消していない訪問に ○ は止める
  const sameDay = r.yes(VISIT_SAME_DAY_COL);
  if (sameDay && !cancelled) r.err(VISIT_SAME_DAY_COL, `「${vc.cancelled}」に ○ の無い訪問には付けられません`);
  const note = r.optional(vc.note, 200);
  // 組んだ開始・ピン（版2。ADR-0053）：列が無いブックは開始（早）の順・ピンなし
  const start = r.text(VISIT_START_COL) === '' ? null : r.time(VISIT_START_COL);
  const pinned = r.yes(VISIT_PIN_COL);
  // 種類・定期パターン（ADR-0012）。シートが無い古いブックは空
  const tid = ctx.hasTypes ? typeId(ctx, r, vc.type) : null;
  const pattern = ctx.hasPatterns ? visitPattern(ctx, r, vc) : null;
  // パターンの訪問の ID は「元の日_パターンID」（ADR-0012。違うと展開で同じ回が二重になる。空の ID も止める）
  if (pattern && r.text(vc.id) !== `${pattern.date}_${pattern.id}`)
    r.err(vc.id, `定期パターンの訪問の ID は「${pattern.date}_${pattern.id}」（元の日_パターンID）にしてください`);
  if (
    !(
      date &&
      cid &&
      windowKind &&
      earliestStart &&
      latestStart &&
      typeof duration === 'number' &&
      sid !== undefined &&
      start !== undefined &&
      tid !== undefined &&
      pattern !== undefined
    )
  )
    return null;
  return {
    id,
    date,
    clientId: cid,
    windowKind,
    earliestStart,
    latestStart,
    durationMinutes: duration,
    staffId: sid,
    start: sid === null ? null : start,
    pinned: sid !== null && pinned,
    cancelled,
    note,
    typeId: tid,
    pattern,
    cancelKind: cancelled && sameDay ? 'sameDay' : null,
  };
}

/** 訪問のシート */
export function readVisits(ctx: BookCtx, visitSheet: Sheet, vc: VisitColumns): Visit[] {
  const visits: Visit[] = [];
  const ids = new Map<string, number>();
  for (const r of visitSheet.rows()) {
    const id = idOf(r, vc.id, ids, 'v', ctx.used, 100);
    const v = readVisitRow(ctx, r, vc, id);
    if (v) visits.push(v);
  }
  return visits;
}

/** 〈利用者さん〉の休みのシート（ADR-0013）。シートが無い古いブックは休みなし */
export function readClientLeaves(ctx: BookCtx): ClientLeave[] {
  const clientLeaves: ClientLeave[] = [];
  const leaveWs = ctx.wb.getWorksheet(FIXED_SHEETS.clientLeaves);
  if (!leaveWs) return clientLeaves;
  const sheet = new Sheet(FIXED_SHEETS.clientLeaves, leaveWs, ctx.errors);
  const lc = clientLeaveCols(ctx.terms);
  if (!sheet.require(Object.values(lc))) return clientLeaves;
  const rows = sheet.rows();
  if (rows.length > MAX_LEAVES)
    ctx.errors.add(sheetMsg(FIXED_SHEETS.clientLeaves, `休みは${MAX_LEAVES}行までです（いま${rows.length}行）`));
  const ids = new Map<string, number>();
  for (const r of rows) {
    const id = idOf(r, lc.id, ids, 'l', ctx.used, 100);
    const cid = clientId(ctx, r, lc.client);
    const from = r.date(lc.from);
    const to = r.date(lc.to);
    const note = r.optional(lc.note, 100);
    if (from && to && to < from) {
      r.err(lc.to, '終了日は開始日以降にしてください');
      continue;
    }
    if (cid && from && to) clientLeaves.push({ id, clientId: cid, from, to, note });
  }
  return clientLeaves;
}
