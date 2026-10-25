// 訪問の詳細の欄（components/VisitPanel。PRD D301〜D304。ADR-0051）の入力（下書き）と、欄の上に出す情報・範囲の文。
// どれも純粋関数で、DemoData を書き換えない。書く操作は lib/visitOps、担当の候補・割り当ては lib/visitStaff
import type { DemoData } from '../contracts/data';
import type { Pattern, Visit, VisitType } from '../contracts/documents';
import { isOnLeave } from '../domain/leaves';
import { weekday } from '../domain/time';
import { findVisit, timesOn } from '../patterns';
import { WEEKDAY_LABELS } from './common';
import { mdText } from './dateText';
import { patternWhenText, typeOf } from './patternText';
import { canMoveVisit } from './week';

// ---- 範囲（この回だけ／これ以降／すべて）----

/** 繰り返しの回を変えるときの範囲（週のドラッグの「この回だけ／これ以降」と同じ言葉。PRD D302） */
export type VisitScope = 'once' | 'following' | 'all';
export const SCOPE_LABELS: Record<VisitScope, string> = { once: 'この回だけ', following: 'これ以降', all: 'すべて' };

// ---- 欄の入力 ----

/** 欄で決める訪問の中身（日時・所要・種類・メモ。新しい訪問は〈利用者さん〉も） */
export type VisitDraft = Pick<
  Visit,
  'clientId' | 'date' | 'windowKind' | 'earliestStart' | 'latestStart' | 'durationMinutes' | 'typeId' | 'note'
>;

/** 今の訪問の中身 */
export function draftOf(v: Visit): VisitDraft {
  return {
    clientId: v.clientId,
    date: v.date,
    windowKind: v.windowKind,
    earliestStart: v.earliestStart,
    latestStart: v.latestStart,
    durationMinutes: v.durationMinutes,
    typeId: v.typeId ?? null,
    note: v.note,
  };
}

/** 新しい訪問の初期値（〈利用者さん〉は渡したもの、無ければ利用中の先頭。開始は 09:00、所要は 60分） */
export function newDraft(d: Pick<DemoData, 'clients'>, date: string, clientId?: string, start = '09:00'): VisitDraft {
  return {
    clientId: clientId ?? d.clients.find((c) => c.active)?.id ?? '',
    date,
    windowKind: 'fixed',
    earliestStart: start,
    latestStart: start,
    durationMinutes: 60,
    typeId: null,
    note: '',
  };
}

/** 日時・所要・種類・時間の約束のどれかが違う（メモ・〈利用者さん〉は数えない） */
export function timeChanged(v: Visit, f: VisitDraft): boolean {
  return (
    f.date !== v.date ||
    f.windowKind !== v.windowKind ||
    f.earliestStart !== v.earliestStart ||
    (f.windowKind === 'window' ? f.latestStart : f.earliestStart) !== v.latestStart ||
    f.durationMinutes !== v.durationMinutes ||
    (f.typeId ?? null) !== (v.typeId ?? null)
  );
}

/** 時間の約束が「決まっている」なら開始（遅）＝開始（早）にそろえる */
export const normalized = (f: VisitDraft): VisitDraft =>
  f.windowKind === 'fixed' ? { ...f, latestStart: f.earliestStart } : f;

// ---- 読む ----

/** パターンのその回の元の形（日付は元の日） */
export function occurrenceOf(p: Pattern, date: string): VisitDraft & { date: string } {
  const t = timesOn(p, weekday(date));
  return {
    clientId: p.clientId,
    date,
    windowKind: p.windowKind,
    earliestStart: t.earliestStart,
    latestStart: t.latestStart,
    durationMinutes: p.durationMinutes,
    typeId: p.typeId,
    note: '',
  };
}

/**
 * この回の変更（繰り返しの元の形との違い）の文。例「日付 10/28→10/29」「時刻 14:30→15:00」「所要 60分→90分」「種類 介護→なし」。
 * パターンの回でない・パターンが無ければ空
 */
