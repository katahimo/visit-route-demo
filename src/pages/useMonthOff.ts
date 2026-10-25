// 月の画面の「休みを入れる」（希望休のまとめ入力。PRD D69）：〈スタッフ〉を選んでいるときだけ。日のマスを押すと希望休を付け外し、
// 結果の知らせ（読み上げ）を残す。案・確定した割当は変えない（振り直しは日の画面で利用者が押す。ADR-0011）
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { DemoData } from '../contracts/data';
import type { Staff } from '../contracts/documents';
import { newId } from '../lib/common';
import type { StaffDay } from '../lib/month';
import { type MonthFocus, offNoteOf } from '../lib/monthView';
import { offDayState, toggleRequestedOff } from '../lib/requestedOff';

export type OffNote = { date: string; text: string; warn: boolean };

export function useMonthOff(x: {
  /** 直前のデータ（描画を待たずに続けて押しても、前の押した分を入れたデータ。付け外しで書き換える） */
  dataRef: RefObject<DemoData>;
  data: DemoData;
  update: (fn: (d: DemoData) => DemoData, label?: string) => void;
  focus: MonthFocus;
  /** 希望休のまとめ入力の機能（ADR-0028 の requestedOff）が入 */
  requestedOn: boolean;
  /** 欠勤・キャンセルの機能（ADR-0028 の sudden）が入（知らせで「欠勤を直す」を案内する） */
  suddenOn: boolean;
  today: string;
  staffById: ReadonlyMap<string, Staff>;
  staffDays: ReadonlyMap<string, StaffDay>;
}) {
  const { dataRef, data, update, focus, today, staffById, suddenOn } = x;
  /** 「休みを入れる」（希望休のまとめ入力。PRD D69）：〈スタッフ〉を選んでいるときだけ。日のマスを押すと希望休を付け外し */
  const [offMode, setOffMode] = useState(false);
  /** 最後に付け外しした結果（読み上げ） */
  const [offNote, setOffNote] = useState<OffNote | null>(null);
  // 「休みを入れる」は〈スタッフ〉を選んでいるときだけ（選びを外したら終わる）
  useEffect(() => {
    if (focus.kind !== 'staff') setOffMode(false);
  }, [focus.kind]);
  // 選ぶ人を変えたら、前の人の操作の結果は消す
  const focusId = focus.kind === 'all' ? '' : focus.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 選ぶ人が変わったときだけ
  useEffect(() => {
    setOffNote(null);
  }, [focusId]);
  const staffDaysRef = useRef(x.staffDays);
  staffDaysRef.current = x.staffDays;
  /** 「休みを入れる」で選んでいる〈スタッフ〉（休みを入れるモードでなければ null） */
  const offStaffId = x.requestedOn && offMode && focus.kind === 'staff' ? focus.id : null;
  /**
   * 希望休を付け外しする（PRD D69）。案・確定した割当は変えない（振り直しは日の画面で利用者が押す。ADR-0011）。
   * その日のその人に訪問があれば、欄に注意を残す
   */
  const toggleOff = useCallback(
    (d: string) => {
      if (!offStaffId) return;
      // 結果は直前のデータ（描画を待たずに続けて押しても、前の押した分を入れたデータ）から出す。
      // 同じ規則で update でも付け外しするので、文と実際の結果が食い違わない
      const id = newId('a');
      const res = toggleRequestedOff(dataRef.current, offStaffId, d, today, id);
      if (res.result === 'unchanged') return;
      dataRef.current = res.data;
      update((y) => toggleRequestedOff(y, offStaffId, d, today, id).data, '希望休');
      setOffNote(
        offNoteOf({
          result: res.result,
          date: d,
          name: staffById.get(offStaffId)?.name ?? '',
          count: staffDaysRef.current.get(d)?.count ?? 0,
          suddenOn,
        }),
      );
    },
    [offStaffId, today, update, staffById, suddenOn, dataRef],
  );
  /** 「休みを入れる」のときのその日の扱い（それ以外は undefined） */
  const offStateOf = (d: string) => (offStaffId ? offDayState(data, offStaffId, d, today) : undefined);
  /** 「休みを入れる」を始める・終わる（前の知らせは消す） */
  const toggleOffMode = () => {
    setOffNote(null);
    setOffMode((m) => !m);
  };

  return { offMode, offNote, offStaffId, toggleOff, offStateOf, toggleOffMode };
}

export type MonthOff = ReturnType<typeof useMonthOff>;
