// 連絡を貼り付けて入れる（PRD D418。ADR-0084）の一覧と書き込み：読んだ行（lib/pasteNotices）をデータに照らして
// 入れられるか（すでに入っている・訪問が無い・勤務の無い日・機能が切）を決め、一覧の文を作り、入れる行を1回で書く。
// 書くのは今の処理（欠勤の saveAbsence・訪問の取り消しの cancelVisitOp・休みの saveLeave）だけで、振り直さない（PRD §4）。
// どれも純粋関数（データを書き換えず新しい DemoData を返す。画面は update(fn) の中で呼ぶ）
import type { DemoData } from '../contracts/data';
import type { Features } from '../contracts/features';
import { visitsOn } from '../patterns';
import { absenceError, absenceText, saveAbsence } from './absences';
import { visitBandKind } from './bandIssues';
import { dateTextFrom } from './dateText';
import { activeDayVisits } from './dayPlan';
import { isOn } from './features';
import { saveLeave } from './leaves';
import { dayStatus } from './month';
import { type NoticeAction, type NoticeRead, noticePeople, readNotices } from './pasteNotices';
import { offDayState, REQUESTED_OFF_NOTE } from './requestedOff';
import { cancelVisitOp } from './visitOps';

/** 一覧の1行：text は読んだ内容（名前・日付まで読めなかった行は元の行）。入れられる行は action（取り消しは訪問の ID も）、入れられない行は reason */
export type PasteRow = {
  line: string;
  text: string;
  action: NoticeAction | null;
  /** 取り消す訪問（cancel のとき） */
  visitIds: string[];
  reason: string | null;
};

/** データを見て分かる読めない理由 */
export const ROW_REASONS = {
  already: 'すでに入っている',
  noVisit: 'その日に訪問が無い',
  noShift: '勤務の無い日',
  badTime: '時刻は30分単位',
  same: '上の行と同じ',
  overlap: '上の行と重なる',
  suddenOff: '欠勤・キャンセルの機能が切',
} as const;

/** 〈利用者さん〉の休みの機能が切のときの理由（呼び方を入れる） */
export const leaveOffReason = (client: string): string => `${client}の休みの機能が切`;

/**
 * 読んだ内容の文（「12/3（水）田中 終日の欠勤」「12/3（水）〜12/10（木）図書館 ふみ 休み（入院）」）。
 * 今日（today）と年が違う日は年も（「2027/1/5（火）」）
 */
export function actionText(a: NoticeAction, name: string, today: string, visits = 1): string {
  const dateText = (date: string) => dateTextFrom(date, today);
  switch (a.kind) {
    case 'absence': {
      const what =
        a.note === REQUESTED_OFF_NOTE ? '希望休' : a.from === null && a.to === null ? '終日の欠勤' : absenceText(a);
      return `${dateText(a.date)}${name} ${what}`;
    }
    case 'cancel':
      return `${dateText(a.date)}${name} 訪問の取り消し${visits > 1 ? `（${visits}件）` : ''}`;
    case 'leave':
      return `${dateText(a.from)}〜${dateText(a.to)}${name} 休み（${a.note}）`;
    default: {
      const _: never = a;
      return _;
    }
  }
}

/** 同じ行かを見る鍵（同じ人・同じ日。休みは同じ期間） */
const keyOf = (a: NoticeAction): string =>
  a.kind === 'absence'
    ? `a:${a.staffId}:${a.date}`
    : a.kind === 'cancel'
      ? `c:${a.clientId}:${a.date}`
      : `l:${a.clientId}:${a.from}:${a.to}`;

/** 一覧の行の鍵（チェックを外した行を覚える）：行の文と、同じ文の何回目か（上に行を足しても同じ行は同じ鍵） */
export function pasteRowKeys(rows: readonly Pick<PasteRow, 'line'>[]): string[] {
  const count = new Map<string, number>();
  return rows.map((r) => {
    const n = count.get(r.line) ?? 0;
    count.set(r.line, n + 1);
    return `${n}:${r.line}`;
  });
}

