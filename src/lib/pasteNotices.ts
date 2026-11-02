// 連絡を貼り付けて入れる（PRD D418。ADR-0084）の読み：貼った文を1行ずつ決まりで読み、欠勤・訪問の取り消し・〈利用者さん〉の休みにする。
// AI・OCR は使わない（データを外へ送らない）。読むのは 日付（12/3・12月3日・2026/12/3・3日）・名前（名前・姓・よみ。様・さんは無視）・
// 言葉（休み・中止・入院など）・時間帯（午前・午後・〇時から・〇時まで・時刻〜時刻）・休みの期間（〜12/10）。
// データの状態（すでに入っている・訪問が無い・機能が切）は lib/pasteRows が見る。どれも純粋関数（データを書き換えない）
import type { Client, Staff } from '../contracts/documents';
import { familyName } from './contacts';
import { isDate } from './isDate';
import { REQUESTED_OFF_NOTE } from './requestedOff';
import { normalizeKana } from './search';

/** 読んだ結果の操作：その日の欠勤／その日の訪問の取り消し／〈利用者さん〉の休み */
export type NoticeAction =
  | { kind: 'absence'; staffId: string; date: string; from: string | null; to: string | null; note: string }
  | { kind: 'cancel'; clientId: string; date: string }
  | { kind: 'leave'; clientId: string; from: string; to: string; note: string };

/** 1行の読み：読めれば action と名前、読めなければ reason */
export type NoticeRead = { line: string; name: string; action: NoticeAction | null; reason: string | null };

/** 読めない理由（データを見ずに分かるもの） */
export const READ_REASONS = {
  noDate: '日付が無い',
  badDate: '日付が読めない',
  twoDates: '日付が2つある',
  noEnd: '終わりの日が無い',
  noName: '名前が見つからない',
  sameName: '同じ名前が2人',
  twoNames: '名前が2つある',
  noWord: '休み・中止などの言葉が無い',
  badTime: '時刻が読めない',
  past: '過ぎた日',
} as const;

/** 名前を当てる相手（〈スタッフ〉・〈利用者さん〉）。keys は比べる形（normalizeKana）の 名前・姓・よみ・よみの姓 */
export type NoticePerson = { kind: 'staff' | 'client'; id: string; name: string; keys: string[] };

/** 名前を当てる相手の一覧：利用中の〈スタッフ〉と、利用中の〈利用者さん〉（名前・姓・よみ・よみの姓） */
export function noticePeople(
  staff: readonly Pick<Staff, 'id' | 'name' | 'active'>[],
  clients: readonly Pick<Client, 'id' | 'displayName' | 'kana' | 'active'>[],
): NoticePerson[] {
  const keysOf = (names: string[]) => [
    ...new Set(names.flatMap((n) => [normalizeKana(n), normalizeKana(familyName(n))]).filter((k) => k !== '')),
  ];
  return [
    ...staff
      .filter((s) => s.active)
      .map((s) => ({ kind: 'staff' as const, id: s.id, name: s.name, keys: keysOf([s.name]) })),
    ...clients
      .filter((c) => c.active)
      .map((c) => ({
        kind: 'client' as const,
        id: c.id,
        name: c.displayName,
        keys: keysOf(c.kana.trim() === '' ? [c.displayName] : [c.displayName, c.kana]),
      })),
  ];
}

// ---- 日付 ----

/** 日付の形：2026/12/3・2026年12月3日・2026-12-03 ／ 12/3・12月3日 ／ 3日 */
const DATE_RE = /(\d{4})[/年.-](\d{1,2})[/月.-](\d{1,2})日?|(\d{1,2})[/月](\d{1,2})日?|(?<![\d/月])(\d{1,2})日/g;
/** 日付のあとの曜日（(水)・(水曜)・(水曜日)） */
const WEEKDAY_RE = /\(\s*[日月火水木金土](曜日?)?\s*\)/g;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** 読んだ日付（年・月が無いものは null。end：前に「〜」があるか、あとに「まで」がある＝期間の終わり） */
type DateHit = { y: number | null; m: number | null; d: number; end: boolean; start: number; length: number };

/** 行の中の日付（左から） */
function dateHits(s: string): DateHit[] {
  const out: DateHit[] = [];
  for (const m of s.matchAll(DATE_RE)) {
    const at = m.index;
    const before = s.slice(0, at).trimEnd();
    const after = s.slice(at + m[0].length).trimStart();
    const end = /[~〜]$/.test(before) || after.startsWith('まで');
    if (m[1] !== undefined) out.push({ y: +m[1], m: +m[2]!, d: +m[3]!, end, start: at, length: m[0].length });
    else if (m[4] !== undefined) out.push({ y: null, m: +m[4], d: +m[5]!, end, start: at, length: m[0].length });
    else out.push({ y: null, m: null, d: +m[6]!, end, start: at, length: m[0].length });
  }
  return out;
}