export function occurrenceChanges(v: Visit, p: Pattern | null | undefined, types: readonly VisitType[]): string[] {
  if (!v.pattern || !p) return [];
  const o = occurrenceOf(p, v.pattern.date);
  const out: string[] = [];
  if (v.date !== o.date) out.push(`日付 ${mdText(o.date)}→${mdText(v.date)}`);
  const t = (x: Pick<Visit, 'windowKind' | 'earliestStart' | 'latestStart'>) =>
    x.windowKind === 'window' ? `${x.earliestStart}〜${x.latestStart}` : x.earliestStart;
  if (t(v) !== t(o)) out.push(`時刻 ${t(o)}→${t(v)}`);
  if (v.durationMinutes !== o.durationMinutes) out.push(`所要 ${o.durationMinutes}分→${v.durationMinutes}分`);
  if ((v.typeId ?? null) !== (o.typeId ?? null)) {
    const name = (id: string | null) => typeOf(types, id)?.name ?? 'なし';
    out.push(`種類 ${name(o.typeId)}→${name(v.typeId ?? null)}`);
  }
  return out;
}

/** 欄の上に出す訪問の情報 */
export type VisitInfo = {
  visit: Visit;
  /** 元の繰り返し（定期パターン。単発・消えたパターンは null） */
  pattern: Pattern | null;
  /** 「月〜金 14:30（10/22から）」（繰り返しの回だけ） */
  patternText: string | null;
  /** 担当とピン（取り消した訪問は担当なし） */
  assignment: { staffId: string | null; pinned: boolean };
  /** 繰り返しの担当（いつもの担当。単発の訪問は null） */
  usualStaffId: string | null;
  /** この回の変更（occurrenceChanges） */
  changes: string[];
  /** 〈利用者さん〉の休みのため無しの回 */
  onLeave: boolean;
  /** 変えられる（今日以降の日。今日より前の訪問は見るだけ） */
  editable: boolean;
};

/** 訪問の情報（無ければ null） */
export function visitInfo(
  d: Pick<DemoData, 'visits' | 'patterns' | 'clients' | 'clientLeaves' | 'visitTypes'>,
  visitId: string,
  today: string,
): VisitInfo | null {
  const v = findVisit(d, visitId);
  if (!v) return null;
  const pattern = v.pattern ? (d.patterns.find((p) => p.id === v.pattern!.id) ?? null) : null;
  return {
    visit: v,
    pattern,
    patternText: pattern ? `${patternWhenText(pattern)}（${mdText(pattern.from)}から）` : null,
    assignment: { staffId: v.cancelled ? null : v.staffId, pinned: v.pinned },
    usualStaffId: pattern?.usualStaffId ?? null,
    changes: occurrenceChanges(v, pattern, d.visitTypes),
    onLeave: isOnLeave(d.clientLeaves, v),
    editable: canMoveVisit(v.date, today),
  };
}

// ---- 範囲の文 ----

/** 範囲の選択肢の文と、そのままにする回 */
export type ScopeTexts = {
  following: string;
  all: string;
  /** 曜日が2つ以上の繰り返し（ほかの曜日の回は変えない） */
  otherDays: boolean;
  /** この回だけ変えた・取り消した、そのままにする回の日付（範囲ごと。この回は除く） */
  keptDates: { following: string[]; all: string[] };
};

/** 同じ繰り返しの同じ曜日の回（元の日の曜日で数える） */
const sameSeries = (v: Visit, x: Visit) =>
  !!x.pattern && x.pattern.id === v.pattern?.id && weekday(x.pattern.date) === weekday(v.pattern.date);

/** 範囲の選択肢の文（繰り返しの回でなければ null）。「これ以降」「すべて」は同じ曜日の回（週のドラッグの「以降すべて」と同じ） */
export function scopeTexts(
  d: Pick<DemoData, 'visits' | 'patterns' | 'clients'>,
  visitId: string,
  today: string,
): ScopeTexts | null {
  const v = findVisit(d, visitId);
  const p = v?.pattern ? d.patterns.find((x) => x.id === v.pattern!.id) : undefined;
  if (!v?.pattern || !p) return null;
  const wd = WEEKDAY_LABELS[weekday(v.pattern.date)];
  const kept = (since: string) =>
    d.visits
      .filter(
        (x) => x.id !== v.id && sameSeries(v, x) && (x.cancelled || x.pattern!.edited) && x.pattern!.date >= since,
      )
      .map((x) => x.date)
      .sort();
  return {
    following: `${mdText(v.date)} 以降の${wd}曜の回`,
    all: `今日以降の${wd}曜の回すべて`,
    otherDays: p.weekdays.length > 1,
    keptDates: { following: kept(v.pattern.date > today ? v.pattern.date : today), all: kept(today) },
  };
}