/** 1つの操作をデータに照らす（入れられなければ理由、取り消しは取り消す訪問） */
function check(
  data: DemoData,
  a: NoticeAction,
  today: string,
  features: Features,
): { reason: string | null; visitIds: string[] } {
  const no = (reason: string) => ({ reason, visitIds: [] });
  switch (a.kind) {
    case 'absence': {
      if (!isOn(features, 'sudden')) return no(ROW_REASONS.suddenOff);
      if (absenceError(a) !== null) return no(ROW_REASONS.badTime);
      const state = offDayState(data, a.staffId, a.date, today);
      if (state === 'noShift') return no(ROW_REASONS.noShift);
      if (state === 'absent' || state === 'requested') return no(ROW_REASONS.already);
      return { reason: null, visitIds: [] };
    }
    case 'cancel': {
      if (!isOn(features, 'sudden')) return no(ROW_REASONS.suddenOff);
      const ids = activeDayVisits(data, a.date)
        .filter((v) => v.clientId === a.clientId)
        .map((v) => v.id);
      if (ids.length > 0) return { reason: null, visitIds: ids };
      // 取り消した訪問・休みの日の訪問だけなら「すでに入っている」
      const any = visitsOn(data, a.date).some((v) => v.clientId === a.clientId);
      return no(any ? ROW_REASONS.already : ROW_REASONS.noVisit);
    }
    case 'leave': {
      if (!isOn(features, 'clientLeave')) return no(leaveOffReason(data.org.terms.client));
      const overlap = data.clientLeaves.some((l) => l.clientId === a.clientId && l.from <= a.to && a.from <= l.to);
      return overlap ? no(ROW_REASONS.already) : { reason: null, visitIds: [] };
    }
    default: {
      const _: never = a;
      return _;
    }
  }
}

/** 受け入れた休みと重なるか（同じ〈利用者さん〉で期間が重なる） */
const overlapsLeave = (accepted: readonly NoticeAction[], a: NoticeAction): boolean =>
  a.kind === 'leave' &&
  accepted.some((x) => x.kind === 'leave' && x.clientId === a.clientId && x.from <= a.to && a.from <= x.to);

/**
 * 読んだ行をデータに照らして一覧にする（同じ人・同じ日（休みは同じ期間）の2つ目からは「上の行と同じ」、
 * 上の行で受け入れた休みと期間が重なる休みは「上の行と重なる」）
 */
export function pasteRowsOf(data: DemoData, reads: readonly NoticeRead[], today: string): PasteRow[] {
  const seen = new Set<string>();
  const accepted: NoticeAction[] = [];
  return reads.map((r): PasteRow => {
    if (!r.action) return { line: r.line, text: r.line, action: null, visitIds: [], reason: r.reason };
    const c = check(data, r.action, today, data.org.features);
    const key = keyOf(r.action);
    const reason =
      c.reason ?? (seen.has(key) ? ROW_REASONS.same : overlapsLeave(accepted, r.action) ? ROW_REASONS.overlap : null);
    if (reason === null) {
      seen.add(key);
      accepted.push(r.action);
    }
    const text = actionText(r.action, r.name, today, c.visitIds.length);
    return reason === null
      ? { line: r.line, text, action: r.action, visitIds: c.visitIds, reason: null }
      : { line: r.line, text, action: null, visitIds: [], reason };
  });
}

/** 貼った文から一覧まで（読む → データに照らす） */
export function pasteRows(data: DemoData, text: string, today: string): PasteRow[] {
  return pasteRowsOf(data, readNotices(text, noticePeople(data.staff, data.clients), today), today);
}

/**
 * 入れる行を書く（1回の update の中で呼ぶ）：欠勤は saveAbsence（ID は newId）、取り消しは cancelVisitOp（今日なら当日キャンセル。
 * 繰り返しの回は「この回だけ」）、休みは saveLeave。担当は振り直さない
 */
export function applyPasteRows(
  d: DemoData,
  rows: readonly PasteRow[],
  today: string,
  newId: (prefix: string) => string,
): DemoData {
  let out = d;
  for (const r of rows) {
    const a = r.action;
    if (!a) continue;
    if (a.kind === 'absence')
      out = saveAbsence(out, {
        id: newId('a'),
        staffId: a.staffId,
        date: a.date,
        from: a.from,
        to: a.to,
        note: a.note,
      });
    else if (a.kind === 'cancel') for (const id of r.visitIds) out = cancelVisitOp(out, id, a.date === today);
    else out = saveLeave(out, { id: newId('leave'), clientId: a.clientId, from: a.from, to: a.to, note: a.note });
  }
  return out;
}

/** 入れたあとの要対応の件数：欠勤・取り消しの日（今日以降）の、担当なし・間に合わない・重なり・休みの人の訪問（要対応の帯と同じ数え方） */
export function pasteCareCount(d: DemoData, rows: readonly PasteRow[], today: string): number {
  const dates = new Set<string>();
  for (const r of rows) if (r.action && r.action.kind !== 'leave' && r.action.date >= today) dates.add(r.action.date);
  let n = 0;
  for (const date of dates)
    for (const issues of dayStatus(d, date).issues.values()) if (visitBandKind(issues) !== undefined) n++;
  return n;
}

/** 主ボタンの言葉 */
export const pasteApplyLabel = (n: number): string => `${n}件を入れる`;

/** 入れたあとの知らせ */
export const pasteDoneText = (n: number, care: number): string => `${n}件を入れました。要対応 ${care}件`;
