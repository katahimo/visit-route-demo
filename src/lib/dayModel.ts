// その日の画面で共通に使う形（components/useDayModel）の純粋な計算。React・store は使わない
import type { DemoData } from '../contracts/data';
import type { Absence, Staff } from '../contracts/documents';
import { availabilityOf, type Slot, withoutAbsences } from '../domain/availability';

/**
 * 1人のその日の稼働時間帯。slots は欠勤を差し引いたもの（ADR-0011）、baseSlots は差し引く前、
 * overridden は日ごとの上書きがあるか、absence はその日の欠勤（無ければ null）
 */
export type DaySlots = { slots: Slot[]; baseSlots: Slot[]; overridden: boolean; absence: Absence | null };

/** その日の稼働時間帯（基本の曜日と時間＋日ごとの上書き。欠勤を差し引く）。スタッフID → 時間帯（staff の順） */
export function daySlotsOf(
  staff: readonly Staff[],
  data: Pick<DemoData, 'availability' | 'absences'>,
  date: string,
): Map<string, DaySlots> {
  const overrides = new Map(data.availability.filter((a) => a.date === date).map((a) => [a.staffId, a]));
  const absences = new Map(data.absences.filter((a) => a.date === date).map((a) => [a.staffId, a]));
  return new Map<string, DaySlots>(
    staff.map((s) => {
      const a = availabilityOf(s, date, overrides.get(s.id));
      const absence = absences.get(s.id) ?? null;
      return [
        s.id,
        {
          slots: absence ? withoutAbsences(a.slots, [absence]) : a.slots,
          baseSlots: a.slots,
          overridden: a.overridden,
          absence,
        },
      ];
    }),
  );
}

/** 訪問ID → 担当（未割当 __none は入れない） */
export function ownerMap(routes: Record<string, string[]>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [s, ids] of Object.entries(routes)) if (s !== '__none') for (const id of ids) out.set(id, s);
  return out;
}