/**
 * 日付を決める（実在しなければ null）。年が無ければ base（今日、期間の終わりは始まりの日）以降でいちばん近い日、
 * 月も無ければ base の月から先で、その日のある最初の月
 */
export function resolveDate(hit: Pick<DateHit, 'y' | 'm' | 'd'>, base: string): string | null {
  if (hit.y !== null && hit.m !== null) {
    const v = ymd(hit.y, hit.m, hit.d);
    return isDate(v) ? v : null;
  }
  const by = Number(base.slice(0, 4));
  const bm = Number(base.slice(5, 7));
  if (hit.m !== null) {
    if (hit.m < 1 || hit.m > 12) return null;
    for (const y of [by, by + 1, by + 2, by + 3, by + 4]) {
      const v = ymd(y, hit.m, hit.d);
      if (isDate(v) && v >= base) return v;
    }
    return null;
  }
  for (let i = 0; i < 13; i++) {
    const mm = ((bm - 1 + i) % 12) + 1;
    const yy = by + Math.floor((bm - 1 + i) / 12);
    const v = ymd(yy, mm, hit.d);
    if (isDate(v) && v >= base) return v;
  }
  return null;
}

// ---- 時刻 ----

/** 時刻の形：10:00・10時・10時半・10時30分（前に 午前・午後 があれば午後は12時間足す） */
const T = String.raw`(?:午前|午後)?\d{1,2}(?::\d{2}|時(?:半|\d{1,2}分)?)`;
const RANGE_RE = new RegExp(String.raw`((?:午前|午後)?\d{1,2}(?::\d{2}|時(?:半|\d{1,2}分)?)?)\s*[~〜ー－-]\s*(${T})`);
const FROM_RE = new RegExp(String.raw`(${T})\s*(?:から|より|[~〜])`);
const TO_RE = new RegExp(String.raw`(?:(${T})\s*まで|[~〜]\s*(${T}))`);

