// 希望休のまとめ入力（PRD D69。ADR-0014）：月間で〈スタッフ〉を1人選び、「休みを入れる」で日のマスを押して
// 終日の欠勤（メモ「希望休」）を付け外しする。欠勤の記録（absences。ADR-0011）をそのまま使う。
// どれも純粋関数（データを書き換えず新しい DemoData を返す。画面は update(fn) の中で呼ぶ）
import type { DemoData } from '../contracts/data';
import type { Absence } from '../contracts/documents';
import { availabilityOf } from '../domain/availability';
import { saveAbsence } from './absences';

/** 希望休の欠勤のメモ（終日の欠勤で、メモがこの文のものを希望休とみなす） */
export const REQUESTED_OFF_NOTE = '希望休';

/** 希望休か（終日・メモが「希望休」）。メモを書き換えた・時間帯の欠勤はふつうの欠勤 */
export function isRequestedOff(a: Pick<Absence, 'from' | 'to' | 'note'>): boolean {
  return a.from === null && a.to === null && a.note.trim() === REQUESTED_OFF_NOTE;
}

/**
 * 「休みを入れる」で日のマスを押したときの扱い：
 * past＝今日より前（押せない）、noShift＝もともと勤務の無い日（押せない）、absent＝希望休でない欠勤がある（日の画面で直す）、
 * requested＝希望休がある（押すと外す）、open＝勤務日で欠勤が無い（押すと入れる）
 */
export type OffDayState = 'past' | 'noShift' | 'absent' | 'requested' | 'open';

export function offDayState(
  data: Pick<DemoData, 'staff' | 'availability' | 'absences'>,
  staffId: string,
  date: string,
  today: string,
): OffDayState {
  if (date < today) return 'past';
  const mine = data.absences.filter((a) => a.staffId === staffId && a.date === date);
  if (mine.length > 0) return mine.every(isRequestedOff) ? 'requested' : 'absent';
  const s = data.staff.find((x) => x.id === staffId);
  if (!s || !s.active) return 'noShift';
  const override = data.availability.find((a) => a.staffId === staffId && a.date === date);
  return availabilityOf(s, date, override).slots.length === 0 ? 'noShift' : 'open';
}

/**
 * 希望休を付け外しする：open なら終日の欠勤（メモ「希望休」・ID は newId）を足し、requested なら外す。
 * ほか（今日より前・勤務の無い日・希望休でない欠勤）は変えない。訪問の担当は変えない（担当が休みの訪問は要対応に出る。振り直しは日の画面で。ADR-0011）
 */
export function toggleRequestedOff(
  d: DemoData,
  staffId: string,
  date: string,
  today: string,
  newId: string,
): { data: DemoData; result: 'added' | 'removed' | 'unchanged' } {
  const state = offDayState(d, staffId, date, today);
  if (state === 'open') {
    const absence: Absence = { id: newId, staffId, date, from: null, to: null, note: REQUESTED_OFF_NOTE };
    return { data: saveAbsence(d, absence), result: 'added' };
  }
  if (state === 'requested') {
    return {
      data: { ...d, absences: d.absences.filter((a) => !(a.staffId === staffId && a.date === date)) },
      result: 'removed',
    };
  }
  return { data: d, result: 'unchanged' };
}

/** その〈スタッフ〉の、その月（'YYYY-MM'）の希望休の日（日付の順） */
export function requestedOffDates(data: Pick<DemoData, 'absences'>, staffId: string, ym: string): string[] {
  return [
    ...new Set(
      data.absences
        .filter((a) => a.staffId === staffId && a.date.startsWith(`${ym}-`) && isRequestedOff(a))
        .map((a) => a.date),
    ),
  ].sort();
}
