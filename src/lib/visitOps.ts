// 訪問の詳細の欄（components/VisitPanel。PRD D301〜D304。ADR-0051）がデータを読む・書く薄い層。どれも純粋関数で、DemoData を書き換えない。
// 画面はこの層の越しにだけ訪問・繰り返し・担当に触る。版2（ADR-0053）：担当・開始・ピンは訪問が持ち、繰り返しの回は見るときに計算する
// （patterns の visitsOn・findVisit）。変えた回だけを保存した回に書く（putVisits）。
// 書いたデータは呼ぶ側が store の update(fn) で反映する。今日・時刻（now）・新しい ID は引数で受ける（乱数・Date.now を使わない）
// 入力（下書き）・欄の情報・範囲の文は lib/visitDraft、担当の候補・割り当ては lib/visitStaff、一覧は lib/visitLists。
// ここは書く操作（保存・取り消し・戻す・繰り返しを終わらせる）と、確定した日の見比べ

import type { DemoData } from '../contracts/data';
import { type Pattern, type Visit, visitSchema } from '../contracts/documents';
import { addDays, hhmmToMinutes, weekday } from '../domain/time';
import { findVisit, keepsOccurrence, putVisits, visitsOn } from '../patterns';
import { formError, formErrorField } from './common';
import { settleDay } from './dayPlan';
import { isDate } from './isDate';
import {
  normalized,
  occurrenceChanges,
  occurrenceOf,
  SCOPE_LABELS,
  timeChanged,
  type VisitDraft,
  type VisitScope,
} from './visitDraft';
import { savedVisit } from './visitEdit';
import { type AssignFail, assignOnDays, staffPickError } from './visitStaff';
import { canMoveVisit } from './week';
import { moveFollowing } from './weekOps';
import { daysBetween } from './ym';

// ---- 書く ----

/** 保存の入力。staff：undefined＝変えない、null＝担当なし（この回だけ）、ID＝その人 */
export type EditInput = {
  visitId: string | null;
  draft: VisitDraft;
  staff?: string | null;
  scope: VisitScope;
};

export type EditResult =
  | {
      ok: true;
      data: DemoData;
      /** 保存した訪問の ID（これ以降・すべてで回を作り直すと変わる） */
      visitId: string;
      /** 訪問が出入り・変わった日（日付の順） */
      dates: string[];
      /** 何も変えていない */
      unchanged: boolean;
      /** 担当を割り当てられなかった回 */
      failed: AssignFail[];
    }
  | { ok: false; error: string; field?: keyof VisitDraft };

const fail = (error: string, field?: keyof VisitDraft): EditResult => ({ ok: false, error, field });

/** 入力の検査（契約 visitSchema と時刻の前後）。誤りがあれば文と欄 */
function checkDraft(f: VisitDraft, id: string): { error: string; field?: keyof VisitDraft } | null {
  try {
    const v = visitSchema.parse({
      ...normalized(f),
      id,
      staffId: null,
      start: null,
      pinned: false,
      cancelled: false,
      cancelKind: null,
      pattern: null,
    });
    if (!f.clientId) return { error: '〈利用者さん〉を選んでください', field: 'clientId' };
    if (v.latestStart < v.earliestStart)
      return { error: '「最も遅い開始時刻」は「最も早い開始時刻」より後にしてください', field: 'latestStart' };
    return null;
  } catch (e) {
    const k = formErrorField(e);
    return {
      error: k === 'durationMinutes' ? '所要時間は5〜720分の整数で入れてください' : formError(e),
      field: k && k in f ? (k as keyof VisitDraft) : undefined,
    };
  }
}

/** 日を整える（開始を書き直す）。今日より前の日・同じ日は1回だけ */
function settleDates(d: DemoData, dates: Iterable<string>, today: string): DemoData {
  let out = d;
  for (const date of new Set(dates)) if (date >= today) out = settleDay(out, date);
  return out;
}