/** 時刻の文を HH:MM に（読めなければ null） */
export function timeOf(text: string): string | null {
  const m = /^(午前|午後)?(\d{1,2})(?::(\d{2})|時(?:(半)|(\d{1,2})分)?)?$/.exec(text);
  if (!m) return null;
  let h = Number(m[2]);
  const min = m[3] !== undefined ? Number(m[3]) : m[4] ? 30 : m[5] !== undefined ? Number(m[5]) : 0;
  if (m[1] === '午後' && h < 12) h += 12;
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** 欠勤の時間帯（null＝始業から・終業まで。両方 null＝終日）。時刻の形が読めなければ bad */
type AbsenceSpan = { from: string | null; to: string | null; bad: boolean; text: string };

/** 行の時間帯：時刻〜時刻 → 〇時から → 〇時まで → 午前（〜12:00）・午後（12:00〜）。無ければ終日 */
export function absenceSpan(s: string): AbsenceSpan {
  const range = RANGE_RE.exec(s);
  if (range) {
    const from = timeOf(range[1]!);
    const to = timeOf(range[2]!);
    return { from, to, bad: from === null || to === null, text: range[0] };
  }
  const from = FROM_RE.exec(s);
  if (from) {
    const t = timeOf(from[1]!);
    return { from: t, to: null, bad: t === null, text: from[0] };
  }
  const to = TO_RE.exec(s);
  if (to) {
    const t = timeOf((to[1] ?? to[2])!);
    return { from: null, to: t, bad: t === null, text: to[0] };
  }
  if (s.includes('午前')) return { from: null, to: '12:00', bad: false, text: '午前' };
  if (s.includes('午後')) return { from: '12:00', to: null, bad: false, text: '午後' };
  return { from: null, to: null, bad: false, text: '' };
}

// ---- 名前 ----

type NameHit = { person: NoticePerson; start: number; end: number };

/**
 * 行（比べる形）の中の名前：いちばん長く当たった名前を取り、長い名前の中に入っている短い名前（「泉図書館」の中の「図書館」）は捨てる。
 * 1人なら person、同じ文字が2人以上に当たれば sameName、別の名前が2つあれば twoNames、無ければ none
 */
export function findPerson(
  text: string,
  people: readonly NoticePerson[],
): { person: NoticePerson; hit: string } | { error: 'noName' | 'sameName' | 'twoNames' } {
  const hits: NameHit[] = [];
  for (const p of people)
    for (const k of p.keys) {
      for (let i = text.indexOf(k); i >= 0; i = text.indexOf(k, i + 1))
        hits.push({ person: p, start: i, end: i + k.length });
    }
  const kept = hits.filter(
    (h) => !hits.some((o) => o.start <= h.start && h.end <= o.end && o.end - o.start > h.end - h.start),
  );
  const ids = new Set(kept.map((h) => `${h.person.kind}:${h.person.id}`));
  if (ids.size === 0) return { error: 'noName' };
  const first = kept[0]!;
  if (ids.size === 1) return { person: first.person, hit: text.slice(first.start, first.end) };
  const spans = new Set(kept.map((h) => text.slice(h.start, h.end)));
  return { error: spans.size === 1 ? 'sameName' : 'twoNames' };
}

// ---- 言葉 ----

/** 〈スタッフ〉の欠勤の言葉（比べる形）：休み・休・欠勤・希望休・やすみ */
const STAFF_WORD = /休|欠勤|やすみ/;
/** 〈利用者さん〉の取り消しの言葉：中止・キャンセル・休み・お休み */
const CANCEL_WORD = /中止|きゃんせる|休|やすみ/;
/** 〈利用者さん〉の休みの言葉と、休みのメモ */
const LEAVE_WORDS: readonly { re: RegExp; note: string }[] = [
  { re: /入院/, note: '入院' },
  { re: /しょーと/, note: 'ショートステイ' },
];

// ---- 1行を読む ----

const fail = (line: string, reason: string, name = ''): NoticeRead => ({ line, name, action: null, reason });

/**
 * 1行を読む（空の行は null）。今日（today）より前の日付は「過ぎた日」。
 * 〈スタッフ〉＋休みの言葉＝その日の欠勤（時間帯・希望休はメモ「希望休」）、〈利用者さん〉＋入院・ショート＋2つ目の日付か「〜日付」＝休み、
 * 〈利用者さん〉＋中止・キャンセル・休み＝その日の訪問の取り消し
 */
export function readNotice(raw: string, people: readonly NoticePerson[], today: string): NoticeRead | null {
  const line = raw.trim();
  if (line === '') return null;
  const s = line.normalize('NFKC').replace(WEEKDAY_RE, ' ');
  const dates = dateHits(s);
  if (dates.length === 0) return fail(line, READ_REASONS.noDate);
  // 日付を抜いた残りで時刻・名前・言葉を読む（12/3 の 3 を時刻に、日付の数字を名前に混ぜない）
  let rest = s;
  for (const d of [...dates].reverse()) rest = `${rest.slice(0, d.start)} ${rest.slice(d.start + d.length)}`;
  const span = absenceSpan(rest);
  const words = normalizeKana(span.text === '' ? rest : rest.replace(span.text, ' '));
  const found = findPerson(words, people);
  if ('error' in found) return fail(line, READ_REASONS[found.error]);
  const { person } = found;
  const said = words.replace(found.hit, ' ');
  if (person.kind === 'staff') {
    if (!STAFF_WORD.test(said)) return fail(line, READ_REASONS.noWord, person.name);
    if (dates.length > 1) return fail(line, READ_REASONS.twoDates, person.name);
    const date = resolveDate(dates[0]!, today);
    if (date === null) return fail(line, READ_REASONS.badDate, person.name);
    if (date < today) return fail(line, READ_REASONS.past, person.name);
    if (span.bad) return fail(line, READ_REASONS.badTime, person.name);
    const note = said.includes('希望休') ? REQUESTED_OFF_NOTE : '';
    const allDay = note !== '';
    return {
      line,
      name: person.name,
      reason: null,
      action: {
        kind: 'absence',
        staffId: person.id,
        date,
        from: allDay ? null : span.from,
        to: allDay ? null : span.to,
        note,
      },
    };
  }
  const leave = LEAVE_WORDS.find((w) => w.re.test(said));
  if (leave) return readLeave(line, person, dates, today, leave.note);
  if (!CANCEL_WORD.test(said)) return fail(line, READ_REASONS.noWord, person.name);
  if (dates.length > 1) return fail(line, READ_REASONS.twoDates, person.name);
  const date = resolveDate(dates[0]!, today);
  if (date === null) return fail(line, READ_REASONS.badDate, person.name);
  if (date < today) return fail(line, READ_REASONS.past, person.name);
  return { line, name: person.name, reason: null, action: { kind: 'cancel', clientId: person.id, date } };
}

/** 休みの期間：日付が2つなら始まり〜終わり、1つで「〜日付」「日付まで」なら今日〜その日。終わりが無ければ読めない */
function readLeave(line: string, person: NoticePerson, dates: DateHit[], today: string, note: string): NoticeRead {
  if (dates.length > 2) return fail(line, READ_REASONS.twoDates, person.name);
  const [a, b] = dates as [DateHit, DateHit | undefined];
  if (!b && !a.end) return fail(line, READ_REASONS.noEnd, person.name);
  const from = b ? resolveDate(a, today) : today;
  if (from === null) return fail(line, READ_REASONS.badDate, person.name);
  const to = resolveDate(b ?? a, from);
  if (to === null || to < from) return fail(line, READ_REASONS.badDate, person.name);
  if (from < today) return fail(line, READ_REASONS.past, person.name);
  return { line, name: person.name, reason: null, action: { kind: 'leave', clientId: person.id, from, to, note } };
}

/** 貼った文を1行ずつ読む（空の行は飛ばす） */
export function readNotices(text: string, people: readonly NoticePerson[], today: string): NoticeRead[] {
  return text.split(/\r?\n/).flatMap((l) => readNotice(l, people, today) ?? []);
}