/**
 * 訪問を保存する（PRD D301〜D303。版2：ADR-0053）。
 * - 新しい訪問：単発の訪問を足す（ids.visit）。担当を選んでいればその日の担当の並びに入れてピンにする
 * - この回だけ（単発の訪問も）：lib/visitEdit の savedVisit（担当はそのまま・繰り返しの回は「この回だけ変えた」）
 * - これ以降：週のドラッグの「これ以降」と同じ lib/weekOps の moveFollowing（同じ曜日の回を新しい曜日・時刻・所要・種類にした
 *   繰り返しに分ける。担当を選んでいれば分けた繰り返しの担当にする。回は見るときに計算するので、範囲の回はその担当になる）。
 *   この回だけ変えた・取り消した回はそのまま
 * - すべて：今日以降で最初の同じ曜日の回から「これ以降」と同じに変える（過去は変えない）
 * 担当（staff）は、この回だけならこの回を、その日の担当の並びに入れてピンにする。時刻を変えた日は開始を書き直す（settleDay）
 */
export function applyVisitEdit(
  d: DemoData,
  input: EditInput,
  today: string,
  ids: { visit: string; patterns: readonly [string, string] },
  _now?: number,
): EditResult {
  const f = normalized(input.draft);
  if (!isDate(f.date)) return fail('日付を入れてください', 'date');
  if (!canMoveVisit(f.date, today)) return fail('今日より前の日にはできません', 'date');
  const err = checkDraft(f, input.visitId ?? ids.visit);
  if (err) return fail(err.error, err.field);
  // 選んだ担当を今の入力の日時で確かめ直す（前の日時の候補で割り当てない）
  const pickErr = staffPickError(d, input.visitId, input.draft, input.staff);
  if (pickErr) return fail(pickErr);

  // 新しい訪問
  if (input.visitId === null) {
    if (input.staff === null) return fail('担当なしは選べません（「変えない」のままにしてください）');
    const nv: Visit = {
      ...f,
      id: ids.visit,
      staffId: null,
      start: null,
      pinned: false,
      cancelled: false,
      cancelKind: null,
      pattern: null,
    };
    let data: DemoData = { ...d, visits: [...d.visits, nv] };
    let failed: AssignFail[] = [];
    if (input.staff) {
      const r = assignOnDays(data, [{ visitId: nv.id, date: nv.date }], input.staff, new Set([nv.id]));
      data = r.data;
      failed = r.failed;
    }
    return { ok: true, data, visitId: nv.id, dates: [nv.date], unchanged: false, failed };
  }

  const v = findVisit(d, input.visitId);
  if (!v) return fail('この訪問は消されています');
  // 今ある訪問の〈利用者さん〉は変えない（変えるなら取り消して足し直す。欄にも出さない）
  const fc = { ...f, clientId: v.clientId };
  if (v.cancelled) return fail('取り消した訪問です。先に「取り消しをやめる」を押してください');
  if (!canMoveVisit(v.date, today)) return fail('今日より前の訪問は変えられません');
  const p = v.pattern ? d.patterns.find((x) => x.id === v.pattern!.id) : undefined;
  const scope: VisitScope = p ? input.scope : 'once';
  const owner = v.staffId;
  const staffChange = input.staff !== undefined && (input.staff !== owner || fc.date !== v.date || scope !== 'once');
  if (input.staff === null && scope !== 'once') return fail('担当なしは「この回だけ」で選んでください');
  const moved = timeChanged(v, fc);
  if (!moved && !staffChange && fc.note === v.note)
    return { ok: true, data: d, visitId: v.id, dates: [], unchanged: true, failed: [] };
  // 時刻も担当も変えない（メモだけ）なら、範囲にかかわらずこの回だけ
  const range: VisitScope = moved || staffChange ? scope : 'once';

  let data = d;
  let id = v.id;
  const dates = new Set([v.date, fc.date]);
  const put = (x: Visit) => {
    data = { ...data, visits: putVisits(data.visits, [x]) };
  };

  if (range === 'once') {
    if (moved || fc.note !== v.note) put(savedVisit(v, fc, v.id));
  } else {
    // すべて：今日以降で最初の、この回だけ変えていない・取り消していない同じ曜日の回から。差は元の日から欄の日付まで
    const firstPlain = range === 'all' ? firstPlainOccurrence(d, v, p!, today) : undefined;
    const anchor = firstPlain ?? v;
    const delta = daysBetween(v.pattern!.date, fc.date);
    const target = (x: Visit) => (x.id === v.id ? fc.date : addDays(x.pattern!.date, delta));
    const start = hhmmToMinutes(fc.earliestStart);
    const r = moveFollowing(d, anchor.id, target(anchor), start, today, ids.patterns, {
      durationMinutes: fc.durationMinutes,
      typeId: fc.typeId,
      windowKind: fc.windowKind,
      width: hhmmToMinutes(fc.latestStart) - start,
      ...(input.staff ? { usualStaffId: input.staff } : {}),
    });
    if (!r)
      return fail(
        `「${SCOPE_LABELS[range]}」ではこの日時にできません（今日より前の日になる・毎月の第N週が合わない など）。「この回だけ」で変えてください`,
      );
    data = r.data;
    for (const x of r.change.removed) dates.add(x.date);
    if (anchor.id === v.id) id = r.movedVisitId ?? v.id;
    else {
      const cur = data.visits.find((x) => x.id === v.id);
      if (cur) {
        // この回だけ変えた回は分けても残るので、この回も同じに変える
        put(savedVisit(cur, fc, cur.id));
      } else {
        const day = target(v);
        const found = [ids.patterns[1], ids.patterns[0], v.pattern!.id]
          .map((pid) => findVisit(data, `${day}_${pid}`))
          .find((x) => !!x && !x.cancelled);
        if (!found) return fail('この回を作り直せませんでした。「この回だけ」で変えてください');
        id = found.id;
      }
    }
    const after = findVisit(data, id);
    if (after && fc.note !== after.note)
      put({ ...after, note: fc.note, pattern: after.pattern ? { ...after.pattern, edited: true } : null });
  }

  const result = findVisit(data, id);
  if (!result) return fail('保存できませんでした');
  let failed: AssignFail[] = [];
  if (staffChange && input.staff !== undefined && range === 'once') {
    const r = assignOnDays(data, [{ visitId: id, date: result.date }], input.staff, new Set([id]));
    data = r.data;
    failed = r.failed;
  }
  data = settleDates(data, dates, today);
  return { ok: true, data, visitId: id, dates: [...dates].sort(), unchanged: false, failed };
}

/** 今日以降で最初の、この回だけ変えていない・取り消していない同じ曜日の回（保存した回と計算した回から） */
function firstPlainOccurrence(d: DemoData, v: Visit, p: Pattern, today: string): Visit | undefined {
  const wd = weekday(v.pattern!.date);
  for (let date = today, i = 0; i < 400; i++, date = addDays(date, 1)) {
    if (weekday(date) !== wd) continue;
    const x = findVisit(d, `${date}_${p.id}`);
    if (x?.pattern && !x.cancelled && !x.pattern.edited) return x;
    if (p.to !== null && date > p.to) return undefined;
  }
  return undefined;
}

/** 取り消す（PRD D74。当日キャンセルなら cancelKind 'sameDay'）。繰り返しの回は「この回だけ変えた」。ピンは外す */
export function cancelVisitOp(d: DemoData, visitId: string, sameDay: boolean): DemoData {
  const v = findVisit(d, visitId);
  if (!v || v.cancelled) return d;
  const next: Visit = {
    ...v,
    cancelled: true,
    cancelKind: sameDay ? 'sameDay' : null,
    pinned: false,
    pattern: v.pattern ? { ...v.pattern, edited: true } : null,
  };
  return { ...d, visits: putVisits(d.visits, [next]) };
}

/** 取り消しをやめる。繰り返しの回は、ほかに変えた所が無ければ「この回だけ変えた」も外す。担当はそのまま（その日の並びに戻る） */
export function uncancelVisitOp(d: DemoData, visitId: string): DemoData {
  const v = findVisit(d, visitId);
  if (!v || !v.cancelled) return d;
  const p = v.pattern ? d.patterns.find((x) => x.id === v.pattern!.id) : undefined;
  const edited = v.pattern ? (p ? occurrenceChanges(v, p, d.visitTypes).length > 0 : v.pattern.edited) : false;
  const next: Visit = {
    ...v,
    cancelled: false,
    cancelKind: null,
    pattern: v.pattern ? { ...v.pattern, edited } : null,
  };
  return { ...d, visits: putVisits(d.visits, [next]) };
}

/**
 * この回の変更を戻す：繰り返しの元の日・時刻・所要・種類に戻し、「この回だけ変えた」を外す（取り消しは別の操作）。
 * 担当はそのまま。元の日か今の日が今日より前・パターンの回でなければそのまま。両方の日の開始を書き直す
 */
export function restoreOccurrenceOp(d: DemoData, visitId: string, today: string): DemoData {
  const v = findVisit(d, visitId);
  const p = v?.pattern ? d.patterns.find((x) => x.id === v.pattern!.id) : undefined;
  if (!v?.pattern || !p || v.cancelled) return d;
  if (!canMoveVisit(v.date, today) || !canMoveVisit(v.pattern.date, today)) return d;
  const o = occurrenceOf(p, v.pattern.date);
  const next: Visit = {
    ...v,
    date: o.date,
    windowKind: o.windowKind,
    earliestStart: o.earliestStart,
    latestStart: o.latestStart,
    durationMinutes: o.durationMinutes,
    typeId: o.typeId,
    start: null,
    pattern: { ...v.pattern, edited: false },
  };
  return settleDates({ ...d, visits: putVisits(d.visits, [next]) }, [v.date, o.date], today);
}

/** 繰り返しを終わらせた結果（消す保存した回の数と、伝えた日のうち回が無くなる日の数） */
export type EndPatternResult = { data: DemoData; removed: number; confirmedDays: number };

/**
 * 繰り返しを last の日で終わらせる（PRD D308）：終了日を last にし（今の終了日のほうが早ければそのまま）、last より後で今日以降の、
 * この回だけ変えていない・取り消していない保存した回を消す（この回だけ変えた・取り消した回と、今日より前の回は残す）。
 * last が開始日・昨日より前なら、開始日か昨日の遅いほうにそろえる（今日より前の回を消さない）。confirmedDays は伝えた日のうち、この繰り返しの回が無くなる日の数
 */
export function endPatternOp(d: DemoData, patternId: string, last: string, today: string): EndPatternResult {
  const p = d.patterns.find((x) => x.id === patternId);
  if (!p) return { data: d, removed: 0, confirmedDays: 0 };
  // 今日より前の回は消さない（版2は繰り返しの回を計算するので、終了日を昨日より前にしない）
  const yesterday = addDays(today, -1);
  const floor = p.from > yesterday ? p.from : yesterday;
  const end = last < floor ? floor : last;
  const to = p.to !== null && p.to < end ? p.to : end;
  // この回だけ変えた・取り消した回とピンの回は残す（removePattern と同じ）
  const gone = d.visits.filter(
    (v) => v.pattern?.id === patternId && v.date > to && v.date >= today && !keepsOccurrence(v),
  );
  const goneIds = new Set(gone.map((v) => v.id));
  const confirmedDays = Object.values(d.snapshots).filter(
    (s) => s.date > to && s.date >= today && s.visits.some((x) => x.id === `${s.date}_${patternId}`),
  ).length;
  return {
    data: {
      ...d,
      patterns: d.patterns.map((x) => (x.id === patternId ? { ...x, to } : x)),
      visits: goneIds.size > 0 ? d.visits.filter((v) => !goneIds.has(v.id)) : d.visits,
    },
    removed: gone.length,
    confirmedDays,
  };
}

/** 日の訪問の見比べる形（ID・日時・所要・種類・担当・取り消し） */
const dayKey = (vs: readonly Visit[]) =>
  JSON.stringify(
    vs.map((v) => [v.id, v.earliestStart, v.latestStart, v.durationMinutes, v.typeId, v.staffId, v.cancelled]),
  );

/**
 * 変える前と後で訪問が変わる、確定（伝えた）した今日以降の日（日付の順）。繰り返しの回は見るときに計算するので、
 * 「これ以降」「すべて」で繰り返しを分けたときは保存した回だけでなく計算した回でも比べる（訪問の詳細の欄・範囲を選び直す帯の確かめ）
 */
export function toldDaysChanged(before: DemoData, after: DemoData, today: string): string[] {
  return Object.keys(before.snapshots)
    .filter((d) => d >= today)
    .sort()
    .filter((d) => dayKey(visitsOn(before, d)) !== dayKey(visitsOn(after, d)));
}
